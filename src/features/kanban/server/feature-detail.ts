import fs from 'node:fs'
import path from 'node:path'
import { resolveInsideRootForRead } from './read-guard'
import { extractFeatureBody, parseFeatureCard } from './parse-feature'
import type {
  FeatureDetail,
  FeatureDetailDocument,
  FeatureDetailReport,
} from '../../../shared/types'

/**
 * F-013 sözleşme §2/§4 — bir belge bu karakter sayısını aşarsa kırpılır (sessiz kırpma YASAK,
 * `truncated:true` istemciye gider). Bayt değil KARAKTER sınırı — UTF-8 çok baytlı sınırında
 * bölünme riskini basitçe ortadan kaldırır (Karpathy §2: tam bayt-hizalı kırpma bu ölçekte
 * gereksiz karmaşıklık).
 */
export const MAX_DOCUMENT_CHARS = 200_000

const FEATURE_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.md$/
// `id` frontmatter'dan gelir (proje sahibinin kendi yazdığı metin) — `docs/qa/<id>-*.md` yolunu
// kurmadan önce aynı karakter kümesiyle sınırlanır (write-gate.ts `FILE_NAME_PATTERN` emsali).
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]+$/

export function isValidFeatureFileName(file: string): boolean {
  return FEATURE_FILE_NAME_PATTERN.test(file) && path.basename(file) === file
}

export function truncateDocument(text: string): FeatureDetailDocument {
  if (text.length > MAX_DOCUMENT_CHARS) {
    return { exists: true, content: text.slice(0, MAX_DOCUMENT_CHARS), truncated: true }
  }
  return { exists: true, content: text, truncated: false }
}

/** `dirPath` (çağıran tarafından `resolveInsideRootForRead` ile ÖNCEDEN doğrulanmış) altında
 *  tek bir dosya adı. Dosya yoksa `exists:false` (hata değil — AC'nin "yok" durumu). */
function readOptionalDocument(dirPath: string, fileName: string): FeatureDetailDocument {
  const target = path.join(dirPath, fileName)
  if (!fs.existsSync(target)) return { exists: false }
  if (fs.lstatSync(target).isSymbolicLink()) return { exists: false }
  let buffer: Buffer
  try {
    buffer = fs.readFileSync(target)
  } catch {
    return { exists: true, error: 'Dosya okunamadı.' }
  }
  return truncateDocument(buffer.toString('utf8'))
}

/**
 * `docs/qa/<id>-*.md` — sözleşme dosyası (`<id>-contract.md`) HARİÇ, en eski yazılandan en
 * yeniye (`mtimeMs` artan) sıralı. Birden çok QA turu (`-tur2`, `-tur3`) böylece kronolojik
 * sırayla listelenir (alfabetik sıra `-tur2.md` < `.md` gibi ters dönebiliyordu, ölçüldü —
 * `-` (0x2D) < `.` (0x2E) olduğu için "F-…-tur2.md" alfabetik olarak "F-….md"den ÖNCE gelirdi).
 */
function listQaReports(qaDirPath: string, id: string): FeatureDetailReport[] {
  let entries: string[]
  try {
    entries = fs.readdirSync(qaDirPath)
  } catch {
    return []
  }
  const prefix = `${id}-`
  const contractName = `${id}-contract.md`
  const candidates = entries
    .filter((name) => name.startsWith(prefix) && name.endsWith('.md') && name !== contractName)
    .map((name) => {
      let mtimeMs = 0
      try {
        mtimeMs = fs.statSync(path.join(qaDirPath, name)).mtimeMs
      } catch {
        mtimeMs = 0
      }
      return { name, mtimeMs }
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs)

  return candidates.map(({ name }) => ({ file: name, ...readOptionalDocument(qaDirPath, name) }))
}

export type FeatureDetailResult =
  | { status: 'ok'; detail: FeatureDetail }
  | { status: 'not_found'; message: string }
  | { status: 'invalid_path'; message: string }

/**
 * Saf çekirdek, HTTP'den bağımsız (birim testlenir). `projectPath` ÇAĞIRANIN (`ProjectsService`)
 * önceden `fs.realpathSync.native` ile kanonikleştirdiği köktür (F-005/F-006 deseni,
 * `write-gate.ts`'in `root` parametresiyle aynı varsayım).
 */
export function buildFeatureDetail(projectPath: string, file: string): FeatureDetailResult {
  const bodyResolved = resolveInsideRootForRead(projectPath, ['docs', 'features', file])
  if (!bodyResolved.ok) {
    if (bodyResolved.reason === 'not-found') {
      return { status: 'not_found', message: 'Özellik dosyası bulunamadı.' }
    }
    return { status: 'invalid_path', message: 'Bu dosya izlenen proje kökü dışında, reddedildi.' }
  }

  let buffer: Buffer
  try {
    buffer = fs.readFileSync(bodyResolved.targetPath)
  } catch {
    return { status: 'not_found', message: 'Özellik dosyası okunamadı.' }
  }

  // `project_id`/`mtimeMs` burada önemsiz — yalnızca `id`/`content_hash` kullanılıyor.
  const card = parseFeatureCard(buffer, '', file, 0)
  const bodyDoc = truncateDocument(extractFeatureBody(buffer))

  let contractDoc: FeatureDetailDocument = { exists: false }
  let qaReports: FeatureDetailReport[] = []

  if (SAFE_ID_PATTERN.test(card.id)) {
    const qaDirResolved = resolveInsideRootForRead(projectPath, ['docs', 'qa'])
    if (qaDirResolved.ok) {
      contractDoc = readOptionalDocument(qaDirResolved.targetPath, `${card.id}-contract.md`)
      qaReports = listQaReports(qaDirResolved.targetPath, card.id)
    }
  }

  return {
    status: 'ok',
    detail: {
      content_hash: card.content_hash,
      body: bodyDoc,
      contract: contractDoc,
      qa_reports: qaReports,
    },
  }
}
