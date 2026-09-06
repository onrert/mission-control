'use strict'

// F-014 — Electron ana süreç. `.cjs` uzantısı ZORUNLU (CLAUDE.md kayıtlı dersi: kök
// package.json'da "type":"module" var, `.js` uzantılı bir dosya ESM sayılır ve `require` patlar).
//
// Tek süreç modeli (sözleşme §1): bu dosya `src/server/index.ts`'i `require('tsx/cjs/api')`
// aracılığıyla DOĞRUDAN, hiç değiştirmeden yükler ve `createServer(port, dataDir)`'i çağırır.
// Sunucu ayrı bir alt süreç DEĞİLDİR — Electron ana sürecinin kapanması sunucunun da
// kapanması demektir, "yetim süreç" sınıfı yapısal olarak yok olur.
//
// Test edilebilirlik: `require('electron')` bu dosya bir Electron süreci OLARAK çalışmadığında
// (ör. vitest altında) bir modül nesnesi değil, çalıştırılabilir dosyaya giden bir YOL DİZGESİ
// döndürür (Electron'un kendi tasarımı). Bu yüzden gerçek `electron` modülü yalnızca
// `require.main === module` bloğunun İÇİNDE talep edilir; dışa aktarılan fonksiyonların hiçbiri
// üst seviyede `electron`'a dokunmaz — hepsi `app`/`BrowserWindow`/`Tray`/`Menu`/`dialog`'u
// parametre olarak alır (gerçek çalışmada gerçek Electron nesneleri, testlerde sahte nesneler).

const path = require('node:path')
const net = require('node:net')
const fs = require('node:fs')

const DEFAULT_PORT = 7333

const PORT_ERROR_TITLE = 'Mission Control başlatılamadı'

function portErrorBody(port) {
  return (
    `${port} portu başka bir uygulama tarafından kullanılıyor. Panel açılamıyor. ` +
    'Önce o portu kullanan programı kapatın veya MC_PORT ortam değişkeniyle farklı bir port seçin.'
  )
}

/**
 * `scripts/check-ports.mjs`'in aynı deseninin küçük bir kopyası (sözleşme §4) — bu dosya `.cjs`
 * olduğu için TS import edemez, bilerek ayrı bir kopya.
 */
function resolvePortLike(raw, defaultPort) {
  if (raw === undefined) return defaultPort
  const trimmed = raw.trim()
  const parsed = Number(trimmed)
  if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    return defaultPort
  }
  return parsed
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => {
      tester.close(() => resolve(true))
    })
    tester.listen(port, '127.0.0.1')
  })
}

/**
 * Port ön kontrolü (sözleşme §4) — `createServer` çağrılmadan ÖNCE çalışır. Kalan risk: TOCTOU
 * (ölçüm ile gerçek `.listen()` arasında port başka bir süreç tarafından tutulabilir,
 * `check-ports.mjs`'in de kabul ettiği aynı sınıf yarış — kabul edilen risk, feature notuna
 * yazılı).
 */
async function ensurePortAvailable(port, isPortFreeFn = isPortFree) {
  return isPortFreeFn(port)
}

/**
 * `.ts`/ESM sunucu modülünü `.cjs`'den değiştirmeden yükler (sözleşme §1 madde 1-2, §0 Bulgu 3).
 * Yalnızca gerçek bootstrap'ta çağrılır; testler kendi sahte `serverModule`'unu enjekte eder.
 */
function loadServerModule() {
  require('tsx/cjs/api').register()
  return require(path.join(__dirname, '..', 'src', 'server', 'index.ts'))
}

/**
 * Açılışta başlama ayarını YAZAR (sözleşme §5). `openAtLogin` parametresi zorunlu — mevcut
 * değeri okuyup TERSİNE çevirmek çağıranın (tepsi menüsü) sorumluluğudur; bu fonksiyon saf bir
 * "yaz" işlemidir, böylece mutasyon testi (M6) girdiyi yok sayan bir sabitlemeyi doğrudan
 * yakalayabilir.
 */
