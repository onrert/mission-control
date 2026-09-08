import { useEffect, useRef } from 'react'
import type { FeatureCard, FeatureDetailDocument, FeatureDetailReport } from '../../../shared/types'
import { useFeatureDetail } from './useFeatureDetail'

export interface FeatureDetailModalProps {
  card: FeatureCard
  onClose: () => void
  /** Testler için — üretimde her zaman global `fetch`. */
  fetchImpl?: typeof fetch
}

const TRUNCATED_NOTICE = 'İçerik çok büyük olduğu için kısaltıldı.'

/** F-013 sözleşme §7 — bir belgeyi (gövde/sözleşme/QA raporu) yok/hata/içerik durumlarına göre
 *  gösterir. Markdown render'ı YOK (sözleşme §8, CEO/J5 kararı) — ham metin `<pre>` ile.
 *  QA düzeltme turu K5 (Ö3) — `<pre>` artık KENDİ kaydırma kutusu DEĞİL (`max-h-64
 *  overflow-y-auto` kaldırıldı): tek kaydırma bağlamı modalın dış kabıdır (bkz.
 *  `FeatureDetailModal`'daki yorum) — 254px'lik kutularda 27.922px gizli içerik + 11 iç içe
 *  kaydırma kabı ölçülmüştü. */
function DocumentBlock({
  doc,
  emptyText,
  testId,
}: {
  doc: FeatureDetailDocument
  emptyText: string
  testId: string
}) {
  if (!doc.exists) {
    return (
      <p data-testid={testId} className="text-xs text-zinc-500">
        {emptyText}
      </p>
    )
  }
  if (doc.error) {
    return (
      <p data-testid={testId} role="alert" className="text-xs text-red-400">
        {doc.error}
      </p>
    )
  }
  return (
    <div data-testid={testId}>
      {doc.truncated && <p className="mb-1 text-xs text-amber-400">⚠ {TRUNCATED_NOTICE}</p>}
      <pre className="whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs text-zinc-300">
        {doc.content}
      </pre>
    </div>
  )
}

/**
 * F-007 sözleşme §2.1/AC7 — salt okunur id/title/owner/deps/sprint, focus-trap + `Esc`.
 * F-013 sözleşme §2 — bunun altına gövde/sözleşme/QA raporları eklendi (`GET /api/features/
 * detail`, `useFeatureDetail`).
 * Odak sırası (`docs/03-ux.md` erişilebilirlik notları): açılışta ilk odaklanabilir öğeye
 * (Kapat butonu) odak verilir, `Tab`/`Shift+Tab` modal içinde döner, `Esc` kapatır ve odağı
 * tetikleyen öğeye geri verir (tetikleyene geri verme `KanbanCard`'ın sorumluluğu — bu bileşen
 * yalnızca kapanışı bildirir).
 */
export function FeatureDetailModal({ card, onClose, fetchImpl }: FeatureDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { loadState, detail, errorMessage, lastFetchedAt, refresh } = useFeatureDetail(card, {
    fetchImpl,
  })

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
      // QA düzeltme turu K6 (Ö2) — `<summary>` DOM'da örtük olarak odaklanabilir (`tabindex`
      // ÖZNİTELİĞİ olmadan) ve K5'in eklediği `<details>` bölümlerinin AÇMA/KAPAMA kontrolü
      // budur. Seçiciye eklenmezse bu tuzak, JS'in "ilk/son odaklanabilir öğe" hesabını yanlış
      // yapar (`summary`'leri atlar) ve `Tab` bunlara HİÇ ULAŞAMADAN geri sarar.
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
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
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-lg shadow-black/40"
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

        {loadState === 'ready' && detail && (
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-800 pt-2 text-xs text-zinc-500">
            <span data-testid="feature-detail-last-fetched">
              {lastFetchedAt !== null &&
                `Son yenileme: ${new Date(lastFetchedAt).toLocaleTimeString('tr-TR')}`}
            </span>
            <button
              type="button"
              onClick={refresh}
              data-testid="feature-detail-refresh"
              className="min-h-8 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              Yenile
            </button>
          </div>
        )}

        {/* QA düzeltme turu K5 (Ö3) — TEK kaydırma bağlamı burasıdır (`tabIndex={0}` K6/Ö2:
            klavye odağı alabilsin ki `PageDown`/`ArrowDown` bu kutuyu kaydırsın — eskiden 12
            ayrı kaydırma bölgesinin hiçbiri odaklanamıyordu). Alttaki `<pre>`lerin kendi
            `overflow-y-auto`'su kaldırıldı (`DocumentBlock` yorumu) — iç içe kaydırma yok. */}
        <div
          className="mt-3 flex-1 space-y-3 overflow-y-auto border-t border-zinc-800 pt-3"
          tabIndex={0}
          aria-label="Feature detay içeriği"
        >
          {loadState === 'loading' && (
            <p data-testid="feature-detail-loading" className="text-xs text-zinc-500">
              Yükleniyor…
            </p>
          )}
          {loadState === 'error' && (
            <p data-testid="feature-detail-error" role="alert" className="text-xs text-red-400">
              {errorMessage}
            </p>
          )}
          {loadState === 'ready' && detail && (
            <>
              {/* K5 — bölümler katlanabilir: yalnızca gövde varsayılan AÇIK, geri kalanı KAPALI
                  (CEO kararı K5 madde 1). */}
              <details open>
                <summary className="mb-1 cursor-pointer text-xs font-semibold text-zinc-400">
                  Açıklama
                </summary>
                <DocumentBlock
                  doc={detail.body}
                  emptyText="İçerik bulunamadı."
                  testId="feature-detail-body"
                />
              </details>
              <details>
                <summary className="mb-1 cursor-pointer text-xs font-semibold text-zinc-400">
                  Sözleşme
                </summary>
                <DocumentBlock
                  doc={detail.contract}
                  emptyText="Sözleşme bulunamadı."
                  testId="feature-detail-contract"
                />
              </details>
              <section>
                <h3 className="mb-1 text-xs font-semibold text-zinc-400">QA raporları</h3>
                {detail.qa_reports.length === 0 ? (
                  <p data-testid="feature-detail-qa-reports" className="text-xs text-zinc-500">
                    QA raporu bulunamadı.
                  </p>
                ) : (
                  <div data-testid="feature-detail-qa-reports" className="space-y-2">
                    {detail.qa_reports.map((report: FeatureDetailReport) => (
                      // K5 madde 1 — her QA raporu KENDİ katlanabilir bölümü, varsayılan KAPALI.
                      <details key={report.file} className="rounded-md border border-zinc-800">
                        <summary className="cursor-pointer px-2 py-1 font-mono text-xs text-zinc-500">
                          {report.file}
                        </summary>
                        <div className="p-2">
                          <DocumentBlock
                            doc={report}
                            emptyText="QA raporu bulunamadı."
                            testId={`feature-detail-qa-report-${report.file}`}
                          />
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
