import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { EventRecord, ProjectListItem } from '../../shared/types'

/**
 * Bağlantı durumu (sözleşme §3 madde 6, CEO kararı D1): 3 gözlemlenebilir durum +
 * `connecting` (ilk bağlanma, henüz `open`/`error` gelmedi — rozette "Yeniden bağlanıyor"
 * ile aynı görsel muameleyi görür, ayrı bir 4. görsel durum eklenmez).
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

const MAX_EVENTS = 1000
const INITIAL_LOAD_LIMIT = 200

/**
 * İlk yükleme / tam yeniden yükleme (`resync`) URL'ini kurar (CEO düzeltmesi — ilk yükleme
 * URL'i, `docs/qa/F-003-contract.md`). Saf ve dışa aktarılır: QA düzeltme turu 1 (D14) —
 * `tests/integration/events-api.test.ts`'in "CEO'nun zorunlu ek çiti" bu fonksiyonun kurduğu
 * URL'i TÜRETEREK gerçek sunucuya sorar; böylece istemcinin gerçekten ürettiği URL'in sunucu
 * tarafından kabul edildiği kanıtlanır (önceki hâli URL'i testin içine literal yazıyordu —
 * istemci yanlış URL üretse bile test yeşil kalırdı). `since_seq` KASITLI olarak HİÇ eklenmez:
 * `query.ts`'in `parseSinceSeq`'i yalnızca parametre TAMAMEN YOKSA -1 (tüm ring) varsayıyor —
 * literal `since_seq=-1` sorgu dizgesi negatif sayı olarak reddedilip 400 döner.
 */
export function buildInitialLoadUrl(eventsUrl: string): string {
  return `${eventsUrl}?limit=${INITIAL_LOAD_LIMIT}`
}

interface EventsState {
  byId: Map<number, EventRecord>
}

type EventsAction =
  { type: 'ADD_EVENTS'; records: EventRecord[] } | { type: 'RESET_EVENTS'; records: EventRecord[] }

function toSortedArray(byId: Map<number, EventRecord>): EventRecord[] {
  return Array.from(byId.values()).sort((a, b) => a.seq - b.seq)
}

/**
 * Sözleşme §3 madde 4: seq bazlı de-dup (Map anahtarı zaten `seq`), 1000 olay tavanı
 * filtresiz listeye uygulanır, aşımda en eski olay(lar) düşer.
 */
function eventsReducer(state: EventsState, action: EventsAction): EventsState {
  if (action.type === 'RESET_EVENTS') {
    const byId = new Map<number, EventRecord>()
    for (const record of action.records) byId.set(record.seq, record)
    return { byId }
  }
  const byId = new Map(state.byId)
  for (const record of action.records) {
    if (!byId.has(record.seq)) byId.set(record.seq, record)
  }
  if (byId.size > MAX_EVENTS) {
    const sortedKeys = Array.from(byId.keys()).sort((a, b) => a - b)
    const removeCount = byId.size - MAX_EVENTS
    for (let i = 0; i < removeCount; i++) byId.delete(sortedKeys[i]!)
  }
  return { byId }
}

// jsdom EventSource'u hiç uygulamıyor (✓ VERIFIED, sözleşme §6) — bu tip yalnızca ihtiyaç
// duyulan yüzeyi tanımlar, testlerde `tests/helpers/fake-event-source.ts` enjekte edilir.
export interface EventSourceLike {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSED: number
  readyState: number
  addEventListener(type: string, listener: (event: MessageEvent) => void): void
  removeEventListener(type: string, listener: (event: MessageEvent) => void): void
  close(): void
}

export type EventSourceConstructor = (new (url: string) => EventSourceLike) & {
  readonly CONNECTING: number
  readonly OPEN: number
  readonly CLOSED: number
}