function setAutostart(app, openAtLogin) {
  app.setLoginItemSettings({ openAtLogin, path: process.execPath, args: [] })
}

function getAutostart(app) {
  return app.getLoginItemSettings().openAtLogin
}

/**
 * G1 (CEO kararı, bağlayıcı) — "Bilgisayar açılışında başlat" varsayılanı AÇIK, ama sessizce
 * yerleşmez: ilk açılışta (kullanıcının userData klasöründe henüz işaret dosyası yokken)
 * `setAutostart(app, true)` çağrılır VE bir kerelik tepsi balonuyla kullanıcıya bildirilir
 * (`runApp` içinde). Marker yazıldıktan sonra bir daha ZORLA açılmaz — kullanıcı tepsiden
 * kapatırsa bir sonraki başlatmada kapalı kalır (OS'nin kendi `openAtLogin` durumu tek gerçek
 * kaynaktır, marker yalnızca "ilk zorlamayı bir daha yapma" bilgisini taşır).
 * Döner: bu çağrının otomatik başlamayı YENİ AÇIP açmadığı (`true` ise ilk çalıştırma).
 */
function ensureDefaultAutostart(app, markerPath, fsImpl = fs) {
  if (fsImpl.existsSync(markerPath)) return false
  setAutostart(app, true)
  fsImpl.mkdirSync(path.dirname(markerPath), { recursive: true })
  fsImpl.writeFileSync(
    markerPath,
    JSON.stringify({ autostartInitialized: true, setAt: new Date().toISOString() })
  )
  return true
}

/**
 * Tepsi menüsü şablonu (sözleşme §5/§9). Saf fonksiyon: `Menu.buildFromTemplate`'e verilecek
 * diziyi döndürür, hiçbir Electron API'sini kendisi çağırmaz — testte doğrudan menü öğelerinin
 * `click` handler'ları çağrılabilir.
 */
function buildTrayMenuTemplate({ app, openAtLogin, onOpen, onToggleAutostart, onQuit }) {
  return [
    { label: 'Paneli Aç', click: onOpen },
    {
      label: 'Bilgisayar açılışında başlat',
      type: 'checkbox',
      checked: openAtLogin,
      click: () => onToggleAutostart(app),
    },
    { type: 'separator' },
    { label: 'Çıkış', click: onQuit },
  ]
}

/**
 * Uygulamanın gerçek yaşam döngüsünü kurar (sözleşme §1-§5). Tüm Electron nesneleri (`app`,
 * `BrowserWindow`, `Tray`, `Menu`, `dialog`) parametre olarak gelir — bu fonksiyon üst seviyede
 * `require('electron')` çağırmaz, dolayısıyla sahte nesnelerle testte çağrılabilir.
 *
 * Dönüş değeri testlerin gözlemleyebileceği referansları taşır (`server`, `mainWindow`, `tray`,
 * `shutdownViaTray`, `rebuildTrayMenu`) — gerçek bootstrap bunları kullanmaz, yalnızca testler.
 */
