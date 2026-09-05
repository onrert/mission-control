// 8 durum ikonu (docs/03-ux.md "Kanban/feature durum renkleri" tablosu) — Lucide (MIT) ile aynı
// görsel dilde (24x24, `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`) minimal,
// elle çizilmiş SVG'ler; `events/web/icons.tsx` ile aynı desen (`lucide-react` bağımlılığı
// eklenmez, sözleşme §1 madde "İçinde" madde 4). Renk körlüğü kuralı: her durum rengiyle
// birlikte her zaman bir ikon + kısa metin etiketi.

interface IconProps {
  className?: string
}

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true' as const,
}

export function CircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function FileSignatureIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" />
      <path d="M15 3l5 5v3" />
      <path d="M14 15c1.5-1 3-1 4 0s1.5 2.5.5 3.5-3 .5-3.5-.5-1-2.5.5-3.5z" />
    </svg>
  )
}

export function Code2Icon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
    </svg>
  )
}

export function FlaskConicalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 3h4" />
      <path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  )
}

export function WrenchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14.5 3.5a5 5 0 0 0-6.9 6l-6.1 6.1a2 2 0 0 0 2.8 2.8l6.1-6.1a5 5 0 0 0 6-6.9l-3 3-2-2 3-3z" />
    </svg>
  )
}

export function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </svg>
  )
}

export function BanIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.5 5.5 13 13" />
    </svg>
  )
}

export function HelpCircleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2-2.4 3.5" />
      <path d="M12 17.2h.01" />
    </svg>
  )
}
