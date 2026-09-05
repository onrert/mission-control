// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../../../../src/features/projects/web/SettingsScreen'
import type { ProjectListItem } from '../../../../src/shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function item(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p_1',
    path: 'C:\\dev\\apps\\demo',
    label: 'demo',
    added_at: new Date().toISOString(),
    enabled: true,
    exists: true,
    feature_count: 3,
    ...overrides,
  }
}

function stubFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    })) as unknown as typeof fetch
  )
}

describe('SettingsScreen', () => {
  it('boş durum: "Henüz izlenen proje yok..." mesajı gösterilir', async () => {
    stubFetchOnce({ success: true, data: [] })
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getByTestId('settings-empty')).toBeTruthy())
  })

  it('yükleniyor iskeleti: fetch çözülmeden önce gösterilir', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve
          })
      ) as unknown as typeof fetch
    )
    render(<SettingsScreen liveUpdate={null} />)
    expect(screen.getByTestId('settings-skeleton')).toBeTruthy()
    resolveFetch({ ok: true, status: 200, json: async () => ({ success: true, data: [] }) })
    await waitFor(() => expect(screen.getByTestId('settings-empty')).toBeTruthy())
  })

  it('liste render: ad/yol/durum/feature sayısı görünür', async () => {
    stubFetchOnce({
      success: true,
      data: [
        item({ id: 'p_1', label: 'app-factory', path: 'C:\\dev\\app-factory', feature_count: 12 }),
        item({
          id: 'p_2',
          label: 'eski-proje',
          path: 'C:\\dev\\eski',
          exists: false,
          feature_count: 0,
        }),
      ],
    })
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getAllByTestId('project-row')).toHaveLength(2))
    expect(screen.getByText('app-factory')).toBeTruthy()
    expect(screen.getByText('C:\\dev\\app-factory')).toBeTruthy()
    expect(screen.getByText('12 feature')).toBeTruthy()
    expect(screen.getByText('izleniyor')).toBeTruthy()
    expect(screen.getByText('yol bulunamadı')).toBeTruthy()
  })

  it('Kaldır tıklama -> fetch DELETE çağrısı + optimistik olmayan state güncellemesi', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { removed: true } }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: [item()] }) }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const user = userEvent.setup()
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getAllByTestId('project-row')).toHaveLength(1))

    await user.click(screen.getByText('Kaldır'))
    await waitFor(() => expect(screen.queryAllByTestId('project-row')).toHaveLength(0))
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p_1', { method: 'DELETE' })
  })

  it('hata durumu: "Liste kaydedilemedi, tekrar deneyin." banner + Tekrar dene', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch
    )
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getByTestId('settings-error-banner')).toBeTruthy())
    expect(screen.getByText('Liste kaydedilemedi, tekrar deneyin.')).toBeTruthy()
    expect(screen.getByText('Tekrar dene')).toBeTruthy()
  })

  it("registry_corrupt:true -> UX'in birebir metniyle banner görünür", async () => {
    stubFetchOnce({ success: true, data: [], registry_corrupt: true })
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getByTestId('registry-corrupt-banner')).toBeTruthy())
    expect(
      screen.getByText('Proje listesi okunamadı, varsayılan boş liste ile başlandı.')
    ).toBeTruthy()
  })

  // QA düzeltme turu 2 (D26) — canlı ölçüm: DELETE 500 dönünce eskiden hiçbir geri bildirim
  // yoktu (`role="alert"` sayısı 0). `docs/03-ux.md` ekran-3 "Hata" metniyle birebir aynı mesaj
  // artık satırda görünür ve satır listeden düşmez.
  it('Kaldır hatası: DELETE 500 dönerse "Liste kaydedilemedi, tekrar deneyin." satırda görünür, satır kalır', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return {
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: { code: 'storage_unavailable', message: 'Liste kaydedilemedi, tekrar deneyin.' },
          }),
        }
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: [item()] }) }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const user = userEvent.setup()
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getAllByTestId('project-row')).toHaveLength(1))

    await user.click(screen.getByText('Kaldır'))

    const alert = await screen.findByTestId('remove-project-error')
    expect(alert.textContent).toContain('Liste kaydedilemedi, tekrar deneyin.')
    // Yazma başarısız oldu — satır kalmalı.
    expect(screen.getAllByTestId('project-row')).toHaveLength(1)
  })

  it('registry_corrupt alanı yokken/false iken banner hiç render edilmez', async () => {
    stubFetchOnce({ success: true, data: [] })
    render(<SettingsScreen liveUpdate={null} />)
    await waitFor(() => expect(screen.getByTestId('settings-empty')).toBeTruthy())
    expect(screen.queryByTestId('registry-corrupt-banner')).toBeNull()
  })
})
