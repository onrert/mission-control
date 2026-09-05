import { useEffect, useRef } from 'react'
import type { FeatureCard } from '../../../shared/types'

export interface FeatureDetailModalProps {
  card: FeatureCard
  onClose: () => void
}

/**
 * F-007 sözleşme §2.1/AC7 — salt okunur id/title/owner/deps/sprint, focus-trap + `Esc`.
 * Odak sırası (`docs/03-ux.md` erişilebilirlik notları): açılışta ilk odaklanabilir öğeye
 * (Kapat butonu) odak verilir, `Tab`/`Shift+Tab` modal içinde döner, `Esc` kapatır ve odağı
 * tetikleyen öğeye geri verir (tetikleyene geri verme `KanbanCard`'ın sorumluluğu — bu bileşen
 * yalnızca kapanışı bildirir).
 */
export function FeatureDetailModal({ card, onClose }: FeatureDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const container = dialogRef.current
      if (!container) return
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-detail-title"
        data-testid="feature-detail-modal"
        className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="feature-detail-title" className="font-mono text-sm text-zinc-200">
            <span className="text-zinc-500">{card.id}</span> — {card.title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-8 min-w-8 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
          >
            Kapat
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Durum</dt>
            <dd className="text-zinc-200">{card.status || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Sahip (owner)</dt>
            <dd className="text-zinc-200">{card.owner || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Bağımlılıklar (deps)</dt>
            <dd className="text-zinc-200">{card.deps.length > 0 ? card.deps.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Sprint</dt>
            <dd className="text-zinc-200">{card.sprint || '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
