// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GatesScreen } from '../../../../src/features/gates/web/GatesScreen'
import type {
  GateStatusItem,
  GatesListResponse,
  ProjectListItem,
} from '../../../../src/shared/types'

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

function gate(overrides: Partial<GateStatusItem> = {}): GateStatusItem {
  return { id: 'G2', label: 'Mimari', status: 'pending', ...overrides }
}

interface RouterOptions {
  projects?: ProjectListItem[]
  gates?: GateStatusItem[]
  unrecognized?: string[]
  processDocReadable?: boolean
  postResponse?: { status: number; body: unknown }
}

function stubRouter(opts: RouterOptions = {}) {
  const projects = opts.projects ?? [project()]
  const gates = opts.gates ?? [gate()]
  const gatesBody: { success: true; data: GatesListResponse } = {
    success: true,
    data: {
      gates,
      unrecognized: opts.unrecognized ?? [],
      process_doc_readable: opts.processDocReadable ?? true,
    },
  }
  const postCalls: Array<{ url: string; body: unknown }> = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (method === 'POST') {
      postCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const res = opts.postResponse ?? { status: 200, body: { success: true, data: gate() } }
      return {
        ok: res.status < 400,
        status: res.status,
        json: async () => res.body,
      } as unknown as Response
    }
    if (url.includes('/api/gates')) {
      return { ok: true, status: 200, json: async () => gatesBody } as unknown as Response
    }
    if (url.includes('/api/projects')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: projects }),
      } as unknown as Response
    }
    throw new Error(`beklenmeyen fetch: ${method} ${url}`)
  }) as unknown as typeof fetch
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, postCalls }
}

const noop = (): void => {}

async function selectProject(): Promise<void> {
  const user = userEvent.setup()
  const select = await screen.findByTestId('gates-project-select')
  await user.selectOptions(select, 'p1')
}

describe('GatesScreen — proje seçilmemiş (§3 boş durum)', () => {
  it('"Önce bir proje seçin." gösterilir, kapı tablosu YOK', async () => {
    stubRouter()
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await screen.findByTestId('gates-project-select')
    expect(screen.getByTestId('gates-empty').textContent).toContain('Önce bir proje seçin.')
    expect(screen.queryByTestId('gates-table')).toBeNull()
  })

  it('hiç izlenen proje yoksa "Ayarlar\'a git" butonu gösterilir', async () => {
    stubRouter({ projects: [] })
    const onNavigateSettings = vi.fn()
    render(
      <GatesScreen
        liveProjectsUpdate={null}
        gatesSignal={null}
        onNavigateSettings={onNavigateSettings}
      />
    )
    await waitFor(() => expect(screen.getByTestId('gates-no-projects')).toBeTruthy())
    await userEvent.setup().click(screen.getByRole('button', { name: "Ayarlar'a git" }))
    expect(onNavigateSettings).toHaveBeenCalledTimes(1)
  })
})

