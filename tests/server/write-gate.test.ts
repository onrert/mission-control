import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  archiveDenial,
  setFeatureStatus,
  writeGateApproval,
  writeGateDenial,
} from '../../src/server/write-gate'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function writeFile(root: string, relPath: string, content: string): string {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
  return full
}

let root: string

beforeEach(() => {
  root = createTempDataDir()
})

afterEach(() => {
  removeTempDataDir(root)
})

describe('write-gate — export yüzeyi (AC2)', () => {
  it('yalnızca dört niyet fonksiyonu export edilir', async () => {
    const mod = await import('../../src/server/write-gate')
    expect(Object.keys(mod).sort()).toEqual(
      ['archiveDenial', 'setFeatureStatus', 'writeGateApproval', 'writeGateDenial'].sort()
    )
  })
})

describe('setFeatureStatus — yol beyaz listesi', () => {
  it('geçerli fileName + doğru hash → yazılır (AC1)', () => {
    const full = writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\nbody\n')
    const hash = sha256(fs.readFileSync(full))
    const result = setFeatureStatus(root, 'F-001.md', 'qa', hash)
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(full, 'utf8')).toBe('---\nstatus: qa\n---\nbody\n')
  })

  it('fileName traversal (`../../../etc/passwd`) → invalid_body (AC4)', () => {
    const result = setFeatureStatus(root, '../../../etc/passwd', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })

  it('fileName yanlış uzantı (`a.txt`) → invalid_body', () => {
    const result = setFeatureStatus(root, 'a.txt', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })

  it('fileName alt dizin içeriyor (`sub/a.md`) → invalid_body', () => {
    const result = setFeatureStatus(root, 'sub/a.md', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })

  it('expectedHash uyuşmuyor → conflict, dosya değişmez', () => {
    const full = writeFile(root, 'docs/features/F-002.md', '---\nstatus: todo\n---\n')
    const before = fs.readFileSync(full, 'utf8')
    const result = setFeatureStatus(root, 'F-002.md', 'qa', 'yanlis-hash')
    expect(result).toMatchObject({ ok: false, code: 'conflict' })
    expect(fs.readFileSync(full, 'utf8')).toBe(before)
  })

  it('hedef dosya yok (ENOENT) → fırlamaz, write_failed döner', () => {
    const result = setFeatureStatus(root, 'F-999.md', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'write_failed' })
  })

  it('hedefin kendisi symlink → ata dizin içi başka bir dosyaya işaret ediyorsa write_denied (D30, QA Bulgu 3)', () => {
    const realTarget = writeFile(root, 'src/index.ts', 'export {}')
    fs.mkdirSync(path.join(root, 'docs', 'features'), { recursive: true })
    const link = path.join(root, 'docs', 'features', 'F-001.md')
    let created = false
    try {
      fs.symlinkSync(realTarget, link, 'file')
      created = true
    } catch {
      // Windows'ta yönetici izni/Geliştirici Modu olmadan dosya-seviyesi symlink oluşmaz —
      // bu ortamda beklenen, bu alt-test GEÇTİ'ye katkı SAYMAZ (zorunlu kanıt spy testinde).
    }
    if (created) {
      const result = setFeatureStatus(root, 'F-001.md', 'qa', 'herhangi')
      expect(result).toMatchObject({ ok: false, code: 'write_denied' })
      expect(fs.readFileSync(realTarget, 'utf8')).toBe('export {}')
    } else {
      expect(created).toBe(false)
    }
  })

  it('hedefin kendisi symlink → zorunlu, atlanmayan sahte-stat testi (vi.spyOn lstatSync)', () => {
    writeFile(root, 'src/index.ts', 'export {}')
    const targetPath = path.join(root, 'docs', 'features', 'F-001.md')
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    // Gerçek symlink yerine: hedef "var" gibi davranan ama lstat'ın symlink gördüğü bir durum.
    fs.writeFileSync(targetPath, 'placeholder')
    const realLstat = fs.lstatSync.bind(fs)
    const spy = vi
      .spyOn(fs, 'lstatSync')
      .mockImplementation((p: fs.PathLike, ...rest: unknown[]) => {
        if (path.resolve(p.toString()) === path.resolve(targetPath)) {
          return { isSymbolicLink: () => true, isDirectory: () => false } as fs.Stats
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (realLstat as any)(p, ...rest)
      })
    try {
      const result = setFeatureStatus(root, 'F-001.md', 'qa', 'herhangi')
      expect(result).toMatchObject({ ok: false, code: 'write_denied' })
    } finally {
      spy.mockRestore()
    }
  })

  it('ata dizin (`docs/features`) kök içi başka bir dizine symlink → write_denied (junction, D30)', () => {
    const realDir = path.join(root, 'real-features')
    fs.mkdirSync(realDir, { recursive: true })
    writeFile(root, 'real-features/F-001.md', '---\nstatus: todo\n---\n')
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
    const link = path.join(root, 'docs', 'features')
    fs.symlinkSync(realDir, link, 'junction')
    const result = setFeatureStatus(root, 'F-001.md', 'qa', 'herhangi')
    expect(result).toMatchObject({ ok: false, code: 'write_denied' })
    expect(fs.readFileSync(path.join(realDir, 'F-001.md'), 'utf8')).toBe('---\nstatus: todo\n---\n')
  })

  it('root kendisi bir symlink (kayıt sonrası değiştirilmiş) → gerçek hedefi çözer, kök dışıysa write_denied (ADR-005 risk maddesi)', () => {
    const realRoot = `${root}-real`
    fs.mkdirSync(path.join(realRoot, 'docs', 'features'), { recursive: true })
    fs.writeFileSync(
      path.join(realRoot, 'docs', 'features', 'F-001.md'),
      '---\nstatus: todo\n---\n'
    )
    fs.rmSync(root, { recursive: true, force: true })
    fs.symlinkSync(realRoot, root, 'junction')
    try {
      const result = setFeatureStatus(root, 'F-001.md', 'qa', 'herhangi')
      expect(result).toMatchObject({ ok: false })
    } finally {
      fs.rmSync(realRoot, { recursive: true, force: true })
    }
  })

  it('önek tuzağı: root farklı bir dizinin öneki olsa bile write_denied (QA Bulgu 11)', () => {
    const trapRoot = `${root}-factory`
    fs.mkdirSync(path.join(trapRoot, 'docs', 'features'), { recursive: true })
    fs.writeFileSync(
      path.join(trapRoot, 'docs', 'features', 'F-001.md'),
      '---\nstatus: todo\n---\n'
    )
    try {
      const result = setFeatureStatus(root, 'F-001.md', 'qa', 'herhangi')
      expect(result).toMatchObject({ ok: false })
    } finally {
      fs.rmSync(trapRoot, { recursive: true, force: true })
    }
  })

  it('root verilmemiş (boş dizge) → write_denied', () => {
    const result = setFeatureStatus('', 'F-001.md', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'write_denied' })
  })

  it('root bir dosya (dizin değil) → write_denied', () => {
    const filePath = path.join(root, 'not-a-dir.txt')
    fs.writeFileSync(filePath, 'x')
    const result = setFeatureStatus(filePath, 'F-001.md', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'write_denied' })
  })

  it('root göreli bir yol → write_denied', () => {
    const result = setFeatureStatus('docs', 'F-001.md', 'qa', 'x')
    expect(result).toMatchObject({ ok: false, code: 'write_denied' })
  })

  it('EPERM/EBUSY 3 denemede de sürerse write_failed döner (ADR-005 madde 5)', () => {
    const full = writeFile(root, 'docs/features/F-003.md', '---\nstatus: todo\n---\n')
    const hash = sha256(fs.readFileSync(full))
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      const err = new Error('EPERM: yapay') as NodeJS.ErrnoException
      err.code = 'EPERM'
      throw err
    })
    try {
      const result = setFeatureStatus(root, 'F-003.md', 'qa', hash)
      expect(result).toMatchObject({ ok: false, code: 'write_failed' })
      expect(renameSpy).toHaveBeenCalledTimes(4) // ilk deneme + 3 retry
    } finally {
      renameSpy.mockRestore()
    }
  }, 10_000)

  // Mutasyon 12 (sözleşme §8) — `mkdirSync`'in `try` içinde olduğunu, hedef dizin bir DOSYAYLA
  // işgal edilmişken (`ENOTDIR`) bile modülün asla fırlamadığını kanıtlar.
  it('hedef dizin (docs/approvals) bir dosyayla işgal edilmişse fırlamaz, write_failed döner (ENOTDIR)', () => {
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs', 'approvals'), 'ben bir dosyayım')
    expect(() => writeGateApproval(root, 'G2', 'x')).not.toThrow()
    const result = writeGateApproval(root, 'G2', 'x')
    expect(result).toMatchObject({ ok: false, code: 'write_failed' })
  })

  // D38/Ö2 (QA KALDI turu) — `nextStatus` satır sonu içeriyorsa reddedilir (frontmatter
  // enjeksiyonu, QA'nın ölçtüğü `'x\n---\nBODY'` girdisi). Hem `\n` hem `\r` denenir; dosya
  // hiç dokunulmadan `invalid_body` dönmeli.
  it.each(['x\n---\nBODY', 'x\r---\rBODY', 'x\r\n---\r\nBODY'])(
    'nextStatus satır sonu içeriyorsa (%s) invalid_body döner, frontmatter bozulmaz (D38/Ö2)',
    (nextStatus) => {
      const before = '---\nstatus: todo\n---\nbody\n'
      const full = writeFile(root, 'docs/features/G18.md', before)
      const hash = sha256(before)
      const result = setFeatureStatus(root, 'G18.md', nextStatus, hash)
      expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
      expect(fs.readFileSync(full, 'utf8')).toBe(before)
    }
  )

  // Ö5 (QA KALDI turu, MQ1 emsali) — ata-dizin `lstatSync` döngüsü TÜM üst segmentleri
  // kontrol eder, yalnızca sonuncusunu değil. `setFeatureStatus` için relativeParts
  // `['docs', 'features', fileName]`, yani iki ata segmenti var: `docs` (ÜST) ve
  // `docs/features` (SON). MQ1 mutasyonu döngüyü yalnızca son segmenti kontrol edecek şekilde
  // daraltınca (`for (i = len-2; i < len-1)`) 539/539 yeşil kalmıştı — `docs` segmenti hiç
  // `lstatSync`'lenmemiş olsa bile fark edilmiyordu. Bu test gerçek bir symlink kurmadan,
  // `lstatSync`'e giden her yolu kaydedip HER İKİ segmentin de gerçekten sorgulandığını kanıtlar.
  it('ata dizin lstatSync taraması TÜM üst segmentleri kontrol eder, yalnızca sonuncuyu değil (Ö5)', () => {
    const full = writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    const hash = sha256(fs.readFileSync(full))
    const docsPath = path.resolve(path.join(root, 'docs'))
    const featuresPath = path.resolve(path.join(root, 'docs', 'features'))
    const realLstat = fs.lstatSync.bind(fs)
    const seen = new Set<string>()
    const spy = vi
      .spyOn(fs, 'lstatSync')
      .mockImplementation((p: fs.PathLike, ...rest: unknown[]) => {
        seen.add(path.resolve(p.toString()))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (realLstat as any)(p, ...rest)
      })
    try {
      const result = setFeatureStatus(root, 'F-001.md', 'qa', hash)
      expect(result.ok).toBe(true)
      expect(seen.has(docsPath)).toBe(true)
      expect(seen.has(featuresPath)).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('setFeatureStatus — bayt koruma (golden fixtures)', () => {
  function assertOnlyStatusLineChanged(
    before: string,
    after: string,
    statusLineIndex: number
  ): void {
    const beforeParts = before.split(/(\r\n|\n)/)
    const afterParts = after.split(/(\r\n|\n)/)
    expect(afterParts.length).toBe(beforeParts.length)
    for (let i = 0; i < beforeParts.length; i++) {
      if (i === statusLineIndex) continue
      expect(afterParts[i]).toBe(beforeParts[i])
    }
  }

  it('1) saf LF, status ortada', () => {
    const before = '---\ntitle: X\nstatus: todo\ndeps: []\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G1.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G1.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const after = fs.readFileSync(full, 'utf8')
    assertOnlyStatusLineChanged(before, after, 4)
    expect(after).toContain('status: qa')
    expect(after).not.toContain('\r\n')
  })

  it('2) saf CRLF, status ortada', () => {
    const before = '---\r\ntitle: X\r\nstatus: todo\r\n---\r\nbody\r\n'
    const full = writeFile(root, 'docs/features/G2.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G2.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const after = fs.readFileSync(full, 'utf8')
    assertOnlyStatusLineChanged(before, after, 4)
    expect(after.match(/\r\n/g)?.length).toBe(before.match(/\r\n/g)?.length)
  })

  it('3) karışık CRLF/LF', () => {
    const before = '---\r\ntitle: X\nstatus: todo\r\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G3.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G3.md', 'qa', hash)
    expect(result.ok).toBe(true)
    assertOnlyStatusLineChanged(before, fs.readFileSync(full, 'utf8'), 4)
  })

  it('4) BOM + LF — algoritma çalışır ve BOM baytları korunur', () => {
    const before = '﻿---\ntitle: X\nstatus: todo\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G4.md', before)
    const hash = sha256(Buffer.from(before, 'utf8'))
    const result = setFeatureStatus(root, 'G4.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const afterBuf = fs.readFileSync(full)
    expect(afterBuf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    const after = afterBuf.toString('utf8')
    expect(after.startsWith('﻿---')).toBe(true)
    expect(after).toContain('status: qa')
  })

  it('5) status tırnaklı değer', () => {
    const before = '---\nstatus: "in progress"\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G5.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G5.md', 'qa', hash)
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(full, 'utf8')).toContain('status: qa')
  })

  it('6) status ilk satırda (frontmatter açılışından hemen sonra)', () => {
    const before = '---\nstatus: todo\ntitle: X\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G6.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G6.md', 'qa', hash)
    expect(result.ok).toBe(true)
    assertOnlyStatusLineChanged(before, fs.readFileSync(full, 'utf8'), 2)
  })

  it('7) status son satırda (kapanıştan hemen önce)', () => {
    const before = '---\ntitle: X\nstatus: todo\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G7.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G7.md', 'qa', hash)
    expect(result.ok).toBe(true)
    assertOnlyStatusLineChanged(before, fs.readFileSync(full, 'utf8'), 4)
  })

  it('8) girintili status: (alt alan, dokunulmamalı) + girintisiz status: birlikte', () => {
    const before = '---\nnested:\n  status: child\nstatus: todo\n---\nbody\n'
    const full = writeFile(root, 'docs/features/G8.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G8.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const after = fs.readFileSync(full, 'utf8')
    expect(after).toContain('  status: child')
    expect(after).toContain('\nstatus: qa')
  })

  it('9) frontmatter yok → invalid_body', () => {
    const before = 'title: X\nstatus: todo\n'
    const full = writeFile(root, 'docs/features/G9.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G9.md', 'qa', hash)
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
    expect(fs.readFileSync(full, 'utf8')).toBe(before)
  })

  it('10) kapanış ... (--- değil)', () => {
    const before = '---\nstatus: todo\n...\nbody\n'
    const full = writeFile(root, 'docs/features/G10.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G10.md', 'qa', hash)
    expect(result.ok).toBe(true)
    assertOnlyStatusLineChanged(before, fs.readFileSync(full, 'utf8'), 2)
  })

  it('11) unicode başlık', () => {
    const before = '---\ntitle: "Özel Karakterler ığüşöç"\nstatus: todo\n---\n'
    const full = writeFile(root, 'docs/features/G11.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G11.md', 'qa', hash)
    expect(result.ok).toBe(true)
    assertOnlyStatusLineChanged(before, fs.readFileSync(full, 'utf8'), 4)
  })

  it('12) çok satırlı blok skaler', () => {
    const before = '---\ndescription: |\n  satır1\n  satır2\nstatus: todo\n---\n'
    const full = writeFile(root, 'docs/features/G12.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G12.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const after = fs.readFileSync(full, 'utf8')
    expect(after).toContain('  satır1\n  satır2')
    expect(after).toContain('status: qa')
  })

  it('13) deps: [F-001, F-002] dizi değeri etkilenmemeli', () => {
    const before = '---\ndeps: [F-001, F-002]\nstatus: todo\n---\n'
    const full = writeFile(root, 'docs/features/G13.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G13.md', 'qa', hash)
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(full, 'utf8')).toContain('deps: [F-001, F-002]')
  })

  it('14) son satırda satır sonu ayracı yok', () => {
    const before = '---\nstatus: todo\n---'
    const full = writeFile(root, 'docs/features/G14.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G14.md', 'qa', hash)
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(full, 'utf8')).toBe('---\nstatus: qa\n---')
  })

  it('15) status : değer (iki nokta öncesi boşluk)', () => {
    const before = '---\nstatus : todo\n---\n'
    const full = writeFile(root, 'docs/features/G15.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G15.md', 'qa', hash)
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(full, 'utf8')).toBe('---\nstatus: qa\n---\n')
  })

  it('16) iki --- bloğu — ikinci blok gövdede, kendi status satırını taşıyor, yalnızca ilk değişmeli', () => {
    const before = '---\nstatus: todo\n---\nbody\n---\nstatus: nested\n---\n'
    const full = writeFile(root, 'docs/features/G16.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G16.md', 'qa', hash)
    expect(result.ok).toBe(true)
    const after = fs.readFileSync(full, 'utf8')
    expect(after).toContain('status: qa')
    expect(after).toContain('status: nested')
  })

  it("17) frontmatter'da status yok, gövdede girintisiz status: var → invalid_body, gövde değişmez", () => {
    const before = '---\ntitle: X\n---\nstatus: leaked\n'
    const full = writeFile(root, 'docs/features/G17.md', before)
    const hash = sha256(before)
    const result = setFeatureStatus(root, 'G17.md', 'qa', hash)
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
    expect(fs.readFileSync(full, 'utf8')).toBe(before)
  })
})

