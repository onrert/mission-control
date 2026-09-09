import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// F-008 sözleşmesi §10.1/§11 — gerçek tarayıcı E2E: onay modalı iptal (fs değişmez, AC7), onay
// yazma (AC2), red (AC3/AC8), çelişkili durum [Detay] (AC4), canlı güncelleme (harici dosya
// yazımı → `gates-watcher.ts` → SSE → panel yenilenir, §7), dar genişlik (320/375/480px,
// CLAUDE.md dersi — `toBeVisible()` kaydırma kabında YALAN SÖYLER, kırpılmış görünür genişlikle
// ölçülür).

function makeFixtureProject(prefix = 'mc-e2e-gates-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  // `validate-path.ts` adım 8 — proje eklenebilmesi için `docs/features` var olmak ZORUNDA
  // (kanban.spec.ts/settings.spec.ts fixture'larıyla aynı gereksinim, gates'in kendi konusu
  // değil ama proje ekleme onsuz 400 `invalid_path` döner).
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'docs', 'approvals'), { recursive: true })
  return dir
}

async function addProject(page: Page, dir: string, label: string): Promise<string> {
  const res = await page.request.post('/api/projects', {
    data: { path: dir, label },
    headers: { 'x-mc-write': '1' },
  })
  expect(res.status()).toBe(201)
  const body = (await res.json()) as { data: { id: string } }
  return body.data.id
}

