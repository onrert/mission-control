import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import {
  parseFeatureCard,
  extractFeatureBody,
  splitFrontmatter,
} from '../../../../src/features/kanban/server/parse-feature'
import { setFeatureStatus } from '../../../../src/server/write-gate'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'
import fs from 'node:fs'
import path from 'node:path'

function sha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

describe('parseFeatureCard — AC1 (durum → sütun)', () => {
  it.each(['todo', 'contract', 'dev', 'qa', 'fix', 'done', 'blocked'])(
    'status: %s → column aynı değer',
    (status) => {
      const buf = Buffer.from(
        `---\nid: F-001\ntitle: Başlık\nstatus: ${status}\nowner: developer\ndeps: []\nsprint: 1\n---\nbody\n`
      )
      const card = parseFeatureCard(buf, 'p1', 'F-001.md', 1000)
      expect(card.status).toBe(status)
      expect(card.column).toBe(status)
      expect(card.parse_error).toBeUndefined()
    }
  )

  it('AC6: tanınmayan status değeri → column "unknown"', () => {
    const buf = Buffer.from('---\nstatus: "in-review"\n---\n')
    const card = parseFeatureCard(buf, 'p1', 'F-011.md', 1000)
    expect(card.column).toBe('unknown')
    expect(card.status).toBe('in-review')
    expect(card.parse_error).toBeUndefined()
  })

  it("numara alanları (sprint) string'e çevrilir", () => {
    const buf = Buffer.from('---\nstatus: todo\nsprint: 1\n---\n')
    const card = parseFeatureCard(buf, 'p1', 'F-001.md', 1000)
    expect(card.sprint).toBe('1')
  })

  it('id/title yoksa dosya adından türetilir', () => {
    const buf = Buffer.from('---\nstatus: todo\n---\n')
    const card = parseFeatureCard(buf, 'p1', 'F-042.md', 1000)
    expect(card.id).toBe('F-042')
    expect(card.title).toBe('F-042')
  })

  it('deps dizisi korunur', () => {
    const buf = Buffer.from('---\nstatus: todo\ndeps: [F-005, F-006]\n---\n')
    const card = parseFeatureCard(buf, 'p1', 'F-007.md', 1000)
    expect(card.deps).toEqual(['F-005', 'F-006'])
  })

  it('frontmatter yok → parse_error dolu, id/title dosya adından, column unknown (mutasyon 11 emsali)', () => {
    const buf = Buffer.from('# başlık\nsıradan içerik\n')
    const card = parseFeatureCard(buf, 'p1', 'F-099.md', 1000)
    expect(card.parse_error).toBeTruthy()
    expect(card.column).toBe('unknown')
    expect(card.id).toBe('F-099')
    expect(card.title).toBe('F-099')
  })

  it('frontmatter kapanışı yok → parse_error dolu', () => {
    const buf = Buffer.from('---\nstatus: todo\nbody devam ediyor\n')
    const card = parseFeatureCard(buf, 'p1', 'F-098.md', 1000)
    expect(card.parse_error).toBeTruthy()
  })

  it('bozuk YAML (dengesiz köşeli parantez, blok koleksiyonunda) → parse_error dolu, fırlamaz', () => {
    const buf = Buffer.from('---\nstatus: todo\ndeps: [F-005, F-006\n---\n')
    expect(() => parseFeatureCard(buf, 'p1', 'F-097.md', 1000)).not.toThrow()
    const card = parseFeatureCard(buf, 'p1', 'F-097.md', 1000)
    expect(card.parse_error).toBeTruthy()
  })

  it('BOM + CRLF frontmatter doğru ayrıştırılır', () => {
    const buf = Buffer.from('﻿---\r\nstatus: qa\r\n---\r\nbody\r\n', 'utf8')
    const card = parseFeatureCard(buf, 'p1', 'F-005.md', 1000)
    expect(card.status).toBe('qa')
    expect(card.parse_error).toBeUndefined()
  })

  it('content_hash = sha256(tam dosya baytları), hex', () => {
    const buf = Buffer.from('---\nstatus: todo\n---\n')
    const card = parseFeatureCard(buf, 'p1', 'F-001.md', 1000)
    expect(card.content_hash).toBe(sha256(buf))
  })
})

describe('parseFeatureCard — content_hash çapraz-modül tutarlılığı (§3 madde 2, QA tur 1 bulgu 3 düzeltmesi)', () => {
  let root: string

  it("parse-feature.ts'in ürettiği content_hash, gerçek setFeatureStatus tarafından expected_hash olarak kabul edilir (davranışsal test)", async () => {
    root = createTempDataDir()
    try {
      const relPath = path.join('docs', 'features', 'F-001.md')
      const full = path.join(root, relPath)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      const content = '---\nid: F-001\nstatus: todo\n---\nbody\n'
      fs.writeFileSync(full, content)
      const buffer = fs.readFileSync(full)
      const card = parseFeatureCard(buffer, 'p1', 'F-001.md', 1000)

      // Hash test içinde YENİDEN HESAPLANMIYOR — doğrudan gerçek setFeatureStatus'a verilir.
      // Hash kaynağı yanlış olsaydı (ör. yalnızca frontmatter bloğundan) write-gate bunu
      // `conflict` olarak reddederdi ve bu assert KIRMIZI verirdi (§8 mutasyon 13).
      const result = await setFeatureStatus(root, 'F-001.md', 'qa', card.content_hash)
      expect(result.ok).toBe(true)
    } finally {
      removeTempDataDir(root)
    }
  })
})

describe('extractFeatureBody — F-013 sözleşme §2 (frontmatter sonrası gövde)', () => {
  it('frontmatter sonrası tüm markdown döner, açılış boş satırı atılır', () => {
    const buf = Buffer.from('---\nstatus: todo\n---\n\n## Başlık\nParagraf.\n')
    expect(extractFeatureBody(buf)).toBe('## Başlık\nParagraf.\n')
  })

  it('CRLF ile de doğru ayrılır', () => {
    const buf = Buffer.from('---\r\nstatus: todo\r\n---\r\nGövde satırı.\r\n')
    expect(extractFeatureBody(buf)).toBe('Gövde satırı.\r\n')
  })

  it('frontmatter bulunamazsa TÜM ham metin döner (panel boş kalmaz)', () => {
    const buf = Buffer.from('# başlık\nsıradan içerik\n')
    expect(extractFeatureBody(buf)).toBe('# başlık\nsıradan içerik\n')
  })

  it('frontmatter kapanışı yoksa TÜM ham metin döner', () => {
    const buf = Buffer.from('---\nstatus: todo\nbody devam ediyor\n')
    expect(extractFeatureBody(buf)).toBe('---\nstatus: todo\nbody devam ediyor\n')
  })

  it('splitFrontmatter — açılış/kapanış eksikliği ayrı ayrı ayırt edilir', () => {
    expect(splitFrontmatter('# yok').ok).toBe(false)
    expect(splitFrontmatter('---\nx: 1\nsınırsız').ok).toBe(false)
    const ok = splitFrontmatter('---\nx: 1\n---\ngövde')
    // `block` YAML ayrıştırıcıya (`parseYaml`) verilmeden önce baştaki `\n`'i KORUR (mevcut
    // `parseFeatureCard` davranışıyla birebir aynı — YAML boş satırı yok sayar, sorun değil).
    expect(ok).toEqual({ ok: true, block: '\nx: 1', body: 'gövde' })
  })
})
