KARAR: KALDI
ESKALE: false

# QA — vitest sessiz test atlama çiti (altyapı)

- **Tarih:** 2026-09-10
- **Konu:** `scripts/verify-test-run.mjs` + `tests/verify-test-run.test.ts` (17 test) + `tests/fixtures/fake-vitest-*.mjs` + `package.json` `test` betiği
- **Kaynak gerçeği:** `docs/blockers.md` "2026-09-10 — YÜKSEK ÖNCELİK: test takımı sessizce test atlıyor" ve "2026-09-09 — KISMEN KAPANDI", `docs/qa/test-skip-gate-contract.md`
- **Karar:** **KALDI** — kapı gerçek çökme biçimini kanıtlanmış şekilde yakalıyor, ama sessiz test kaybının **ikinci ve daha basit biçimini** (bir dosyanın hiç toplanmaması) hiç görmüyor; ayrıca kapının **bağlantı katmanının** kendi pozitif kontrolü yok.
- **Puanlar:** İşlevsellik **5**/10 · Özellik bütünlüğü **5**/10 · Görsel/UX (CLI/DX) **7**/10 · Kod kalitesi **7**/10 → herhangi biri < 7 olduğu için KALDI.

---

## 0. Özet — bu turda kanıtlanan üç şey

1. **Kapı GERÇEKTEN çalışıyor (canlı kanıt).** Bu turun 2. temiz koşusunda gerçek bir worker
   çökmesi oldu (`chat-api.test.ts`, `exit code 3221226505`) ve kapının **üç sinyali de** ayrı
   ayrı tetiklendi. Bu, sentetik fixture değil, gerçek olay.
2. **Kapı yenildi.** Bir test dosyası koşudan tamamen düşürüldüğünde (16 test — bloklayıcının
   raporladığı "10-16 test" aralığının tam ortası) `npm run test` **çıkış kodu 0** dönüyor ve
   kapı **tek kelime etmiyor**. Aynı yolla suite'in **%52'si** (685 test / 52 dosya) sessizce
   kaybolabiliyor.
3. **Kapının bağlantısı çitsiz.** `package.json`'daki `"test"` betiği kapıyı atlayacak şekilde
   değiştirildiğinde suite **1323/1327 yeşil** kalıyor. Çitin kendisi silinebiliyor ve hiçbir
   test bunu fark etmiyor — bu, `CLAUDE.md`'de kayıtlı **özyinelemeli** hata sınıfı (F-011'de
   iki kez).

---

## 1. Sayılar (kendim koşturdum)

| Komut | Çıkış | Sonuç |
|---|---|---|
| `npm run test` (temiz koşu 1) | **0** | `Test Files 85 passed \| 1 skipped (86)` · `Tests 1323 passed \| 4 skipped (1327)` |
| `npm run test` (temiz koşu 2) | **1** | **gerçek worker çökmesi** — aşağıda §2 |
| `npm run verify` (typecheck+lint+test+build) | **0** | `85 passed \| 1 skipped (86)` · **1323 passed \| 4 skipped (1327)**; `✓ built in 1.27s` |
| `npm run e2e` | **0** | **55 passed (44.0s)** |
| `npx vitest run` × 8 (ham, kapısız) | 6×0 / 2×1 | temizlerde her seferinde `1323 passed \| 4 skipped (1327)` |

Developer'ın iddia ettiği rakamlar (**1323/4/1327**, **85+1/86**, `e2e` **55**) **doğrulandı**;
düşük değil.

---

## 2. Canlı pozitif kontrol — kapı gerçek bir çökmeyi yakaladı (OLUMLU)

Temiz koşu 2 (`npm run test`, hiçbir mutasyon yok, hiçbir müdahale yok):

