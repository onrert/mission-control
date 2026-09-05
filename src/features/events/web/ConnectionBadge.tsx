import type { ConnectionStatus } from '../../../web/lib/useEventStream'
import { Wifi, WifiOff } from './icons'

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Yeniden bağlanıyor',
  connected: 'Bağlı',
  reconnecting: 'Yeniden bağlanıyor',
  disconnected: 'Bağlantı koptu',
}

const COLORS: Record<ConnectionStatus, string> = {
  connecting: 'text-amber-400',
  connected: 'text-emerald-400',
  reconnecting: 'text-amber-400',
  disconnected: 'text-red-400',
}

interface ConnectionBadgeProps {
  status: ConnectionStatus
  /** `shell` — ortak kabuk rozeti (3 durum, ikon+metin). `mini` — ekran-yerel CANLI/DUYGUSUZ. */
  variant: 'shell' | 'mini'
}

/**
 * Sözleşme §3 madde 6/7: ortak kabuk 3 durumlu rozet (Bağlı/Yeniden bağlanıyor/Bağlantı
 * koptu) + ekran-yerel CANLI/DUYGUSUZ mini rozet — aynı `status`'tan iki farklı render.
 * Renk körlüğü kuralı: her durum ikon+metin birlikte, yalnızca renkle iletilmez.
 */
export function ConnectionBadge({ status, variant }: ConnectionBadgeProps) {
  const connected = status === 'connected'
  const Icon = status === 'disconnected' ? WifiOff : Wifi
  const pulse = status === 'reconnecting' || status === 'connecting' ? 'animate-pulse' : ''

  if (variant === 'mini') {
    // UX doc satır 74/389: "CANLI"/"DUYGUSUZ" — literal metin, CSS uppercase KULLANILMAZ
    // (CLAUDE.md `lang="tr"` + uppercase yasağı — F-001 "MİSSİON CONTROL" hatasıyla aynı sınıf).
    const label = connected ? 'CANLI' : 'DUYGUSUZ'
    return (
      <span
        data-testid="connection-badge-mini"
        className={`inline-flex min-h-8 items-center gap-1 text-xs font-medium ${COLORS[status]}`}
      >
        <Icon className={`h-3.5 w-3.5 ${pulse}`} />
        {label}
      </span>
    )
  }

  return (
    <span
      data-testid="connection-badge-shell"
      className={`inline-flex min-h-8 items-center gap-1.5 text-sm ${COLORS[status]}`}
    >
      <Icon className={`h-4 w-4 ${pulse}`} />
      {LABELS[status]}
    </span>
  )
}
