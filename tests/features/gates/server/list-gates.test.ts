import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getGateStatus, listGates } from '../../../../src/features/gates/server/list-gates'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'

const REAL_PROCESS_MD = `# PROCESS.md

## 2. Kapılar
| Kapı | Ne onaylanır | Zorlama |
|---|---|---|
| G0 Fikir | ... | ... |
| G1 PRD | ... | ... |
| G2 Mimari | ... | ... |
| G3 UX | ... | ... |
| ASSETS | Higgsfield kredi bütçesi | ... |
| G4 Kilometre taşı | ... | ... |
| G5 Güvenlik/kalite | ... | ... |
| G6 Yayın | ... | ... |

## 3. Eskalasyon
| 1. Persona Assignment | X | Y |
`

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

let root: string

beforeEach(() => {
  root = createTempDataDir()
  writeFile(root, 'docs/PROCESS.md', REAL_PROCESS_MD)
})

afterEach(() => {
  removeTempDataDir(root)
})

describe('listGates — AC1 durum türetme (F-008 sözleşmesi §3)', () => {
  it('dosya yoksa pending', () => {
    const result = listGates(root)
    const g0 = result.gates.find((g) => g.id === 'G0')
    expect(g0).toMatchObject({ id: 'G0', label: 'Fikir', status: 'pending' })
    expect(g0?.ok_date).toBeUndefined()
    expect(g0?.deny_date).toBeUndefined()
  })

  it('yalnızca .ok varsa approved + ok_date', () => {
    writeFile(root, 'docs/approvals/G1.ok', 'onaylandı')
    const result = listGates(root)
    const g1 = result.gates.find((g) => g.id === 'G1')
    expect(g1?.status).toBe('approved')
    expect(g1?.ok_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(g1?.deny_date).toBeUndefined()
  })

  it('yalnızca .deny.md varsa denied + deny_date', () => {
    writeFile(root, 'docs/approvals/G3.deny.md', 'red')
    const result = listGates(root)
    const g3 = result.gates.find((g) => g.id === 'G3')
    expect(g3?.status).toBe('denied')
    expect(g3?.deny_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('hem .ok hem .deny.md varsa conflict + newer_side (mtime tabanlı)', async () => {
    writeFile(root, 'docs/approvals/G2.deny.md', 'red')
    // .ok'un mtime'ı kesinlikle daha yeni olsun diye küçük bir gecikme.
    await new Promise((resolve) => setTimeout(resolve, 20))
    writeFile(root, 'docs/approvals/G2.ok', 'onay')
    const result = listGates(root)
    const g2 = result.gates.find((g) => g.id === 'G2')
    expect(g2?.status).toBe('conflict')
    expect(g2?.newer_side).toBe('ok')
    expect(g2?.ok_date).toBeDefined()
    expect(g2?.deny_date).toBeDefined()
  })

  it('ASSETS etiketi tek-kelimelik hücrede doğru türetilir (label = id)', () => {
    const result = listGates(root)
    const assets = result.gates.find((g) => g.id === 'ASSETS')
    expect(assets?.label).toBe('ASSETS')
  })

  it('PROCESS.md okunamazsa gömülü yedek etiketler kullanılır, process_doc_readable false', () => {
    fs.rmSync(path.join(root, 'docs', 'PROCESS.md'))
    const result = listGates(root)
    expect(result.process_doc_readable).toBe(false)
    const g2 = result.gates.find((g) => g.id === 'G2')
    expect(g2?.label).toBe('Mimari')
  })

  it('PROCESS.md bozuksa (tablo bulunamıyor) gömülü yedek + process_doc_readable false', () => {
    writeFile(root, 'docs/PROCESS.md', 'bu dosyada hiçbir markdown tablosu yok')
    const result = listGates(root)
    expect(result.process_doc_readable).toBe(false)
    const g0 = result.gates.find((g) => g.id === 'G0')
    expect(g0?.label).toBe('Fikir')
  })

  it('G4-N sayısal sıralamayla ASSETS ile G5 arasına eklenir (G4-10 > G4-2 > G4-1)', () => {
    writeFile(root, 'docs/approvals/G4-2.ok', 'onay')
    writeFile(root, 'docs/approvals/G4-10.ok', 'onay')
    writeFile(root, 'docs/approvals/G4-1.ok', 'onay')
    const result = listGates(root)
    const ids = result.gates.map((g) => g.id)
    const assetsIdx = ids.indexOf('ASSETS')
    const g5Idx = ids.indexOf('G5')
    expect(ids.slice(assetsIdx + 1, g5Idx)).toEqual(['G4-1', 'G4-2', 'G4-10'])
  })

  it('G4 dosyası hiç yoksa listede bare "G4 bekliyor" satırı UYDURULMAZ', () => {
    const result = listGates(root)
    expect(result.gates.some((g) => g.id === 'G4')).toBe(false)
  })

  it('unrecognized: README.md/archive/DANGER.ok/PUSH.ok/.gitkeep/.tmp dosyaları hariç tutulur', () => {
    writeFile(root, 'docs/approvals/README.md', 'belge')
    writeFile(root, 'docs/approvals/archive/G1-x.deny.md', 'arşiv')
    writeFile(root, 'docs/approvals/DANGER.ok', 'tek kullanımlık')
    writeFile(root, 'docs/approvals/PUSH.ok', 'tek kullanımlık')
    writeFile(root, 'docs/approvals/.gitkeep', '')
    writeFile(root, 'docs/approvals/.G1.ok.12345-abcdef.tmp', 'geçici')
    writeFile(root, 'docs/approvals/notlar.txt', 'gerçekten tanınmayan bir dosya')
    const result = listGates(root)
    expect(result.unrecognized).toEqual(['notlar.txt'])
  })

  describe('Windows harf duyarsızlığı (S2, QA Bulgu 1 düzeltmesi)', () => {
    it('yalnızca küçük harfli "g2.ok" varsa: G2 approved sayılır, unrecognized BOŞ kalır (split-brain YOK)', () => {
      writeFile(root, 'docs/approvals/g2.ok', 'küçük harf')
      const result = listGates(root)
      const g2 = result.gates.find((g) => g.id === 'G2')
      expect(g2?.status).toBe('approved')
      expect(result.unrecognized).toEqual([])
    })

    it('yalnızca küçük harfli "g5.deny.md" varsa: G5 denied sayılır, unrecognized BOŞ kalır', () => {
      writeFile(root, 'docs/approvals/g5.deny.md', 'küçük harf red')
      const result = listGates(root)
      const g5 = result.gates.find((g) => g.id === 'G5')
      expect(g5?.status).toBe('denied')
      expect(result.unrecognized).toEqual([])
    })

    it('karışık harfli "G4-1.OK" da G4-1 olarak tanınır (kanonik büyük harfe normalize)', () => {
      writeFile(root, 'docs/approvals/G4-1.OK', 'karışık harf')
      const result = listGates(root)
      const ids = result.gates.map((g) => g.id)
      expect(ids).toContain('G4-1')
      expect(result.unrecognized).toEqual([])
    })
  })

  it('tek bir dosyanın fs.statSync başarısız olması yalnızca o satırı etkiler (hata izolasyonu)', () => {
    writeFile(root, 'docs/approvals/G1.ok', 'onaylandı')
    writeFile(root, 'docs/approvals/G3.deny.md', 'red')
    const okPath = path.join(root, 'docs', 'approvals', 'G1.ok')
    const originalStatSync = fs.statSync.bind(fs)
    const spy = vi
      .spyOn(fs, 'statSync')
      .mockImplementation((...args: Parameters<typeof fs.statSync>) => {
        const target = args[0]
        if (typeof target === 'string' && path.resolve(target) === path.resolve(okPath)) {
          throw new Error('EACCES (simülasyon)')
        }
        return originalStatSync(...args)
      })
    try {
      const result = listGates(root)
      const g1 = result.gates.find((g) => g.id === 'G1')
      const g3 = result.gates.find((g) => g.id === 'G3')
      // Etkilenen satır: error:true, status güvenli varsayılan.
      expect(g1?.error).toBe(true)
      expect(g1?.status).toBe('pending')
      // Geri kalan satırlar (G3 dahil) normal çalışmaya devam eder.
      expect(g3?.error).toBeUndefined()
      expect(g3?.status).toBe('denied')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('getGateStatus — tek kapı yardımcısı', () => {
  it('listGates ile aynı sonucu üretir', () => {
    writeFile(root, 'docs/approvals/G6.ok', 'onay')
    const viaList = listGates(root).gates.find((g) => g.id === 'G6')
    const direct = getGateStatus(root, 'G6')
    expect(direct).toEqual(viaList)
  })
})
