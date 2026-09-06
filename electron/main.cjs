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
//
// QA F-014 (2026-09-06, KALDI) düzeltme turu — H1/H2/H3: `dialog.showErrorBox` bu makinede
// hiçbir pencere üretmiyor VE çağrıyı bloke ediyor (ölçüldü, izole sonda). Bu yüzden kullanıcıya
// görünen TÜM fatal hatalar artık gerçek bir `BrowserWindow` ile gösteriliyor (`showFatalErrorWindow`,
// aşağıda). Ayrıca barındırılan CEO oturumunun çalışma dizini artık paketlenmiş kopyaya
// (`resources/app`) değil, gerçek proje dizinine açıkça yönlendiriliyor (`resolveProjectDir`) ve
// o dizinde güvenlik kancaları (`.claude/settings.json` + `.claude/hooks/*.cjs`) yoksa sohbet
// oturumu hiç açılmıyor (`hasHookInfrastructure`). Son olarak sunucu başlatma bloğu artık
// `try/catch` ile sarılı (H3) — yakalanmamış bir hata artık zombi süreç bırakmıyor.

const path = require('node:path')
const net = require('node:net')
const fs = require('node:fs')

const DEFAULT_PORT = 7333

const PORT_ERROR_TITLE = 'Mission Control başlatılamadı'
const HOOKS_MISSING_TITLE = 'Mission Control başlatılamadı'
const STARTUP_ERROR_TITLE = 'Mission Control başlatılamadı'

function portErrorBody(port) {
  return (
    `${port} portu başka bir uygulama tarafından kullanılıyor. Panel açılamıyor. ` +
    'Önce o portu kullanan programı kapatın veya MC_PORT ortam değişkeniyle farklı bir port seçin.'
  )
}

/**
 * H1 (QA F-014 B2 düzeltmesi) — güvenlik kancaları olmadan barındırılan bir CEO oturumu açmak
 * "sessizce korumasız çalışmak" demektir (CLAUDE.md'nin en pahalı hata sınıfı). Bu metin,
 * kullanıcının hangi klasörün eksik olduğunu ve nasıl düzelteceğini (MC_PROJECT_DIR) görmesini
 * sağlar.
 */
function hooksMissingBody(projectDir) {
  return (
    `Güvenlik kancaları bulunamadı: ${path.join(projectDir, '.claude', 'settings.json')}. ` +
    'Bu klasör olmadan sohbet oturumu korumasız çalışır, bu yüzden başlatılmadı. ' +
    'MC_PROJECT_DIR ortam değişkeniyle doğru proje klasörünü belirtin.'
  )
}

/**
 * H3 (QA F-014 B3 düzeltmesi) — başlatma yolundaki yakalanmamış bir hata artık kullanıcıya
 * görünür bir pencerede raporlanıyor, sessiz zombi süreç yerine.
 */
function startupErrorBody(messageText) {
  return (
    `Uygulama başlatılırken beklenmeyen bir hata oluştu: ${messageText}. ` +
    'Uygulama güvenli şekilde kapatılıyor.'
  )
}

