// Mission Control — hook event sender.
// Dependency-free, never blocks the session, always exits 0, never writes to stdout/stderr.
// Contract: docs/qa/F-004-contract.md. Design: docs/02-architecture.md §8.
'use strict'

const http = require('node:http')
const fs = require('node:fs')

// Never let an unexpected exception/rejection turn into a non-zero exit code or a crash.
process.on('uncaughtException', () => process.exit(0))
process.on('unhandledRejection', () => process.exit(0))

// Escape hatch: user disabled the panel, do nothing (not even read stdin).
if (process.env.MC_DISABLE === '1') {
  process.exit(0)
}

// Timer budget (contract §3 madde 3 / "## Süre bütçesi"). Kept as named constants so a test
// can read them from source without running the script (deterministic, no clock).
const STDIN_TIMEOUT_MS = 120
const IDLE_TIMEOUT_MS = 100
const TOTAL_TIMEOUT_MS = 150

// stdin read cap — matches architecture §8.2's own constant, no new number invented.
const STDIN_READ_CAP = 1_000_000

// Fixed cap for the parse-error fallback body's raw_text field (NOT MC_MAX_PAYLOAD — see
// contract §4 "Parse hatası gövde şekli").
const PARSE_ERROR_RAW_TEXT_CAP = 2000

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

function truncate200(value) {
  return typeof value === 'string' ? value.slice(0, 200) : undefined
}

/**
 * Same tolerance as `src/server/index.ts` `resolvePort` (kept as a deliberate small copy —
 * this file has no dependencies and cannot import TS, see docs/qa/F-002-contract.md kod turu
 * notu N2 for the precedent).
 */
function resolvePort() {
  const raw = process.env.MC_PORT
  if (raw === undefined) return 7333
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return 7333
  return parsed
}

/**
 * Same tolerance as `src/server/index.ts` `resolveEnvInt` — `0` is a valid, non-default value
 * (contract §4 ortam değişkenleri tablosu, NOT 11).
 */
function resolveMaxPayload() {
  const raw = process.env.MC_MAX_PAYLOAD
  if (raw === undefined) return 65536
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) return 65536
  return parsed
}

/**
 * Same algorithm as `normalize.ts`'s `resolveProjectPath` (contract §3 madde 6): an explicit
 * `project_path` in the payload wins untouched; otherwise `cwd`/`CLAUDE_PROJECT_DIR`/
 * `process.cwd()` is tried through `fs.realpathSync`, falling back to the raw value on failure.
 */
function resolveProjectPath(payload) {
  const explicit = firstString(payload.project_path)
  if (explicit) return explicit
  const candidate = firstString(payload.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd())
  if (candidate === undefined) return undefined
  try {
    return fs.realpathSync(candidate)
  } catch {
    return candidate
  }
}

/**
 * Karar C compact envelope (contract §3 madde 5): built only when the enriched body exceeds
 * `MC_MAX_PAYLOAD`. Keeps exactly the fields `deriveSummary` (normalize.ts:42-68) reads, each
 * truncated to 200 chars, so `summary` never comes back empty for an oversized event.
 */
function buildCompactEnvelope(payload, projectPath) {
  const toolInput = isPlainObject(payload.tool_input) ? payload.tool_input : {}
  const compactToolInput = {}
  if (typeof toolInput.command === 'string') compactToolInput.command = truncate200(toolInput.command)
  if (typeof toolInput.file_path === 'string')
    compactToolInput.file_path = truncate200(toolInput.file_path)
  if (typeof toolInput.description === 'string')
    compactToolInput.description = truncate200(toolInput.description)

  const envelope = {
    hook_event_name: payload.hook_event_name,
    project_path: projectPath,
    session_id: payload.session_id,
    agent_id: payload.agent_id,
    agent_type: payload.agent_type,
    tool_name: payload.tool_name,
    tool_use_id: payload.tool_use_id,
    permission_mode: payload.permission_mode,
    transcript_path: payload.transcript_path,
    prompt_id: payload.prompt_id,
    mc_client_truncated: true,
    mc_original_keys: Object.keys(payload),
    tool_input: compactToolInput,
    client_ts: new Date().toISOString(),
    client_version: 1,
  }
  if (typeof payload.user_input === 'string') envelope.user_input = truncate200(payload.user_input)
  if (typeof payload.last_assistant_message === 'string')
    envelope.last_assistant_message = truncate200(payload.last_assistant_message)
  if (typeof payload.reason === 'string') envelope.reason = truncate200(payload.reason)
  if (typeof payload.notification_type === 'string')
    envelope.notification_type = truncate200(payload.notification_type)
  return envelope
}

