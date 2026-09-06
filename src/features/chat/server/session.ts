import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type {
  CanUseTool,
  Options,
  PermissionResult,
  Query,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { stripApiKey, hasApiKeyHelperConfigured } from './env-barrier'
import { createHistoryLog, type HistoryLog } from './history-log'
import { readSessionId, writeSessionId } from './session-store'
import type { SseHub } from '../../../server/sse/hub'
import type { ChatLogEntry } from '../../../shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** `src/features/chat/server` -> repo kökü (4 seviye yukarı). `process.cwd()` KULLANILMAZ
 *  (sözleşme §3) — hook'ların göreli yolları (`.claude/settings.json`'daki `node .claude/
 *  hooks/X.cjs`) her zaman bu kökten çözülmelidir. */
export const CHAT_SESSION_CWD = path.resolve(__dirname, '..', '..', '..', '..')

/** D11 — sabit gömülü değil, `MC_CHAT_MAX_BUDGET_USD`'den okunur. `isChatEnabled`'ın aynı
 *  savunmacı deseni: tanımsız/sayı-değil/`<= 0` ise güvenli varsayılana düşülür ve stderr'e
 *  bir uyarı yazılır. */
const DEFAULT_MAX_BUDGET_USD = 20

export function resolveChatBudget(env: NodeJS.ProcessEnv): number {
  const raw = env.MC_CHAT_MAX_BUDGET_USD
  if (raw === undefined) return DEFAULT_MAX_BUDGET_USD
  const parsed = Number(raw.trim())
  if (raw.trim() === '' || Number.isNaN(parsed) || parsed <= 0) {
    process.stderr.write(
      `Uyarı: MC_CHAT_MAX_BUDGET_USD değeri ("${raw}") geçersiz, varsayılan $${DEFAULT_MAX_BUDGET_USD} kullanılıyor.\n`
    )
    return DEFAULT_MAX_BUDGET_USD
  }
  return parsed
}

/**
 * Ö12 — `resolveEnvInt`'i (`src/server/index.ts`) import ETMEK döngüsel bağımlılık kurar ve onun
 * "geçersiz değer sessizce varsayılana düşer" semantiği bir kill-switch için güvensizdir
 * (typolu `MC_CHAT_ENABLED=false` sohbeti AÇIK bırakırdı). Bu yüzden `session.ts` kendi 3
 * satırlık çözücüsünü taşır — `index.ts`'ten hiçbir şey import ETMEZ.
 */
export function isChatEnabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env.MC_CHAT_ENABLED
  if (raw === undefined) return true
  if (raw === '1') return true
  if (raw !== '0') {
    process.stderr.write(
      `Uyarı: MC_CHAT_ENABLED değeri ("${raw}") tanınmıyor, kapalı varsayılıyor.\n`
    )
  }
  return false
}

export type ChatSessionState = 'idle' | 'busy' | 'crashed' | 'disabled'

export interface ChatStatusPayload {
  session_active: boolean
  session_id: string | undefined
  busy: boolean
  api_key_barrier_tripped: boolean
  stripped_env_vars: string[]
  chat_enabled: boolean
  last_error?: string
  api_key_helper_configured: boolean
  /** QA F-012 Ö2/E6 — bütçe mesajının `(${budget} USD)` kısmını doldurmak için istemciye
   *  taşınır (sözleşme §10). `resolveChatBudget(deps.env)`'in aynı değeri, sabit gömülü değil. */
  max_budget_usd: number
}

export type ChatQueryFn = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  options: Options
}) => Query

/** Ö7 — `deps`'in alan kümesi KAPALI: yalnızca bu beşi. `store`/`projectsService` asla geçirilmez
 *  (K4, olay akışı CEO bağlamına beslenmez). */
export interface ChatSessionDeps {
  query: ChatQueryFn
  dataDir: string
  hub: SseHub
  now: () => Date
  env: NodeJS.ProcessEnv
}

