import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventRecord } from '../../../shared/types'
import type { UseEventStreamResult } from '../../../web/lib/useEventStream'
import { ConnectionBadge } from './ConnectionBadge'
import { FilterChips, ClearFiltersLink } from './FilterChips'
import { TimelineRow, GroupRow } from './TimelineRow'
import { EventDetailPanel } from './EventDetailPanel'
import { groupEvents } from './groupEvents'

const RECENT_MS = 5000
const RATE_WINDOW_MS = 60000

export interface TimelineScreenProps {
  /**
   * `App.tsx`'in tek `useEventStream()` çağrısının sonucu (sözleşme §2.2 `App.tsx` satırı —
   * "`useEventStream()` bir kez çağrılır, App kökünde, tek bağlantı"). Bu ekran kendi
   * `EventSource`/`fetch` bağlantısını AÇMAZ, yalnızca App'ten gelen tek paylaşılan akışı
   * render eder.
   */
  stream: UseEventStreamResult
}

function distinctValues(events: EventRecord[], select: (e: EventRecord) => string): string[] {
  const set = new Set<string>()
  for (const e of events) {
    const v = select(e)
    if (v) set.add(v)
  }
  return Array.from(set).sort()
}

/**
 * Zaman Çizelgesi ekranının kökü (sözleşme §2.1). `App.tsx` bunu koşulsuz mount eder — bileşen
 * hiç unmount olmadığı için filtre state'i "oturum boyunca" doğal olarak kalıcıdır (§3 madde 12).
 */
export function TimelineScreen({ stream }: TimelineScreenProps) {
  const [deselectedProjects, setDeselectedProjects] = useState<Set<string>>(new Set())
  const [deselectedAgents, setDeselectedAgents] = useState<Set<string>>(new Set())
  const [deselectedTypes, setDeselectedTypes] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const projectOptions = useMemo(
    () => distinctValues(stream.events, (e) => e.project_name),
    [stream.events]
  )
  const agentOptions = useMemo(
    () => distinctValues(stream.events, (e) => e.agent_type ?? e.agent_id ?? ''),
    [stream.events]
  )
  const typeOptions = useMemo(
    () => distinctValues(stream.events, (e) => e.hook_event_name),
    [stream.events]
  )

  const descendingEvents = useMemo(() => [...stream.events].reverse(), [stream.events])

  const filteredEvents = useMemo(
    () =>
      descendingEvents.filter((e) => {
        const agent = e.agent_type ?? e.agent_id ?? ''
        if (deselectedProjects.has(e.project_name)) return false
        if (deselectedAgents.has(agent)) return false
        if (deselectedTypes.has(e.hook_event_name)) return false
        return true
      }),
    [descendingEvents, deselectedProjects, deselectedAgents, deselectedTypes]
  )

  const items = useMemo(() => groupEvents(filteredEvents), [filteredEvents])

  const eventsPerMinute = useMemo(
    () => stream.events.filter((e) => now - e.received_ms <= RATE_WINDOW_MS).length,
    [stream.events, now]
  )

  function toggle(
    setFn: (updater: (prev: Set<string>) => Set<string>) => void,
    value: string
  ): void {
    setFn((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function clearFilters(): void {
    setDeselectedProjects(new Set())
    setDeselectedAgents(new Set())
    setDeselectedTypes(new Set())
  }

  function handleToggleGroup(key: string): void {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleScroll(): void {
    const el = listRef.current
    if (!el) return
    stream.setScrolledAway(el.scrollTop > 0)
  }

  function handleResumeClick(): void {
    stream.resume()
    const el = listRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: 0 })
    }
  }

  const connectionLabel =
    stream.connectionStatus === 'connected'
      ? 'Bağlı'
      : stream.connectionStatus === 'disconnected'
        ? 'Bağlantı koptu'
        : 'Yeniden bağlanıyor'

  return (
    <div data-testid="timeline-screen" className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <div aria-live="polite" className="sr-only">
        {connectionLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 p-3">
        <ConnectionBadge status={stream.connectionStatus} variant="mini" />
        <span data-testid="event-rate" className="text-xs text-zinc-500">
          {eventsPerMinute} olay/dk
        </span>
        <button
          type="button"
          onClick={stream.togglePause}
          className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
        >
          {stream.pausedByUser ? 'Devam et' : 'Duraklat'}
        </button>
        {stream.frozen && stream.pendingCount > 0 && (
          <button
            type="button"
            data-testid="pending-events-badge"
            onClick={handleResumeClick}
            className="min-h-8 rounded-full border border-amber-500 bg-amber-950 px-2.5 py-1 text-xs text-amber-300"
          >
            {stream.pendingCount} yeni olay ↑ En üste git
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-b border-zinc-800 p-3">
        <FilterChips
          label="Proje"
          options={projectOptions}
          selected={new Set(projectOptions.filter((o) => !deselectedProjects.has(o)))}
          onToggle={(v) => toggle(setDeselectedProjects, v)}
        />
        <FilterChips
          label="Agent"
          options={agentOptions}
          selected={new Set(agentOptions.filter((o) => !deselectedAgents.has(o)))}
          onToggle={(v) => toggle(setDeselectedAgents, v)}
        />
        <FilterChips
          label="Tip"
          options={typeOptions}
          selected={new Set(typeOptions.filter((o) => !deselectedTypes.has(o)))}
          onToggle={(v) => toggle(setDeselectedTypes, v)}
        />
        <ClearFiltersLink onClear={clearFilters} />
      </div>

      {stream.loadState === 'error' && (
        <div
          role="alert"
          data-testid="timeline-error-banner"
          className="flex items-center justify-between gap-3 border-b border-red-800 bg-red-950/40 p-3 text-sm text-red-300"
        >
          <span>Olay geçmişi yüklenemedi.</span>
          <button
            type="button"
            onClick={stream.retryInitialLoad}
            className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {stream.loadState === 'ready' && stream.staleData && (
        <div
          role="status"
          data-testid="timeline-stale-banner"
          className="border-b border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300"
        >
          Olay deposu okunamadı, ancak yeni gelen canlı olaylar gösterilmeye devam ediyor.
        </div>
      )}

      <div
        ref={listRef}
        onScroll={handleScroll}
        data-testid="timeline-list"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {stream.loadState === 'loading' && (
          <div data-testid="timeline-skeleton" className="p-3">
            <p className="mb-2 text-xs text-zinc-500">Son 100 olay yükleniyor…</p>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mb-1.5 h-6 animate-pulse rounded-sm bg-zinc-900" />
            ))}
          </div>
        )}

        {stream.loadState === 'ready' && filteredEvents.length === 0 && (
          <p data-testid="timeline-empty" className="p-6 text-center text-sm text-zinc-500">
            Henüz olay yok. İzlenen bir projede bir agent çalıştığında burada görünecek.
          </p>
        )}

        {stream.loadState === 'ready' &&
          items.map((item) =>
            item.type === 'single' ? (
              <TimelineRow
                key={item.event.seq}
                event={item.event}
                isRecent={now - item.event.received_ms <= RECENT_MS}
                onSelect={setSelectedEvent}
              />
            ) : (
              <GroupRow
                key={item.key}
                group={item}
                expanded={expandedGroups.has(item.key)}
                onToggle={handleToggleGroup}
                isRecent={now - item.events[0]!.received_ms <= RECENT_MS}
                onSelectEvent={setSelectedEvent}
              />
            )
          )}
      </div>

      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}