async function runApp(electronApi, options = {}) {
  const { app, BrowserWindow, Tray, Menu, dialog } = electronApi
  const {
    env = process.env,
    isPortFreeFn = isPortFree,
    loadServerModuleFn = loadServerModule,
    trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png'),
    fsImpl = fs,
    // E2E duman testi (§8) gerçek `electron.exe` + gerçek `app.getLoginItemSettings`/
    // `setLoginItemSettings` kullanır — bu gerçek Windows kayıt defterini (Run anahtarı)
    // değiştirir. Test izolasyonu içindir, üretimde HİÇBİR ZAMAN set edilmez (yalnızca
    // `MC_SKIP_AUTOSTART_DEFAULT=1` ortam değişkeniyle bootstrap'tan geçirilir).
    skipDefaultAutostart = false,
  } = options

  // §3 — tek örnek. Port kontrolünden ÖNCE ve BAĞIMSIZ: `false` dönerse hiçbir şey başlatılmadan
  // (createServer hiç çağrılmadan) çıkılır.
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return { started: false, reason: 'single-instance' }
  }

  let mainWindow = null
  const showAndFocus = () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
  app.on('second-instance', showAndFocus)

  // §4 — port ön kontrolü, `createServer` çağrılmadan ÖNCE (mutasyon M1 hedefi, sözleşme §8).
  const port = resolvePortLike(env.MC_PORT, DEFAULT_PORT)
  const portFree = await ensurePortAvailable(port, isPortFreeFn)
  if (!portFree) {
    dialog.showErrorBox(PORT_ERROR_TITLE, portErrorBody(port))
    app.quit()
    return { started: false, reason: 'port-in-use' }
  }

  // §1 madde 4 — paketlenmiş uygulamanın kendi kullanıcı veri klasörü, repo `./data`'sıyla
  // karışmaz.
  const dataDir = path.join(app.getPath('userData'), 'data')
  const serverModule = loadServerModuleFn()
  const server = serverModule.createServer(port, dataDir)

  // Gerçek Electron E2E duman testiyle bulunan hata: `app.quit()` çağrıldığında Electron hâlâ
  // var olan (yalnızca gizli) pencereyi de kapatmaya çalışır ve bu, aşağıdaki `close`
  // handler'ını TEKRAR tetikler — handler koşulsuz `preventDefault()` çağırdığı için `app.quit()`
  // sessizce İPTAL OLUYORDU, `app.on('before-quit')`/`will-quit` hiç ateşlenmiyordu ve tepsi
  // "Çıkış" gerçek bir kapanma ÜRETMİYORDU (Playwright `waitForEvent('close')` süresiz asılı
  // kaldı, birim testleri bunu YAKALAYAMADI çünkü sahte `app.quit()` pencereyi tekrar kapatmayı
  // simüle etmiyor — bu satırın varlığı tam olarak bu yüzden gerçek `electron.exe` duman testi
  // gerektiriyordu, sözleşme §8'in kendi gerekçesi). Çözüm: yalnızca tepsi "Çıkış" akışında
  // `isQuitting` bayrağı önceden `true` yapılır; `close` handler bu bayrak açıkken müdahale
  // etmez, pencerenin gerçekten kapanmasına izin verir.
  let isQuitting = false

  // §2 — tepsi "Çıkış": gerçek `shutdown()` çağrılır (mutasyon M3 hedefi, sözleşme §8), callback'te `app.quit`.
  const shutdownViaTray = () => {
    isQuitting = true
    serverModule.shutdown(server, server.sseHub, () => app.quit())
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  mainWindow.loadURL(`http://127.0.0.1:${port}`)
  // §2 — pencere kapatma (X): sunucu çalışmaya devam eder, pencere yalnızca gizlenir
  // (mutasyon M4 hedefi, sözleşme §8). `isQuitting` AÇIKKEN (tepsi "Çıkış" akışı) müdahale
  // etmez — aksi hâlde `app.quit()`'in kendi pencere kapatma denemesi burada engellenir.
  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })

  const tray = new Tray(trayIconPath)
  tray.setToolTip('Mission Control')
  const rebuildTrayMenu = () => {
    const template = buildTrayMenuTemplate({
      app,
      openAtLogin: getAutostart(app),
      onOpen: showAndFocus,
      onToggleAutostart: (targetApp) => {
        setAutostart(targetApp, !getAutostart(targetApp))
        rebuildTrayMenu()
      },
      onQuit: shutdownViaTray,
    })
    tray.setContextMenu(Menu.buildFromTemplate(template))
  }

  // G1 (CEO kararı) — varsayılan AÇIK ama GÖRÜNÜR: ilk açılışta açılır ve kullanıcıya
  // bildirilir (tepsi balonu, yalnızca Windows'ta desteklenir — ADR-009 zaten Windows-only).
  const justEnabledAutostart = skipDefaultAutostart
    ? false
    : ensureDefaultAutostart(
        app,
        path.join(app.getPath('userData'), 'autostart-initialized.json'),
        fsImpl
      )
  rebuildTrayMenu()
  tray.on('click', showAndFocus)
  if (justEnabledAutostart && typeof tray.displayBalloon === 'function') {
    tray.displayBalloon({
      title: 'Mission Control',
      content:
        'Bilgisayar açılışında otomatik başlayacak şekilde ayarlandı. Tepsi menüsünden kapatabilirsiniz.',
    })
  }

  return {
    started: true,
    server,
    mainWindow,
    tray,
    shutdownViaTray,
    rebuildTrayMenu,
    port,
    dataDir,
    justEnabledAutostart,
  }
}

