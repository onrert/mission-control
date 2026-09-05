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
  remove(id: string): Promise<AddProjectSuccess | AddProjectFailure>
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
        // Kayıt SSE `projects` kanalıyla da (tam liste) yayınlanır — POST yanıtı ile SSE
        // çerçevesinin varış sırası ağa bağlıdır (SSE zaten açık bir bağlantı, POST yanıtı
        // ayrı bir round-trip). SSE, bu optimistik eklemeden ÖNCE gelirse `prev` zaten yeni
        // kaydı içerir; id bazlı dedup olmadan aynı proje iki kez listelenirdi (E2E'de
        // ampirik gözlendi). Bu yüzden yalnızca `prev`'de henüz yoksa eklenir.
        setItems((prev) => (prev.some((p) => p.id === body.data.id) ? prev : [...prev, body.data]))
        return { ok: true }
      } catch {
        return { ok: false, message: 'Liste kaydedilemedi, tekrar deneyin.' }
      }
    },
    []
  )

  // QA düzeltme turu 2 (D26) — önceki hâl (`if (!res.ok) return`) yazma başarısız olduğunda
  // kullanıcıya HİÇBİR geri bildirim vermiyordu; yorumdaki "SSE `projects` kanalı zaten
  // senkronize edecek" gerekçesi geçersizdi çünkü yazma başarısızken `service.ts` bu kanalda
  // hiç yayın yapmıyor (bkz. `service.ts` `removeProject`). `add()` ile aynı desen: sunucunun
  // döndürdüğü mesajı (`docs/03-ux.md` ekran-3 "Liste kaydedilemedi, tekrar deneyin.") çağırana
  // döndür, `SettingsScreen`/`ProjectRow` görünür kılsın.
  const remove = useCallback(async (id: string): Promise<AddProjectSuccess | AddProjectFailure> => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      const body = (await res.json()) as
        { success: true; data: { removed: boolean } } | ProjectErrorResponse
      if (!body.success) {
        return { ok: false, message: body.error.message }
      }
      setItems((prev) => prev.filter((p) => p.id !== id))
      return { ok: true }
    } catch {
      return { ok: false, message: 'Liste kaydedilemedi, tekrar deneyin.' }
    }
  }, [])

  return { items, loadState, registryCorrupt, retry: () => void load(), add, remove }
}
