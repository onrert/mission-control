// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddProjectForm } from '../../../../src/features/projects/web/AddProjectForm'

afterEach(() => cleanup())

describe('AddProjectForm', () => {
  it('geçerli girişte Ekle sonrası input temizlenir', async () => {
    const onAdd = vi.fn(async () => ({ ok: true as const }))
    const user = userEvent.setup()
    render(<AddProjectForm onAdd={onAdd} />)

    const input = screen.getByLabelText('Yeni proje yolu:') as HTMLInputElement
    await user.type(input, 'C:\\dev\\apps\\demo')
    await user.click(screen.getByText('Ekle'))

    await waitFor(() => expect(input.value).toBe(''))
    expect(onAdd).toHaveBeenCalledWith('C:\\dev\\apps\\demo')
  })

  it('400 yanıtında satır içi kırmızı hata görünür ve input odakta kalır', async () => {
    const onAdd = vi.fn(async () => ({
      ok: false as const,
      message: 'Bu klasörde docs/features bulunamadı. Yolu kontrol edin.',
    }))
    const user = userEvent.setup()
    render(<AddProjectForm onAdd={onAdd} />)

    const input = screen.getByLabelText('Yeni proje yolu:') as HTMLInputElement
    await user.type(input, 'C:\\dev\\apps\\yanlis')
    await user.click(screen.getByText('Ekle'))

    await waitFor(() => expect(screen.getByTestId('add-project-error')).toBeTruthy())
    expect(
      screen.getByText('⚠ Bu klasörde docs/features bulunamadı. Yolu kontrol edin.')
    ).toBeTruthy()
    expect(document.activeElement).toBe(input)
    // Başarısız denemede girdi TEMİZLENMEZ — kullanıcı düzeltebilsin.
    expect(input.value).toBe('C:\\dev\\apps\\yanlis')
  })

  it('gönderim sırasında "kontrol ediliyor…" durumu gösterilir', async () => {
    let resolveAdd: (v: { ok: true }) => void = () => {}
    const onAdd = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveAdd = resolve
        })
    )
    const user = userEvent.setup()
    render(<AddProjectForm onAdd={onAdd} />)

    const input = screen.getByLabelText('Yeni proje yolu:')
    await user.type(input, 'C:\\dev\\apps\\demo')
    await user.click(screen.getByText('Ekle'))

    expect(screen.getByText('kontrol ediliyor…')).toBeTruthy()
    resolveAdd({ ok: true })
    await waitFor(() => expect(screen.getByText('Ekle')).toBeTruthy())
  })
})
