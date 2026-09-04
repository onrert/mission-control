import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '..')

function walk(dir: string, extensions: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, extensions, out)
    } else if (extensions.includes(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

// Kapsam: kod/işaretleme dosyaları. `src/web/fonts/LICENSE-*.txt` ve `*.woff2` taranmaz
// (OFL lisans metni gövdesinde harici URL barındırır; bunlar kod değildir) — Y3/AC12.
// `.svg` K2 ile kapsama eklendi (favicon işaretlemedir, dış host taşıyabilir).
// QA düzeltme turu 1 (Ö4): F-002'nin açtığı yeni üretim kökleri (`src/features/**`,
// `scripts/**`) çite hiç dahil değildi — guard yeni koda kördü. Genişletildi.
const files = [
  ...walk(path.join(ROOT, 'src', 'web'), ['.ts', '.tsx', '.css', '.html', '.svg']),
  ...walk(path.join(ROOT, 'src', 'server'), ['.ts']),
  ...walk(path.join(ROOT, 'src', 'features'), ['.ts', '.tsx']),
  ...walk(path.join(ROOT, 'scripts'), ['.mjs']),
]

// `xmlns="http://www.w3.org/..."` bir ağ isteği değil, XML ad alanı **tanımlayıcısıdır**;
// tarayıcı bu URI'yi asla fetch etmez (SVG/XHTML spesifikasyonunun bir parçasıdır). Bu istisna
// yalnızca bu sabit ad alanı önekiyle sınırlıdır; başka hiçbir http(s):// literaline izin vermez.
const XML_NAMESPACE_EXCEPTIONS = ['http://www.w3.org/']

function stripExceptions(content: string): string {
  let result = content
  for (const ns of XML_NAMESPACE_EXCEPTIONS) {
    result = result.split(ns).join('')
  }
  return result
}

const EXTERNAL_HOST_PATTERN = /https?:\/\/(?!127\.0\.0\.1|localhost)[^\s"'<>)]+/i
const CDN_SUBSTRINGS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.']

describe('no-external-host guard (S1)', () => {
  it('taranacak en az bir dosya bulundu (guard kör değil)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s dış host literali içermiyor', (file) => {
    const raw = fs.readFileSync(file, 'utf8')
    const content = stripExceptions(raw)
    const match = content.match(EXTERNAL_HOST_PATTERN)
    expect(match).toBeNull()
    for (const cdn of CDN_SUBSTRINGS) {
      expect(content.toLowerCase().includes(cdn)).toBe(false)
    }
  })
})

describe('bind adresi guard (AC4 katman 2)', () => {
  const serverAndWebFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

  it.each(serverAndWebFiles)(
    '%s yasaklı bind literali içermiyor (0.0.0.0, MC_HOST, ::)',
    (file) => {
      const content = fs.readFileSync(file, 'utf8')
      expect(content.includes('0.0.0.0')).toBe(false)
      expect(content.includes('MC_HOST')).toBe(false)
      expect(/listen\([^)]*['"]::['"]/i.test(content)).toBe(false)
    }
  )
})
