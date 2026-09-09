import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResponse, UsageReport } from '../../../shared/types'

export type UsageReportLoadState = 'idle' | 'loading' | 'ready' | 'error'

export interface UseUsageReportResult {
  loadState: UsageReportLoadState
  report: UsageReport | null
  errorMessage: string | null
  retry: () => void
}

/**
 * F-011 sözleşmesi §1 — `GET /api/usage`. Thread/Kapılar emsali: istek bazlı (SSE/canlı senkron
 * YOK, `docs/03-ux.md` Durum tasarımı "Bağlantı koptu: Uygulanmaz"), yalnızca mount'ta veya
 * `retry()` çağrılınca çekilir. Proje filtresi yok — tek çağrı tüm izlenen projeleri döner.
 */
export function useUsageReport(options: { fetchImpl?: typeof fetch } = {}): UseUsageReportResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const [loadState, setLoadState] = useState<UsageReportLoadState>('idle')
  const [report, setReport] = useState<UsageReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const requestSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestSeqRef.current
    setLoadState('loading')
    try {
      const res = await fetchImpl('/api/usage')
      const body = (await res.json()) as ApiResponse<UsageReport>
      if (seq !== requestSeqRef.current) return
      if (res.ok && body.success && body.data) {
        setReport(body.data)
        setLoadState('ready')
        return
      }
      setErrorMessage(body.error?.message ?? 'Token verisi yüklenemedi.')
      setLoadState('error')
    } catch {
      if (seq !== requestSeqRef.current) return
      setErrorMessage('Token verisi yüklenemedi.')
      setLoadState('error')
    }
  }, [fetchImpl])

  useEffect(() => {
    void load()
    // `retryToken` yalnızca elle yeniden çekme tetiklemesi için bağımlılıkta.
  }, [load, retryToken])

  return { loadState, report, errorMessage, retry: () => setRetryToken((t) => t + 1) }
}
