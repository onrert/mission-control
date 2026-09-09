// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThreadScreen } from '../../../../src/features/thread/web/ThreadScreen'
import type { FeatureCard, ProjectListItem, ThreadDetail } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function project(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p1',
    path: 'C:\\dev\\apps\\demo',
    label: 'demo',
    added_at: new Date().toISOString(),
    enabled: true,
    exists: true,
    feature_count: 1,
    ...overrides,
  }
}

function feature(overrides: Partial<FeatureCard> = {}): FeatureCard {
  return {
    project_id: 'p1',
    file: 'F-004-kanban.md',
    id: 'F-004',
    title: 'Kanban paneli',
    status: 'qa',
    column: 'qa',
    owner: 'developer',
    deps: [],
    sprint: '1',
    content_hash: 'abc',
    mtime_ms: Date.now(),
    ...overrides,
  }
}

function detail(overrides: Partial<ThreadDetail> = {}): ThreadDetail {
  return {
    feature_id: 'F-004',
    eskale: false,
    sections: [
      {
        kind: 'ceo_brief',
        title: 'CEO brief',
        timestamp: '2026-09-05T10:02:00.000Z',
        content: 'F-004: kanban sürükle-bırak…',
        readable: true,
      },
      {
        kind: 'developer_report',
        title: 'Developer raporu',
        timestamp: '2026-09-05T14:20:00.000Z',
        content: 'Uygulandı, testler yeşil…',
        readable: true,
      },
      {
        kind: 'qa_verdict',
        title: 'QA kararı: KALDI',
        timestamp: '2026-09-05T15:00:00.000Z',
        content: 'Çakışma senaryosu test edilmemiş…',
        readable: true,
        verdict: 'KALDI',
      },
      {
        kind: 'transcript',
        title: 'Transkript',
        timestamp: null,
        content: null,
        readable: false,
      },
    ],
    ...overrides,
  }
}

interface RouterOptions {
  projects?: ProjectListItem[]
  features?: FeatureCard[]
  detailResponse?: { status: number; body: unknown }
}

function stubRouter(opts: RouterOptions = {}) {
  const projects = opts.projects ?? [project()]
  const features = opts.features ?? [feature()]
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/thread/detail')) {
      const res = opts.detailResponse ?? {
        status: 200,
        body: { success: true, data: detail() },
      }
      return { ok: res.status < 400, status: res.status, json: async () => res.body } as Response
    }
    if (url.includes('/api/features')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: features }),
      } as Response
    }
    if (url.includes('/api/projects')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: projects }),
      } as Response
    }
    throw new Error(`beklenmeyen fetch: ${url}`)
  }) as unknown as typeof fetch
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock }
}

const noop = (): void => {}

async function selectProjectAndFeature(): Promise<void> {
  const user = userEvent.setup()
  const projectSelect = await screen.findByTestId('thread-project-select')
  await user.selectOptions(projectSelect, 'p1')
  const featureSelect = await screen.findByTestId('thread-feature-select')
  await user.selectOptions(featureSelect, 'F-004-kanban.md')
}

describe('ThreadScreen — proje/feature seçilmemiş (§4 boş durum)', () => {
  it('hiç izlenen proje yoksa "Önce bir proje seçin." + Ayarlar\'a git', async () => {
    stubRouter({ projects: [] })
    const onNavigateSettings = vi.fn()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={onNavigateSettings} />)
    await waitFor(() => expect(screen.getByTestId('thread-no-projects')).toBeTruthy())
    await userEvent.setup().click(screen.getByRole('button', { name: "Ayarlar'a git" }))
    expect(onNavigateSettings).toHaveBeenCalledTimes(1)
  })

  it('proje var ama seçilmemiş → "Önce bir proje seçin."', async () => {
    stubRouter()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await screen.findByTestId('thread-project-select')
    expect(screen.getByTestId('thread-empty').textContent).toBe('Önce bir proje seçin.')
  })

  it('proje seçili, feature seçilmemiş → "Bir feature seçin."', async () => {
    stubRouter()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    const user = userEvent.setup()
    const projectSelect = await screen.findByTestId('thread-project-select')
    await user.selectOptions(projectSelect, 'p1')
    expect(screen.getByTestId('thread-empty').textContent).toBe('Bir feature seçin.')
  })
})

