// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KanbanScreen } from '../../../../src/features/kanban/web/KanbanScreen'
import type { FeatureCard, ProjectListItem } from '../../../../src/shared/types'

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

function card(overrides: Partial<FeatureCard> = {}): FeatureCard {
  return {
    project_id: 'p1',
    file: 'F-001.md',
    id: 'F-001',
    title: 'Başlık F-001',
    status: 'dev',
    column: 'dev',
    owner: 'developer',
    deps: ['F-000'],
    sprint: '1',
    content_hash: 'hash-1',
    mtime_ms: 1000,
    ...overrides,
  }
}

/** `useProjects`/`useFeatures` App seviyesinde `fetchImpl` almıyor, çıplak `fetch`/`writeFetch`
 *  çağırıyor — tek bir global `fetch` router'ı her iki uca da (URL'ye göre) yanıt verir. */
function stubRouter(opts: {
  projects?: ProjectListItem[]
  cards?: FeatureCard[]
  unreadableProjects?: Array<{ project_id: string; label: string }>
}): void {
  const projects = opts.projects ?? [project()]
  const cards = opts.cards ?? [card()]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/projects')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: projects }),
        } as unknown as Response
      }
      if (url.includes('/api/features')) {
        const body: { success: true; data: FeatureCard[]; meta?: unknown } = {
          success: true,
          data: cards,
        }
        if (opts.unreadableProjects) {
          body.meta = { unreadable_projects: opts.unreadableProjects }
        }
        return { ok: true, status: 200, json: async () => body } as unknown as Response
      }
      throw new Error(`beklenmeyen fetch: ${url}`)
    }) as unknown as typeof fetch
  )
}

