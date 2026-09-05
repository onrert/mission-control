import fs from 'node:fs'
import path from 'node:path'
import { parseFeatureCard } from './parse-feature'
import type { FeatureCard, ProjectListItem } from '../../../shared/types'

interface DirReadResult {
  cards: FeatureCard[]
  /** `docs/features` var ama `readdirSync` fırlarsa (ör. EACCES) — D3 "⚠ <proje>: dosyalar
   *  okunamadı" banner'ı için. Dizin yoksa bu asla dolmaz (hata değil, boş sonuç). */
  error?: string
}

function readFeaturesDir(project: ProjectListItem): DirReadResult {
  const featuresDir = path.join(project.path, 'docs', 'features')
  if (!fs.existsSync(featuresDir)) return { cards: [] }

  let entries: fs.Dirent[]
  try {
    entries = fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.extname(entry.name) === '.md')
  } catch (err) {
    return { cards: [], error: err instanceof Error ? err.message : String(err) }
  }

  const cards: FeatureCard[] = []
  for (const entry of entries) {
    const filePath = path.join(featuresDir, entry.name)
    try {
      const buffer = fs.readFileSync(filePath)
      const mtimeMs = fs.statSync(filePath).mtimeMs
      cards.push(parseFeatureCard(buffer, project.id, entry.name, mtimeMs))
    } catch {
      // Dosya okuma sırasında ortadan kalkarsa (yarış durumu) o dosya sessizce atlanır —
      // liste listelemenin bir sonraki turunda tekrar denenir (SSE `features` sinyali).
      continue
    }
  }
  return { cards }
}

/**
 * F-007 sözleşme §4.1 — `docs/features/*.md` dizinini okur (yalnızca `fs.readdirSync`/
 * `fs.readFileSync`/`fs.existsSync`, hiçbir yazma çağrısı — `tests/no-write-gate-bypass.test.ts`
 * guard'ının kapsamı DIŞINDA, o yalnızca yazma/silme çağrılarını yasaklıyor). Alt dizine
 * inilmez (mimari §5.3 "yalnızca dosya adı" varsayımı, F-005'in `depth:0` kararıyla aynı sınıf).
 * `docs/features` yoksa boş dizi (kart yok, hata değil).
 */
export function listFeaturesForProject(project: ProjectListItem): FeatureCard[] {
  return readFeaturesDir(project).cards
}

export interface ListFeaturesDetailed {
  cards: FeatureCard[]
  /** D3 (durum tasarımı, QA bulgu 12) — proje bazlı okuma hatası, diğer projeleri etkilemez. */
  unreadableProjects: Array<{ project_id: string; label: string }>
}

/**
 * Bir veya birden çok proje için (`project_id` filtresi çağıranın sorumluluğu — `handlers.ts`)
 * kartları toplar + okunamayan projeleri ayrı raporlar. Yalnızca `exists:true` projeler taranır
 * (silinmiş/taşınmış proje kökü hata değil, boş sonuç üretir).
 */
export function listFeaturesDetailed(projects: ProjectListItem[]): ListFeaturesDetailed {
  const cards: FeatureCard[] = []
  const unreadableProjects: Array<{ project_id: string; label: string }> = []
  for (const project of projects) {
    if (!project.exists) continue
    const result = readFeaturesDir(project)
    cards.push(...result.cards)
    if (result.error) unreadableProjects.push({ project_id: project.id, label: project.label })
  }
  return { cards, unreadableProjects }
}

/** Geriye dönük basit sarmalayıcı — yalnızca kartlar (hata bilgisi olmadan). */
export function listFeatures(projects: ProjectListItem[]): FeatureCard[] {
  return listFeaturesDetailed(projects).cards
}