describe('ThreadScreen — kronolojik bölüm listesi (AC1)', () => {
  it('CEO brief → Developer raporu → QA kararı → Transkript sırasıyla render edilir', async () => {
    stubRouter()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-sections')).toBeTruthy())

    const sections = screen.getByTestId('thread-sections')
    const kinds = Array.from(sections.children).map((el) => el.getAttribute('data-testid'))
    expect(kinds).toEqual([
      'thread-section-ceo_brief',
      'thread-section-developer_report',
      'thread-section-qa_verdict',
      'thread-section-transcript',
    ])
    expect(screen.getByTestId('thread-section-qa_verdict').textContent).toContain(
      'QA kararı: KALDI'
    )
  })

  it('sözleşme/QA kaydı yoksa (yalnızca CEO brief) uyarı notu gösterilir', async () => {
    stubRouter({
      detailResponse: {
        status: 200,
        body: {
          success: true,
          data: detail({
            sections: [
              {
                kind: 'ceo_brief',
                title: 'CEO brief',
                timestamp: '2026-09-05T10:02:00.000Z',
                content: 'F-004: kanban sürükle-bırak…',
                readable: true,
              },
            ],
          }),
        },
      },
    })
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-no-qa-note')).toBeTruthy())
  })
})

describe('ThreadScreen — okunamayan bölüm (AC2/AC3)', () => {
  it('readable:false bölüm "Bu bölüm okunamadı." gösterir, ham içerik SIZMAZ', async () => {
    stubRouter()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-section-transcript')).toBeTruthy())
    const transcriptCard = screen.getByTestId('thread-section-transcript')
    expect(transcriptCard.textContent).toBe('Bu bölüm okunamadı.')
    // X4/D2 — `docs/03-ux.md` akış (g): üzerine gelince kısa açıklama (`title` özniteliği).
    // Eskiden hiçbir test bunu ÖLÇMÜYORDU (M8 mutasyonu — `title` kaldırılınca 1210/1210 yeşil
    // kalıyordu, QA ölçtü). Bu assert olmadan bir regresyon fark edilmeden geçebilir.
    expect(transcriptCard.getAttribute('title')).toBe('Transkript formatı tanınmadı veya bozuk.')
    // Diğer bölümler etkilenmedi — normal render devam ediyor (W4).
    expect(screen.getByTestId('thread-section-ceo_brief')).toBeTruthy()
  })
})

describe('ThreadScreen — ESKALE rozeti (AC4/W6)', () => {
  it('eskale:true iken üstte sabit banner gösterilir', async () => {
    stubRouter({
      detailResponse: {
        status: 200,
        body: { success: true, data: detail({ eskale: true }) },
      },
    })
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-eskale-banner')).toBeTruthy())
    expect(screen.getByTestId('thread-eskale-banner').textContent).toContain(
      'ESKALE: QA turu sınırı aşıldı, kullanıcıya iletildi.'
    )
  })

  it('eskale:false iken banner YOK', async () => {
    stubRouter()
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-sections')).toBeTruthy())
    expect(screen.queryByTestId('thread-eskale-banner')).toBeNull()
  })
})

describe('ThreadScreen — hata durumu (W5: ham hata sızmaz)', () => {
  it('GET /api/thread/detail 500 → sabit hata metni + Tekrar dene, stack trace YOK', async () => {
    stubRouter({
      detailResponse: {
        status: 500,
        body: { success: false, error: { code: 'internal', message: 'Thread yüklenemedi.' } },
      },
    })
    render(<ThreadScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await selectProjectAndFeature()
    await waitFor(() => expect(screen.getByTestId('thread-error-banner')).toBeTruthy())
    const banner = screen.getByTestId('thread-error-banner')
    expect(banner.textContent).toContain('Thread yüklenemedi.')
    expect(banner.textContent).not.toMatch(/at\s+\w+\s+\(/) // stack trace deseni yok
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeTruthy()
  })
})