describe('writeGateApproval / writeGateDenial — yol beyaz listesi', () => {
  it("gate='G2' → docs/approvals/G2.ok yazılır", () => {
    const result = writeGateApproval(root, 'G2', 'onaylandı')
    expect(result.ok).toBe(true)
    expect(fs.readFileSync(path.join(root, 'docs', 'approvals', 'G2.ok'), 'utf8')).toBe('onaylandı')
  })

  it("gate='G7' → invalid_body", () => {
    const result = writeGateApproval(root, 'G7', 'x')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })

  it("gate='G2/../../x' → invalid_body", () => {
    const result = writeGateApproval(root, 'G2/../../x', 'x')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })

  it("gate='ASSETS' → docs/approvals/ASSETS.ok yazılır", () => {
    const result = writeGateApproval(root, 'ASSETS', 'x')
    expect(result.ok).toBe(true)
    expect(fs.existsSync(path.join(root, 'docs', 'approvals', 'ASSETS.ok'))).toBe(true)
  })

  it("gate='G4-2' → docs/approvals/G4-2.deny.md yazılır (gruplu gate)", () => {
    const result = writeGateDenial(root, 'G4-2', 'red')
    expect(result.ok).toBe(true)
    expect(fs.existsSync(path.join(root, 'docs', 'approvals', 'G4-2.deny.md'))).toBe(true)
  })

  it('boş body → invalid_body', () => {
    const result = writeGateApproval(root, 'G2', '')
    expect(result).toMatchObject({ ok: false, code: 'invalid_body' })
  })
})

