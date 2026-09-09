KARAR: KALDI
ESKALE: false

---
feature: F-010
title: Feature thread görünümü (docs/qa birincil, transkript best-effort)
reviewer: qa-evaluator
date: 2026-09-10
round: kod turu QA (tur 1)
scope: tüm feature — 5 kabul kriteri, W1-W9 iddiaları, canlı tarayıcı + mutasyon
---

# F-010 QA raporu — kod turu (tur 1)

**KARAR: KALDI** — 1 bloklayıcı, 7 önemli, 6 not.

Bloklayıcının özü: ekranın **varlık gerekçesi** ADR-007 karar 2'dir ("transkript hiç okunamasa
bile thread ekranı kullanışlı kalır"). Transkript okuma yolundaki **tek sarılmamış çağrı**
(`fs.realpathSync.native`), gerçek bir Windows koşulunda (dosya kilidi / ACL / AV) fırlıyor ve
CEO brief + Developer raporu + tüm QA kararları dâhil **ekranın tamamını** kalıcı olarak
500'e düşürüyor. Ölçüldü, tarayıcıda görüldü, "Tekrar dene" kurtarmıyor.

Chain'in kendisi **gerçekten çalışıyor**: bu depodaki gerçek verilerle (F-008, F-009, F-012,
F-014) zincir eksiksiz kuruldu; W2 canlı doğrulandı (sayaç 0 → 1/5040); W6 **gerçek**
`qa-evaluator` çıktısıyla (`docs/qa/F-012-2026-09-06-tur3.md`, `ESKALE: true`) doğru feature'da
çıktı; W1 iddiası kod okumasıyla ve kaçış sondalarıyla doğrulandı; istenen 6 mutasyonun 6'sı da
KIRMIZI verdi. Sorun "hiç çalışmıyor" değil, **kenar durumlarda söz verileni yapmıyor**.

---

## 0. Ortam ve ölçüm yöntemi

