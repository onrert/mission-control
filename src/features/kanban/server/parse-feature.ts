import crypto from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import { STATUS_COLUMNS } from '../../../shared/constants'
import type { FeatureCard } from '../../../shared/types'

function sha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function idFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/, '')
}

function columnFor(status: string): string {
  return STATUS_COLUMNS.some((c) => c.key === status) ? status : 'unknown'
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** `sprint`/`owner` gibi alanlar frontmatter'da sayı olarak da yazılabilir (ör. `sprint: 1`). */
function asDisplayString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

/**
 * F-007 sözleşme §3 madde 1/2 — saf, `fs`'e dokunmaz. `buffer` çağıran tarafından okunur
 * (`list-features.ts`). `content_hash` write-gate'in `setFeatureStatus`'unun kullandığı TAM
 * DOSYA hash'iyle birebir aynı algoritma (sha256, hex, tam Buffer) — bu, istemcinin
 * `expected_hash` olarak gönderdiği değerin sunucu tarafında GERÇEKTEN eşleşmesi için kritiktir.
 * Tamamı tek bir try/catch içindedir (mimari §5.3); hata veya frontmatter bulunamazsa
 * `parse_error` doldurulur, `id`/`title` dosya adından türetilir.
 */
export function parseFeatureCard(
  buffer: Buffer,
  projectId: string,
  fileName: string,
  mtimeMs: number
): FeatureCard {
  const contentHash = sha256(buffer)
  const fallbackId = idFromFileName(fileName)

  const errorCard = (message: string): FeatureCard => ({
    project_id: projectId,
    file: fileName,
    id: fallbackId,
    title: fallbackId,
    status: '',
    column: 'unknown',
    owner: '',
    deps: [],
    sprint: '',
    content_hash: contentHash,
    mtime_ms: mtimeMs,
    parse_error: message,
  })

  try {
    const text = buffer.toString('utf8')
    const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    if (!withoutBom.startsWith('---')) {
      return errorCard('Frontmatter bulunamadı.')
    }
    // İlk `---`den sonraki ikinci `---`/`...` satırına kadar olan blok. Okuma yolunda
    // write-gate'in yazma tarafındaki satır-koruyucu `split(/(\r\n|\n)/)` yaklaşımına gerek
    // yok (sözleşme §3 madde 1) — burada yalnızca sınırları bulmak yeterli.
    const afterOpening = withoutBom.slice(3)
    const closingMatch = /\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(afterOpening)
    if (!closingMatch) {
      return errorCard('Frontmatter kapanışı bulunamadı.')
    }
    const block = afterOpening.slice(0, closingMatch.index)
    const parsed = parseYaml(block) as Record<string, unknown> | null
    if (parsed === null || typeof parsed !== 'object') {
      return errorCard('Frontmatter geçerli bir YAML nesnesi değil.')
    }

    const status = asString(parsed.status)
    const id = asString(parsed.id, fallbackId)
    const title = asString(parsed.title, id)

    return {
      project_id: projectId,
      file: fileName,
      id,
      title,
      status,
      column: columnFor(status),
      owner: asDisplayString(parsed.owner),
      deps: asStringArray(parsed.deps),
      sprint: asDisplayString(parsed.sprint),
      content_hash: contentHash,
      mtime_ms: mtimeMs,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return errorCard(message)
  }
}