export interface UseEventStreamOptions {
  EventSourceImpl?: EventSourceConstructor
  fetchImpl?: typeof fetch
  /**
   * F-005 (sözleşme §2.2): `'projects'` SSE kanalına abone olunur — yalnızca bu callback
   * SAĞLANMIŞSA (ADR-004 madde 1 "tek bağlantı çok kanal"). Verilmezse mevcut davranış
   * (Timeline'ın kendi kullanımı) birebir korunur.
   */
  onProjects?: (records: ProjectListItem[]) => void
  /**
   * F-007 (sözleşme §2.2): `'features'` SSE kanalına abone olunur — yalnızca bu callback
   * SAĞLANMIŞSA (ADR-004 madde 1, `onProjects` ile birebir aynı desen). Payload yalnızca
   * `{project_id}` taşır (mimari §6.1'den bilinçli sapma, §3 madde 7); kartların kendisi
   * `GET /api/features` ile ayrıca çekilir.
   */
  onFeatures?: (signal: { project_id: string }) => void
  /**
   * F-008 (sözleşme §7): `'gates'` SSE kanalına abone olunur — `onFeatures` ile BİREBİR aynı
   * desen (yalnızca bu callback SAĞLANMIŞSA, ADR-004 madde 1). Payload yalnızca `{project_id}`
   * taşır (`onFeatures` sapmasının aynısı, §7 — `hub.broadcast('features', ...)` emsali).
   */
  onGates?: (signal: { project_id: string }) => void
  /**
   * F-012 (sözleşme §5) — altı yeni `chat_*` kanalı, `onFeatures` ile BİREBİR aynı desende
   * (yalnızca callback SAĞLANMIŞSA abone olunur, ADR-004 madde 1 "tek bağlantı çok kanal").
   * `onChatSync` farklıdır: bir SSE kanalına değil, native `EventSource` `'open'` olayına
   * (B1/D7 düzeltmesi, `handleOpen` — aşağıda) bağlanır; her (yeniden) bağlanmada ateşlenir.
   */
  onChatMessage?: (payload: unknown) => void
  onChatUserEcho?: (payload: unknown) => void
  onChatToolEvent?: (payload: unknown) => void
  onChatPermissionRequest?: (payload: unknown) => void
  onChatPermissionResolved?: (payload: unknown) => void
  onChatStatus?: (payload: unknown) => void
  onChatError?: (payload: unknown) => void
  onChatSync?: () => void
}

export type LoadState = 'loading' | 'ready' | 'error'

export interface UseEventStreamResult {
  /** Görünür (frozen ise dondurulmuş anlık görüntü) olay listesi, seq artan sırada. */
  events: EventRecord[]
  connectionStatus: ConnectionStatus
  loadState: LoadState
  /** UX "veri okunamadı": sonraki bir yeniden yükleme başarısız oldu ama akış canlı, liste korunuyor. */
  staleData: boolean
  retryInitialLoad: () => void
  pausedByUser: boolean
  scrolledAway: boolean
  frozen: boolean
  pendingCount: number
  togglePause: () => void
  setScrolledAway: (value: boolean) => void
  resume: () => void
}

/**
 * `EventSource` yaşam döngüsü, ilk yükleme, seq bazlı de-dup, resync işleme, duraklat/oto-kaydırma
 * dondurma durumu, bağlantı durumu (sözleşme §1 madde 3/§2.1). `useEventStream(streamUrl,
 * eventsUrl, { EventSourceImpl })` — üretimde varsayılan `window.EventSource`.
 */
