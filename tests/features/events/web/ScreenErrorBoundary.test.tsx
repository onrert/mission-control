// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenErrorBoundary } from '../../../../src/features/events/web/ScreenErrorBoundary'

afterEach(() => cleanup())

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom')
  return <p data-testid="ok-content">tamam</p>
}

describe('ScreenErrorBoundary', () => {
  it('render sırasında fırlayan hatayı yakalar, "Bu ekran yüklenemedi." gösterir', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ScreenErrorBoundary>
        <Bomb shouldThrow />
      </ScreenErrorBoundary>
    )
    expect(screen.getByText('Bu ekran yüklenemedi.')).toBeTruthy()
    expect(screen.getByText('Tekrar dene')).toBeTruthy()
    consoleSpy.mockRestore()
  })

  it('hata yoksa children normal render edilir', () => {
    render(
      <ScreenErrorBoundary>
        <Bomb shouldThrow={false} />
      </ScreenErrorBoundary>
    )
    expect(screen.getByTestId('ok-content')).toBeTruthy()
  })

  it('componentDidCatch hatayı bir kez console.errora loglar', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ScreenErrorBoundary>
        <Bomb shouldThrow />
      </ScreenErrorBoundary>
    )
    const ownLogCalls = consoleSpy.mock.calls.filter((args) =>
      String(args[0]).includes('Ekran hatası yakalandı')
    )
    expect(ownLogCalls).toHaveLength(1)
    consoleSpy.mockRestore()
  })

  it('"Tekrar dene" düzelmiş içerikle yeniden render tetikler', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    // `shouldThrow` çağıran (test) tarafından mutasyona uğrayan bir kapatma üzerinden okunur —
    // boundary'nin `getDerivedStateFromError` sonrası yeniden render'ı GERÇEKTEN Bomb'u tekrar
    // çağırır (yalnızca önceki ağacı göstermeye devam etmez).
    const flag = { shouldThrow: true }
    function ControlledBomb() {
      return <Bomb shouldThrow={flag.shouldThrow} />
    }
    render(
      <ScreenErrorBoundary>
        <ControlledBomb />
      </ScreenErrorBoundary>
    )
    expect(screen.getByText('Bu ekran yüklenemedi.')).toBeTruthy()

    flag.shouldThrow = false
    await user.click(screen.getByText('Tekrar dene'))

    expect(screen.getByTestId('ok-content')).toBeTruthy()
    expect(screen.queryByText('Bu ekran yüklenemedi.')).toBeNull()
    consoleSpy.mockRestore()
  })
})
