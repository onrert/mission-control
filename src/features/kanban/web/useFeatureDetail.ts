import { useEffect, useRef, useState } from 'react'
import type { ApiResponse, FeatureCard, FeatureDetail } from '../../../shared/types'

export type FeatureDetailLoadState = 'loading' | 'ready' | 'error'

export interface UseFeatureDetailResult {
  loadState: FeatureDetailLoadState
  detail: FeatureDetail | null
  errorMessage: string | null
}

/**
 * F-013 sözleşme §6 — `GET /api/features/detail?project_id=…&file=…`. `card.content_hash`
 * DEĞİŞTİĞİNDE yeniden çeker: yeni bir bayatlık mekanizması icat edilmedi, `KanbanScreen`'in
 * zaten SSE ile taze tuttuğu `content_hash`'e binilir (`KanbanScreen`'in `detailCard`'ı `cards`
 * listesindeki güncel kartla senkronize eden ayrı bir effect'i var — bu hook yalnızca prop
 * olarak aldığı `card`'ın hash'ini izler).
 */
export function useFeatureDetail(
  card: FeatureCard,
  options: { fetchImpl?: typeof fetch } = {}
): UseFeatureDetailResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const [loadState, setLoadState] = useState<FeatureDetailLoadState>('loading')
  const [detail, setDetail] = useState<FeatureDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const seq = ++requestSeqRef.current
    setLoadState('loading')
    const params = new URLSearchParams({ project_id: card.project_id, file: card.file })

    void fetchImpl(`/api/features/detail?${params.toString()}`)
      .then(async (res) => {
        const body = (await res.json()) as ApiResponse<FeatureDetail>
        if (cancelled || seq !== requestSeqRef.current) return
        if (res.ok && body.success && body.data) {
          setDetail(body.data)
          setLoadState('ready')
          return
        }
        setErrorMessage(body.error?.message ?? 'İçerik yüklenemedi. Tekrar deneyin.')
        setLoadState('error')
      })
      .catch(() => {
        if (cancelled || seq !== requestSeqRef.current) return
        setErrorMessage('İçerik yüklenemedi. Tekrar deneyin.')
        setLoadState('error')
      })

    return () => {
      cancelled = true
    }
    // `fetchImpl` testlerde sabit bir referans olarak verilir (`useFeatures.ts` emsali); bu
    // proje `eslint-plugin-react-hooks` kullanmıyor (`eslint.config.js`).
  }, [card.project_id, card.file, card.content_hash, fetchImpl])

  return { loadState, detail, errorMessage }
}
