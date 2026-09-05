import { useDroppable } from '@dnd-kit/core'
import type { FeatureCard } from '../../../shared/types'
import { KanbanCard } from './KanbanCard'
import { cardKey } from './useFeatures'

export interface KanbanColumnProps {
  columnKey: string
  label: string
  cards: FeatureCard[]
  loading: boolean
  isPending: (card: FeatureCard) => boolean
  conflictedKey: string | null
  onOpenDetail: (card: FeatureCard) => void
  unknown?: boolean
}

/**
 * Tek sütun (sözleşme §2.1). Başlık biçimi ADR-001 karar 8: `"${label} (${key})"` →
 * "Geliştirme (dev)". `unknown` sütunu ek olarak kesikli kenarlık taşır (ADR-001 karar 5).
 */
export function KanbanColumn({
  columnKey,
  label,
  cards,
  loading,
  isPending,
  conflictedKey,
  onOpenDetail,
  unknown = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey })

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${columnKey}`}
      className={`flex min-w-[220px] flex-1 flex-col gap-2 rounded-md border p-2 ${
        unknown
          ? 'border-dashed border-fuchsia-700 bg-fuchsia-950/10'
          : 'border-zinc-800 bg-zinc-900'
      } ${isOver ? 'ring-2 ring-amber-400' : ''}`}
    >
      <h3
        className={`font-display text-xs tracking-wide ${unknown ? 'text-fuchsia-300' : 'text-zinc-300'}`}
      >
        {unknown ? 'Bilinmeyen durum' : `${label} (${columnKey})`}
      </h3>
      <div className="flex flex-col gap-2">
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-800/60" />
          ))}
        {!loading && cards.length === 0 && (
          <p className="p-2 text-center text-xs text-zinc-600">Kart yok</p>
        )}
        {!loading &&
          cards.map((card) => (
            <KanbanCard
              key={cardKey(card)}
              card={card}
              pending={isPending(card)}
              highlighted={conflictedKey === cardKey(card)}
              onOpenDetail={onOpenDetail}
            />
          ))}
      </div>
    </div>
  )
}
