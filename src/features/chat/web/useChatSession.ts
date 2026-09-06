import { useCallback, useEffect, useRef, useState } from 'react'
import { writeFetch } from '../../../web/lib/write-fetch'
import type { ChatLogEntry } from '../../../shared/types'

/**
 * Sunucunun gerçekten yayınladığı `chat_*` SSE yükleri (sözleşme §5, B7/Ö6'nın kapalı alan
 * kümesi — `src/features/chat/server/session.ts` bu turda OKUNARAK doğrulandı, uydurulmadı).
 */
export interface ChatToolEvent {
  tool_use_id: string
  tool_name: string
  description?: string
  status: 'started' | 'finished' | 'error'
  elapsed_ms?: number
  parent_tool_use_id: string | null
}

export interface ChatPermissionRequestEvent {
  request_id: string
  turn_id: string
  tool_name: string
  input_preview: string
  ts: string
}

export interface ChatPermissionResolvedEvent {
  request_id: string
  turn_id: string
  outcome: 'allow' | 'deny' | 'unknown'
  ts: string
}

export interface ChatMessageEvent {
  turn_id: string
  chat_seq: number
  delta: string
  done: boolean
}

export interface ChatUserEchoEvent {
  turn_id: string
  chat_seq: number
  text: string
  ts: string
}

export interface ChatErrorEvent {
  code: string
  message: string
  /** QA F-012 Ö4 düzeltmesi — yalnızca oturum çökmeden biten (`session_active` `true` kalan)
   *  tur-içi hatalarda dolu gelir (`session.ts` `is_error===true` dalı). Doluysa istemci bu
   *  hatayı transkriptte kalıcı bir `kind:'error'` balonu olarak gösterir (aşağı bkz.
   *  `onChatError`); `budget_exceeded`/`crashed` gibi oturumu düşüren hatalarda `undefined`
   *  kalır — onlar zaten `ErrorRow`/`sessionDown` yoluyla gösteriliyor. */
  turn_id?: string
  chat_seq?: number
}

/** `src/features/chat/server/session.ts` `ChatStatusPayload`'ın tel biçimi — sunucu dosyasından
 *  import EDİLMEZ (istemci/sunucu sınırı, bu projede hiçbir `src/web/**` dosyası `src/server/**`
 *  içe aktarmıyor), burada aynı alanlarla ayrıca tanımlanır. */
export interface ChatStatus {
  session_active: boolean
  session_id: string | undefined
  busy: boolean
  api_key_barrier_tripped: boolean
  stripped_env_vars: string[]
  chat_enabled: boolean
  last_error?: string
  api_key_helper_configured: boolean
  max_budget_usd: number
}

export interface ToolRow {
  tool_use_id: string
  tool_name: string
  description?: string
  status: 'started' | 'finished' | 'error'
  elapsed_ms?: number
  parent_tool_use_id: string | null
  started_at_ms: number
}

export interface AskUserQuestionOption {
  label: string
  description: string
}

export interface AskUserQuestionItem {
  question: string
  header: string
  options: AskUserQuestionOption[]
  multiSelect: boolean
}

export interface PendingPermission {
  request_id: string
  turn_id: string
  tool_name: string
  input_preview: string
  ts: string
  /**
   * `AskUserQuestion` aracının `input_preview`'undan best-effort ayrıştırılmış yapı.
   * [T] TAHMİN — `session.ts` (round A) `input_preview`'u 500 karaktere kırpılmış, boşlukları
   * tek satıra indirgenmiş bir JSON dizgesi olarak üretiyor; uzun/çok seçenekli sorularda bu
   * kırpma JSON'u bozup ayrıştırmayı BAŞARISIZ kılabilir. Ayrıştırma başarısız olursa `undefined`
   * kalır ve kart genel İzin Kartı'na (Onayla/Reddet) düşer — bkz. `docs/qa/
   * F-012-kod-turu-B-notlari.md` "AskUserQuestion açık soru".
   */
  question?: { questions: AskUserQuestionItem[] }
}

/** QA F-012 Ö8 düzeltmesi — `docs/03-ux.md §7` madde (h)2/(h)3 birebir: karar verildikten sonra
 *  kart tek satıra kolabe olur (`Onaylandı — <komut> çalıştı` veya `Reddedildi`), TAMAMEN
 *  silinmez. Eskiden `onChatPermissionResolved` kartı listeden siliyordu, geriye hiçbir iz
 *  kalmıyordu. */
