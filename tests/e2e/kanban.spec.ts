import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// F-007 sözleşme §5/§8 — gerçek tarayıcı E2E: AC3 (≤2sn dış değişiklik), AC4 (çakışma), AC5
// (yazma hatası), AC6 (Bilinmeyen durum sürüklenebilir), AC9 (klavye alternatifi), T2 (F-005
// AC1 görsel kanıtı), T3 (375px gezinme) ve echo ölçümü (D42, §4.4 madde 4). Sürükleme mekaniği
// jsdom'da test edilmez (layout yok, F-003 dersi) — bu dosya `@dnd-kit/core`'un gerçek pointer/
// keyboard aktivasyonunu gerçek Chromium'da ölçer.

function makeFixtureProject(prefix = 'mc-e2e-kanban-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  fs.mkdirSync(path.join(dir, 'docs', 'features'), { recursive: true })
  return dir
}

function writeFeatureFile(
  projectDir: string,
  file: string,
  fields: {
    id: string
    title: string
    status: string
    owner?: string
    deps?: string[]
    sprint?: string
  }
): void {
  const deps = fields.deps ?? []
  const depsYaml = deps.length > 0 ? `[${deps.join(', ')}]` : '[]'
  const content =
    `---\nid: ${fields.id}\ntitle: ${fields.title}\nstatus: ${fields.status}\n` +
    `owner: ${fields.owner ?? 'developer'}\ndeps: ${depsYaml}\nsprint: ${fields.sprint ?? '1'}\n---\nbody\n`
  fs.writeFileSync(path.join(projectDir, 'docs', 'features', file), content)
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

/**
 * Playwright'ın yerleşik `locator.dragTo()` metodu (ölçüldü, bu turda) `@dnd-kit/core`'un
 * `PointerSensor` `activationConstraint: {distance:8}` aktivasyonunu GÜVENİLİR şekilde
 * TETİKLEMİYOR — muhtemelen tek/az adımlı sentetik `mousemove` sırası dnd-kit'in `pointermove`
 * dinleyicisinin mesafe eşiğini geçecek ara kareleri üretmiyor. Elle `mouse.move/down/move/up`
 * (ara adımlarla, kısa bekleme ile) dnd-kit'in gerçek pointer event akışını üretir — bu proje
 * boyunca (F-003/F-005) kurulan "gerçek tarayıcı davranışını ölç" prensibiyle tutarlı.
 */
async function dragCardToColumn(
  page: Page,
  card: ReturnType<Page['locator']>,
  column: ReturnType<Page['locator']>
): Promise<void> {
  // Sütun sayısı (7 + "Bilinmeyen durum") kabuğun genişliğini aşabilir; kap `overflow-x-auto`
  // ile yatay kaydırılır. BUG (bu turda bulundu, AC6): kaynak/hedef ikisi de önce kaydırılıp
  // SONRA ikisinin de boundingBox'ı okunuyordu — hedefi (ör. en uzak sütun) görünüre getiren
  // İKİNCİ kaydırma, ilk kaydırmanın getirdiği kaynağı (ör. "Bilinmeyen durum", en sağdaki
  // sütun) çoktan görünmez alana itmiş oluyordu; `cardBox` bu yüzden EKRAN DIŞI bir konumu
  // ölçüyor, gerçek fare `mousedown`'ı karta hiç denk gelmiyordu (sürükleme hiç başlamıyordu).
  // Düzeltme: kaynağı kaydır → ÖLÇ → bas; ANCAK SONRA hedefi kaydır → yeniden ÖLÇ → sürükle.
  await card.scrollIntoViewIfNeeded()
  const cardBox = await card.boundingBox()
  if (!cardBox) {
    throw new Error('dragCardToColumn: kart için boundingBox alınamadı')
  }
  const startX = cardBox.x + cardBox.width / 2
  const startY = cardBox.y + cardBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // İlk küçük hareket `distance:8` aktivasyon eşiğini AÇIKÇA geçer (dnd-kit'in `PointerSensor`'ü
  // bu kareden önce sürüklemeyi hiç BAŞLATMAZ — AC7'nin tıklama/modal ayrımı bu eşiğe dayanır).
  await page.mouse.move(startX + 20, startY + 5, { steps: 5 })

  // Hedef sütunu ŞİMDİ (sürükleme aktifken) görünüre getir ve konumunu BU ANDA yeniden ölç —
  // kaydırma fare düğmesi durumunu etkilemez, yalnızca konteynerin `scrollLeft`'ini değiştirir.
  await column.scrollIntoViewIfNeeded()
  const columnBox = await column.boundingBox()
  if (!columnBox) {
    throw new Error('dragCardToColumn: sütun için boundingBox alınamadı')
  }
  const endX = columnBox.x + columnBox.width / 2
  const endY = columnBox.y + columnBox.height / 2

  await page.mouse.move(endX, endY, { steps: 10 })
  await page.waitForTimeout(100)
  await page.mouse.up()
}

async function waitForConnected(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="connection-badge-shell"]')).toContainText('Bağlı', {
    timeout: 5000,
  })
}

