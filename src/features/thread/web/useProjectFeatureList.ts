import { useCallback, useEffect, useState } from 'react'
import type { ApiResponse, FeatureCard } from '../../../shared/types'

export type ProjectFeatureListState = 'idle' | 'loading' | 'ready' | 'error'

export interface UseProjectFeatureListResult {
  features: FeatureCard[]
  loadState: ProjectFeatureListState
  retry: () => void
}

/**
 * F-010 sözleşmesi §4 — Thread'in feature seçici dropdown'unun veri katmanı. `GET /api/features`
 * (F-007, MEVCUT uç) `project_id` filtresiyle çağrılır — Kanban'ın `useFeatures.ts`'inin AKSİNE
 * (o TÜM projeleri tek listede tutar, SSE ile canlı senkronize eder) burada yalnızca TEK
 * projenin dropdown listesi gerekiyor, canlı güncelleme YOK (Thread "istek bazlı", `docs/
 * 03-ux.md` Durum tasarımı tablosu) — bu yüzden ayrı, daha basit bir hook (Karpathy §2, `useFeatures`'ı
 * genişletmek yerine).
 */
export function useProjectFeatureList(
  projectId: string | null,
  options: { fetchImpl?: typeof fetch } = {}
): UseProjectFeatureListResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const [features, setFeatures] = useState<FeatureCard[]>([])
  const [loadState, setLoadState] = useState<ProjectFeatureListState>('idle')

  const load = useCallback(async () => {
    if (projectId === null) {
      setFeatures([])
      setLoadState('idle')
      return
    }
    setLoadState('loading')
    try {
      const res = await fetchImpl(`/api/features?project_id=${encodeURIComponent(projectId)}`)
      if (!res.ok) throw new Error(`http_${res.status}`)
      const body = (await res.json()) as ApiResponse<FeatureCard[]>
      setFeatures(body.data ?? [])
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [projectId, fetchImpl])

  useEffect(() => {
    void load()
  }, [load])

  return { features, loadState, retry: () => void load() }
}