// Bootstrap yalnızca bu dosya GERÇEK bir Electron süreci OLARAK çalışırken tetiklenir.
// `require.main === module` burada GÜVENİLMEZ: Electron kendi uygulama giriş dosyasını
// kendi modül yükleyicisiyle çalıştırıyor ve `require.main`'i bu dosyaya değil kendi iç
// bootstrap modülüne (`require.main.filename === 'electron'`) işaret edecek şekilde
// bırakıyor (gerçek Electron 44 sürecinde ölçüldü — bu yüzden eski `require.main === module`
// koşulu HİÇBİR ZAMAN true olmuyordu ve bootstrap asla çalışmıyordu, pencere hiç açılmıyordu).
// Elektron'un kendi belgelenmiş tasarımı gereği `require('electron')` yalnızca GERÇEK bir
// Electron sürecinde bir modül nesnesi döner; başka her yerde (vitest, düz node) paketin
// kendi `index.js`'i çalıştırılabilir dosyaya giden bir YOL DİZGESİ döner (üstteki başlık
// notu, `typeof` kontrolü zaten bunu varsayıyordu — yalnızca tetikleyici koşul yanlıştı).
const electron = require('electron')
if (typeof electron !== 'string') {
  const { app, BrowserWindow, Tray, Menu, dialog } = electron
  // Test izolasyonu (E2E duman testi, sözleşme §8): gerçek kullanıcının `%APPDATA%` klasörünü
  // ve gerçek Windows açılış kaydını KİRLETMEMEK için iki izole edici kapı. Üretimde (normal
  // çift tıklama) hiçbiri set edilmez, davranış tamamen değişmeden kalır.
  if (process.env.MC_ELECTRON_USER_DATA_DIR) {
    app.setPath('userData', process.env.MC_ELECTRON_USER_DATA_DIR)
  }
  app.whenReady().then(async () => {
    const result = await runApp(
      { app, BrowserWindow, Tray, Menu, dialog },
      { skipDefaultAutostart: process.env.MC_SKIP_AUTOSTART_DEFAULT === '1' }
    )
    // `tests/e2e/electron-smoke.spec.ts` İÇİN TEK erişim noktası: tepsi menüsü OS-native olduğu
    // için Playwright onu tıklayamaz (bilinen kısıt); test `electronApp.evaluate(...)` ile bu
    // globali okuyup `shutdownViaTray()`'i doğrudan çağırır. Üretim kodunun hiçbir yeri bu
    // globali okumaz — yalnızca testin main-process tarafına açtığı bir kapı.
    global.__missionControlTestHook = result
  })
}

module.exports = {
  DEFAULT_PORT,
  PORT_ERROR_TITLE,
  portErrorBody,
  resolvePortLike,
  isPortFree,
  ensurePortAvailable,
  loadServerModule,
  setAutostart,
  getAutostart,
  ensureDefaultAutostart,
  buildTrayMenuTemplate,
  runApp,
}
