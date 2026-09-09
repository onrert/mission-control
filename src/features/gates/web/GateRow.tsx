import { useState } from 'react'
import type { GateStatus, GateStatusItem } from '../../../shared/types'
import type { GateActionOutcome } from './useGates'
import { DenyInlineForm } from './DenyInlineForm'
import { AlertTriangle, CheckCircle2, Clock, XCircle } from './icons'

export interface GateRowProps {
  gate: GateStatusItem
  isDenying: boolean
  onApproveClick: () => void
  onDenyClick: () => void
  onDenyCancel: () => void
  onDenySubmit: (reason: string) => Promise<GateActionOutcome>
}

const DATE_TITLE =
  'Tarih, dosyanın son değiştirilme zamanıdır; klonlama/checkout sonrası içerikteki tarihten farklı olabilir.'

const STATUS_BADGE: Record<GateStatus, { Icon: typeof Clock; label: string; className: string }> = {
  pending: { Icon: Clock, label: 'Bekliyor', className: 'text-amber-400' },
  approved: { Icon: CheckCircle2, label: 'Onaylandı', className: 'text-emerald-400' },
  denied: { Icon: XCircle, label: 'Reddedildi', className: 'text-red-400' },
  conflict: { Icon: AlertTriangle, label: 'Çelişkili durum', className: 'text-fuchsia-400' },
}

/**
 * F-008 sözleşmesi §4 "Aksiyon durum makinesi" — dört durumun her biri FARKLI butonlar çizer
 * (`docs/03-ux.md:196-206` birebir). `expanded` (§4 "[Detay] görünümü") burada, satırın KENDİ
 * state'inde tutulur — ayrı bir modal bileşeni bu kadar küçük bir içerik için gereksiz soyutlama
 * olurdu (Karpathy §2).
 */
export function GateRow({
  gate,
  isDenying,
  onApproveClick,
  onDenyClick,
  onDenyCancel,
  onDenySubmit,
}: GateRowProps) {
  const [expanded, setExpanded] = useState(false)

  if (gate.error) {
    return (
      <tr data-testid={`gate-row-${gate.id}`} className="border-b border-zinc-800">
        <td className="p-2 font-mono text-sm text-zinc-300">
          {gate.id} {gate.label}
        </td>
        <td colSpan={3} className="p-2 text-sm text-zinc-500">
          Durum belirlenemedi
        </td>
      </tr>
    )
  }

  const badge = STATUS_BADGE[gate.status]
  const { Icon } = badge
  const dateText =
    gate.status === 'approved'
      ? (gate.ok_date ?? '—')
      : gate.status === 'denied'
        ? (gate.deny_date ?? '—')
        : '—'
  const isConflict = gate.status === 'conflict'

  return (
    <>
      <tr
        data-testid={`gate-row-${gate.id}`}
        className={
          isConflict
            ? 'cursor-pointer border-b border-zinc-800 hover:bg-zinc-900/60'
            : 'border-b border-zinc-800'
        }
        onClick={isConflict ? () => setExpanded((v) => !v) : undefined}
      >
        <td className="p-2 font-mono text-sm text-zinc-300">
          {gate.id} {gate.label}
        </td>
        <td className={`p-2 text-sm ${badge.className}`}>
          <span className="inline-flex items-center gap-1">
            <Icon className="h-4 w-4" />
            {badge.label}
          </span>
        </td>
        <td className="p-2 text-sm text-zinc-400" title={DATE_TITLE}>
          {dateText}
        </td>
        <td className="p-2 text-sm">
          {gate.status === 'pending' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onApproveClick}
                data-testid={`gate-approve-${gate.id}`}
                className="min-h-8 rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-300"
              >
                Onayla
              </button>
              <button
                type="button"
                onClick={onDenyClick}
                data-testid={`gate-deny-${gate.id}`}
                className="min-h-8 rounded-md border border-red-700 px-2 py-1 text-xs text-red-300"
              >
                Reddet
              </button>
            </div>
          )}
          {gate.status === 'approved' && (
            <span data-testid={`gate-locked-${gate.id}`} className="text-xs text-zinc-500">
              (kilitli)
            </span>
          )}
          {gate.status === 'denied' && (
            <button
              type="button"
              onClick={onApproveClick}
              data-testid={`gate-approve-${gate.id}`}
              className="min-h-8 rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-300"
            >
              Onayla
            </button>
          )}
          {isConflict && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              data-testid={`gate-detail-${gate.id}`}
              className="min-h-8 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              Detay
            </button>
          )}
        </td>
      </tr>
      {isDenying && (
        // AC5 — yazma hatasında (B6 dahil: bir başkası araya girip kapıyı onaylamış olabilir,
        // `gate.status` bu arada `approved`'a döner) form KAPANMAZ, hata satır içi gösterilir.
        // Bu yüzden görünürlük `gate.status === 'pending'`'e DEĞİL, yalnızca ebeveynin
        // (`GatesScreen`) `isDenying`'i sıfırlamasına (iptal/başarı) bağlıdır.
        <tr>
          <td colSpan={4} className="p-2">
            <DenyInlineForm onCancel={onDenyCancel} onSubmit={onDenySubmit} />
          </td>
        </tr>
      )}
      {expanded && isConflict && (
        <tr data-testid={`gate-detail-row-${gate.id}`}>
          <td
            colSpan={4}
            className="border-b border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400"
          >
            <p>
              Onay (.ok) tarihi: {gate.ok_date ?? '—'}
              {gate.newer_side === 'ok' ? ' (daha yeni)' : ''}
            </p>
            <p>
              Red (.deny.md) tarihi: {gate.deny_date ?? '—'}
              {gate.newer_side === 'deny' ? ' (daha yeni)' : ''}
            </p>
            <p className="mt-1 text-zinc-500">
              Bu durum panelden düzeltilemez; dosyaları docs/approvals/ altında elle inceleyin.
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