const AUTOSTART_ENABLED_MESSAGE =
  'Bilgisayar açılışında otomatik başlayacak şekilde ayarlandı. Tepsi menüsünden kapatabilirsiniz.'

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
 * H1 — paketlenmiş bir `.exe` her zaman kendi kopyalanmış `electron/` klasöründen çalışır
 * (`__dirname` bu yüzden `resources/app/electron`'a çözülür). Gerçek proje dizinini bulmak için
 * `__dirname`'e GÜVENİLEMEZ; onun yerine:
 * 1. `MC_PROJECT_DIR` ortam değişkeni verilmişse (yapılandırılabilir) — HER ZAMAN önceliklidir.
 * 2. `app.isPackaged === false` ise (paketlenmemiş çalıştırma: `npm run electron:start`,
 *    testler) `__dirname`'e göre türetim hâlâ doğrudur (bu dosyanın kendi konumu gerçek depoda).
 * 3. Paketlenmişse ve override yoksa, paketleme zamanında gömülen sabit varsayılana
 *    (`project-dir.generated.cjs`, `scripts/package-electron.mjs` tarafından yazılır — bu
 *    makul varsayılan, ADR-014'ün "bu araç dağıtılmayacak, tek makine/tek kullanıcı" kararına
 *    dayanır) düşülür. Bu üçüncü dal `__dirname` türetimine ASLA geri dönmez — paket kopyası
 *    hiçbir zaman çalışma dizini olamaz.
 */
function readPackagedDefaultProjectDir() {
  return require('./project-dir.generated.cjs').PROJECT_DIR
}

function resolveProjectDir(app, env = process.env, readPackagedDefaultFn = readPackagedDefaultProjectDir) {
  const override = env.MC_PROJECT_DIR
  if (override !== undefined && override.trim() !== '') {
    return path.resolve(override.trim())
  }
  if (!app.isPackaged) {
    return path.join(__dirname, '..')
  }
  return readPackagedDefaultFn()
}

/**
 * H1 — `projectDir` içinde `.claude/settings.json` VE en az bir `.cjs` hook dosyası
 * (`.claude/hooks/*.cjs`) yoksa `false` döner. `runApp` bu `false` durumunda sohbet oturumunu
 * (ve tüm uygulamayı — bu tek süreç modelinde ayrıştırılamaz, sözleşme §1) hiç başlatmaz.
 */
function hasHookInfrastructure(projectDir, fsImpl = fs) {
  try {
    const settingsPath = path.join(projectDir, '.claude', 'settings.json')
    if (!fsImpl.existsSync(settingsPath)) return false
    const hooksDir = path.join(projectDir, '.claude', 'hooks')
    if (!fsImpl.existsSync(hooksDir)) return false
    const entries = fsImpl.readdirSync(hooksDir)
    return entries.some((name) => typeof name === 'string' && name.endsWith('.cjs'))
  } catch {
    return false
  }
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
 * `setAutostart(app, true)` çağrılır VE görünür bir bildirimle kullanıcıya bildirilir
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

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function messageWindowHtml(title, body) {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<title>${escapeHtml(title)}</title></head>` +
    '<body style="font-family:Segoe UI,sans-serif;padding:24px;background:#1e1e1e;color:#f0f0f0;">' +
    `<h2 style="margin-top:0;">${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></body></html>`
  )
}

/**
 * B1 dersi (QA F-014) — `dialog.showErrorBox` bu ortamda hiçbir pencere üretmiyor (izole
 * sondayla kanıtlandı: aynı süreçte `BrowserWindow` çiziliyor, `showErrorBox` hiçbir şey
 * çizmiyor ve çağrıyı bloke ediyor). Bu yüzden kullanıcıya görünen TÜM fatal hatalar gerçek bir
 * `BrowserWindow` ile gösterilir. Pencere kullanıcı KAPATANA kadar açık kalır — hemen ardından
 * `app.quit()`/`app.exit()` çağırmak mesajı okunmadan kapatırdı (orijinal `dialog.showErrorBox`
 * + `app.quit()` deseninin ürettiği sessizlikle aynı sınıf hata).
 */
function showFatalErrorWindow(BrowserWindow, title, body) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480,
      height: 260,
      show: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title,
      webPreferences: { contextIsolation: true, sandbox: true },
    })
    win.on('closed', () => resolve())
    win.loadURL(`data:text/html,${encodeURIComponent(messageWindowHtml(title, body))}`)
  })
}

/**
 * Ö2 (QA F-014) — `tray.displayBalloon` bu ortamda hiç çizilmiyor (B1 ile aynı sınıf: native
 * bildirim yüzeyi bu makinede render olmuyor). "Açık VE görünür" şartının (ADR-011 ek kararı)
 * görünür yarısını, ölçülebilir bir `BrowserWindow` taşır; balon yalnızca ek/opsiyonel kanal
 * olarak bırakılır (çalıştığı makinelerde ekstra bilgi, çalışmadığı makinelerde zararsız no-op).
 * Fatal hatanın aksine kullanıcı kapatana kadar `runApp`'ı BLOKLAMAZ (bilgilendirme amaçlı).
 */
function showAutostartEnabledNotice(BrowserWindow) {
  const win = new BrowserWindow({
    width: 420,
    height: 220,
    show: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Mission Control',
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.loadURL(
    `data:text/html,${encodeURIComponent(messageWindowHtml('Mission Control', AUTOSTART_ENABLED_MESSAGE))}`
  )
  return win
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
  const { app, BrowserWindow, Tray, Menu } = electronApi
  const {
    env = process.env,
    isPortFreeFn = isPortFree,
    loadServerModuleFn = loadServerModule,
    trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png'),
    fsImpl = fs,
    resolveProjectDirFn = resolveProjectDir,
    hasHookInfrastructureFn = hasHookInfrastructure,
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
    await showFatalErrorWindow(BrowserWindow, PORT_ERROR_TITLE, portErrorBody(port))
    app.quit()
    return { started: false, reason: 'port-in-use' }
  }

  // H1 (QA F-014 B2) — barındırılan CEO oturumu için gerçek proje dizinini bul; güvenlik
  // kancaları orada yoksa oturumu (ve bu tek-süreç modelinde ayrılamayan tüm uygulamayı) hiç
  // başlatma.
  const projectDir = resolveProjectDirFn(app, env)
  if (!hasHookInfrastructureFn(projectDir)) {
    await showFatalErrorWindow(BrowserWindow, HOOKS_MISSING_TITLE, hooksMissingBody(projectDir))
    app.quit()
    return { started: false, reason: 'hooks-missing' }
  }
  // `session.ts`'in kendi `__dirname` türetimi yalnızca bu değişken TANIMSIZKEN kullanılır
  // (tarayıcıdan `npm start`, testler) — burada AÇIKÇA gerçek proje dizinine sabitleniyor, bu
  // yüzden paketlenmiş kopyada session.ts'in `__dirname`'i asla kullanılmaz.
  env.MC_CHAT_SESSION_CWD = projectDir

  // §1 madde 4 — paketlenmiş uygulamanın kendi kullanıcı veri klasörü, repo `./data`'sıyla
  // karışmaz.
  const dataDir = path.join(app.getPath('userData'), 'data')

  // H3 (QA F-014 B3) — bu bloktaki yakalanmamış bir hata (ör. `dataDir` bir dosya tarafından
  // engellenmiş: AV kilidi, salt-okunur/dolu disk) eskiden hiçbir yere düşmüyordu; pencere yok,
  // tepsi yok, hata yok, süreç sonsuza kadar açık kalıyordu (zombi). Artık görünür bir hata
  // gösterilir ve `app.exit(1)` ile süreç KESİN olarak sonlanır (tek-örnek kilidi dahil, OS
  // kaynakları serbest kalır).
  let serverModule
  let server
  try {
    serverModule = loadServerModuleFn()
    server = serverModule.createServer(port, dataDir)
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err)
    await showFatalErrorWindow(BrowserWindow, STARTUP_ERROR_TITLE, startupErrorBody(messageText))
    app.exit(1)
    return { started: false, reason: 'startup-error', error: messageText }
  }

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
  // bildirilir (Ö2 düzeltmesi: tepsi balonu bu makinede hiç çizilmiyor, bu yüzden görünürlüğü
  // taşıyan asıl mekanizma artık bir `BrowserWindow` — balon yalnızca ek kanal).
  const justEnabledAutostart = skipDefaultAutostart
    ? false
    : ensureDefaultAutostart(
        app,
        path.join(app.getPath('userData'), 'autostart-initialized.json'),
        fsImpl
      )
  rebuildTrayMenu()
  tray.on('click', showAndFocus)
  if (justEnabledAutostart) {
    if (typeof tray.displayBalloon === 'function') {
      tray.displayBalloon({ title: 'Mission Control', content: AUTOSTART_ENABLED_MESSAGE })
    }
    showAutostartEnabledNotice(BrowserWindow)
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
    projectDir,
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
  }).catch(async (err) => {
    // H3 — son emniyet ağı (CLAUDE.md dersi: dağıtıcı/bootstrap sınırının kendisi de çitlenmeli).
    // `runApp` içindeki `try/catch` (yukarı bak) ana senaryoyu (createServer hatası) zaten
    // yakalıyor; bu ikinci katman yalnızca `runApp`'ın KENDİSİNİN beklenmedik şekilde
    // reddetmesi ihtimaline karşı — hiçbir hata sessiz zombiye dönüşmesin.
    const messageText = err instanceof Error ? err.message : String(err)
    try {
      await showFatalErrorWindow(BrowserWindow, STARTUP_ERROR_TITLE, startupErrorBody(messageText))
    } catch {
      // Pencere de başarısız olsa süreç yine de temiz kapanmalı.
    }
    app.exit(1)
  })
}

module.exports = {
  DEFAULT_PORT,
  PORT_ERROR_TITLE,
  HOOKS_MISSING_TITLE,
  STARTUP_ERROR_TITLE,
  AUTOSTART_ENABLED_MESSAGE,
  portErrorBody,
  hooksMissingBody,
  startupErrorBody,
  resolvePortLike,
  isPortFree,
  ensurePortAvailable,
  resolveProjectDir,
  hasHookInfrastructure,
  loadServerModule,
  setAutostart,
  getAutostart,
  ensureDefaultAutostart,
  buildTrayMenuTemplate,
  runApp,
}
