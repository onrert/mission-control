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

  it('üst çubukta (header) gerçek <button>/<a> elemanı yok', () => {
    // F-003: TimelineScreen artık koşulsuz mount edildiği için sayfanın GERİ KALANINDA
    // (Duraklat, Tekrar dene, filtre çipleri gibi) gerçek butonlar var — bunlar beklenen ve
    // işlevsel etkileşim öğeleridir. Bu iddia yalnızca üst çubuğa (header) daralır; F-001'in
    // "iş yapmayan buton" yasağı yalnızca sekme çubuğu için geçerlidir (bkz. shell.spec.ts'in
    // aynı kapsamlı `header button, header a` seçicisi).
    const headerMatch = /<header[\s\S]*?<\/header>/.exec(html)
    expect(headerMatch).not.toBeNull()
    const headerHtml = headerMatch![0]
    expect(headerHtml).not.toContain('<button')
    expect(headerHtml).not.toContain('<a ')
    expect(headerHtml).not.toContain('<a>')
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
