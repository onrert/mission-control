# F-014 — Sözleşme: Masaüstü uygulaması (Electron kabuğu, tepsi, açılışta başlama)

Kanıt işaretleri: **✓ DOĞRULANDI** (okudum/çalıştırdım) · **⊢ ÇIKARIM** (koddan/ölçümden mantıksal
sonuç) · **[T] TAHMİN** (doğrulanmadı, geliştirme turunda ölçülmeli).

---

## §0 — ZORUNLU İLK İŞ: `hasInstallScript` guard ölçümü

**Yöntem:** Depo dışında (`…/scratchpad/electron-probe`, `…/builder-probe`, `…/packager-probe`,
`…/tsx-interop-probe`), her biri kendi `npm init -y` ile, gerçek `npm install` (lock-only değil)
çalıştırıldı. Depo içinde **hiçbir `npm install` çalıştırılmadı** (`git status` bunu bu sözleşme
dosyası dışında değişiklik olmadığını gösterir, aşağıya bakınız).

### Bulgu 1 — `electron` paketinin kendisi: **guard'a ÇARPMIYOR**

✓ DOĞRULANDI — `electron@44.2.0`'ın **yayınlanmış tarball'ının** (`npm pack` ile indirilip
`tar -xzf` ile açıldı, registry özet metadatasına değil gerçek pakete bakıldı) `package.json`'unda
`"scripts"` alanı **hiç yok** (`undefined`, boş obje bile değil). Gerçek `npm install
electron@44.2.0` sonrası `node_modules/electron/` içinde **`dist/` klasörü oluşmadı** — yani
paket, npm'in `postinstall`/`install` yaşam döngüsüyle **otomatik ikili indirmiyor**. İndirme
mantığı `install.js`'te var (`@electron/get` ile önceden derlenmiş bir zip indirip açıyor — kaynak
derleme YOK, `node-gyp` yok) ama bu dosya bir `bin` girdisi (`"install-electron": "install.js"`)
olarak yayınlanmış, bir yaşam döngüsü script'i **değil**. Sonuç: `hasInstallScript` bu paket için
`package-lock.json`'da **hiç işaretlenmiyor** (ölçüldü: `lock.packages['node_modules/electron']`
→ `hasInstallScript` alanı yok).

**Sonuç:** Electron ikilisini indirmek için **ayrı, açık bir adım** gerekiyor (bkz. §1) — bu bir
maliyet değil, tam tersi: guard'ı hiç tetiklemeden istediğimiz "önceden derlenmiş ikili" davranışını
elde ediyoruz.

**Kritik kısıt (ölçüldü):** Kök `package.json`'a bu indirmeyi tetiklemek için `"postinstall"`,
`"preinstall"` veya `"prepare"` adında bir script eklenirse, `npm install` ANINDA kökün kendisini
(`lock.packages['']`) `hasInstallScript: true` yapıyor ve `deps.test.ts`'in offender listesine
giriyor (ölçüldü: kök `package.json`'a `postinstall` eklenip gerçek `npm install` çalıştırıldı →
`lock.packages['']` → `{"hasInstallScript":true,...}`). **Sıradan bir isimle** (`"electron:fetch"`
gibi, yaşam döngüsü ismi olmayan) aynı komut eklenince kökte `hasInstallScript` **hiç görünmüyor**
(aynı yöntemle ölçüldü, `package-lock.json` silinip yeniden `npm install` çalıştırıldı). **Bu
sözleşmenin §1'i bu yüzden electron indirmesini kesinlikle bir npm yaşam döngüsü script'ine
BAĞLAMIYOR** — sıradan isimli bir `npm run` script'i kullanılacak.

### Bulgu 2 — Paketleyici kıyaslaması

