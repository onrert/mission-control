import { test, expect, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTempDataDir, removeTempDataDir } from '../helpers/temp-data-dir'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..', '..')

function postEvent(page: Page, body: Record<string, unknown>) {
  return page.request.post('/api/events', { data: body })
}

function uniqueMarker(name: string): string {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * `goto()`'nun döndüğü an React henüz mount/effect çalıştırmamış, `EventSource` bağlantısı
 * (ve dolayısıyla sunucu tarafı `hub.subscribe()`) henüz kurulmamış olabilir — özellikle bir
 * worker'ın ilk navigasyonunda (soğuk başlangıç). Bu pencerede yapılan bir POST'un yayını hiçbir
 * abone olmadığı için kaybolur (bkz. sözleşme §3 madde 8 — senkron replay+subscribe yalnızca
 * SUNUCUYA ULAŞMIŞ bir bağlantı için garanti veriyor). "Bağlı" rozetini beklemek `hub.subscribe()`
 * çağrısının kesin olarak tamamlandığını garanti eder (client 'open' olayını ancak sunucu
 * `flushHeaders()` + hemen ardından senkron `hub.subscribe()` çalıştırdıktan SONRA, ağ turu
 * gecikmesiyle alır).
 */
async function waitForConnected(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="connection-badge-shell"]')).toContainText('Bağlı', {
    timeout: 5000,
  })
}

test.describe('Zaman Çizelgesi — AC1-AC4 ve AC6 (duraklat yarısı)', () => {
  test('AC1: POST edilen olay 2 sn içinde, sayfa yenilenmeden görünür', async ({ page }) => {
    await page.goto('/')
    await waitForConnected(page)
    const marker = uniqueMarker('ac1')
    const res = await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: 'C:\\dev\\apps\\ac1-proje',
      tool_name: 'Bash',
      tool_input: { command: marker },
    })
    expect(res.status()).toBe(202)

    const row = page.locator('[data-testid="timeline-row"]', { hasText: marker })
    await expect(row).toBeVisible({ timeout: 2000 })
  })

  test('AC2: satır zaman/proje/agent/araç/özet alanlarını gösterir', async ({ page }) => {
    await page.goto('/')
    await waitForConnected(page)
    const marker = uniqueMarker('ac2')
    await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: 'C:\\dev\\apps\\ac2-proje',
      agent_type: 'developer',
      tool_name: 'Bash',
      tool_input: { command: marker },
    })
    const row = page.locator('[data-testid="timeline-row"]', { hasText: marker })
    await expect(row).toBeVisible({ timeout: 2000 })
    await expect(row.locator('[data-testid="row-project"]')).toHaveText('ac2-proje')
    await expect(row.locator('[data-testid="row-agent"]')).toHaveText('developer')
    await expect(row.locator('[data-testid="row-tool"]')).toHaveText('Bash')
    await expect(row.locator('[data-testid="row-time"]')).toContainText(/\d{2}:\d{2}:\d{2}/)
  })

  test('AC3/AC9: tüm tipler gösterilir; filtre uygulanıp kaldırılınca veri kaybolmaz', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForConnected(page)
    const markerA = uniqueMarker('ac3-prompt')
    const markerB = uniqueMarker('ac3-tool')
    await postEvent(page, {
      hook_event_name: 'UserPromptSubmit',
      project_path: 'C:\\dev\\apps\\ac3-proje',
      user_input: markerA,
    })
    await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: 'C:\\dev\\apps\\ac3-proje',
      tool_name: 'Bash',
      tool_input: { command: markerB },
    })

    const rowA = page.locator('[data-testid="timeline-row"]', { hasText: markerA })
    const rowB = page.locator('[data-testid="timeline-row"]', { hasText: markerB })
    await expect(rowA).toBeVisible({ timeout: 2000 })
    await expect(rowB).toBeVisible({ timeout: 2000 })

    // "UserPromptSubmit" tipini kapat -> yalnızca görünüm daralır, rowA görünmez olur.
    const typeGroup = page.locator('[data-testid="filter-group-Tip"]')
    await typeGroup.getByText('UserPromptSubmit', { exact: true }).click()
    await expect(rowA).toHaveCount(0)
    await expect(rowB).toBeVisible()

    // Filtreyi kaldır -> veri hâlâ orada, tekrar görünür (kayıt hiç etkilenmedi).
    await page.getByText('Filtreleri temizle').click()
    await expect(rowA).toBeVisible()
  })

  test('AC4: proje filtresi çoklu seçilebilir (≥2 proje)', async ({ page }) => {
    await page.goto('/')
    await waitForConnected(page)
    const markerX = uniqueMarker('ac4-x')
    const markerY = uniqueMarker('ac4-y')
    const projectX = `ac4-proje-x-${Date.now()}`
    const projectY = `ac4-proje-y-${Date.now()}`
    await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: `C:\\dev\\apps\\${projectX}`,
      tool_name: 'Bash',
      tool_input: { command: markerX },
    })
    await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: `C:\\dev\\apps\\${projectY}`,
      tool_name: 'Bash',
      tool_input: { command: markerY },
    })

    const rowX = page.locator('[data-testid="timeline-row"]', { hasText: markerX })
    const rowY = page.locator('[data-testid="timeline-row"]', { hasText: markerY })
    await expect(rowX).toBeVisible({ timeout: 2000 })
    await expect(rowY).toBeVisible({ timeout: 2000 })

    const projectGroup = page.locator('[data-testid="filter-group-Proje"]')
    await projectGroup.getByText(projectY, { exact: true }).click()
    await expect(rowY).toHaveCount(0)
    await expect(rowX).toBeVisible()
  })

  test('AC6 (duraklat): duraklatken yeni olaylar listeyi kaydırmaz, devam edince görünür', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForConnected(page)
    await page.getByText('Duraklat', { exact: true }).click()
    await expect(page.getByText('Devam et', { exact: true })).toBeVisible()

    const marker = uniqueMarker('ac6-paused')
    await postEvent(page, {
      hook_event_name: 'PreToolUse',
      project_path: 'C:\\dev\\apps\\ac6-proje',
      tool_name: 'Bash',
      tool_input: { command: marker },
    })

    const row = page.locator('[data-testid="timeline-row"]', { hasText: marker })
    await expect(row).toHaveCount(0)
    const pendingBadge = page.locator('[data-testid="pending-events-badge"]')
    await expect(pendingBadge).toBeVisible({ timeout: 2000 })

    await page.getByText('Devam et', { exact: true }).click()
    await expect(row).toBeVisible({ timeout: 2000 })
  })
})