export interface ResolvedPermission {
  request_id: string
  outcome: 'allow' | 'deny' | 'unknown'
  input_preview: string
}

const HISTORY_URL = '/api/chat/history'
const STATUS_URL = '/api/chat/status'
const MESSAGE_URL = '/api/chat/message'
const INTERRUPT_URL = '/api/chat/interrupt'
const PERMISSION_URL = '/api/chat/permission'
const RESTART_URL = '/api/chat/restart'

function entryKey(entry: Pick<ChatLogEntry, 'turn_id' | 'kind' | 'role'>): string {
  return `${entry.turn_id}::${entry.kind}::${entry.role}`
}

/** `history-log.ts`'in `foldByTurn`'üyle AYNI kural: aynı (turn_id, kind, role) için en yüksek
 *  `seq` kazanır — istemci sunucudan bağımsız olarak aynı katlamayı uygular (SSE ile gelen canlı
 *  güncellemeler de bu haritaya aynı kuralla girer). QA F-012 B2 düzeltmesi: `role` eksikti,
 *  aynı turdaki kullanıcı mesajı ve CEO cevabı aynı anahtara düşüp kullanıcı mesajını eziyordu. */
function upsertEntry(
  map: Map<string, ChatLogEntry>,
  entry: ChatLogEntry
): Map<string, ChatLogEntry> {
  const key = entryKey(entry)
  const existing = map.get(key)
  if (existing && existing.seq > entry.seq) return map
  const next = new Map(map)
  next.set(key, entry)
  return next
}

function sortEntries(map: Map<string, ChatLogEntry>): ChatLogEntry[] {
  return [...map.values()].sort((a, b) => a.seq - b.seq)
}

/**
 * `AskUserQuestionInput` şeması (`node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts`,
 * bu turda okunarak ✓ DOĞRULANDI): `{ questions: [{ question, header, options: [{label,
 * description}], multiSelect }] }`. `input_preview` yalnızca bir dizge olduğu için (sunucu
 * `JSON.stringify(input)` + boşluk sıkıştırma + 500 karakter kırpma uyguluyor,
 * `buildInputPreview`) burada best-effort geri ayrıştırılır.
 */
function parseAskUserQuestion(
  toolName: string,
  inputPreview: string
): { questions: AskUserQuestionItem[] } | undefined {
  if (toolName !== 'AskUserQuestion') return undefined
  try {
    const parsed = JSON.parse(inputPreview) as { questions?: unknown }
    if (!Array.isArray(parsed.questions)) return undefined
    const questions: AskUserQuestionItem[] = []
    for (const raw of parsed.questions) {
      if (
        raw !== null &&
        typeof raw === 'object' &&
        typeof (raw as Record<string, unknown>).question === 'string' &&
        typeof (raw as Record<string, unknown>).header === 'string' &&
        Array.isArray((raw as Record<string, unknown>).options)
      ) {
        const rawOptions = (raw as Record<string, unknown>).options as unknown[]
        const options: AskUserQuestionOption[] = rawOptions
          .filter(
            (o): o is Record<string, unknown> =>
              o !== null &&
              typeof o === 'object' &&
              typeof (o as Record<string, unknown>).label === 'string'
          )
          .map((o) => ({
            label: o.label as string,
            description: typeof o.description === 'string' ? o.description : '',
          }))
        if (options.length >= 2) {
          questions.push({
            question: (raw as Record<string, unknown>).question as string,
            header: (raw as Record<string, unknown>).header as string,
            options,
            multiSelect: (raw as Record<string, unknown>).multiSelect === true,
          })
        }
      }
    }
    return questions.length > 0 ? { questions } : undefined
  } catch {
    return undefined
  }
}

/**
 * `AskUserQuestionOutput` şeması (aynı `sdk-tools.d.ts`, ✓ DOĞRULANDI): `{ questions, answers:
 * {[soru_metni]: seçilen_label}, response?, annotations? }`. [T] TAHMİN (bkz. yukarı) —
 * `canUseTool`'un `updatedInput`'unun tam olarak bu şekli beklediği gerçek bir SDK oturumuyla
 * doğrulanmadı (kota harcamadan yalnızca tip tanımından çıkarıldı).
 */
export function buildAskUserQuestionAnswer(
  questions: AskUserQuestionItem[],
  selections: Record<number, string>
): Record<string, unknown> {
  const answers: Record<string, string> = {}
  questions.forEach((q, i) => {
    const label = selections[i]
    if (label !== undefined) answers[q.question] = label
  })
  return {
    questions: questions.map((q) => ({
      question: q.question,
      header: q.header,
      options: q.options,
      multiSelect: q.multiSelect,
    })),
    answers,
  }
}

