import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// F-010 sözleşmesi §5 — gerçek tarayıcı E2E: gerçek proje ekleme, sekme açma, kronolojik bölüm
// görünürlüğü (AC1), dar genişlik (320/375/480, `clippedVisibleWidth`, CLAUDE.md dersi —
// `toBeVisible()` KULLANILMAZ), tek kaydırma bağlamı (iç içe `overflow` kabı sayısı ölçülür, W7).

function makeFixtureProject(prefix = 'mc-e2e-thread-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'docs', 'qa'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'docs', 'features', 'F-004.md'),
    '---\nid: F-004\ntitle: Kanban paneli\nstatus: qa\n---\nF-004: kanban sürükle-bırak…\n'
  )
  fs.writeFileSync(path.join(dir, 'docs', 'qa', 'F-004-contract.md'), 'Uygulandı, testler yeşil…\n')
  fs.writeFileSync(
    path.join(dir, 'docs', 'qa', 'F-004-2026-09-05.md'),
    'KARAR: KALDI\nÇakışma senaryosu test edilmemiş…\n'
  )
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

async function openThreadTab(page: Page, projectLabel: string, featureLabel: string) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Thread' }).click()
  await expect(page.locator('[data-testid="thread-screen"]')).toBeVisible()
  await page.getByTestId('thread-project-select').selectOption({ label: projectLabel })
  await page.getByTestId('thread-feature-select').selectOption({ label: featureLabel })
  await expect(page.getByTestId('thread-sections')).toBeVisible()
}

/** F-007 dersi — `toBeVisible()` bir kaydırma kabında YALAN SÖYLER. */
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

/**
 * X3/Ö2 — QA ölçtü: paylaşılan `playwright.config.ts` webServer'ı `MC_CHAT_ENABLED:'0'` ile
 * çalışır (dosya sahipliği DIŞINDA — `shell.spec.ts`'in sabit "4 sekme" tam-sayı çitini kırardı,
 * `CLAUDE.md` "dosya sahipliği dışına çıkma" kuralı), bu yüzden eski dar-genişlik testi 5 sekmeli
 * ÜRETİM varsayılanını hiç ÖLÇMÜYORDU (yalnızca 4 sekme). `GET /api/chat/status`'u
 * `page.route` ile `chat_enabled:true` döndürecek şekilde sahteleştirmek üretim sekme kümesini
 * (Sohbet dahil, 5 sekme) GERÇEK tarayıcıda, GERÇEK App.tsx bileşeniyle render eder — hiçbir
 * gerçek/ücretli model çağrısı YAPILMAZ (`session.ts` "uygulama açılışı sıfır model çağrısı
 * yapar" garantisi; yalnızca durum yanıtı sahte, hiçbir mesaj gönderilmiyor). `GET
 * /api/chat/history` de zararsız boş bir yanıtla sahteleştirilir ki `useChatSession` gerçek
 * sunucudan `503 chat_disabled` almasın.
 */
async function mockChatEnabled(page: Page): Promise<void> {
  await page.route('**/api/chat/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          session_active: true,
          session_id: undefined,
          busy: false,
          api_key_barrier_tripped: false,
          stripped_env_vars: [],
          chat_enabled: true,
          api_key_helper_configured: false,
          max_budget_usd: 20,
          pending_permissions: [],
        },
      }),
    })
  })
  await page.route('**/api/chat/history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { entries: [], has_more: false } }),
    })
  })
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

test('kronolojik zincir görünür: CEO brief → Developer raporu → QA kararı (AC1)', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'thread-chain')
  projectIds.push(id)

  await openThreadTab(page, 'thread-chain', 'F-004 — Kanban paneli')

  const sections = page.getByTestId('thread-sections')
  const kinds = await sections.evaluate((el) =>
    Array.from(el.children).map((c) => c.getAttribute('data-testid'))
  )
  // Transkript hiç bulunamaz (gerçek `~/.claude/projects` kökü kullanılmaz burada, fixture
  // proje kimliği o dizinde bir karşılık bulamaz) — best-effort W4 gereği bölüm YİNE DE listede
  // (her zaman en sonda) ama `readable:false`, "Bu bölüm okunamadı." gösterir; diğer üç bölüm
  // normal render edilir.
  expect(kinds).toEqual([
    'thread-section-ceo_brief',
    'thread-section-developer_report',
    'thread-section-qa_verdict',
    'thread-section-transcript',
  ])
  await expect(page.getByTestId('thread-section-qa_verdict')).toContainText('QA kararı: KALDI')
  await expect(page.getByTestId('thread-section-transcript')).toHaveText('Bu bölüm okunamadı.')
})

test('feature değiştirince önceki bölümler temizlenir, salt okunur — hiç yazma yok', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  fs.writeFileSync(
    path.join(dir, 'docs', 'features', 'F-005.md'),
    '---\nid: F-005\ntitle: İkinci feature\nstatus: todo\n---\ngövde\n'
  )
  const id = await addProject(page, dir, 'thread-readonly')
  projectIds.push(id)

  const before = fs.readdirSync(path.join(dir, 'docs', 'qa')).sort()

  await openThreadTab(page, 'thread-readonly', 'F-004 — Kanban paneli')
  await page.getByTestId('thread-feature-select').selectOption({ label: 'F-005 — İkinci feature' })
  await expect(page.getByTestId('thread-no-qa-note')).toBeVisible()

  const after = fs.readdirSync(path.join(dir, 'docs', 'qa')).sort()
  expect(after).toEqual(before)
})

