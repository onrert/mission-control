import type { ThreadSection, ThreadSectionKind } from '../../../shared/types'

/** `docs/03-ux.md` ekran 5 — sol kenarlık rengiyle rol ayrımı (CEO/Developer/QA/Transkript). */
const KIND_BORDER_CLASS: Record<ThreadSectionKind, string> = {
  ceo_brief: 'border-l-sky-600',
  developer_report: 'border-l-amber-600',
  qa_verdict: 'border-l-cyan-600',
  transcript: 'border-l-zinc-600',
}

function formatTimestamp(ts: string | null): string {
  if (ts === null) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('tr-TR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface ThreadSectionCardProps {
  section: ThreadSection
  defaultOpen: boolean
}

/**
 * F-010 sözleşmesi §4 — tek bir Thread bölümü. `readable:false` iken PRD F5/AC2/AC3'ün istediği
 * "Bu bölüm okunamadı." kutusu (ham hata/stack trace ASLA gösterilmez — `section.content` zaten
 * bu durumda `null`, gösterilecek ham metin yok). `<details>` + tek üst kaydırma bağlamı
 * (`ThreadScreen`'in kendisi) — F-013/K5-K6 dersi: iç içe kaydırma kutusu YOK.
 */
export function ThreadSectionCard({ section, defaultOpen }: ThreadSectionCardProps) {
  if (!section.readable) {
    const tooltip =
      section.kind === 'transcript'
        ? 'Transkript formatı tanınmadı veya bozuk.'
        : 'İçerik okunamadı.'
    return (
      <div
        data-testid={`thread-section-${section.kind}`}
        title={tooltip}
        className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-2 text-sm text-zinc-500"
      >
        Bu bölüm okunamadı.
      </div>
    )
  }

  const timestampLabel = formatTimestamp(section.timestamp)

  return (
    <details
      data-testid={`thread-section-${section.kind}`}
      open={defaultOpen}
      className={`rounded-md border border-zinc-800 border-l-4 bg-zinc-900/40 ${KIND_BORDER_CLASS[section.kind]}`}
    >
      <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-zinc-300">
        {section.title}
        {timestampLabel !== '' && (
          <span className="ml-2 font-mono text-xs font-normal text-zinc-500">
            · {timestampLabel}
          </span>
        )}
      </summary>
      <pre className="whitespace-pre-wrap break-words px-2 pb-2 font-mono text-xs text-zinc-300">
        {section.content}
      </pre>
    </details>
  )
}
