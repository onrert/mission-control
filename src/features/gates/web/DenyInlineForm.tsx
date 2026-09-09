import { useState } from 'react'
import type { GateActionOutcome } from './useGates'

export interface DenyInlineFormProps {
  onCancel: () => void
  onSubmit: (reason: string) => Promise<GateActionOutcome>
}

/**
 * F-008 sözleşmesi §4/§9 — satır içinde genişleyen zorunlu gerekçe formu (AC3/AC8), ayrı bir
 * doğrulama adımı istemez (Reddet tek adımda kaydeder). AC5 — yazma hatasında (ör. B6'nın 409
 * `conflict`'i) form KAPANMAZ, gerekçe metni KAYBOLMAZ, hata satır içi gösterilir.
 */
export function DenyInlineForm({ onCancel, onSubmit }: DenyInlineFormProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmedReason = reason.trim()
  const disabled = trimmedReason === '' || submitting

  async function handleSubmit(): Promise<void> {
    if (disabled) return
    setSubmitting(true)
    setErrorMessage(null)
    const outcome = await onSubmit(reason)
    if (outcome.kind === 'success') return
    setSubmitting(false)
    setErrorMessage(outcome.message)
  }

  return (
    <div
      data-testid="deny-inline-form"
      className="rounded-md border border-zinc-800 bg-zinc-950 p-2"
    >
      <label className="block text-xs text-zinc-400">
        Red gerekçesi (zorunlu)
        <textarea
          data-testid="deny-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-100"
        />
      </label>
      {errorMessage && (
        <p role="alert" data-testid="deny-error" className="mt-1 text-xs text-red-400">
          {errorMessage}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="deny-cancel-button"
          className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled}
          data-testid="deny-submit-button"
          className="min-h-8 rounded-md border border-red-700 bg-red-950/40 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
        >
          Reddet - Kaydet
        </button>
      </div>
    </div>
  )
}
