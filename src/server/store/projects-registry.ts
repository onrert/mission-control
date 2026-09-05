import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { ProjectListItem, ProjectRecord } from '../../shared/types'

const SCHEMA_VERSION = 1

interface RegistryFile {
  version: number
  projects: ProjectRecord[]
}

export interface AddResult {
  ok: true
  record: ProjectRecord
}

export interface AddConflict {
  ok: false
  code: 'conflict'
}

export interface ProjectsRegistry {
  /** Açılışta bir kez çağrılır: dosyayı okur, bozuksa boş listeyle başlar + `isCorrupt()` işaretler. */
  init(): void
  list(): ProjectRecord[]
  /** `realPath` zaten kayıtlıysa `conflict` döner (dizge eşitliği, `realPath` çağıran tarafından
   *  `fs.realpathSync.native` ile kanonikleştirilmiş olmalı — sözleşme §3 madde 4, D17). */
  add(realPath: string, label: string | undefined): AddResult | AddConflict
  /** Kayıt bulunamazsa `false` döner. */
  remove(id: string): boolean
  findByRealPath(realPath: string): ProjectRecord | undefined
  /** Yalnızca `init()`'in bozuk JSON gördüğü süreç ömrü boyunca `true` — sonraki başarılı
   *  yazımlar sıfırlamaz (QA Bulgu 8b). */
  isCorrupt(): boolean
}

function randomId(): string {
  return `p_${crypto.randomBytes(3).toString('hex')}`
}

/**
 * `data/projects.json` kayıt defterinin fabrika deseninde (jsonl-store ile aynı stil)
 * okunması/yazılması (sözleşme §4.1). `unlink`/`rm` hiç kullanılmaz — yalnızca kendi
 * `projects.json`'ını tmp+rename ile yazar (CEO kararı B/C guard'ı).
 */
export function createProjectsRegistry(dataDir: string): ProjectsRegistry {
  const filePath = path.join(dataDir, 'projects.json')
  let projects: ProjectRecord[] = []
  let corrupt = false

  function writeAtomic(): void {
    const tmpPath = path.join(
      dataDir,
      `.projects.${process.pid}-${crypto.randomBytes(3).toString('hex')}.tmp`
    )
    const body: RegistryFile = { version: SCHEMA_VERSION, projects }
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(tmpPath, JSON.stringify(body, null, 2))
    fs.renameSync(tmpPath, filePath)
  }

  function init(): void {
    if (!fs.existsSync(filePath)) {
      projects = []
      return
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw) as RegistryFile
      projects = Array.isArray(parsed.projects) ? parsed.projects : []
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: ${filePath} okunamadı, boş liste ile başlanıyor: ${message}\n`)
      projects = []
      corrupt = true
    }
  }

  function list(): ProjectRecord[] {
    return [...projects]
  }

  function findByRealPath(realPath: string): ProjectRecord | undefined {
    return projects.find((p) => p.path === realPath)
  }

  function add(realPath: string, label: string | undefined): AddResult | AddConflict {
    if (findByRealPath(realPath)) {
      return { ok: false, code: 'conflict' }
    }
    const record: ProjectRecord = {
      id: randomId(),
      path: realPath,
      label: label ?? path.basename(realPath),
      added_at: new Date().toISOString(),
      enabled: true,
    }
    projects = [...projects, record]
    writeAtomic()
    return { ok: true, record }
  }

  function remove(id: string): boolean {
    const before = projects.length
    projects = projects.filter((p) => p.id !== id)
    if (projects.length === before) return false
    writeAtomic()
    return true
  }

  return {
    init,
    list,
    add,
    remove,
    findByRealPath,
    isCorrupt: () => corrupt,
  }
}

/**
 * `ProjectRecord` -> `ProjectListItem`: `exists`/`feature_count` her çağrıda canlı hesaplanır,
 * kalıcı değildir (sözleşme §3 madde 5). Yalnızca bir dosya sayımı — frontmatter okunmaz/
 * ayrıştırılmaz, F-007'nin alanına (FeatureCard türetimi) girmez.
 */
export function toProjectListItem(record: ProjectRecord): ProjectListItem {
  const exists = fs.existsSync(record.path)
  let featureCount = 0
  if (exists) {
    const featuresDir = path.join(record.path, 'docs', 'features')
    try {
      featureCount = fs
        .readdirSync(featuresDir)
        .filter((name) => path.extname(name) === '.md').length
    } catch {
      featureCount = 0
    }
  }
  return { ...record, exists, feature_count: featureCount }
}
