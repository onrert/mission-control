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

  it('üst çubukta (header) tam olarak bir tıklanabilir öğe var: Ayarlar düğmesi (F-005)', () => {
    // F-005: Ayarlar artık gerçek bir <button> (CEO kararı, tam tablist deseni F-007'ye
    // ertelendi). Zaman Çizelgesi/Kanban statik <span> olarak kalır, hiçbiri tıklanabilir değil.
    const headerMatch = /<header[\s\S]*?<\/header>/.exec(html)
    expect(headerMatch).not.toBeNull()
    const headerHtml = headerMatch![0]
    const buttonMatches = headerHtml.match(/<button/g) ?? []
    expect(buttonMatches).toHaveLength(1)
    expect(headerHtml).not.toContain('<a ')
    expect(headerHtml).not.toContain('<a>')
    expect(headerHtml).toContain('aria-label="Ayarlar"')
  })

  it('Zaman Çizelgesi etiketi aria-current="page" taşır, Kanban/Ayarlar taşımaz; hiçbiri role="tab" değildir (YENİ-1)', () => {
    const headerMatch = /<header[\s\S]*?<\/header>/.exec(html)
    const headerHtml = headerMatch![0]
    expect(headerHtml).toContain('aria-current="page"')
    expect(headerHtml).not.toContain('role="tab"')
    expect(headerHtml).not.toContain('aria-selected')
    // yalnızca bir tane aria-current olmalı (Kanban/Ayarlar taşımıyor)
    expect(headerHtml.match(/aria-current="page"/g)).toHaveLength(1)
  })
})
