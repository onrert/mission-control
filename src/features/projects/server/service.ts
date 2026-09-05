import fs from 'node:fs'
import path from 'node:path'
import { createProjectsRegistry, toProjectListItem } from '../../../server/store/projects-registry'
import { watchProjectFeatures, type ProjectWatcher } from '../../../server/watch/project-watcher'
import { resolveProjectPath } from './validate-path'
import type { SseHub } from '../../../server/sse/hub'
import type { ProjectListItem, ProjectRecord } from '../../../shared/types'

export interface AddProjectResult {
  ok: true
  item: ProjectListItem
}

export interface AddProjectError {
  ok: false
  code: 'invalid_body' | 'invalid_path' | 'conflict' | 'storage_unavailable'
  message: string
}

/**
 * QA düzeltme turu 1 (BLOKLAYICI-1) — `registry.remove()` bir disk yazma hatasında fırlayabilir
 * (ör. `projects.json` salt-okunur/dizin hâline gelmiş). Bu durum `ok:false` ile UX'in istediği
 * "Liste kaydedilemedi, tekrar deneyin." mesajına çevrilir; süreç asla ölmez, çağıran her zaman
 * bir sonuç alır.
 */
export type RemoveProjectResult =
  | { ok: true; removed: true }
  | { ok: true; removed: false }
  | { ok: false; code: 'storage_unavailable'; message: string }

export interface ProjectsListResult {
  items: ProjectListItem[]
  registryCorrupt: boolean
}

export interface ProjectsService {
  list(): ProjectsListResult
  addProject(pathInput: unknown, label: string | undefined): AddProjectResult | AddProjectError
  removeProject(id: string): RemoveProjectResult
  /** `server.on('close', ...)`'a bağlanır (sözleşme §2.2). Tüm aktif `project-watcher` `stop()`'larını çağırır. */
  stopAll(): void
  /** `/api/health`'in `watchers` alanı için (sözleşme §7 "izleyici sayacı"). */
  getActiveWatcherCount(): number
}

/**
 * QA düzeltme turu 1 (BLOKLAYICI-1) — kayıt defteri bir disk yazma hatasında fırlar
 * (`registry.ts`'in `writeAtomic`'i). Bu, o fırlatmayı `addProject`/`removeProject` seviyesinde
 * yakalayıp UX'in tanımladığı davranışa çeviren tek, paylaşılan nokta: istemci HER ZAMAN bir
 * yanıt alır (500 `storage_unavailable`), süreç asla `uncaughtException` ile ölmez. Bu, `ingest.
 * ts`'in `storage_unavailable` desenindeki "hata kaynağında yakalanır" ilkesiyle aynı katman —
 * `process.on('uncaughtException')` DEĞİL (CLAUDE.md dersi: o asıl çözüm olamaz).
 */
function storageUnavailableError(err: unknown): {
  ok: false
  code: 'storage_unavailable'
  message: string
} {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(
    `Hata: proje kayıt defterine yazılamadı, istemciye 500 dönülüyor: ${message}\n`
  )
  return { ok: false, code: 'storage_unavailable', message: 'Liste kaydedilemedi, tekrar deneyin.' }
}

/**
 * QA düzeltme turu 2 (D27/NOT-4) — kayıt defteri yazımı zaten BAŞARILI olduktan SONRA çalışan
 * yan etkiler (izleyici başlatma/durdurma, SSE `broadcast`) `withDispatchErrorBoundary`'nin
 * kapsamadığı bir asenkron yığında çalışır (`req.on('end')` içi ya da chokidar'ın debounce
 * zamanlayıcısı — `debounce.ts`'te try/catch yok). Buradan fırlayan bir hata (ör. kapanmış bir
 * SSE soketine `res.write`) yazma işleminin sonucunu DEĞİŞTİRMEMELİ ve süreci düşürmemeli;
 * kaynağında yakalanıp loglanır.
 */
