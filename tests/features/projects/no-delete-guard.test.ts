import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '..', '..', '..')

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

// CEO kararı B/C — savunma katmanı (mimari §11.4b'nin genel guard'ı henüz yok, F-006'da gelecek).
// İzlenen proje köklerine hiçbir şeyin silinmediğini/yazılmadığını statik olarak doğrular.
const FORBIDDEN_SUBSTRINGS = ['unlink', 'rmSync', 'rmdirSync', 'fs.rm(']

const files = [
  ...walk(path.join(ROOT, 'src', 'features', 'projects'), ['.ts', '.tsx']),
  ...walk(path.join(ROOT, 'src', 'server', 'watch'), ['.ts']),
]
// `projects-registry.ts` da bu dosyalar listesine dahil (kendi projects.json'ını tmp+rename ile
// yazar, `unlink`/`rm` hiç kullanmaz — ama izlenen proje köklerine değil).
files.push(path.join(ROOT, 'src', 'server', 'store', 'projects-registry.ts'))

describe('no-delete-guard (CEO kararı B/C)', () => {
  it("taranan dosya sayısı > 0 (körlük assert'i, QA Bulgu 13a)", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s yasaklı silme/yazma alt dizgesi içermiyor', (file) => {
    const content = fs.readFileSync(file, 'utf8')
    for (const forbidden of FORBIDDEN_SUBSTRINGS) {
      expect(content.includes(forbidden)).toBe(false)
    }
  })
})
