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
  it('üç OS matrisi var', () => {
    expect(ciContent).toContain('ubuntu-latest')
    expect(ciContent).toContain('windows-latest')
    expect(ciContent).toContain('macos-latest')
  })
})