export interface UseChatSessionOptions {
  fetchImpl?: typeof fetch
  writeFetchImpl?: typeof fetch
  /** Varsayılan `true`. `false` iken (K6 — build-time `MC_CHAT_ENABLED=0`) hiçbir ilk yükleme
   *  isteği ATILMAZ — sekme zaten render edilmiyor (`App.tsx`), ama React Hooks kuralları
   *  gereği bu hook yine de çağrılmak zorunda; bu bayrak o durumda gereksiz ağ isteğini önler. */
  enabled?: boolean
}

export interface UseChatSessionResult {
  /** Yalnızca `kind: 'text' | 'error'` — `tool`/`permission_request`/`question` geçmiş
   *  kayıtları `request_id`/`tool_use_id` taşımadığı için (round A `history-log.ts`) burada
   *  yeniden eyleme dökülemez, bilinen bir sınırlama olarak dışarıda bırakılır (bkz. notlar). */
  messages: ChatLogEntry[]
  toolRows: ToolRow[]
  pendingPermissions: PendingPermission[]
  resolvedPermissions: ResolvedPermission[]
  status: ChatStatus | null
  lastError: ChatErrorEvent | null
  hasMore: boolean
  historyError: boolean
  warningDismissed: boolean
  dismissWarning: () => void
  sendMessage: (text: string) => Promise<void>
  interrupt: () => Promise<void>
  respondAllow: (requestId: string, updatedInput?: Record<string, unknown>) => Promise<void>
  respondDeny: (requestId: string, message?: string) => Promise<void>
  respondToQuestion: (
    requestId: string,
    questions: AskUserQuestionItem[],
    selections: Record<number, string>
  ) => Promise<void>
  restart: () => Promise<void>
  loadOlder: () => Promise<void>
  handlers: {
    onChatSync: () => void
    onChatMessage: (payload: ChatMessageEvent) => void
    onChatUserEcho: (payload: ChatUserEchoEvent) => void
    onChatToolEvent: (payload: ChatToolEvent) => void
    onChatPermissionRequest: (payload: ChatPermissionRequestEvent) => void
    onChatPermissionResolved: (payload: ChatPermissionResolvedEvent) => void
    onChatStatus: (payload: ChatStatus) => void
    onChatError: (payload: ChatErrorEvent) => void
  }
}

/**
 * Sohbet ekranının veri katmanı (sözleşme §2.2). Tek `EventSource`'a (K5) bağlanmaz — App.tsx
 * `handlers`'ı tek paylaşılan `useEventStream()` çağrısına geçirir. SSE eksikliği: `chat_tool`/
 * `chat_permission_*`/`chat_status`/`chat_error` yükleri `chat_seq` TAŞIMIYOR (yalnızca
 * `chat_message`/`chat_user_echo` taşıyor, round A kodu bu turda okunarak doğrulandı) — bu
 * yüzden boşluk tespiti (§5 D7) yalnızca bu iki kanal için uygulanır; diğerleri doğrudan
 * uygulanır (ephemeral durum güncellemeleri, sıra kaybı ürün açısından kritik değil).
 */