// --- AC5: bağlantı kopması ve toparlanma (izole alt sunucu, gerçek kill/restart) ---
// Sözleşme §5 "AC5 E2E tasarımı": paylaşılan Playwright webServer'ından tamamen ayrı,
// kendi MC_DATA_DIR + sabit port 7335 kullanan bir alt süreç. `npm` wrapper'ı atlanarak
// doğrudan `tsx` CLI spawn edilir (child.kill() yalnızca wrapper'ı öldürmesin diye).
const AC5_PORT = 7335

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, '127.0.0.1')
  })
}

async function waitForPortFree(port: number, timeoutMs = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortFree(port)) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`${port} portu ${timeoutMs}ms içinde boşalmadı`)
}

async function waitForHealth(port: number, timeoutMs = 10000): Promise<void> {
  const start = Date.now()
  let lastErr: unknown
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return
    } catch (err) {
      lastErr = err
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`sunucu ${timeoutMs}ms içinde hazır olmadı: ${String(lastErr)}`)
}

function killProcessTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)])
    } catch {
      // best-effort
    }
  } else {
    child.kill()
  }
}

async function spawnServer(tempDir: string): Promise<ChildProcess> {
  const portFree = await isPortFree(AC5_PORT)
  if (!portFree) {
    throw new Error(`${AC5_PORT} portu dolu, AC5 E2E'si atlanamaz/koşulamaz`)
  }
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server/index.ts'],
    {
      cwd: repoRoot,
      env: { ...process.env, MC_PORT: String(AC5_PORT), MC_DATA_DIR: tempDir },
      stdio: 'ignore',
    }
  )
  await waitForHealth(AC5_PORT)
  return child
}

