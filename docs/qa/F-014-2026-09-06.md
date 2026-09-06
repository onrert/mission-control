KARAR: KALDI
ESKALE: false

# F-014 — QA raporu (Electron masaüstü kabuğu, tepsi, açılışta başlama)

- **Tarih:** 2026-09-06
- **Tur:** kod turu (ilk QA)
- **Test edilen artefakt:** `C:\dev\apps\mission-control\release\Mission Control-win32-x64\mission-control.exe`
  (paketlenmiş `electron/main.cjs` deponunkiyle **birebir aynı** — `diff` farksız)
- **Yöntem:** gerçek `.exe` çift tıklama eşdeğeri (npm/tsx yok), gerçek OS tepsi menüsü
  (win32 fare otomasyonu + UIAutomation), gerçek Windows kayıt defteri, gerçek SSE akışı,
  hata enjeksiyonu, 7 mutasyon.

---

## KARAR GEREKÇESİ (özet)

Feature notunun kendi ölçütü: *"Başarı ölçütü 'masaüstü penceresi var mı' DEĞİL, 'elle sunucu
başlatmak gerekiyor mu'dur."* Pencere, tepsi, tek örnek ve tepsiden çıkış **gerçekten çalışıyor**
(aşağıda sayıyla kanıtlı). Ancak üç şey KALDI'yı zorunlu kılıyor:

1. **Port çakışmasında kullanıcı HİÇBİR ŞEY görmüyor** (AC5 ihlali). `dialog.showErrorBox` bu
   makinede **hiçbir pencere üretmiyor** — izole bir sonda uygulamasıyla kanıtlandı: aynı süreçte
   `BrowserWindow` çiziliyor, hata kutusu çizilmiyor. Uygulama ~7 sn sonra sessizce ölüyor.
