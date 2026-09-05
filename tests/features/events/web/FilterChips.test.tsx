// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterChips, ClearFiltersLink } from '../../../../src/features/events/web/FilterChips'

afterEach(() => cleanup())

describe('FilterChips', () => {
  it('varsayılan hepsi açık render edilir (aria-pressed=true)', () => {
    render(
      <FilterChips
        label="Proje"
        options={['a', 'b']}
        selected={new Set(['a', 'b'])}
        onToggle={() => {}}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b.getAttribute('aria-pressed')).toBe('true')
  })

  it('bir çip tıklanınca onToggle o değerle çağrılır', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterChips
        label="Proje"
        options={['a', 'b']}
        selected={new Set(['a', 'b'])}
        onToggle={onToggle}
      />
    )
    await user.click(screen.getByText('a'))
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('seçili olmayan çip aria-pressed=false gösterir', () => {
    render(
      <FilterChips
        label="Proje"
        options={['a', 'b']}
        selected={new Set(['a'])}
        onToggle={() => {}}
      />
    )
    expect(screen.getByText('b').getAttribute('aria-pressed')).toBe('false')
  })

  it('boş options -> hiçbir şey render etmez', () => {
    const { container } = render(
      <FilterChips label="Proje" options={[]} selected={new Set()} onToggle={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('ClearFiltersLink', () => {
  it('tıklanınca onClear çağrılır', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<ClearFiltersLink onClear={onClear} />)
    await user.click(screen.getByText('Filtreleri temizle'))
    expect(onClear).toHaveBeenCalled()
  })
})