test.describe('AC5 - bağlantı kopması ve toparlanma', () => {
  let tempDir: string
  let child: ChildProcess | undefined

  test.beforeAll(async () => {
    tempDir = createTempDataDir()
    child = await spawnServer(tempDir)
  })

  test.afterAll(async () => {
    try {
      if (child) {
        const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()))
        killProcessTree(child)
        await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))])
      }
      await waitForPortFree(AC5_PORT)
    } finally {
      removeTempDataDir(tempDir)
    }
  })

  test('bağlantı koparsa "Yeniden bağlanıyor" gösterir (D1: readyState CLOSED\'a düşmüyor), yeniden başlatılınca toparlanır ve olay kayıpsız/çiftsiz görünür', async ({
    page,
  }) => {
    await page.goto(`http://127.0.0.1:${AC5_PORT}`)
    const shellBadge = page.locator('[data-testid="connection-badge-shell"]')
    await expect(shellBadge).toContainText('Bağlı', { timeout: 5000 })

    const markerBefore = uniqueMarker('ac5-before')
    await page.request.post(`http://127.0.0.1:${AC5_PORT}/api/events`, {
      data: {
        hook_event_name: 'PreToolUse',
        project_path: 'C:\\dev\\apps\\ac5-proje',
        tool_name: 'Bash',
        tool_input: { command: markerBefore },
      },
    })
    await expect(
      page.locator('[data-testid="timeline-row"]', { hasText: markerBefore })
    ).toBeVisible({ timeout: 2000 })

    // Gerçek "aniden öldü" senaryosu: temiz kapanma garantisi yok.
    const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()))
    killProcessTree(child!)
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))])
    await waitForPortFree(AC5_PORT)

    // CEO kararı D1 (docs/qa/F-003-contract.md §3 madde 6): durumlar YALNIZCA native
    // `readyState`'ten türetilir, özel bir zaman aşımı/backoff kodu YOK. WHATWG spec'te
    // `readyState=CLOSED` YALNIZCA "fail the connection" adımında oluşur (ilk bağlantıda 2xx
    // olmayan yanıt / yanlış Content-Type / açık `.close()`) — basit bir "bağlantı reddedildi"
    // (ECONNREFUSED, süreç öldürüldüğü için) senaryosunda tarayıcı `CONNECTING`'de kalıp süresiz
    // yeniden dener. 30 sn'lik gerçek bir tarayıcı probu ile doğrulandı (Chromium, bu makinede):
    // `TerminateProcess` sonrası `readyState` HİÇBİR ZAMAN `CLOSED`'a düşmüyor, her ~5 sn'de bir
    // `CONNECTING` ile `error` ateşleniyor. Bu yüzden bu senaryonun ulaşabileceği tek durum
    // "Yeniden bağlanıyor"dur — sözleşmenin bu satırdaki "Bağlantı koptu" beklentisi D1'in kendi
    // mekanizmasıyla çelişiyordu (bkz. docs/progress.md F-003 bölümü, CEO/QA'ya bildirildi).
    await expect(shellBadge).toContainText('Yeniden bağlanıyor', { timeout: 10000 })

    child = await spawnServer(tempDir)

    await expect(shellBadge).toContainText('Bağlı', { timeout: 10000 })

    const markerAfter = uniqueMarker('ac5-after')
    await page.request.post(`http://127.0.0.1:${AC5_PORT}/api/events`, {
      data: {
        hook_event_name: 'PreToolUse',
        project_path: 'C:\\dev\\apps\\ac5-proje',
        tool_name: 'Bash',
        tool_input: { command: markerAfter },
      },
    })

    const rowAfter = page.locator('[data-testid="timeline-row"]', { hasText: markerAfter })
    await expect(rowAfter).toBeVisible({ timeout: 5000 })

    // kayıpsız + çiftsiz: "önceki" olay hâlâ tam olarak bir kez görünüyor.
    const rowBefore = page.locator('[data-testid="timeline-row"]', { hasText: markerBefore })
    await expect(rowBefore).toHaveCount(1)
  })
})
