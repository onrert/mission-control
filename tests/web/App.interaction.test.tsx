// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe("App.interaction — Ayarlar geçişi (F-005 CEO kararı, tam tablist F-007'ye ertelendi)", () => {
  it("Ayarlar düğmesine tıklanınca TimelineScreen DOM'dan kaldırılmaz (hidden olur, unmount olmaz)", async () => {
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      const user = userEvent.setup()
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })

      const timelineBefore = screen.getByTestId('timeline-screen')
      await user.click(screen.getByRole('button', { name: 'Ayarlar' }))

      // TimelineScreen hâlâ DOM'da (F-003'ün unmount'suz garantisi) — yalnızca hidden.
      const timelineAfter = screen.getByTestId('timeline-screen')
      expect(timelineAfter).toBe(timelineBefore)
      expect(timelineAfter.closest('[id="panel-timeline"]')).toHaveProperty('hidden', true)
      expect(screen.getByTestId('settings-screen').closest('[id="panel-settings"]')).toHaveProperty(
        'hidden',
        false
      )
    } finally {
      restore()
    }
  })

  it('Ayarlar aria-pressed click() sonrası true/false arasında değişir', async () => {
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      const user = userEvent.setup()
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })

      const button = screen.getByRole('button', { name: 'Ayarlar' })
      expect(button.getAttribute('aria-pressed')).toBe('false')
      await user.click(button)
      expect(button.getAttribute('aria-pressed')).toBe('true')
      await user.click(button)
      expect(button.getAttribute('aria-pressed')).toBe('false')
    } finally {
      restore()
    }
  })

  it('Kanban statik <span> — click() ile ulaşılamaz, aktif ekranı değiştirmez', async () => {
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      const user = userEvent.setup()
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })

      const kanban = screen.getByText('Kanban')
      expect(kanban.tagName).toBe('SPAN')
      await user.click(kanban)
      // Kanban tıklamanın hiçbir etkisi yok — Ayarlar hâlâ basılı değil, panel değişmedi.
      expect(screen.getByRole('button', { name: 'Ayarlar' }).getAttribute('aria-pressed')).toBe(
        'false'
      )
    } finally {
      restore()
    }
  })
})

describe('App.interaction — tablist ok tuşu gezinmesi (QA düzeltme turu 1: T1/Ö1/Ö2/D50/M9)', () => {
  it('ArrowRight/ArrowLeft/Home/End seçili sekmeyi değiştirir VE DOM odağını yeni sekmeye taşır (roving tabindex)', async () => {
    // QA'nın M9 mutasyonu (`onKeyDown={onTabKeyDown}` tamamen silinmesi) önceki turda
    // 728/728 birim + 23/23 E2E yeşil kalmıştı — tablist klavye gezinmesinin HİÇBİR testi
    // yoktu (Ö2). Bu test gerçek `keydown` olaylarını ateşleyip HEM seçim değişimini HEM
    // DOM odağının taşınmasını (Ö1/D50 — WAI-ARIA roving tabindex) ölçer.
    FakeEventSource.reset()
    const restore = stubGlobals()
    try {
      render(<App />)
      await act(async () => {
        await Promise.resolve()
      })

      const timelineTab = screen.getByRole('tab', { name: 'Zaman Çizelgesi' })
      const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })

      timelineTab.focus()
      expect(document.activeElement).toBe(timelineTab)
      expect(timelineTab.getAttribute('aria-selected')).toBe('true')

      fireEvent.keyDown(timelineTab, { key: 'ArrowRight' })
      expect(kanbanTab.getAttribute('aria-selected')).toBe('true')
      expect(timelineTab.getAttribute('aria-selected')).toBe('false')
      expect(document.activeElement).toBe(kanbanTab)
      expect(screen.getByTestId('kanban-screen')).toBeTruthy()

      fireEvent.keyDown(kanbanTab, { key: 'ArrowLeft' })
      expect(timelineTab.getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(timelineTab)

      fireEvent.keyDown(timelineTab, { key: 'End' })
      expect(kanbanTab.getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(kanbanTab)

      fireEvent.keyDown(kanbanTab, { key: 'Home' })
      expect(timelineTab.getAttribute('aria-selected')).toBe('true')
      expect(document.activeElement).toBe(timelineTab)
    } finally {
      restore()
    }
  })
})