```
Caused by: Error: Worker exited unexpectedly with exit code 3221226505 during started state
while running test file C:/dev/apps/mission-control/tests/integration/chat-api.test.ts

 Test Files  84 passed | 1 skipped (86)
      Tests  1316 passed | 4 skipped (1327)

[verify-test-run] KIRMIZI -- silent test-skip guard tripped:
  - crash signature detected in output: "Worker forks emitted error"
  - "Test Files" summary says 85/86 accounted for -- 1 silently missing
  - "Tests" summary says 1320/1327 accounted for -- 7 silently missing
```

Üç bağımsız sinyalin **üçü de** doğru tetiklendi. Bu, sözleşmenin en önemli iddiasının
(gerçek çökme biçiminde kategori toplamı parantez içindeki toplamla eşleşmez) **gerçek veriyle**
doğrulanması demektir — bu turda gözlediğim **4 gerçek çökmenin 4'ünde de** aritmetik uyuşmazlık
oluştu. Bu iyi bir tasarım kararıdır ve raporda açıkça kredilendirilir.

---

## 3. BLOKLAYICI B1 — "toplam da düşerse" senaryosunda kapı tamamen kör

Brief'in "bu kapının en kritik sorusu" dediği senaryo. **Kapı bu senaryoyu görmüyor.**

### B1a — Gerçek komutla, gerçek suite ile (sentetik değil)

**Tekrar üretme:**
```
npm run test -- --exclude "tests/e2e/**" --exclude "node_modules/**" \
                --exclude "tests/integration/chat-api.test.ts"
```
**Beklenen:** kapı KIRMIZI (16 test hiç koşmadı — bloklayıcının tarif ettiği "10-16 test" aralığı).
**Gerçek:**
```
 Test Files  84 passed | 1 skipped (85)
      Tests  1307 passed | 4 skipped (1311)
EXIT=0            <-- kapıdan tek satır uyarı yok
```
Referans temiz koşu: `86` dosya / `1327` test. Yani **1 dosya + 16 test buharlaştı, `verify`
yeşil.** Kapının tüm sinyalleri sessiz: kategori toplamı (1311) parantez toplamına (1311)
**eşit**, çökme imzası yok, toplam 1311 > `MIN_EXPECTED_TESTS` (500).

### B1b — Ölçek: suite'in yarısından fazlası sessizce kaybolabiliyor

```
npm run test -- --exclude "tests/e2e/**" --exclude "node_modules/**" \
                --exclude "tests/features/**" --exclude "tests/integration/**"
 Test Files  34 passed (34)
      Tests  642 passed (642)
EXIT=0
```
**52 dosya / 685 test (%52) sessizce düştü, `npm run test` = 0.** Tek savunma `MIN_EXPECTED_TESTS
= 500` ve o da bugünkü 1327'nin **%38'i** — pratikte bir savunma değil, bir tabela.

### B1c — Sentetik doğrulama (kapı fonksiyonunun kendisi)

Scratchpad'de bir sahte "vitest" (`Test Files 84 passed | 1 skipped (85)` /
`Tests 1316 passed | 4 skipped (1320)`, exit 0) `MC_TEST_RUN_CMD` ile kapıya verildi →
**GATE EXIT = 0**. Aynı biçim `sum == total` olduğu için `evaluateOutput` hiçbir problem
üretmiyor (`scripts/verify-test-run.mjs:100`).

### Neden bu bloklayıcı

- Bloklayıcının kendi kapatma önerisi **birebir** şuydu: *"koşulan test sayısını **beklenen
  sayıyla** karşılaştıran bir kontrol"*. Uygulanan şey beklenen sayıyla karşılaştırma değil,
  500'lük sabit bir taban.
- Bloklayıcının kendi son cümlesi: *"Bu kapanana kadar 'testler yeşil' ifadesi koşulan test
  sayısıyla birlikte raporlanmalı."* — yani güven çıpası **sayı**. Kapı o çıpayı kurmuyor;
  sayıyı hâlâ insanın gözle karşılaştırması gerekiyor. Bu, kapatılmaya çalışılan sorunun ta
  kendisi.
