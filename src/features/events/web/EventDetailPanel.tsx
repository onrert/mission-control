import { useEffect, useRef } from 'react'
import type { EventRecord } from '../../../shared/types'

interface EventDetailPanelProps {
  event: EventRecord
  onClose: () => void
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  )
}

/**
 * Sağdan kayan salt-okunur detay çekmecesi (UX ekran-1 kaynağı, sözleşme §2.1) — focus trap +
 * `Esc` kapatma (UX doc "Odak sırası": modal/çekmece odak içine kilitlenir, `Esc` kapatır ve
 * odağı tetikleyen öğeye geri verir — tetikleyen öğeye odak iadesi çağıranın sorumluluğudur).
 */
export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const focusable = getFocusable(panel)
    focusable[0]?.focus()

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = getFocusable(panel)
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const missingFields = event.flags.includes('missing_fields')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Olay detayı"
      ref={panelRef}
      data-testid="event-detail-panel"
      className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-200 shadow-lg shadow-black/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-100">Olay detayı</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          Kapat
        </button>
      </div>
      <dl className="space-y-2">
        <div>
          <dt className="text-xs text-zinc-500">Özet</dt>
          <dd className="break-words">{event.summary || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">session_id</dt>
          <dd className="font-mono">{event.session_id ?? '—'}</dd>
        </div>
        {missingFields && (
          <div>
            <dt className="text-xs text-amber-400">⚠ eksik alan</dt>
            <dd>Bu olayda beklenen bazı alanlar eksik geldi.</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-zinc-500">Ham veri</dt>
          <dd>
            <pre className="mt-1 max-h-96 overflow-auto rounded-sm bg-zinc-950 p-2 text-xs">
              {JSON.stringify(event.raw, null, 2)}
            </pre>
          </dd>
        </div>
      </dl>
    </div>
  )
}