| Paketleyici | Toplam paket | `hasInstallScript` offender | Detay |
|---|---|---|---|
| `electron-builder` | 284 | **1** — `electron-winstaller@5.4.0` | ✓ DOĞRULANDI: `app-builder-lib`'in peer zinciri (`electron-builder-squirrel-windows` → `electron-winstaller`) npm 7+ otomatik peer kurulumuyla geliyor, `optional: true` DEĞİL. Kendi `install` script'i (`node ./script/select-7z-arch.js`) yalnızca mevcut arch için önceden-vendörlenmiş `7z.exe`/`7z.dll`'i kopyalıyor — derleme yok, ağ indirmesi yok. Esbuild'in beyaz liste gerekçesiyle (`deps.test.ts` satır 14) AYNI sınıf, ama bugün beyaz listede DEĞİL. |
| `@electron/packager` | 52 | **0** | ✓ DOĞRULANDI: tam bağımlılık ağacı tarandı (`lock.packages` üzerinde `hasInstallScript` filtresi), hiçbir offender yok. |

**Karar: `@electron/packager` seçildi.** Gerekçe:
1. Guard'a **hiç çarpmıyor** — `deps.test.ts`'e dokunmaya (beyaz liste genişletmeye) hiç gerek yok.
2. Kabul kriterlerinin hiçbiri kurulum sihirbazı/imzalı installer istemiyor ("çift tıklamayla
   açılıyor" — packager çıktısı zaten çalıştırılabilir bir `.exe` üretir).
3. Tepsi, tek örnek kilidi ve açılışta başlatma **Electron'un kendi API'leri** (`Tray`,
   `app.requestSingleInstanceLock`, `app.setLoginItemSettings`) ile karşılanıyor — hiçbiri ek
   paket gerektirmiyor. Karpathy §2: `electron-builder`'ın 284 paketlik yüzeyi bu feature'ın
   ihtiyacına göre gereksiz soyutlama olurdu.
4. **Reddedilen alternatif** (`electron-builder`) net: yalnızca gerçek bir kurulum sihirbazı
   (NSIS/Squirrel) gerekirse yeniden değerlendirilmeli — o zaman `electron-winstaller`'ın
   `deps.test.ts` beyaz listesine (yukarıdaki gerekçeyle) eklenmesi ayrı bir CEO kararı gerektirir;
   bu sözleşme o kapıyı **açmıyor**.

### Bulgu 3 — TS/ESM sunucu modülünün Electron'dan (CJS) değiştirilmeden çağrılabilirliği

✓ DOĞRULANDI (izole deneyle) — `tsx@latest`, ayrı bir scratch dizininde kuruldu. `import.meta.url`
kullanan bir ESM `.ts` modülü (`src/server/index.ts`'in `__dirname` desenini birebir taklit eder)
yazıldı; bir `.cjs` dosyası `require('tsx/cjs/api').register()` çağırıp ardından bu `.ts` dosyasını
doğrudan `require(...)` etti. Çalıştırıldı: dışa aktarılan fonksiyon **doğru** `__dirname` değeriyle
çağrıldı, hata yok. Bu, §1'in tasarımının (Electron ana süreci `src/server/index.ts`'i **hiç
değiştirmeden**, `.cjs` bir giriş noktasından çağırabileceğinin) teknik olarak mümkün olduğunu
kanıtlar — ⊢ ÇIKARIM: gerçek `src/server/index.ts` dosyasıyla kodlama turunda tek bir smoke test'le
doğrulanmalı (bu sözleşme kod yazmıyor), ama teknik risk düşük ölçüldü.

**Sonuç: Guard'a çarpılmıyor. Sözleşmeye devam ediliyor.**

---

## §1 — Süreç modeli

**Tek süreç, aynı Node ortamı.** Electron ana süreci (`electron/main.cjs`, **`.cjs` uzantısı
zorunlu** — `CLAUDE.md`'nin kayıtlı dersi: kök `package.json`'da `"type":"module"` var, `.js`
uzantılı bir dosya ESM sayılır ve `require` patlar) şunları yapar:

1. `require('tsx/cjs/api').register()` — TS/ESM dosyalarını `require` edilebilir hâle getirir
   (§0 Bulgu 3'te doğrulandı).
2. `require('../src/server/index.ts')` — **dosya hiç değişmez**, orijinal konumundan, orijinal
   göreli yol varsayımlarıyla (`distWebDir = __dirname/../../dist/web`) yüklenir. Bu yüzden
   paketleme çıktısında `src/`, `dist/web/` ve üretim `node_modules`'ı **kaynak ağaçtaki göreli
   konumlarıyla birebir** kopyalanmalı (bundling/relocation YOK — `esbuild` ile paketleme
   YAPILMAYACAK, çünkü bu göreli yol varsayımını bozma riski taşır ve gereksiz bir soyutlama
   katmanı olurdu, Karpathy §2).
3. `createServer(port, dataDir)` **doğrudan** çağrılır — `main()` DEĞİL. `src/server/index.ts:519`
   `isMainModule = process.argv[1] === fileURLToPath(import.meta.url)` kontrolü ✓ DOĞRULANDI:
   `require(...)` ile yüklendiğinde `process.argv[1]` Electron'un kendi giriş dosyasını gösterir,
   bu yüzden `main()` **otomatik çalışmaz** — zaten test edilebilirlik için tasarlanmış bu ayrım
   (`isSupportedNodeVersion`, `createServer`, `shutdown` hepsi export edilmiş) burada aynen
   kullanılıyor, yeni bir mekanizma icat edilmiyor.
4. `dataDir` = `app.getPath('userData') + '/data'` (paketlenmiş uygulamanın kendi kullanıcı veri
   klasörü — repo `./data`'sıyla karışmaz).
5. Kapanışta `shutdown(server, server.sseHub)` **doğrudan** çağrılır (bkz. §2).

**Neden alt süreç DEĞİL:** Windows'ta `child_process.kill()` sinyal semantiği güvenilmez (POSIX
sinyalleri native değil); ayrı bir süreç modeli "yetim süreç" riskini **artırır** (Electron ana
süreci çökerse alt süreç yetim kalabilir). Tek süreç modelinde yetim süreç sınıfı **yapısal olarak
yok olur**: sunucu ayrı bir süreç değil, Electron'un kendi ana sürecinin bir parçası — o süreç
sonlanınca (normal çıkış veya çökme) geriye hiçbir şey kalmaz. Bu, `CLAUDE.md`'nin üç kez
tekrarlayan "yetim süreç" dersine karşı en güçlü yapısal savunma.

**Bedel (kabul edilen):** Sunucu kodundaki yakalanmamış bir hata artık Electron ana sürecini de
etkileyebilir. Mevcut savunmalar (`unhandledRejection` güvenlik ağı, `withDispatchErrorBoundary`)
zaten `src/server/index.ts`'te var ve bu feature onlara dokunmuyor — F-014 bu riski **değiştirmiyor**,
yalnızca aynı süreç sınırının kapsamını genişletiyor.

---

## §2 — Yaşam döngüsü

- **Pencere kapatma (X):** `mainWindow.on('close', (e) => { e.preventDefault(); mainWindow.hide() })`
  — sunucu çalışmaya devam eder (olay toplama, dosya izleme durmaz — zaten aynı süreçte, ayrıca
  durdurulacak bir şey yok).
- **Tepsi tıklaması:** pencere gizliyse göster + odakla; görünürse odakla.
- **Tepsi → "Çıkış":** `shutdown(server, server.sseHub)` çağrılır (mevcut export, `hub.closeAll()`
  → `server.close()` sırası zaten `shutdown()`'ın kendi içinde, `src/server/index.ts:492-499`'da
  ✓ DOĞRULANDI) → callback'te `app.quit()` (`shutdown`'ın varsayılan `exit` parametresi
  `process.exit` yerine burada `app.quit`'i çağıran ince bir sarmalayıcı kullanılır — `shutdown`'ın
  kendi imzası zaten `exit` enjekte edilebilir yaptığı için `src/server/index.ts` değişmeden bu
  mümkün).
- **Uygulama çökerse (Electron ana süreci beklenmedik şekilde ölürse):** işletim sistemi süreci
  zaten sonlandırır; ayrı bir alt süreç olmadığı için **yapısal olarak yetim kalacak bir şey yok**
  (§1). Test: mutasyon M3 (aşağı).
- **Garanti nasıl kuruluyor:** ayrı süreç yaratılmaması (§1) + `shutdown()`'ın mevcut, zaten test
  edilmiş kapanış sırası (`tests/server/graceful-shutdown.test.ts` emsali).
- **Nasıl test ediliyor:** (a) birim testi — tepsi "Çıkış" tıklama handler'ı gerçek `shutdown`
  fonksiyonunu (enjekte edilebilir, spy ile) çağırdığını doğrular; (b) E2E duman testi (§8) —
  paketlenmemiş ama derlenmiş uygulama Playwright'ın Electron desteğiyle (`_electron`,
  `@playwright/test`'in **zaten mevcut** bir parçası — yeni bağımlılık yok) başlatılır, sunucunun
  `/api/health`'e yanıt verdiği doğrulanır, sonra ana süreç `app.quit()` ile kapatılır ve **süreç
  gerçekten sonlanır** (`electronApp.process().exitCode` veya `waitForEvent('close')`) + port
  serbest kalır (yeni bir `net` dinleyicisi 7333'e bağlanabilir).

---

## §3 — Tek örnek (single instance)

`app.requestSingleInstanceLock()` (Electron'un kendi OS-seviyesi kilidi, ek paket yok). `false`
dönerse: **hiçbir şey başlatılmadan** (`createServer` hiç çağrılmadan) `app.quit()`. `true` dönen
"kazanan" örnekte `app.on('second-instance', () => { pencereyi göster + odakla })` dinlenir.

**Port çakışmasıyla ayrım:** tek-örnek kilidi OS düzeyinde (Electron'un kendi kilit dosyası/mutex'i)
çalışır, port kontrolünden **önce** ve **bağımsız** çalışır — ikinci açılışta port hiç kontrol
edilmez, çünkü `createServer` hiç çağrılmaz. Bu, "port dolu mu" sorusuyla "aynı uygulama zaten açık
mı" sorusunu birbirine karıştırmaz (aksi hâlde ikinci örnek, kendi sunucusunun DEĞİL, birinci
örneğin sunucusunun portunu dolu bulup yanlış bir "port çakışması" hatası gösterebilirdi).

---

## §4 — Port çakışması (7333 dolu)

**Ön kontrol, `createServer` çağrılmadan ÖNCE.** `scripts/check-ports.mjs`'in zaten kurulu
deseni (bağımsız `net.createServer().listen()` probu, ✓ DOĞRULANDI kod okunarak) `electron/`
içinde küçük bir kopya olarak kullanılır (aynı proje emsali — `check-ports.mjs`'in kendi başlığı
`src/server/index.ts`'ten "bilerek ayrı bir kopya" olduğunu zaten söylüyor; aynı gerekçe burada da
geçerli, `.mjs`/`.cjs` TS import edemiyor). Port doluysa:
- `dialog.showErrorBox('Mission Control başlatılamadı', '<port> portu başka bir uygulama
  tarafından kullanılıyor…')` (Türkçe metin taslağı §9).
- `createServer` **hiç çağrılmaz** — yabancı bir sürece sessizce bağlanma **yapısal olarak imkânsız**
  (N4 dersi: risk "bağlanma" değil "hiç başlamama" ile ortadan kaldırılıyor, tespit edilemeyen bir
  duruma düşülmüyor).
- `app.quit()`.

**Kabul edilen artık risk (TOCTOU):** ön kontrol ile gerçek `.listen()` çağrısı arasında port başka
bir süreç tarafından tutulabilir. Bu durumda `src/server/index.ts:468-474`'ün kendi `server.on(
'error')` işleyicisi (✓ DOĞRULANDI, dosya değişmiyor) `EADDRINUSE`'ta **doğrudan `process.exit(1)`**
çağırır — Electron ana süreci de bu süreç olduğu için tüm uygulama **diyalogsuz** kapanır. Bu,
`scripts/check-ports.mjs`'in zaten kabul ettiği aynı sınıf yarış durumudur (yeni bir risk değil,
mevcut bir desenin tekrarı) ve düzeltmek `src/server/index.ts`'e dokunmayı gerektirirdi (kapsam
dışı). Kalan risk olarak §"Kalan risk" bölümüne yazılacak.

---

## §5 — Açılışta başlama

`app.setLoginItemSettings({ openAtLogin: <bool>, path: process.execPath, args: [] })` — ek paket
yok. Tepsi menüsünde onay kutulu bir madde ("Bilgisayar açılışında başlat") — tıklanınca
`getLoginItemSettings().openAtLogin`'in tersini `setLoginItemSettings`'e yazar, menü yeniden
çizilir (Electron `Menu` her açılışta yeniden inşa edilir).

**Varsayılan: AÇIK.** ⊢ ÇIKARIM: `ADR-011`'in KARAR bölümünün gerekçesi birebir "Windows
açılışında başlayıp tepside dinlemek" olduğu ve kullanıcının orijinal şikâyeti "paneli açmayı
unutuyorum" olduğu için, varsayılanın kapalı olması feature'ın **kendi gerekçesini** karşılamaz.
**Bu bir varsayımdır, CEO/kullanıcı onayına açık** — `docs/03-ux.md`'ye yazılırken teyit edilmeli
(§9'a taslak olarak eklendi, dosyaya ben dokunmuyorum).

**Bilinen sınırlama (kapsam dışı, §10):** `path: process.execPath` paketlenmemiş (kurulumsuz)
çıktının kendi klasör konumuna işaret eder; kullanıcı klasörü taşırsa/silerse açılış girdisi
kırılır. İmzalı installer/otomatik güncelleme olmadığı için (§10) bu kabul edilen bir sınırlama.

---

## §6 — Sohbet varsayılan açık

✓ DOĞRULANDI (kod okunarak, **hiçbir değişiklik gerekmiyor**):
- Sunucu: `src/features/chat/server/session.ts:47-57` `isChatEnabled(env)` — `MC_CHAT_ENABLED`
  tanımsızsa `true` döner (varsayılan AÇIK).
- İstemci: `src/web/App.tsx:24-35` sekmeyi `chat.status?.chat_enabled` üzerinden gösterir — hiçbir
  build-time bayrağa veya istemci ortam değişkenine bakmaz (F-012 QA tur 2 Y2 düzeltmesinin
  doğrudan sonucu, ✓ DOĞRULANDI yorum satırlarından).

**Electron'un tek sorumluluğu:** `process.env.MC_CHAT_ENABLED`'a **hiç dokunmamak** (ne
`electron/main.cjs`'te set etmek, ne kaldırmak). Kullanıcı bunun var olduğunu bilmek zorunda
değil çünkü Electron ortamında bu değişken zaten tanımsız olacak (kullanıcı terminalden Electron'u
başlatmıyor, çift tıklamayla açılan `.exe`'nin miras aldığı ortamda bu değişken yok) — varsayılan
zaten AÇIK. Mutasyon M5 (aşağı) bu "dokunmama" garantisini gerçek `isChatEnabled` fonksiyonuyla
ölçer.

---

## §7 — Geri dönüş yolu (tarayıcı)

`npm start` (`tsx src/server/index.ts`, hiç değişmiyor) çalışmaya devam eder — Electron bu akışı
hiçbir şekilde değiştirmiyor, ayrı bir giriş noktası (`electron/main.cjs`) ekliyor.

**Açık kısıt (belgelenmesi gereken, çelişki değil):** Electron **her zaman kendi sunucusunu**
başlatır veya reddeder (§4) — hiçbir zaman zaten çalışan bir `npm start` örneğine **bağlanmaz**.
Yani kullanıcı aynı anda hem terminalden `npm start` hem Electron'u **aynı porta karşı** çalıştıramaz
— ikincisi açılan, port dolu hatasını görür (§4). Bu, N4/politika gereği **istenen** davranıştır
(sessiz yabancı bağlantı yasak); iki kullanım biçimi birbirini **dışlar**, birbirini **bozmaz**.

---

## §8 — Test planı ve mutasyon listesi

| AC | Test |
|---|---|
| Çift tıklama, terminal komutu yok, sohbet açık | `tests/e2e/electron-smoke.spec.ts` (Playwright `_electron`) |
| Kapatma → tepside devam | `tests/electron/lifecycle.test.ts` (birim) + smoke test |
| Tepsi Çıkış → gerçek kapanma, yetim yok | `tests/electron/lifecycle.test.ts` + smoke test (M3) |
| Açılışta başlama aç/kapa | `tests/electron/autostart.test.ts` (M6) |
| Port çakışması okunabilir hata | `tests/electron/port-guard.test.ts` (M1/M4) |
| Tarayıcı geri dönüş yolu bozulmuyor | mevcut `npm run verify` + `npm run e2e` **değişmeden** yeşil kalmalı (regresyon) |
| Tek örnek | `tests/electron/single-instance.test.ts` (M2) |
| Yalnızca Windows | `package.json`/paketleme betiği `win32` sabit — statik inceleme, ADR-009 |
| Native derleme yok | `tests/deps.test.ts` **değişmeden** yeşil kalmalı (§0 zaten kanıtladı) |
| `npm run verify`/E2E bozulmuyor | CI + yerel `npm run verify` sıfır regresyon |

### Mutasyonlar (en az 5, hepsi gerçek bir koruma noktasını hedefliyor)

1. **M1 — port ön kontrolü kaldırılırsa:** `ensurePortAvailable()`'ın (yeni, gerçek `net` probu
   kullanan fonksiyon) çağrısı `electron/main.cjs`'ten silinir → 7333'ü tutan gerçek bir `net`
   dinleyicisiyle çalıştırılan `port-guard.test.ts` **KIRMIZI** vermeli (`createServer` spy'ı
   çağrılmış olur, olmaması gerekirken).
2. **M2 — tek örnek kilidi yoksayılırsa:** `app.requestSingleInstanceLock()`'un `false` dönüşü
   kontrol edilmeden geçilirse (`if (!gotLock) app.quit()` satırı silinir) →
   `single-instance.test.ts`, ikinci örneği simüle ettiğinde (`requestSingleInstanceLock` mock'u
   `false` döner) `createServer`'ın **yine de çağrıldığını** görüp KIRMIZI vermeli.
3. **M3 — tepsi "Çıkış" gerçek `shutdown()`'ı çağırmazsa:** handler'daki `shutdown(server, hub)`
   çağrısı `app.quit()` ile değiştirilirse (yalnızca sert çıkış) → `lifecycle.test.ts`'teki
   `shutdown` spy'ı (gerçek, enjekte edilebilir fonksiyona sarılı) **çağrılmadığı** için KIRMIZI.
   Totoloji DEĞİL: test spy'ın çağrıldığını, handler'ın kendi beklenen dönüş değerini değil,
   gerçek modülden import edilen `shutdown` referansının kimliğini doğrular.
4. **M4 — pencere kapatma varsayılan davranışa bırakılırsa:** `close` olayında
   `event.preventDefault()` satırı silinirse → `lifecycle.test.ts`, kapatma sonrası
   `mainWindow.isDestroyed()`/`app.quit` çağrıldığını (gizlenmek yerine) tespit edip KIRMIZI
   vermeli.
5. **M5 — `MC_CHAT_ENABLED` yanlışlıkla set edilirse:** `electron/main.cjs`'e
   `process.env.MC_CHAT_ENABLED = '0'` satırı eklenirse → `chat-enabled.test.ts`, Electron'un
   bootstrap fonksiyonunu çalıştırdıktan SONRA gerçek `session.ts`'ten import edilen
   `isChatEnabled(process.env)`'i çağırıp **`false`** aldığı için KIRMIZI vermeli (gerçek üretim
   fonksiyonu kullanılıyor, elle yazılmış beklenen değer değil — totoloji tuzağından kaçınıyor).
6. **M6 — açılışta başlama toggle'ı input'u yoksayıp sabit değer yazarsa:**
   `setLoginItemSettings` çağrısı her zaman `{openAtLogin: true}` gönderecek şekilde
   sabitlenirse → `autostart.test.ts`, toggle fonksiyonunu `false` ile çağırıp mock
   `setLoginItemSettings`'in **`{openAtLogin:false}`** ile çağrıldığını bekleyip KIRMIZI vermeli.

Her mutasyon: uygula → ilgili testi izole çalıştır → KIRMIZI gözlemi kaydet → Edit ile birebir
geri al → tekrar yeşil doğrula (bu projenin standart deseni, `docs/progress.md`'deki her turda
uygulanan yöntem).

---

## §9 — Kullanıcıya görünen Türkçe metinler (taslak, `docs/03-ux.md`'ye işlenecek)

| Yer | Metin |
|---|---|
| Tepsi ikonu tooltip | "Mission Control" |
| Tepsi menüsü | "Paneli Aç" · "Bilgisayar açılışında başlat" (onay kutulu) · "Çıkış" |
| Port çakışması diyaloğu (başlık) | "Mission Control başlatılamadı" |
| Port çakışması diyaloğu (gövde) | "7333 portu başka bir uygulama tarafından kullanılıyor. Panel açılamıyor. Önce o portu kullanan programı kapatın veya MC_PORT ortam değişkeniyle farklı bir port seçin." |
| Tek örnek (ikinci açılış) | Diyalog yok — mevcut pencere odaklanır. (Opsiyonel: tepsi balonu "Mission Control zaten çalışıyor.") |

**Varsayım (§5 ile aynı):** "Bilgisayar açılışında başlat" varsayılan **işaretli**. CEO/UX onayı
gerekir; onaylanmazsa tek satırlık değişiklik.

---

## §10 — Kapsam dışı

- Otomatik güncelleme (`electron-updater` vb.) — kullanılmıyor, eklenmiyor.
- Kod imzalama / notarization — Windows'ta imzasız `.exe` üretilir (SmartScreen uyarısı
  görülebilir, kullanıcı "Yine de çalıştır" der; tek kullanıcılı yerel araç, kabul edilen risk).
- Kurulum sihirbazı / Start Menu kısayolu / kaldırma programı — `@electron/packager` çıktısı ham
  bir klasördür (`release/mission-control-win32-x64/mission-control.exe`), installer YOK
  (§0 Bulgu 2'nin doğrudan sonucu).
- macOS/Linux paketleme — `ADR-009` gereği yasak.
- `KURULUM.md`'ye electron kurulum adımının (`npm run electron:fetch`) eklenmesi — bu sözleşmenin
  kapsamı dışı (dosya sahipliği: F-014 yalnızca `electron/**`, `package.json`, paketleme
  yapılandırması, ilgili testler; `KURULUM.md` listede yok) ama kodlama turunda unutulmaması için
  burada not edildi — geliştirici bunu ayrı bir küçük ek olarak önerebilir, kendi dosya
  sahipliğini genişletmeden önce CEO'ya sorsun.
- `docs/HANDOFF.md`'nin "iki CEO oturumu paralel commit" riski (feature notu "Notlar" bölümü) —
  bu bir süreç/disiplin konusu, kod değişikliği gerektirmiyor; bu sözleşmenin kapsamı dışı.

---

## Dosya sahipliği (feature notundan, değişmedi)

`electron/**` (yeni) · `package.json` (script + bağımlılık: `electron`, `@electron/packager`
devDependencies) · `scripts/package-electron.mjs` (yeni, paketleme betiği) · `eslint.config.js`
(yeni `electron/**` kapsamı + yeni build çıktısı klasörlerinin ignore edilmesi) · `.gitignore`
(yeni çıktı klasörü) · `tests/electron/**` (yeni) · `tests/e2e/electron-smoke.spec.ts` (yeni).
**`src/features/**` ve `src/web/**` değişmiyor.** `src/server/index.ts` **değişmiyor** (§1/§3
Bulgu 3, kanıtlı).

## Kalan risk (kodlama turuna devredilecek)

- §4'teki TOCTOU port yarışı (`check-ports.mjs` emsaliyle aynı sınıf, çözülmedi, kabul edildi).
- §1 Bulgu 3'ün gerçek `src/server/index.ts` dosyasıyla (izole bir taklit değil) smoke test'i
  kodlama turunda yapılmalı — izole deney güçlü bir ⊢ ÇIKARIM verdi ama ✓ DOĞRULANDI değil.
- §5/§9'daki "varsayılan açık" kararı CEO/kullanıcı onayına açık varsayım.
- Packager'ın devDependencies'i çıktıya dahil edip etmediği (özellikle `tsx`+`esbuild`'in
  paketlenmiş `node_modules`'a girmesi gerekiyor, `--prune` varsayılanı bunları silebilir) —
  kodlama turunda `package-electron.mjs`'in `ignore`/`prune` ayarıyla ölçülüp doğrulanmalı.

---

## Ek — I2 (CEO kararı, 2026-09-06): barındırılan sohbet oturumu TEMBEL başlar

**Bağlam:** QA F-014 tur2 N2 (`docs/qa/F-014-2026-09-06-tur2.md`) uygulama açılışında kullanıcı
hiçbir şey yazmadan bir `SessionStart → UserPromptSubmit → Stop` deseni gözlemledi — kesin kök
neden ayrı ayrı kanıtlanamadı (paylaşılan proje dizininde başka bir Claude Code oturumunun aynı
event sunucusuna yazması da mümkün), ama CEO bağımsız olarak karar verdi: **uygulama açılışı tek
başına gerçek bir model çağrısı YAPAMAMALI** — ADR-011 ile bu uygulama Windows açılışında her gün
otomatik başlayacak, bu yüzden potansiyel günlük kota sızıntısı riskli.

**Ne değişiyor (dosya sahipliği genişletmesi, bkz. `docs/features/F-014-masaustu-uygulamasi.md`
"Dosya sahipliği" bölümü, I3 notu):** `src/features/chat/server/session.ts`'in `bootstrap()`'ı
artık gerçek `deps.query()` (SDK'nın alt süreci spawn eden, model çağrısı potansiyeli taşıyan
çağrısı) YAPMAZ — yalnızca `historyLog.init()` + önceki `session_id`'yi okuyup saklar. Gerçek
`query()` çağrısı yeni bir `startSession()` fonksiyonuna taşınır ve İLK `sendMessage()`
çağrısında (kullanıcı gerçekten bir şey yazdığında) tembelce tetiklenir. `restart()` kullanıcının
açık talebi olduğu için `startSession()`'ı HER ZAMAN hemen çağırır (tembel değildir — bu bilinçli
bir kullanıcı eylemi, açılış değil).

**Davranış nasıl doğrulanacak:**
1. Birim testi (`tests/features/chat/server/session.test.ts`): `bootstrap()` çağrıldıktan sonra,
   `sendMessage()` HİÇ çağrılmadan, sahte `query()` fabrikasının **hiç çağrılmadığı**
   (`getHandles()` uzunluk **0**) doğrulanır. Aynı testte `getStatus().chat_enabled`/
   `session_active`'in hâlâ kullanılabilir durumda olduğu (arayüz "kapalı" göstermez) ayrıca
   ölçülür.
2. Mutasyon çiti: `sendMessage()`'daki tembel-başlatma dalı (`if (inputPush === undefined) { void
   startSession(...) }`) kaldırılınca, "ilk mesaj sonrası query() çağrılır" testinin **KIRMIZI**
   verdiği gösterilir (uygula → kırmızı gözlemle → geri al).
3. Var olan `bootstrapSession()` tabanlı testler (mevcut 18 kullanım) `sendMessage()`'ı zaten
   `getHandles()`'tan ÖNCE çağırıyor — bunlar davranış değişikliğinden etkilenmez. Yalnızca
   `getHandles()`'a `sendMessage()` OLMADAN erişen 3 test (bootstrap seçenekleri, restart, K3
   çevrimdışı çit, stopAll) güncellenip başlarına bir `sendMessage()` eklenir (gerçek kullanım
   akışını yansıtan, davranışı gizlemeyen bir düzeltme).
4. `tests/e2e/helpers/chat-fake-server.ts`'in `getHandles()[0]` bekleme döngüsü artık ilk
   tarayıcı mesajını bekleyeceği için süresini büyütmek gerekir (2 sn → E2E test timeout'unun
   güvenle altında bir değer) — davranış değişmiyor, yalnızca bekleme bütçesi büyüyor.

**Kapsam dışı bırakılan:** N2'nin kesin kök nedeni (paylaşılan event sunucusunun başka bir
oturumdan mı yoksa gerçekten hosted session'dan mı kaynaklandığı) bu ekin konusu değil — tembel
başlatma, kaynak ne olursa olsun "açılış = sıfır model çağrısı" garantisini sağlar.