2. **Masaüstü uygulamasındaki CEO sohbeti, deponun kendisinde değil paketlenmiş kopyada
   (`release\...\resources\app`) çalışıyor**: `docs/` yok, `.git` yok, `.claude/settings.json`
   (hook'lar/çitler) yok. F-012 + ADR-014 paneli CEO oturumunun arayüzü yaptı ve kullanıcı
   *"artık oradan çalışırım"* dedi — bu hâliyle oradan çalışmak, sürüm alındığında silinecek ve
   git'in görmediği bir kopyada, projenin tüm hook çitleri kapalıyken çalışmak demek.
3. **Başlatma yolunda yakalanmamış hata → 3 zombi süreç, pencere yok, tepsi yok, hata mesajı
   yok**; aynı userData ile sonraki her çift tıklama tek-örnek kilidine takılıp sessizce ölüyor.
   `app.whenReady().then(async () => ...)` zincirinde `.catch` yok — CLAUDE.md'nin üç kez
   tekrarlayan "yazma/başlatma yolundaki hata her şeyi öldürür" dersinin dördüncü biçimi.

Ayrıca **teslim durumunda açılışta başlatma varsayılanı fiilen KAPALI** (ADR-011 ek kararının
"AÇIK **ve** görünür" şartının ikisi de bu makinede sağlanmıyor, aşağıda Ö1/Ö2).

---

## 1. Kabul kriterleri — tek tek

| # | Kriter | Sonuç | Kanıt |
|---|---|---|---|
| AC1 | Çift tıklamayla açılır, terminal komutu yok, `MC_CHAT_ENABLED` bilmek gerekmez, **sohbet varsayılan açık** | **GEÇTİ** | `.exe` doğrudan başlatıldı (npm/tsx yok) → 4 süreç, 7333 LISTENING, pencere "Mission Control" açıldı (`docs/qa/screens/F-014-01-exe-acilis.png`). `MC_CHAT_ENABLED` hiç set edilmeden `GET /api/chat/status` → `"chat_enabled":true` |
| AC2 | Sunucu içeride başlar; pencere kapanınca **tepside devam** (olay toplama + dosya izleme durmaz) | **GEÇTİ** | Pencereye gerçek `WM_CLOSE` → pencere görünür listeden düştü, süreç 4, port hâlâ LISTENING, `/api/health` **aynı** `instance_id` (`5e494f50-…`). Pencere kapalıyken izlenen projeye yeni feature dosyası yazıldı → `/api/stream` üzerinden `event: features` **canlı geldi**, `/api/features` 1 → 2. `watchers:1` korundu |
| AC3 | Tepsiden Çıkış: sunucu gerçekten kapanır, **yetim süreç kalmaz** | **GEÇTİ** | **Gerçek OS tepsi menüsü** tıklandı (test kancası değil): öncesi `mission-control.exe` **4**, sonrası **0**; 7333 LISTENING **boş**; `/api/health` HTTP=000. Menü ekran görüntüsü: `F-014-03-tepsi-menusu-autostart-kapali.png` |
| AC4 | Windows açılışında başlama açılıp kapatılabilir; **varsayılanı belgede yazılı ve arayüzde görünür** | **KALDI** | Aç/kapa **çalışıyor** (tepsiden tıklandı → `HKCU\…\Run\electron.app.Mission Control` yazıldı; tekrar tıklandı → silindi; menüde ✓ göründü, `F-014-04-tepsi-menusu-autostart-acik.png`). **Ama:** teslim durumunda varsayılan fiilen KAPALI (Ö1) ve "görünür" yarısını taşıyan tepsi balonu **hiç çizilmiyor** (Ö2) |
| AC5 | Port çakışması **okunabilir biçimde** bildirilir; yabancı sunucuya sessizce bağlanılmaz | **KALDI** | 7333'ü gerçek bir yabancı sunucu tuttu → `.exe` başlatıldı: **hiçbir diyalog yok** (tam ekran kare `F-014-05-port-dolu-diyalog-yok.png`, "Mission" başlıklı görünür pencere yok), süreç ~7 sn sonra sessizce öldü. Yabancı sunucuya bağlanma **yok** (N4 dersi korunuyor) ama kullanıcı hiçbir şey görmüyor → B1 |
| AC6 | Tarayıcıdan kullanım (geri dönüş yolu) bozulmaz | **GEÇTİ** | `npm start` → `/api/health` 200 (`instance_id b163bf94…`), `/` 200, `/api/features` gerçek depo feature'larını döndürdü (F-001 …) |
| AC7 | Tek örnek: ikinci açılış yeni sunucu başlatmaz, var olan pencereyi öne getirir | **GEÇTİ** | İkinci başlatma: PID listesi **birebir aynı** (30328 31652 33032 34376), `instance_id` değişmedi, gizli pencere **geri geldi** (handle 118491624 yeniden görünür) |
| AC8 | ADR-009 — yalnızca Windows paketlenir | **GEÇTİ** | `scripts/package-electron.mjs`: `platform: 'win32'`, `arch: 'x64'` sabit; başka platform hedefi yok |
| AC9 | Native derleme yok, `deps.test.ts`'in `hasInstallScript` guard'ına çarpılmaz; guard gevşetilmez | **GEÇTİ** | `git log 7ea0e9f..HEAD -- tests/deps.test.ts` **boş** (dosyaya dokunulmamış), `npx vitest run tests/deps.test.ts` → 3/3 yeşil. Kök `package-lock.json` `packages[""].hasInstallScript` **yok**; kökte `postinstall`/`prepare`/`preinstall` **yok** (script adı `electron:fetch`) |
| AC10 | `npm run verify` ve mevcut E2E paketleri bozulmaz | **GEÇTİ (kayıtla)** | `npm run verify` = 0 (873 test/62 dosya), `npm run e2e` = 0 (23/23), `npm run e2e:electron` = 0 (1/1), `npx vitest run tests/electron` = 0 (12/12). Kayıt: tam paket koşusu bu ortamda **kararsız** (N3) |
| Ek | `src/features/**`, `src/web/**`, `src/server/index.ts` değişmemiş | **GEÇTİ** | `git log 7ea0e9f..HEAD -- src/` **boş** — F-014 hiç `src/` dosyasına dokunmamış |
| Ek | `release/` depoya girmemiş | **GEÇTİ** | `.gitignore:4` `release/`; `git ls-files release` → **0** dosya |

---

## 2. Mutasyon tablosu

Yöntem: uygula → ilgili paketi izole koştur → gözlemle → `git checkout` ile birebir geri al.
Sözleşme §8'in zorunlu dördü (a-d) + kendi seçtiğim üç ek mutasyon.

| # | Mutasyon | Hedef | Sonuç |
|---|---|---|---|
| M-A (§8 M3, zorunlu) | Tepsi "Çıkış" `serverModule.shutdown(...)` yerine yalnızca `app.quit()` | `lifecycle.test.ts` | **KIRMIZI** (1 failed / 11 passed) |
| M-B (§8 M1, zorunlu) | Port ön kontrolü kaldırıldı (`const portFree = true`) | `port-guard.test.ts` | **KIRMIZI** (1 failed / 11 passed) |
| M-C (§8 M2, zorunlu) | Tek örnek kilidi yoksayıldı (`if (!gotLock)` bloğu silindi) | `single-instance.test.ts` | **KIRMIZI** (1 failed / 11 passed) |
| M-D (§8 M5, zorunlu) | `runApp` içine `process.env.MC_CHAT_ENABLED = '0'` eklendi | `chat-enabled.test.ts` (gerçek `isChatEnabled`) | **KIRMIZI** (1 failed / 11 passed) |
| M-E (benim) | `close` handler'ından `if (isQuitting) return` koruması kaldırıldı (tepsi Çıkış'ı sessizce iptal eden gerçek hata) | `tests/electron` → **12/12 YEŞİL**; `e2e:electron` → **KIRMIZI** (60 sn timeout) | **Birim testleri kör, E2E yakalıyor** — N1 |
| M-F (benim) | Kullanıcıya görünen port hata metni "Error: EADDRINUSE" ile değiştirildi | `port-guard.test.ts` | **KIRMIZI** — UX metni çitlenmiş |
| M-G (benim) | `app.on('second-instance', showAndFocus)` dinleyicisi kaldırıldı | `single-instance.test.ts` | **KIRMIZI** |