async function openKanban(page: Page): Promise<void> {
  await page.goto('/')
  await waitForConnected(page)
  await page.getByRole('tab', { name: 'Kanban' }).click()
  await expect(page.locator('[data-testid="kanban-screen"]')).toBeVisible()
}

const fixtureDirs: string[] = []
const projectIds: { page: Page; id: string }[] = []

test.afterEach(async () => {
  while (projectIds.length > 0) {
    const entry = projectIds.pop()!
    await removeProject(entry.page, entry.id).catch(() => {})
  }
  while (fixtureDirs.length > 0) {
    const dir = fixtureDirs.pop()!
    // AC5 salt-okunur hedef dosyayı bırakabilir — silmeden önce yazılabilir yap.
    try {
      const featuresDir = path.join(dir, 'docs', 'features')
      if (fs.existsSync(featuresDir)) {
        for (const f of fs.readdirSync(featuresDir)) {
          fs.chmodSync(path.join(featuresDir, f), 0o666)
        }
      }
    } catch {
      // yoksay — dizin zaten temiz olabilir.
    }
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test.describe("T2 — F-005 AC1 görsel kanıtı: yeni proje eklenince kart 5 sn içinde Kanban'da görünür", () => {
  test('POST /api/projects sonrası kart "Yapılacak (todo)" sütununda görünür', async ({ page }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-100.md', { id: 'F-100', title: 'T2 kartı', status: 'todo' })

    await openKanban(page)
    const id = await addProject(page, dir, `t2-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-100.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })
    const column = page.locator('[data-testid="kanban-column-todo"]')
    await expect(column).toContainText('Yapılacak (todo)')
    expect(await column.locator('[data-testid="kanban-card-F-100.md"]').count()).toBe(1)
  })
})

test.describe('AC3 — dış değişiklik 2 sn içinde yansır', () => {
  test('harici olarak status değiştirilen dosya kartı 2 sn içinde yeni sütuna taşır', async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-101.md', { id: 'F-101', title: 'AC3 kartı', status: 'todo' })

    await openKanban(page)
    const id = await addProject(page, dir, `ac3-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-101.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })
    expect(
      await page
        .locator('[data-testid="kanban-column-todo"] [data-testid="kanban-card-F-101.md"]')
        .count()
    ).toBe(1)

    const start = Date.now()
    writeFeatureFile(dir, 'F-101.md', { id: 'F-101', title: 'AC3 kartı', status: 'qa' })

    await expect(
      page.locator('[data-testid="kanban-column-qa"] [data-testid="kanban-card-F-101.md"]')
    ).toBeVisible({ timeout: 2000 })
    expect(Date.now() - start).toBeLessThan(2000)
  })
})

test.describe('AC6 — Bilinmeyen durum sütunu sürüklenebilir', () => {
  test('tanımsız status "Bilinmeyen durum" sütununda görünür ve geçerli bir sütuna sürüklenebilir', async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-102.md', { id: 'F-102', title: 'AC6 kartı', status: 'inceleniyor' })

    await openKanban(page)
    const id = await addProject(page, dir, `ac6-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-102.md"]')
    const unknownColumn = page.locator('[data-testid="kanban-column-unknown"]')
    await expect(unknownColumn).toBeVisible({ timeout: 5000 })
    await expect(unknownColumn.locator('[data-testid="kanban-card-F-102.md"]')).toBeVisible()

    const todoColumn = page.locator('[data-testid="kanban-column-todo"]')
    await dragCardToColumn(page, card, todoColumn)

    await expect(
      page.locator('[data-testid="kanban-column-todo"] [data-testid="kanban-card-F-102.md"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      fs.promises.readFile(path.join(dir, 'docs', 'features', 'F-102.md'), 'utf8')
    ).resolves.toContain('status: todo')
  })
})

test.describe('AC9 — klavye alternatifi gerçek tuş olaylarıyla dosyaya yazar', () => {
  test('Boşluk (başlat) → ArrowRight (hedef sütun) → Enter (onayla) gerçek dosya değişikliği üretir', async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-103.md', { id: 'F-103', title: 'AC9 kartı', status: 'todo' })

    await openKanban(page)
    const id = await addProject(page, dir, `ac9-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-103.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })

    // `Tab` ile sıralı erişim jsdom'da statik olarak zaten çitlendi (tabIndex=0,
    // `KanbanScreen.test.tsx`); burada gerçek klavye AKTİVASYONUNU (Boşluk/ArrowRight/Enter)
    // ölçmek için doğrudan odaklanıp gerçek `page.keyboard.press` gönderiyoruz. BUG (bu turda
    // bulundu): dnd-kit `DndContext`, sürükleme başladığında (`Space`) `droppableRects`'i
    // `useLayoutEffect`/ölçüm turu ile ASENKRON doldurur; `ArrowRight` hiç ara vermeden art
    // arda gönderilirse (Playwright'ın varsayılan tuş hızı) `coordinateGetter` boş bir
    // `droppableRects` haritasıyla çağrılıp hareketsiz kalıyordu (kart hep başlangıç sütununda
    // kalıp `Enter` "aynı sütuna taşındı" no-op'una düşüyordu — gerçek `PATCH` hiç gitmiyordu).
    // Gerçek bir kullanıcının tuşlar arasında bıraktığı doğal boşluğu simüle eden kısa
    // bekleme (100ms), dnd-kit'in ölçüm turunu bitirmesine izin verir; davranışı ZAYIFLATMAZ —
    // hâlâ gerçek `Space`/`ArrowRight`/`Enter` olaylarının dosyaya yazdığını ölçer.
    await card.focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    await page.keyboard.press('Enter')

    await expect(
      page.locator('[data-testid="kanban-column-contract"] [data-testid="kanban-card-F-103.md"]')
    ).toBeVisible({ timeout: 5000 })
    const written = await fs.promises.readFile(
      path.join(dir, 'docs', 'features', 'F-103.md'),
      'utf8'
    )
    expect(written).toContain('status: contract')
  })
})

