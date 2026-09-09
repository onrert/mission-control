// F-008 sözleşmesi §10.1 — 4 durum ikonu, `events/web/icons.tsx` ile AYNI desen: Lucide (MIT)
// path verisinden elle alınmış minimal inline SVG, `lucide-react` bağımlılığı eklenmeden
// (sözleşme §9 madde "İçinde" madde 4). 24x24 viewBox, `stroke="currentColor"`,
// `stroke-width="2"`, `fill="none"`. Renk hiçbir zaman TEK BAŞINA anlam taşımaz (erişilebilirlik
// notları) — bu yüzden `GateRow.tsx` bu ikonları her zaman metinle birlikte kullanır.

interface IconProps {
  className?: string
}

/** Bekliyor (⏳ zinc/amber) — Lucide `Clock`. */
export function Clock({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/** Onaylandı (✔ emerald) — Lucide `CheckCircle2`. */
export function CheckCircle2({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

/** Reddedildi (✘ red) — Lucide `XCircle`. */
export function XCircle({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

/** Çelişkili durum (⚠ fuchsia) — Lucide `AlertTriangle` (`events/web/icons.tsx` ile aynı yol verisi). */
export function AlertTriangle({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}
