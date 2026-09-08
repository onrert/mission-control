import { useEffect, useRef, useState } from 'react'
import type { ApiResponse, FeatureCard, FeatureDetail } from '../../../shared/types'

export type FeatureDetailLoadState = 'loading' | 'ready' | 'error'

export interface UseFeatureDetailResult {
  loadState: FeatureDetailLoadState
  detail: FeatureDetail | null
  errorMessage: string | null
  /** QA düzeltme turu K4 (BLOKLAYICI B1) — son BAŞARILI çekmenin `Date.now()` zaman damgası,
   *  panelde "bu içerik ne zaman alındı" göstermek için. Henüz hiç başarılı çekme olmadıysa
   *  `null`. */
  lastFetchedAt: number | null
  /** K4 — kullanıcının elle tetiklediği yeniden çekme (`docs/qa/*` SSE ile izlenmiyor, bu
   *  yüzden otomatik yenilenmeyebilir; manuel bir kaçış yolu bilinçli olarak eklendi, yeni bir
   *  dosya izleme mekanizması İCAT EDİLMEDİ). */
  refresh: () => void
}

/**
 * F-013 sözleşme §6 — `GET /api/features/detail?project_id=…&file=…`. `card.content_hash`
 * DEĞİŞTİĞİNDE yeniden çeker: yeni bir bayatlık mekanizması icat edilmedi, `KanbanScreen`'in
 * zaten SSE ile taze tuttuğu `content_hash`'e binilir (`KanbanScreen`'in `detailCard`'ı `cards`
 * listesindeki güncel kartla senkronize eden ayrı bir effect'i var — bu hook yalnızca prop
 * olarak aldığı `card`'ın hash'ini izler).
 *
 * QA düzeltme turu K4 (BLOKLAYICI B1) — `docs/qa/*` (sözleşme + QA raporları) `content_hash`'e
 * girmiyor (yalnızca gövde baytlarından üretiliyor), bu yüzden gövde hiç değişmeden tek başına
 * değişirse panel açıkken OTOMATİK yenilenmez. Yeni bir dosya izleyici İCAT ETMEK yerine (Karpathy
 * §2 — bu feature'ın kapsamı dışına taşar) `refreshToken` ile ELLE tetiklenebilen bir yeniden
 * çekme eklendi; kullanıcı bayat olduğunu `lastFetchedAt`'ten görür, "Yenile" ile tazeler.
 */
export function useFeatureDetail(
  card: FeatureCard,
  options: { fetchImpl?: typeof fetch } = {}
): UseFeatureDetailResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const [loadState, setLoadState] = useState<FeatureDetailLoadState>('loading')
  const [detail, setDetail] = useState<FeatureDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
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
          setLastFetchedAt(Date.now())
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
  }, [card.project_id, card.file, card.content_hash, refreshToken, fetchImpl])

  function refresh(): void {
    setRefreshToken((t) => t + 1)
  }

  return { loadState, detail, errorMessage, lastFetchedAt, refresh }
}
