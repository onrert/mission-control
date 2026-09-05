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
// QA düzeltme turu 1 (ÖNEMLİ-2): önceden yalnızca silme alt dizgeleri taranıyordu, yorum "yazma"
// da diyordu ama tarama listesi yazmayı hiç kapsamıyordu — şimdi ikisi de taranıyor.
const DELETE_SUBSTRINGS = ['unlink', 'rmSync', 'rmdirSync', 'fs.rm(']
const WRITE_SUBSTRINGS = ['writeFileSync', 'appendFileSync', 'mkdirSync']

const watchedProjectFiles = [
  ...walk(path.join(ROOT, 'src', 'features', 'projects'), ['.ts', '.tsx']),
  ...walk(path.join(ROOT, 'src', 'server', 'watch'), ['.ts']),
]

// `projects-registry.ts` bu tarama listesinde DEĞİL — kendi `projects.json`/`.tmp` dosyasını
// (izlenen proje kökleri değil, bu veri dizini) `writeFileSync`/`mkdirSync`/tek dosya
// `unlinkSync` ile yazar/temizler (QA düzeltme turu 1 BLOKLAYICI-1 eki, bkz. registry.ts'in
// kendi dokümantasyonu). Bu istisna ayrı, dar bir testle güvence altına alınır: registry.ts
// yine de tehlikeli/özyinelemeli silme çağrılarını (`rmSync`/`rmdirSync`/`fs.rm(`) kullanamaz.
const registryFile = path.join(ROOT, 'src', 'server', 'store', 'projects-registry.ts')

describe('no-delete-guard (CEO kararı B/C)', () => {
  it("taranan dosya sayısı > 0 (körlük assert'i, QA Bulgu 13a)", () => {
    expect(watchedProjectFiles.length).toBeGreaterThan(0)
  })

  it.each(watchedProjectFiles)(
    '%s izlenen proje köklerine silme/yazma alt dizgesi içermiyor',
    (file) => {
      const content = fs.readFileSync(file, 'utf8')
      for (const forbidden of [...DELETE_SUBSTRINGS, ...WRITE_SUBSTRINGS]) {
        expect(content.includes(forbidden)).toBe(false)
      }
    }
  )

  it('projects-registry.ts: özel istisna dışında (kendi tmp/json dosyası) tehlikeli özyinelemeli silme çağrısı kullanmaz', () => {
    const content = fs.readFileSync(registryFile, 'utf8')
    expect(content.includes('rmSync')).toBe(false)
    expect(content.includes('rmdirSync')).toBe(false)
    expect(content.includes('fs.rm(')).toBe(false)
  })
})
