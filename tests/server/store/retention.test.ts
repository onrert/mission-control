import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  isInsideDataRoot,
  pruneByCount,
  pruneByDays,
  runRetentionOnce,
} from '../../../src/server/store/retention'
import { dayFileName } from '../../../src/server/store/jsonl-store'
import { createTempDataDir, removeTempDataDir } from '../../helpers/temp-data-dir'

describe('isInsideDataRoot', () => {
  let root: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-root-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('hedef root altındaki gerçek bir dosyaysa true', () => {
    const sub = path.join(root, 'events')
    fs.mkdirSync(sub)
    const file = path.join(sub, '2026-09-04.jsonl')
    fs.writeFileSync(file, '{}')
    expect(isInsideDataRoot(root, file)).toBe(true)
  })

  it('hedef tamamen ayrı, mutlak yollu bir dizindeyse false', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-other-'))
    try {
      const file = path.join(other, 'victim.jsonl')
      fs.writeFileSync(file, '{}')
      expect(isInsideDataRoot(root, file)).toBe(false)
    } finally {
      fs.rmSync(other, { recursive: true, force: true })
    }
  })

  it('kardeş önek tuzağı: root+"-sibling" gerçek bir dizin olsa da false (startsWith tuzağı)', () => {
    const sibling = `${root}-sibling`
    fs.mkdirSync(sibling)
    try {
      const victim = path.join(sibling, 'victim.jsonl')
      fs.writeFileSync(victim, '{}')
      expect(isInsideDataRoot(root, victim)).toBe(false)
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true })
    }
  })

  it('".." ile kökün dışına çıkan gerçek bir hedef false', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-outside-'))
    try {
      const evil = path.join(outside, 'evil.jsonl')
      fs.writeFileSync(evil, '{}')
      const sub = path.join(root, 'events')
      fs.mkdirSync(sub)
      const traversal = path.join(sub, '..', '..', path.basename(outside), 'evil.jsonl')
      expect(isInsideDataRoot(root, traversal)).toBe(false)
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }
  })

  it('karışık ayraç ve büyük/küçük harf farkıyla verilen ama gerçekte root altındaki hedef true', () => {
    const sub = path.join(root, 'events')
    fs.mkdirSync(sub)
    const file = path.join(sub, 'target.jsonl')
    fs.writeFileSync(file, '{}')
    const mixed = file.split(path.sep).join('/').toUpperCase()
    expect(isInsideDataRoot(root, mixed)).toBe(true)
  })

  it('var olmayan hedef için false (realpath başarısız)', () => {
    expect(isInsideDataRoot(root, path.join(root, 'events', 'nope.jsonl'))).toBe(false)
  })
})