Mutasyon kalıntısı taraması (bitirmeden):
`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca meşru test adı
`tests/server/write-gate-manifest.test.ts:124`. `git status` temiz.

**Mutasyonların ölçemediği yer:** M-B/M-F yalnızca `dialog.showErrorBox`'ın **çağrıldığını**
doğruluyor; "kullanıcı bir şey **görüyor** mu" sorusunu hiçbir test sormuyor. B1 tam bu boşluktan
geçti (N2).

---

## 3. Bulgular

### B1 — BLOKLAYICI · Port çakışmasında kullanıcı hiçbir şey görmüyor (AC5)

**Tekrar üretme**
1. 7333'ü tutan gerçek bir `net`/`http` dinleyicisi başlat.
2. `release\Mission Control-win32-x64\mission-control.exe` çift tıkla (ben `cmd /c start` ile
   başlattım — normal açılışta aynı yöntemle pencere sorunsuz açılıyor, yani yöntem farkı değil).

**Beklenen** (`docs/03-ux.md` 618-622 + sözleşme §4/§9): başlık *"Mission Control başlatılamadı"*,
gövde *"7333 portu başka bir uygulama tarafından kullanılıyor. Panel açılamıyor…"* diyaloğu.

**Gerçek:** hiçbir pencere yok. Ölçüm:
- t=2/4/6 sn → `mission-control.exe` **3 süreç**, t=8 sn → **0**. Kullanıcı etkileşimi olmadan öldü
  (modal bir diyalog blokluyor olsaydı beklemesi gerekirdi).
- t=3 sn'de tam ekran kare: `docs/qa/screens/F-014-05-port-dolu-diyalog-yok.png` — iki monitörde de
  diyalog yok. `EnumWindows` ile "Mission" içeren görünür pencere: yalnızca Chrome.

**Kök neden (izole edilmiş):** `dialog.showErrorBox` bu ortamda (Electron 44 / Windows 11) hiçbir
pencere üretmiyor. Kanıt — ürün kodundan bağımsız sonda uygulaması: aynı süreçte
`new BrowserWindow(...)` **çizildi** (`EnumWindows`: `QA PROBE PENCERE`, handle 13436698),
3 sn sonra çağrılan `dialog.showErrorBox('QA PROBE DIYALOG', …)` için **hiçbir pencere oluşmadı**
ve süreç o çağrıda bloke kaldı (`DIALOG DONDU` satırı hiç yazılmadı).
Ekran görüntüsü: `docs/qa/screens/F-014-06-showerrorbox-probe-diyalog-yok.png`.

**Muhtemel dosya:satır:** `electron/main.cjs:174` (`dialog.showErrorBox(PORT_ERROR_TITLE, …)`).

**Önerilen düzeltme:** kullanıcıya görünen kanalı **pencere üreten** bir mekanizmaya taşı — ör.
küçük bir `BrowserWindow` ile hata ekranı (aynı süreçte çizildiği ölçüldü) — ve **gerçek pencere
oluştuğunu** doğrulayan bir E2E ekle (`_electron.launch` + port tutulu + `electronApp.windows()`
sayısı > 0). Sözleşmenin "okunabilir biçimde bildiriliyor" cümlesi ancak böyle çitlenebilir.

**Ek not (kanıt hijyeni):** `docs/progress.md` bu senaryo için *"gerçek native `dialog.showErrorBox`
göründü (ekran görüntüsüyle doğrulandı)"* diyor; `docs/qa/screens/` altında F-014'e ait
**hiçbir geliştirici ekran görüntüsü yok** ve ölçüm bu iddiayı doğrulamıyor.

### B2 — BLOKLAYICI · Masaüstü uygulamasındaki CEO sohbeti paketlenmiş kopyada çalışıyor

**Tekrar üretme:** `.exe`'yi çalıştır → `GET /api/chat/status`.

**Gerçek (canlı çıktı):** `session_active:true` ve bekleyen izin isteğinin komutu:
`cd "C:\dev\apps\mission-control\release\Mission Control-win32-x64\resources\app" && ls docs docs/features docs/approvals …`
Yani oturumun çalışma dizini **paketlenmiş kopya**. Kaynak:
`src/features/chat/server/session.ts:22` → `CHAT_SESSION_CWD = path.resolve(__dirname, '..','..','..','..')`
(paketlenmiş kopyada bu `resources\app`'e çözülür).

Paketlenmiş kopyanın içeriği ölçüldü:
- `docs/` **yok** (packager `ignore` listesinde) → CEO oturumu, CLAUDE.md'nin "kaynak gerçeği
  `docs/`" kuralını **fiziksel olarak** uygulayamaz; ilk komutu zaten `ls docs` ile boşa düştü.
- `.git` **yok** → orada yapılan hiçbir iş commit edilemez, kullanıcı ilerlemeyi göremez.
- `.claude/settings.json` **yok** (yalnızca `.claude/agent-memory` sızmış) → yıkıcı komut engeli,
  yazma kapısı, G2 kapısı, stop-check dâhil hook girdilerinin **hiçbiri çalışmaz**
  (gerçek depoda `.claude/settings.json` içinde 41 "hooks" geçişi var).
- `scripts/package-electron.mjs` `overwrite: true` → bir sonraki paketlemede o klasördeki her şey
  **silinir**.

**Neden bloklayıcı:** F-012 + ADR-014 paneli CEO oturumunun arayüzü yaptı; F-014'ün gerekçesi
kullanıcının *"artık oradan çalışırım"* cümlesi. Bu hâliyle "oradan çalışmak" = git'siz, dokümansız,
çitsiz ve geçici bir kopyada çalışmak.

**Önerilen düzeltme (CEO kararı gerekir):** Electron ana süreci sohbet oturumunun kökünü açıkça
belirlesin (ör. ayarlardan seçilen gerçek depo yolu); `session.ts`'in `__dirname` türetimi
paketlenmiş kurulumda geçerli değil. Karar verilene kadar en azından "sohbet şu kökte çalışıyor: …"
bilgisi arayüzde gösterilsin.

### B3 — BLOKLAYICI · Başlatma yolunda yakalanmamış hata → sessiz zombi süreçler

**Tekrar üretme:** `MC_ELECTRON_USER_DATA_DIR=<klasör>` ver ve o klasörde `data` adında bir
**dosya** oluştur (gerçek karşılığı: AV kilidi / salt-okunur / dolu disk — CLAUDE.md'nin kendi
tetikleyici listesi). `.exe`'yi çalıştır.

**Gerçek:** `mission-control.exe` **3 süreç** açık kalıyor (35 sn sonra hâlâ), **pencere yok**,
**tepsi ikonu yok** (UIAutomation ile arandı), **hata yok**, 7333 dinlenmiyor. Kullanıcı için:
"çift tıkladım, hiçbir şey olmadı" + Görev Yöneticisi'nden temizlemesi gereken gizli süreçler.
Aynı userData ile ikinci çift tıklama: süreç sayısı 7 → 7, **yeni pencere yok** (tek-örnek kilidi
zombideki örnekte). Yani gerçek kullanıcı klasöründe bu hata oluşursa uygulama, zombi elle
öldürülene kadar **kalıcı olarak açılamaz** hâle gelir.

**Muhtemel dosya:satır:** `electron/main.cjs:287-297` — `app.whenReady().then(async () => { … })`
zincirinde `.catch` yok; `runApp` içindeki `createServer` hatası hiçbir yere düşmüyor.

**Önerilen düzeltme:** bootstrap'ı `try/catch` ile sar; hata hâlinde (a) görünür bir hata yüzeyi
(B1 ile aynı mekanizma), (b) `app.exit(1)` — süreç **yaşamasın**. Bu, CLAUDE.md'nin
"yazma/başlatma yolundaki yakalanmamış hata" dersinin dördüncü tekrarı; çitlenmeli.

### Ö1 — ÖNEMLİ · Teslim durumunda açılışta başlatma varsayılanı fiilen KAPALI

`ensureDefaultAutostart` yalnızca `%APPDATA%\mission-control\autostart-initialized.json` **yokken**
varsayılanı açıyor. Geliştirici turu bu marker'ı yazdı (içerik
`"setAt":"2026-09-06T11:25:20.733Z"`) ama `reg delete` ile kayıt defteri anahtarını sildi ve
marker'ı **silemedi** (progress.md'de kendisi de not ediyor). Sonuç, benim ölçtüğüm teslim durumu:
- `HKCU\…\Run` içinde Mission Control girdisi **yok**,
- tepsi menüsünde "Bilgisayar açılışında başlat" **işaretsiz** (`F-014-03-…png`),
- marker var olduğu için bir daha **asla** otomatik açılmayacak.

Yani kullanıcının bu feature'ı istemesinin **asıl sebebi** (açılışta başlasın) bu makinede
sağlanmıyor; ADR-011 ek kararının "AÇIK" şartı teslimde yok. (Temiz bir userData ile ölçtüm:
kod doğru çalışıyor — kayıt defteri anahtarı yazıldı ve marker oluştu; sorun **teslim durumu**.)

**Önerilen düzeltme:** `%APPDATA%\mission-control\autostart-initialized.json` silinsin (tek dosya)
veya kullanıcıya "tepsiden bir kez işaretleyin" talimatı açıkça verilsin.

### Ö2 — ÖNEMLİ · "Görünür varsayılan" şartını taşıyan tepsi balonu hiç çizilmiyor

ADR-011 ek kararı: *"'açık' yetmez, **görünür olmak zorunda**"*. Kodda bunun tek taşıyıcısı
`tray.displayBalloon` (`electron/main.cjs:247-253`).

**Ölçüm:** tamamen taze bir userData ile gerçek `.exe` çalıştırıldı (ilk açılış: kayıt defteri
anahtarı **yazıldı**, marker **oluştu** — yani `justEnabledAutostart === true` yolu koştu).
t=3,4,5,6,7,8,9,11 sn'de sekiz tam ekran karesi alındı: **iki monitörde de hiçbir bildirim yok**.
Windows bildirimleri kapalı değil (`HKCU\…\PushNotifications\ToastEnabled = 0x1`).
Bu, B1 ile **aynı sınıf**: Electron'un native bildirim yüzeyleri bu makinede çizmiyor.
Birim testi (`autostart.test.ts`) yalnızca `displayBalloon`'un **çağrıldığını** doğruluyor.

**Önerilen düzeltme:** görünürlüğü uygulamanın kendi arayüzüne taşı (panelde ilk açılışta bir
şerit/kart: "Bilgisayar açılışında başlatma açıldı — kapat"), balonu yalnızca ek kanal olarak
bırak.

### Ö3 — ÖNEMLİ · Masaüstüne geçiş, panelin tüm durumunu sıfırlıyor ve bu hiçbir yerde yazmıyor

Sözleşme §1.4 gereği veri klasörü `app.getPath('userData')\data` — repo `./data`'sından ayrı.
Sonuç ölçüldü: masaüstü uygulamasında `/api/projects` → `[]`, `/api/features` → `[]`, Kanban
ekranında *"İzlenen projelerde henüz feature bulunamadı."* (`F-014-02-kanban-bos.png`), sohbet
geçmişi ve olay tarihçesi yok. Tarayıcı yolunda (`npm start`) aynı anda depo feature'ları
görünüyor. Karar savunulabilir ama **kullanıcıya söylenmemiş**: ne `docs/03-ux.md`'de ne
`KURULUM.md`'de "masaüstü uygulamasında projeleri yeniden eklemelisiniz" cümlesi var.

### Ö4 — ÖNEMLİ · Paketleme filtresi sızdırıyor, `prune` çalışmıyor (646 MB)

- `ignore` listesi `/\.claude($|/)` içermesine rağmen `resources\app\.claude\agent-memory\`
  **dağıtılan pakete girmiş** (agent hafıza dosyaları). Aynı liste `docs/`'u dışlarken
  `.claude/settings.json`'ı da dışlıyor (B2'nin ikinci yarısı).
- `prune: true` olmasına rağmen `resources\app\node_modules` içinde `@playwright`, `@vitest`,
  `@vitejs`, `@testing-library`, `esbuild` gibi **devDependencies** duruyor; çıktı **646 MB**.

**Önerilen düzeltme:** `ignore` desenlerini gerçek çıktı üzerinde **doğrulayan** bir test
(paketleme sonrası `resources/app` içinde `.claude`, `docs`, `tests` **olmamalı**) + prune
davranışının ölçülmesi.

### Ö5 — ÖNEMLİ · Uygulamayı elde etmenin belgelenmiş yolu yok

`release/` `.gitignore`'da; `KURULUM.md` içinde `electron` kelimesi **hiç geçmiyor**. Temiz bir
kopyada kullanıcı `npm run electron:fetch` + `npm run electron:package` adımlarını bilmeden `.exe`
elde edemez. Sözleşme §10 bunu bilinçli olarak kapsam dışı bıraktı, ama AC1'in "kullanıcı hiçbir
terminal komutu yazmıyor" iddiasının bir kurulum adımı gerektirdiği hiçbir belgede yazılı değil.

### N1 — NOT · Birim testleri, tepsi Çıkış'ı kilitleyen gerçek hatayı yakalayamıyor

M-E mutasyonu (`isQuitting` koruması kaldırıldı — geliştiricinin `c12f891`'de düzelttiği gerçek
hata) `tests/electron`'da **12/12 yeşil** bırakıyor; yalnızca `e2e:electron` 60 sn timeout ile
kırmızı veriyor. Yani bu davranışın tek çiti E2E; sahte `app.quit()` pencere kapanışını taklit
etmiyor. Kabul edilebilir (ikinci savunma hattı var, ölçtüm) ama bilinmeli.

### N2 — NOT · Port çakışması yolunun gerçek-Electron kapsaması yok

`tests/e2e/electron-smoke.spec.ts` yalnızca mutlu yolu koşuyor. Port dolu senaryosu sadece sahte
`dialog` ile birim testinde. B1 tam bu boşluktan geçti.

### N3 — NOT · Tam test paketi bu ortamda kararsız

Bugün 8 tam koşu: 5 temiz, 2'sinde worker çöküşü (`exit code 3221226505` —
`tests/integration/projects-api.test.ts`, CLAUDE.md'nin kayıtlı ortam hatası, **altıncı** görülüş),
1'inde `tests/integration/send-event-hook.test.ts` assert hatası. O dosya **izole olarak 5/5
yeşil**. Kod regresyonu değil, ama "873 test geçiyor" cümlesi tek koşuda garanti değil.

### N4 — NOT · `MC_SKIP_AUTOSTART_DEFAULT` üretim ortamından da okunuyor

Test izolasyonu için eklenen kapı (`electron/main.cjs:290`) üretimde de ortam değişkeniyle
tetiklenebilir. Düşük risk; not.

---

## 4. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **4** | Pencere/tepsi/tek örnek/çıkış/geri dönüş yolu çalışıyor; ama port çakışmasında sessizlik (B1), başlatma hatasında zombi (B3), sohbet yanlış kökte (B2) |
| Özellik bütünlüğü | **4** | ADR-011'in "açılışta başla + görünür" şartı teslimde karşılanmıyor (Ö1/Ö2); belgelenmemiş durum sıfırlanması (Ö3) ve kurulum yolu (Ö5) |
| Görsel / UX | **5** | Pencere ve tepsi menüsü `docs/03-ux.md` ile **birebir** ("Paneli Aç" · "Bilgisayar açılışında başlat" · "Çıkış", tooltip "Mission Control"); ama kullanıcıya bilgi veren iki native yüzeyin ikisi de hiç çizilmiyor |
| Kod kalitesi (test, hata yönetimi) | **5** | 7 mutasyonun 6'sı kırmızı, testler totoloji değil, `src/` hiç değişmemiş, guard'lar korunmuş; ama yeni giriş noktasında hata sınırı yok (B3) ve "kullanıcı gördü mü" hiçbir yerde ölçülmüyor (B1/Ö2) |

**Herhangi bir boyut < 7 → KALDI.**

---

## 5. Süreç/port hijyeni (bu turun kendi sızıntısı)

| An | `mission-control.exe` | `electron.exe` | 7333-7336 LISTENING |
|---|---|---|---|
| Tur başlangıcı (baz) | 0 | 0 | yok |
| Tur sonu | **0** | **0** | **yok** |

- Tepsi "Çıkış" ölçümü: 4 → 0 (yetim yok, port serbest).
- Hata enjeksiyonu (B3) 3 zombi üretti; **bu turun sonunda `taskkill /IM` ile temizlendi** —
  ürünün kendi davranışı olarak raporlandı, sızıntı bırakılmadı.
- Kayıt defteri: test sırasında `HKCU\…\Run\electron.app.Mission Control` **iki kez yazıldı**
  (tepsi toggle + taze userData ilk açılış) ve **ikisi de geri alındı**; tur sonunda `reg query`
  ile doğrulandı: **girdi yok** (test öncesi hâl).
- Kalıcı kalan (silmedim, ürün/CEO kararı): `%APPDATA%\mission-control\` (Ö1'in marker dosyası
  dâhil) ve masaüstü uygulamasının veri klasörüne eklediğim tek test projesi kaydı
  (geçici `scratchpad\qaproj`). Geçici userData klasörleri scratchpad içinde.

## 6. Doğrulayamadıklarım

- **Gerçek Windows yeniden başlatma** ile uygulamanın açılışta gerçekten başlaması (kayıt defteri
  anahtarının doğru yazıldığını ölçtüm, reboot testi yapmadım).
- Tepsi menüsünün otomasyonla ikinci kez açılması kararsızdı (Windows 11 taşma menüsü odak
  kaybında kapanıyor); "Çıkış" ölçümü **bir kez** gerçek menüyle yapıldı, tekrarı E2E ile kanıtlı.
- `dialog.showErrorBox`'ın **başka** bir Windows makinesinde çizip çizmediği (bu makinede
  çizmediği, ürün kodundan bağımsız sondayla kanıtlı).
- Paketlenmiş uygulamada sohbetle uçtan uca gerçek bir görev (ücret gerekçesiyle mesaj
  göndermedim; oturumun kökünü ve bekleyen izin isteğini ölçtüm).
