import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(__dirname, '..', '..', 'src', 'web', 'index.css')
const appPath = path.join(__dirname, '..', '..', 'src', 'web', 'App.tsx')
const css = fs.readFileSync(cssPath, 'utf8')
const app = fs.readFileSync(appPath, 'utf8')

// Renk token'ları için proje `index.css`'te ayrı bir alias katmanı tanımlamaz — Tailwind'in
// varsayılan zinc ölçeğini `App.tsx`'teki utility sınıflarında doğrudan kullanır (bkz.
// `index.css` üstündeki not). Bu yüzden bu testler kaynağı (App.tsx) tarar, dead-code bir
// `@theme` alias bloğunu değil (B8 — fix turu 1).
describe('tasarım token\'ları (AC10/AC11)', () => {
  it('zemin token\'ı (zinc-950) kabukta kullanılıyor', () => {
    expect(app).toContain('zinc-950')
  })
  it('metin token\'ları (zinc-100, zinc-400) kabukta kullanılıyor', () => {
    expect(app).toContain('zinc-100')
    expect(app).toContain('zinc-400')
  })
  it('kenarlık token\'ı (zinc-800) kabukta kullanılıyor', () => {
    expect(app).toContain('zinc-800')
  })
  it('üç --font-* token\'ı tanımlı', () => {
    expect(css).toContain('--font-display')
    expect(css).toContain('--font-mono')
    expect(css).toContain('--font-sans')
  })
  it('üç @font-face bloğu var (Departure Mono, IBM Plex Mono x2, IBM Plex Sans)', () => {
    const matches = css.match(/@font-face/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(3)
    expect(css).toContain("font-family: 'Departure Mono'")
    expect(css).toContain("font-family: 'IBM Plex Mono'")
    expect(css).toContain("font-family: 'IBM Plex Sans'")
  })
  it('font kaynakları göreli yol kullanır (mutlak URL/hostname yok)', () => {
    expect(css).toContain("url('./fonts/")
    expect(css).not.toMatch(/url\(['"]?https?:\/\//)
  })
})