- Tetikleyici egzotik değil: `vitest.config.ts`'in `include`/`exclude`'una dokunan bir
  değişiklik, bir dosyanın `.test.ts` uzantısını kaybetmesi (ör. `foo.spec.ts`'e yeniden
  adlandırma), yeni bir test dizininin `include` desenine uymaması. Bu depoda `tests/e2e/**`
  zaten `exclude` ediliyor — desen genişletmesi rutin bir iş.
- **Bu deponun `CLAUDE.md`'sinde zaten uygulanmış emsal çözüm var:** *"Çözüm tek satır `@source`
  eklemek değil, `tests/build-css.test.ts`'in dizinleri **dosya sisteminden numaralandırıp**
  her birinin kapsamda olduğunu doğrulaması oldu. … Çiti feature'a değil **yapıya** koy."*
  Aynı desen burada birebir uygulanabilir ve **uygulanmamış**.

**Kapatma yolu (öneri, ~15 satır):** `tests/**/*.test.ts?(x)`'i `readdirSync` ile diskten
numaralandır (`vitest.config.ts`'in `include`/`exclude` desenlerini **dosyadan okuyarak**
uygula), bulunan dosya sayısını kapının okuduğu `Test Files` **toplamıyla** karşılaştır;
eşleşmezse KIRMIZI. Bu kontrol kendi kendini günceller (yeni test dosyası ekleyince iki taraf
birlikte büyür), tıpkı mevcut aritmetik kontrol gibi bakım gerektirmez. Mutasyonla kanıtla:
bir dosyayı `exclude`'a ekleyen mutasyon KIRMIZI vermeli.

**Muhtemel dosya:satır:** `scripts/verify-test-run.mjs:94-114` (`evaluateOutput`'un dosya/test
sayısı kontrolleri), `scripts/verify-test-run.mjs:43` (`MIN_EXPECTED_TESTS`).

---

## 4. BLOKLAYICI B2 — kapının BAĞLANTI katmanının pozitif kontrolü yok

`CLAUDE.md`: *"her yeni katmanın kendi pozitif kontrolü var mı (katman MODÜLÜNÜ mutasyona uğrat)"*.
Kapının **karar** katmanının pozitif kontrolü var (§6 M4 — 7 test KIRMIZI). **Bağlantı**
katmanının yok.

**Mutasyon M5:** `package.json:17` → `"test": "vitest run"` (kapı devreden çıkar).
**Beklenen:** en az bir test KIRMIZI (çitin kaldırıldığını fark eden bir iddia).
**Gerçek:** `npm run test` = **0**, `Test Files 85 passed | 1 skipped (86)`,
`Tests 1323 passed | 4 skipped (1327)` — **1327 testin tamamı yeşil**, hiçbir şey fark etmiyor.

