import { describe, expect, it } from 'vitest'
import { isValidGateId, parseGateFileName } from '../../../../src/features/gates/shared/gate-id'

// S2 borç kapatma (`docs/blockers.md` "F-008 kapanışından taşınan iki borç" madde 2): QA'nın
// M4 mutasyonu (`gate-id.ts`'te `.toUpperCase()` kaldırılır) önceki turda 1077/1077 yeşil
// kalmıştı çünkü hiçbir test TAM KÜME eşitliği istemiyordu, yalnızca birkaç örnek (`g2.ok`,
// `g5.deny.md`) tek tek kontrol ediliyordu. Bu dosya kimlik listesini TEK bir kaynaktan —
// `isValidGateId` (gate kimliği tanımının kendisi, `GATE_ID_PATTERN`'in dışa açılan hâli) —
// türetir; sabit bir dizi elle kopyalanmadı. Kaynak pattern değişirse (ör. bir gün G7 eklenirse)
// bu süzgeç otomatik güncellenir, testi elle güncellemeyi gerektirmez.
function enumerateValidGateIds(): string[] {
  const candidates = new Set<string>(['ASSETS', 'assets'])
  for (let base = 0; base <= 9; base++) {
    candidates.add(`G${base}`)
    for (const suffix of [0, 1, 9, 42, 99, 100, 999, 1000]) {
      candidates.add(`G${base}-${suffix}`)
    }
  }
  // Kaynağın KENDİSİ (isValidGateId) neyin geçerli olduğuna karar verir — burada elle
  // seçilmiş bir alt küme YOK, yalnızca geniş bir aday uzayı süzülüyor.
  return [...candidates].filter(isValidGateId)
}

function alternateCase(value: string): string {
  return value
    .split('')
    .map((ch, i) => (i % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase()))
    .join('')
}

const VALID_IDS = enumerateValidGateIds()

describe('gate-id.ts — aday üretici öz-kontrolü', () => {
  it('kaynaktan (isValidGateId) süzülen küme beklenen temel örnekleri içerir ve boş değil', () => {
    expect(VALID_IDS.length).toBeGreaterThan(10)
    expect(VALID_IDS).toEqual(
      expect.arrayContaining(['G0', 'G2', 'G6', 'ASSETS', 'G2-1', 'G4-999'])
    )
    // Geçersiz adaylar (G7 taban dışı, -1000 üç haneyi aşıyor, "assets" küçük harf) süzgeçten
    // geçmemeli — bu, süzgecin GERÇEKTEN kaynağı kullandığının, her şeyi kabul etmediğinin kanıtı.
    expect(VALID_IDS).not.toContain('assets')
    expect(VALID_IDS).not.toContain('G7')
    expect(VALID_IDS).not.toContain('G2-1000')
  })
})

describe('gate-id.ts — parseGateFileName TAM KÜME normalizasyonu (S2)', () => {
  for (const id of VALID_IDS) {
    for (const kind of ['ok', 'deny'] as const) {
      const suffix = kind === 'ok' ? '.ok' : '.deny.md'
      const canonicalFileName = `${id}${suffix}`
      const variants = new Set<string>([
        canonicalFileName,
        canonicalFileName.toLowerCase(),
        canonicalFileName.toUpperCase(),
        alternateCase(canonicalFileName),
      ])
      for (const fileName of variants) {
        it(`"${fileName}" → { gateId: "${id}", kind: "${kind}" } olarak normalize edilir`, () => {
          const parsed = parseGateFileName(fileName)
          expect(parsed).toBeDefined()
          expect(parsed?.gateId).toBe(id)
          expect(parsed?.kind).toBe(kind)
        })
      }
    }
  }
})