- `npm run build && npm start` (`npm run dev` KULLANILMADI). Üç ayrı üretim sunucusu:
  - **7391** — gerçek `~/.claude/projects` kökü, iki proje: `Gercek Repo`
    (`C:\dev\apps\mission-control`) ve `QA Sandbox` (repo `docs/features` + `docs/qa`'nın
    **mtime korunarak** kopyası — `cp -rp`; gerçek `docs/qa/latest.md`'ye hiç dokunulmadı).
  - **7392** — `MC_CLAUDE_PROJECTS_ROOT` = sahte kök (bozuk satırlı + boş `.jsonl`).
  - **7393** — `MC_CLAUDE_PROJECTS_ROOT` = kısa yollu kök, `.jsonl` dosyası `icacls /deny` ile
    erişilemez (W5/B1 ölçümü).
- Tarayıcı: Playwright/Chromium, `clippedVisibleWidth` ile ölçüm (`toBeVisible()` KULLANILMADI),
  280/320/375/480/640/768/1280 px.
- Taban çizgisi: `npm run verify` = 0 (**1210 geçti / 4 atlandı**, 79 dosya + 1 atlandı),
  `npx playwright test` = **41 geçti**. Turun sonunda ikisi de aynı sayılarla tekrarlandı.
- Depo turun sonunda **temiz** (`git status --porcelain` boş); yalnızca `docs/qa/screens/*.png`
  kanıtları ve bu rapor eklendi. Gerçek transkript içeriği depoya **bırakılmadı**.

---

## 1. Developer iddialarının doğrulanması

| İddia | Sonuç | Kanıt |
|---|---|---|
| **W1** — ikinci okuma yolu kurulmadı, F-013/F-009 fonksiyonları yeniden kullanıldı | ✓ DOĞRULANDI | `thread-detail.ts` `resolveInsideRootForRead` + `buildFeatureDetail` + `findAllowedTranscriptDirectories`/`readAllowedTranscript` çağırıyor; `src/features/thread/**` içinde **kendi yol çiti yok**. `git diff --stat` o dosyalara dokunulmadığını gösteriyor. Kaçış sondaları aşağıda (§4). |
| **W2** — `record()` bağlandı, sayaçlar gerçek okumayla besleniyor | ✓ DOĞRULANDI (CANLI) | `/api/health.transcript_reader` okuma öncesi `{0,0,0}` → F-012 thread'i çekildikten sonra `{files_seen:1, lines_ok:5040, lines_bad:0}`. Mutasyon M1 → KIRMIZI (3 test). `docs/blockers.md` borç #5 gerçekten kapandı. |
| **W3** — salt okunurluk, manifest fotoğrafı işlemden ÖNCE | ✓ DOĞRULANDI | `thread-read-only-manifest.test.ts:44-46` — `snapshotDir` **tüm** `buildThreadDetail` çağrılarından önce; karşılaştırma `toEqual` (tam eşitlik), F-013/Ö1 tuzağına düşmüyor. M2a (sabit içerik) ve M2b (değişen içerik) **ikisi de KIRMIZI**. |
| **W4** — transkript hiç okunamazken ekran kullanışlı | ⚠ KISMEN | "dizin/dosya yok" ve "boş dosya" yollarında ✓ (11 bölüm dolu kaldı). **"okuma yolu fırlatıyor" yolunda ✗ → B1.** |
| **W5** — ham hata/stack UI'a sızmıyor, log tutuluyor | ✓ DOĞRULANDI | 500 gövdesi: `{"code":"internal_error","message":"Beklenmeyen bir sunucu hatası oluştu. Tekrar deneyin."}` — yol/stack yok. `stderr`: `Uyarı: transkriptin 2 satırı ayrıştırılamadı (…)`. Mutasyon M4 → KIRMIZI. |
| **W6** — ESKALE rozeti, yalnızca sentetik fixture'la test edildi | ✓ GERÇEK DOSYAYLA DOĞRULANDI, **ama çit gevşek** | Ayrıntı §3. |
| **W7** — dar genişlik `clippedVisibleWidth` ile ölçüldü, `nestedScrollCount === 0` | ⚠ KISMEN | `nestedScrollCount = 0` ✓ (7 genişlikte). Ama sekmenin kendisi 320/375'te **0 px** ve içerik kabı 555 px yatay kayıyor → Ö2/Ö3. |
| **`verify` = 0 (1210/4), `e2e` = 41** | ✓ DOĞRULANDI | Bağımsız koşuldu, aynı sayılar. |
| **Tailwind `@source` yapısal çit tarafından yakalandı** | ✓ DOĞRULANDI | `src/web/index.css:13` var; `dist/web/assets/*.css` içinde `border-l-sky-600`, `border-l-amber-600`, `border-l-cyan-600`, `border-l-zinc-600`, `bg-amber-950/40`, `bg-red-950/40`, `bg-zinc-900/40`, `py-1.5`, `whitespace-pre-wrap`, `break-words`, `border-dashed`, `animate-pulse`, `border-l-4` → **13/13 mevcut**. |

---

## 2. BLOKLAYICI

### B1 — Transkript okuma yolundaki sarılmamış `realpathSync` bütün thread ekranını öldürüyor (AC2 + ADR-007 karar 2)

**Dosya:** `src/features/thread/server/thread-detail.ts:114`
```ts
const access = readAllowedTranscript(claudeProjectsRoot, [projectPath], latest.full)
```
Bu çağrı **hiçbir `try/catch` içinde değil.** `readAllowedTranscript` →
`resolveAllowedTranscriptPath` (`transcript-reader.ts:292`) içinde
`fs.realpathSync.native(candidatePath)` var ve bu çağrı Windows'ta **fırlayabilir**.
`buildTranscriptSection`'ın diğer üç `fs` çağrısı (`readdirSync`, `statSync`,
`findAllowedTranscriptDirectories`) özenle sarılmış — **yalnızca bu biri sarılmamış**, ve
kritik olarak `readTranscript`'in "asla fırlatmaz" garantisi guard'ı **kapsamıyor**.

**Tekrar üretme (ölçüldü):**
1. Kısa yollu sahte kök: `C:\Users\pc\AppData\Local\Temp\mcqa10\C--dev-apps-mission-control\s.jsonl`
   (geçerli tek satırlık transkript).
2. `icacls <dosya> /deny "<kullanıcı>:(RA,RD,RX)"` (antivirüs kilidi / ağ sürücüsü / OneDrive
   eşitleme ile aynı sınıf). Node sondası: `existsSync=true`, `lstatSync=OK`,
   `statSync=OK`, **`realpathSync.native → EPERM`**, `readFileSync → EPERM`.
3. `MC_CLAUDE_PROJECTS_ROOT` bu köke bakan üretim sunucusu (7393), Thread → `Gercek Repo` →
   herhangi bir feature.

**Beklenen (feature notu AC2 + ADR-007 karar 2 + `docs/03-ux.md` akış g madde 3):** yalnızca
Transkript bölümü "Bu bölüm okunamadı." olur, diğer bölümler normal görünür.

**Gerçek:**
- `GET /api/thread/detail…` → **HTTP 500**, `internal_error`.
- Tarayıcıda **0 bölüm**; ekranda yalnızca kırmızı banner
  `Beklenmeyen bir sunucu hatası oluştu. Tekrar deneyin. [Tekrar dene]`.
- **"Tekrar dene" kurtarmıyor** (arıza kalıcı olduğu için ikinci istek de 500).
- Sunucu logu: `Hata: istek işlenirken beklenmeyen hata oluştu, 500 dönülüyor: EPERM: operation
  not permitted, realpath 'C:\…\s.jsonl'`
- Süreç yaşıyor (dağıtıcı hata sınırı iş görüyor) ve ham mesaj sızmıyor — **bu iki şey doğru**;
  yanlış olan, en kırılgan kaynağın hatasının **birincil, güvenilir kaynağı da yutması**.
