import { describe, expect, it, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveProjectPath } from '../../../../src/features/projects/server/validate-path'

const tempDirs: string[] = []

function makeTempDir(prefix = 'mc-vp-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function withFeatures(dir: string): string {
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveProjectPath — §7 vaka tablosu', () => {
  it('vaka 1: var olmayan yol -> invalid_path "Bu yol bulunamadı."', () => {
    const dir = makeTempDir()
    const missing = path.join(dir, 'yok-boyle-bir-sey')
    const result = resolveProjectPath(missing)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_path')
      expect(result.message).toBe('Bu yol bulunamadı.')
    }
  })

  it('vaka 2: var olan bir dosya (klasör değil) -> invalid_path "Bu bir klasör değil."', () => {
    const dir = makeTempDir()
    const filePath = path.join(dir, 'dosya.txt')
    fs.writeFileSync(filePath, 'x')
    const result = resolveProjectPath(filePath)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_path')
      expect(result.message).toBe('Bu bir klasör değil.')
    }
  })

  it('vaka 3: klasör var, docs/features yok -> invalid_path', () => {
    const dir = makeTempDir()
    const result = resolveProjectPath(dir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_path')
      expect(result.message).toBe('Bu klasörde docs/features bulunamadı. Yolu kontrol edin.')
    }
  })

  it('vaka 4: docs/features var ama dosya -> invalid_path (aynı mesaj)', () => {
    const dir = makeTempDir()
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'docs', 'features'), 'x')
    const result = resolveProjectPath(dir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Bu klasörde docs/features bulunamadı. Yolu kontrol edin.')
    }
  })

  it('vaka 5: boş dizge / yalnızca boşluk -> invalid_body', () => {
    expect(resolveProjectPath('')).toEqual({
      ok: false,
      code: 'invalid_body',
      message: 'path alanı zorunludur.',
    })
    expect(resolveProjectPath('   ')).toEqual({
      ok: false,
      code: 'invalid_body',
      message: 'path alanı zorunludur.',
    })
  })

  it('vaka 6: path alanı string değil -> invalid_body', () => {
    expect(resolveProjectPath(42)).toEqual({
      ok: false,
      code: 'invalid_body',
      message: 'path alanı zorunludur.',
    })
    expect(resolveProjectPath({})).toEqual({
      ok: false,
      code: 'invalid_body',
      message: 'path alanı zorunludur.',
    })
    expect(resolveProjectPath(undefined)).toEqual({
      ok: false,
      code: 'invalid_body',
      message: 'path alanı zorunludur.',
    })
  })

  it('vaka 7: göreli yol normalize edilip kabul edilir', () => {
    const dir = withFeatures(makeTempDir())
    const relative = path.relative(process.cwd(), dir)
    const result = resolveProjectPath(relative)
    expect(result.ok).toBe(true)
  })

  it('vaka 8: ".." içeren ama geçerli bir yola çözülen yol kabul edilir', () => {
    const parent = makeTempDir()
    const project = withFeatures(path.join(parent, 'proje'))
    fs.mkdirSync(project, { recursive: true })
    fs.mkdirSync(path.join(project, 'docs', 'features'), { recursive: true })
    const sibling = path.join(parent, 'baska', '..', 'proje')
    fs.mkdirSync(path.join(parent, 'baska'), { recursive: true })
    const result = resolveProjectPath(sibling)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.path).toBe(fs.realpathSync.native(project))
    }
  })

  it('vaka 9: sürücü kökü (C:\\) -> invalid_path "Sürücü kökü izlenemez."', () => {
    const root = path.parse(process.cwd()).root
    const result = resolveProjectPath(root)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_path')
      expect(result.message).toBe('Sürücü kökü izlenemez.')
    }
  })

  it('vaka 10: UNC yol -> invalid_path "Ağ/UNC yolları desteklenmiyor."', () => {
    const result = resolveProjectPath('\\\\server\\share\\proj')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('invalid_path')
      expect(result.message).toBe('Ağ/UNC yolları desteklenmiyor.')
    }
  })

  it('vaka 11: symlink/junction -> geçerli docs/features içeren hedef kabul edilir, saklanan path gerçek hedef', () => {
    const parent = makeTempDir()
    const target = withFeatures(path.join(parent, 'gercek-proje'))
    fs.mkdirSync(path.join(target, 'docs', 'features'), { recursive: true })
    const link = path.join(parent, 'junction-link')
    fs.symlinkSync(target, link, 'junction')
    const result = resolveProjectPath(link)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.path).toBe(fs.realpathSync.native(target))
    }
  })

  it('vaka 13/14/15/D17: 6 yazım varyantı tek kanonik dizgeye iner (fs.realpathSync.native)', () => {
    const parent = makeTempDir()
    const original = path.join(parent, 'MyProject')
    fs.mkdirSync(path.join(original, 'docs', 'features'), { recursive: true })

    const variants = [
      original,
      original.toLowerCase(),
      original.toUpperCase(),
      original.replace(/\\/g, '/'),
      `${original}\\`,
      path.join(parent, 'MyProject', 'docs', '..'),
    ]

    const results = variants.map((v) => resolveProjectPath(v))
    for (const r of results) {
      expect(r.ok).toBe(true)
    }
    const paths = results.map((r) => (r.ok ? r.path : null))
    expect(new Set(paths).size).toBe(1)
  })

  it('vaka 16: çok uzun yol (>260 karakter), docs/features içeriyor -> KABUL', () => {
    const parent = makeTempDir()
    const longName = 'a'.repeat(200)
    const project = path.join(parent, longName)
    fs.mkdirSync(path.join(project, 'docs', 'features'), { recursive: true })
    expect(project.length).toBeGreaterThan(200)
    const result = resolveProjectPath(project)
    expect(result.ok).toBe(true)
  })

  it('vaka 17: baş/son boşluklu geçerli yol trim edilip kabul edilir', () => {
    const dir = withFeatures(makeTempDir())
    const result = resolveProjectPath(`  ${dir}  `)
    expect(result.ok).toBe(true)
  })

  it('vaka 18: NTFS büyük/küçük harf duyarsız -> "docs/Features" büyük harf yazımı "docs/features" ile de eşleşir, KABUL', () => {
    const dir = makeTempDir()
    fs.mkdirSync(path.join(dir, 'docs', 'Features'), { recursive: true })
    const result = resolveProjectPath(dir)
    expect(result.ok).toBe(true)
  })

  it('vaka 20 (router seviyesi, burada belgeleniyor): boş segment doğrulaması validate-path kapsamında değil', () => {
    // DELETE /api/projects/ (boş id) handlers.ts'te router segment kontrolüyle ele alınır,
    // resolveProjectPath'in konusu değil — bkz. tests/integration/projects-api.test.ts.
    expect(true).toBe(true)
  })
})