Doğrulama: `grep -rn "verify-test-run" --include=*.ts --include=*.json .` → `package.json`
dışında **hiçbir test** `package.json`'ın `test` betiğini okumuyor. (`tests/server/
write-gate-manifest.test.ts` ve `tests/scripts/install-hook.test.ts` `package.json`'a bakıyor
ama başka alanlar için.)

**Neden bloklayıcı:** Bu, bu deponun **en pahalı hata sınıfı**nın aynısı — hook'lar `.js`
uzantısı yüzünden iki feature boyunca ölü koştu ve kimse fark etmedi. Bir kişinin `package.json`
betiğini "sadeleştirmesi" ya da bir merge çakışması, çiti sessizce öldürür ve kimse anlamaz.
Çitin varlık nedeni tam olarak "sessizce ölmüş savunma"yı önlemek olduğu için bu özyinelemeli
boşluk kabul edilemez.

**Kapatma yolu (~6 satır):** `tests/verify-test-run.test.ts`'e `package.json`'ı okuyup
`scripts.test`'in `scripts/verify-test-run.mjs`'i çağırdığını ve `scripts.verify`'ın
`npm run test`'i zincirlediğini doğrulayan bir iddia ekle. Mutasyonla kanıtla.

**Muhtemel dosya:satır:** `package.json:17`, `package.json:24` (`verify`),
`tests/verify-test-run.test.ts` (eksik iddia).

---

## 5. Kapıyı yenme denemelerinin tam listesi

| # | Saldırı | Sonuç | Değerlendirme |
|---|---|---|---|
| A1 | Gerçek dosyayı koşudan düşür (`--exclude`, 16 test) | **GEÇTİ (kapı kör)** | **B1 — bloklayıcı** |
| A2 | 52 dosya / 685 test düşür | **GEÇTİ (kapı kör)** | **B1 — bloklayıcı** |
| A3 | `package.json`'da kapıyı atla | **GEÇTİ (fark edilmedi)** | **B2 — bloklayıcı** |
| A4 | Listede olmayan çökme imzası + tutarlı sayılar (`Worker terminated due to reaching memory limit`, `ERR_IPC_CHANNEL_CLOSED: Channel closed`), exit 0 | **GEÇTİ (kapı kör)** | Ö1 |
| A5 | ANSI renk kodlu gerçek vitest çıktısı (`FORCE_COLOR=3 npm run test`) | **KIRMIZI (yanlış pozitif)** | Ö2 — yön güvenli (fail-closed) |
| A6 | `--reporter=dot` ile gerçek koşu | **DOĞRU (0, sağlıklı)** | sorun yok |
| A7 | Özet satırı yalnızca **stderr**'e yazılırsa | **KIRMIZI (fail-closed)** | doğru davranış |
| A8 | Hiç özet satırı yok, exit 0 | **KIRMIZI (fail-closed)** | doğru davranış |
| A9 | Alt süreç `process.exit` çağırmadan biterse | **DOĞRU (0, sayılar tutarlı)** | sorun yok |
| A10 | Alt süreç hiç başlatılamazsa (`spawn` hatası) | **KIRMIZI (exit 1)** | doğru — `verify-test-run.mjs:167-170` |
| A11 | Gerçekten kırmızı koşu (vitest exit 1) | **KIRMIZI** | kapı gerçek kırmızıyı maskelemiyor |

### Ö1 — Çökme imzası **kara listesi**, beyaz liste değil
`scripts/verify-test-run.mjs:31-35` sabit üç dize arıyor. Probe:
tutarlı sayılar + `Error: Worker terminated due to reaching memory limit: JS heap out of memory`
+ `ERR_IPC_CHANNEL_CLOSED: Channel closed`, exit 0 → **GATE EXIT = 0**.
Farklı bir vitest sürümü, `tinypool` mesaj değişikliği ya da bellek-limiti kaynaklı ölüm
listeye takılmaz. **Pratik risk düşük** (gözlenen 4 çökmenin 4'ünde de aritmetik katman zaten
tetikleniyor — iki katman bağımsız), ama tek başına bu katmana güvenilmemeli. Bloklayıcı
değil; §3'ün kapatılmasıyla birlikte ele alınmalı.
Not: `'Unhandled Error'` dizesi geniş olduğu için kara listenin en faydalı üyesi — ancak
`tests/verify-test-run.test.ts`'in kendisi kırmızı verirse assert farkı bu dizeyi vitest
stdout'una basar ve kapı ikinci bir "crash signature" satırı üretir (koşu zaten kırmızı olduğu
için zararsız, ama kafa karıştırıcı bir kaskad).

### Ö2 — `FORCE_COLOR` ile sağlıklı koşu KIRMIZI (yanlış pozitif)
```
FORCE_COLOR=3 npm run test   → EXIT=1
[verify-test-run] KIRMIZI: could not find a "Test Files" summary line in vitest output
                            could not find a "Tests" summary line in vitest output
