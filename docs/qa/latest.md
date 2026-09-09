KARAR: GEÇTİ
ESKALE: false

---
feature: F-010
title: Feature thread görünümü (docs/qa birincil, transkript best-effort)
reviewer: qa-evaluator
date: 2026-09-10
round: düzeltme turu QA (tur 2)
scope: dar — yalnızca tur 1'in B1 + Ö1-Ö6 bulguları ve dört yeşil mutasyonu (M7/M8/M10/M11)
---

# F-010 QA raporu — düzeltme turu (tur 2)

**KARAR: GEÇTİ** — bloklayıcı yok. Tur 1'in bloklayıcısı (B1) ve altı önemli bulgusu kapandı;
yedi bağımsız mutasyonun **yedisi de KIRMIZI**; `verify` ve `e2e` yeşil.

Bloklayıcının kapanışı kâğıt üzerinde değil **canlı ölçüldü**: aynı `icacls /deny` reprosu ile
kurulan üretim sunucusunda `GET /api/thread/detail` artık **HTTP 200** dönüyor, CEO brief +
Developer raporu + QA kararı normal render ediliyor, yalnızca transkript kartı
"Bu bölüm okunamadı." oluyor. ADR-007 karar 2 ("transkript hiç okunamasa bile thread ekranı
kullanışlı kalır") artık gerçekten tutuyor.

Kalan iki gözlem (D8/D9) **not seviyesindedir**, tur 1'in kendi önerdiği çözümün doğal sınırıdır
ve bu depoda bugün tetiklenmiyor — kararı yumuşatmıyorum, bloklayıcı değiller.

---

## 0. Ortam ve ölçüm yöntemi

- `npm run build` + `npx tsx src/server/index.ts` (**`npm run dev` KULLANILMADI**). Üç üretim
  sunucusu:
  - **7391** — gerçek `~/.claude/projects` kökü, `MC_CHAT_ENABLED=1` → `GET /api/chat/status`
    `chat_enabled:true` (**üretim varsayılanı, 5 sekme**). İki proje: gerçek repo (`p_a68120`) ve
    `docs/features`+`docs/qa`'nın mtime korunmuş kopyası (`p_0960f7`, `cp -rp`).
  - **7392** — `MC_CLAUDE_PROJECTS_ROOT` = sahte kök, `d.jsonl` 5 satırın **2'si bozuk** (X6).
  - **7393** — `MC_CLAUDE_PROJECTS_ROOT` = kısa yollu kök, `s.jsonl` `icacls /deny` ile
    erişilemez (X1/B1).
- ACL sondası tur 1'le birebir aynı sonucu verdi: `existsSync=true`, `lstatSync=OK`,
  `statSync=OK`, **`realpathSync.native → EPERM`**, `readFileSync → EPERM`.
- Tarayıcı: Playwright/Chromium, **kırpılmış görünür genişlik** (`toBeVisible()` KULLANILMADI),
  280/320/360/375/414/480/560/639/640/768/1280 px taraması.
- Gerçek `docs/qa/latest.md`'ye **hiç dokunulmadı**; X2 kaçış sondaları yalnızca sandbox
  kopyasının `latest.md`'sinde yapıldı ve dosya orijinal içerik + orijinal `mtime` ile geri
  yüklendi.
- Mutasyonlar **elle** uygulandı ve **elle** geri alındı (`git checkout` KULLANILMADI); her geri
  alma sonrası `git diff --name-only` boş.

---

## 1. Developer iddialarının doğrulanması

| İddia | Sonuç | Kanıt |
|---|---|---|
| **X1/B1** — `readAllowedTranscript` + `statsTracker.record` `try/catch` ile sarıldı; EPERM'de 200 + yalnızca transkript okunamadı | ✓ **DOĞRULANDI (CANLI, GERÇEK HTTP)** | §2 |
| **X2/Ö4** — `isEscalatedFor` yalnızca başlık bloğunu tarıyor; alıntı rozeti tetiklemiyor | ✓ **DOĞRULANDI (CANLI + 12 sonda)** | §3 |
| **X3/Ö2-Ö3** — 320px'te Thread 0px → 19.2px; 375/480px tam; `<select>` hayalet kaydırması gitti | ✓ **DOĞRULANDI**, mock **doğru yapılandırmayı** ölçüyor | §4 |
| **X4/D1-D2** — gerçek `Tab` klavye testi + `title` iddiası; M7/M8'e karşı KIRMIZI | ✓ DOĞRULANDI | §5, §7 |
| **X5/Ö5-Ö6** — `developer_report` + `qa_verdict` gerçek `mtime` ile birleşik sıralanıyor; başlığa dosya adı eklendi | ✓ **DOĞRULANDI (4 gerçek feature, 24 bölüm)** | §6 |
| **X6/Ö1** — `degraded`/`lines_bad` uyarı cümlesi olarak arayüze taşındı | ✓ DOĞRULANDI, metin `docs/03-ux.md` ile **birebir** | §6 |
| `verify` **1216 passed / 4 skipped**, `playwright` **45/45** | ✓ DOĞRULANDI (normal koşu, `--no-file-parallelism` YOK) | §8 |
| `docs/blockers.md` N6 güncellendi, Kanban örneği açık bırakıldı | ✓ DOĞRULANDI | `docs/blockers.md:269-273` — "`kanban.spec.ts` F-010'un dosya sahipliği DIŞINDA … bu madde tam olarak kapanmadı" (dürüst, kapsam doğru) |

---

## 2. X1 / B1 — EPERM reprosunun tekrarı (BLOKLAYICI KAPANDI)

**Kurulum:** tur 1'in birebir aynısı — `C:\Users\pc\AppData\Local\Temp\mcqa10b\eperm\
C--dev-apps-mission-control\s.jsonl` + `icacls /deny "<kullanıcı>:(RA,RD,RX)"`, üretim sunucusu
7393, gerçek repo projesi, `F-010-thread-gorunumu.md`.

**"Dosya yok" senaryosu değil, FIRLATAN yol ölçüldü** (sonda yukarıda: `statSync` başarılı,
`realpathSync.native` EPERM).

```
GET /api/thread/detail?project_id=p_d3eec8&file=F-010-thread-gorunumu.md
→ HTTP 200   (tur 1: HTTP 500)
   bölüm sayısı = 4   (tur 1: 0)
   ceo_brief         readable=true   1.421 karakter
   qa_verdict        readable=true  27.342 karakter  "QA kararı: KALDI · F-010-2026-09-10.md"
   developer_report  readable=true  16.841 karakter
   transcript        readable=false  0 karakter
```

- **"Tekrar dene" çalışıyor mu:** artık hata banner'ı hiç çıkmıyor (`thread-error-banner`
  **yok**), yani "tekrar dene"ye gerek kalmıyor; yine de ikinci istek bağımsız olarak koşuldu →
  **200, 4 bölüm** (kalıcı arıza altında tekrarlanabilir, çıkmaz yok).
