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
   *  `fs.realpathSync.native` ile kanonikleştirilmiş olmalı — sözleşme §3 madde 4, D17).
   *  Disk yazımı başarısız olursa FIRLAR (çağıran — `service.ts` — bunu yakalayıp UX'in
   *  istediği "Liste kaydedilemedi, tekrar deneyin." yanıtına çevirir, QA düzeltme turu 1
   *  BLOKLAYICI-1); bu durumda bellekteki liste DEĞİŞMEZ (yazma başarılı olmadan mutasyon
   *  uygulanmaz, bkz. `writeAtomic`). */
  add(realPath: string, label: string | undefined): AddResult | AddConflict
  /** Kayıt bulunamazsa `false` döner. Disk yazımı başarısız olursa FIRLAR (yukarıdaki `add`
   *  notuyla aynı garanti). */
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
 * okunması/yazılması (sözleşme §4.1). İzlenen proje köklerine hiçbir kaldırma/silme/yazma fs
 * çağrısı kullanılmaz — yalnızca kendi `projects.json`/`.tmp` dosyasını (bu veri dizininin
 * içinde) tmp+rename ile yazar (CEO kararı B/C guard'ı). Tek istisna: `writeAtomic` başarısız
 * (ör. `renameSync` `EPERM`) olursa artakalan kendi `.tmp` dosyasını `unlinkSync` ile temizler
 * (QA düzeltme turu 1 BLOKLAYICI-1 eki) — bu, izlenen bir proje köküne değil yalnızca bu veri
 * dizinindeki kendi geçici dosyasına dokunur; `no-delete-guard.test.ts` bu istisnayı ayrı bir
 * assert ile tanır (tehlikeli/özyinelemeli, recursive silme çağrıları bu dosya için de yasaklı
 * kalır).
 */
export function createProjectsRegistry(dataDir: string): ProjectsRegistry {
  const filePath = path.join(dataDir, 'projects.json')
  let projects: ProjectRecord[] = []
  let corrupt = false

  /**
   * `nextProjects`'i diske atomik yazar (tmp+rename). Yazma/yeniden adlandırma BAŞARILI
   * olduktan SONRA bellek (`projects`) güncellenir — QA düzeltme turu 1 BLOKLAYICI-1 eki:
   * önceden bellek diskten ÖNCE güncelleniyordu, yazma başarısız olduğunda bellek-disk
   * ayrışması oluşuyordu. Başarısız olursa artakalan `.tmp` dosyası temizlenir ve orijinal
   * hata olduğu gibi çağırana (`add`/`remove` → `service.ts`) fırlatılır.
   */
  function writeAtomic(nextProjects: ProjectRecord[]): void {
    const tmpPath = path.join(
      dataDir,
      `.projects.${process.pid}-${crypto.randomBytes(3).toString('hex')}.tmp`
    )
    const body: RegistryFile = { version: SCHEMA_VERSION, projects: nextProjects }
    fs.mkdirSync(dataDir, { recursive: true })
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(body, null, 2))
      fs.renameSync(tmpPath, filePath)
    } catch (err) {
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath)
        } catch {
          // best-effort temizlik — orijinal hata zaten yeniden fırlatılacak.
        }
      }
      throw err
    }
    projects = nextProjects
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
    // `writeAtomic` başarısız olursa fırlar ve `projects` closure değişkeni HİÇ atanmaz —
    // bellek disk yazımından önce güncellenmiyor (bkz. `writeAtomic` dokümantasyonu).
    writeAtomic([...projects, record])
    return { ok: true, record }
  }

  function remove(id: string): boolean {
    const next = projects.filter((p) => p.id !== id)
    if (next.length === projects.length) return false
    writeAtomic(next)
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