describe('archiveDenial — yalnızca rename, no-op durumu', () => {
  it('.deny.md mevcut → arşive taşınır, kaynak yok olur, hedef içerik aynı', () => {
    writeFile(root, 'docs/approvals/G2.deny.md', 'red sebebi')
    const result = archiveDenial(root, 'G2')
    expect(result.ok).toBe(true)
    expect(fs.existsSync(path.join(root, 'docs', 'approvals', 'G2.deny.md'))).toBe(false)
    if (result.ok) {
      expect(fs.readFileSync(result.path, 'utf8')).toBe('red sebebi')
      expect(path.basename(result.path)).toMatch(
        /^G2-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.deny\.md$/
      )
    }
  })

  it('.deny.md yok → no-op, {ok:true, path:""}', () => {
    const result = archiveDenial(root, 'G3')
    expect(result).toEqual({ ok: true, path: '' })
  })

  it('üretilen arşiv adı kendi OPERATION_PATTERNS.archive desenine uyar (R1 kanıtı)', () => {
    writeFile(root, 'docs/approvals/G4-2.deny.md', 'x')
    const result = archiveDenial(root, 'G4-2')
    expect(result.ok).toBe(true)
  })

  // D36/Ö1 (QA KALDI turu, MQ4 emsali) — `mkdirSync`+`renameSync` zaten `try` İÇİNDE (kod
  // doğru), ama bunu ölçen hiçbir test yoktu: `docs/approvals/archive` hedefi bir DOSYAYLA işgal
  // edilmişse `mkdirSync(..., {recursive:true})` `EEXIST` fırlatır — sağlam kod bunu yakalayıp
  // `write_failed` döner. Bu try/catch kaldırılırsa (mutasyon) fonksiyon fırlar, bu test kırmızı
  // verir.
  it('arşiv hedef dizini bir dosyayla işgal edilmişse fırlamaz, write_failed döner (D36/Ö1)', () => {
    writeFile(root, 'docs/approvals/G2.deny.md', 'red sebebi')
    fs.writeFileSync(path.join(root, 'docs', 'approvals', 'archive'), 'ben bir dosyayım')
    expect(() => archiveDenial(root, 'G2')).not.toThrow()
    const result = archiveDenial(root, 'G2')
    expect(result).toMatchObject({ ok: false, code: 'write_failed' })
    // Kaynak `.deny.md` başarısız arşivlemede taşınmamış/silinmemiş olmalı.
    expect(fs.existsSync(path.join(root, 'docs', 'approvals', 'G2.deny.md'))).toBe(true)
  })

  // D37/Ö4 (QA KALDI turu, MQ5 emsali) — `OPERATION_PATTERNS.archive` yalnızca "fazla dar"
  // yönünde çitliydi (mutasyon 19, daraltma → kırmızı). Bu test GEVŞETME yönünü de çitler:
  // `archiveDenial`'ın ürettiği ad kendi zaman damgası biçimine uymuyorsa (burada `toISOString`
  // sahtelenerek zorlanıyor) adım 8 reddetmeli. Desen `.*`'a gevşetilirse bu test kırmızı verir.
  it('archiveDenial üretilen ad kendi ISO zaman damgası biçimine uymuyorsa write_denied döner (D37/Ö4)', () => {
    writeFile(root, 'docs/approvals/G2.deny.md', 'red sebebi')
    const spy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('not-a-valid-timestamp')
    try {
      const result = archiveDenial(root, 'G2')
      expect(result).toMatchObject({ ok: false, code: 'write_denied' })
      expect(fs.existsSync(path.join(root, 'docs', 'approvals', 'G2.deny.md'))).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('resolveInsideRoot adım 8 — işlem/yol eşleşmesi (R3, genel API üzerinden)', () => {
  it('writeGateApproval yalnızca approval şablonuna yazabilir (mutasyon 11 emsali, düz kullanım doğrulaması)', () => {
    const result = writeGateApproval(root, 'G2', 'x')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.path.split(path.sep).join('/')).toMatch(/docs\/approvals\/G2\.ok$/)
    }
  })
})