/**
 * Sends the (already serialized) body over HTTP with the two independent network guards
 * (contract §3 madde 3): an idle socket timeout and an idle-independent total-time guard.
 * Every path — success, error, either guard — ends in `process.exit(0)` and nothing else.
 */
function send(body) {
  const finish = (() => {
    let settled = false
    return () => {
      if (settled) return
      settled = true
      process.exit(0)
    }
  })()

  let req
  try {
    req = http.request({
      host: '127.0.0.1',
      port: resolvePort(),
      path: '/api/events',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    })
  } catch {
    finish()
    return
  }

  // Idle-independent total-time guard: fires TOTAL_TIMEOUT_MS after the request was created,
  // regardless of socket activity (this is what a byte-dripping server cannot escape).
  const totalTimer = setTimeout(() => {
    req.destroy()
    finish()
  }, TOTAL_TIMEOUT_MS)
  totalTimer.unref()

  // Idle socket guard: fires only if the socket sees no activity at all for IDLE_TIMEOUT_MS
  // (this is what a fully silent server triggers).
  req.setTimeout(IDLE_TIMEOUT_MS, () => {
    req.destroy()
    finish()
  })

  req.on('response', (res) => {
    res.resume()
    res.on('end', finish)
    res.on('error', finish)
  })
  req.on('error', finish)

  req.end(body)
}

function sendParseErrorBody(originalText) {
  const body = {
    hook_event_name: 'unknown',
    project_path: resolveProjectPath({}),
    mc_parse_error: true,
    raw_text: originalText.slice(0, PARSE_ERROR_RAW_TEXT_CAP),
  }
  send(JSON.stringify(body))
}

function sendPayload(payload) {
  const projectPath = resolveProjectPath(payload)
  const enriched = Object.assign({}, payload, {
    project_path: projectPath,
    client_ts: new Date().toISOString(),
    client_version: 1,
  })

  const maxPayload = resolveMaxPayload()
  let serialized
  try {
    serialized = JSON.stringify(enriched)
  } catch {
    serialized = null
  }

  if (serialized !== null && serialized.length <= maxPayload) {
    send(serialized)
    return
  }
  send(JSON.stringify(buildCompactEnvelope(payload, projectPath)))
}

function handleStdin(text) {
  if (text.length === 0) {
    sendPayload({})
    return
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    sendParseErrorBody(text)
    return
  }
  if (!isPlainObject(parsed)) {
    sendParseErrorBody(text)
    return
  }
  sendPayload(parsed)
}

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  if (buf.length < STDIN_READ_CAP) buf += chunk
})
// stdin never ends (unexpected hook framework behavior) — exit cleanly, no network request sent.
// Must be cleared once stdin actually ends — otherwise this dangling timer can still fire
// later (e.g. while a network guard is in flight) and kill the process mid-request, since
// `unref()` only means "don't keep the loop alive on its own", not "never fire".
const stdinGuard = setTimeout(() => process.exit(0), STDIN_TIMEOUT_MS)
stdinGuard.unref()
process.stdin.on('end', () => {
  clearTimeout(stdinGuard)
  try {
    handleStdin(buf)
  } catch {
    process.exit(0)
  }
})
