import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResponse, FeatureCard, ProjectListItem } from '../../../shared/types'
import { writeFetch } from '../../../web/lib/write-fetch'

export type FeaturesLoadState = 'loading' | 'ready' | 'error'

export function cardKey(card: Pick<FeatureCard, 'project_id' | 'file'>): string {
  return `${card.project_id}::${card.file}`
}

export type PatchOutcome =
  | { kind: 'success'; card: FeatureCard }
  | { kind: 'conflict'; card: FeatureCard; message: string }
  | { kind: 'error'; message: string }

export interface UnreadableProject {
  project_id: string
  label: string
}

export interface UseFeaturesOptions {
  fetchImpl?: typeof fetch
  writeFetchImpl?: typeof fetch
  /** `App.tsx`'in tek `useEventStream()` çağrısından gelen `features` sinyali (§3 madde 7/§4.4).
   *  Her olay YENİ bir nesne referansıdır — aynı `project_id` tekrarlansa bile effect tetiklenir. */
  featuresSignal?: { project_id: string } | null
  /** F-005 AC1'in devraldığı görsel kanıt taahhüdü (feature notu madde 2, T2) — Karar 1'in
   *  "aynı canlı kaynak" prensibiyle App'in mevcut `projects` SSE kanalından (`liveProjectsUpdate`
   *  prop'u, ikinci bir bağlantı YOK). `project-watcher.ts` `ignoreInitial:true` ile kurulur
   *  (§1 kapsam dışı, dokunulmuyor) — YENİ eklenen bir projenin ZATEN VAR OLAN dosyaları için
   *  hiçbir `features` sinyali gelmez, bu yüzden kart 5 sn içinde görünsün diye proje KÜMESİ
   *  BÜYÜDÜĞÜNDE (yalnızca çıkarmada değil) ayrıca bir refetch tetiklenir. */
  projectsSignal?: ProjectListItem[] | null
}

export interface UseFeaturesResult {
  cards: FeatureCard[]
  loadState: FeaturesLoadState
  unreadableProjects: UnreadableProject[]
  lastSyncedAt: number | null
  retry: () => void
  isPending: (card: FeatureCard) => boolean
  patchStatus: (card: FeatureCard, nextStatus: string) => Promise<PatchOutcome>
  /** `KanbanScreen`'in `DndContext.onDragStart`'ı çağırır (ADR-004 y4, §4.4 madde 6). */
  notifyDragStart: () => void
  /** `KanbanScreen`'in `DndContext.onDragEnd`/`onDragCancel`'ı çağırır. */
  notifyDragEnd: () => void
}

function mergeCards(prev: FeatureCard[], fetched: FeatureCard[]): FeatureCard[] {
  const prevByKey = new Map(prev.map((c) => [cardKey(c), c]))
  return fetched.map((next) => {
    const prevCard = prevByKey.get(cardKey(next))
    // Hash-bazlı birleştirme (§4.4 madde 3): içerik değişmediyse AYNI referans korunur —
    // `React.memo` sarılı `KanbanCard` echo refetch'inde yeniden render OLMAZ.
    if (prevCard && prevCard.content_hash === next.content_hash) return prevCard
    return next
  })
}

function replaceCard(cards: FeatureCard[], key: string, next: FeatureCard): FeatureCard[] {
  return cards.map((c) => (cardKey(c) === key ? next : c))
}

const GENERIC_NETWORK_ERROR_MESSAGE = 'sunucuya ulaşılamadı. Tekrar deneyin.'

/**
 * F-007 sözleşme §4 — veri katmanı. Tek yükleme yolu: `GET /api/features` (proje filtresiz,
 * TÜM projeler — Kanban ekranı çok-proje karışık gösterim, `docs/03-ux.md` ekran-2). `patchStatus`
 * iyimser günceller, yanıtı bekleyip düzeltir (§3 madde 8). Sürükleme sırasında gelen `features`
 * sinyalleri kuyruklanır (ADR-004 y4, §4.4 madde 6).
 */