test.describe('Dar genişlik (320/375/480px) — kırpılmış görünür genişlik > 0, tek kaydırma bağlamı', () => {
  for (const width of [320, 375, 480]) {
    test(`${width}px'te Thread sekmesi kırpılmadan erişilebilir, iç içe kaydırma kabı yok`, async ({
      page,
    }) => {
      const dir = makeFixtureProject()
      fixtureDirs.push(dir)
      const id = await addProject(page, dir, `thread-narrow-${width}`)
      projectIds.push(id)

      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')

      expect(await clippedVisibleWidth(page, '#tab-thread')).toBeGreaterThan(0)
      await page.getByRole('tab', { name: 'Thread' }).click()
      await expect(page.locator('[data-testid="thread-screen"]')).toBeVisible()

      await page
        .getByTestId('thread-project-select')
        .selectOption({ label: `thread-narrow-${width}` })
      expect(
        await clippedVisibleWidth(page, '[data-testid="thread-project-select"]')
      ).toBeGreaterThan(0)
      await page
        .getByTestId('thread-feature-select')
        .selectOption({ label: 'F-004 — Kanban paneli' })
      await expect(page.getByTestId('thread-sections')).toBeVisible()

      // W7 — tek kaydırma bağlamı: `thread-screen` kabının kendisi DIŞINDA, içindeki hiçbir
      // torun eleman `overflow-y:auto|scroll` taşımaz (iç içe kaydırma kutusu yok).
      const nestedScrollCount = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="thread-screen"]')
        if (!root) return -1
        let count = 0
        root.querySelectorAll('*').forEach((el) => {
          const style = window.getComputedStyle(el as HTMLElement)
          if (['auto', 'scroll'].includes(style.overflowY)) count += 1
        })
        return count
      })
      expect(nestedScrollCount).toBe(0)

      // X3/Ö3 — Feature `<select>`'in en uzun `<option>`'a göre boyutlanıp `thread-screen`'i
      // yatay olarak taşırması (QA 375px'te 555px hayalet kaydırma ölçtü) artık olmamalı:
      // kapsayıcının kaydırılabilir genişliği görünür genişliğiyle birebir eşleşir.
      const widths = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="thread-screen"]') as HTMLElement | null
        if (!el) return null
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
      })
      expect(widths).not.toBeNull()
      expect(widths!.scrollWidth).toBe(widths!.clientWidth)
    })
  }
})

test.describe('Dar genişlik, üretim sekme kümesi (6 sekme, sohbet açık) — hiçbir sekme 0px değil (X3/Ö2, F-011/D10)', () => {
  for (const width of [320, 375, 480]) {
    test(`${width}px'te tüm sekmeler (Zaman Çizelgesi/Kanban/Sohbet/Kapılar/Thread/Token) kırpılmadan erişilebilir`, async ({
      page,
    }) => {
      await mockChatEnabled(page)
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')

      // Üretim varsayılanı gerçekten 6 sekme mi (sahte durum doğru alındı mı, F-011 Token
      // sekmesi eklendi) — önce doğrula.
      await expect(page.locator('header [role="tab"]')).toHaveCount(6)

      const tabIds = [
        'tab-timeline',
        'tab-kanban',
        'tab-chat',
        'tab-gates',
        'tab-thread',
        'tab-usage',
      ]
      for (const id of tabIds) {
        const width_ = await clippedVisibleWidth(page, `#${id}`)
        expect(width_, `#${id} kırpılmış görünür genişliği 0 olmamalı`).toBeGreaterThan(0)
      }
    })
  }
})

test('X4/D1 — Thread ekranı gerçek klavye odağıyla (Tab tuşu) erişilebilir, .focus() ile zorlanmadan', async ({
  page,
}) => {
  const dir = makeFixtureProject()
  fixtureDirs.push(dir)
  const id = await addProject(page, dir, 'thread-keyboard-focus')
  projectIds.push(id)

  await openThreadTab(page, 'thread-keyboard-focus', 'F-004 — Kanban paneli')

  // F-013/N6 dersi (`docs/blockers.md`) — Playwright'ın `locator.focus()`'u CDP ile odağı
  // ZORLA verir, "klavyeyle odaklanabilir" iddiasını DOĞRULAMAZ (tabIndex kaldırılsa bile test
  // yeşil kalırdı). Gerçek `Tab` tuşuna basıp `document.activeElement`'i ölçmek asıl kanıttır.
  // `thread-screen`'in kendisi (`tabIndex={0}`) tek kaydırma bağlamı olduğu için sekme sırasında
  // erişilebilir olmalı.
  let reachedThreadScreen = false
  for (let i = 0; i < 30 && !reachedThreadScreen; i++) {
    await page.keyboard.press('Tab')
    reachedThreadScreen = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') === 'thread-screen'
    )
  }
  expect(reachedThreadScreen).toBe(true)

  // Aynı gerçek-klavye tekniğiyle: bir bölüm kartının `<summary>`'sine kadar `Tab` ile devam
  // edilebilir (F-013/K5 deseni — `<details>` doğal olarak odaklanabilir).
  let reachedSummary = false
  for (let i = 0; i < 10 && !reachedSummary; i++) {
    await page.keyboard.press('Tab')
    reachedSummary = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase() === 'summary'
    )
  }
  expect(reachedSummary).toBe(true)
})