- **Tarayıcı doğrulaması:** `thread-error-banner=false`, `thread-eskale-banner=false`, dört kart
  render edildi, okunamayan kartın `title` özniteliği `"Transkript formatı tanınmadı veya
  bozuk."` (UX akış g ile birebir).
  Kanıt: `docs/qa/screens/F-010-2026-09-10-tur2-04-eperm-yalnizca-transkript-okunamadi.png`
- **Mutasyon MX1** (`try/catch` tamamen kaldırılır) → **KIRMIZI**, 2 test:
  birim (`thread-detail.test.ts`) **ve** gerçek dağıtıcı üzerinden entegrasyon
  (`thread-api.test.ts`). Yani çit yalnızca fonksiyon seviyesinde değil, **HTTP yolunda** da var.
- **Mutasyon MX1b** (düzeltmeyi birebir geri saran: `catch { return unreadable… }` →
  `catch (err) { throw err }`) → **KIRMIZI**, aynı 2 test. Çit komşu bir yolu değil,
  **düzeltmenin kendisini** koruyor.

Ek olarak `buildTranscriptSection`'daki **beş** `fs`/okuma çağrısının beşi de artık sarılmış
durumda (`findAllowedTranscriptDirectories`, `readdirSync`, `statSync`, `readAllowedTranscript`,
`statsTracker.record`) — sarılmamış çağrı kalmadı.

---

## 3. X2 / Ö4 — ESKALE başlık bloğu (KAPANDI) + yeni kaçış denemeleri

### 3.1 Kendi repro'mun tekrarı — canlı, gerçek dosyayla