```
Gerçek çıktı sağlıklıydı (`85 passed | 1 skipped (86)`), yalnızca ANSI kaçışları
`SUMMARY_LINE_RE`'nin (`verify-test-run.mjs:45`) sonundaki `\s*$` çıpasını kırıyor:
`^[[90m (86)^[[39m`. **Yön güvenli** (belirsizlik = kırmızı, sözleşme §2 madde 5 böyle
tasarlamış) ve **varsayılan yol etkilenmiyor** (kapı vitest'i pipe ile başlattığı için vitest
renk üretmiyor; CI'da da `FORCE_COLOR` ayarlı değil — `.github/workflows/ci.yml` yalnızca
`npm run verify` çağırıyor). Yine de kalıcı yanlış alarm hâline gelirse `stop-check` gürültüsü
sınıfına girer. **Ucuz düzeltme:** ayrıştırmadan önce satırdaki ANSI kaçışlarını sil
(`line.replace(/\u001b\[[0-9;]*m/g, '')`).

### Ö3 — Hedefli koşuda yanlış kırmızı
`npm run test -- tests/verify-test-run.test.ts` → `Tests 17 passed (17)`, **EXIT=1**
(`only 17 tests were collected, below the expected floor of 500`). Belgelenmiş davranış ama
`npm run test`'in argüman geçirmeyi desteklemesiyle çelişiyor; geliştirici tek dosya koşarken
her seferinde sahte kırmızı görür. **Düzeltme:** `process.argv.slice(2)` boş değilse tabanı
uygulama (ya da `test` betiğinin argüman almadığını belgele).

### Ö4 — Bayat yorum (küçük, ama çitin sayısal iddiası)
`scripts/verify-test-run.mjs:38` — *"Today's suite has 1309 tests across 85 files"*.
Gerçek: **1327 test / 86 dosya**. Aynı bayatlık `docs/qa/test-skip-gate-contract.md:46`'da da
var ("bugünkü 1309 test"). Kapının gerekçesi sayılara dayandığı için bu sayılar taze
tutulmalı.

### N1 — Özet yalnızca `stdout`'tan, çökme imzası her ikisinden
`evaluateOutput(stdout, stderr)` özet satırlarını **yalnızca** `stdout`'ta arıyor
(`verify-test-run.mjs:82`), çökme imzasını ikisinde birden (`:91`). Vitest özeti stdout'a
yazdığı için bugün doğru; biçim değişirse fail-closed. **Kabul edilebilir**, kayıt amaçlı.

---

## 6. Mutasyon turu (6 mutasyon — hepsi elle uygulandı, elle geri alındı)

`git checkout` **kullanılmadı**. Yedek: scratchpad; geri alma sonrası md5 başlangıçla birebir
eşleşti (`59ca8938915e4284c028efdc3007769b` — `scripts/verify-test-run.mjs`,
`fecaa86ad6cd6d614c8454848653c78b` — `package.json`).

| # | Mutasyon | Sonuç | Yorum |
|---|---|---|---|
| M1 | `:100` → `if (false && summary.sum !== summary.total)` | **KIRMIZI 2/17** (`evaluateOutput > silently missing`, uçtan-uca `silent-drop`) | aritmetik katman çitli ✔ |
| M2 | `:92` → `if (false && crash) problems.push(...)` | **KIRMIZI 2/17** (`crash signature` birim + uçtan-uca) | metin katmanı çitli ✔ |
| M3 | `:162` → `process.exit(exitCode)` (kapının kararı yok sayılır) | **KIRMIZI 3/17** (üç uçtan-uca test) | `exit` çağrısı çitli ✔ |
| M4 | `evaluateOutput` başına `return { ok: true, problems: [], summaries: {} }` | **KIRMIZI 7/17** | **kapının kendi pozitif kontrolü VAR** ✔ |
| M5 | `package.json:17` → `"test": "vitest run"` | **YEŞİL 1323/1327** | **çitsiz** ✘ → B2 |
| M6 | (gözlem) `MIN_EXPECTED_TESTS` etkin mi | `Tests 17 passed (17)` → KIRMIZI | taban çalışıyor, ama 500 çok düşük → B1b |

M5 iki kez koşturuldu: ilk koşuda gerçek bir worker çökmesi araya girdi (ham vitest exit 1),
sonuç bu yüzden **tekrar edildi** ve ikinci koşu temiz **exit 0 / 1323 yeşil** verdi.
(`CLAUDE.md` kuralı: kırmızı gördüğünde bir kez daha koştur — burada tersi yönde uygulandı.)

**Mutasyon izi taraması (tur sonu):**
`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca **önceden var olan
meşru test adları** (`write-gate-manifest.test.ts:124` dahil) ve
`tests/verify-test-run.test.ts:138`'deki `// MUTATION TARGET:` yorumu. **Yeni iz yok.**
`git status --porcelain` → **boş**. `git diff --stat` → **boş**.

---

## 7. Yanlış pozitif denetimi (en az iki temiz koşu)

- `npm run test` temiz koşu 1 → **0**, kapı sessiz.
- `npm run verify` → **0**, kapı sessiz.
- `npx vitest run` × 8 → 6 temiz koşunun **hepsi** `1323 passed | 4 skipped (1327)`; bu
  çıktılara karşı kapı fonksiyonu problem üretmiyor (kanıt: temiz `npm run test`/`verify`
  koşuları).
- **Kasıtlı `skip`'ler kapıyı yanıltmıyor:** 4 `skipped` test + 1 `skipped` dosya kategori
  toplamına dahil ediliyor (`85 + 1 = 86`, `1323 + 4 = 1327`) → `sum == total`.
  `CATEGORY_RE` (`:46`) `skipped`/`todo`/`failed`'ı da sayıyor. **Doğru davranış.**
- Tek gerçek yanlış pozitifler: **Ö2** (`FORCE_COLOR`) ve **Ö3** (hedefli koşu). İkisi de
  fail-closed yönünde, ikisi de olağandışı çağrı biçimi gerektiriyor.

---

## 8. Kök nedenin AÇIK kalması kabul edilebilir mi — kararım: **EVET, kabul edilebilir**

**Ölçtüğüm veri (developer'ın 10 koşusundan bağımsız):**
- Bu turda **18+ gerçek vitest koşusu** yapıldı; **4 gerçek worker çökmesi** gözlendi
  (`3221226505`, hepsi `chat-api.test.ts`) — bugünkü çökme oranı ≈ **%25**.
- Kapının devrede olmadığı (ham `npx vitest run` veya M5 mutasyonu ile) **3 çökme
  ölçümünde de vitest kendi kendine `exit 1` verdi.** "Çökme + sessiz exit 0"
  **ben de tekrar üretemedim** — developer'ın dürüst beyanı **doğrulandı**.
- Gözlenen **4 çökmenin 4'ünde de** vitest'in özet satırlarında **aritmetik uyuşmazlık**
  oluştu (`85/86`, `1320/1327` gibi) — yani kapının birincil sinyali gerçek arıza biçimiyle
  **birebir örtüşüyor**.

**Gerekçe (teorik risk ↔ pratik risk ayrımı):**
- **Pratik risk düşük.** Kök neden ("bazen exit 0") bugün ölçülebilir değil; ama kapı vitest'in
  çıkış koduna **hiç güvenmiyor**, iki bağımsız sinyalle karar veriyor ve bunların **ikisi de**
  gerçek arızada tetikleniyor (§2 canlı kanıt). Kök neden yarın kendini gösterse bile kapı
  yakalar. Kök nedeni kovalamak `vitest`/`tinypool`/Windows AV üçgeninde belirsiz süreli bir
  iş; getirisi bu çitin üstüne **sıfıra yakın** ek koruma.
- **Teorik risk açık ve kabul edilebilir.** "Neden bazen exit 0 oluyordu" sorusu
  cevapsız; F-011 QA'sının gördüğü şey ölçüm hatası da olabilir, gerçek bir yarış da.
  `CLAUDE.md` zaten `3221226505`'i **bilinen ayrı bir sınıf** olarak kaydediyor ve bu tur
  onu kapsam dışı bırakmıştı — bu ayrım doğru yapılmış.
- **Bu madde kök neden yüzünden AÇIK kalmamalı; §3/§4 yüzünden açık kalmalı.** Yani
  "KALDI" kararının gerekçesi kök neden **değil**; kapının kendi kapsamındaki iki delik.

**Önerim:** kök neden `docs/blockers.md`'de **ayrı, düşük öncelikli** bir madde olarak
(bugünkü ≈%25 çökme oranı ve "gözlenen tüm çökmelerde exit 1 + aritmetik uyuşmazlık" ölçümüyle
birlikte) kalsın; eşiği: "kapının aritmetik sinyali tetiklenmeden test kaybı gözlenirse
**hemen**".

---

## 9. Sözleşmeye uyum denetimi

| Sözleşme maddesi | Durum |
|---|---|
| §2.1 alt süreç, çıktı hem canlı hem tamponlu | ✔ `verify-test-run.mjs:139-151` |
| §2.2 özet satırı ayrıştırma + toplam karşılaştırma | ✔ (M1 kırmızı) |
| §2.3 çökme imzaları | ✔ (M2 kırmızı) — ama kara liste (Ö1) |
| §2.4 `MIN_EXPECTED_TESTS` alt sınırı | ✔ mevcut, ama **pratikte etkisiz** (B1b) |
| §2.5 özet bulunamazsa fail-closed | ✔ (A7/A8 doğrulandı) |
| §2.6 vitest'in kendi ≠0 kodu korunur | ✔ (A11 doğrulandı, `:162`) |
| §2.7 `package.json` `test` betiği kapıyı çağırır | ✔ mevcut — ama **çitsiz** (B2) |
| §3 birim + uçtan uca (gerçek alt süreç) testler | ✔ 17 test, `spawnSync` ile gerçek süreç |
| §3 mutasyon kanıtı | ✔ 4/4 doğrulandı (M1-M4) |
| §3 regresyon: `verify` + `e2e` yeşil | ✔ 0 / 0, 1327 + 55 |
| §4 kapsam dışı maddelere dokunulmamış | ✔ `src/**` ve mevcut testler değişmemiş |

**Sözleşmenin kendisinde bir boşluk var:** §2.4 tabanı "vitest 0 test topladı" felaket
senaryosuyla gerekçelendiriyor ve **kısmi** toplama kaybını hiç ele almıyor; §3'ün doğrulama
listesinde de "bir dosya hiç toplanmazsa" vakası yok. Bloklayıcının asıl cümlesi ("koşulan test
sayısını beklenen sayıyla karşılaştır") sözleşmeye taşınırken **daraltılmış**. B1 bu daralmanın
sonucu — yani hata developer'ın uygulamasında değil, **kabul edilen sözleşmede**. Düzeltme turu
önce sözleşmeyi genişletmeli.

---

## 10. Puanlama gerekçeleri

- **İşlevsellik 5/10** — Hedeflenen arıza biçimini gerçekten yakalıyor (canlı kanıt, §2) ve
  yanlış pozitif üretmiyor. Ama korumayı **vaat ettiği alanın yarısında** sağlıyor: sessiz test
  kaybının en basit biçimi (dosya hiç toplanmaz) tamamen kör noktada ve suite'in %52'si sessizce
  yok olabiliyor. "Yeşil koşu artık kanıttır" iddiası hâlâ kurulamıyor.
- **Özellik bütünlüğü 5/10** — Sözleşmenin 7 maddesinin 7'si de mevcut, ama biri
  (`MIN_EXPECTED_TESTS`) pratikte işlevsiz ve bloklayıcının kendi kapatma önerisi
  ("beklenen sayıyla karşılaştır") uygulanmamış. Ayrıca çitin bağlantı katmanı çitsiz (B2).
- **Görsel/UX (CLI/DX) 7/10** — Hata çıktısı örnek niteliğinde: hangi sinyalin neden tetiklendiği
  tek tek listeleniyor, kaynak dosya adı mesajın içinde. Vitest çıktısı gizlenmiyor. Kırıntılar:
  `FORCE_COLOR` yanlış alarmı (Ö2) ve hedefli koşuda sahte kırmızı (Ö3).
- **Kod kalitesi 7/10** — Saf fonksiyonlar dışa aktarılmış, uçtan uca testler **gerçek alt süreç**
  kullanıyor (model/mock değil — `CLAUDE.md`'nin "mekanizmayı doğrudan tetikle" kuralına uygun),
  Windows'a özgü tuzaklar (boşluklu `execPath`, `shell:true` alıntılama) yorumlarla belgelenmiş,
  fail-closed varsayılan bilinçli. Kırıntılar: bayat sayılar (Ö4), kara liste imzalar (Ö1),
  özetin yalnızca stdout'tan okunması (N1), bağlantı katmanı için test yokluğu (B2).

---

## 11. Düzeltme turu için görev listesi (öncelik sırasıyla)

1. **B1** — `Test Files` toplamını diskten numaralandırılan test dosyası sayısıyla karşılaştır
   (`vitest.config.ts`'in `include`/`exclude` desenlerini dosyadan okuyarak). Mutasyon: bir
   dosyayı `exclude`'a ekle → KIRMIZI görülmeli.
2. **B2** — `package.json`'ın `test`/`verify` betiklerinin kapıyı çağırdığını doğrulayan test.
   Mutasyon: `"test": "vitest run"` → KIRMIZI görülmeli.
3. **Ö1** — Çökme imzası listesine bellek/IPC biçimlerini ekle (`Worker terminated`,
   `ERR_IPC_CHANNEL_CLOSED`, `heap out of memory`) **ve** listenin kendisinin çitli olduğunu
   (bir imzayı silen mutasyon KIRMIZI) göster.
4. **Ö2** — Ayrıştırmadan önce ANSI kaçışlarını temizle; `FORCE_COLOR=1` ile gerçek koşuda
   yeşil olduğunu ölç.
5. **Ö3** — Argümanlı çağrıda tabanı uygulama (ya da davranışı belgele).
6. **Ö4** — `scripts/verify-test-run.mjs:38` ve `docs/qa/test-skip-gate-contract.md:46`'daki
   sayıları güncelle (1327 test / 86 dosya).
7. **Sözleşme** — §2.4/§3'ü "kısmi toplama kaybı" vakasını kapsayacak şekilde genişlet;
   düzeltme turu bunu **önce** yapsın.
8. **Kök neden** — ayrı, düşük öncelikli blocker maddesi olarak §8'deki ölçümlerle birlikte
   kaydedilsin; bu maddeyi bekletmesin.

---

## 12. Hijyen

- **Yetim süreç:** yok. Tur sonu taraması: bu depoya ait tek `node` süreci taramanın kendisi
  (PID 21324). `C:\dev\apps\hayat-mentoru` süreçlerine **dokunulmadı** (0 süreç görüldü).
  `npm run dev` **hiç çalıştırılmadı**.
- **Depo durumu:** `git status --porcelain` boş, `git diff --stat` boş, md5'ler başlangıçla
  birebir. Sonda/probe dosyalarının **hepsi** scratchpad'de
  (`…\scratchpad\probe-*.mjs`, `drive-gate.mjs`, `proc-scan.mjs`, koşu günlükleri); depoya
  hiçbir dosya bırakılmadı.
- Ürün/altyapı kodu **düzeltilmedi** — yalnızca mutasyonlar uygulanıp geri alındı.
- `git push` yapılmadı.
- **Feature notu durumu:** Bu iş `docs/features/` altında bir feature notuna sahip **değil**
  (altyapı işi; kaydı `docs/blockers.md` "2026-09-09 — KISMEN KAPANDI" maddesinde). Bu yüzden
  `status: fix` işaretlenecek bir not yok; ilgili blocker maddesi **AÇIK** kalmalı ve §11'deki
  görev listesiyle güncellenmeli.
