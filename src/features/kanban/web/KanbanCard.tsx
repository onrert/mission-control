import { memo, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { FeatureCard } from '../../../shared/types'
import { cardKey } from './useFeatures'
import { styleForColumn } from './statusStyles'

export interface KanbanCardProps {
  card: FeatureCard
  pending: boolean
  /** §3 madde 8 akış (b) — çakışma sonrası 1 sn turuncu kenarlık vurgusu. */
  highlighted: boolean
  onOpenDetail: (card: FeatureCard) => void
}

/**
 * F-007 sözleşme §2.1/§3 madde 6/§7 — `useDraggable` + AC7 (tıkla→modal) + AC9 (klavye).
 * `React.memo`: echo refetch'inde hash değişmeyen kartlar İÇİN prop referansı değişmez, bu
 * bileşen YENİDEN RENDER OLMAZ (§4.4 madde 4 echo ölçümünün ön koşulu). `data-render-count`
 * her ortamda (üretim dahil, `MODE` kapısı YOK) render edilir — E2E'nin gerçek tarayıcıda
 * ölçebilmesi için (QA tur 1 bulgu 5 düzeltmesi).
 */
function KanbanCardImpl({ card, pending, highlighted, onOpenDetail }: KanbanCardProps) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardKey(card),
    data: { card },
    attributes: { roleDescription: 'kart' },
  })

  const { className, Icon } = styleForColumn(card.column)

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    // dnd-kit'in kendi KeyboardSensor dinleyicisi ÖNCE çağrılır (Boşluk = başlat, sürükleme
    // aktifken Enter/Boşluk/Tab = onayla, Escape = iptal — §3 madde 6/§7 tuş tasarımı).
    const dndKeyDown = listeners?.onKeyDown as
      ((e: React.KeyboardEvent<HTMLDivElement>) => void) | undefined
    dndKeyDown?.(event)
    // Bilinçli sapma (UX §443'ten, §3 madde 6): boşta (sürükleme AKTİF DEĞİLKEN) `Enter`
    // YALNIZCA modalı açar — dnd-kit'in `start` listesinden zaten çıkarıldı, bu yüzden burada
    // sürüklemeyi tetiklemez.
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault()
      onOpenDetail(card)
    }
  }

  function handleClick(): void {
    if (isDragging) return
    onOpenDetail(card)
  }

  const highlightClass = highlighted
    ? 'border-orange-500 ring-1 ring-orange-500'
    : 'border-zinc-800'

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      data-testid={`kanban-card-${card.file}`}
      data-render-count={renderCountRef.current}
      className={`min-h-8 cursor-pointer rounded-md border ${highlightClass} bg-zinc-900/60 p-3 text-sm shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-zinc-500">{card.id}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] ${className}`}
        >
          <Icon className="h-3 w-3" />
          {card.column}
        </span>
      </div>
      <p className="truncate text-zinc-100">{card.title}</p>
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
        <span>{card.owner || '—'}</span>
        {card.deps.length > 0 && <span>{card.deps.length} bağımlılık</span>}
      </div>
      {pending && (
        <span
          data-testid={`kanban-card-pending-${card.file}`}
          className="mt-1 inline-block text-xs text-amber-400"
        >
          yazılıyor…
        </span>
      )}
    </div>
  )
}

export const KanbanCard = memo(KanbanCardImpl)
