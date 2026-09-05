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

  it('F-007: gerçek tablist deseni kuruldu — role="tablist"/"tab"/"tabpanel" + aria-selected/roving tabindex, aria-current KALDIRILDI', () => {
    const headerMatch = /<header[\s\S]*?<\/header>/.exec(html)
    const headerHtml = headerMatch![0]
    // Mimari sapması (kasıtlı, §6 madde 1) — `aria-current="page"` `aria-selected`'ın yerini aldı.
    expect(headerHtml).not.toContain('aria-current="page"')
    expect(headerHtml).toContain('role="tablist"')
    // İki gerçek sekme: Zaman Çizelgesi (seçili, tabIndex 0) + Kanban (seçili değil, tabIndex -1).
    expect(headerHtml.match(/role="tab"/g)).toHaveLength(2)
    expect(headerHtml).toContain('id="tab-timeline"')
    expect(headerHtml).toContain('aria-controls="panel-timeline"')
    expect(headerHtml).toContain('aria-selected="true"')
    expect(headerHtml).toContain('aria-selected="false"')
    expect(headerHtml).toContain('tabindex="0"')
    expect(headerHtml).toContain('tabindex="-1"')
    // Ayarlar bu desenin dışında kalır — kendi `aria-pressed` toggle butonu, `role="tab"` değil.
    expect(headerHtml).toContain('aria-label="Ayarlar"')
  })

  it('F-007: iki tabpanel var (timeline/kanban), aria-labelledby ile kendi sekmesine bağlı', () => {
    expect(html).toContain('id="panel-timeline"')
    expect(html).toContain('aria-labelledby="tab-timeline"')
    expect(html).toContain('id="panel-kanban"')
    expect(html).toContain('aria-labelledby="tab-kanban"')
  })

  it("QA düzeltme turu 1 (Ö3/M6b): her sekmenin aria-controls'u KENDİ paneline işaret eder (ters yön dahil)", () => {
    // QA'nın mutasyonu (her iki sekmeyi de `panel-timeline`'a bağlamak) önceki testte 728/728
    // yeşil kalıyordu çünkü yalnızca `aria-controls="panel-timeline"`'ın VARLIĞI aranıyordu —
    // Kanban sekmesinin KENDİ panel ilişkisi hiç ölçülmüyordu. Burada her sekmenin `id`sinden
    // başlayan span'i ayrı ayrı izole edip kendi `aria-controls`'unu doğruluyoruz.
    const headerMatch = /<header[\s\S]*?<\/header>/.exec(html)
    const headerHtml = headerMatch![0]
    const timelineTabHtml = /<span[^>]*id="tab-timeline"[^>]*>/.exec(headerHtml)
    const kanbanTabHtml = /<span[^>]*id="tab-kanban"[^>]*>/.exec(headerHtml)
    expect(timelineTabHtml).not.toBeNull()
    expect(kanbanTabHtml).not.toBeNull()
    expect(timelineTabHtml![0]).toContain('aria-controls="panel-timeline"')
    expect(kanbanTabHtml![0]).toContain('aria-controls="panel-kanban"')
  })
})
