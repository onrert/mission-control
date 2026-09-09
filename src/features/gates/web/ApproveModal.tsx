import { useEffect, useRef, useState } from 'react'
import { buildApprovalBody } from '../shared/format-approval'
import type { GateStatusItem } from '../../../shared/types'
import type { GateActionOutcome } from './useGates'

export interface ApproveModalProps {
  gate: GateStatusItem
  projectLabel: string
  onCancel: () => void
  onConfirm: (decision: string) => Promise<GateActionOutcome>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * F-008 sözleşmesi §4/§5 — L2'nin "ikinci adımı" (birinci adım: satırdaki [Onayla] tıklaması,
 * bu bileşeni açar). İptal edilirse `onConfirm` HİÇ ÇAĞRILMAZ, hiçbir dosya değişmez (AC7).
 * Önizleme `buildApprovalBody`'yi (§5, `fs` importu yok) DOĞRUDAN çağırır — sunucunun yazacağı
 * içerikle önizleme BAYT BAYT aynı fonksiyondan üretilir, ikinci bir `/preview` ucu gerekmez.
 * `FeatureDetailModal`'ın focus-trap desenini tekrarlar (Karpathy §2 — ikinci bir "modal"
 * soyutlaması eklenmedi, aynı küçük deseni kopyalamak yeterli).
 */
export function ApproveModal({ gate, projectLabel, onCancel, onConfirm }: ApproveModalProps) {
  const [decision, setDecision] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
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
  }, [onCancel])

  const trimmedDecision = decision.trim()
  const disabled = trimmedDecision === '' || submitting

  async function handleConfirm(): Promise<void> {
    if (disabled) return
    setSubmitting(true)
    setErrorMessage(null)
    const outcome = await onConfirm(decision)
    if (outcome.kind === 'success') return
    // AC5 — yazma hatasında buton durumu geri alınır, modal KAPANMAZ, karar metni KAYBOLMAZ.
    setSubmitting(false)
    setErrorMessage(outcome.message)
  }

  const preview = buildApprovalBody(gate.id, gate.label, projectLabel, todayIso(), decision)

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-modal-title"
        data-testid="approve-modal"
        className="w-full max-w-lg rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="approve-modal-title" className="mb-3 font-mono text-sm text-zinc-200">
          {gate.id} — {gate.label} kapısını onayla
        </h2>
        <dl className="mb-3 space-y-1 text-xs text-zinc-400">
          <div>
            <dt className="inline text-zinc-500">Proje: </dt>
            <dd className="inline">{projectLabel}</dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Yazılacak dosya: </dt>
            <dd className="inline font-mono">docs/approvals/{gate.id}.ok</dd>
          </div>
        </dl>
        <div className="mb-3 rounded-md border border-zinc-800 bg-zinc-950 p-2">
          <p className="mb-1 text-xs text-zinc-500">Önizleme</p>
          <pre
            data-testid="approve-preview"
            className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-300"
          >
            {preview}
          </pre>
        </div>
        <label className="mb-3 block text-xs text-zinc-400">
          Kullanıcının kararı (zorunlu)
          <textarea
            data-testid="approve-decision-input"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-100"
          />
        </label>
        {errorMessage && (
          <p role="alert" data-testid="approve-error" className="mb-3 text-xs text-red-400">
            {errorMessage}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            data-testid="approve-cancel-button"
            className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={disabled}
            data-testid="approve-confirm-button"
            className="min-h-8 rounded-md border border-amber-700 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300 disabled:opacity-50"
          >
            Onayı Yaz →
          </button>
        </div>
      </div>
    </div>
  )
}