- Kanıt: `docs/qa/screens/F-010-2026-09-10-04-acl-eperm-tum-ekran-kayip.png`

**Neden bloklayıcı:** F-010'un tek cümlelik varlık gerekçesi ("Notlar / kararlar: Thread ekranı
transkript hiç okunamasa bile kullanışlı kalmalıdır (ADR-007)") tam olarak bu senaryoda düşüyor.
Ayrıca `CLAUDE.md`'nin dört kez tekrarladığı hata sınıfının (F-002 → F-005 → F-007 → şimdi)
okuma yolundaki ikizi: "her yeni uçta `try/catch` yeterli değil" dersi burada **yeni ucun
kendisinde** uygulanmamış. Hiçbir test bu dalı ölçmüyor.

**Öneri:** `readAllowedTranscript` çağrısını (ve `statsTracker.record`'u) `buildTranscriptSection`
içinde tek bir `try/catch` ile sar, `catch` → `unreadableTranscriptSection()`. Ardından çiti
kur: `resolveAllowedTranscriptPath`'i fırlatır hâle getiren bir birim testi + **mutasyon**
(`try/catch`'i kaldır → KIRMIZI).

---

## 3. ÖNEMLİ bulgular

### Ö1 — `degraded`/`lines_bad` sinyali arayüze hiç ulaşmıyor; AC2'nin "bir satır ayrıştırılamazsa" dalı yok

**Dosya:** `src/features/thread/server/thread-detail.ts:120-132`

`readTranscript` `degraded: boolean` üretiyor (`transcript-reader.ts:203`), F-009'un QA turu bu
bayrağı "sessiz kısmi başarı yok" gerekçesiyle özellikle ekletmişti. `buildTranscriptSection`
bu alanı **hiç okumuyor**.

**Ölçüm (7392, 5 satırlık dosyanın 2'si bozuk):** yanıt
`"Bu proje için en son görülen oturumda 1.507 giriş, 303 çıkış token ölçüldü. Belirli bir QA
turuna bağlı değildir…"`, `readable: true`. Kullanıcı dosyanın **%40'ının okunamadığını** hiçbir
yerden göremiyor; rakam kendinden emin görünüyor.

Bu, ADR-007'nin kendi azaltımını ihlal ediyor: *"okuyucu, tanıdığı satır sayısı ile toplam satır
sayısını raporlar; **oran düşerse UI 'veri eksik olabilir' uyarısı gösterir**"* ve feature notu
AC2'nin literal metnini (*"…veya bir satır ayrıştırılamazsa … yalnızca ilgili bölüm 'bu bölüm
okunamadı' gösterir"*). Sözleşme §3.2 bu dalı sessizce `lines_ok === 0`'a **daraltmış**, ve bu
daralma sözleşmede "sapma" olarak işaretlenmemiş. Feature notunda AC2 yine de `[x]`.

**Ek olarak çitsiz:** `if (access.result.lines_ok === 0) return unreadableTranscriptSection()`
satırını **tamamen silen** mutasyon (M10) → **1210/1210 YEŞİL**. Yani AC2'nin uygulanan tek
dalının da testi yok.

### Ö2 — Thread sekmesi üretim varsayılanında 320 ve 375 px'te **0 px** görünür; E2E çiti bunu ölçemiyor çünkü sohbet kapalı koşuyor

**Ölçüm (taze yükleme, `tablistScrollLeft = 0`, kırpılmış görünür genişlik):**

| Genişlik | 5 sekme (üretim varsayılanı, `chat_enabled:true`) | 4 sekme (E2E, `MC_CHAT_ENABLED:'0'`) |
|---|---|---|
| 320 px | **0 / 50 px** | 5 / 50 px |
| 375 px | **0 / 50 px** | 50 / 50 px |
| 480 px | 50 / 50 px | 50 / 50 px |
| 640 px | **0 / 50 px** (`tablist` yalnızca 238 px) | — |

Canlı sunucu `GET /api/chat/status` → `session_active: true` döndürüyor, yani **beş sekme**
üretimdeki varsayılan hâl. `tests/e2e/thread.spec.ts:141`'in çiti
(`clippedVisibleWidth('#tab-thread') > 0`) `playwright.config.ts:46`'nın
`MC_CHAT_ENABLED: '0'`'ı yüzünden **dört sekmeli** bir yapılandırmayı ölçüyor — ve orada bile
320 px'te yalnızca **5 piksel** görüyor (`> 0` eşiği bu kıymığı geçerli sayıyor).

`docs/03-ux.md` "CEO notları §3" F-008'in dördüncü sekmesini "320'de 13/59 px ama **375 ve
480'de kullanılabilir**" gerekçesiyle DÜŞÜK sayıp bloklayıcı yapmamıştı. F-010'un beşinci
sekmesi o muafiyetin dayandığı koşulu (**375 px'te kullanılabilir**) kırıyor: kendi feature'ının
sekmesi, birincil senaryonun tam ortasında hiç görünmüyor. Klavye (`ArrowRight`) ve şeridi
yatay kaydırma ile erişilebiliyor — bu yüzden bloklayıcı değil, ama keşfedilebilir değil.

**Öneri:** ya eşiği piksel cinsinden anlamlı bir sayıya çek (`>= 24`), ya sekme etiketlerini
dar genişlikte kısalt, ya da E2E'yi `chat_enabled:true` ile de koştur. **Her hâlükârda çitin
üretimde geçerli olan yapılandırmayı ölçmesi gerekir** (`CLAUDE.md`, F-012 dersi).

### Ö3 — 375 px'te Thread içerik kabı 555 px yatay kayıyor; sağa kaydırınca ekran tamamen boşalıyor

**Dosya:** `src/features/thread/web/ThreadScreen.tsx:113-133` (Feature `<select>`, genişlik
kısıtı yok)

`overflow-y-auto` bir kapta `overflow-x` hesaplanan değeri de `auto` olur. Feature `<select>`
kendi en uzun `<option>` metnine göre boyutlanıyor: 375 px'te **828 px** genişlikte, sağ kenarı
x=915'te. Sonuç: `thread-screen.scrollWidth = 915`, `clientWidth = 360`, yani **555 px** yatay
kaydırma alanı. `scrollLeft = 555` yapıldığında ekranda **hiçbir içerik kalmıyor** (boş siyah
alan + kaydırma çubuğu). Ölçüm 280/320/375/480/640/768 px'te aynı (`scrollWidth = 915`);
1280 px'te taşma yok.

Kanıt: `docs/qa/screens/F-010-2026-09-10-02-375px.png`,
`docs/qa/screens/F-010-2026-09-10-03-375px-yatay-kaydirilmis.png`

Belge kaydırması yok (`documentElement.scrollWidth == innerWidth`), bölüm kartları görünür
alanda kalıyor — bu yüzden bloklayıcı değil. Öneri: `<select>`'e `max-w-full min-w-0
truncate` (veya kapsayıcıya `min-w-0`).

### Ö4 — ESKALE rozeti yanlış pozitif veriyor: `latest.md`'nin **gövdesindeki** alıntı da rozeti tetikliyor

**Dosya:** `src/features/thread/server/thread-detail.ts:42`
```ts
if (!/^ESKALE:\s*true\s*$/im.test(latestContent)) return false
```
Desen **tüm belgeyi** tarıyor, yalnızca ilk satırları değil.

**Tekrar üretme (ölçüldü):** `docs/qa/latest.md` = başlığı `KARAR: GEÇTİ` / `ESKALE: false`,
frontmatter `feature: F-008` olan gerçekçi bir QA raporu; gövdesinde raporun zorunlu ilk
satırlarını gösteren bir kod bloğu:
```
KARAR: KALDI
ESKALE: true
```
→ `GET /api/thread/detail?...file=F-008-kapilar-paneli.md` **`eskale: true`**. Yani eskale
edilmemiş bir feature'da "⚠ ESKALE: QA turu sınırı aşıldı, kullanıcıya iletildi." banner'ı
çıkıyor. Bu senaryo bu depoda uydurma değil: `docs/PROCESS.md:57` ve `qa-evaluator` görev
tanımı QA'ya bu iki satırı yazdırıyor, dolayısıyla raporlar formatı sıklıkla alıntılıyor.
(Bu raporun yazıldığı ana kadar hiçbir gerçek `docs/qa/*.md` dosyasında sütun 0'da böyle
bir satır yoktu.)

**Bu rapor bulguyu CANLI olarak üretiyor:** yukarıdaki kod bloğu `docs/qa/latest.md`'ye de
kopyalanacağı ve bu raporun frontmatter'ı `feature: F-010` olduğu için panel F-010 thread'inde
ESKALE banner'ı gösterecek — oysa bu raporun ilk satırı `ESKALE: false`. Süreç açısından
bağlayıcı olan ilk satırdır; banner yanlıştır ve tam olarak Ö4'ün kendisidir. Düzeltme turunda
kapandığında bu banner kendiliğinden kaybolmalıdır.

**Ölçüldü (canlı, gerçek dosya):** `docs/qa/latest.md` = bu rapor →
`GET /api/thread/detail?...file=F-010-thread-gorunumu.md` → `eskale: true`;
F-008 ve F-012 → `eskale: false`. Tarayıcıda banner metni birebir
"⚠ ESKALE: QA turu sınırı aşıldı, kullanıcıya iletildi.".
Kanıt: `docs/qa/screens/F-010-2026-09-10-07-yanlis-eskale-rozeti.png`

**Çit yok:** deseni `^…$` çapalarından ve `m` bayrağından arındıran mutasyon (M11,
`/ESKALE:\s*true/i`) → **1210/1210 YEŞİL**.

**Öneri:** yalnızca ilk frontmatter'dan önceki başlık bloğunu (veya ilk 5 satırı) tara; negatif
birim testi ekle (gövdede alıntı → `eskale:false`).

### Ö5 — "Kronolojik" iddiası gerçek veride tutmuyor: 5/5 feature'da zaman damgaları geriye gidiyor

AC1: *"`docs/qa/<feature>-contract.md` ve `docs/qa/*.md` bölümleri **kronolojik sırayla**
listelenir"*. Uygulama ilk iki bölümü **role göre** sabitliyor (CEO brief, sonra
`-contract.md`), QA raporlarını ise mtime'a göre sıralıyor. Gerçek veride sonuç:

| Feature | Görünen sıra (yerel saat) |
|---|---|
| F-012 | CEO 12:23 → **Developer 05:29** → **QA 04:15** → 05:08 → 05:28 → 06:38 → 07:59 → 08:34 → 10:00 → 11:37 → 12:23 |
| F-008 | CEO 05:31 → **Dev 04:51** → **QA 02:04** → 02:14 → 02:37 → 04:37 → 05:31 |
| F-009 | CEO 08:03 → **Dev 07:39** → **QA 06:28** → 07:23 → 08:03 |
| F-014 | CEO 17:40 → **Dev 17:11** → **QA 12:27** → 14:53 → 17:40 |
| F-010 | CEO 10:49 → **Dev 09:36** |

Yani ekran "kronolojik" diyor ama kullanıcı **her feature'da** iki kez geriye giden zaman
damgası görüyor. F-012'de `-contract.md` (05:29) üç `-contract-review-*.md` dosyasından
(04:15/05:08/05:28) **sonra** yazılmış olmasına rağmen onların **önünde** listeleniyor —
ikisi de `docs/qa/*` dosyası olduğu için bu, AC1'in literal ihlali.

Kanıt: `docs/qa/screens/F-010-2026-09-10-01-zincir-1280.png`

**Öneri (CEO kararı gerekir):** ya AC1'in metni "rol sırası (brief → sözleşme → QA), QA turları
kendi içinde kronolojik" olarak düzeltilsin, ya da zaman damgası gösterimi kronolojiyle
çelişmeyecek hâle getirilsin (ör. brief/sözleşme için "son güncelleme" etiketi).

### Ö6 — Aynı başlıklı, ayırt edilemeyen bölümler: F-012'de dokuz "QA kararı"nın beşi birbirinin aynısı

Bölüm başlığı yalnızca `QA kararı` (+ varsa `: GEÇTİ|KALDI`) ve zaman damgası içeriyor; **dosya
adı hiçbir yerde yok**. F-012 thread'inde:
`QA kararı · 04:15` (`-contract-review-1.md`), `· 05:08` (`review-2`), `· 05:28` (`review-3`),
`· 06:38` (`kod-turu-A-notlari`), `· 07:59` (`kod-turu-B-notlari`) — beş bölüm, hepsi kapalı,
hepsi tıpatıp aynı görünüyor. Kullanıcı hangisinin sözleşme denetimi, hangisinin kod turu notu
olduğunu ancak tek tek açarak anlayabiliyor. `docs/03-ux.md` ekran 5 mockup'ı tek bir "QA kararı"
kartı varsayıyor; gerçek veri 9 tane üretiyor. Öneri: `summary`'ye dosya adını (veya
frontmatter `round` alanını) ekle.

### Ö7 — Feature listesi hata verdiğinde ÖNCEKİ projenin listesi sessizce ekranda kalıyor

**Dosya:** `src/features/thread/web/useProjectFeatureList.ts:38-45`

`catch` yalnızca `setLoadState('error')` yapıyor; `features` state'i temizlenmiyor ve
`ThreadScreen` `featuresLoadState === 'error'` durumunu **hiç render etmiyor** (`retry` da
hiçbir yerden çağrılmıyor — ölü API).

**Ölçüm:** `GET /api/features?*` 500'e zorlandı, proje `QA Sandbox` → `Gercek Repo` değiştirildi.
Sonuç: Feature `<select>` **17 seçenekle**, yani ESKİ projenin listesiyle açık kaldı; hiçbir
uyarı yok (`role="alert"` yok). Kullanıcı yanlış projenin feature'ını seçmiş olabileceğini
anlayamıyor. `docs/03-ux.md` "Durum tasarımı" tablosu her ekran için bir hata durumu şart
koşuyor.

---

## 4. Kaçış ve çit sondaları (W1)

`src/features/thread/**` içinde kendi yol çiti/`fs` kapsam kontrolü **yok**; tüm okumalar
F-013'ün `resolveInsideRootForRead` ve F-009'un `resolveAllowedTranscriptPath` guard'larından
geçiyor. Sondalar (7391, gerçek repo + sandbox proje):

| Sonda | Sonuç |
|---|---|
| `file=../../../package.json` | 400 `invalid_body` ("Dosya biçimi tanınamadı.") |
| `file=..\..\package.json` | 400 |
| `file=C:\Windows\win.ini` | 400 |
| `file=../qa/latest.md` | 400 |
| `file=F-010-THREAD-GORUNUMU.MD` (harf varyantı) | 400 (desen `\.md$` harfe duyarlı) |
| `file=f-010-thread-gorunumu.md` | 200 (diskteki ad zaten küçük harfli — beklenen) |
| `file=` / `file=.` / uzantısız | 400 |
| Feature dosyasında `id: ../../../outside` | 200 ama **yalnızca** `ceo_brief` + `transcript`; sözleşme/QA okunmadı (`SAFE_ID_PATTERN` tuttu, F-013/K1 çiti) |
| `docs/features/ZZ-link.md` = symlink (yönetici hakkı yokken oluşturulamadı) | — (F-013'ün symlink çiti ayrıca test edilmiş) |
| Transkript kökünde **junction** (`mklink /J`, kodlanmış proje adıyla) | Reddedildi: `Dirent.isDirectory() === false`, `isSymbolicLink() === true` → `findAllowedTranscriptDirectories` atlıyor; bölüm `readable:false` |

Bir gözlem (not, bulgu değil): `id: F-012` yazan **başka adlı** bir feature dosyası F-012'nin
sözleşme+QA zincirini gösteriyor. Aynı proje kökü ve `docs/qa` alt ağacı içinde kaldığı için
güvenlik sorunu değil; F-013'ün `id`-güdümlü tasarımının doğal sonucu.

---

## 5. Mutasyon tablosu

Her mutasyon tek tek uygulandı → koşuldu → `git checkout --` ile geri alındı. Turun sonunda
`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` yalnızca **önceden var olan
meşru test adlarını** buluyor; `src/` altında **hiç eşleşme yok**.

| # | Mutasyon | Dosya | Sonuç |
|---|---|---|---|
| M1 | `statsTracker.record(access.result)` yorumlandı (W2) | `thread-detail.ts:118` | **KIRMIZI** (3 test; birim + entegrasyon "health sayaçları gerçekten artar") |
| M2a | Mutlu yola **sabit içerikli** `fs.writeFileSync` (W3) | `thread-detail.ts:177` | **KIRMIZI** (6 test) |
| M2b | Mutlu yola **değişen içerikli** `fs.writeFileSync` (W3) | aynı | **KIRMIZI** (6 test) |
| M2c | **Yalnızca mtime**'a dokunan boş `appendFileSync` | aynı | Manifest testi YEŞİL (bilinen sınır, F-013/D42) → ikinci katman `tests/no-write-gate-bypass.test.ts` **KIRMIZI** yakaladı. Savunma derinliği çalışıyor. |
| M3 | Transkript okunamazken tüm bölümler düşürüldü (W4 izolasyon çiti) | `thread-detail.ts:214` | **KIRMIZI** (4 test, W4 testi dâhil) |
| M4 | Ham `err.stack` bölüm içeriğine sızdırıldı (W5) | `thread-detail.ts:82-86` | **KIRMIZI** (2 test) |
| M5 | ESKALE feature-id eşleşmesi kaldırıldı (`return true`) (W6) | `thread-detail.ts:43-47` | **KIRMIZI** (W6 testi) |
| M6 | Altıncı sekme eklendi (kapalı küme) | `App.tsx:30` | **KIRMIZI** (5 test / 3 dosya: `App.test.tsx`, `App.chat-tab.test.tsx`, `App.interaction.test.tsx`; ayrıca `shell.spec.ts` tam-sayı çiti) |
| M7 | `tabIndex={0}` kaldırıldı (tek kaydırma kabının klavye erişimi) | `ThreadScreen.tsx:73` | **YEŞİL** (1210/1210) → D1 |
| M8 | `title={tooltip}` kaldırıldı (UX akış g madde 2) | `ThreadSectionCard.tsx:44` | **YEŞİL** (1210/1210) → D2 |
| M9 | QA raporu sıralaması ters çevrildi (mtime azalan) | `feature-detail.ts:78` | **KIRMIZI** (F-010'un kendi AC1 testi dâhil) — AC1 sıralaması çitli |
| M10 | `lines_ok === 0 → okunamadı` dalı silindi (AC2) | `thread-detail.ts:126` | **YEŞİL** (1210/1210) → Ö1 |
| M11 | ESKALE deseni gevşetildi (`^…$` ve `m` kaldırıldı) | `thread-detail.ts:42` | **YEŞİL** (1210/1210) → Ö4 |

Brief'in zorunlu kıldığı 6 mutasyonun (W2·W3·W4·W5·W6 + kapalı sekme kümesi) **6'sı da
KIRMIZI**. Kendi eklediğim 5 mutasyonun **3'ü YEŞİL** kaldı; üçünde de sonda doğruydu (davranış
farkı canlı olarak ayrıca ölçüldü), yani **çit eksik**.

---

## 6. Okunabilirlik ölçümleri (W7)

Playwright, taze yükleme, kırpılmış görünür genişlik.

| Genişlik | `documentElement.scrollWidth` | İç içe kaydırma kabı | `thread-screen` scrollW / clientW | En dar `summary` | `<pre>` yatay taşma | Thread sekmesi (5 sekme) |
|---|---|---|---|---|---|---|
| 280 | 280 | **0** | 915 / 265 | 236 px | 0 | 0 / 50 px |
| 320 | 320 | **0** | 915 / 305 | 276 px | 0 | **0 / 50 px** |
| 375 | 375 | **0** | 915 / 360 | 331 px | 0 | **0 / 50 px** |
| 480 | 480 | **0** | 915 / 465 | 436 px | 0 | 50 / 50 px |
| 640 | 640 | **0** | 915 / 625 | 596 px | 0 | 0 / 50 px |
| 768 | 768 | **0** | 915 / 753 | 724 px | 0 | 17 / 50 px |
| 1280 | 1280 | **0** | 1265 / 1265 | 1236 px | 0 | 50 / 50 px |

- **İç içe kaydırma kabı her genişlikte 0** — F-013'ün 12 kaplı felaketi tekrarlamadı. ✓
- **`<pre>` yatay taşması 0** (12 bölüm açıkken) — `whitespace-pre-wrap break-words` çalışıyor. ✓
- Klavye: `Tab` → tablist, `ArrowRight ×4` → `tab-thread` seçili + `panel-thread` görünür;
  `Tab` sırası `Ayarlar → thread-screen → Proje → Feature → her bölümün summary`'si;
  `thread-screen.focus()` + `PageDown` → `scrollTop 0 → 584`. ✓ (Ama M7 çitsiz, bkz. D1.)
- Yükleniyor: **3 bölüm iskeleti** (UX Durum tasarımı tablosuyla birebir). ✓
  Kanıt: `docs/qa/screens/F-010-2026-09-10-05-yukleniyor-iskelet.png`
- Okunamayan bölüm: kesikli çerçeve, metin `Bu bölüm okunamadı.`,
  `title="Transkript formatı tanınmadı veya bozuk."` — UX akış (g) ile birebir. ✓
  Kanıt: `docs/qa/screens/F-010-2026-09-10-06-transkript-okunamadi.png`
- Boş durumlar: proje yok → "Önce bir proje seçin." + Ayarlar'a git; feature yok →
  "Bir feature seçin."; sözleşme/QA yok → "Bu feature için henüz sözleşme/QA kaydı yok." ✓
- Sayfa yenileme: sekme Zaman Çizelgesi'ne dönüyor, seçimler sıfırlanıyor — uygulamanın geri
  kalanıyla tutarlı, UX kalıcılık istemiyor. Bulgu değil.

---

## 7. Notlar (D)

- **D1** — `tabIndex={0}` (`ThreadScreen.tsx:73`) kaldırıldığında 1210/1210 yeşil. F-013'ün K6
  düzeltmesi burada uygulanmış ama **çitlenmemiş**; `locator.focus()` doğal odaklanabilirliği
  atladığı için E2E'ye eklenecek assert `page.keyboard.press('Tab')` + `document.activeElement`
  olmalı (`CLAUDE.md`/F-013 dersi).
- **D2** — `title` ipucu (`ThreadSectionCard.tsx:44`) kaldırıldığında 1210/1210 yeşil. UX akış
  (g) madde 2'nin açıkça istediği davranış çitsiz.
- **D3** — Bayat yorum: `transcript-reader.ts:346-349` hâlâ *"Bu turda hiçbir üretim kodu
  `.record()`'u ÇAĞIRMIYOR … `/api/health.transcript_reader` bu turda dürüstçe sıfır kalır"*
  diyor. F-010 bunu değiştirdi. Sözleşme "bu dosyaya dokunulmaz" dediği için anlaşılır, ama
  yorum artık yanlış — bir sonraki turda düzeltilmeli.
- **D4** — Salt-okunurluk manifesti (`snapshotDir`: relPath+size+sha256) `mtime`-only yazmayı
  görmüyor; ikinci katman (statik tarama) yakalıyor. Kayda geçsin, aksiyon gerekmez.
- **D5** — `buildThreadDetail` gövde dosyasını **iki kez** okuyor: kendi `readFileSync`'i
  (`thread-detail.ts:165`, yalnızca `mtimeMs` için) + `buildFeatureDetail`'in içindeki.
  Küçük dosyalarda önemsiz; `buildFeatureDetail`'in `mtimeMs` döndürmesi daha temiz olurdu.
- **D6** — Transkript zenginleştirmesinin **dürüstlüğü: GEÇER.** Metin ("Bu proje için en son
  görülen oturumda … Belirli bir QA turuna bağlı değildir (best-effort zenginleştirme).") ne
  vaat ettiğinden fazlasını söylemiyor, hiçbir QA bölümüne bağlanmıyor ve listenin en sonunda
  duruyor. Sözleşme §3.2/§6'nın bilinçli kararıyla tutarlı, arayüz kullanıcıyı yanıltmıyor.
  **Tek istisna Ö1**: rakamların ne kadarının okunabildiği söylenmiyor.
- **D7** — Yetim süreç: QA turu 3 üretim sunucusu (7391/7392/7393) başlattı, her biri
  `npx → tsx → node` üçlüsü = **9 süreç**; hepsi tur sonunda durduruldu, üç portun üçü de
  `HTTP=000`. `C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı. Kalan yetim: **0**.

---

## 8. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| **İşlevsellik** | **5**/10 | Zincir gerçek veriyle eksiksiz çalışıyor, W2 canlı, W6 gerçek dosyayla doğru; ama B1 ekranın tamamını kalıcı olarak düşürüyor, Ö4 yanlış ESKALE üretebiliyor, Ö7 yanlış projenin listesini gösteriyor. |
| **Özellik bütünlüğü** | **6**/10 | AC1/AC4/AC5 karşılanıyor (AC1 literal okumada Ö5 ile tartışmalı); AC2'nin "bir satır ayrıştırılamazsa" dalı yok ve `degraded` düşürülmüş (Ö1); AC3 karşılanıyor. Beş AC'nin beşi de feature notunda `[x]`. |
| **Görsel/UX** | **5**/10 | Tek kaydırma bağlamı, klavye, iskelet, boş/hata metinleri, `@source`, renk kodlaması hepsi doğru; ama kendi sekmesi birincil viewport'ta görünmüyor (Ö2), 555 px hayalet yatay kaydırma (Ö3), dokuz bölümün beşi ayırt edilemiyor (Ö6). |
| **Kod kalitesi** | **6**/10 | Yeniden kullanım gerçek (W1), guard'lar katmanlı, salt-okunurluk çiti F-013'ün dersini doğru uygulamış, istenen 6 mutasyon KIRMIZI. Ama en kırılgan yoldaki tek çağrı sarılmamış (B1), 4 davranış çitsiz (M7/M8/M10/M11), E2E dar-genişlik çiti üretimde geçerli olmayan yapılandırmayı ölçüyor. |

**Hiçbiri < 7 değil kuralı: dördü de < 7 → KARAR: KALDI.**

---

## 9. Düzeltme turu için istenenler

1. **B1** — `readAllowedTranscript` + `statsTracker.record` çağrılarını `try/catch` ile sar,
   `catch → unreadableTranscriptSection()`. Çit: `resolveAllowedTranscriptPath`'i fırlatır hâle
   getiren birim testi **ve** mutasyon (sarmalayıcıyı kaldır → KIRMIZI). Ek olarak "diğer
   bölümler hâlâ dolu" iddiasını aynı testte assert et.
2. **Ö1** — `degraded`/`lines_bad`'ı bölüme taşı ve arayüzde göster (ADR-007'nin "veri eksik
   olabilir" azaltımı). AC2'nin metnini ya karşıla ya da sözleşmeye **işaretli sapma** olarak
   yaz. `lines_ok === 0` dalına test ekle (M10 → KIRMIZI olmalı).
3. **Ö4** — ESKALE taramasını başlık bloğuyla sınırla; negatif test (gövdede alıntı →
   `eskale:false`) ekle, M11 mutasyonu KIRMIZI vermeli.
4. **Ö2** — Dar genişlikte Thread sekmesini görünür kıl; E2E eşiğini anlamlı bir piksele çek ve
   çiti **`chat_enabled:true`** ile de koştur.
5. **Ö3** — Feature `<select>`'e `max-w-full min-w-0 truncate`; 320/375/480'de
   `thread-screen.scrollWidth === clientWidth` assert'i ekle.
6. **Ö5** — CEO kararı: AC1'in metni mi düzelecek, gösterim mi? Karar **turun başında** verilsin
   ve sözleşmenin gövdesine yayılsın (`CLAUDE.md` dersi).
7. **Ö6** — Bölüm başlığına dosya adını (veya `round`) ekle.
8. **Ö7** — Feature listesi hatasında listeyi temizle + hata satırı göster (`retry`'ı bağla).
9. **D1/D2/D3** — `tabIndex={0}` ve `title` için çit; `transcript-reader.ts` bayat yorumu.

Kapanış turunda istenen mutasyonlar: B1 sarmalayıcısını kaldır · M10 · M11 · M7 · M8 — beşi de
KIRMIZI vermeli. Ayrıca **düzeltmeyi birebir geri saran** ikinci bir mutasyon (B1 için:
`catch` dalını `throw err`'e çevir) da koşulsun.
