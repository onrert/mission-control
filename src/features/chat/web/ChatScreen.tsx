import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatLogEntry } from '../../../shared/types'
import { AlertTriangle } from '../../events/web/icons'
import { Cog, HelpCircle, KeyRound, Lock, Send } from './icons'
import type {
  AskUserQuestionItem,
  PendingPermission,
  ToolRow,
  UseChatSessionResult,
} from './useChatSession'

export interface ChatScreenProps {
  chat: UseChatSessionResult
}

/** UX §7 metin sözlüğü: "{süre}" biçimi — "2 dk 14 sn" / "45 sn". */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds} sn` : `${minutes} dk ${seconds} sn`
}

function MessageBubble({ entry }: { entry: ChatLogEntry }) {
  if (entry.kind === 'error') {
    return (
      <div
        role="status"
        className="mx-auto max-w-[92%] rounded-md border-l-4 border-red-700 bg-zinc-900 px-3 py-2 text-sm text-red-300 sm:max-w-[80%]"
      >
        {entry.text ?? 'Sohbet turu hatayla sonuçlandı.'}
      </div>
    )
  }
  const isUser = entry.role === 'user'
  const streaming = entry.status === 'streaming'
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-zinc-500">
        {isUser ? 'Sen' : streaming ? 'CEO yazıyor…' : 'CEO'}
      </span>
      <div
        className={
          isUser
            ? 'max-w-[92%] whitespace-pre-wrap rounded-md bg-zinc-800 px-3 py-2 text-sm sm:max-w-[80%]'
            : 'max-w-[92%] whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm sm:max-w-[80%]'
        }
      >
        {entry.text}
        {streaming && (
          <span aria-hidden="true" className="animate-pulse font-mono">
            ▍
          </span>
        )}
        {entry.status === 'interrupted' && (
          <span className="ml-2 text-xs text-amber-500">— Yarıda kesildi</span>
        )}
      </div>
    </div>
  )
}

function toolStatusText(row: ToolRow, elapsedMs: number): string {
  const duration = formatDuration(elapsedMs)
  // UX metin sözlüğü (docs/03-ux.md) — tamamlandı/hata şablonu ÇALIŞIYOR şablonundan FARKLI
  // sırada: süre parantezi fiilden hemen sonra, özet EN SONDA ("{agent} tamamlandı ({süre}) —
  // {özet}"). Sırayı ÇALIŞIYOR şablonuyla (özet önce) karıştırma — literal sözlük metni budur.
  const withSummary = (verb: string) =>
    row.description
      ? `${row.tool_name} ${verb} (${duration}) — ${row.description}`
      : `${row.tool_name} ${verb} (${duration})`
  if (row.status === 'started') {
    return row.description
      ? `${row.tool_name} çalışıyor — ${row.description} (${duration})`
      : `${row.tool_name} çalışıyor (${duration})`
  }
  if (row.status === 'finished') return withSummary('tamamlandı')
  return withSummary('hata verdi')
}

function ToolStatusRow({ row, now }: { row: ToolRow; now: number }) {
  const elapsedMs =
    row.status === 'started' ? now - row.started_at_ms : (row.elapsed_ms ?? now - row.started_at_ms)
  const color =
    row.status === 'started'
      ? 'text-amber-400'
      : row.status === 'finished'
        ? 'text-emerald-400'
        : 'text-red-400'
  const icon =
    row.status === 'started' ? (
      <Cog className={`h-3.5 w-3.5 animate-spin ${color}`} />
    ) : (
      <span className={color} aria-hidden="true">
        {row.status === 'finished' ? '✓' : '✘'}
      </span>
    )
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      {icon}
      <span>{toolStatusText(row, elapsedMs)}</span>
    </div>
  )
}

function buildInputPreviewLabel(perm: PendingPermission): string {
  return perm.input_preview
}

function PermissionCard({
  perm,
  onAllow,
  onDeny,
}: {
  perm: PendingPermission
  onAllow: () => void
  onDeny: () => void
}) {
  return (
    <div
      role="group"
      aria-label="İzin isteği"
      className="rounded-md border border-amber-700 bg-zinc-900 p-3 text-sm"
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-400">
        <Lock className="h-4 w-4" />
        İzin isteği
      </div>
      <p className="mb-1 text-zinc-200">CEO şu aracı çalıştırmak istiyor: {perm.tool_name}</p>
      <p
        className="mb-3 truncate font-mono text-xs text-zinc-400"
        title={buildInputPreviewLabel(perm)}
      >
        Komut: {buildInputPreviewLabel(perm)}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDeny}
          className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300"
        >
          Reddet
        </button>
        <button
          type="button"
          onClick={onAllow}
          className="min-h-8 rounded-md bg-amber-700 px-3 py-1.5 font-medium text-zinc-950"
        >
          Onayla
        </button>
      </div>
    </div>
  )
}

function QuestionBlock({
  item,
  selected,
  onSelect,
}: {
  item: AskUserQuestionItem
  selected: string | undefined
  onSelect: (label: string) => void
}) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setFocusedIndex((i) => (i + delta + item.options.length) % item.options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onSelect(item.options[focusedIndex]!.label)
    }
  }

  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-zinc-200">{item.question}</p>
      <div
        role="radiogroup"
        aria-label={item.question}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1"
      >
        {item.options.map((option, index) => {
          const isSelected = selected === option.label
          return (
            <div
              key={option.label}
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusedIndex ? 0 : -1}
              onClick={() => onSelect(option.label)}
              onFocus={() => setFocusedIndex(index)}
              className={
                isSelected
                  ? 'cursor-pointer rounded-md border border-amber-700 bg-zinc-800 px-3 py-2 opacity-100'
                  : 'cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 opacity-100 hover:border-zinc-700'
              }
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="ml-2 text-xs text-zinc-400">{option.description}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuestionCard({
  perm,
  questions,
  onAnswer,
}: {
  perm: PendingPermission
  questions: AskUserQuestionItem[]
  onAnswer: (selections: Record<number, string>) => void
}) {
  const [selections, setSelections] = useState<Record<number, string>>({})

  function handleSelect(index: number, label: string): void {
    const next = { ...selections, [index]: label }
    setSelections(next)
    if (Object.keys(next).length === questions.length) {
      onAnswer(next)
    }
  }

  return (
    <div
      role="group"
      aria-label="CEO bir soru soruyor"
      className="rounded-md border border-amber-700 bg-zinc-900 p-3 text-sm"
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-400">
        <HelpCircle className="h-4 w-4" />
        CEO bir soru soruyor:
      </div>
      {questions.map((item, index) => (
        <QuestionBlock
          key={item.question}
          item={item}
          selected={selections[index]}
          onSelect={(label) => handleSelect(index, label)}
        />
      ))}
      <p className="sr-only" data-testid="chat-question-request-id">
        {perm.request_id}
      </p>
    </div>
  )
}

function WarningBanner({
  strippedVars,
  onDismiss,
}: {
  strippedVars: string[]
  onDismiss: () => void
}) {
  // QA F-012 düzeltmesi (Ö1) — şerit artık sabit "ANTHROPIC_API_KEY bulundu" metni DEĞİL,
  // gerçekten temizlenen değişkenlerin adını gösterir (docs/03-ux.md §7 madde 6).
  const list = strippedVars.join(', ')
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-amber-800 bg-amber-950 px-3 py-2 text-sm text-amber-200">
      <span className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 shrink-0" />
        Ortamda şu ortam değişkenleri bulundu ve bu oturum için temizlendi: {list}. Abonelik
        üzerinden çalışılıyor.
      </span>
      <button
        type="button"
        aria-label="Uyarıyı kapat"
        onClick={onDismiss}
        className="shrink-0 px-1"
      >
        ✕
      </button>
    </div>
  )
}

function ErrorRow({
  lastErrorCode,
  maxBudgetUsd,
  onReconnect,
}: {
  lastErrorCode: string | undefined
  maxBudgetUsd: number | undefined
  onReconnect: () => void
}) {
  const budgetExceeded = lastErrorCode === 'budget_exceeded'
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-[92%] flex-col gap-2 rounded-md border-l-4 border-red-700 bg-zinc-900 p-3 text-sm sm:max-w-[80%]"
    >
      <div className="flex items-center gap-2 text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {budgetExceeded
          ? // QA F-012 düzeltmesi (Ö2, sözleşme §10 birebir): tutar artık metne dahil —
            // `ChatStatusPayload.max_budget_usd` sabit gömülü değil, `MC_CHAT_MAX_BUDGET_USD`den.
            `Oturum bu oturum için ayrılan bütçe tavanına (${maxBudgetUsd} USD) ulaştı.`
          : 'Oturum bağlantısı koptu. Geçmiş mesajlarınız kayıtlı, yeni mesaj gönderilemiyor.'}
      </div>
      <div>
        <button
          type="button"
          onClick={onReconnect}
          className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200"
        >
          Yeniden bağlan
        </button>
      </div>
    </div>
  )
}

/**
 * Sohbet ekranının kökü (sözleşme §2.2, `docs/03-ux.md §7`). `chat` tek paylaşılan
 * `useEventStream()`'in `handlers`'ını App.tsx üzerinden almış, o hook'un ürettiği state'i
 * burada render eder — bu bileşen kendi ağ bağlantısını AÇMAZ.
 */
export function ChatScreen({ chat }: ChatScreenProps) {
  const [text, setText] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [justReconnected, setJustReconnected] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const wasAtBottomRef = useRef(true)
  const prevSessionActiveRef = useRef<boolean | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasRunningTool = chat.toolRows.some((r) => r.status === 'started')
  useEffect(() => {
    if (!hasRunningTool) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasRunningTool])

  useEffect(() => {
    const container = listRef.current
    if (container) {
      wasAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < 48
    }
  })

  useEffect(() => {
    const container = listRef.current
    if (container && wasAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [chat.messages, chat.toolRows])

  useEffect(() => {
    const active = chat.status?.session_active
    if (prevSessionActiveRef.current === false && active === true) {
      setJustReconnected(true)
      const id = setTimeout(() => setJustReconnected(false), 3000)
      return () => clearTimeout(id)
    }
    prevSessionActiveRef.current = active
    return undefined
  }, [chat.status?.session_active])

  const transcript = useMemo(() => {
    type Item =
      | { type: 'message'; key: string; sortKey: number; entry: ChatLogEntry }
      | { type: 'tool'; key: string; sortKey: number; row: ToolRow }
    const items: Item[] = [
      ...chat.messages.map((entry) => ({
        type: 'message' as const,
        key: `m:${entry.turn_id}:${entry.kind}`,
        sortKey: Date.parse(entry.ts) || entry.seq,
        entry,
      })),
      ...chat.toolRows.map((row) => ({
        type: 'tool' as const,
        key: `t:${row.tool_use_id}`,
        sortKey: row.started_at_ms,
        row,
      })),
    ]
    return items.sort((a, b) => a.sortKey - b.sortKey)
  }, [chat.messages, chat.toolRows])

  const isEmpty = transcript.length === 0
  const sessionDown = chat.status?.session_active === false
  const composerDisabled = sessionDown

  function submit(): void {
    const trimmed = text.trim()
    if (trimmed === '' || composerDisabled) return
    void chat.sendMessage(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  function onComposerChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setText(event.target.value)
    const el = event.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  return (
    <div data-testid="chat-screen" className="flex h-full flex-col">
      {chat.status?.api_key_barrier_tripped && !chat.warningDismissed && (
        <WarningBanner
          strippedVars={chat.status.stripped_env_vars}
          onDismiss={chat.dismissWarning}
        />
      )}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3">
        {chat.hasMore && (
          <div className="mb-3 text-center">
            <button
              type="button"
              onClick={() => void chat.loadOlder()}
              className="text-sm text-zinc-400 underline"
            >
              ▲ Daha eski mesajları yükle
            </button>
          </div>
        )}
        {isEmpty ? (
          <p className="text-center text-sm text-zinc-500">
            Henüz konuşma yok. CEO&apos;ya ilk mesajını yaz — yeni bir özellik iste, soru sor ya da
            bir kapı kararını burada tartış.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {transcript.map((item) =>
              item.type === 'message' ? (
                <MessageBubble key={item.key} entry={item.entry} />
              ) : (
                <ToolStatusRow key={item.key} row={item.row} now={now} />
              )
            )}
          </div>
        )}
        {chat.historyError && (
          <p role="alert" className="mt-2 text-center text-xs text-red-400">
            Geçmiş mesajlar yüklenemedi, ancak yeni mesaj gönderebilirsiniz.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-3">
          {chat.pendingPermissions.map((perm) =>
            perm.question ? (
              <QuestionCard
                key={perm.request_id}
                perm={perm}
                questions={perm.question.questions}
                onAnswer={(selections) =>
                  void chat.respondToQuestion(perm.request_id, perm.question!.questions, selections)
                }
              />
            ) : (
              <PermissionCard
                key={perm.request_id}
                perm={perm}
                onAllow={() => void chat.respondAllow(perm.request_id)}
                onDeny={() => void chat.respondDeny(perm.request_id)}
              />
            )
          )}
          {sessionDown && (
            <ErrorRow
              lastErrorCode={chat.status?.last_error}
              maxBudgetUsd={chat.status?.max_budget_usd}
              onReconnect={() => void chat.restart()}
            />
          )}
          {justReconnected && (
            <p role="status" className="text-center text-xs text-emerald-400">
              Yeniden bağlandı
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-end gap-2 border-t border-zinc-800 p-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={onComposerChange}
          onKeyDown={onComposerKeyDown}
          disabled={composerDisabled}
          rows={1}
          placeholder={composerDisabled ? 'Oturum yeniden bağlanıyor…' : 'CEO’ya yaz…'}
          className="max-h-24 min-h-8 flex-1 resize-none overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={composerDisabled || text.trim() === ''}
          aria-label="Gönder"
          className="flex min-h-8 items-center gap-1.5 rounded-md bg-amber-700 px-3 py-1.5 font-medium text-zinc-950 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Gönder</span>
        </button>
      </div>
    </div>
  )
}