test.describe('AC4 — çakışma: yazma durur, disk-güncel değere göre yeniden çizilir, sessizce üzerine yazılmaz', () => {
  test('sürükleme sırasında dosya harici olarak değiştirilirse 409, banner gösterilir, kart disk değerine döner', async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-104.md', { id: 'F-104', title: 'AC4 kartı', status: 'todo' })

    await openKanban(page)
    const id = await addProject(page, dir, `ac4-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-104.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })

    const devColumn = page.locator('[data-testid="kanban-column-dev"]')

    // Harici değişiklik: istemcinin ELİNDEKİ (stale) hash'i geçersiz kılar. Sürükleme HEMEN
    // ardından yapılır — chokidar'ın kendi debounce'u (150ms) + `awaitWriteFinish` (200ms)
    // penceresinden ÖNCE PATCH isteği gönderilsin diye.
    writeFeatureFile(dir, 'F-104.md', { id: 'F-104', title: 'AC4 kartı', status: 'blocked' })
    await dragCardToColumn(page, card, devColumn)

    const banner = page.locator('[data-testid="kanban-conflict-banner"]')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await expect(banner).toContainText('panel açıkken dışarıdan değişti')

    // Kart kullanıcının bıraktığı sütunda (dev) DEĞİL, diskteki güncel sütunda (blocked).
    await expect(
      page.locator('[data-testid="kanban-column-blocked"] [data-testid="kanban-card-F-104.md"]')
    ).toBeVisible()
    expect(
      await page
        .locator('[data-testid="kanban-column-dev"] [data-testid="kanban-card-F-104.md"]')
        .count()
    ).toBe(0)

    await banner.getByText('Kapat').click()
    await expect(banner).toHaveCount(0)
  })
})

test.describe('AC5 — yazma hatası: kart eski sütununa döner, okunabilir hata, panel çökmez', () => {
  test('hedef dosya salt-okunur yapılırsa write_failed, kart geri döner, kırmızı toast + Tekrar dene', async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    const filePath = path.join(dir, 'docs', 'features', 'F-105.md')
    writeFeatureFile(dir, 'F-105.md', { id: 'F-105', title: 'AC5 kartı', status: 'todo' })
    fs.chmodSync(filePath, 0o444)

    await openKanban(page)
    const id = await addProject(page, dir, `ac5-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-105.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })

    const devColumn = page.locator('[data-testid="kanban-column-dev"]')
    await dragCardToColumn(page, card, devColumn)

    const toast = page.locator('[data-testid="kanban-toast"]')
    await expect(toast).toBeVisible({ timeout: 5000 })
    await expect(toast).toContainText('kaydedilemedi')
    await expect(toast.getByText('Tekrar dene')).toBeVisible()

    // Kart eski sütununa (todo) geri döndü — rollback.
    await expect(
      page.locator('[data-testid="kanban-column-todo"] [data-testid="kanban-card-F-105.md"]')
    ).toBeVisible({ timeout: 5000 })

    // Panel çökmedi: sayfa hâlâ tepki veriyor, başka bir sütun hâlâ etkileşimli.
    await expect(page.locator('[data-testid="app-title"]')).toHaveText('MISSION CONTROL')
    await expect(page.locator('[data-testid="kanban-screen"]')).toBeVisible()

    fs.chmodSync(filePath, 0o666)
  })
})