async function removeProject(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/projects/${id}`, { headers: { 'x-mc-write': '1' } })
}

async function openGatesTab(page: Page, projectLabel: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Kapılar' }).click()
  await expect(page.locator('[data-testid="gates-screen"]')).toBeVisible()
  await page.getByTestId('gates-project-select').selectOption({ label: projectLabel })
  await expect(page.getByTestId('gates-table')).toBeVisible()
}

/** F-007 dersi — `toBeVisible()` bir kaydırma kabında YALAN SÖYLER (kırpılmış görünür genişlik
 *  0 olsa bile `true` döner). `tests/e2e/kanban.spec.ts`'in `clippedVisibleWidth` yardımcısıyla
 *  BİREBİR aynı ölçüm yöntemi. */
async function clippedVisibleWidth(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    let left = rect.left
    let right = rect.right
    let node: HTMLElement | null = el.parentElement
    while (node) {
      const style = window.getComputedStyle(node)
      if (['auto', 'scroll', 'hidden'].includes(style.overflowX)) {
        const containerRect = node.getBoundingClientRect()
        left = Math.max(left, containerRect.left)
        right = Math.min(right, containerRect.right)
      }
      node = node.parentElement
    }
    left = Math.max(left, 0)
    right = Math.min(right, window.innerWidth)
    return Math.max(0, right - left)
  }, selector)
}

const fixtureDirs: string[] = []
const projectIds: string[] = []

test.afterEach(async ({ page }) => {
  while (projectIds.length > 0) {
    await removeProject(page, projectIds.pop()!)
  }
  while (fixtureDirs.length > 0) {
    fs.rmSync(fixtureDirs.pop()!, { recursive: true, force: true })
  }
})

test('onay modalı iptal → hiçbir dosya değişmez (AC7)', async ({ page }) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'gates-cancel')
  projectIds.push(id)

  await openGatesTab(page, 'gates-cancel')
  await page.getByTestId('gate-approve-G2').click()
  await expect(page.getByTestId('approve-modal')).toBeVisible()
  await page.getByTestId('approve-decision-input').fill('bu onay yazılmamalı')
  await page.getByTestId('approve-cancel-button').click()
  await expect(page.getByTestId('approve-modal')).not.toBeVisible()

  expect(fs.existsSync(path.join(dir, 'docs', 'approvals', 'G2.ok'))).toBe(false)
  expect(fs.readdirSync(path.join(dir, 'docs', 'approvals'))).toEqual([])
})

test('onay yazma (AC2): gerçek .ok dosyası PROCESS.md formatında oluşur, satır Onaylandı olur', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'gates-approve')
  projectIds.push(id)

  await openGatesTab(page, 'gates-approve')
  await page.getByTestId('gate-approve-G2').click()
  await page.getByTestId('approve-decision-input').fill('G2 onaylandı, ilerleyelim')
  await page.getByTestId('approve-confirm-button').click()

  await expect(page.getByTestId('gates-toast')).toHaveText('docs/approvals/G2.ok yazıldı')
  await expect(page.getByTestId('gate-locked-G2')).toHaveText('(kilitli)')

  const okPath = path.join(dir, 'docs', 'approvals', 'G2.ok')
  expect(fs.existsSync(okPath)).toBe(true)
  const content = fs.readFileSync(okPath, 'utf8')
  expect(content).toContain('G2 — Mimari kapısı ONAYLANDI')
  expect(content).toContain('Kullanıcının kararı: G2 onaylandı, ilerleyelim')
})

test('red (AC3/AC8): gerçek .deny.md dosyası oluşur, gerekçe olduğu gibi geçer, satır Reddedildi olur', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'gates-deny')
  projectIds.push(id)

  await openGatesTab(page, 'gates-deny')
  await page.getByTestId('gate-deny-G3').click()
  await page.getByTestId('deny-reason-input').fill('Bütçe onaylanmadı.')
  await page.getByTestId('deny-submit-button').click()

  await expect(page.getByTestId('gates-toast')).toHaveText('docs/approvals/G3.deny.md yazıldı')
  await expect(page.getByTestId('gate-approve-G3')).toBeVisible()

  const denyPath = path.join(dir, 'docs', 'approvals', 'G3.deny.md')
  expect(fs.existsSync(denyPath)).toBe(true)
  expect(fs.readFileSync(denyPath, 'utf8')).toContain('Bütçe onaylanmadı.')
})

test('çelişkili durum (AC4): [Detay] genişleyen alt satırda her iki tarih + sabit not gösterir', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  fs.writeFileSync(path.join(dir, 'docs', 'approvals', 'G1.ok'), 'onay')
  fs.writeFileSync(path.join(dir, 'docs', 'approvals', 'G1.deny.md'), 'red')
  const id = await addProject(page, dir, 'gates-conflict')
  projectIds.push(id)

  await openGatesTab(page, 'gates-conflict')
  const row = page.getByTestId('gate-row-G1')
  await expect(row).toContainText('Çelişkili durum')
  await expect(row.getByTestId('gate-approve-G1')).toHaveCount(0)
  await expect(row.getByTestId('gate-deny-G1')).toHaveCount(0)

  await page.getByTestId('gate-detail-G1').click()
  const detail = page.getByTestId('gate-detail-row-G1')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText(
    'Bu durum panelden düzeltilemez; dosyaları docs/approvals/ altında elle inceleyin.'
  )
})

test('canlı güncelleme (§7): harici dosya yazımı panel yenilenmeden görünür olur', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'gates-live')
  projectIds.push(id)

  await openGatesTab(page, 'gates-live')
  await expect(page.getByTestId('gate-approve-G5')).toBeVisible()

  // UI'dan DEĞİL, doğrudan dosya sistemine (bir "dış" değişikliği simüle eder — ör. CEO'nun
  // Bash/Write aracı) — `gates-watcher.ts` bunu görüp `gates` SSE kanalında yayınlamalı.
  fs.writeFileSync(
    path.join(dir, 'docs', 'approvals', 'G5.ok'),
    'G5 — Güvenlik/kalite kapısı ONAYLANDI\nTarih: 2026-09-09\n'
  )

  await expect(page.getByTestId('gate-locked-G5')).toBeVisible({ timeout: 5000 })
})

test.describe('Dar genişlik (320/375/480px) — kırpılmış görünür genişlik > 0', () => {
  for (const width of [320, 375, 480]) {
    test(`${width}px'te Kapılar sekmesi ve proje seçici kırpılmadan erişilebilir`, async ({
      page,
    }) => {
      const dir = makeFixtureProject()
      fixtureDirs.push(dir)
      const id = await addProject(page, dir, `gates-narrow-${width}`)
      projectIds.push(id)

      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')

      expect(await clippedVisibleWidth(page, '#tab-gates')).toBeGreaterThan(0)
      await page.getByRole('tab', { name: 'Kapılar' }).click()
      await expect(page.locator('[data-testid="gates-screen"]')).toBeVisible()

      await page
        .getByTestId('gates-project-select')
        .selectOption({ label: `gates-narrow-${width}` })
      await expect(page.getByTestId('gates-table')).toBeVisible()

      expect(
        await clippedVisibleWidth(page, '[data-testid="gates-project-select"]')
      ).toBeGreaterThan(0)

      // Kapı tablosu 4 sütunludur (Kapı/Durum/Tarih/Aksiyon); 320-480px'te AKSİYON sütununun
      // kırpılmadan görünmesi gerekmez (`overflow-x-auto` sarmalayıcı zaten kanban tahtasıyla
      // AYNI, bilinçli kabul edilen desen — bkz. `GatesScreen.tsx`) — asıl kanıt, Playwright'ın
      // gerçek bir tıklama için elementi GÖRÜNÜR ALANA kaydırıp (`scrollIntoViewIfNeeded`)
      // tıklayabildiğidir (F-007 dersi yalnızca sekme çubuğu/dişli gibi asla kaydırmadan
      // ULAŞILAMAYAN öğeler için "kırpılmış genişlik > 0" iddiası gerektirir).
      await page.getByTestId('gate-approve-G2').click()
      await expect(page.getByTestId('approve-modal')).toBeVisible()
      await page.getByTestId('approve-cancel-button').click()
    })
  }
})
