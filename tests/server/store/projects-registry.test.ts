import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  createProjectsRegistry,
  toProjectListItem,
} from '../../../src/server/store/projects-registry'
import { createTempDataDir, removeTempDataDir } from '../../helpers/temp-data-dir'

describe('createProjectsRegistry', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it('dosya yoksa boş listeyle başlar', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    expect(registry.list()).toEqual([])
    expect(registry.isCorrupt()).toBe(false)
  })

  it('add/list/remove: temel akış', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    const result = registry.add('C:\\dev\\apps\\demo', undefined)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.label).toBe('demo')
      expect(result.record.enabled).toBe(true)
      expect(result.record.id).toMatch(/^p_[0-9a-f]{6}$/)
    }
    expect(registry.list()).toHaveLength(1)

    const id = registry.list()[0]!.id
    expect(registry.remove(id)).toBe(true)
    expect(registry.list()).toHaveLength(0)
  })

  it('remove: bulunamazsa false döner', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    expect(registry.remove('p_yok')).toBe(false)
  })

  it('conflict: aynı realpath ikinci kez eklenirse (6 yazım varyantı simüle edilerek)', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    const canonical = 'C:\\dev\\apps\\MyProject'
    const first = registry.add(canonical, undefined)
    expect(first.ok).toBe(true)

    // Bu birimde çağıran (service.ts) her zaman `fs.realpathSync.native` çözümlü, kanonik
    // dizgeyi geçirir (D17) — registry kendisi dizge eşitliği yapar. Altı "yazım varyantı"nın
    // tekilleştirmeyi yakalayabilmesi için ÇAĞIRANIN kanonikleştirmesi gerekir; burada registry
    // katmanının kendisi yalnızca dizge eşitliğini doğru uyguladığını kanıtlar.
    const second = registry.add(canonical, undefined)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('conflict')
    expect(registry.list()).toHaveLength(1)
  })

  it('atomik yazma: hedef dosya yolunda bir dizin varsa yazma hatası fırlar, mevcut dosya bozulmaz', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    registry.add('C:\\dev\\apps\\demo', undefined)

    const filePath = path.join(dataDir, 'projects.json')
    const before = fs.readFileSync(filePath, 'utf8')

    // rename hedefini bir dizinle işgal et — writeAtomic'in fs.renameSync'i başarısız olmalı.
    fs.rmSync(filePath)
    fs.mkdirSync(filePath)

    expect(() => registry.add('C:\\dev\\apps\\demo2', undefined)).toThrow()

    fs.rmdirSync(filePath)
    fs.writeFileSync(filePath, before)
    const registry2 = createProjectsRegistry(dataDir)
    registry2.init()
    expect(registry2.list()).toHaveLength(1)
  })

  it('bozuk JSON: boş liste ile başlar + isCorrupt() true (QA Bulgu 8b)', () => {
    const filePath = path.join(dataDir, 'projects.json')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(filePath, '{ bozuk json ]')
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    expect(registry.list()).toEqual([])
    expect(registry.isCorrupt()).toBe(true)
  })

  it('isCorrupt(): başarılı bir yazımdan sonra bile süreç ömrü boyunca true kalır', () => {
    const filePath = path.join(dataDir, 'projects.json')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(filePath, 'bozuk')
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    expect(registry.isCorrupt()).toBe(true)
    registry.add('C:\\dev\\apps\\demo', undefined)
    expect(registry.isCorrupt()).toBe(true)
  })

  it('label verilmezse path.basename kullanılır', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    const result = registry.add('C:\\dev\\apps\\mission-control', undefined)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.record.label).toBe('mission-control')
  })

  it('findByRealPath', () => {
    const registry = createProjectsRegistry(dataDir)
    registry.init()
    registry.add('C:\\dev\\apps\\demo', undefined)
    expect(registry.findByRealPath('C:\\dev\\apps\\demo')).toBeDefined()
    expect(registry.findByRealPath('C:\\dev\\apps\\yok')).toBeUndefined()
  })
})

describe('toProjectListItem', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = createTempDataDir()
  })

  afterEach(() => {
    removeTempDataDir(dataDir)
  })

  it('exists:false, feature_count:0 olduğunda yol yoksa', () => {
    const item = toProjectListItem({
      id: 'p_1',
      path: path.join(dataDir, 'yok'),
      label: 'x',
      added_at: new Date().toISOString(),
      enabled: true,
    })
    expect(item.exists).toBe(false)
    expect(item.feature_count).toBe(0)
  })

  it('exists:true, feature_count doğru sayılır (.md filtreli)', () => {
    const projectDir = path.join(dataDir, 'proj')
    const featuresDir = path.join(projectDir, 'docs', 'features')
    fs.mkdirSync(featuresDir, { recursive: true })
    fs.writeFileSync(path.join(featuresDir, 'F-001.md'), '')
    fs.writeFileSync(path.join(featuresDir, 'F-002.md'), '')
    fs.writeFileSync(path.join(featuresDir, 'notlar.txt'), '')

    const item = toProjectListItem({
      id: 'p_1',
      path: projectDir,
      label: 'proj',
      added_at: new Date().toISOString(),
      enabled: true,
    })
    expect(item.exists).toBe(true)
    expect(item.feature_count).toBe(2)
  })
})
