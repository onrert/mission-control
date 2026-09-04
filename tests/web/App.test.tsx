import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../../src/web/App'

describe('App (AC6 — DOMsuz statik render)', () => {
  const html = renderToStaticMarkup(<App />)

  it('başlık "MISSION CONTROL" içeriyor', () => {
    expect(html.toUpperCase()).toContain('MISSION CONTROL')
  })

  it('data-testid="app-title" mevcut', () => {
    expect(html).toContain('data-testid="app-title"')
  })

  it('Faz 1 ekran etiketleri görünür (Zaman Çizelgesi, Kanban, Ayarlar)', () => {
    expect(html).toContain('Zaman Çizelgesi')
    expect(html).toContain('Kanban')
    expect(html).toContain('Ayarlar')
  })

  it('Faz 2 ekranları hiç görünmez (Kapılar, Thread, Token)', () => {
    expect(html).not.toContain('Kapılar')
    expect(html).not.toContain('Thread')
    expect(html).not.toContain('Token')
  })

  it('üst çubukta gerçek <button>/<a> elemanı yok', () => {
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('<a>')
  })
})
