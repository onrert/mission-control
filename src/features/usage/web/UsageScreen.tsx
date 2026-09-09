import { useMemo, useState } from 'react'
import type { ProjectListItem, TokenUsageTotals, UsageProjectTotal } from '../../../shared/types'
import { useProjects } from '../../projects/web/useProjects'
import { useUsageReport } from './useUsageReport'

export interface UsageScreenProps {
  /** App.tsx'in `onProjects` akışından gelen tam liste — yalnızca "hiç izlenen proje yoksa
   *  Ayarlar'a git" nüansı için (Zaman Çizelgesi/Kanban/Thread emsali). `/api/usage`'ın kendisi
   *  proje filtresi ALMAZ, tüm izlenen projeleri tek yanıtta döner. */
  liveProjectsUpdate: ProjectListItem[] | null
  onNavigateSettings: () => void
  /** Testler için. */
  fetchImpl?: typeof fetch
}

type GroupMode = 'proje' | 'gun'

const SKELETON_ROW_COUNT = 4

/**
 * F-011 QA düzeltme turu 2 (AA4, BLOKLAYICI) — başlık (`usage-table-header`) ve her satırın
 * (`usage-row` → `<summary>`) grid'i eskiden AYNI `grid-cols-[1fr_auto_auto_auto_auto]` metnini
 * kullanıyordu ama iki AYRI, BİRBİRİNDEN BAĞIMSIZ grid konteynerdi — `auto` sütun genişlikleri
 * HER konteynerin KENDİ içeriğine göre hesaplanır. Başlıkta "Gün/Giriş/Çıkış/Dağılım" kısa
 * etiketler dar `auto` sütunlar üretiyordu (proje 1fr'ye 320px'te 95px kalıyordu); satırlarda
 * gerçek veri (tarih, büyük sayılar, dağılım çubuğu) çok daha geniş `auto` sütunlar üretiyordu —
 * proje sütunu 320px'te TAMAMEN (0px) çöküyordu (QA ölçtü).
 *
 * Düzeltme: `auto` yerine SABİT (`rem`) genişlikler — artık sütun genişliği içerikten değil
 * şablonun kendisinden geldiği için başlık ve satırlar HER ZAMAN birebir hizalı (aynı literal
 * şablon + aynı genişlikteki kaydırma kabı). Proje sütunu `minmax(4.5rem,1fr)` ile en az 72px
 * garanti eder — asla 0px'e çökemez. Toplam sabit genişlik dar ekranlarda konteyneri aşarsa
 * (320px) `usage-table-scroll` kabı (`overflow-x-auto`) devreye girer — kırpma/gizleme YOK,
 * kaydırma var (F-005 emsali).
 */
const USAGE_GRID_COLS = 'grid-cols-[minmax(4.5rem,1fr)_5rem_5rem_5rem_6rem]'

