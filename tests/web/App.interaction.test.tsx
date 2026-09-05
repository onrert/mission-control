// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import App from '../../src/web/App'
import { FakeEventSource } from '../helpers/fake-event-source'

afterEach(() => cleanup())

// App.tsx `useEventStream`'i `window.EventSource`/gerçek `fetch` ile çağırır — bu testte
// gerçek ağ isteği yapılmasın diye global `fetch`'i sahteleriz ve `window.EventSource`'u
// `FakeEventSource` ile değiştiririz (F-003 sözleşmesi §6 "Enjekte edilebilirlik notu" App
// seviyesinde `EventSourceImpl` prop'u almadığı için burada global override gerekir).
function stubGlobals() {
  const originalFetch = window.fetch
  const originalEventSource = (window as unknown as { EventSource: unknown }).EventSource
  window.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: [] }),
  })) as unknown as typeof fetch
  ;(window as unknown as { EventSource: unknown }).EventSource = FakeEventSource
  return () => {
    window.fetch = originalFetch
    ;(window as unknown as { EventSource: unknown }).EventSource = originalEventSource
  }
}

describe('App.interaction — TimelineScreen koşulsuz mount (YENİ-1/Bulgu 4/12)', () => {
  it('App mount olur olmaz, hiçbir kullanıcı eylemi olmadan TimelineScreen render edilir', async () => {
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByTestId('timeline-screen')).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('App-seviyesi re-render (bağlantı durumu değişimi) TimelineScreen unmount etmez, filtre state korunur', async () => {
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })

      // Bir proje çipini kapatarak yerel filtre state'i oluşturmak için önce en az bir olay
      // gerekir — App seviyesinde events boş kalabilir (fetch [] döner), bu yüzden filtre
      // grubu render edilmeyebilir. Bunun yerine kimlik sürekliliğini DOM node referansı
      // üzerinden kanıtlıyoruz: bağlantı durumu değişse bile aynı `timeline-screen` node'u
      // DOM'da kalmalı (unmount/remount olsaydı yeni bir node oluşurdu — referans testi
      // React'in `key`/component identity'sini dolaylı kanıtlar).
      const before = screen.getByTestId('timeline-screen')

      const es = FakeEventSource.instances[0]!
      act(() => {
        es.dispatch('open')
      })
      expect(screen.getByTestId('connection-badge-shell').textContent).toContain('Bağlı')

      const after = screen.getByTestId('timeline-screen')
      expect(after).toBe(before)
    } finally {
      restore()
    }
  })

  it('TimelineScreen içinde fırlayan bir hata yalnızca o ekranı etkiler, sekme çubuğu/rozet etkilenmez (mutasyon 13 hedefi)', async () => {
    // Davranışsal test: gerçek TimelineScreen render sırasında fırlayacak şekilde mock'lanır;
    // App.tsx onu ScreenErrorBoundary ile sarmıyorsa hata App'in tamamını düşürür ve sekme
    // çubuğu/rozet de DOM'dan kaybolur — yalnızca dize arama (import satırı yeterli olurdu,
    // kullanım kaldırılsa bile gerçek regresyonu yakalamazdı) yerine gerçek davranış ölçülür.
    vi.resetModules()
    vi.doMock('../../src/features/events/web/TimelineScreen', () => ({
      TimelineScreen: () => {
        throw new Error('boom (mutasyon 13 testi)')
      },
    }))
    const restore = stubGlobals()
    try {
      const { default: AppWithThrowingScreen } = await import('../../src/web/App')
      render(<AppWithThrowingScreen />)
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByText('Bu ekran yüklenemedi.')).toBeTruthy()
      expect(screen.getByTestId('app-title').textContent).toBe('MISSION CONTROL')
      expect(screen.getByTestId('connection-badge-shell')).toBeTruthy()
    } finally {
      restore()
      vi.doUnmock('../../src/features/events/web/TimelineScreen')
      vi.resetModules()
    }
  })
})