function safelyNotify(action: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Uyarı: ${action} başarısız oldu (süreç etkilenmedi): ${message}\n`)
  }
}

/**
 * Registry + watcher orkestrasyonu + hub broadcast (sözleşme §2.1). Açılışta var olan kayıtlar
 * için `docs/features` varsa otomatik yeniden izlemeye başlar (AC5).
 */
export function createProjectsService(dataDir: string, hub: SseHub): ProjectsService {
  const registry = createProjectsRegistry(dataDir)
  registry.init()

  const watchers = new Map<string, ProjectWatcher>()

  function startWatchingIfPossible(record: ProjectRecord): void {
    if (watchers.has(record.id)) return
    const featuresDir = path.join(record.path, 'docs', 'features')
    if (!fs.existsSync(featuresDir)) return
    const watcher = watchProjectFeatures(featuresDir, () => {
      safelyNotify(`proje değişikliği SSE yayını (${record.id})`, () =>
        hub.broadcast('features', { project_id: record.id })
      )
    })
    watchers.set(record.id, watcher)
  }

  // AC5: açılışta var olan kayıtlar için otomatik yeniden izleme.
  for (const record of registry.list()) {
    startWatchingIfPossible(record)
  }

  function currentList(): ProjectListItem[] {
    return registry.list().map(toProjectListItem)
  }

  function list(): ProjectsListResult {
    return { items: currentList(), registryCorrupt: registry.isCorrupt() }
  }

  function addProject(
    pathInput: unknown,
    label: string | undefined
  ): AddProjectResult | AddProjectError {
    // `resolveProjectPath`'in senkron `fs` çağrıları teorik olarak bir yarış durumunda (§3
    // madde 4 D17 notu — `.native()` çağrısından hemen önce dosya harici bir aktör tarafından
    // silinirse) fırlayabilir; QA düzeltme turu 1 BLOKLAYICI-1'in istediği gibi bu da sarılır.
    let validated: ReturnType<typeof resolveProjectPath>
    try {
      validated = resolveProjectPath(pathInput)
    } catch (err) {
      return storageUnavailableError(err)
    }
    if (!validated.ok) {
      return { ok: false, code: validated.code, message: validated.message }
    }
    let added: ReturnType<typeof registry.add>
    try {
      added = registry.add(validated.path, label)
    } catch (err) {
      return storageUnavailableError(err)
    }
    if (!added.ok) {
      return { ok: false, code: 'conflict', message: 'Bu proje zaten izleniyor.' }
    }
    // D27/NOT-4: yazma zaten başarılı — izleme başlatma/SSE yayını burada fırlarsa çağıran
    // yine de `ok:true` alır (bkz. `safelyNotify` dokümantasyonu).
    safelyNotify('proje eklendi bildirimi (izleme başlatma/SSE yayını)', () => {
      startWatchingIfPossible(added.record)
      hub.broadcast('projects', currentList())
    })
    return { ok: true, item: toProjectListItem(added.record) }
  }

  function removeProject(id: string): RemoveProjectResult {
    let removed: boolean
    try {
      removed = registry.remove(id)
    } catch (err) {
      return storageUnavailableError(err)
    }
    if (!removed) return { ok: true, removed: false }
    // D27/NOT-4: yazma zaten başarılı — izleme durdurma/SSE yayını burada fırlarsa çağıran yine
    // de `ok:true` alır (bkz. `safelyNotify` dokümantasyonu).
    safelyNotify('proje kaldırıldı bildirimi (izleme durdurma/SSE yayını)', () => {
      const watcher = watchers.get(id)
      if (watcher) {
        watcher.stop()
        watchers.delete(id)
      }
      hub.broadcast('projects', currentList())
    })
    return { ok: true, removed: true }
  }

  function stopAll(): void {
    for (const watcher of watchers.values()) {
      watcher.stop()
    }
    watchers.clear()
  }

  return {
    list,
    addProject,
    removeProject,
    stopAll,
    getActiveWatcherCount: () => watchers.size,
  }
}
