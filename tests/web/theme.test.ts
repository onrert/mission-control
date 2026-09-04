import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.join(__dirname, '..', '..', 'src', 'web', 'index.css')
const css = fs.readFileSync(cssPath, 'utf8')

describe('index.css tasarım token\'ları (AC10/AC11)', () => {
  it('zemin token\'ları (zinc-950, zinc-900) var', () => {
    expect(css).toContain('zinc-950')
    expect(css).toContain('zinc-900')
  })
  it('metin token\'ları (zinc-100, zinc-400) var', () => {
    expect(css).toContain('zinc-100')
    expect(css).toContain('zinc-400')
  })
  it('vurgu token\'ları (amber-400, amber-500) var', () => {
    expect(css).toContain('amber-400')
    expect(css).toContain('amber-500')
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