async function flush(): Promise<void> {
  // dnd-kit'in `KeyboardSensor`'ü aktivasyon SONRASI `document` seviyesindeki keydown
  // dinleyicisini `setTimeout(fn)` (0ms makro-görev) ile ekliyor (core.cjs.development.js
  // `attach()`) — yalnızca mikro-görev (`Promise.resolve()`) beklemek yetmez, gerçek bir
  // zamanlayıcı turu (`setTimeout`) geçmesi gerekir, aksi hâlde sürükleme AKTİFKEN gönderilen
  // sonraki tuşlar (Escape/Enter/ok tuşları) sessizce yok sayılır.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const noop = (): void => {}

describe('KanbanScreen — AC10 (sütun başlığı "Etiket (kod)") + AC1/AC6 (durum→sütun)', () => {
  it('bilinen durum kartı doğru sütunda, başlık "Geliştirme (dev)" biçiminde', async () => {
    stubRouter({ cards: [card({ status: 'dev', column: 'dev' })] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const column = screen.getByTestId('kanban-column-dev')
    expect(column.textContent).toContain('Geliştirme (dev)')
    expect(column.contains(screen.getByTestId('kanban-card-F-001.md'))).toBe(true)
  })

  it('mutasyon 17 emsali: başlık yalnızca label olsaydı bu test KIRMIZI verirdi (biçim "(kod)" içerir)', async () => {
    stubRouter({})
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-column-todo')).toBeTruthy())
    expect(screen.getByTestId('kanban-column-todo').textContent).toContain('Yapılacak (todo)')
  })

  it('AC6: tanımsız status "Bilinmeyen durum" sütununda görünür, kesikli kenarlıklı', async () => {
    stubRouter({ cards: [card({ status: 'weird', column: 'unknown' })] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const unknownColumn = screen.getByTestId('kanban-column-unknown')
    expect(unknownColumn.textContent).toContain('Bilinmeyen durum')
    expect(unknownColumn.className).toContain('border-dashed')
    expect(unknownColumn.contains(screen.getByTestId('kanban-card-F-001.md'))).toBe(true)
  })

  it('hiçbir kart "unknown" değilse "Bilinmeyen durum" sütunu hiç render edilmez', async () => {
    stubRouter({ cards: [card({ status: 'dev', column: 'dev' })] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    expect(screen.queryByTestId('kanban-column-unknown')).toBeNull()
  })
})

describe('KanbanScreen — AC7 (karta tıkla → salt okunur detay modalı)', () => {
  it('tıklama modalı açar; id/title/owner/deps/sprint görünür; Esc kapatır', async () => {
    stubRouter({ cards: [card()] })
    const user = userEvent.setup()
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())

    await user.click(screen.getByTestId('kanban-card-F-001.md'))
    const modal = screen.getByTestId('feature-detail-modal')
    expect(modal.textContent).toContain('F-001')
    expect(modal.textContent).toContain('Başlık F-001')
    expect(modal.textContent).toContain('developer')
    expect(modal.textContent).toContain('F-000')
    expect(modal.textContent).toContain('1')

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('feature-detail-modal')).toBeNull()
  })

  it('mutasyon 16 emsali: deps/sprint alanlarından biri eksik olsaydı bu assert KIRMIZI verirdi', async () => {
    stubRouter({ cards: [card({ deps: ['F-042'], sprint: '3' })] })
    const user = userEvent.setup()
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    await user.click(screen.getByTestId('kanban-card-F-001.md'))
    const modal = screen.getByTestId('feature-detail-modal')
    expect(modal.textContent).toContain('F-042')
    expect(modal.textContent).toContain('3')
  })
})

describe('KanbanScreen — D1-D6 durum tasarımı (QA tur 1 bulgu 12)', () => {
  it('D1: proje var ama hiç kart yok → boş durum + "Ayarlar\'a git" aksiyonu', async () => {
    stubRouter({ projects: [project()], cards: [] })
    const onNavigateSettings = vi.fn()
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={onNavigateSettings}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-empty')).toBeTruthy())
    await userEvent.setup().click(screen.getByText("Ayarlar'a git"))
    expect(onNavigateSettings).toHaveBeenCalledTimes(1)
  })

  it('D1: hiç izlenen proje yok → aynı boş durum', async () => {
    stubRouter({ projects: [], cards: [] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-empty')).toBeTruthy())
  })

  it('D2: yükleme sırasında sütun iskeletleri görünür (fetch çözülmeden önce)', async () => {
    let resolveFeatures: (v: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/projects')) {
          return { ok: true, status: 200, json: async () => ({ success: true, data: [project()] }) }
        }
        return new Promise((resolve) => {
          resolveFeatures = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ success: true, data: [card()] }),
            })
        })
      }) as unknown as typeof fetch
    )
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-column-todo')).toBeTruthy())
    expect(screen.getByTestId('kanban-column-todo').querySelector('.animate-pulse')).toBeTruthy()
    resolveFeatures(null)
    await waitFor(() =>
      expect(screen.getByTestId('kanban-column-todo').querySelector('.animate-pulse')).toBeNull()
    )
  })

  it('D3: proje bazlı "dosyalar okunamadı" banner\'ı — diğer proje etkilenmez', async () => {
    stubRouter({
      cards: [card()],
      unreadableProjects: [{ project_id: 'p2', label: 'bozuk-proje' }],
    })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-unreadable-p2')).toBeTruthy())
    expect(screen.getByTestId('kanban-unreadable-p2').textContent).toContain('bozuk-proje')
    expect(screen.getByTestId('kanban-unreadable-p2').textContent).toContain('okunamadı')
    // Diğer proje kartı hâlâ normal render edilir.
    expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy()
  })

  it('D4: ayrıştırılamayan dosyalar ayrı listede, sürüklenemez alanda görünür', async () => {
    stubRouter({
      cards: [card({ parse_error: 'Frontmatter bulunamadı.' })],
    })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-unparsable')).toBeTruthy())
    expect(screen.getByTestId('kanban-unparsable').textContent).toContain(
      'Ayrıştırılamayan dosyalar (1)'
    )
    expect(screen.getByTestId('kanban-unparsable-F-001.md')).toBeTruthy()
    // Ayrıştırılamayan kart normal sütunlarda GÖRÜNMEZ (sürüklenemez alanda kalır).
    expect(screen.queryByTestId('kanban-card-F-001.md')).toBeNull()
  })

  it('D5: bağlantı koptu → amber banner + Yenile düğmesi retry tetikler', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="disconnected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-connection-lost-banner')).toBeTruthy())
    expect(screen.getByTestId('kanban-connection-lost-banner').textContent).toContain(
      'Canlı senkron durdu'
    )
    const fetchSpy = vi.mocked(fetch)
    const callsBefore = fetchSpy.mock.calls.length
    await userEvent.setup().click(screen.getByText('Yenile'))
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('D6: "Son senkron: N sn önce" alt bilgi çubuğu ilk yüklemeden sonra görünür', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-last-synced')).toBeTruthy())
    expect(screen.getByTestId('kanban-last-synced').textContent).toContain('Son senkron:')
  })
})