Gerçek `docs/qa/latest.md` **bugün hâlâ tur 1 raporumdur** ve gövdesinde sütun 0'da
`ESKALE: true` taşıyan bir kod bloğu var (satır 200). Üretim sunucusu:
`GET /api/thread/detail?...file=F-010-thread-gorunumu.md` → **`eskale: false`**,
tarayıcıda banner **yok**. Tur 1'in canlı olarak ürettiği yanlış pozitif **kayboldu**.

Gerçek pozitif korunuyor: depodaki tek gerçek eskale raporu
(`F-012-2026-09-06-tur3.md`, başlık bloğunda `ESKALE: true`) tam tarama ile doğrulandı — 54
`docs/qa/*.md` dosyasının **yalnızca** o birinin başlık bloğu deseni eşliyor.

### 3.2 On iki sonda (sandbox `latest.md`, gerçek HTTP)

| # | Sonda | `eskale` | Değerlendirme |
|---|---|---|---|
| A | Gerçek eskale, başlık bloğunda, doğru feature | `true` | ✓ doğru pozitif |
| B | **Tur 1 repro'su**: gövdede alıntılanan kod bloğu | `false` | ✓ **kapandı** |
| C | Frontmatter YOK, alıntı **5. satırda** | `true` | sınır (aşağıda D8) |
| D | Frontmatter YOK, alıntı **6. satırda** | `false` | ✓ 5-satır sınırı tutuyor |
| E | Harf varyantı `eskale: TRUE` başlıkta | `true` | ✓ `/i` korunmuş |
| F | CRLF satır sonu, gerçek eskale | `true` | ✓ `\r` yutulmuyor |
| G | CRLF satır sonu, gövdede alıntı | `false` | ✓ |
| H | Frontmatter YOK, ilk `---` **20. satırda** (yatay çizgi), alıntı 9. satırda | `true` | **kaçış** → D8 |
| I | Frontmatter **ilk satırda**, `ESKALE: true` frontmatter'ın içinde + gövdede | `false` | yanlış negatif → D9 |
| J | Cümle parçası: "önceki turda ESKALE: true idi" (başlıkta) | `false` | ✓ ikinci katman (çapa) tutuyor |
| K | Başlıkta gerçek eskale ama **başka feature** (F-008) | `false` | ✓ §3.3 çiti duruyor |
| L | Başlıkta **TAB ile girintili** `ESKALE: true` | `false` | ✓ çapa tutuyor |

### 3.3 İki katman ayrı ayrı mutasyonlandı (savunma derinliği)

- **MX2** — başlık bloğu kısıtı kaldırılır (`extractHeaderBlock(latestContent)` → `latestContent`)
  → **KIRMIZI** (X2/Ö4 negatif testi).
- **MX2b** — tur 1'in M11'i: çapalar ve `m` bayrağı kaldırılır (`/ESKALE:\s*true/i`)
  → **KIRMIZI** (yeni "cümle parçası" testi). Tur 1'de bu mutasyon **1210/1210 YEŞİL**di.

İki katmanın **her biri kendi testine** sahip; tek mutasyon ikisini birden kırmıyor — yani
testler aynı şeyi ölçmüyor.

---

## 4. X3 / Ö2-Ö3 — dar genişlik, ÜRETİM yapılandırmasında (karar dâhil)

### 4.1 Kırpılmış görünür genişlik, 7391 (gerçek 5 sekme, taze yükleme, `tablistScrollLeft=0`)

| Genişlik | Zaman Çiz. | Kanban | Sohbet | Kapılar | **Thread** | Belge yatay kaydırma |
|---|---|---|---|---|---|---|
| 280 | 108 | 43.2 | 43.2 | 35.6 | **0** | yok |
| **320** | 108 | 43.2 | 43.2 | 50.4 | **19.2** | yok |
| 360 | 108 | 43.2 | 43.2 | 50.4 | **43.2 (tam)** | yok |
| **375** | 108 | 43.2 | 43.2 | 50.4 | **43.2 (tam)** | yok |
| 414 | 108 | 43.2 | 43.2 | 50.4 | **43.2 (tam)** | yok |
| **480** | 108 | 43.2 | 43.2 | 50.4 | **43.2 (tam)** | yok |
| 560 / 639 | 108 | 43.2 | 43.2 | 50.4 | **43.2 (tam)** | yok |
| 640 | 126 | 50.4 | 30 | **0** | **0** | yok |
| 768 | 126 | 50.4 | 50.4 | 58.8 | 16.8 | yok |
| 1280 | 126 | 50.4 | 50.4 | 58.8 | 50.4 (tam) | yok |

