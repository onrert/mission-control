KARAR: GEÇTİ
ESKALE: false

# F-014 — QA raporu, 3. tur (kapanış denetimi)

- **Tarih:** 2026-09-06
- **Kapsam:** dar — yalnızca I1 (B4 düzeltmesi), I2 (açılışta sıfır model çağrısı), I3 + hijyen.
  1. ve 2. turda GEÇTİ verilen maddeler yeniden ölçülmedi.
- **Önceki turlar:** `docs/qa/F-014-2026-09-06.md` (KALDI — B1/B2/B3),
  `docs/qa/F-014-2026-09-06-tur2.md` (KALDI — B4 + N1/N2)
- **Yöntem:** 8 bağımsız retry'siz E2E koşusu + 1 sn'lik süreç örneklemesi, gerçek paketlenmiş
  `.exe` ile **canlı** kota ölçümü (süreç ağacı + hook olay akışı), 3 mutasyon, dört test paketi.

---

## KARAR GEREKÇESİ

2. turun tek bloklayıcısı (B4) **kapandı ve bağımsız olarak ölçüldü**: 8/8 temiz koşu, hiç asılma
yok, hiç yetim süreç yok; koruma mutasyonla çitli. I2 (CEO'nun kota kararı) **canlı kanıtlandı**:
paketlenmiş uygulama 5,5 dakika boyunca kullanıcı hiçbir şey yazmadan çalıştı ve **tek bir model
alt süreci doğmadı, tek bir `ceo` hook olayı düşmedi**; ilk mesajla birlikte oturum aynı saniyede
başladı. Dört paket yeşil, dört puanın hepsi ≥ 7.

---

## 1. I1 — B4 gerçekten kapandı

### 1.1 Kararlılık: 8/8 (retry yok)

`npx playwright test -c playwright.electron.config.ts electron-autostart-smoke`, sekiz **ayrı**
süreçte, her biri kendi geçici `userData` klasörüyle:

| Koşu | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Sonuç | ok | ok | ok | ok | ok | ok | ok | ok |
| Test süresi | 1,1 s | 1,3 s | 1,1 s | 1,1 s | 1,1 s | 1,0 s | 1,1 s | 1,1 s |

Kırmızı: **0**. Asılma: **0** (2. turda kırmızı koşular 30 sn timeout ile bitiyordu; burada en
uzun koşu 1,9 sn). Ayrıca 4. maddedeki tam `npm run e2e:electron` paketi bu spec'i 9. kez
koşturdu — yine yeşil.

### 1.2 Süreç kanıtı (gerçek `electron.exe`, testin iddiasına güvenmeden)

5.–8. koşular sırasında ayrı bir süreçle 1 sn aralıkla `Get-Process electron` örneklendi
(`scratchpad/sampler.log`):

```
20:29:49 electron=0
20:29:50 electron=5   ← koşu 5 ayağa kalktı
20:29:51 electron=0   ← shutdownViaTray sonrası ~1 sn içinde sıfır
20:29:53 electron=1
20:29:57 electron=2
20:30:01 electron=3
20:30:02 electron=0
20:30:06 electron=0
```

Gerçek süreçler doğuyor (tepe 5) ve **her koşuda 1–2 saniyede 0'a düşüyor**. 2. turdaki
"electron=5, 30 saniye boyunca değişmedi" deseni bir kez bile tekrarlamadı.

### 1.3 Mutasyon (M-I1) — KIRMIZI

`electron/main.cjs:404-406`, `shutdownViaTray` içindeki döngü silindi:

```js
for (const win of BrowserWindow.getAllWindows()) {
  if (!win.isDestroyed()) win.destroy()
}
```

`npx vitest run tests/electron` → **1 failed / 26 passed**,
`tests/electron/lifecycle.test.ts:186` `expected false to be true` (bildirim penceresi
`destroyed` kalmıyor). `git checkout` ile geri alındı, tekrar **27/27**, `git status` temiz.

### 1.4 `retries` kontrolü

`playwright.electron.config.ts`'te `retries` anahtarı **yok** (varsayılan 0); 19. satırda
`workers: 2`, 21.–23. satırlarda kaldırılma gerekçesi yorumda yazılı. Gizli retry: **yok**.

---

## 2. I2 — açılışta sıfır model çağrısı (CANLI KANIT)

### 2.1 Test edilen artefakt (dürüstlük notu)

`release\Mission Control-win32-x64\` paketi **17:19'da**, yani I1 ve I2 düzeltmelerinden **önce**
üretilmiş. Yeniden paketlemek yerine (kota), depodaki iki düzeltilmiş dosya paketin içine
kopyalandı ve **sonrasında ağaçlar birebir doğrulandı**:

- `diff -rq src "…\resources\app\src"` → fark **yok**
- `diff -rq electron "…\resources\app\electron"` → fark **yok**

Bu meşru: `scripts/package-electron.mjs` `asar: false` + bundling **yok** ile kaynak ağacı olduğu
gibi kopyalıyor, `electron/main.cjs` çalışma zamanında `tsx` ile `resources/app/src/server/
index.ts`'i yüklüyor. Yani ölçülen ikili, yeniden paketlemenin üreteceğiyle aynı davranışı
çalıştırdı. **Teslimden önce `npm run electron:package` yeniden koşulmalı** (aşağıda N-h1).

### 2.2 Boşta ölçüm — 5,5 dakika, kullanıcı hiçbir şey yazmadı

`mission-control.exe` taze bir `MC_ELECTRON_USER_DATA_DIR` ile başlatıldı (PID **47236**),
`MC_CHAT_ENABLED` **verilmedi** (varsayılan açık — teslim hâli).

| Ölçüm | Sonuç |
|---|---|
| Açılış | 20:30:54 (17:30:54Z) |
| Uygulamanın süreç ağacı | 47236 + 3 `mission-control.exe` çocuğu (renderer/gpu). **`claude.exe` çocuğu: 0** |
| Makinedeki toplam `claude.exe` | açılış öncesi **21** → 5,5 dk sonra **21** (hepsinin ebeveyni 31928/20468 = benim QA oturumum, uygulama değil) |
| `GET /api/chat/status` | `session_active: true`, `chat_enabled: true`, **`session_id` alanı YOK** (oturum henüz spawn edilmemiş; arayüz yine de "kapalı" göstermiyor) |
| `GET /api/chat/history` | `entries: []` |
| Hook olayları (`GET /api/events`) 17:30:54Z–17:36:22Z | `agent_type: ceo` olay sayısı **0** (bu pencerede yalnızca benim `qa-evaluator` oturumumun `Pre/PostToolUse` olayları var) |

**Sıfır model çağrısı kanıtlandı** — 2. turda aynı ölçüm açılıştan ~1 sn sonra
`SessionStart → UserPromptSubmit → Stop` üretiyordu.

### 2.3 Ters yön — bir mesaj yazınca oturum GERÇEKTEN başlıyor

`POST /api/chat/message` (tek kısa mesaj) 17:36:22.5Z'de gönderildi:

```
17:36:22.522Z  (POST /api/chat/message — kullanıcının ilk mesajı)
17:36:23.504Z  SessionStart     ceo  564028b1
17:36:24.068Z  UserPromptSubmit ceo  564028b1
17:36:31.782Z  Stop             ceo  564028b1
```

- `claude.exe` **PID 29800**, ebeveyni **47236** (uygulamanın kendisi) — toplam `claude.exe`
  21 → **22**.
- `GET /api/chat/status` artık `session_id: 564028b1-…`, `busy: true`.
- `GET /api/chat/history` kullanıcı mesajını ve akan asistan yanıtını gösteriyor.

Yani alt süreç **tam olarak ilk `sendMessage()` anında** doğuyor — ne önce, ne sonra.

### 2.4 Mutasyonlar — iki yönde de KIRMIZI

| # | Mutasyon | Hedef | Sonuç |
|---|---|---|---|
| M-I2a | `sendMessage()`'daki tembel başlatma dalı (`if (inputPush === undefined) { void startSession(...) }`) silindi | `tests/features/chat/server/session.test.ts` | **KIRMIZI** — 13 failed / 14 passed (ilk mesajdan sonra `query()` hiç çağrılmıyor) |
| M-I2b | `bootstrap()`'a `await startSession(readSessionId(deps.dataDir))` geri eklendi (I2 öncesi davranış) | aynı dosya | **KIRMIZI** — 1 failed / 26 passed: *"bootstrap() sonrası, sendMessage() ÇAĞRILMADAN query() hiç çağrılmaz (sıfır model çağrısı)"* |

İkisi de `git checkout` ile geri alındı; `git status` temiz.

---

## 3. I3 + hijyen

- **Dosya sahipliği istisnası:** `docs/features/F-014-masaustu-uygulamasi.md:49-65` iki istisnayı
  da **gerekçesiyle** yazıyor — İstisna 1 (H1, `resolveChatSessionCwd`: paketlenmiş kopyada
  hook'ların bulunamaması) ve İstisna 2 (I2, `bootstrap()/sendMessage()/restart()`: ADR-011 ile
  her gün otomatik başlayan uygulamanın açılışta kota harcayamaması), her ikisi için de
  "tarayıcı/`npm start` yolu davranışsal olarak korunur" gerekçesi ve
  `docs/qa/F-014-contract.md` "Ek — I2" referansı var. **Yeterli.**
- **Mutasyon artığı taraması:** `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/`
  → yalnızca `tests/server/write-gate-manifest.test.ts:124` (meşru test adı). Temiz.
- **Süreç/port/kayıt defteri:**

| An | `mission-control.exe` | `electron.exe` | `claude.exe` | 7333 LISTENING | `HKCU\…\Run` Mission Control |
|---|---|---|---|---|---|
| Tur başlangıcı | 0 | 0 | 21 | yok | yok |
| Tur sonu | **0** | **0** | **21** | **yok** | **yok** |

  Uygulama kapatıldığında `claude.exe` çocuğu (29800) da öldü — yetim yok. Kayıt defterine bu
  turda **hiç yazılmadı** (`MC_SKIP_AUTOSTART_DEFAULT=1` ile ölçüldü; E2E koşuları kendi
  yazımlarını aynı round-trip'te geri alıyor). `git status` **temiz**.

### 4. Test paketleri (hepsi bu turda kendim koşturuldu)

| Paket | Çıkış | Sayı |
|---|---|---|
| `npm run verify` | **0** (tek koşu, tekrar gerekmedi) | **892 passed + 2 skipped (894)**, 65 dosya; typecheck + lint + build yeşil |
| `npm run e2e` | **0** | **23/23** |
| `npx vitest run tests/electron` | **0** | **27/27**, 8 dosya |
| `npm run e2e:electron` | **0** | **3/3** (retry yok) |

(2. turda `verify` 890+2 idi; artan 2 test I2 çitleri.)

---

## 5. Bulgular

Bu turun düzeltmesinden **yeni bloklayıcı çıkmadı**. Kayıt için tek hijyen notu:

### N-h1 — NOT (bloklayıcı değil) · `release/` klasöründeki paket düzeltmelerden eski

`release\Mission Control-win32-x64\` 17:19'da, I1 (`c71feb8`) ve I2 (`e0ea5fe`) commit'lerinden
önce üretilmiş. Ölçüm için iki dosya elle senkronlandı (§2.1, ağaçlar birebir doğrulandı), ama
diskteki **teslim edilebilir** artefakt hâlâ eski kodu içeriyor. Kullanıcıya teslimden önce
`npm run electron:package` bir kez koşulmalı. Bir derleme adımı olduğu için kod bulgusu değildir.

Devreden açık maddeler (bu turun konusu değil, kararı etkilemiyor): Ö1'in bu makinedeki teslim
hâli (`%APPDATA%\mission-control\autostart-initialized.json` marker'ı duruyor → açılışta başlama
fiilen kapalı; kullanıcı tepsiden bir kez işaretleyince düzelir) ve N3 (hook-eksik hata
penceresinde uzun yolun kırpılması, pencere kaydırılabilir).

---

## 6. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | **8** | Tepsi "Çıkış" artık 8/8 deterministik (2. turda ~%18 asılma), süreç örneklemesiyle 1–2 sn'de 0; açılışta sıfır model çağrısı canlı kanıtlandı; ilk mesajda oturum aynı saniyede başlıyor |
| Özellik bütünlüğü | **8** | Yedi kabul kriterinin tümü önceki turlarda canlı doğrulandı, bu turda kalan iki delik (çıkış yolu, kota sızıntısı) kapandı; açık kalanlar (Ö1 marker'ı, N3 kırpma) kullanıcı tarafında tek tıkla/kozmetik |
| Görsel / UX | **7** | Bildirim ve üç hata penceresi `docs/03-ux.md` ile birebir, gerçekten çiziliyor (2. tur ekran görüntüleri); tek kusur hook-eksik penceresinde son satırın kırpılması (kaydırılabilir) — bu turda değişmedi |
| Kod kalitesi (test, hata yönetimi) | **8** | 3 mutasyonun 3'ü KIRMIZI (biri iki yönde), "bildirim penceresi açıkken tepsi Çıkış" artık birim seviyesinde çitli, "açılış = sıfır `query()`" ayrı bir testle çitli; 894 birim + 23 web E2E + 3 Electron E2E yeşil; geliştiricinin bu turdaki sayısal iddiaları ölçümle örtüştü (2. turda örtüşmemişti) |

Hiçbir boyut < 7 → **GEÇTİ**.

---

## 7. Doğrulayamadıklarım (dürüstlük)

- Gerçek Windows yeniden başlatmasıyla açılışta başlama (kayıt defteri yazımı 2. turda ölçüldü,
  reboot yapılmadı).
- Fare ile gerçek OS tepsi menüsünden "Çıkış" tıklaması (aynı `shutdownViaTray()` fonksiyonu
  gerçek `electron.exe` üzerinde 8 kez tetiklendi).
- Yeniden paketlenmiş `.exe` (bkz. N-h1; ölçüm iki dosya senkronlanmış paket üzerinde yapıldı,
  ağaçlar birebir doğrulandı).
- Kota: bu turda **tek bir kısa mesaj** gönderildi (bir CEO turu). Başka model çağrısı yapılmadı.