describe('KanbanScreen — erişilebilirlik: dnd-kit assertive bölge her zaman boş, kendi polite bölgemiz Türkçe (D44/NOT-2)', () => {
  it('sayfada aria-live="assertive" bölgenin içeriği sürükleme başladıktan sonra da boş kalır', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    fireEvent.keyDown(cardEl, { key: ' ', code: 'Space' })
    await flush()
    const assertiveRegion = document.querySelector('[aria-live="assertive"]')
    expect(assertiveRegion?.textContent ?? '').toBe('')
  })

  it('kendi aria-live="polite" bölgemiz sürükleme başlayınca Türkçe metinle güncellenir', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    fireEvent.keyDown(cardEl, { key: ' ', code: 'Space' })
    await flush()
    const politeRegion = screen.getByTestId('kanban-screen').querySelector('[aria-live="polite"]')
    expect(politeRegion?.textContent).toContain('F-001 kartı seçildi')
  })

  it('kart aria-describedby Türkçe yönerge taşır ("Boşluk"/"Enter" içerir, "space bar" İngilizcesini İÇERMEZ), aria-roledescription "kart"tır', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    expect(cardEl.getAttribute('aria-roledescription')).toBe('kart')
    const describedById = cardEl.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    const describedByEl = document.getElementById(describedById as string)
    expect(describedByEl?.textContent).toContain('Boşluk')
    expect(describedByEl?.textContent).not.toContain('space bar')
  })
})

describe('KanbanScreen — YENİ-R1 tek tuş tasarımı (boşta Enter=modal, Boşluk=sürükle başlat, sürüklerken Enter=modal AÇMAZ)', () => {
  it('(a) boşta Enter → modal açılır, sürükleme başlamaz (assertive bölge boş kalır)', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    fireEvent.keyDown(cardEl, { key: 'Enter', code: 'Enter' })
    await flush()
    expect(screen.getByTestId('feature-detail-modal')).toBeTruthy()
    const politeRegion = screen.getByTestId('kanban-screen').querySelector('[aria-live="polite"]')
    expect(politeRegion?.textContent).toBe('')
  })

  it('(b) Boşluk → sürükleme moduna girer (modal açılmaz)', async () => {
    stubRouter({ cards: [card()] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    fireEvent.keyDown(cardEl, { key: ' ', code: 'Space' })
    await flush()
    expect(screen.queryByTestId('feature-detail-modal')).toBeNull()
    const politeRegion = screen.getByTestId('kanban-screen').querySelector('[aria-live="polite"]')
    expect(politeRegion?.textContent).toContain('kartı seçildi')
  })

  it('(c) sürükleme aktifken Enter → modal açmaz, sürüklemeyi onaylar (İptal ile karşılaştırma: Escape modal açmadan iptal eder)', async () => {
    stubRouter({ cards: [card({ status: 'dev', column: 'dev' })] })
    render(
      <KanbanScreen
        liveProjectsUpdate={null}
        featuresSignal={null}
        connectionStatus="connected"
        onNavigateSettings={noop}
      />
    )
    await waitFor(() => expect(screen.getByTestId('kanban-card-F-001.md')).toBeTruthy())
    const cardEl = screen.getByTestId('kanban-card-F-001.md')
    fireEvent.keyDown(cardEl, { key: ' ', code: 'Space' })
    await flush()
    fireEvent.keyDown(cardEl, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByTestId('feature-detail-modal')).toBeNull()
    await waitFor(() => {
      const politeRegion = screen.getByTestId('kanban-screen').querySelector('[aria-live="polite"]')
      expect(politeRegion?.textContent).toBe('İptal edildi')
    })
  })
})