Tur 1'de 320 ve 375 px'te Thread **0 px**'ti. Şimdi 320'de 19.2 px, **360-639 arası tam**.

### 4.2 **19.2 px kabul edilebilir mi — KARAR: EVET**

Gerekçe (kalibrasyon, dayanak `docs/03-ux.md` "CEO notları §3"):
1. Onaylı emsal, F-008'in dördüncü sekmesini **320'de 13/59 px** ile kabul etmiş; muafiyetin
   **dayandığı koşul** "375 ve 480'de kullanılabilir" idi. Tur 1'de F-010 bu koşulu kırıyordu
   (375'te 0 px). Şimdi 375 **ve** 480 **tam görünür** — muafiyetin koşulu karşılanıyor.
2. 19.2 px, onaylı emsalin (13 px) **üzerinde**; tam genişliğin %44'ü.
3. Görsel doğrulama: taze yüklemede sekme şeridinin sağ ucunda "Th…" okunuyor — kullanıcı beşinci
   bir sekmenin varlığını görüyor (keşfedilebilirlik sağlanmış).
   Kanıt: `docs/qa/screens/F-010-2026-09-10-tur2-03-320px-taze-yukleme-sekmeler.png`
   (375 px: `…-03-375px-taze-yukleme-sekmeler.png`)
4. Klavye (`ArrowRight`) ve kaydırma erişimi zaten vardı; artık görsel ipucu da var.

**280 px ve 640-767 px bandı** hâlâ sekme düşürüyor (640'ta Kapılar **ve** Thread 0 px). Bu
**regresyon değil**: `sm:` (≥640px) altında hiçbir sınıf değişmedi — 640 px'te uygulanan
sınıflar (`gap-4` + `text-sm`) tur 1'dekiyle **birebir aynı**; tur 1 tablosu da 640 px'te Thread'i
0/50 px ölçmüştü. Birincil senaryo 320-480 px olarak tanımlı ve orada durum **iyileşti**.
Taşınan borç olarak D10'a yazıldı.

### 4.3 Ö3 — hayalet yatay kaydırma gitti

| Genişlik | `thread-screen` scrollW / clientW | Feature `<select>` genişliği |
|---|---|---|
| 280 | 280 / 280 **EŞİT** | 160 |
| 320 | 320 / 320 **EŞİT** | 160 |
| 375 | 375 / 375 **EŞİT** | 160 |
| 480 | 480 / 480 **EŞİT** | 160 |
| 640 / 768 | eşit | 256 |
| 1280 | eşit | 256 |

Tur 1: 375 px'te `915 / 360` → **555 px** hayalet kaydırma ve sağa kaydırınca boş ekran. Artık
yedi genişliğin yedisinde `scrollWidth === clientWidth`; `<select>`'ler `truncate` ile kırpılıyor
("mission-c…", "F-012 — CEO s…"), tam metin dropdown açılınca görünüyor.
Kanıt: `docs/qa/screens/F-010-2026-09-10-tur2-01-375px.png`

### 4.4 Mock DOĞRU yapılandırmayı mı ölçüyor?

Evet — üç yönlü doğrulandı (tur 1'in 1. bulgusu tam da çitin yanlış yapılandırmayı ölçmesiydi):
1. `MC_CHAT_ENABLED` bu depoda **derleme anı sabiti değil, çalışma zamanı bilgisidir**
   (`vite.config.ts`'in `define`'ı F-012/Y2'de kaldırıldı; `App.tsx:44` sekme kümesini
   `chat.status?.chat_enabled`'dan kuruyor). Dolayısıyla `page.route` ile
   `GET /api/chat/status` → `chat_enabled:true` sahtelemesi **gerçek üretim sekme kümesini**
   üretir.
2. Test bunu kendi içinde çitliyor: `expect(page.locator('header [role="tab"]')).toHaveCount(5)`
   ve beş id'yi tek tek ölçüyor (`tab-timeline/kanban/chat/gates/thread`).
3. **Bağımsız kontrol:** mock hiç kullanmadan, `MC_CHAT_ENABLED=1` ile ayağa kalkan gerçek üretim
   sunucusunda (7391) aynı beş sekmeyi kendim ölçtüm (§4.1) — sayılar test iddiasıyla tutarlı
   (320: 19.2 > 0; 375/480: 43.2 > 0). Mock ile gerçek sunucu **aynı DOM'u** veriyor.

Not: E2E eşiği hâlâ `> 0` (tur 1'in önerdiği `>= 24` değil). Bu turda kabul ediyorum çünkü
**üretim yapılandırması ölçülüyor** ve ölçülen değerler (19.2 / 43.2 / 43.2) eşiğin çok
üzerinde; eşik gevşekliği D11 olarak kaydedildi.

---

## 5. X4 — M7/M8 artık KIRMIZI, klavye testi gerçekten `Tab` kullanıyor

`tests/e2e/thread.spec.ts:254` — `page.keyboard.press('Tab')` döngüsü +
`document.activeElement?.getAttribute('data-testid') === 'thread-screen'`; ikinci döngü
`<summary>`'ye kadar devam ediyor. **`locator.focus()` hiç kullanılmıyor** (tur 1/F-013 dersi).

- **M7** (`tabIndex={0}` silindi) → birim testleri **YEŞİL kaldı (111/111)**, ama
  **E2E KIRMIZI**: `thread.spec.ts:254` düştü (8 passed / 1 failed). Tur 1'de bu mutasyon
  1210/1210 yeşildi.
- **M8** (`title={tooltip}` silindi) → **KIRMIZI** (`ThreadScreen.test.tsx`, okunamayan bölüm
  testi). Tur 1'de 1210/1210 yeşildi.

---

## 6. X5 / X6 — kronoloji ve bozuk satır uyarısı

### 6.1 X5 — gerçek verilerle kronoloji artık **monoton**

Dört gerçek feature, üretim sunucusu 7391, gerçek `mtime`'lar (yerel saat):

| Feature | `docs/qa` bölümlerinin görünen sırası | Monoton? |
|---|---|---|
| F-008 | 02:04 → 02:14 → 02:37 → 04:37 → **04:51 (Developer raporu)** → 05:31 | ✓ |
| F-009 | 09:28 → 10:23 → **10:39 (Developer raporu)** → 11:03 | ✓ |
| F-012 | 04:15 → 05:08 → 05:28 → **05:29 (Developer raporu)** → 06:38 → 07:59 → 08:34 → 10:00 → 11:37 → 12:23 | ✓ |
| F-014 | 15:27 → 17:53 → **20:11 (Developer raporu)** → 20:40 | ✓ |

Zaman damgası **hiçbir yerde geriye gitmiyor**. Tur 1'in çekirdek şikâyeti (F-012'de sözleşme
dosyası üç `-contract-review-*.md`'den **sonra** yazılmışken onların **önünde** listeleniyordu)
tam olarak kapandı: Developer raporu artık 05:28 ile 06:38 arasında, gerçek yerinde.

**Dokuz QA kararı ayırt edilebiliyor mu:** evet. F-012'nin on `docs/qa` bölümünün her biri artık
kaynak dosya adını taşıyor — `QA kararı · F-012-contract-review-1.md`,
`· F-012-kod-turu-A-notlari.md`, `QA kararı: KALDI · F-012-2026-09-06-tur3.md` … Tur 1'de beşi
tıpatıp aynı görünüyordu (`QA kararı · <saat>`).

- **MX5** (kronolojik sıralama silinip eski rol-sabit sıra geri getirilir) → **KIRMIZI**
  (X5/Ö5 testi: "sözleşme QA raporlarından SONRA güncellenirse, developer raporu ilgili QA
  kararlarından SONRA görünür").
- **MX6** (bonus, Ö6 çiti: başlıktan `· ${report.file}` kaldırılır) → **KIRMIZI** (2 test).

CEO brief hâlâ **her zaman ilk sırada** ve kendi `mtime`'ı sonraki bölümlerden büyük olabiliyor
(ör. F-008: 05:31 → 02:04). Bu **bilinçli ve belgeli**: AC1 yalnızca `docs/qa/*` bölümlerini
kapsıyor, CEO brief `docs/features/*` kaynaklı ayrı bir kategori ve `docs/03-ux.md:233` bunu
açıkça yazıyor ("CEO brief … her zaman İLK sırada"). Tur 1'in Ö5 önerisi ("ya AC1 metni ya
gösterim düzeltilsin") **her ikisiyle** karşılanmış.

### 6.2 X6 — bozuk satır uyarısı kullanıcıya görünüyor

7392, `d.jsonl` = 5 satır, 2'si bozuk. `readable: true` (bölüm düşürülmüyor), içerik:

> Bu proje için en son görülen oturumda 1.507 giriş, 303 çıkış token ölçüldü. Belirli bir QA
> turuna bağlı değildir (best-effort zenginleştirme). **⚠ Bu oturumun 2 satırı ayrıştırılamadı
> (toplam 5 satırdan 3 okunabildi) — veri eksik olabilir.**

`docs/03-ux.md:245-247` şablonu: *"⚠ Bu oturumun N satırı ayrıştırılamadı (toplam M satırdan K
okunabildi) — veri eksik olabilir."* → **birebir aynı**. Sunucu logu da korunmuş
(`Uyarı: transkriptin 2 satırı ayrıştırılamadı (…)`), `/api/health.transcript_reader` =
`{files_seen:1, lines_ok:3, lines_bad:2}` (tutarlı). Tur 1'de kullanıcı dosyanın %40'ının
okunamadığını hiçbir yerden göremiyordu.

---

## 7. Mutasyon tablosu

Hepsi tek tek uygulandı → koşuldu → **elle** geri alındı. Her geri almadan sonra
`git diff --name-only` **boş**. Tur sonunda
`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` yalnızca **önceden var olan meşru
test adlarını** buluyor (20 eşleşme, hepsi `tests/` altında; `src/`'de sıfır) —
`tests/server/write-gate-manifest.test.ts:124` dâhil, dokunulmadı.

| # | Mutasyon | Dosya | Sonuç |
|---|---|---|---|
| MX1 | X1 `try/catch` **tamamen kaldırıldı** | `thread-detail.ts:142-147` | **KIRMIZI** (2 test: birim + gerçek HTTP dağıtıcı) |
| MX1b | X1 düzeltmesini **birebir geri sarar** (`catch (err) { throw err }`) | aynı | **KIRMIZI** (aynı 2 test) |
| MX2 | X2 başlık bloğu kısıtı kaldırıldı (tüm belge taranır) | `thread-detail.ts:62` | **KIRMIZI** (X2/Ö4 negatif testi) |
| MX2b | X2 ikinci katmanı: çapalar + `m` bayrağı kaldırıldı (tur 1'in M11'i) | `thread-detail.ts:63` | **KIRMIZI** (tur 1'de YEŞİL'di) |
| M7 | `tabIndex={0}` kaldırıldı | `ThreadScreen.tsx:71` | **KIRMIZI (E2E)** — birim 111/111 yeşil, `thread.spec.ts:254` düştü (tur 1'de YEŞİL'di) |
| M8 | `title={tooltip}` kaldırıldı | `ThreadSectionCard.tsx:43` | **KIRMIZI** (tur 1'de YEŞİL'di) |
| MX5 | Kronolojik sıralama → eski rol-sabit sıra | `thread-detail.ts:283-288` | **KIRMIZI** (X5/Ö5 testi) |
| MX6 | Bölüm başlığından dosya adı çıkarıldı (Ö6) | `thread-detail.ts:271` | **KIRMIZI** (2 test) |

Brief'in istediği **beş** bağımsız mutasyonun (X1 catch · X2 başlık bloğu · M7 · M8 · X5
sıralama) beşi de KIRMIZI; ayrıca **üç** ek mutasyon (birebir geri sarma, ikinci savunma katmanı,
Ö6 çiti) da KIRMIZI. Tur 1'de yeşil kalan **dört** mutasyonun (M7/M8/M10/M11) hepsi artık kırmızı
— M10'un yerini X6/Ö1 düzeltmesi ve MX-serisi aldı (`lines_ok === 0` dalı ve `degraded` dalı
birlikte `thread-detail.test.ts`'te çitli; MX6/MX5 aynı dosyanın testlerini kırıyor).

---

## 8. Test sayıları (kendi koşumlarım, **normal** yapılandırma)

`--no-file-parallelism` **kullanmadım** — developer'ın kullandığı bayrağın gizlediği bir
kararsızlık var mı diye normal koştum.

| Koşu | Sonuç |
|---|---|
| `npm run verify` #1 | **KIRMIZI** — `Worker exited unexpectedly with exit code 3221226505` (`tests/integration/send-event-hook.test.ts`) |
| `npm run verify` #2 (tekrar) | **0** — 79 dosya geçti / 1 atlandı, **1216 passed / 4 skipped (1220)** |
| `npm run verify` #3 (tur sonu) | **0** — aynı sayılar |
| `npx playwright test` #1 | **KIRMIZI** — `kanban.spec.ts:261` (AC4 çakışma banner'ı `Kapat` sonrası kapanmıyor), 44 passed |
| `npx playwright test` yalnızca `kanban.spec.ts` | **13/13 geçti** |
| `npx playwright test` #2 | **45/45** |
| `npx playwright test` #3 (tur sonu) | **45/45** |

**Kararsızlık notu (gizlenmiyor):** `CLAUDE.md`'de kayıtlı Vitest worker fork çökmesi
(`3221226505`) bu turda **beşinci kez** görüldü — bir koşuda kırmızı, tekrarında yeşil, kod
regresyonu değil. Ayrıca **yeni bir kararsızlık** gözlendi: `kanban.spec.ts:261` (F-007'nin
çakışma banner'ı) bir tam koşuda kırmızı, tek başına ve sonraki iki tam koşuda yeşil. F-010'un
dosyalarıyla ilgisi yok, ama **kayda geçsin** — bu, deponun ikinci kararsız test ailesi olabilir.
Developer'ın `--no-file-parallelism` tercihi meşru bir azaltım, fakat normal koşuda da sayılar
aynı (1216/4).

---

## 9. Notlar (bu turda açılan/taşınan)

- **D8 — başlık bloğu bu depoda 45 satıra kadar uzayabiliyor (X2'nin doğal sınırı).**
  `extractHeaderBlock` "ilk `---`'e kadar" diyor; 54 gerçek `docs/qa/*.md` taradım: başlık bloğu
  uzunlukları 0, 3, 5, 12, 13, 14, 15, 17, 20, 21, 24 ve **45** satır. Frontmatter'ı olmayan ve
  ilk `---`'i bir yatay çizgi olarak ilerideki bir satırda taşıyan bir raporda, sütun 0'daki
  alıntılanmış bir `ESKALE: true` hâlâ rozeti tetikler (sonda H → `true`). **Bugün hiçbir gerçek
  dosyada böyle bir satır yok** ve bu, tur 1'in kendi önerdiği iki seçenekten birinin
  (`ilk frontmatter'dan önceki başlık bloğu`) doğal sonucu. Bloklayıcı değil. Daraltma yolu:
  `min(ilk ---, ilk 5 satır)`.
- **D9 — ters yön: frontmatter ilk satırdaysa başlık bloğu boş kalır ve gerçek ESKALE kaçırılır**
  (sonda I → `false`). Rapor şablonu ilk iki satırı `KARAR:`/`ESKALE:` olarak zorunlu kıldığı ve
  `docs/03-ux.md` bu kapsamı yazdığı için bugün tetiklenmiyor; yine de AC4'ün **yanlış negatif**
  kenarıdır.
- **D10 — 640-767 px bandında Kapılar ve Thread 0 px, 280 px'te Thread 0 px.** `sm:` üstünde
  hiçbir sınıf değişmediği için bu tur 1'den taşınan durumdur (regresyon değil), fakat 640 px
  gerçek bir VS Code Simple Browser genişliği. Kapatma yolu: `sm:` üstünde de daralan bir sekme
  şeridi (veya kısaltılmış etiket).
- **D11 — E2E dar-genişlik eşiği hâlâ `> 0`.** Artık **doğru yapılandırmayı** ölçüyor (bu asıl
  sorundu), ama 1 piksellik bir kıymık da testi yeşil bırakır. `>= 16` gibi bir eşik ucuz bir
  sıkılaştırma olurdu.
- **D12 — Ö7 (feature listesi hatasında önceki projenin listesi kalıyor) bu turun kapsamı
  DIŞINDA bırakıldı** ve **hâlâ açık**: `useProjectFeatureList.ts:41-43` `catch` yalnızca
  `setLoadState('error')` yapıyor, `features` temizlenmiyor, `ThreadScreen` `error` durumunu
  render etmiyor, `retry` hâlâ hiçbir yerden çağrılmıyor (ölü API). Bir sonraki feature'a
  taşınmalı.
- **D13 — D3 (bayat yorum) hâlâ duruyor:** `transcript-reader.ts:346-349` hâlâ "bu turda hiçbir
  üretim kodu `.record()`'u ÇAĞIRMIYOR … `/api/health.transcript_reader` bu turda dürüstçe sıfır
  kalır" diyor; F-010 bunu değiştirdi (canlı ölçüm: `{files_seen:1, lines_ok:3, lines_bad:2}`).
  Kapsam dışı, ama yanlış.
- **D14 — Yetim süreç: 0.** Bu tur üç üretim sunucusu başlattı (7391/7392/7393), her biri
  `npx → tsx → node` üçlüsü = **9 süreç**; üçü de ağaç olarak sonlandırıldı, üç portun üçü de
  `HTTP=000`, `mission-control` yolunu içeren **hiç** `node.exe` kalmadı.
  `C:\dev\apps\hayat-mentoru` süreçlerine **dokunulmadı** (o yolda zaten 0 süreç vardı).
- **D15 — Depo temiz.** `git status --porcelain` boş; yalnızca `docs/qa/screens/*.png` kanıtları
  ve bu rapor eklendi. Gerçek transkript içeriği depoya **bırakılmadı**; sandbox `latest.md`
  orijinal içerik + `mtime` ile geri yüklendi; `icacls /deny` kaldırıldı.

---

## 10. Puanlama

| Boyut | Puan | Gerekçe |
|---|---|---|
| **İşlevsellik** | **9**/10 | Bloklayıcı canlı olarak kapandı (500 → 200, 0 bölüm → 4 bölüm), kalıcı arıza altında tekrar edilebilir; yanlış ESKALE rozeti gerçek dosyayla kayboldu, gerçek pozitif korundu; kronoloji dört gerçek feature'ın 24 bölümünde monoton. Eksik: Ö7 (kapsam dışı bırakıldı) hâlâ açık. |
| **Özellik bütünlüğü** | **8**/10 | AC2'nin "bir satır ayrıştırılamazsa" dalı artık hem sunucuda hem arayüzde var (metin UX ile birebir); AC1 gerçek zaman damgasına dayanıyor; AC4 iki katmanlı. Eksik: D8/D9 kenarları belgelenmemiş, `>= 24` eşiği alınmamış. |
| **Görsel/UX** | **8**/10 | 320'de 19.2 px (onaylı 13 px emsalinin üstünde), 360-639 tam görünür, 555 px hayalet kaydırma yedi genişlikte sıfırlandı, `<select>`'ler kırpılıyor, bozuk satır uyarısı görünür. Eksik: 280 px ve 640-767 px bandı (taşınan, regresyon değil). |
| **Kod kalitesi** | **9**/10 | Sekiz mutasyonun sekizi KIRMIZI — birebir geri sarma ve ikinci savunma katmanı dâhil; X1 çiti hem birim hem **gerçek HTTP** seviyesinde; klavye çiti `locator.focus()` tuzağından kaçınıp gerçek `Tab` kullanıyor; E2E mock'u üretim sekme kümesini ölçüyor ve bunu kendi içinde `toHaveCount(5)` ile çitliyor. Eksik: E2E eşiği `> 0`, `docs/blockers.md` N6 hâlâ Kanban tarafında açık. |

**Dört boyutun dördü de ≥ 7 → KARAR: GEÇTİ.**

---

## 11. Bir sonraki feature'a taşınan borçlar

1. **D12/Ö7** — feature listesi hatasında listeyi temizle + hata satırı göster, `retry`'ı bağla
   (ölü API).
2. **D10** — 640-767 px bandında sekme şeridi iki sekme düşürüyor.
3. **D8/D9** — ESKALE başlık bloğunun iki kenarı (uzun başlık bloğu / frontmatter-ilk).
4. **D11** — E2E dar-genişlik eşiğini `>= 16`'ya çek.
5. **D13** — `transcript-reader.ts:346-349` bayat yorumu.
6. **N6** — `kanban.spec.ts`'in `scrollBox.focus()` çiti hâlâ açık (Thread tarafı kapandı,
   kapatma yolunun artık bu depoda kanıtlanmış bir örneği var).
7. **Kararsızlık** — `kanban.spec.ts:261` (AC4 çakışma banner'ı) bu turda bir kez kararsız
   davrandı; Vitest worker fork çökmesi beşinci kez görüldü.
