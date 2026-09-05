import { useCallback, useEffect, useState } from 'react'
import type { ProjectListItem } from '../../../shared/types'

export type ProjectsLoadState = 'loading' | 'ready' | 'error'

export interface AddProjectSuccess {
  ok: true
}

export interface AddProjectFailure {
  ok: false
  message: string
}

export interface UseProjectsResult {
  items: ProjectListItem[]
  loadState: ProjectsLoadState
  /** QA Bulgu 8b: yalnızca kayıt defteri bozuk başladıysa `true` — sonraki başarılı yazımlar sıfırlamaz. */
  registryCorrupt: boolean
  retry: () => void
  add(path: string, label?: string): Promise<AddProjectSuccess | AddProjectFailure>
  remove(id: string): Promise<void>
}

interface ProjectsListResponse {
  success: boolean
  data: ProjectListItem[]
  registry_corrupt?: true
}

interface ProjectErrorResponse {
  success: false
  error: { code: string; message: string }
}

/**
 * Ayarlar ekranının veri katmanı (sözleşme §2.1). Mount'ta `GET /api/projects`; `liveUpdate`
 * değiştiğinde state'i tam-liste-değiştirme ile günceller (SSE `projects` kanalı, App.tsx'ten
 * gelir). `add`/`remove` iyimser olmayan — yanıtı bekleyip state'i günceller.
 */
export function useProjects(liveUpdate: ProjectListItem[] | null): UseProjectsResult {
  const [items, setItems] = useState<ProjectListItem[]>([])
  const [loadState, setLoadState] = useState<ProjectsLoadState>('loading')
  const [registryCorrupt, setRegistryCorrupt] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error(`http_${res.status}`)
      const body = (await res.json()) as ProjectsListResponse
      setItems(body.data)
      setRegistryCorrupt(body.registry_corrupt === true)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (liveUpdate !== null) {
      setItems(liveUpdate)
    }
  }, [liveUpdate])

  const add = useCallback(
    async (path: string, label?: string): Promise<AddProjectSuccess | AddProjectFailure> => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(label ? { path, label } : { path }),
        })
        const body = (await res.json()) as
          { success: true; data: ProjectListItem } | ProjectErrorResponse
        if (!body.success) {
          return { ok: false, message: body.error.message }
        }
        setItems((prev) => [...prev, body.data])
        return { ok: true }
      } catch {
        return { ok: false, message: 'Liste kaydedilemedi, tekrar deneyin.' }
      }
    },
    []
  )

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) return
      setItems((prev) => prev.filter((p) => p.id !== id))
    } catch {
      // sessizce yut — SSE `projects` kanalı zaten gerçek durumu senkronize edecek.
    }
  }, [])

  return { items, loadState, registryCorrupt, retry: () => void load(), add, remove }
}
