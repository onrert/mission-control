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

export type FrontmatterSplitResult =
  { ok: true; block: string; body: string } | { ok: false; reason: 'no-opening' | 'no-closing' }

/**
 * Baştaki `---`…`---`/`...` bloğunu (frontmatter) gövdeden ayırır — YAML doğrulaması yapmaz,
 * yalnızca metin sınırlarını bulur. `parseFeatureCard` `block`'u, F-013'ün `extractFeatureBody`'si
 * `body`'yi kullanır (ortak sınır bulucu, iki kez yazılmaz).
 */
export function splitFrontmatter(text: string): FrontmatterSplitResult {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!withoutBom.startsWith('---')) return { ok: false, reason: 'no-opening' }
  const afterOpening = withoutBom.slice(3)
  const closingMatch = /\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(afterOpening)
  if (!closingMatch) return { ok: false, reason: 'no-closing' }
  const block = afterOpening.slice(0, closingMatch.index)
  const body = afterOpening.slice(closingMatch.index + closingMatch[0].length)
  return { ok: true, block, body }
}

/**
 * F-013 sözleşme §2 — frontmatter'dan SONRAKİ tüm markdown metnini döner. Frontmatter
 * bulunamazsa/kapanmazsa (dosya bozuk/beklenmedik biçimde) TÜM ham metin döner — panel boş
 * kalmasın diye (Karpathy §2: ayrı bir "gövde ayrıştırılamadı" hata durumu icat edilmiyor,
 * `parseFeatureCard`'ın kendi `parse_error`'ı zaten bu durumu kartın kendisinde işaretliyor).
 */
export function extractFeatureBody(buffer: Buffer): string {
  const text = buffer.toString('utf8')
  const split = splitFrontmatter(text)
  return split.ok ? split.body.replace(/^\r?\n/, '') : text
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
    // İlk `---`den sonraki ikinci `---`/`...` satırına kadar olan blok. Okuma yolunda
    // write-gate'in yazma tarafındaki satır-koruyucu `split(/(\r\n|\n)/)` yaklaşımına gerek
    // yok (sözleşme §3 madde 1) — burada yalnızca sınırları bulmak yeterli (F-013: sınır bulma
    // `splitFrontmatter`'a taşındı, `extractFeatureBody`'nin de kullandığı ortak yardımcı).
    const split = splitFrontmatter(text)
    if (!split.ok) {
      return errorCard(
        split.reason === 'no-opening'
          ? 'Frontmatter bulunamadı.'
          : 'Frontmatter kapanışı bulunamadı.'
      )
    }
    const parsed = parseYaml(split.block) as Record<string, unknown> | null
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