function totalTokens(usage: TokenUsageTotals): number {
  return (
    usage.input_tokens +
    usage.output_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR')
}

interface FlatRow {
  key: string
  project_label: string
  day: string
  dayUsage: TokenUsageTotals
  sessions: UsageProjectTotal['days'][number]['sessions']
}

/**
 * F-011 sözleşmesi §1 madde 5 — "Grupla" seçici bir FİLTRE değil, birincil sıralama anahtarıdır;
 * her iki sütun (Proje, Gün) her zaman görünür kalır, yalnızca satır sırası değişir.
 */
function flattenRows(projects: UsageProjectTotal[], mode: GroupMode): FlatRow[] {
  const rows: FlatRow[] = []
  for (const project of projects) {
    for (const day of project.days) {
      rows.push({
        key: `${project.project_id}-${day.day}`,
        project_label: project.project_label,
        day: day.day,
        dayUsage: day.usage,
        sessions: day.sessions,
      })
    }
  }
  if (mode === 'proje') {
    rows.sort(
      (a, b) => a.project_label.localeCompare(b.project_label) || a.day.localeCompare(b.day)
    )
  } else {
    rows.sort(
      (a, b) => a.day.localeCompare(b.day) || a.project_label.localeCompare(b.project_label)
    )
  }
  return rows
}

/**
 * F-011 sözleşmesi §1 — Token Kullanımı ekranı (`docs/03-ux.md` ekran 6). Proje filtresi yok,
 * tüm izlenen projelerin transkript token toplamını tek tabloda gösterir. Salt okunur — hiçbir
 * yazma isteği ATMAZ.
 */
export function UsageScreen({
  liveProjectsUpdate,
  onNavigateSettings,
  fetchImpl,
}: UsageScreenProps) {
  const { items: projects, loadState: projectsLoadState } = useProjects(liveProjectsUpdate)
  const { loadState, report, errorMessage, retry } = useUsageReport({ fetchImpl })
  const [groupMode, setGroupMode] = useState<GroupMode>('proje')

  const noProjectsTracked = projects.length === 0 && projectsLoadState === 'ready'

  const rows = useMemo(
    () => (report ? flattenRows(report.projects, groupMode) : []),
    [report, groupMode]
  )
  const grandTotal = report ? totalTokens(report.usage) : 0

  return (
    <div
      data-testid="usage-screen"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-zinc-950 p-3 text-zinc-100"
    >
      {loadState === 'loading' && (
        <div data-testid="usage-skeleton" className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-zinc-900" />
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div
          role="alert"
          data-testid="usage-error-banner"
          className="flex items-center justify-between gap-3 rounded-md border border-red-800 bg-red-950/40 p-2 text-sm text-red-300"
        >
          <span>{errorMessage ?? 'Token verisi yüklenemedi.'}</span>
          <button
            type="button"
            onClick={retry}
            className="min-h-8 rounded-md border border-red-700 px-3 py-1.5 text-xs"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {loadState === 'ready' && report && report.source_unreadable && (
        <p data-testid="usage-unreadable" className="p-8 text-center text-sm text-zinc-500">
          Token verisi okunamadı (kaynak dosya bulunamadı veya format tanınmıyor).
        </p>
      )}

      {loadState === 'ready' && report && !report.source_unreadable && rows.length === 0 && (
        <div data-testid="usage-empty" className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-sm text-zinc-500">Henüz token verisi yok.</p>
          {noProjectsTracked && (
            <button
              type="button"
              onClick={onNavigateSettings}
              className="min-h-8 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
            >
              Ayarlar&apos;a git
            </button>
          )}
        </div>
      )}

      {loadState === 'ready' && report && !report.source_unreadable && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Grupla:</span>
              <select
                aria-label="Grupla"
                data-testid="usage-group-select"
                value={groupMode}
                onChange={(e) => setGroupMode(e.target.value as GroupMode)}
                className="min-h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              >
                <option value="proje">Proje</option>
                <option value="gun">Gün</option>
              </select>
            </label>
            <span data-testid="usage-grand-total" className="font-mono text-sm text-zinc-300">
              Toplam: {formatNumber(grandTotal)} token
            </span>
          </div>

          {report.degraded && (
            <div
              role="status"
              data-testid="usage-degraded-warning"
              className="flex flex-col gap-1 rounded-md border border-amber-800 bg-amber-950/40 p-2 text-sm text-amber-300"
            >
              {/* F-011 QA düzeltme turu (Z4) — sessiz kısmi başarı yok: üç bağımsız uyarı, her
                  biri yalnızca ilgili sayaç sıfırdan büyükse görünür (docs/03-ux.md ekran 6). */}
              {report.lines_bad + report.unknown_type_lines > 0 && (
                <p data-testid="usage-warning-unrecognized">
                  ⚠ Toplam {formatNumber(report.lines_ok + report.lines_bad)} satırdan{' '}
                  {formatNumber(report.lines_bad + report.unknown_type_lines)} tanesi tanınmadı —
                  veri eksik olabilir.
                </p>
              )}
              {report.unreadable_file_count > 0 && (
                <p data-testid="usage-warning-unreadable-files">
                  ⚠ {formatNumber(report.unreadable_file_count)} dosya okunamadı (izin/erişim
                  hatası) — bu dosyaların token verisi toplamda YOK.
                </p>
              )}
              {report.truncated_file_count > 0 && (
                <p data-testid="usage-warning-truncated-files">
                  ⚠ {formatNumber(report.truncated_file_count)} dosya çok büyük olduğu için kırpıldı
                  (yalnızca son 32 MB okundu) — toplam eksik olabilir.
                </p>
              )}
            </div>
          )}

          {/* F-011 QA düzeltme turu 2 (AA4) — başlık ve satırlar artık AYNI SABİT genişlikli
              `USAGE_GRID_COLS` şablonunu, AYNI kaydırma kabı (`overflow-x-auto`) içinde paylaşır.
              Genişlik içerikten değil şablondan geldiği için ikisi HER ZAMAN pikselce hizalı;
              toplam genişlik dar ekranı (320px) aşarsa kırpma/gizleme değil yatay kaydırma
              devreye girer — proje sütunu (`minmax(4.5rem,1fr)`) asla 0px'e çökmez. */}
          <div data-testid="usage-table-scroll" className="overflow-x-auto">
            {/* `docs/03-ux.md` ekran 6 mockup'ıyla birebir sütun başlıkları (Z6 — eskiden hiç
                yoktu, kullanıcı sayıların ne olduğunu tahmin etmek zorunda kalıyordu). */}
            <div
              data-testid="usage-table-header"
              aria-hidden="true"
              className={`grid ${USAGE_GRID_COLS} gap-3 px-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-500`}
            >
              <span>Proje</span>
              <span>Gün</span>
              <span>Giriş</span>
              <span>Çıkış</span>
              <span>Dağılım</span>
            </div>

            <div data-testid="usage-rows" className="flex flex-col gap-2">
              {rows.map((row) => {
                const share = grandTotal > 0 ? (totalTokens(row.dayUsage) / grandTotal) * 100 : 0
                const barWidth = Math.max(0, Math.min(100, share))
                return (
                  <details
                    key={row.key}
                    data-testid="usage-row"
                    className="rounded-md border border-zinc-800 bg-zinc-900/40"
                  >
                    <summary
                      className={`grid cursor-pointer ${USAGE_GRID_COLS} items-center gap-3 px-2 py-1.5 text-xs text-zinc-300`}
                    >
                      <span data-testid="usage-row-project" className="truncate font-semibold">
                        {row.project_label}
                      </span>
                      <span data-testid="usage-row-day" className="truncate font-mono">
                        {row.day}
                      </span>
                      <span data-testid="usage-row-input" className="truncate font-mono">
                        {formatNumber(row.dayUsage.input_tokens)}
                      </span>
                      <span data-testid="usage-row-output" className="truncate font-mono">
                        {formatNumber(row.dayUsage.output_tokens)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-16 overflow-hidden rounded bg-zinc-800">
                          <span
                            className="block h-full bg-amber-600"
                            style={{ width: `${barWidth}%` }}
                          />
                        </span>
                        <span className="font-mono">{share.toFixed(0)}%</span>
                      </span>
                    </summary>
                    <div className="flex flex-col gap-1 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-400">
                      {row.sessions.flatMap((session) =>
                        session.agents.map((agentTotal) => (
                          <div
                            key={`${session.session_id}-${agentTotal.agent}`}
                            data-testid="usage-session-agent-row"
                            className="font-mono"
                          >
                            Oturum {session.session_id.slice(0, 8)} · {agentTotal.agent}: giriş{' '}
                            {formatNumber(agentTotal.usage.input_tokens)}, çıkış{' '}
                            {formatNumber(agentTotal.usage.output_tokens)}
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