describe('GatesScreen — dört durumlu aksiyon sütunu (§4)', () => {
  it('pending: [Onayla] [Reddet] ikisi de var', async () => {
    stubRouter({ gates: [gate({ id: 'G2', status: 'pending' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-row-G2')).toBeTruthy())
    expect(screen.getByTestId('gate-approve-G2')).toBeTruthy()
    expect(screen.getByTestId('gate-deny-G2')).toBeTruthy()
  })

  it('approved: (kilitli), Reddet YOK, Onayla YOK', async () => {
    stubRouter({ gates: [gate({ id: 'G0', status: 'approved', ok_date: '2026-09-04' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-row-G0')).toBeTruthy())
    expect(screen.getByTestId('gate-locked-G0').textContent).toBe('(kilitli)')
    expect(screen.queryByTestId('gate-deny-G0')).toBeNull()
    expect(screen.queryByTestId('gate-approve-G0')).toBeNull()
    const row = screen.getByTestId('gate-row-G0')
    expect(within(row).getByText('2026-09-04')).toBeTruthy()
  })

  it('denied: yalnızca [Onayla] var', async () => {
    stubRouter({ gates: [gate({ id: 'ASSETS', status: 'denied', deny_date: '2026-09-02' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-row-ASSETS')).toBeTruthy())
    expect(screen.getByTestId('gate-approve-ASSETS')).toBeTruthy()
    expect(screen.queryByTestId('gate-deny-ASSETS')).toBeNull()
  })

  it('conflict: yalnızca [Detay] var; tıklanınca genişleyen salt-okunur alt satır açılır', async () => {
    stubRouter({
      gates: [
        gate({
          id: 'G4-1',
          status: 'conflict',
          ok_date: '2026-09-05',
          deny_date: '2026-09-06',
          newer_side: 'deny',
        }),
      ],
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-row-G4-1')).toBeTruthy())
    expect(screen.queryByTestId('gate-approve-G4-1')).toBeNull()
    expect(screen.queryByTestId('gate-deny-G4-1')).toBeNull()
    expect(screen.queryByTestId('gate-detail-row-G4-1')).toBeNull()

    await userEvent.setup().click(screen.getByTestId('gate-detail-G4-1'))
    const detail = screen.getByTestId('gate-detail-row-G4-1')
    expect(detail.textContent).toContain('daha yeni')
    expect(detail.textContent).toContain(
      'Bu durum panelden düzeltilemez; dosyaları docs/approvals/ altında elle inceleyin.'
    )
  })

  it('satır hatası (error:true): "Durum belirlenemedi" gri, aksiyon yok', async () => {
    stubRouter({ gates: [{ id: 'G3', label: 'UX', status: 'pending', error: true }] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-row-G3')).toBeTruthy())
    expect(screen.getByTestId('gate-row-G3').textContent).toContain('Durum belirlenemedi')
    expect(screen.queryByTestId('gate-approve-G3')).toBeNull()
    expect(screen.queryByTestId('gate-deny-G3')).toBeNull()
  })
})

describe("GatesScreen — durum banner'ları", () => {
  it('unrecognized dosyalar bildirilir', async () => {
    stubRouter({ unrecognized: ['g2.ok', 'notlar.txt'] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gates-unrecognized')).toBeTruthy())
    expect(screen.getByTestId('gates-unrecognized').textContent).toBe(
      'Tanınmayan dosyalar: g2.ok, notlar.txt'
    )
  })

  it('process_doc_readable:false → uyarı gösterilir', async () => {
    stubRouter({ processDocReadable: false })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gates-process-doc-unreadable')).toBeTruthy())
    expect(screen.getByTestId('gates-process-doc-unreadable').textContent).toBe(
      'PROCESS.md okunamadı, varsayılan adlar gösteriliyor.'
    )
  })

  it('GET /api/gates başarısız → hata banner + Tekrar dene', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/projects')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: [project()] }),
          } as unknown as Response
        }
        throw new Error('boom')
      }) as unknown as typeof fetch
    )
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gates-error-banner')).toBeTruthy())
    expect(screen.getByTestId('gates-error-banner').textContent).toContain(
      'Kapı durumları okunamadı.'
    )
  })
})

describe('GatesScreen — onay akışı (AC7 iki adım, iptal yazmaz)', () => {
  it('Onayla → modal açılır; İptal → modal kapanır, HİÇ POST çağrısı olmaz', async () => {
    const { postCalls } = stubRouter({ gates: [gate({ id: 'G2', status: 'pending' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-approve-G2')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-approve-G2'))
    const modal = await screen.findByTestId('approve-modal')
    expect(within(modal).getByTestId('approve-preview').textContent).toContain(
      'G2 — Mimari kapısı ONAYLANDI'
    )

    await user.click(screen.getByTestId('approve-cancel-button'))
    expect(screen.queryByTestId('approve-modal')).toBeNull()
    expect(postCalls).toHaveLength(0)
  })

  it('karar metni boşken "Onayı Yaz →" devre dışı, yazınca aktifleşir (Ö11)', async () => {
    stubRouter({ gates: [gate({ id: 'G2', status: 'pending' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-approve-G2')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-approve-G2'))
    const confirmButton = await screen.findByTestId('approve-confirm-button')
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByTestId('approve-decision-input'), 'onaylıyorum')
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('Onayı Yaz → başarılı → toast gösterilir, satır Onaylandı olur, modal kapanır', async () => {
    stubRouter({
      gates: [gate({ id: 'G2', status: 'pending' })],
      postResponse: {
        status: 200,
        body: {
          success: true,
          data: gate({ id: 'G2', status: 'approved', ok_date: '2026-09-09' }),
        },
      },
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-approve-G2')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-approve-G2'))
    await user.type(await screen.findByTestId('approve-decision-input'), 'onaylıyorum')
    await user.click(screen.getByTestId('approve-confirm-button'))

    await waitFor(() => expect(screen.queryByTestId('approve-modal')).toBeNull())
    expect(screen.getByTestId('gates-toast').textContent).toBe('docs/approvals/G2.ok yazıldı')
    expect(screen.getByTestId('gate-locked-G2').textContent).toBe('(kilitli)')
  })

  it('yazma hatası → modal KAPANMAZ, hata satır içi gösterilir, karar metni KORUNUR (AC5)', async () => {
    stubRouter({
      gates: [gate({ id: 'G2', status: 'pending' })],
      postResponse: {
        status: 500,
        body: {
          success: false,
          error: { code: 'write_failed', message: 'Kaydedilemedi, tekrar deneyin.' },
        },
      },
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-approve-G2')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-approve-G2'))
    await user.type(await screen.findByTestId('approve-decision-input'), 'onaylıyorum')
    await user.click(screen.getByTestId('approve-confirm-button'))

    await waitFor(() => expect(screen.getByTestId('approve-error')).toBeTruthy())
    expect(screen.getByTestId('approve-modal')).toBeTruthy()
    expect((screen.getByTestId('approve-decision-input') as HTMLTextAreaElement).value).toBe(
      'onaylıyorum'
    )
    expect((screen.getByTestId('approve-confirm-button') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('GatesScreen — red akışı (AC3/AC8)', () => {
  it('Reddet → satır içi form açılır; İptal → form kapanır, HİÇ POST çağrısı olmaz', async () => {
    const { postCalls } = stubRouter({
      gates: [gate({ id: 'G3', label: 'UX', status: 'pending' })],
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-deny-G3')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-deny-G3'))
    expect(await screen.findByTestId('deny-inline-form')).toBeTruthy()

    await user.click(screen.getByTestId('deny-cancel-button'))
    expect(screen.queryByTestId('deny-inline-form')).toBeNull()
    expect(postCalls).toHaveLength(0)
  })

  it('gerekçe boşken "Reddet - Kaydet" devre dışı (Ö11)', async () => {
    stubRouter({ gates: [gate({ id: 'G3', status: 'pending' })] })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-deny-G3')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-deny-G3'))
    const submitButton = await screen.findByTestId('deny-submit-button')
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByTestId('deny-reason-input'), 'bütçe yetersiz')
    expect((submitButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('kaydet başarılı → toast gösterilir, satır Reddedildi olur, form kapanır', async () => {
    stubRouter({
      gates: [gate({ id: 'G3', status: 'pending' })],
      postResponse: {
        status: 200,
        body: {
          success: true,
          data: gate({ id: 'G3', status: 'denied', deny_date: '2026-09-09' }),
        },
      },
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-deny-G3')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-deny-G3'))
    await user.type(await screen.findByTestId('deny-reason-input'), 'bütçe yetersiz')
    await user.click(screen.getByTestId('deny-submit-button'))

    await waitFor(() => expect(screen.queryByTestId('deny-inline-form')).toBeNull())
    expect(screen.getByTestId('gates-toast').textContent).toBe('docs/approvals/G3.deny.md yazıldı')
    expect(screen.getByTestId('gate-approve-G3')).toBeTruthy()
  })

  it('B6: onaylı kapıda 409 conflict → form KAPANMAZ, hata satır içi gösterilir, gerekçe KORUNUR', async () => {
    stubRouter({
      gates: [gate({ id: 'G1', status: 'pending' })],
      postResponse: {
        status: 409,
        body: {
          success: false,
          error: { code: 'conflict', message: 'Bu kapı zaten onaylı, reddedilemez.' },
          data: gate({ id: 'G1', status: 'approved', ok_date: '2026-09-09' }),
        },
      },
    })
    render(<GatesScreen liveProjectsUpdate={null} gatesSignal={null} onNavigateSettings={noop} />)
    await selectProject()
    await waitFor(() => expect(screen.getByTestId('gate-deny-G1')).toBeTruthy())

    const user = userEvent.setup()
    await user.click(screen.getByTestId('gate-deny-G1'))
    await user.type(await screen.findByTestId('deny-reason-input'), 'reddediyorum')
    await user.click(screen.getByTestId('deny-submit-button'))

    await waitFor(() => expect(screen.getByTestId('deny-error')).toBeTruthy())
    expect(screen.getByTestId('deny-error').textContent).toBe('Bu kapı zaten onaylı, reddedilemez.')
    expect((screen.getByTestId('deny-reason-input') as HTMLTextAreaElement).value).toBe(
      'reddediyorum'
    )
  })
})
