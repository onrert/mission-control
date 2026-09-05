import type { EventRecord } from '../../../shared/types'
import type { GroupItem } from './groupEvents'
import { projectColor } from './projectColor'
import { AlertTriangle } from './icons'

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

interface TimelineRowProps {
  event: EventRecord
  isRecent: boolean
  onSelect: (event: EventRecord) => void
}

/** Tekil olay satırı (sözleşme §2.1). AC2: zaman, proje, agent, araç, özet. */
export function TimelineRow({ event, isRecent, onSelect }: TimelineRowProps) {
  const color = projectColor(event.project_name)
  const missingFields = event.flags.includes('missing_fields')

  return (
    <div
      data-testid="timeline-row"
      data-seq={event.seq}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(event)
        }
      }}
      className={`flex min-h-8 cursor-pointer items-center gap-3 border-l-2 px-2 py-1.5 text-xs hover:bg-zinc-900 ${
        isRecent ? 'border-amber-500' : 'border-transparent'
      }`}
    >
      <span data-testid="row-time" className="font-mono text-zinc-500">
        {formatTime(event.ts)}
      </span>
      <span
        data-testid="row-project"
        className={`rounded-sm border px-1.5 py-0.5 ${color.text} ${color.border}`}
      >
        {event.project_name || '—'}
      </span>
      <span data-testid="row-agent" className="text-zinc-400">
        {event.agent_type ?? event.agent_id ?? '—'}
      </span>
      <span data-testid="row-tool" className="text-zinc-300">
        {event.tool_name ?? event.hook_event_name}
      </span>
      <span data-testid="row-summary" className="flex-1 truncate text-zinc-200">
        {event.summary || '—'}
      </span>
      {missingFields && (
        <span
          data-testid="row-missing-fields"
          className="flex items-center gap-1 rounded-sm border border-amber-700 bg-amber-950 px-1.5 py-0.5 text-amber-300"
        >
          <AlertTriangle className="h-3 w-3" /> eksik alan
        </span>
      )}
    </div>
  )
}

interface GroupRowProps {
  group: GroupItem
  expanded: boolean
  onToggle: (key: string) => void
  isRecent: boolean
  onSelectEvent: (event: EventRecord) => void
}

/** Katlanmış grup satırı (sözleşme §2.1) — Enter/Boşluk ile genişler/daralır. */
export function GroupRow({ group, expanded, onToggle, isRecent, onSelectEvent }: GroupRowProps) {
  const toolNames = Array.from(new Set(group.events.map((e) => e.tool_name).filter(Boolean)))
  return (
    <div data-testid="timeline-group">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggle(group.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(group.key)
          }
        }}
        className={`flex min-h-8 cursor-pointer items-center gap-2 border-l-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 ${
          isRecent ? 'border-amber-500' : 'border-transparent'
        }`}
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span>
          {group.agentType || 'agent'} → {group.events.length} araç çağrısı
          {toolNames.length > 0 ? ` (${toolNames.slice(0, 3).join(', ')}…)` : ''}
        </span>
      </div>
      {expanded && (
        <div className="pl-4">
          {group.events.map((event) => (
            <TimelineRow key={event.seq} event={event} isRecent={false} onSelect={onSelectEvent} />
          ))}
        </div>
      )}
    </div>
  )
}