describe('pruneByDays', () => {
  let dataRoot: string
  let eventsDir: string

  beforeEach(() => {
    dataRoot = createTempDataDir()
    eventsDir = path.join(dataRoot, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
  })

  afterEach(() => {
    removeTempDataDir(dataRoot)
  })

  it('MC_RETENTION_DAYS aşan gün dosyaları silinir, aktif dosya kalır', () => {
    const now = new Date('2026-09-04T12:00:00.000Z')
    const oldFile = dayFileName(new Date('2026-08-01T00:00:00.000Z'))
    const recentFile = dayFileName(new Date('2026-09-03T00:00:00.000Z'))
    const activeFile = dayFileName(now)

    for (const name of [oldFile, recentFile, activeFile]) {
      fs.writeFileSync(path.join(eventsDir, name), '{}\n')
    }

    const deleted = pruneByDays(dataRoot, now, 30)
    expect(deleted).toEqual([oldFile])
    expect(fs.existsSync(path.join(eventsDir, oldFile))).toBe(false)
    expect(fs.existsSync(path.join(eventsDir, recentFile))).toBe(true)
    expect(fs.existsSync(path.join(eventsDir, activeFile))).toBe(true)
  })

  it('aktif dosya retentionDays=0 olsa bile asla silinmez', () => {
    const now = new Date('2026-09-04T12:00:00.000Z')
    const activeFile = dayFileName(now)
    fs.writeFileSync(path.join(eventsDir, activeFile), '{}\n')
    pruneByDays(dataRoot, now, 0)
    expect(fs.existsSync(path.join(eventsDir, activeFile))).toBe(true)
  })

  it('yalnızca YYYY-MM-DD.jsonl desenine uyan dosyalara dokunulur; .seq ve yabancı dosyalar hiç silinmez (desen çiti, Ö2)', () => {
    // QA düzeltme turu 1 — Bulgu Ö2: `DAY_FILE_PATTERN` çiti hiçbir testte ölçülmüyordu;
    // mutasyonla kaldırıldığında `.seq` bile silinebiliyordu ve 133/133 test yine yeşil
    // kalıyordu. Bu test, deseni hem `listDayFilesAscending` hem `safeDelete` katmanında
    // ölçer: `.seq` alfabetik olarak her cutoff tarihinden KÜÇÜK olduğu için (`.` < `2`),
    // desen çiti kaldırılırsa döngü onu da silmeye çalışır.
    const now = new Date('2026-09-04T12:00:00.000Z')
    const oldFile = dayFileName(new Date('2026-08-01T00:00:00.000Z'))
    const activeFile = dayFileName(now)
    fs.writeFileSync(path.join(eventsDir, oldFile), '{}\n')
    fs.writeFileSync(path.join(eventsDir, activeFile), '{}\n')
    fs.writeFileSync(path.join(eventsDir, '.seq'), '42')
    fs.writeFileSync(path.join(eventsDir, 'notlar.txt'), 'yabanci dosya, gun dosyasi degil')

    const deleted = pruneByDays(dataRoot, now, 30)

    expect(deleted).toEqual([oldFile])
    expect(fs.existsSync(path.join(eventsDir, oldFile))).toBe(false)
    expect(fs.existsSync(path.join(eventsDir, '.seq'))).toBe(true)
    expect(fs.readFileSync(path.join(eventsDir, '.seq'), 'utf8')).toBe('42')
    expect(fs.existsSync(path.join(eventsDir, 'notlar.txt'))).toBe(true)
  })
})

describe('pruneByCount — ring MC_RING_SIZE altında kalsa bile toplam doğru hesaplanır (Bulgu 4)', () => {
  let dataRoot: string
  let eventsDir: string

  beforeEach(() => {
    dataRoot = createTempDataDir()
    eventsDir = path.join(dataRoot, 'events')
    fs.mkdirSync(eventsDir, { recursive: true })
  })

  afterEach(() => {
    removeTempDataDir(dataRoot)
  })

  it('3 gün dosyası x 5 olay = 15 toplam, MC_RETENTION_EVENTS=10 iken en eski dosyalar silinir', () => {
    const now = new Date('2026-09-04T12:00:00.000Z')
    const days = [
      dayFileName(new Date('2026-09-02T00:00:00.000Z')),
      dayFileName(new Date('2026-09-03T00:00:00.000Z')),
      dayFileName(now), // aktif gün
    ]
    const lineCounts = new Map<string, number>()
    for (const file of days) {
      const lines = Array.from({ length: 5 }, (_, i) => JSON.stringify({ seq: i })).join('\n')
      fs.writeFileSync(path.join(eventsDir, file), `${lines}\n`)
      lineCounts.set(file.replace(/\.jsonl$/, ''), 5)
    }

    const deleted = pruneByCount(dataRoot, now, lineCounts, 10)
    expect(deleted.length).toBeGreaterThanOrEqual(1)
    expect(deleted).toContain(days[0])
    // aktif dosya asla silinmez
    expect(fs.existsSync(path.join(eventsDir, days[2]!))).toBe(true)
    const remainingTotal = Array.from(lineCounts.values()).reduce((sum, n) => sum + n, 0)
    expect(remainingTotal).toBeLessThanOrEqual(10)
  })

  it('runRetentionOnce gün + adet budamasını doğru sırada uygular', () => {
    const now = new Date('2026-09-04T12:00:00.000Z')
    const veryOld = dayFileName(new Date('2026-01-01T00:00:00.000Z'))
    const recent = dayFileName(new Date('2026-09-03T00:00:00.000Z'))
    const active = dayFileName(now)
    const lineCounts = new Map<string, number>()
    for (const file of [veryOld, recent, active]) {
      fs.writeFileSync(path.join(eventsDir, file), '{}\n{}\n{}\n{}\n{}\n')
      lineCounts.set(file.replace(/\.jsonl$/, ''), 5)
    }
    runRetentionOnce(dataRoot, { lineCounts }, { retentionDays: 30, retentionEvents: 6 }, now)
    // gün bazlı budama veryOld'u siler; adet bazlı budama recent'i de silebilir (kalan 5 <= 6? 5<=6 durur)
    expect(fs.existsSync(path.join(eventsDir, veryOld))).toBe(false)
    expect(fs.existsSync(path.join(eventsDir, active))).toBe(true)
  })
})
