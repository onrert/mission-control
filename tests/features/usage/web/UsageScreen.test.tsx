// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsageScreen } from '../../../../src/features/usage/web/UsageScreen'
import type { ProjectListItem, UsageReport } from '../../../../src/shared/types'

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

function emptyUsage() {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
}

function report(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    projects: [],
    usage: emptyUsage(),
    lines_ok: 0,
    lines_bad: 0,
    unknown_type_lines: 0,
    unreadable_file_count: 0,
    truncated_file_count: 0,
    degraded: false,
    source_unreadable: false,
    ...overrides,
  }
}

interface RouterOptions {
  projects?: ProjectListItem[]
  usageResponse?: { status: number; body: unknown }
}

function stubRouter(opts: RouterOptions = {}) {
  const projects = opts.projects ?? [project()]
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/usage')) {
      const res = opts.usageResponse ?? { status: 200, body: { success: true, data: report() } }
      return { ok: res.status < 400, status: res.status, json: async () => res.body } as Response
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

describe('UsageScreen — yükleniyor/hata/okunamadı/boş durumlar', () => {
  it('yükleniyor iskeleti gösterilir', async () => {
    let resolveUsage: (v: unknown) => void = () => {}
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/usage')) {
        return new Promise((resolve) => {
          resolveUsage = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: report() }),
            })
        })
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [project()] }),
      } as Response
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    expect(await screen.findByTestId('usage-skeleton')).toBeTruthy()
    resolveUsage({})
    await waitFor(() => expect(screen.queryByTestId('usage-skeleton')).toBeNull())
  })

  it("/api/usage hata dönerse hata banner'ı + Tekrar dene gösterilir", async () => {
    stubRouter({
      usageResponse: {
        status: 500,
        body: { success: false, error: { code: 'internal_error', message: 'sunucu hatası' } },
      },
    })
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    const banner = await screen.findByTestId('usage-error-banner')
    expect(within(banner).getByText('sunucu hatası')).toBeTruthy()
  })

  it('source_unreadable:true iken "okunamadı" mesajı gösterilir, tablo YOK', async () => {
    stubRouter({
      usageResponse: {
        status: 200,
        body: { success: true, data: report({ source_unreadable: true }) },
      },
    })
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    expect(await screen.findByTestId('usage-unreadable')).toHaveProperty(
      'textContent',
      'Token verisi okunamadı (kaynak dosya bulunamadı veya format tanınmıyor).'
    )
    expect(screen.queryByTestId('usage-rows')).toBeNull()
  })

  it('hiç izlenen proje yoksa "Henüz token verisi yok." + Ayarlar\'a git butonu', async () => {
    stubRouter({ projects: [] })
    const onNavigateSettings = vi.fn()
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={onNavigateSettings} />)
    await screen.findByTestId('usage-empty')
    expect(screen.getByText('Henüz token verisi yok.')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: "Ayarlar'a git" }))
    expect(onNavigateSettings).toHaveBeenCalledTimes(1)
  })

  it('proje izleniyor ama hiç token verisi yoksa yalnızca boş mesaj gösterilir, buton YOK', async () => {
    stubRouter()
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await screen.findByTestId('usage-empty')
    expect(screen.queryByRole('button', { name: "Ayarlar'a git" })).toBeNull()
  })
})

describe('UsageScreen — Y4/Y5: tablo, doğru sayılar, degraded uyarısı', () => {
  function fullReport(): UsageReport {
    return report({
      usage: {
        input_tokens: 15,
        output_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      lines_ok: 90,
      lines_bad: 10,
      degraded: true,
      projects: [
        {
          project_id: 'p1',
          project_label: 'demo',
          usage: {
            input_tokens: 15,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          days: [
            {
              day: '2026-09-04',
              usage: {
                input_tokens: 15,
                output_tokens: 5,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
              sessions: [
                {
                  session_id: 'session-abc-123',
                  usage: {
                    input_tokens: 15,
                    output_tokens: 5,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                  },
                  agents: [
                    {
                      agent: 'ana oturum',
                      usage: {
                        input_tokens: 10,
                        output_tokens: 3,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0,
                      },
                    },
                    {
                      agent: 'developer',
                      usage: {
                        input_tokens: 5,
                        output_tokens: 2,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
  }

  it('proje/gün satırı doğru sayıları gösterir, genişletilince oturum × agent kırılımı görünür', async () => {
    stubRouter({ usageResponse: { status: 200, body: { success: true, data: fullReport() } } })
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await screen.findByTestId('usage-rows')

    expect(screen.getByTestId('usage-row-project').textContent).toBe('demo')
    expect(screen.getByTestId('usage-row-day').textContent).toBe('2026-09-04')
    expect(screen.getByTestId('usage-row-input').textContent).toBe('15')
    expect(screen.getByTestId('usage-row-output').textContent).toBe('5')
    expect(screen.getByTestId('usage-grand-total').textContent).toBe('Toplam: 20 token')

    const user = userEvent.setup()
    await user.click(screen.getByTestId('usage-row-project'))
    const agentRows = screen.getAllByTestId('usage-session-agent-row')
    expect(agentRows).toHaveLength(2)
    // `session-abc-123`'ün ilk 8 karakteri: `session-` (kısa oturum id'si).
    expect(agentRows[0]!.textContent).toContain('Oturum session-')
    expect(agentRows[0]!.textContent).toContain('ana oturum')
    expect(agentRows[0]!.textContent).toContain('giriş 10')
    expect(agentRows[1]!.textContent).toContain('developer')
    expect(agentRows[1]!.textContent).toContain('giriş 5')
  })

  it('degraded:true iken uyarı satırı görünür (Y5 — sessiz kısmi başarı yok)', async () => {
    stubRouter({ usageResponse: { status: 200, body: { success: true, data: fullReport() } } })
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    const warning = await screen.findByTestId('usage-degraded-warning')
    expect(warning.textContent).toContain('veri eksik olabilir')
    expect(warning.textContent).toContain('100')
    expect(warning.textContent).toContain('10')
  })

  it('degraded:false iken uyarı satırı GÖRÜNMEZ', async () => {
    const clean = fullReport()
    clean.degraded = false
    stubRouter({ usageResponse: { status: 200, body: { success: true, data: clean } } })
    render(<UsageScreen liveProjectsUpdate={null} onNavigateSettings={noop} />)
    await screen.findByTestId('usage-rows')
    expect(screen.queryByTestId('usage-degraded-warning')).toBeNull()
  })
})