export function useFeatures(options: UseFeaturesOptions = {}): UseFeaturesResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const writeFetchForPatch = options.writeFetchImpl ?? writeFetch

  const [cards, setCards] = useState<FeatureCard[]>([])
  const [loadState, setLoadState] = useState<FeaturesLoadState>('loading')
  const [unreadableProjects, setUnreadableProjects] = useState<UnreadableProject[]>([])
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())

  const isDraggingRef = useRef(false)
  const queuedProjectIdsRef = useRef(new Set<string>())

  const refetch = useCallback(async () => {
    try {
      const res = await fetchImpl('/api/features')
      if (!res.ok) throw new Error(`http_${res.status}`)
      const body = (await res.json()) as ApiResponse<FeatureCard[]>
      setCards((prev) => mergeCards(prev, body.data ?? []))
      setUnreadableProjects(body.meta?.unreadable_projects ?? [])
      setLoadState('ready')
      setLastSyncedAt(Date.now())
    } catch {
      setLoadState((prev) => (prev === 'ready' ? prev : 'error'))
    }
  }, [fetchImpl])

  // Yalnızca mount'ta — sonraki güncellemeler `featuresSignal` üzerinden gelir. Bu proje
  // `eslint-plugin-react-hooks` kullanmıyor (`eslint.config.js`), eksik bağımlılık kuralı
  // devrede değil (bkz. `useEventStream.ts`'teki aynı yorum).
  useEffect(() => {
    void refetch()
  }, [])

  useEffect(() => {
    const signal = options.featuresSignal
    if (signal === null || signal === undefined) return
    if (isDraggingRef.current) {
      queuedProjectIdsRef.current.add(signal.project_id)
      return
    }
    void refetch()
    // `options.featuresSignal` her olayda YENİ bir referans — bağımlılık dizisi bunu yakalar.
  }, [options.featuresSignal])

  // T2 (F-005 AC1 görsel kanıtı) — proje listesi her değiştiğinde (`onProjects` akışı, aynı
  // canlı kaynak) bir refetch tetiklenir. `project-watcher.ts` `ignoreInitial:true` ile
  // kurulduğu için (§1 kapsam dışı, dokunulmuyor) YENİ eklenen bir projenin ZATEN VAR OLAN
  // dosyaları için hiçbir `features` sinyali gelmez — bu yüzden proje listesi de bir tetikleyici
  // olmak ZORUNDA (yalnızca "yeni id" farkını ayırt etmeye çalışmak — ör. mount'taki ilk canlı
  // liste ile önceki durumu karşılaştırmak — mount effect'inin GET'i henüz dönmemişken/dönmüşken
  // oluşan yarış durumlarında ilk gerçek eklemeyi kaçırıyordu; `featuresSignal` ile birebir aynı
  // basit "her değişiklikte refetch" deseni tercih edildi, Karpathy §2).
  useEffect(() => {
    if (options.projectsSignal === undefined || options.projectsSignal === null) return
    if (isDraggingRef.current) {
      queuedProjectIdsRef.current.add('__projects_changed__')
      return
    }
    void refetch()
    // `options.projectsSignal` her `projects` yayınında YENİ bir dizi referansı.
  }, [options.projectsSignal])

  const notifyDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  const notifyDragEnd = useCallback(() => {
    isDraggingRef.current = false
    if (queuedProjectIdsRef.current.size > 0) {
      queuedProjectIdsRef.current.clear()
      void refetch()
    }
  }, [refetch])

  const isPending = useCallback(
    (card: FeatureCard) => pendingKeys.has(cardKey(card)),
    [pendingKeys]
  )

  const patchStatus = useCallback(
    async (card: FeatureCard, nextStatus: string): Promise<PatchOutcome> => {
      const key = cardKey(card)
      const previous = card

      setCards((prev) => replaceCard(prev, key, { ...card, status: nextStatus }))
      setPendingKeys((prev) => new Set(prev).add(key))

      const restore = (): void => {
        setCards((prev) => replaceCard(prev, key, previous))
      }
      const clearPending = (): void => {
        setPendingKeys((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }

      try {
        const res = await writeFetchForPatch(
          `/api/features/${encodeURIComponent(card.project_id)}/${encodeURIComponent(card.file)}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: nextStatus, expected_hash: card.content_hash }),
          }
        )
        const body = (await res.json()) as ApiResponse<FeatureCard>
        clearPending()

        if (res.status === 200 && body.success && body.data) {
          setCards((prev) => replaceCard(prev, key, body.data as FeatureCard))
          setLastSyncedAt(Date.now())
          return { kind: 'success', card: body.data }
        }

        if (res.status === 409 && body.data) {
          setCards((prev) => replaceCard(prev, key, body.data as FeatureCard))
          return {
            kind: 'conflict',
            card: body.data,
            message: body.error?.message ?? 'Dosya değişti, güncel hali yüklendi.',
          }
        }

        restore()
        return { kind: 'error', message: body.error?.message ?? 'Dosya biçimi tanınamadı.' }
      } catch {
        clearPending()
        restore()
        return { kind: 'error', message: GENERIC_NETWORK_ERROR_MESSAGE }
      }
    },
    [writeFetchForPatch]
  )

  return {
    cards,
    loadState,
    unreadableProjects,
    lastSyncedAt,
    retry: () => void refetch(),
    isPending,
    patchStatus,
    notifyDragStart,
    notifyDragEnd,
  }
}
