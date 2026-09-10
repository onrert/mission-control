import path from 'node:path'
import fs from 'node:fs'
import type { EventRecord } from '../../../shared/types'

export type NormalizedEvent = Omit<EventRecord, 'seq' | 'id'>

const DEFAULT_MAX_PAYLOAD = 65536
const SUMMARY_MAX_LENGTH = 200
const SUMMARY_TRUNCATION_MARK = '…'

// G5 güvenlik denetimi K3 (docs/qa/G5-guvenlik-denetimi-2026-09-10.md): izlenen projelerden
// gelen ham hook payload'ı (Bash komutları, dosya yolları, Edit/Write içerikleri, kullanıcı
// promptları) hiçbir redaksiyon olmadan diske/panele düşüyordu. Aşağıdaki iki adım (sır
// redaksiyonu + alan bazlı kırpma) bunu daraltır — ürünü bozmadan, `raw`'ın YAPISINI (anahtar
// kümesi, sayı/boolean/null değerler) değiştirmeden, yalnızca string yaprak değerlerin İÇİNİ
// işler. Bu bir KARA LİSTEdir (cit-tasarimi.md §1): rastgele metinde her sır biçimini önceden
// bilemeyiz; yeni bir sonda turunda listenin büyümesi beklenen bir maliyettir, "kapandı"
// denmez. Belgeleme: docs/decisions/ADR-015-olay-akisi-redaksiyonu.md.
const SECRET_MASK = '[redakte]'
const FIELD_MAX_LENGTH = 4000
const FIELD_TRUNCATION_MARK = '…[içerik kırpıldı]'

// Bilinen anahtar/token önekleri — eşleşen TÜM dizge maskelenir (önek zaten sır olduğunu
// gösteriyor, çevresindeki metnin korunacak bir anlamı yok).
const STANDALONE_SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g, // Anthropic/OpenAI stili anahtarlar (sk-, sk-ant-, sk-proj-…)
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS erişim anahtarı / geçici anahtar
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub kişisel erişim token'ı
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // GitHub ince taneli PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack token
  /\bAIza[0-9A-Za-z_-]{20,}\b/g, // Google API anahtarı
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g, // PEM özel anahtar
]
// Bearer token — "Bearer " öneki korunur, yalnızca token maskelenir (bağlam kaybolmasın).
const BEARER_SECRET_RE = /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi
// api_key/secret/token/password/authorization gibi alan adı + değer çiftleri — yalnızca DEĞER
// maskelenir, alan adı ve ayraç korunur (görünür redaksiyon, ADR-015). Opsiyonel
// Bearer/Basic/Digest şeması korunur (BEARER_SECRET_RE ile aynı davranış, "authorization:
// Bearer …" için çifte eşleşmede tutarlı kalır).
const KEY_VALUE_SECRET_RE =
  /\b(api[_-]?key|secret|token|password|passwd|authorization)\b(\s*[:=]\s*)(['"]?)(?:(Bearer|Basic|Digest)\s+)?([^\s'",}]{6,})\3/gi

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Bir string içindeki bilinen sır biçimlerini görünür bir işaretle maskeler. */
function redactSecretsInString(input: string): { text: string; redacted: boolean } {
  let redacted = false
  let text = input
  for (const pattern of STANDALONE_SECRET_PATTERNS) {
    text = text.replace(pattern, () => {
      redacted = true
      return SECRET_MASK
    })
  }
  text = text.replace(BEARER_SECRET_RE, () => {
    redacted = true
    return `Bearer ${SECRET_MASK}`
  })
  text = text.replace(
    KEY_VALUE_SECRET_RE,
    (_match, key: string, sep: string, quote: string, scheme: string | undefined) => {
      redacted = true
      const schemePrefix = scheme ? `${scheme} ` : ''
      return `${key}${sep}${quote}${schemePrefix}${SECRET_MASK}${quote}`
    }
  )
  return { text, redacted }
}

/** Tek bir string alanı FIELD_MAX_LENGTH'te görünür bir işaretle kırpar. */
function truncateFieldValue(value: string): { text: string; truncated: boolean } {
  if (value.length <= FIELD_MAX_LENGTH) return { text: value, truncated: false }
  return {
    text: value.slice(0, FIELD_MAX_LENGTH) + FIELD_TRUNCATION_MARK,
    truncated: true,
  }
}

/**
 * `payload`'ı derinlemesine gezer; yalnızca string yaprak değerlere sır redaksiyonu + alan
 * kırpması uygular. Obje/dizi yapısı, anahtar kümesi ve string-olmayan değerler DEĞİŞMEZ.
 */
function redactDeep(value: unknown): {
  value: unknown
  secretsRedacted: boolean
  contentTruncated: boolean
} {
  let secretsRedacted = false
  let contentTruncated = false

  function walk(v: unknown): unknown {
    if (typeof v === 'string') {
      const secretStep = redactSecretsInString(v)
      if (secretStep.redacted) secretsRedacted = true
      const truncateStep = truncateFieldValue(secretStep.text)
      if (truncateStep.truncated) contentTruncated = true
      return truncateStep.text
    }
    if (Array.isArray(v)) return v.map(walk)
    if (isPlainObject(v)) {
      const out: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(v)) out[key] = walk(val)
      return out
    }
    return v
  }

  return { value: walk(value), secretsRedacted, contentTruncated }
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
 * Mimari §5.1 satır 254: `summary` ≤ 200 karakter, kırpma işareti dahil. `deriveSummary`
 * ham alan uzunluğunu bilmediği için sınır burada, türetmeden sonra tek noktada uygulanır.
 * BUG-001: gerçek hook payload'larında (ör. uzun Bash `command`) kırpma yapılmadan
 * sınır aşılıyordu; testler/demo olayları `tool_input` içermediği için görülmemişti.
 */
function truncateSummary(value: string): string {
  if (value.length <= SUMMARY_MAX_LENGTH) return value
  return (
    value.slice(0, SUMMARY_MAX_LENGTH - SUMMARY_TRUNCATION_MARK.length) + SUMMARY_TRUNCATION_MARK
  )
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

  // K3 kapanışı: redaksiyon TEK noktada, `payload`'ın kendisi üzerinde uygulanır — böylece
  // `summary` (panelde canlı gösterilir) ve `raw` (diske yazılır) AYNI redakte edilmiş veriden
  // türetilir, ikisi arasında tutarsız bir sızıntı yolu kalmaz.
  const redaction = redactDeep(payload)
  payload = redaction.value as Record<string, unknown>
  if (redaction.secretsRedacted) flags.push('secrets_redacted')
  if (redaction.contentTruncated) flags.push('content_truncated')

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
    summary: truncateSummary(deriveSummary(payload, hookEventName)),
    flags,
    raw,
  }
}