export function useEventStream(
  streamUrl: string,
  eventsUrl: string,
  options: UseEventStreamOptions = {}
): UseEventStreamResult {
  const globalEventSource =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { EventSource?: EventSourceConstructor }).EventSource
  const EventSourceImpl = options.EventSourceImpl ?? globalEventSource
  const fetchImpl = options.fetchImpl ?? fetch

  const [state, dispatch] = useReducer(eventsReducer, { byId: new Map() })
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [staleData, setStaleData] = useState(false)
  const [pausedByUser, setPausedByUser] = useState(false)
  const [scrolledAway, setScrolledAwayState] = useState(false)
  const [visibleSnapshot, setVisibleSnapshot] = useState<EventRecord[] | null>(null)
  const hasLoadedRef = useRef(false)

  const frozen = pausedByUser || scrolledAway

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetchImpl(buildInitialLoadUrl(eventsUrl))
      if (!res.ok) throw new Error(`http_${res.status}`)
      const body = (await res.json()) as { data: EventRecord[] }
      dispatch({ type: 'RESET_EVENTS', records: body.data })
      hasLoadedRef.current = true
      setLoadState('ready')
      setStaleData(false)
    } catch {
      if (hasLoadedRef.current) {
        setStaleData(true)
      } else {
        setLoadState('error')
      }
    }
  }, [eventsUrl, fetchImpl])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!EventSourceImpl) return
    const es = new EventSourceImpl(streamUrl)
    const handleOpen = (): void => {
      setConnectionStatus('connected')
      // F-012 B1/D7 düzeltmesi — `hello` DEĞİL, gerçekten var olan ve her (yeniden) bağlanmada
      // ateşlenen native `'open'` olayı. Sohbet ekranı bunu "son 50 mesajı yeniden yükle" tetiği
      // olarak kullanır (kısa kopmalarda boşluk her zaman kapanır, sözleşme §5).
      options.onChatSync?.()
    }
    const handleError = (): void => {
      if (es.readyState === EventSourceImpl.CONNECTING) setConnectionStatus('reconnecting')
      else if (es.readyState === EventSourceImpl.CLOSED) setConnectionStatus('disconnected')
    }
    const handleEvent = (evt: MessageEvent): void => {
      try {
        const record = JSON.parse(evt.data as string) as EventRecord
        dispatch({ type: 'ADD_EVENTS', records: [record] })
      } catch {
        // bozuk olay verisi sessizce yok sayılır — akışın geri kalanını etkilemez.
      }
    }
    const handleResync = (): void => {
      void loadEvents()
    }
    const handleProjects = (evt: MessageEvent): void => {
      if (!options.onProjects) return
      try {
        const records = JSON.parse(evt.data as string) as ProjectListItem[]
        options.onProjects(records)
      } catch {
        // bozuk `projects` verisi sessizce yok sayılır — akışın geri kalanını etkilemez.
      }
    }
    const handleFeatures = (evt: MessageEvent): void => {
      if (!options.onFeatures) return
      try {
        const signal = JSON.parse(evt.data as string) as { project_id: string }
        options.onFeatures(signal)
      } catch {
        // bozuk `features` verisi sessizce yok sayılır — akışın geri kalanını etkilemez.
      }
    }
    const handleGates = (evt: MessageEvent): void => {
      if (!options.onGates) return
      try {
        const signal = JSON.parse(evt.data as string) as { project_id: string }
        options.onGates(signal)
      } catch {
        // bozuk `gates` verisi sessizce yok sayılır — akışın geri kalanını etkilemez.
      }
    }
    // F-012 §5 — altı `chat_*` kanalı, `onFeatures`'ın BİREBİR aynı deseni (bozuk JSON sessizce
    // yok sayılır, yalnızca callback SAĞLANMIŞSA abone olunur). Tek bir fabrika ile tekrar
    // önlenir; her kanalın kendi `MessageEvent` dinleyicisi olması gerektiği için (`removeEventListener`
    // kimliği korumalı) referanslar bir kere üretilip hem ekleme hem kaldırmada kullanılır.
    function makeChatHandler(callback: ((payload: unknown) => void) | undefined) {
      return (evt: MessageEvent): void => {
        if (!callback) return
        try {
          callback(JSON.parse(evt.data as string))
        } catch {
          // bozuk `chat_*` verisi sessizce yok sayılır — akışın geri kalanını etkilemez.
        }
      }
    }
    const chatChannels: Array<[string, ((payload: unknown) => void) | undefined]> = [
      ['chat_message', options.onChatMessage],
      ['chat_user_echo', options.onChatUserEcho],
      ['chat_tool', options.onChatToolEvent],
      ['chat_permission_request', options.onChatPermissionRequest],
      ['chat_permission_resolved', options.onChatPermissionResolved],
      ['chat_status', options.onChatStatus],
      ['chat_error', options.onChatError],
    ]
    const chatHandlers = chatChannels.map(
      ([name, callback]) => [name, makeChatHandler(callback)] as const
    )

    es.addEventListener('open', handleOpen)
    es.addEventListener('error', handleError)
    es.addEventListener('event', handleEvent)
    es.addEventListener('resync', handleResync)
    if (options.onProjects) {
      es.addEventListener('projects', handleProjects)
    }
    if (options.onFeatures) {
      es.addEventListener('features', handleFeatures)
    }
    if (options.onGates) {
      es.addEventListener('gates', handleGates)
    }
    for (const [name, handler] of chatHandlers) {
      es.addEventListener(name, handler)
    }
    return () => {
      es.removeEventListener('open', handleOpen)
      es.removeEventListener('error', handleError)
      es.removeEventListener('event', handleEvent)
      es.removeEventListener('resync', handleResync)
      if (options.onProjects) {
        es.removeEventListener('projects', handleProjects)
      }
      if (options.onFeatures) {
        es.removeEventListener('features', handleFeatures)
      }
      if (options.onGates) {
        es.removeEventListener('gates', handleGates)
      }
      for (const [name, handler] of chatHandlers) {
        es.removeEventListener(name, handler)
      }
      es.close()
    }
  }, [
    streamUrl,
    EventSourceImpl,
    loadEvents,
    options.onProjects,
    options.onFeatures,
    options.onGates,
    options.onChatMessage,
    options.onChatUserEcho,
    options.onChatToolEvent,
    options.onChatPermissionRequest,
    options.onChatPermissionResolved,
    options.onChatStatus,
    options.onChatError,
    options.onChatSync,
  ])

  // Sözleşme §3 madde 5: frozen'a geçişte anlık görüntü al; frozen kalkınca canlıya dön.
  useEffect(() => {
    if (frozen && visibleSnapshot === null) {
      setVisibleSnapshot(toSortedArray(state.byId))
    } else if (!frozen && visibleSnapshot !== null) {
      setVisibleSnapshot(null)
    }
    // state.byId kasıtlı olarak bağımlılıkta değil — yalnızca frozen GEÇİŞİNDE bir anlık
    // görüntü alınır, her yeni olayda snapshot güncellenmez (bu tam olarak "dondurma"nın
    // anlamı). Bu proje `eslint-plugin-react-hooks` kullanmıyor (eslint.config.js), bu yüzden
    // eksik bağımlılık kuralı zaten devrede değil — burada yalnızca niyet belgeleniyor.
  }, [frozen])

  const liveEvents = toSortedArray(state.byId)
  const events = visibleSnapshot ?? liveEvents
  const pendingCount = visibleSnapshot
    ? (() => {
        const visibleIds = new Set(visibleSnapshot.map((e) => e.seq))
        let count = 0
        for (const id of state.byId.keys()) {
          if (!visibleIds.has(id)) count += 1
        }
        return count
      })()
    : 0

  const resume = useCallback(() => {
    setPausedByUser(false)
    setScrolledAwayState(false)
  }, [])

  const togglePause = useCallback(() => {
    setPausedByUser((prev) => {
      if (prev) {
        // "Devam et" — yalnızca duraklatmayı değil, tüm dondurmayı kaldırır (§3 madde 5).
        setScrolledAwayState(false)
        return false
      }
      return true
    })
  }, [])

  const setScrolledAway = useCallback((value: boolean) => {
    setScrolledAwayState(value)
  }, [])

  return {
    events,
    connectionStatus,
    loadState,
    staleData,
    retryInitialLoad: () => void loadEvents(),
    pausedByUser,
    scrolledAway,
    frozen,
    pendingCount,
    togglePause,
    setScrolledAway,
    resume,
  }
}
