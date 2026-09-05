import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  listFeaturesForProject,
  listFeatures,
} from '../../../../src/features/kanban/server/list-features'
import { createTempDataDir, removeTempDataDir } from '../../../helpers/temp-data-dir'
import type { ProjectListItem } from '../../../../src/shared/types'

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function projectItem(overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p1',
    path: '',
    label: 'proje',
    added_at: new Date().toISOString(),
    enabled: true,
    exists: true,
    feature_count: 0,
    ...overrides,
  }
}

let root: string

beforeEach(() => {
  root = createTempDataDir()
})

afterEach(() => {
  removeTempDataDir(root)
})

describe('listFeaturesForProject', () => {
  it('docs/features yoksa boş dizi döner (hata değil)', () => {
    const cards = listFeaturesForProject(projectItem({ path: root }))
    expect(cards).toEqual([])
  })

  it('karışık geçerli/bozuk dosyaları hepsini döner, hiçbiri diğerini engellemez', () => {
    writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    writeFile(root, 'docs/features/F-002.md', 'bozuk içerik, frontmatter yok')
    writeFile(root, 'docs/features/F-003.md', '---\nstatus: qa\n---\n')
    const cards = listFeaturesForProject(projectItem({ path: root }))
    expect(cards.length).toBe(3)
    const byFile = new Map(cards.map((c) => [c.file, c]))
    expect(byFile.get('F-001.md')?.status).toBe('todo')
    expect(byFile.get('F-002.md')?.parse_error).toBeTruthy()
    expect(byFile.get('F-003.md')?.status).toBe('qa')
  })

  it('.md olmayan dosyalar atlanır (mutasyon 2)', () => {
    writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    writeFile(root, 'docs/features/notes.txt', 'ilgisiz dosya')
    writeFile(root, 'docs/features/README', 'uzantısız dosya')
    const cards = listFeaturesForProject(projectItem({ path: root }))
    expect(cards.length).toBe(1)
    expect(cards[0]?.file).toBe('F-001.md')
  })

  it('alt dizine inilmez (depth:0)', () => {
    writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    writeFile(root, 'docs/features/archive/F-old.md', '---\nstatus: done\n---\n')
    const cards = listFeaturesForProject(projectItem({ path: root }))
    expect(cards.length).toBe(1)
    expect(cards[0]?.file).toBe('F-001.md')
  })

  it('project_id her karta etiketlenir', () => {
    writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    const cards = listFeaturesForProject(projectItem({ path: root, id: 'p_xyz' }))
    expect(cards[0]?.project_id).toBe('p_xyz')
  })
})

describe('listFeatures — çoklu proje', () => {
  it('yalnızca exists:true projeler taranır', () => {
    writeFile(root, 'docs/features/F-001.md', '---\nstatus: todo\n---\n')
    const projects = [
      projectItem({ id: 'p1', path: root, exists: true }),
      projectItem({ id: 'p2', path: path.join(root, 'nope'), exists: false }),
    ]
    const cards = listFeatures(projects)
    expect(cards.length).toBe(1)
    expect(cards[0]?.project_id).toBe('p1')
  })
})
