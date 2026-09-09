import { describe, expect, it } from 'vitest'
import {
  buildApprovalBody,
  buildDenialBody,
} from '../../../../src/features/gates/shared/format-approval'

describe('buildApprovalBody — golden string (F-008 sözleşmesi §5)', () => {
  it('§5 örneğiyle birebir eşleşir', () => {
    const body = buildApprovalBody(
      'G2',
      'Mimari',
      'mission-control',
      '2026-09-09',
      '<kullanıcının yazdığı serbest metin, olduğu gibi>'
    )
    expect(body).toBe(
      'G2 — Mimari kapısı ONAYLANDI\n' +
        'Tarih: 2026-09-09\n' +
        'Onaylayan: Panel kullanıcısı (Kapılar ekranı, iki adımlı onay)\n\n' +
        'Onaylanan özet: Panel Kapılar ekranından "G2 — Mimari" kapısı onaylandı ' +
        '(proje: mission-control).\n\n' +
        'Kullanıcının kararı: <kullanıcının yazdığı serbest metin, olduğu gibi>\n'
    )
  })

  it('AC8/M7: kullanıcı metni (satır sonu + özel karakterler dahil) olduğu gibi geçer, kırpılmaz/kaçırılmaz', () => {
    const decision = 'Satır 1\nSatır 2 — "tırnak" & <etiket> % 100'
    const body = buildApprovalBody('G5', 'Güvenlik/kalite', 'proje-x', '2026-01-01', decision)
    expect(body).toContain(`Kullanıcının kararı: ${decision}\n`)
  })
})

describe('buildDenialBody — golden string (F-008 sözleşmesi §5)', () => {
  it('§5 örneğiyle birebir eşleşir', () => {
    const body = buildDenialBody(
      'G2',
      'Mimari',
      'mission-control',
      '2026-09-09',
      '<kullanıcının yazdığı gerekçe, olduğu gibi>'
    )
    expect(body).toBe(
      '# G2 — Mimari kapısı REDDEDİLDİ\n\n' +
        '- **Tarih:** 2026-09-09\n' +
        '- **Reddeden:** Panel kullanıcısı (Kapılar ekranı)\n' +
        '- **Proje:** mission-control\n\n' +
        '## Red gerekçesi\n\n' +
        '<kullanıcının yazdığı gerekçe, olduğu gibi>\n'
    )
  })

  it('AC8/M7: red gerekçesi (satır sonu dahil) olduğu gibi geçer', () => {
    const reason = 'Birinci satır\nİkinci satır'
    const body = buildDenialBody('G3', 'UX', 'proje-y', '2026-02-02', reason)
    expect(body).toContain(`## Red gerekçesi\n\n${reason}\n`)
  })
})
