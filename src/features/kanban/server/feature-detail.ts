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

/**
 * `root` altında `relativeParts`'ın gösterdiği TEK bir dosya — QA düzeltme turu (K1, BLOKLAYICI
 * B2) ÖNCESİ bu fonksiyon çağıranın (`buildFeatureDetail`'in `SAFE_ID_PATTERN` deseni) elle
 * kurduğu bir yolu (`path.join`) hiçbir kapsam kontrolü yapmadan okuyordu — `id` frontmatter'dan
 * geldiği için desen tek başına kaldırılabilir/atlatılabilir bir savunmaydı (QA gerçek bir kök
 * dışı sızıntı ölçtü). Artık HER okuma, gövde okumasıyla AYNI `resolveInsideRootForRead`
 * guard'ından geçer (iki ayrı yol yok — desen artık yalnızca hızlı bir ön-filtre, güvenlik
 * sınırının kendisi değil). Guard reddederse `exists:false` döner (N2 emsali — bilgi sızdırmaz,
 * "yok" ile "erişim reddedildi" ayrımı kullanıcıya gösterilmez).
 */
function readOptionalDocument(root: string, relativeParts: string[]): FeatureDetailDocument {
  const resolved = resolveInsideRootForRead(root, relativeParts)
  if (!resolved.ok) return { exists: false }
  let buffer: Buffer
  try {
    buffer = fs.readFileSync(resolved.targetPath)
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
function listQaReports(root: string, qaDirPath: string, id: string): FeatureDetailReport[] {
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

  return candidates.map(({ name }) => ({
    file: name,
    ...readOptionalDocument(root, ['docs', 'qa', name]),
  }))
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

  // K1 — İKİ bağımsız savunma katmanı, ikisi de gerekli:
  // 1. `SAFE_ID_PATTERN`: `id` içinde `/`/`\` varsa (dolayısıyla birden çok yol PARÇASI
  //    kurulabiliyorsa) baştan reddeder — bu, `docs/qa` İÇİNDE kalan ama BAŞKA bir feature'ın
  //    dosyasına (`id: "F-001/../F-002"` gibi) sızabilecek senaryoyu engeller; alttaki guard
  //    yalnızca "kök içinde mi + `docs/qa` altında mı" bakar, hangi DOSYAYA baktığını sınırlamaz.
  // 2. `readOptionalDocument`/`listQaReports`'un içindeki `resolveInsideRootForRead`: bu satır
  //    tek başına kaldırılsa (mutasyon) bile kök dışına VEYA `docs/qa` alt ağacı dışına çıkan
  //    hiçbir yolu okumaz.
  // `feature-detail.test.ts` bu iki mutasyonu AYRI AYRI çitler.
  if (SAFE_ID_PATTERN.test(card.id)) {
    const qaDirResolved = resolveInsideRootForRead(projectPath, ['docs', 'qa'])
    if (qaDirResolved.ok) {
      contractDoc = readOptionalDocument(projectPath, ['docs', 'qa', `${card.id}-contract.md`])
      qaReports = listQaReports(projectPath, qaDirResolved.targetPath, card.id)
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