export interface ChatSession {
  bootstrap(): Promise<void>
  getStatus(): ChatStatusPayload
  getHistoryPage(opts?: { limit?: number; beforeSeq?: number }): {
    entries: ChatLogEntry[]
    has_more: boolean
  }
  sendMessage(
    text: string
  ): { turn_id: string } | { errorCode: 'chat_disabled' | 'session_not_ready' }
  interrupt(): Promise<{ interrupted: true } | { errorCode: 'chat_disabled' | 'no_active_turn' }>
  resolvePermission(
    requestId: string,
    result: unknown
  ): { resolved: true } | { errorCode: 'chat_disabled' | 'request_not_found' }
  restart(): Promise<
    { session_id: string | undefined } | { errorCode: 'chat_disabled' | 'internal_error' }
  >
  stopAll(): void
}

function buildInputPreview(input: Record<string, unknown>): string {
  const command = typeof input.command === 'string' ? input.command : undefined
  const raw = command ?? JSON.stringify(input)
  const singleLine = raw.replace(/\s+/g, ' ').trim()
  return singleLine.length > 500 ? `${singleLine.slice(0, 500)}…` : singleLine
}

function derivePermissionOutcome(result: unknown): 'allow' | 'deny' | 'unknown' {
  if (result && typeof result === 'object' && 'behavior' in result) {
    const behavior = (result as { behavior?: unknown }).behavior
    if (behavior === 'allow' || behavior === 'deny') return behavior
  }
  return 'unknown'
}

type SdkContentBlock = {
  type: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  text?: string
}

/** Barındırılan CEO oturumunun tek sahibi (sözleşme §2.1). Enjekte edilebilir `deps` sayesinde
 *  gerçek SDK'ya dokunmadan birim testlenebilir (`session.test.ts`). */
