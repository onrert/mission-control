import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

function makeFixtureProject(prefix = 'mc-e2e-proj-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs', 'features', 'F-001.md'), '# F-001\n')
  return dir
}

interface ManifestEntry {
  relPath: string
  sha256: string
}

function snapshotManifest(root: string): ManifestEntry[] {
  const out: ManifestEntry[] = []
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else {
        out.push({
          relPath: path.relative(root, full),
          sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'),
        })
      }
    }
  }
  walk(root)
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

async function openSettings(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ayarlar' }).click()
  await expect(page.locator('[data-testid="settings-screen"]')).toBeVisible()
}

/** Test sonunda eklenen fixture proje dizinlerinin temizlenmesi için. */
const fixtureDirs: string[] = []

test.afterEach(() => {
  while (fixtureDirs.length > 0) {
    const dir = fixtureDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('gerçek proje ekleme: geçerli yol 5 sn içinde satır olarak görünür', async ({ page }) => {
  const project = makeFixtureProject()
  fixtureDirs.push(project)
  await openSettings(page)

  await page.getByLabel('Yeni proje yolu:').fill(project)
  await page.getByText('Ekle', { exact: true }).click()

  const row = page.locator('[data-testid="project-row"]', { hasText: path.basename(project) })
  await expect(row).toBeVisible({ timeout: 5000 })

  // temizlik: eklenen projeyi kaldır (sonraki testleri kirletmesin).
  await row.getByText('Kaldır').click()
  await expect(row).toHaveCount(0)
})

test('geçersiz yol: satır içi kırmızı hata görünür', async ({ page }) => {
  await openSettings(page)
  const missing = path.join(os.tmpdir(), `mc-e2e-yok-${Date.now()}`)

  await page.getByLabel('Yeni proje yolu:').fill(missing)
  await page.getByText('Ekle', { exact: true }).click()

  const error = page.locator('[data-testid="add-project-error"]')
  await expect(error).toBeVisible()
  await expect(error).toContainText('Bu yol bulunamadı.')
})

test('kaldırma: satır kalkar + fixture disk manifesti değişmez (CEO kararı C)', async ({
  page,
}) => {
  const project = makeFixtureProject()
  fixtureDirs.push(project)
  const before = snapshotManifest(project)

  await openSettings(page)
  await page.getByLabel('Yeni proje yolu:').fill(project)
  await page.getByText('Ekle', { exact: true }).click()

  const row = page.locator('[data-testid="project-row"]', { hasText: path.basename(project) })
  await expect(row).toBeVisible({ timeout: 5000 })

  await row.getByText('Kaldır').click()
  await expect(row).toHaveCount(0)

  const after = snapshotManifest(project)
  expect(after).toEqual(before)
})

test('3 proje ile Ayarlar tablosu 3 ayrı satır gösterir', async ({ page }) => {
  const projects = [makeFixtureProject(), makeFixtureProject(), makeFixtureProject()]
  fixtureDirs.push(...projects)

  const ids: string[] = []
  for (const p of projects) {
    const res = await page.request.post('/api/projects', {
      data: { path: p },
      headers: { 'x-mc-write': '1' },
    })
    expect(res.status()).toBe(201)
    const body = (await res.json()) as { data: { id: string } }
    ids.push(body.data.id)
  }

  await openSettings(page)
  await expect(page.locator('[data-testid="project-row"]')).toHaveCount(3, { timeout: 5000 })

  for (const id of ids) {
    await page.request.delete(`/api/projects/${id}`, { headers: { 'x-mc-write': '1' } })
  }
})

test('Ayarlar dişli düğmesi: click() sonrası gerçek hesaplanmış display değişir, aria-pressed güncellenir', async ({
  page,
}) => {
  await page.goto('/')
  const button = page.getByRole('button', { name: 'Ayarlar' })
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  const settingsDisplayBefore = await page
    .locator('#panel-settings')
    .evaluate((el) => getComputedStyle(el).display)
  expect(settingsDisplayBefore).toBe('none')

  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')

  const settingsDisplayAfter = await page
    .locator('#panel-settings')
    .evaluate((el) => getComputedStyle(el).display)
  expect(settingsDisplayAfter).not.toBe('none')

  const timelineDisplayAfter = await page
    .locator('#panel-timeline')
    .evaluate((el) => getComputedStyle(el).display)
  expect(timelineDisplayAfter).toBe('none')
})
