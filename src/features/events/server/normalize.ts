import path from 'node:path'
import fs from 'node:fs'
import type { EventRecord } from '../../../shared/types'

export type NormalizedEvent = Omit<EventRecord, 'seq' | 'id'>

const DEFAULT_MAX_PAYLOAD = 65536

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Öncelik sırası (sözleşme §4.1, tur 2 düzeltmesi — Bulgu 13): (1) gövde `project_path` varsa
 * olduğu gibi kullanılır; (2) yoksa gövde `cwd` kullanılır ve `realpathSync` denenir — yol
 * yoksa/erişilemezse ham `cwd` değeri korunur (asla throw etmez); (3) ikisi de yoksa boş dizge.
 */
function resolveProjectPath(payload: Record<string, unknown>): string {
  const explicit = stringField(payload, 'project_path')
  if (explicit) return explicit
  const cwd = stringField(payload, 'cwd')
  if (cwd) {
    try {
      return fs.realpathSync(cwd)
    } catch {
      return cwd
    }
  }
  return ''
}

/**
 * Mimari §5.1 türetme tablosu. F-002'nin kendi netleştirmesi (sözleşme §4.1 bayrak kümesi
 * notu): `hook_event_name` alanı VAR ama tabloda karşılığı yoksa `summary` boş kalır — alan
 * yoksa zaten `hookEventName` çağıran tarafça `"unknown"` olarak geçirilir ve o da boş kalır.
 */
function deriveSummary(payload: Record<string, unknown>, hookEventName: string): string {
  const toolInput = isPlainObject(payload.tool_input) ? payload.tool_input : {}
  const toolName = stringField(payload, 'tool_name')

  switch (hookEventName) {
    case 'PreToolUse':
    case 'PostToolUse':
      if (toolName === 'Bash') return stringField(toolInput, 'command') ?? ''
      if (toolName === 'Edit' || toolName === 'Write' || toolName === 'Read') {
        return stringField(toolInput, 'file_path') ?? ''
      }
      if (toolName === 'Task') return stringField(toolInput, 'description') ?? ''
      return ''
    case 'UserPromptSubmit':
      return stringField(payload, 'user_input') ?? ''
    case 'Stop':
    case 'SubagentStop':
      return stringField(payload, 'last_assistant_message') ?? ''
    case 'SessionStart':
    case 'SessionEnd':
      return stringField(payload, 'reason') ?? ''
    case 'Notification':
      return stringField(payload, 'notification_type') ?? ''
    default:
      return ''
  }
}

/**
 * Ham istek gövdesini `EventRecord`'a çevirir (seq/id hariç — bunlar depo tarafından atanır).
 * Asla throw etmez; eksik/bozuk/aşırı büyük her girdi için savunmacı bir varsayılana düşer
 * (PRD F1/AC5: 5xx yok).
 */
export function normalizeEvent(
  rawBody: string,
  now: Date,
  maxPayload: number = DEFAULT_MAX_PAYLOAD
): NormalizedEvent {
  const flags: string[] = []
  let payload: Record<string, unknown> | null = null

  try {
    const parsed: unknown = rawBody.length > 0 ? JSON.parse(rawBody) : {}
    if (isPlainObject(parsed)) {
      payload = parsed
    } else {
      flags.push('parse_error')
    }
  } catch {
    flags.push('parse_error')
  }

  if (!payload) {
    return {
      ts: now.toISOString(),
      received_ms: now.getTime(),
      project_path: '',
      project_name: '',
      hook_event_name: 'unknown',
      summary: '',
      flags,
      raw: { raw_text: rawBody.slice(0, maxPayload) },
    }
  }

  const projectPath = resolveProjectPath(payload)
  const projectName = projectPath ? path.basename(projectPath) : ''
  const hookEventNameRaw = stringField(payload, 'hook_event_name')
  const hookEventName = hookEventNameRaw ?? 'unknown'

  if (!projectPath || !hookEventNameRaw) flags.push('missing_fields')

  const serialized = JSON.stringify(payload)
  let raw: unknown = payload
  if (serialized.length > maxPayload) {
    raw = {
      truncated: true,
      byte_length: Buffer.byteLength(serialized, 'utf8'),
      keys: Object.keys(payload),
    }
    flags.push('raw_truncated')
  }

  return {
    ts: now.toISOString(),
    received_ms: now.getTime(),
    project_path: projectPath,
    project_name: projectName,
    hook_event_name: hookEventName,
    session_id: stringField(payload, 'session_id'),
    agent_id: stringField(payload, 'agent_id'),
    agent_type: stringField(payload, 'agent_type'),
    tool_name: stringField(payload, 'tool_name'),
    tool_use_id: stringField(payload, 'tool_use_id'),
    permission_mode: stringField(payload, 'permission_mode'),
    transcript_path: stringField(payload, 'transcript_path'),
    prompt_id: stringField(payload, 'prompt_id'),
    summary: deriveSummary(payload, hookEventName),
    flags,
    raw,
  }
}