export function createChatSession(deps: ChatSessionDeps): ChatSession {
  const chatEnabled = isChatEnabled(deps.env)
  const historyLog: HistoryLog = createHistoryLog(deps.dataDir)
  const settingsJsonPath = path.join(CHAT_SESSION_CWD, '.claude', 'settings.json')

  let state: ChatSessionState = chatEnabled ? 'idle' : 'disabled'
  let sessionId: string | undefined
  let lastError: string | undefined
  let strippedVars: string[] = []
  // QA F-012 B3 düzeltmesi — FIFO tur kuyruğu. Eskiden `currentTurnId` her `sendMessage`
  // çağrısında KOŞULSUZ üzerine yazılıyordu: alt agent çalışırken (turn A hâlâ akarken) ikinci
  // bir mesaj gönderilince `currentTurnId` turn B'ye atlıyor, turn A'nın devam eden
  // `stream_event` delta'ları yanlışlıkla turn B'ye yazılıyordu (ilk cevap yarıda kesiliyor,
  // devamı ikinci balona yapışıyordu). Artık `currentTurnId` her zaman kuyruğun BAŞI — SDK'nın
  // tek `for await` döngüsü turları sırayla işlediği için (bir `result` gelmeden bir sonraki
  // kullanıcı mesajı işlenmeye başlamaz) bu, akan cevabın her zaman doğru turn'e yazılmasını
  // garanti eder. Yeni bir mesaj yalnızca kuyruk BOŞSA hemen aktif olur; doluysa kuyruğa eklenir
  // ve `finalizeTurn` öndeki turu bitirince bir sonrakine geçilir.
  const turnQueue: string[] = []
  let currentTurnId: string | undefined
  let queryHandle: Query | undefined
  let inputPush: ((msg: SDKUserMessage) => void) | undefined
  let inputStop: (() => void) | undefined
  const pendingPermissions = new Map<string, (result: PermissionResult) => void>()
  const toolStartedAt = new Map<string, number>()
  const toolNameByUseId = new Map<string, string>()
  const accumulatedTextByTurn = new Map<string, string>()

  function createInputStream(): {
    iterator: AsyncIterable<SDKUserMessage>
    push: (m: SDKUserMessage) => void
    stop: () => void
  } {
    const queue: SDKUserMessage[] = []
    let notify: (() => void) | null = null
    let stopped = false
    function push(msg: SDKUserMessage): void {
      queue.push(msg)
      if (notify) {
        const n = notify
        notify = null
        n()
      }
    }
    function stop(): void {
      stopped = true
      if (notify) {
        const n = notify
        notify = null
        n()
      }
    }
    const iterator = (async function* (): AsyncGenerator<SDKUserMessage, void> {
      while (!stopped) {
        if (queue.length > 0) {
          yield queue.shift()!
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve
          })
        }
      }
    })()
    return { iterator, push, stop }
  }

  const canUseTool: CanUseTool = (toolName, input, opts) => {
    const requestId = opts.requestId
    const turnId = currentTurnId ?? 'unknown'
    const inputPreview = buildInputPreview(input)
    const ts = deps.now().toISOString()
    historyLog.append({
      turn_id: turnId,
      role: 'system',
      kind: 'permission_request',
      status: 'done',
      text: inputPreview,
      ts,
    })
    deps.hub.broadcast('chat_permission_request', {
      request_id: requestId,
      turn_id: turnId,
      tool_name: toolName,
      input_preview: inputPreview,
      ts,
    })
    return new Promise<PermissionResult>((resolve) => {
      pendingPermissions.set(requestId, resolve)
    })
  }

  function handleContentBlock(block: SdkContentBlock, parentToolUseId: string | null): void {
    if (block.type === 'tool_use' && block.id && block.name) {
      toolStartedAt.set(block.id, Date.now())
      toolNameByUseId.set(block.id, block.name)
      const description =
        typeof block.input?.description === 'string' ? block.input.description : undefined
      const entry = historyLog.append({
        turn_id: currentTurnId ?? 'unknown',
        role: 'assistant',
        kind: 'tool',
        status: 'done',
        text: description,
        ts: deps.now().toISOString(),
      })
      deps.hub.broadcast(
        'chat_tool',
        {
          tool_use_id: block.id,
          tool_name: block.name,
          description,
          status: 'started',
          parent_tool_use_id: parentToolUseId,
        },
        entry.seq
      )
      return
    }
    if (block.type === 'tool_result' && block.tool_use_id) {
      const startedAt = toolStartedAt.get(block.tool_use_id)
      const elapsed_ms = startedAt !== undefined ? Date.now() - startedAt : undefined
      deps.hub.broadcast('chat_tool', {
        tool_use_id: block.tool_use_id,
        tool_name: toolNameByUseId.get(block.tool_use_id) ?? 'unknown',
        status: block.is_error ? 'error' : 'finished',
        elapsed_ms,
        parent_tool_use_id: parentToolUseId,
      })
    }
  }

  function finalizeTurn(status: 'done' | 'interrupted', text?: string): void {
    const turnId = currentTurnId
    if (turnId === undefined) return
    const finalText = text ?? accumulatedTextByTurn.get(turnId)
    const entry = historyLog.append({
      turn_id: turnId,
      role: 'assistant',
      kind: 'text',
      status,
      text: finalText,
      ts: deps.now().toISOString(),
    })
    deps.hub.broadcast('chat_message', {
      turn_id: turnId,
      chat_seq: entry.seq,
      delta: '',
      done: true,
    })
    accumulatedTextByTurn.delete(turnId)
    // B3 — biten turu kuyruktan çıkar, bir sonraki (varsa) kuyruğun başı olur.
    const idx = turnQueue.indexOf(turnId)
    if (idx !== -1) turnQueue.splice(idx, 1)
    currentTurnId = turnQueue[0]
    if (state !== 'crashed') state = currentTurnId !== undefined ? 'busy' : 'idle'
    deps.hub.broadcast('chat_status', getStatus())
  }

  function handleSdkMessage(message: Record<string, unknown>): void {
    const type = message.type
    if (type === 'system' && message.subtype === 'init') {
      sessionId = message.session_id as string
      writeSessionId(deps.dataDir, sessionId)
      return
    }
    if (type === 'stream_event') {
      const event = message.event as
        { type?: string; delta?: { type?: string; text?: string } } | undefined
      if (
        event?.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta' &&
        currentTurnId
      ) {
        const turnId = currentTurnId
        const deltaText = event.delta.text ?? ''
        const accumulated = (accumulatedTextByTurn.get(turnId) ?? '') + deltaText
        accumulatedTextByTurn.set(turnId, accumulated)
        const entry = historyLog.append({
          turn_id: turnId,
          role: 'assistant',
          kind: 'text',
          status: 'streaming',
          text: accumulated,
          ts: deps.now().toISOString(),
        })
        deps.hub.broadcast('chat_message', {
          turn_id: turnId,
          chat_seq: entry.seq,
          delta: deltaText,
          done: false,
        })
      }
      return
    }
    if (type === 'assistant' || type === 'user') {
      const parentToolUseId = (message.parent_tool_use_id as string | null | undefined) ?? null
      const content =
        (message.message as { content?: SdkContentBlock[] } | undefined)?.content ?? []
      for (const block of content) {
        handleContentBlock(block, parentToolUseId)
      }
      return
    }
    if (type === 'result') {
      const subtype = message.subtype as string
      if (subtype === 'error_max_budget_usd') {
        state = 'crashed'
        lastError = 'budget_exceeded'
        const turnId = currentTurnId
        if (turnId !== undefined) {
          historyLog.append({
            turn_id: turnId,
            role: 'system',
            kind: 'error',
            status: 'interrupted',
            text: 'budget_exceeded',
            ts: deps.now().toISOString(),
          })
        }
        currentTurnId = undefined
        turnQueue.length = 0
        deps.hub.broadcast('chat_status', getStatus())
        deps.hub.broadcast('chat_error', {
          code: 'budget_exceeded',
          message: 'Bütçe tavanına ulaşıldı.',
        })
        return
      }
      if (message.is_error === true) {
        // QA F-012 Ö4 düzeltmesi — eskiden yalnızca `chat_error` broadcast edilip
        // `finalizeTurn('done')` çağrılıyordu; bu durumda `session_active` `true` kalır
        // (crash yok), `ChatScreen`'in `sessionDown`/`ErrorRow` yolu tetiklenmez ve
        // `useChatSession`'ın tuttuğu `lastError` hiçbir yerde render edilmediği için
        // kullanıcı turun hatayla bittiğini FARK ETMİYORDU. Diğer `kind:'error'` girdileri
        // gibi (bkz. `MessageBubble` — zaten `entry.kind === 'error'` render ediyor, ve
        // `messages` filtresi zaten `kind === 'error'`'ı içeriyor) transkripte kalıcı bir
        // hata balonu ekleniyor; `chat_error` yayınına `turn_id`/`chat_seq` eklenerek istemci
        // sayfa yenilenmeden de aynı balonu CANLI gösterebiliyor (`onChatUserEcho` ile aynı
        // desen).
        const turnId = currentTurnId
        const errorText = 'Sohbet turu hatayla sonuçlandı.'
        let errorSeq: number | undefined
        if (turnId !== undefined) {
          const entry = historyLog.append({
            turn_id: turnId,
            role: 'system',
            kind: 'error',
            status: 'done',
            text: errorText,
            ts: deps.now().toISOString(),
          })
          errorSeq = entry.seq
        }
        deps.hub.broadcast('chat_error', {
          code: 'internal_error',
          message: errorText,
          turn_id: turnId,
          chat_seq: errorSeq,
        })
      }
      finalizeTurn('done')
      return
    }
  }

  async function consume(q: Query): Promise<void> {
    try {
      for await (const message of q) {
        handleSdkMessage(message as unknown as Record<string, unknown>)
      }
    } catch (err) {
      // §9 — SDK mesaj döngüsünün KENDİ hata sınırı; dağıtıcının senkron sınırına güvenmez.
      const messageText = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: barındırılan CEO oturumu çöktü: ${messageText}\n`)
      state = 'crashed'
      lastError = 'crashed'
      if (currentTurnId !== undefined) {
        finalizeTurn('interrupted')
      }
      // B3 — tüm `query()` oturumu öldüğü için kuyrukta bekleyen (henüz hiç işlenmemiş) turlar
      // artık asla teslim edilmeyecek; kalıntı `turnId`'ler bir sonraki bootstrap'a sızmasın.
      turnQueue.length = 0
      deps.hub.broadcast('chat_status', getStatus())
      deps.hub.broadcast('chat_error', {
        code: 'internal_error',
        message: 'Oturum beklenmeyen şekilde sonlandı.',
      })
    }
  }

  function buildOptions(resumeSessionId: string | undefined): Options {
    const { strippedVars: stripped } = stripApiKey(deps.env)
    strippedVars = stripped
    return {
      cwd: CHAT_SESSION_CWD,
      agent: 'ceo',
      settingSources: ['project'],
      permissionMode: 'default',
      includePartialMessages: true,
      maxBudgetUsd: resolveChatBudget(deps.env),
      // QA F-012 E1 düzeltmesi (KALDI kararı B5) — `allowManagedPermissionRulesOnly` TEK BAŞINA
      // yetersizdi: SDK'nın `permissionMode:'default'` dahili "salt-okunur komut" sınıflandırıcısı
      // (`git log`, `ls`, salt-okunur `grep` vb. içeren bileşik Bash komutları dahil) allow
      // listesinden/override'dan TAMAMEN BAĞIMSIZ olarak `canUseTool`'u hiç çağırmadan otomatik
      // geçiyordu — gerçek oturumda ölçüldü (`docs/qa/F-012-2026-09-06.md` §3.2/B5). Kanıt
      // (`.probe/live-test-e1.mjs` / `.probe/live-test-e1b.mjs`, bu turda çalıştırıldı, iki
      // yönlü): `permissions.ask` YOKKEN `git log --oneline -3` `canUseTool`'u hiç tetiklemedi;
      // `permissions.ask:['Bash']` VARKEN aynı komut (ve dört başka salt-okunur Bash çağrısı)
      // `canUseTool`'u her seferinde tetikledi. `managedSettings`'in kendi filtresi
      // `permissions.ask`'i restrictive-key allowlist'ine dahil ediyor (sdk.d.ts:3037-3045,
      // "Feeds the lowest-precedence policy sub-source ... permissions.deny/ask ... layer in").
      // `Bash` dışındaki araçlar bu listeye eklenmedi (Karpathy §2 — kanıtlanmamış bir sınıfa karşı
      // savunma eklenmez; `Read`/`Grep`/`Glob`/`WebSearch` zaten `.claude/settings.json`'ın kendi
      // allow listesinde CEO'nun bilinçli tercihiyle her zaman izinli, bu yüzden `ask`'a alınmadı).
      managedSettings: {
        allowManagedPermissionRulesOnly: true,
        permissions: { ask: ['Bash'] },
      },
      canUseTool,
      resume: resumeSessionId,
    }
  }

  async function bootstrap(): Promise<void> {
    if (!chatEnabled) return
    historyLog.init()
    const previousSessionId = readSessionId(deps.dataDir)
    const stream = createInputStream()
    inputPush = stream.push
    inputStop = stream.stop
    try {
      queryHandle = deps.query({
        prompt: stream.iterator,
        options: buildOptions(previousSessionId),
      })
      void consume(queryHandle)
      state = 'idle'
    } catch (err) {
      state = 'crashed'
      lastError = 'crashed'
      const messageText = err instanceof Error ? err.message : String(err)
      process.stderr.write(`Hata: sohbet oturumu başlatılamadı: ${messageText}\n`)
    }
  }

  function getStatus(): ChatStatusPayload {
    return {
      session_active: state === 'idle' || state === 'busy',
      session_id: sessionId,
      busy: state === 'busy',
      api_key_barrier_tripped: strippedVars.length > 0,
      stripped_env_vars: strippedVars,
      chat_enabled: chatEnabled,
      last_error: lastError,
      api_key_helper_configured: hasApiKeyHelperConfigured(settingsJsonPath),
      max_budget_usd: resolveChatBudget(deps.env),
    }
  }

  function getHistoryPage(opts?: { limit?: number; beforeSeq?: number }) {
    return historyLog.readPage(opts)
  }

  function sendMessage(
    text: string
  ): { turn_id: string } | { errorCode: 'chat_disabled' | 'session_not_ready' } {
    if (!chatEnabled) return { errorCode: 'chat_disabled' }
    if (state === 'crashed' || inputPush === undefined) return { errorCode: 'session_not_ready' }
    const turnId = crypto.randomUUID()
    const ts = deps.now().toISOString()
    const userEntry = historyLog.append({
      turn_id: turnId,
      role: 'user',
      kind: 'text',
      status: 'done',
      text,
      ts,
    })
    deps.hub.broadcast('chat_user_echo', { turn_id: turnId, chat_seq: userEntry.seq, text, ts })
    // B3 — kuyruk boşsa bu tur hemen aktif olur; doluysa (bir önceki tur hâlâ akıyor) yalnızca
    // kuyruğa eklenir, `currentTurnId` DEĞİŞMEZ (akan cevabın turn'ü karışmasın).
    turnQueue.push(turnId)
    if (turnQueue.length === 1) currentTurnId = turnId
    state = 'busy'
    deps.hub.broadcast('chat_status', getStatus())
    inputPush({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
    })
    return { turn_id: turnId }
  }

  async function interrupt(): Promise<
    { interrupted: true } | { errorCode: 'chat_disabled' | 'no_active_turn' }
  > {
    if (!chatEnabled) return { errorCode: 'chat_disabled' }
    if (state !== 'busy' || queryHandle === undefined) return { errorCode: 'no_active_turn' }
    await queryHandle.interrupt()
    if (currentTurnId !== undefined) finalizeTurn('interrupted')
    return { interrupted: true }
  }

  function resolvePermission(
    requestId: string,
    result: unknown
  ): { resolved: true } | { errorCode: 'chat_disabled' | 'request_not_found' } {
    if (!chatEnabled) return { errorCode: 'chat_disabled' }
    const resolver = pendingPermissions.get(requestId)
    if (!resolver) return { errorCode: 'request_not_found' }
    pendingPermissions.delete(requestId)
    const outcome = derivePermissionOutcome(result)
    deps.hub.broadcast('chat_permission_resolved', {
      request_id: requestId,
      turn_id: currentTurnId ?? 'unknown',
      outcome,
      ts: deps.now().toISOString(),
    })
    resolver(result as PermissionResult)
    return { resolved: true }
  }

  async function restart(): Promise<
    { session_id: string | undefined } | { errorCode: 'chat_disabled' | 'internal_error' }
  > {
    if (!chatEnabled) return { errorCode: 'chat_disabled' }
    try {
      queryHandle?.close()
      inputStop?.()
      lastError = undefined
      await bootstrap()
      return { session_id: sessionId }
    } catch (err) {
      state = 'crashed'
      const messageText = err instanceof Error ? err.message : String(err)
      lastError = 'crashed'
      process.stderr.write(`Hata: sohbet oturumu yeniden başlatılamadı: ${messageText}\n`)
      return { errorCode: 'internal_error' }
    }
  }

  function stopAll(): void {
    queryHandle?.close()
    inputStop?.()
  }

  return {
    bootstrap,
    getStatus,
    getHistoryPage,
    sendMessage,
    interrupt,
    resolvePermission,
    restart,
    stopAll,
  }
}