/**
 * QA düzeltme turu 1 (BLOKLAYICI B2) — `toBeVisible()` + `.click()` bir `overflow-x-auto`
 * kabında kaydırılıp ekran dışında kalan bir öğe için de TRUE döner (`.click()` otomatik
 * kaydırır), yani önceki çit kullanıcının hiç göremediği bir sekmede de yeşil kalıyordu (QA
 * gerçek Chromium'da ölçtü: her iki sekmenin de kırpılmış görünür genişliği 0px idi). Bu
 * yardımcı QA'nın kendi ölçüm yöntemini birebir tekrarlar: elementin `getBoundingClientRect()`'ini
 * TÜM kaydırılabilir (`overflow-x: auto/scroll/hidden`) ata kapların görünür alanıyla VE
 * viewport'un kendisiyle kesiştirir, kalan görünür genişliği döner.
 */
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

test.describe('T3 — 375px genişlikte gezinme kaybolmaz (QA düzeltme turu 1: B2)', () => {
  test('Zaman Çizelgesi/Kanban sekmelerinin KIRPILMIŞ GÖRÜNÜR genişliği > 0, Ayarlar dişlisi erişilebilir kalır', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')

    const settingsButton = page.getByRole('button', { name: 'Ayarlar' })
    await expect(settingsButton).toBeVisible()
    const settingsBox = await settingsButton.boundingBox()
    expect(settingsBox).not.toBeNull()
    expect(settingsBox!.x).toBeGreaterThanOrEqual(0)
    expect(settingsBox!.x + settingsBox!.width).toBeLessThanOrEqual(375)

    // Gerçek ölçüm — `toBeVisible()` YETERSİZ (QA raporu, bu turda ölçüldü): kırpılmış görünür
    // genişlik her iki sekme için de > 0 olmalı, `.click()`'in otomatik kaydırmasından ÖNCE.
    expect(await clippedVisibleWidth(page, '#tab-timeline')).toBeGreaterThan(0)
    expect(await clippedVisibleWidth(page, '#tab-kanban')).toBeGreaterThan(0)

    const kanbanTab = page.getByRole('tab', { name: 'Kanban' })
    await expect(kanbanTab).toBeVisible()
    await kanbanTab.click()
    await expect(page.locator('[data-testid="kanban-screen"]')).toBeVisible()

    const timelineTab = page.getByRole('tab', { name: 'Zaman Çizelgesi' })
    await expect(timelineTab).toBeVisible()
    await timelineTab.click()
    await expect(page.locator('[data-testid="timeline-screen"]')).toBeVisible()
  })
})

test.describe('D42 — echo ölçümü: kendi yazımız chokidar üzerinden geri gelir ama render/fetch sayısı öngörülebilir', () => {
  test("sürükleme sonrası PATCH yanıtı DOM'a yansıdıktan sonra render sayacı 3 sn boyunca DEĞİŞMEZ, GET /api/features tam 1 kez tetiklenir", async ({
    page,
  }) => {
    const dir = makeFixtureProject()
    fixtureDirs.push(dir)
    writeFeatureFile(dir, 'F-106.md', { id: 'F-106', title: 'Echo kartı', status: 'todo' })

    await openKanban(page)
    const id = await addProject(page, dir, `echo-${Date.now()}`)
    projectIds.push({ page, id })

    const card = page.locator('[data-testid="kanban-card-F-106.md"]')
    await expect(card).toBeVisible({ timeout: 5000 })

    let getCount = 0
    page.on('request', (req) => {
      if (req.method() === 'GET' && req.url().includes('/api/features')) getCount++
    })

    const devColumn = page.locator('[data-testid="kanban-column-dev"]')
    await dragCardToColumn(page, card, devColumn)

    const movedCard = page.locator(
      '[data-testid="kanban-column-dev"] [data-testid="kanban-card-F-106.md"]'
    )
    await expect(movedCard).toBeVisible({ timeout: 5000 })

    // Taban: PATCH yanıtı DOM'a yansıdıktan HEMEN SONRA okunan render sayacı (QA tur 2 R3 —
    // eşik kesin eşitliğe çevrildi, taban belirsizliği mutasyon 5'i kaçırıyordu).
    const before = await movedCard.getAttribute('data-render-count')
    expect(before).not.toBeNull()

    // 150ms debounce + 200ms awaitWriteFinish + ağ payından fazla — echo sinyalinin kesinlikle
    // geldiği garanti pencere (§4.4 madde 4).
    await page.waitForTimeout(3000)

    const after = await movedCard.getAttribute('data-render-count')
    expect(after).toBe(before)
    expect(getCount).toBe(1)
  })
})
