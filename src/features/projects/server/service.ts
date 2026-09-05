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
  code: 'invalid_body' | 'invalid_path' | 'conflict'
  message: string
}

export interface ProjectsListResult {
  items: ProjectListItem[]
  registryCorrupt: boolean
}

export interface ProjectsService {
  list(): ProjectsListResult
  addProject(pathInput: unknown, label: string | undefined): AddProjectResult | AddProjectError
  /** Bulunamazsa `false`. */
  removeProject(id: string): boolean
  /** `server.on('close', ...)`'a bağlanır (sözleşme §2.2). Tüm aktif `project-watcher` `stop()`'larını çağırır. */
  stopAll(): void
  /** `/api/health`'in `watchers` alanı için (sözleşme §7 "izleyici sayacı"). */
  getActiveWatcherCount(): number
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
      hub.broadcast('features', { project_id: record.id })
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
    const validated = resolveProjectPath(pathInput)
    if (!validated.ok) {
      return { ok: false, code: validated.code, message: validated.message }
    }
    const added = registry.add(validated.path, label)
    if (!added.ok) {
      return { ok: false, code: 'conflict', message: 'Bu proje zaten izleniyor.' }
    }
    startWatchingIfPossible(added.record)
    hub.broadcast('projects', currentList())
    return { ok: true, item: toProjectListItem(added.record) }
  }

  function removeProject(id: string): boolean {
    const removed = registry.remove(id)
    if (!removed) return false
    const watcher = watchers.get(id)
    if (watcher) {
      watcher.stop()
      watchers.delete(id)
    }
    hub.broadcast('projects', currentList())
    return true
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