export function useChatSession(options: UseChatSessionOptions = {}): UseChatSessionResult {
  const fetchImpl = options.fetchImpl ?? fetch
  const writeFetchImpl = options.writeFetchImpl ?? writeFetch
  const enabled = options.enabled ?? true

  const [entriesMap, setEntriesMap] = useState<Map<string, ChatLogEntry>>(new Map())
  const [hasMore, setHasMore] = useState(false)
  const [oldestLoadedSeq, setOldestLoadedSeq] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [lastError, setLastError] = useState<ChatErrorEvent | null>(null)
  const [toolRows, setToolRows] = useState<ToolRow[]>([])
  const [pendingPermissions, setPendingPermissions] = useState<PendingPermission[]>([])
  const [resolvedPermissions, setResolvedPermissions] = useState<ResolvedPermission[]>([])
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const streamingBufferRef = useRef<Map<string, string>>(new Map())

  const loadHistory = useCallback(
    async (beforeSeq?: number) => {
      try {
        const url =
          beforeSeq === undefined
            ? `${HISTORY_URL}?limit=50`
            : `${HISTORY_URL}?limit=50&before_seq=${beforeSeq}`
        const res = await fetchImpl(url)
        if (!res.ok) throw new Error(`http_${res.status}`)
        const body = (await res.json()) as {
          data?: { entries?: unknown; has_more?: unknown }
        }
        // Savunmacı doğrulama — `setState` güncelleyicisi içine ASLA fırlayabilecek kod
        // konmaz: React bu callback'i senkron `try` bloğunun dışında (ertelenmiş bir
        // render'da) çalıştırabilir, bu durumda hata burada YAKALANMAZ (jsdom'da gözlemlendi,
        // `App.interaction.test.tsx` "Sohbet" testleri — sahte `fetch` `{success:true,
        // data:[]}` döndüğünde `body.data.entries` `undefined` oluyordu).
        if (!Array.isArray(body.data?.entries) || typeof body.data?.has_more !== 'boolean') {
          throw new Error('invalid_history_response')
        }
        const entries = body.data.entries as ChatLogEntry[]
        const hasMoreValue = body.data.has_more
        setEntriesMap((prev) => {
          let next = beforeSeq === undefined ? new Map<string, ChatLogEntry>() : new Map(prev)
          for (const entry of entries) next = upsertEntry(next, entry)
          return next
        })
        setHasMore(hasMoreValue)
        if (entries.length > 0) {
          setOldestLoadedSeq(entries[0]!.seq)
        }
        setHistoryError(false)
      } catch {
        setHistoryError(true)
      }
    },
    [fetchImpl]
  )

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchImpl(STATUS_URL)
      if (!res.ok) return
      const body = (await res.json()) as { data: ChatStatus }
      setStatus(body.data)
    } catch {
      // sessizce yok say — `chat_status` SSE olayı zaten canlı günceller.
    }
  }, [fetchImpl])

  useEffect(() => {
    if (!enabled) return
    void loadHistory()
    void loadStatus()
  }, [enabled, loadHistory, loadStatus])

  const onChatSync = useCallback(() => {
    if (!enabled) return
    void loadHistory()
    void loadStatus()
  }, [enabled, loadHistory, loadStatus])

  const onChatMessage = useCallback((payload: ChatMessageEvent) => {
    const buf = streamingBufferRef.current
    const prevText = buf.get(payload.turn_id) ?? ''
    const text = payload.done ? prevText : prevText + payload.delta
    if (payload.done) buf.delete(payload.turn_id)
    else buf.set(payload.turn_id, text)
    setEntriesMap((prev) =>
      upsertEntry(prev, {
        seq: payload.chat_seq,
        turn_id: payload.turn_id,
        role: 'assistant',
        kind: 'text',
        text,
        status: payload.done ? 'done' : 'streaming',
        ts: new Date().toISOString(),
      })
    )
  }, [])

  const onChatUserEcho = useCallback((payload: ChatUserEchoEvent) => {
    setEntriesMap((prev) =>
      upsertEntry(prev, {
        seq: payload.chat_seq,
        turn_id: payload.turn_id,
        role: 'user',
        kind: 'text',
        text: payload.text,
        status: 'done',
        ts: payload.ts,
      })
    )
  }, [])

  const onChatToolEvent = useCallback((payload: ChatToolEvent) => {
    setToolRows((prev) => {
      const idx = prev.findIndex((row) => row.tool_use_id === payload.tool_use_id)
      const startedAt = idx >= 0 ? prev[idx]!.started_at_ms : Date.now()
      const nextRow: ToolRow = {
        tool_use_id: payload.tool_use_id,
        tool_name: payload.tool_name,
        description: payload.description ?? (idx >= 0 ? prev[idx]!.description : undefined),
        status: payload.status,
        elapsed_ms: payload.elapsed_ms,
        parent_tool_use_id: payload.parent_tool_use_id,
        started_at_ms: startedAt,
      }
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = nextRow
        return next
      }
      return [...prev, nextRow]
    })
  }, [])

  // QA F-012 Ö8 düzeltmesi — `onChatPermissionResolved` yalnızca `payload.outcome`'u taşır,
  // hangi araç/komut olduğunu DEĞİL. Kart silinmeden önceki `tool_name`/`input_preview`'ı burada
  // saklarız ki kolabe satırı (`Onaylandı — <komut> çalıştı`) doğru metni gösterebilsin.
  const permissionDataRef = useRef<Map<string, { input_preview: string }>>(new Map())

  const onChatPermissionRequest = useCallback((payload: ChatPermissionRequestEvent) => {
    const question = parseAskUserQuestion(payload.tool_name, payload.input_preview)
    permissionDataRef.current.set(payload.request_id, { input_preview: payload.input_preview })
    setPendingPermissions((prev) => {
      if (prev.some((p) => p.request_id === payload.request_id)) return prev
      return [...prev, { ...payload, question }]
    })
  }, [])

  const onChatPermissionResolved = useCallback((payload: ChatPermissionResolvedEvent) => {
    setPendingPermissions((prev) => prev.filter((p) => p.request_id !== payload.request_id))
    const data = permissionDataRef.current.get(payload.request_id)
    if (data) {
      setResolvedPermissions((prev) =>
        prev.some((r) => r.request_id === payload.request_id)
          ? prev
          : [
              ...prev,
              {
                request_id: payload.request_id,
                outcome: payload.outcome,
                input_preview: data.input_preview,
              },
            ]
      )
    }
  }, [])

  const onChatStatus = useCallback((payload: ChatStatus) => {
    setStatus(payload)
  }, [])

  const onChatError = useCallback((payload: ChatErrorEvent) => {
    setLastError(payload)
    // QA F-012 Ö4 düzeltmesi — `turn_id`/`chat_seq` doluysa (tur-içi hata, oturum ÇÖKMEDİ) bunu
    // `onChatUserEcho` ile AYNI desende transkribe kalıcı bir girdi olarak ekle; sayfa
    // yenilenmeden de görünür, `history-log.ts`'in `foldByTurn`'üyle aynı (turn_id, kind, role)
    // anahtarını kullandığı için reload sonrası gelen gerçek girdiyle çakışmaz (aynı seq).
    if (payload.turn_id !== undefined && payload.chat_seq !== undefined) {
      setEntriesMap((prev) =>
        upsertEntry(prev, {
          seq: payload.chat_seq!,
          turn_id: payload.turn_id!,
          role: 'system',
          kind: 'error',
          text: payload.message,
          status: 'done',
          ts: new Date().toISOString(),
        })
      )
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      await writeFetchImpl(MESSAGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    },
    [writeFetchImpl]
  )

  const interrupt = useCallback(async () => {
    await writeFetchImpl(INTERRUPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  }, [writeFetchImpl])

  const respond = useCallback(
    async (requestId: string, result: unknown) => {
      // İyimser: kart hemen kapanır — K3 için ÖNEMLİ olan bunun yalnızca KULLANICI eylemiyle
      // (bu fonksiyonun çağrılmasıyla) tetiklenmesidir, otomatik çağrılan bir yol YOKTUR.
      setPendingPermissions((prev) => prev.filter((p) => p.request_id !== requestId))
      await writeFetchImpl(PERMISSION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, result }),
      })
    },
    [writeFetchImpl]
  )

  const respondAllow = useCallback(
    (requestId: string, updatedInput?: Record<string, unknown>) =>
      respond(
        requestId,
        updatedInput ? { behavior: 'allow', updatedInput } : { behavior: 'allow' }
      ),
    [respond]
  )

  const respondDeny = useCallback(
    (requestId: string, message = 'Kullanıcı reddetti.') =>
      respond(requestId, { behavior: 'deny', message }),
    [respond]
  )

  const respondToQuestion = useCallback(
    (requestId: string, questions: AskUserQuestionItem[], selections: Record<number, string>) =>
      respondAllow(requestId, buildAskUserQuestionAnswer(questions, selections)),
    [respondAllow]
  )

  const restart = useCallback(async () => {
    await writeFetchImpl(RESTART_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  }, [writeFetchImpl])

  const loadOlder = useCallback(async () => {
    if (oldestLoadedSeq === undefined) return
    await loadHistory(oldestLoadedSeq)
  }, [loadHistory, oldestLoadedSeq])

  const messages = sortEntries(entriesMap).filter((e) => e.kind === 'text' || e.kind === 'error')

  return {
    messages,
    toolRows,
    pendingPermissions,
    resolvedPermissions,
    status,
    lastError,
    hasMore,
    historyError,
    warningDismissed,
    dismissWarning: () => setWarningDismissed(true),
    sendMessage,
    interrupt,
    respondAllow,
    respondDeny,
    respondToQuestion,
    restart,
    loadOlder,
    handlers: {
      onChatSync,
      onChatMessage,
      onChatUserEcho,
      onChatToolEvent,
      onChatPermissionRequest,
      onChatPermissionResolved,
      onChatStatus,
      onChatError,
    },
  }
}
