import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResponse, ThreadDetail } from '../../../shared/types'

export type ThreadDetailLoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface UseThreadDetailResult {
  loadState: ThreadDetailLoadState
  detail: ThreadDetail | null
  errorMessage: string | null
  retry: () => void
}

/**
 * F-010 sözleşmesi §4 — `GET /api/thread/detail?project_id=…&file=…`. Thread "istek bazlı"dır
 * (`docs/03-ux.md` Durum tasarımı: Bağlantı koptu satırı "Uygulanmaz") — SSE/canlı senkron YOK,
 * yalnızca proje/dosya değişince veya `retry()` çağrılınca yeniden çekilir (`useFeatureDetail.ts`
 * emsali, F-013).
 */
export function useThreadDetail(
  projectId: string | null,
  file: string | null,
  options: { fetchImpl?: typeof fetch } = {}
): UseThreadDetailResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const [loadState, setLoadState] = useState<ThreadDetailLoadState>('idle')
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const requestSeqRef = useRef(0)

  const load = useCallback(async () => {
    if (projectId === null || file === null) {
      setDetail(null)
      setLoadState('idle')
      return
    }
    const seq = ++requestSeqRef.current
    setLoadState('loading')
    const params = new URLSearchParams({ project_id: projectId, file })
    try {
      const res = await fetchImpl(`/api/thread/detail?${params.toString()}`)
      const body = (await res.json()) as ApiResponse<ThreadDetail>
      if (seq !== requestSeqRef.current) return
      if (res.ok && body.success && body.data) {
        setDetail(body.data)
        setLoadState('ready')
        return
      }
      setErrorMessage(body.error?.message ?? 'Thread yüklenemedi.')
      setLoadState('error')
    } catch {
      if (seq !== requestSeqRef.current) return
      setErrorMessage('Thread yüklenemedi.')
      setLoadState('error')
    }
  }, [projectId, file, fetchImpl])

  useEffect(() => {
    void load()
    // `retryToken` yalnızca elle yeniden çekme tetiklemesi için bağımlılıkta.
  }, [load, retryToken])

  return { loadState, detail, errorMessage, retry: () => setRetryToken((t) => t + 1) }
}
