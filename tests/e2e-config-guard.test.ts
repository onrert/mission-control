import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// F-007 sözleşme §2.1 (D40) — QA tur 1 bulgu 4 (BLOKLAYICI) çiti, QA tur 2 YENİ-R2 düzeltmesiyle
// iki-config OR mantığına çevrildi. `playwright.config.ts`'in `testMatch` alanı KAPALI bir liste
// (dizi) — F-003/F-005'te olduğu gibi yeni bir `tests/e2e/*.spec.ts` dosyası eklenip bu listeye
// eklenmesi unutulursa, dosya sessizce hiç koşmaz ve o dosyaya atanan tüm AC/taahhütler ölü doğar.
// Bu Vitest birim testi (Playwright değil — `npm test`'in her koşusunda hızlıca çalışır) her spec
// dosya adının EN AZ BİR `playwright*.config.ts` dosyasının metninde geçtiğini doğrular (OR
// mantığı) — `tests/e2e/dev-shell.spec.ts` bilinçli olarak yalnızca `playwright.dev.config.ts`'e
// (npm run e2e:dev) bağlıdır, ana koşuya değil; tek-config guard bunu yanlış pozitif olarak
// işaretlerdi (QA tur 2'de ölçüldü).
//
// F-012 F6 düzeltmesi — config listesi ARTIK repo köküne `readdirSync` ile YAPISAL olarak
// bulunuyor (sabit iki dosyalık dizi DEĞİL): `playwright.chat.config.ts` eklendiğinde
// (`tests/e2e/chat.spec.ts` için) bu guard onu OTOMATİK kapsıyor — B1'in `@source` yapısal
// çitiyle AYNI ders (CLAUDE.md: bu hata sınıfı feature-bazlı sabit listelerde tekrar ediyor).
//
// Bilinen sınırlar (düzeltme istenmiyor, kayıt — QA tur 2 ölçümü):
// (a) dosya adı bir config'in YORUM SATIRINDA geçerse guard YEŞİL kalır (yanlış negatif) —
//     pratikte config dosyalarında `testMatch` dışında böyle bir yorum yok, kabul edilen sınır.
// (b) `testMatch` bir glob'a (ör. `'**/*.spec.ts'`) çevrilirse glob metni spec dosya adını literal
//     içermediği için guard her spec'i "eksik" sayıp KIRMIZI verir (yanlış pozitif) — bu yön
//     güvenlidir (gereksiz bir kırmızı, unutulan bir spec'ten daha ucuzdur), düzeltmesi tek satır
//     (config'e dosya adını literal eklemek).

const repoRoot = path.join(__dirname, '..')
const e2eDir = path.join(repoRoot, 'tests', 'e2e')

function specFileNames(): string[] {
  return fs.readdirSync(e2eDir).filter((f) => f.endsWith('.spec.ts'))
}

function configFileNames(): string[] {
  return fs
    .readdirSync(repoRoot)
    .filter(
      (f) => /^playwright.*\.config\.ts$/.test(f) && fs.statSync(path.join(repoRoot, f)).isFile()
    )
}

function readConfigs(): string[] {
  return configFileNames().map((f) => fs.readFileSync(path.join(repoRoot, f), 'utf8'))
}

describe('E2E config guard (D40) — her tests/e2e/*.spec.ts dosyası en az bir Playwright config tarafından koşuluyor', () => {
  it('repo kökünde en az bir playwright*.config.ts var (guard boş listede sessizce geçmesin)', () => {
    expect(configFileNames().length).toBeGreaterThan(0)
  })

  it('tests/e2e dizininde en az bir spec dosyası var (guard boş listede sessizce geçmesin)', () => {
    expect(specFileNames().length).toBeGreaterThan(0)
  })

  const specs = specFileNames()
  const configs = readConfigs()

  it.each(specs)('%s en az bir config metninde (testMatch) geçiyor', (spec) => {
    const coveredByAtLeastOne = configs.some((configText) => configText.includes(spec))
    if (!coveredByAtLeastOne) {
      throw new Error(
        `tests/e2e/${spec} ne playwright.config.ts ne de playwright.dev.config.ts içinde ` +
          `geçiyor — bu dosya hiçbir Playwright koşusunda ÇALIŞMAZ. testMatch listesine ekleyin.`
      )
    }
    expect(coveredByAtLeastOne).toBe(true)
  })
})
