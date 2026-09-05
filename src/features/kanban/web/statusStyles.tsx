import {
  BanIcon,
  CheckCircleIcon,
  Code2Icon,
  CircleIcon,
  FileSignatureIcon,
  FlaskConicalIcon,
  HelpCircleIcon,
  WrenchIcon,
} from './icons'

// docs/03-ux.md "Kanban/feature durum renkleri" tablosu — birebir.
export const STATUS_STYLES: Record<string, { className: string; Icon: typeof CircleIcon }> = {
  todo: { className: 'bg-zinc-800 text-zinc-300 border-zinc-700', Icon: CircleIcon },
  contract: { className: 'bg-sky-950 text-sky-300 border-sky-800', Icon: FileSignatureIcon },
  dev: { className: 'bg-amber-950 text-amber-300 border-amber-700', Icon: Code2Icon },
  qa: { className: 'bg-cyan-950 text-cyan-300 border-cyan-800', Icon: FlaskConicalIcon },
  fix: { className: 'bg-orange-950 text-orange-300 border-orange-700', Icon: WrenchIcon },
  done: {
    className: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    Icon: CheckCircleIcon,
  },
  blocked: { className: 'bg-red-950 text-red-300 border-red-700', Icon: BanIcon },
}

export const UNKNOWN_STATUS_STYLE = {
  className: 'bg-fuchsia-950/40 text-fuchsia-300 border-dashed border-fuchsia-700',
  Icon: HelpCircleIcon,
}

export function styleForColumn(columnKey: string): { className: string; Icon: typeof CircleIcon } {
  return STATUS_STYLES[columnKey] ?? UNKNOWN_STATUS_STYLE
}
