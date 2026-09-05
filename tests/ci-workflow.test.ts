import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ciPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml')
const ciContent = fs.readFileSync(ciPath, 'utf8')

describe('.github/workflows/ci.yml (AC9)', () => {
  it('push tetikleyicisi var', () => {
    expect(ciContent).toContain('on:')
    expect(ciContent).toContain('push')
  })
  it('npm ci adımı var', () => {
    expect(ciContent).toContain('npm ci')
  })
  it('npm run verify adımı var', () => {
    expect(ciContent).toContain('npm run verify')
  })
  // ADR-009: desteklenen tek platform Windows. Matris kasıtlı olarak kaldırıldı.
  // Negatif iddialar önemli: matris geri sızarsa (ör. bir şablondan kopyalanarak)
  // desteklemediğimiz platformların hataları CI'ı kırmızıya boyar.
  it('yalnızca windows-latest üzerinde koşar', () => {
    expect(ciContent).toContain('windows-latest')
    expect(ciContent).not.toContain('ubuntu-latest')
    expect(ciContent).not.toContain('macos-latest')
    expect(ciContent).not.toContain('matrix:')
  })

  // F-003 CEO kararı D2: verify hızlı kalmalı (E2E'siz), E2E ayrı bağımsız bir job'da koşmalı.
  it("bağımsız bir e2e job'ı var: playwright kurulur, npm run e2e çalışır", () => {
    expect(ciContent).toContain('e2e:')
    expect(ciContent).toContain('playwright install')
    expect(ciContent).toContain('npm run e2e')
  })

  it("verify job bloğu npm run e2e İÇERMEZ (E2E verify'a sızmadı)", () => {
    // YAML parser eklemeden (kapalı bağımlılık listesi, Bulgu 14 gerekçesiyle aynı disiplin):
    // `verify:` job'ının başladığı satırdan `e2e:` job'ının başladığı satıra kadarki dilimi al.
    const verifyStart = ciContent.indexOf('verify:')
    const e2eStart = ciContent.indexOf('e2e:')
    expect(verifyStart).toBeGreaterThanOrEqual(0)
    expect(e2eStart).toBeGreaterThan(verifyStart)
    const verifyBlock = ciContent.slice(verifyStart, e2eStart)
    expect(verifyBlock).not.toContain('npm run e2e')
  })
})
