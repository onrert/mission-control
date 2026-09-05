import fs from 'node:fs'
import path from 'node:path'
import { parseFeatureCard } from './parse-feature'
import type { FeatureCard, ProjectListItem } from '../../../shared/types'

/**
 * F-007 sözleşme §4.1 — `docs/features/*.md` dizinini okur (yalnızca `fs.readdirSync`/
 * `fs.readFileSync`/`fs.existsSync`, hiçbir yazma çağrısı — `tests/no-write-gate-bypass.test.ts`
 * guard'ının kapsamı DIŞINDA, o yalnızca yazma/silme çağrılarını yasaklıyor). Alt dizine
 * inilmez (mimari §5.3 "yalnızca dosya adı" varsayımı, F-005'in `depth:0` kararıyla aynı sınıf).
 * `docs/features` yoksa boş dizi (kart yok, hata değil).
 */
export function listFeaturesForProject(project: ProjectListItem): FeatureCard[] {
  const featuresDir = path.join(project.path, 'docs', 'features')
  if (!fs.existsSync(featuresDir)) return []

  const entries = fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.md')

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
  return cards
}

/**
 * Bir veya birden çok proje için (`project_id` filtresi çağıranın sorumluluğu — `handlers.ts`)
 * kartları toplar. Yalnızca `exists:true` projeler taranır (silinmiş/taşınmış proje kökü hata
 * değil, boş sonuç üretir).
 */
export function listFeatures(projects: ProjectListItem[]): FeatureCard[] {
  const cards: FeatureCard[] = []
  for (const project of projects) {
    if (!project.exists) continue
    cards.push(...listFeaturesForProject(project))
  }
  return cards
}
