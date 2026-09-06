KARAR: KALDI
ESKALE: false

# F-014 — QA raporu, 2. tur (düzeltme turu denetimi)

- **Tarih:** 2026-09-06
- **Tur:** düzeltme turu (dar kapsam — yalnızca 1. turun bulguları + bloklayıcı seviyede yeni bulgu)
- **1. tur raporu:** `docs/qa/F-014-2026-09-06.md` (KARAR: KALDI — B1, B2, B3)
- **Test edilen artefakt:** `C:\dev\apps\mission-control\release\Mission Control-win32-x64\mission-control.exe`
  (paketlenmiş `electron/main.cjs` depodakiyle **birebir aynı** — `diff` farksız; paket 2026-09-06 17:19'da üretilmiş)
- **Yöntem:** gerçek `.exe` (npm/tsx yok, çalışma dizini bilerek `C:\` verildi), gerçek Windows
  kayıt defteri, gerçek süreç ağacı (PEB üzerinden çalışma dizini okuma), hata enjeksiyonu,
  5 mutasyon, dört test paketi, `e2e:electron` 17 kez.

---

## KARAR GEREKÇESİ (özet)

1. turun **üç bloklayıcısının üçü de gerçekten kapandı** ve canlı doğrulandı (aşağıda sayı ve
ekran görüntüsüyle). Ö1/Ö2 de temiz profille sağlanıyor. Mutasyonların hepsi KIRMIZI.

Ancak karar **KALDI**, iki nedenle:

1. **B4 (yeni, bloklayıcı):** tepsiden "Çıkış" akışı, ilk açılış bildirim penceresi açıkken
   **koşuların ~%18'inde uygulamayı hiç kapatmıyor**. Ölçüldü: `shutdownViaTray()` çağrıldıktan
   sonra **5 electron süreci 30 saniye boyunca hayatta kaldı** ve yalnızca test koşucusunun
   `finally` bloğundaki zorla kapatması onları temizledi. Gerçek üründe böyle bir kurtarıcı yok:
   kullanıcı "Çıkış"a basar, hiçbir şey olmaz, 5 yetim süreç portu tutmaya devam eder. Bu, feature
   notunun **"Çitlenecek — bu projede yetim süreç tekrar eden bir sorun"** dediği AC3'ün tam
   göbeği.
2. **Geliştiricinin sayısal iddiası doğru değil.** İddia: *"`electron-autostart-smoke.spec.ts` …
   5/5 + 3/3 yeşil"* ve *"retry kaldırıldı"*. Retry gerçekten kaldırılmış (doğrulandı), ama
   retry'sız koşuda test **kararsız**: benim 17 koşumun 3'ü kırmızı. Config'in kendi yorumu bunu
   zaten bir kural olarak yazmış: *"bir test retry olmadan kararsızsa bu BULGUDUR"*.

---

## 1. Ölçülen maddeler

### B2 (H1) — **KAPANDI** · Sohbet oturumu gerçek proje dizininde, hook kapısı çalışıyor

**İleri yön (oturum nerede çalışıyor?) — canlı, doğrudan ölçüm**

`.exe` `Start-Process … -WorkingDirectory 'C:\'` ile başlatıldı (çalışma dizini bilerek yanlış
verildi ki `process.cwd()` türetimi varsa yakalansın). Süreç ağacı:

| PID | Süreç | PEB'den okunan çalışma dizini |
|---|---|---|
| 50476 | `mission-control.exe` (ana) | `C:\` |
| 29148 | `claude.exe` (barındırılan CEO oturumu) | **`C:\dev\apps\mission-control\`** |

`claude.exe`'nin komut satırında `--setting-sources=project` var → proje ayarları **bu** kökten
okunuyor. 1. turda aynı ölçüm `…\release\Mission Control-win32-x64\resources\app` veriyordu.

**Hook'lar gerçekten yükleniyor mu?** Evet — dolaylı değil, doğrudan gözlendi. Uygulama
açılışında barındırılan oturumun kendi `session_id`'siyle (`bfa4e937-…`, `/api/chat/status`'ün
döndürdüğü değerle birebir) hook olayları panele düştü:

```
14:28:27.657Z SessionStart      cwd=C:\dev\apps\mission-control  agent=ceo
14:28:29.626Z UserPromptSubmit  cwd=C:\dev\apps\mission-control  agent=ceo
14:28:42.142Z Stop              cwd=C:\dev\apps\mission-control  agent=ceo
```

Yani `.claude/settings.json` bulundu, `node .claude/hooks/send-event.cjs` **çalıştı** ve olay
sunucuya ulaştı. Ekran görüntüsü: `docs/qa/screens/F-014-tur2-01-exe-acilis.png` (panelin Zaman
Çizelgesi'nde `ceo SessionStart / UserPromptSubmit / Stop` satırları görünüyor).

**Ters yön (hook yoksa ne oluyor?)** `MC_PROJECT_DIR` `.claude` içermeyen bir klasöre
gösterildi → **sunucu hiç başlamadı** (7333 LISTENING **yok**) ve **görünür, okunabilir** bir
pencere çizildi (480x260, başlık "Mission Control başlatılamadı"):
`docs/qa/screens/F-014-tur2-02-hook-yok-hata-penceresi.png`. Metin `docs/03-ux.md:628-631` ile
birebir. Pencere kapatılınca süreç **4 → 0** (yetim yok).

### B1 (H2) — **KAPANDI** · Port çakışmasında gerçek pencere çıkıyor

7333'ü gerçek bir yabancı `http` sunucusu tuttu (`curl` → "YABANCI SUNUCU"), `.exe` başlatıldı.

| Ölçüm | Sonuç |
|---|---|
| Görünür pencere | **VAR** — 480x260, "Mission Control başlatılamadı" |
| Metin | `docs/03-ux.md:624-627` ile **birebir**: *"7333 portu başka bir uygulama tarafından kullanılıyor. Panel açılamıyor. Önce o portu kullanan programı kapatın veya MC_PORT ortam değişkeniyle farklı bir port seçin."* |
| t=30 sn'de süreç | **4** (1. turdaki "~7 sn sonra sessiz ölüm" yok — pencere kullanıcı kapatana kadar duruyor) |
| Yabancı sunucuya bağlanma | **yok** (ana pencere hiç açılmadı; N4 dersi korunuyor) |
| Pencere kapatıldıktan sonra | süreç **0** |

Ekran görüntüsü: `docs/qa/screens/F-014-tur2-03-port-dolu-hata-penceresi.png`.

### B3 (H3) — **KAPANDI** · Başlatma hatasında görünür hata, zombi yok

Senaryo 1. turdakiyle birebir: `MC_ELECTRON_USER_DATA_DIR=<klasör>` ve o klasörde `data` adında
bir **dosya**.

| Ölçüm | 1. tur | 2. tur |
|---|---|---|
| Görünür hata | yok | **VAR** (ekran görüntüsü aşağıda) |
| Hata metni | — | *"Uygulama başlatılırken beklenmeyen bir hata oluştu: ENOTDIR: not a directory, mkdir '…\ud-b3a\data\events'. Uygulama güvenli şekilde kapatılıyor."* (`docs/03-ux.md:633-634` ile birebir) |
| Pencere kapatıldıktan sonra süreç | **3 zombi** (35 sn sonra hâlâ) | **0** |
| Aynı userData ile ikinci başlatma | tek-örnek kilidine takılıp **sessiz ölüm** | **hata penceresi yeniden çıktı** (kilit temiz) |
| 7333 LISTENING | — | **yok** (sunucu hiç açılmadı) |

Ekran görüntüsü: `docs/qa/screens/F-014-tur2-04-baslatma-hatasi-penceresi.png`.

### Ö1 / Ö2 (H5) — **KAPANDI (temiz profilde)** · Açılışta başlama AÇIK ve GÖRÜNÜR

Marker'sız (tamamen taze) bir `MC_ELECTRON_USER_DATA_DIR` ile gerçek `.exe` çalıştırıldı:

| Ölçüm | Sonuç |
|---|---|
| Kayıt defteri | `HKCU\…\Run\electron.app.Mission Control` = `"…\mission-control.exe"` **yazıldı** |
| Marker | `autostart-initialized.json` `{"autostartInitialized":true,"setAt":"2026-09-06T14:37:17.573Z"}` |
| Görünür bildirim | **VAR** — ikinci bir `BrowserWindow` (420x220, başlık "Mission Control"), metin `docs/03-ux.md:637-641` ile birebir: *"Bilgisayar açılışında otomatik başlayacak şekilde ayarlandı. Tepsi menüsünden kapatabilirsiniz."* |
| Ana pencere | aynı anda açık (1280x800) |

Ekran görüntüsü: `docs/qa/screens/F-014-tur2-05-acilista-baslama-bildirimi.png`.
**Kayıt defteri girdisi ölçümden hemen sonra geri alındı** (`Remove-ItemProperty`), tur sonunda
`reg query` ile doğrulandı: Mission Control girdisi **yok** (test öncesi hâl).

Kalan (1. turdan devreden, geliştirici de "kapsam dışı" diye kaydetmiş): bu makinenin gerçek
profilinde `%APPDATA%\mission-control\autostart-initialized.json` hâlâ duruyor (11:25'ten kalma),
kayıt defterinde girdi yok → **bu makinede teslim hâli hâlâ fiilen KAPALI**. Kod doğru; tek
gereken o marker dosyasının bir kez silinmesi ya da kullanıcının tepsiden bir kez işaretlemesi.

### H6 — **KAPANDI** · progress.md'deki kanıtsız iddia düzeltildi

`docs/progress.md` 5. maddesinin altına açık bir **DÜZELTME (H6)** notu eklenmiş: iddianın
yanlış olduğu, hiçbir ekran görüntüsünün onu desteklemediği, kök nedenin `4ce8f9e` ile
düzeltildiği yazılı; orijinal satır tahrif edilmemiş. Bölümde kalan tek "ekran görüntüsüyle
doğrulandı" ifadesi (madde 1 — pencere açıldı) QA'nın kendi bağımsız görüntüleriyle
örtüşüyor. Kanıtsız iddia kalmadı.

### Retry kontrolü — config temiz, **ama testin kendisi kararsız**

`playwright.electron.config.ts`'te `retries` anahtarı **yok** (varsayılan 0); kaldırılma gerekçesi
yorumda yazılı. `workers: 2` gerekçeli korunmuş. Bu kısım doğrulandı — kararsızlık bulgusu B4'te.

---

## 2. Mutasyon tablosu (5 bağımsız mutasyon)

Yöntem: uygula → `npx vitest run tests/electron` → gözle → `git checkout` ile birebir geri al.
Temel (mutasyonsuz) koşu: **26/26 yeşil, 8 dosya**.

| # | Mutasyon | Hedef | Sonuç |
|---|---|---|---|
| M1 (H1a) | `resolveProjectDir`'in paketlenmiş dalı silindi → her durumda `path.join(__dirname,'..')` (yani paket kopyasına geri dönüş) | `project-dir-and-hooks.test.ts` | **KIRMIZI** (1 failed / 25 passed) |
| M2 (H1b) | Hook kapısı devre dışı: `if (false && !hasHookInfrastructureFn(projectDir))` | `hooks-gate.test.ts` | **KIRMIZI** (1 failed / 25 passed) |
| M3 (H7) | `close` handler'ından `if (isQuitting) return` koruması kaldırıldı | `lifecycle.test.ts` | **KIRMIZI** (1 failed / 25 passed) — 1. turdaki M-E artık **birim seviyesinde** yakalanıyor (N1 kapandı) |
| M4 (B3 çiti) | Başlatma hatası `catch`'inde `app.exit(1)` → `app.quit()` (süreç kesin ölmesin) | `startup-error-guard.test.ts` | **KIRMIZI** (2 failed / 24 passed) |
| M5 (B1 çiti) | Port hatası tekrar `dialog.showErrorBox` ile gösterildi (1. turun tam regresyonu) | `port-guard.test.ts` | **KIRMIZI** (1 failed / 25 passed) |

Geri alım sonrası `tests/electron` yeniden **26/26**; `git status` **temiz**.
`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca meşru test adı
`tests/server/write-gate-manifest.test.ts:124`.

---

## 3. Test paketleri (hepsi kendim koşturuldu)

| Paket | Sonuç | Sayı |
|---|---|---|
| `npm run verify` | **0** (tek koşu, tekrar gerekmedi) | 890 passed + 2 skipped (892), 65 dosya; typecheck + lint + build yeşil |
| `npm run e2e` | **0** | 23/23 |
| `npx vitest run tests/electron` | **0** | 26/26, 8 dosya |
| `npm run e2e:electron` | **1. koşu KIRMIZI (1 failed / 2 passed)**, 2.–5. koşular 3/3 | bkz. B4 |

`e2e:electron`'un kararsız testi tek başına da koşturuldu: **17 koşuda 3 kırmızı** (≈%18).
Aynı paketteki `electron-smoke.spec.ts` tek başına **10/10 yeşil** — kararsızlık yalnızca
bildirim penceresi açılan yolda.

---

## 4. Bulgular

### B4 — BLOKLAYICI · Tepsiden "Çıkış" ~%18 koşuda uygulamayı hiç kapatmıyor (AC3)

**Tekrar üretme**
1. `npx playwright test -c playwright.electron.config.ts electron-autostart-smoke`
2. Birkaç kez tekrarla (bende 17 koşunun 3'ü kırmızı: 1., 5. ve 11.).

Bu testin ölçtüğü ürün yolu: **ilk açılış** (marker yok) → açılışta başlama açılır → bildirim
penceresi (`data:` URL'li ikinci `BrowserWindow`) çizilir → ardından **gerçek** `shutdownViaTray()`
çağrılır (tepsi "Çıkış" menü öğesinin bağlandığı fonksiyonun aynısı).

**Beklenen:** uygulama kapanır (`electron-smoke.spec.ts`'te olduğu gibi ~2 sn içinde).

**Gerçek:** `TimeoutError: electronApplication.waitForEvent: … waiting for event "close"` —
30 saniye. Testin kendi iddiaları (kayıt defteri AÇIK, bildirim penceresi çizildi, marker yazıldı)
**geçti**; kırılan yer **kapanma**.

**Süreç sayacı (1 sn örnekleme, `Get-Process`) — kanıt:**

```
17:48:40 electron=3   ← uygulama ayağa kalkıyor
17:48:41 electron=5   ← shutdownViaTray() çağrıldıktan sonra
17:48:42 … 17:49:10  electron=5  (30 saniye boyunca DEĞİŞMEDİ)
17:49:11 electron=0   ← Playwright'ın finally bloğu zorla kapattı
```

Başarılı koşularda aynı süreçler ~2 saniyede 0'a düşüyor.

**Neden bloklayıcı:** ürün üzerinde karşılığı, kullanıcının **ilk açılıştan sonra** tepsiden
"Çıkış" demesi. Kurtarıcı bir `finally` yok — 5 süreç ayakta kalır, 7333 tutulmaya devam eder,
kullanıcı Görev Yöneticisi'ne gitmek zorunda kalır. Feature notu bu tam senaryoyu
*"Çitlenecek — bu projede yetim süreç tekrar eden bir sorun"* diye ayrıca işaretlemiş.
CLAUDE.md'nin "yetim süreç" ve "yarı-başarı" derslerinin aynı ailesi.

**İzolasyon:** `MC_SKIP_AUTOSTART_DEFAULT=1` ile koşan `electron-smoke.spec.ts` (bildirim
penceresi **yok**) 10/10 yeşil. Fark tek değişken: ikinci pencere.

**Muhtemel dosya:satır:** `electron/main.cjs:274-299` (`showAutostartEnabledNotice` — oluşturulan
pencereye hiçbir referans tutulmuyor, `close` handler'ı yok, yüklemesi beklenmiyor) ile
`electron/main.cjs:391-394` (`shutdownViaTray` → `serverModule.shutdown(…, () => app.quit())`)
arasındaki yarış. Fatal hata penceresi (`showFatalErrorWindow`) `closed` olayını **bekliyor**;
bildirim penceresi hiçbir şeyi beklemiyor ve kimse onu kapatmıyor.

**Çit durumu:** bu davranışın tek çiti kararsız olan E2E'nin kendisi; hiçbir birim testi
"bildirim penceresi açıkken Çıkış" senaryosunu ölçmüyor (`lifecycle.test.ts`'in sahte `app.quit()`'i
ikinci pencereyi taklit etmiyor — 1. turun N1 dersinin aynısı, bu kez ikinci pencere için).

### N1 (2. tur) — NOT · Feature notunun dosya sahipliği kuralı aşıldı

Feature notu: *"`src/features/**` ve `src/web/**` DEĞİŞMEZ — bu bir başlatma katmanı, ürün
değişikliği değil."* Düzeltme turu `src/features/chat/server/session.ts`'i değiştirdi
(`4ce8f9e`, +16/−4: `resolveChatSessionCwd`). Değişiklik küçük, testli
(`tests/features/chat/server/session.test.ts`) ve tarayıcı yolunu birebir koruyor
(`MC_CHAT_SESSION_CWD` tanımsızsa eski `__dirname` türetimi) — teknik olarak savunulabilir, ama
feature notunda/sözleşmede bu istisna **yazılı değil**. Not düzeltilmeli (bloklayıcı değil).

### N2 (2. tur) — NOT · Uygulama açılışında kullanıcı hiçbir şey yazmadan ücretli bir CEO turu koşuyor

Ölçüm: taze profille açılışta `SessionStart` (14:37:18) → `UserPromptSubmit` (14:37:21) →
`Stop` (14:37:36) → `Stop` (14:37:46); `GET /api/chat/history` ise **boş**. Yani model turu
koştu, ücret oluştu, panelde hiçbir şey görünmüyor.
**F-014'ün sorumluluğu değil:** aynı desen (SessionStart → ~2,6 sn sonra UserPromptSubmit → Stop)
`data/events/2026-09-06.jsonl`'de F-014 daha başlamadan (02:44–03:09, F-012 dönemi, tarayıcı yolu)
zaten var; ayrıca 1. turda paketlenmiş kopyada (hook'suz) da bir oturum turu koştuğu gözlenmişti.
**Ayrı bir madde olarak açılmalı** (CLAUDE.md: ücret/kredi = kullanıcı onayı).

### N3 (2. tur) — NOT · Hook-eksik penceresinde metnin son satırı kırpılıyor

480x260 sabit boyutlu pencerede uzun proje yolu metni taşıyor; pencere kaydırılabilir (kaydırma
çubuğu görünüyor) ve asıl bilgi (hangi klasör eksik) tam görünür. Bloklayıcı değil, kayıt için.

### N4 (2. tur) — NOT · Paket boyutu iddiası doğrulandı

`631,0 MiB` (7.096 dosya) — geliştiricinin "646 MB → 631 MB" iddiasıyla uyumlu.
(`du -sm` 646 diyor; fark blok tahsisinden, gerçek toplam bayt 661,7 MB / 631,0 MiB.)
`resources\app\.claude` **artık yok** (1. turdaki `agent-memory` sızıntısı kapanmış).

---

## 5. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **5** | B1/B2/B3'ün üçü de canlı kapandı; ama çıkış yolu ~%18 koşuda kilitleniyor ve 5 yetim süreç bırakıyor (AC3, feature notunun özellikle çitlenmesini istediği madde) |
| Özellik bütünlüğü | **6** | Açılışta başlama temiz profilde AÇIK + GÖRÜNÜR; hook kapısı iki yönde de çalışıyor; ama ilk-açılış yolu (bildirim penceresi) ile çıkış yolu birlikte çalışmıyor, Ö1'in teslim hâli bu makinede hâlâ kapalı, Ö3 açık |
| Görsel / UX | **7** | Üç hata penceresi ve bildirim penceresi `docs/03-ux.md` ile **birebir**, gerçekten çiziliyor ve okunabilir; tek kusur hook-eksik penceresinde son satırın kırpılması (kaydırılabilir) |
| Kod kalitesi (test, hata yönetimi) | **5** | 5 mutasyonun 5'i KIRMIZI, `isQuitting` artık birim seviyesinde çitli, hata sınırları gerçek senaryoyla doğrulandı; ama yeni eklenen ikinci pencerenin çıkış yolu **çitsiz ve kararsız**, ve "5/5 + 3/3 yeşil" iddiası ölçümle çürüdü |

**Herhangi bir boyut < 7 → KALDI.**

---

## 6. Düzeltme turuna giden liste

1. **B4** — `showAutostartEnabledNotice` penceresini yaşam döngüsüne bağla (referansını tut,
   `shutdownViaTray` içinde açıkça kapat veya `closed` olayını bekle) ve
   **"bildirim penceresi açıkken tepsi Çıkış"** senaryosunu birim seviyesinde çitle
   (`lifecycle.test.ts`). Ardından `e2e:electron`'u **retry'sız en az 10 kez** koştur ve sayıyı
   raporla — 10/10 olmadan kapatma.
2. **N1** — feature notuna/sözleşmeye `src/features/chat/server/session.ts` istisnasını yaz.
3. **N2** — ayrı madde olarak CEO'ya taşı (açılışta ücretli tur).
4. Ö1'in teslim hâli: `%APPDATA%\mission-control\autostart-initialized.json` bir kez silinsin ya
   da `KURULUM.md`'ye "tepsiden bir kez işaretleyin" cümlesi eklensin.

---

## 7. Süreç/port/kayıt defteri hijyeni (bu turun sızıntısı)

| An | `mission-control.exe` | `electron.exe` | 7333-7336/7350 LISTENING | `HKCU\…\Run` Mission Control |
|---|---|---|---|---|
| Tur başlangıcı | 0 | 0 | yok | yok |
| Tur sonu | **0** | **0** | **yok** | **yok** |

- Bu turda 5 elle `.exe` başlatması + 27 Playwright Electron koşusu yapıldı; hepsi kapatıldı.
- B3 hata enjeksiyonu bu turda **zombi üretmedi** (düzeltmenin kendisi bu).
- Kayıt defterine **bir kez** yazıldı (temiz profil ölçümü, Ö1/Ö2) ve **geri alındı**;
  `e2e:electron`'un kendi yazımlarını testin kendisi aynı round-trip'te geri alıyor — her koşudan
  sonra `reg query` ile doğrulandı, girdi yok.
- Kalıcı bırakılanlar (ürün/CEO kararı, silmedim): `%APPDATA%\mission-control\` ve içindeki
  1. turdan kalma marker. Geçici userData klasörleri scratchpad içinde.

## 8. Doğrulayamadıklarım

- Gerçek Windows yeniden başlatmasıyla açılışta başlama (kayıt defteri yazımı ölçüldü, reboot
  yapılmadı).
- Gerçek OS tepsi menüsünden "Çıkış" tıklamasının B4'ü **elle** tetiklemesi: B4 gerçek
  `electron.exe` + gerçek `shutdownViaTray()` üzerinden ölçüldü (tepsi menü öğesinin bağlandığı
  aynı fonksiyon), ama fare ile menü tıklaması tekrarlanmadı.
- Barındırılan sohbetle uçtan uca gerçek bir görev (ücret gerekçesiyle mesaj gönderilmedi;
  oturumun çalışma dizini ve hook olayları ölçüldü).
