KARAR: GEÇTİ
ESKALE: false

# QA — vitest sessiz test atlama çiti · DÜZELTME TURU (tur 2)

- **Tarih:** 2026-09-10
- **Kapsam:** DAR. Yalnızca 1. turun bulguları (B1, B2, Ö1-Ö4) + brief'in iki ek kontrolü
  (yeni kaçış yolları, DD3 genelliği). 1. turda GEÇTİ verilen konular (M4 pozitif kontrolü,
  yanlış pozitif yokluğu, kök nedenin açık kalması) **yeniden ölçülmedi**.
- **Konu:** `scripts/verify-test-run.mjs` · `tests/verify-test-run.test.ts` (48 test) ·
  `tests/fixtures/fake-vitest-*.mjs` · `package.json` · `docs/qa/test-skip-gate-contract.md` §0/2b/2c/3b/7b
- **Karar:** **GEÇTİ** — B1 ve B2 kapandı ve **ikisi de mutasyonla çitli**; Ö1-Ö4 düzeldi;
  varsayılan yol (`npm run test`), betik yolu (`npm run verify`) ve CI yolu sessiz kayba karşı
  kapalı. Kalan tek delik (Ö5) yalnızca elle yazılmış bayraklı çağrılarda açık ve `verify`/CI'a
  taşınamıyor (B2 çiti onu da kırmızı yapıyor).
- **Puanlar:** İşlevsellik **8**/10 · Özellik bütünlüğü **8**/10 · Görsel/UX (CLI/DX) **8**/10 ·
  Kod kalitesi **8**/10 → hepsi ≥ 7 → GEÇTİ.

---

## 1. Sayılar (kendim koşturdum)

| Komut | Çıkış | Sonuç |
|---|---|---|
| `npm run test` (temiz) | **0** | `Test Files 85 passed \| 1 skipped (86)` · `Tests 1354 passed \| 4 skipped (1358)` · 18.85s |
| `npm run verify` (1. koşu) | 1 | **ilgisiz Windows yarışı**: `history-log.test.ts:22` `afterEach` → `ENOTEMPTY` temp dizin silinemedi (çit değil, ürün testi flakisi) |
| `npm run verify` (2. koşu) | 1 | **gerçek worker çökmesi** (`3221226505`, `chat-api.test.ts`) — kapı 3 sinyalle KIRMIZI, doğru davranış |
| `npm run verify` (3. koşu) | **0** | `85 passed \| 1 skipped (86)` · **1354 passed \| 4 skipped (1358)** · `✓ built in 1.19s` |
| `npm run e2e` | **0** | **55 passed (44.4s)** |

Developer'ın iddia ettiği **1354/4/1358**, **85+1/86**, `e2e` **55** rakamları **doğrulandı**.
`verify`'ın iki kırmızısı da çitle ilgisiz (biri bilinen `3221226505` sınıfı, biri temp-dizin
yarışı) — `CLAUDE.md`'nin "kırmızı görünce bir kez daha koştur" kuralı uygulandı, üçüncü koşu temiz.

**Bonus canlı pozitif kontrol:** bu turda **iki** gerçek worker çökmesi daha gözlendi
(rename sondasında ve `verify` 2. koşuda). İkisinde de kapının **üç sinyali de** tetiklendi
(`crash signature` + `Test Files 85/86` + `Tests 1350/1358`). Kapı sentetik değil, canlı çalışıyor.

---

## 2. B1 — KAPANDI (bu turun ana işi)

### 2a. 1. turun kendi kaçış komutları, birebir tekrar

```
npm run test -- --exclude "tests/e2e/**" --exclude "node_modules/**" \
                --exclude "tests/integration/chat-api.test.ts"
→ EXIT=1
[verify-test-run] KIRMIZI -- silent test-skip guard tripped:
  - "Test Files" total reported by vitest (85) does not match the number of test files on disk
    matching vitest.config.ts's include/exclude patterns (86) -- a file may have been silently
    dropped from the run (e.g. an undeclared --exclude flag)
```

```
npm run test -- --exclude "tests/e2e/**" --exclude "node_modules/**" \
                --exclude "tests/features/**" --exclude "tests/integration/**"
→ EXIT=1 · Test Files 34 (86 bekleniyordu) · KIRMIZI
```

1. turda **ikisi de EXIT=0**'dı (16 test ve 685 test sessizce kayboluyordu). **İkisi de artık kırmızı.**

### 2b. Yeni kaçış yolları (kapı artık `vitest.config.ts`'i ayrıştırıyor)

| Saldırı | Gerçek komut/sonda | Kapı | Değerlendirme |
|---|---|---|---|
| `--exclude` (tek dosya / 52 dosya) | gerçek koşu | **KIRMIZI** | B1 kapalı |
| `--shard=1/2`, `--changed`, `--testNamePattern=...` (eşitli biçim) | sonda | **kontroller aktif** → dosya sayısı uyuşmazsa KIRMIZI | fail-closed |
| **`-t "..."` / `--testNamePattern "..."` (boşluklu biçim)** | `npm run test -- -t "parses a healthy"` → `Test Files 75 skipped (75)` · `Tests 1215 skipped (1215)` · **EXIT=0, kapıdan tek satır yok** | **SESSİZ** | **Ö5** |
| `--dir tests/features`, `--shard 1/2`, `--pool forks`, `--maxWorkers 4`, `--retry 2`, `--reporter junit --outputFile r.xml` | sonda: hepsi `hasExplicitPositionalFilter = true` | **kontroller KAPANIYOR** | **Ö5** |
| **Bayrak değeriyle B1'i yeniden açma** | `npm run test -- --maxWorkers 4 --exclude "tests/features/**" --exclude "tests/integration/**"` → `Test Files 34 (34)` · `Tests 673 (673)` · **EXIT=0** | **SESSİZ** | **Ö5 — 685 test sessizce düştü** |
| Dosyayı diskte yeniden adlandır (`install-hook.test.ts` → `.qabak`) | gerçek koşu: disk 85, rapor 85 → dosya-sayısı kontrolü **şikâyet etmedi** (koşu ilgisiz gerçek çökme yüzünden kırmızı oldu) | **SESSİZ** (dosya-sayısı katmanı açısından) | tasarım gereği: iki taraf birlikte düşer, ama `git diff`'te görünür |
| Toplu `it.skip`/`describe.skip` | sonda: `Tests 60 passed \| 1298 skipped (1358)`, dosya 86 → `ok:true` | **SESSİZ** | tasarım gereği (kasıtlı skip meşru), kaynak diff'inde görünür |
| `vitest.config.ts` biçimini değiştirme — `include` değişkene alınmış / spread / koşullu | sonda (`computeExpectedFileCount`) | **THROW → fail-CLOSED** (`could not determine the expected test-file count`) | developer'ın kendi bildirdiği sınır **güvenli yönde** |
| `exclude` değişkene alınmış / `include`'a `src/**` eklenmiş | sonda | disk sayısı ≠ rapor → **KIRMIZI** | fail-closed |
| Yorum satırında sahte `include:` (regex ilk eşleşmeyi alır) | sonda: yorumdaki dar desen kazanıyor (3 yerine 2) | çoğu durumda **yanlış KIRMIZI** (fail-closed); yalnızca tesadüfî eşitlikte sessiz | nit |

**Kritik `-t` sorusuna cevap:** dış referans yalnızca **dosya** sayısını karşılaştırıyor, **test**
sayısını değil. Ama `-t` senaryosunda kapı zaten dosya sayısını da göremiyor, çünkü
`hasExplicitPositionalFilter(['-t','parses a healthy'])` **true** dönüyor (bkz. Ö5) ve **tüm**
kapsam kontrolleri kapanıyor. `-t` verilmeseydi bile `Test Files 75 ≠ 86` yakalanırdı.

---

## 3. B2 — KAPANDI ve talep edilenden geniş

`tests/verify-test-run.test.ts` son describe'ı `package.json`'ı okuyup
`scripts.test === 'node scripts/verify-test-run.mjs'` (**tam eşitlik**) ve
`scripts.verify.split('&&')` içinde `npm run test` olduğunu doğruluyor.

| Bypass denemesi | Sonuç |
|---|---|
| `"test": "vitest run"` (1. turun M5'i) | **KIRMIZI** — `expected 'vitest run' to be 'node scripts/verify-test-run.mjs'` |
| `verify` zincirine bayrak sızdırma: `npm run test -- --maxWorkers 4` | **KIRMIZI** — `expected [...] to include 'npm run test'` |
| `test` betiğine bayrak ekleme (tam eşitlik) | KIRMIZI (aynı iddia) |
| `pretest`/`posttest` ile atlama | mümkün değil — kapı `test`'in kendisi |

Bu ikinci satır önemli: **Ö5'in kaçış mekanizması `verify`/CI'a taşınamıyor**; taşımaya kalkan
her değişiklik B2 çitine takılıyor. CI (`.github/workflows/ci.yml:19`) argümansız
`npm run verify` çağırıyor — doğrulandı.

---

## 4. DD3 — genel regex gerçekten genel mi

Uydurma (listede olmayan) çökme metinleri:

| Sonda | Yakalandı mı |
|---|---|
| `vitest worker pool #3 died while collecting tests (signal SIGABRT)` | **EVET** (`worker pool #3 died`) |
| `child process was killed by the operating system before finishing` | **EVET** |
| `tinypool: a worker thread encountered an access violation...` | **EVET** |
| `the test runner pool blew up spectacularly` (worker/tinypool sözcüğü yok) | hayır |
| `Segmentation fault in worker 3` (fiil isimden ÖNCE) | hayır |
| worker ↔ fiil arası 120 karakter (80 sınırı) | hayır |

**Değerlendirme:** desen gerçekten bilinmeyen biçimleri yakalıyor (3/6), kaçırdıkları
ters sıralı/uzak/isimsiz biçimler. Bu **ikincil** katman olduğu ve birincil savunma disk
karşılaştırması olduğu için kabul edilebilir — sözleşme §3 bunu açıkça böyle konumlandırıyor.

**Yanlış pozitif:** desen, çökme fiili içeren **test adlarına** takılıyor —
`✓ ... > worker terminated cleanly on shutdown` ve `✓ web worker crashed banner renders...`
sondalarında KIRMIZI verdi. **Ama:** (a) bu depoda `worker`+çökme fiili içeren tek bir test adı
yok (`grep -rniE "worker[^\"']{0,40}(crash|terminat|kill|died)" src/ tests/` → yalnızca
`verify-test-run.test.ts`'in kendi assert'leri), (b) vitest varsayılan reporter'ı geçen test
adlarını basmıyor, (c) 4 temiz tam koşuda (`test` ×2, `verify` ×1 yeşil, `FORCE_COLOR` ×1)
hiçbir yanlış pozitif görülmedi. Ölçülen yanlış pozitif oranı: **0**. Yön fail-closed.
Kayıt amaçlı not: `verify-test-run.test.ts` kırmızı verirse assert diff'i imza dizelerini
stdout'a basar ve ikinci bir "crash signature" satırı üretir (koşu zaten kırmızı, zararsız).

---

## 5. Ö2 / Ö3 / Ö4

| # | Kontrol | Sonuç |
|---|---|---|
| Ö2 | `FORCE_COLOR=3 npm run test` | **EXIT=0** · `85 passed \| 1 skipped (86)` · `1354 passed \| 4 skipped (1358)` — yanlış pozitif **gitti** (ANSI temizleme `stripAnsi` + 3 birim testi) |
| Ö3 | `npm run test -- tests/verify-test-run.test.ts` | **EXIT=0** · `Tests 48 passed (48)` — sahte kırmızı **gitti** |
| Ö4 | bayat sayılar | `verify-test-run.mjs:69` ve sözleşme **1327/86**'ya güncellenmiş; bugün suite **1358** test → yorum **yine 31 test bayat**. Ama bu yorumun tek işlevi "500 tabanı çok altta" gerekçesi ve o gerekçe değişmiyor; `countDeclaredTestFiles` testi sabit sayı kullanmayacak şekilde yazılmış (doğru karar). **Nit, bulgu değil.** |

---

## 6. Mutasyon turu (5 mutasyon — elle uygulandı, elle geri alındı)

`git checkout` **KULLANILMADI**; geri alma scratchpad yedeğinden/ters sed ile yapıldı.
Başlangıç md5'leri: `verify-test-run.mjs bc51cbc775185c77ffcbd7b2b7dc7a62`,
`package.json fecaa86ad6cd6d614c8454848653c78b`, `vitest.config.ts ab454a15132098920354a7791519fa6f`,
`verify-test-run.test.ts 8e7d4345cba31e72cc61d43244ef6875` — **tur sonunda dördü de birebir aynı**.

| # | Mutasyon | Hedef katman | Sonuç |
|---|---|---|---|
| M1 | `:298` → `if (false && testFilesSummary.total !== expectedFileCount)` | **DD1 disk karşılaştırması** | **KIRMIZI 3/48** — birim B1 + fixture B1 + **gerçek-suite kalıcı regresyon testi** |
| M2 | `package.json:17` → `"test": "vitest run"` | **DD2 bağlantı** | **KIRMIZI 1/1** (hedefli koşu) |
| M2b | `verify` → `npm run test -- --maxWorkers 4` | **DD2 bağlantı (bayrak sızdırma)** | **KIRMIZI 1/1** |
| M3 | `GENERIC_WORKER_CRASH_RE` → hiç eşleşmeyen desen | **DD3 genel regex** | **KIRMIZI 2/48** (birim + fixture uçtan uca) |
| M4 | `:392` → `process.exit(exitCode)` | **kapının `exit` çağrısı** | **KIRMIZI 5/48** (tüm uçtan uca fixture testleri) |
| M5 | `hasExplicitPositionalFilter` → `return true` | **Ö3 muafiyet katmanı** | **KIRMIZI 4/48** (2 birim + fixture B1 + gerçek-suite regresyon) |

M1 ve M5'in **gerçek-suite kalıcı regresyon testini** kırmızıya çevirmesi, o testin gerçekten
gerçek `vitest` + gerçek `vitest.config.ts` + gerçek dosya sistemi ölçtüğünün kanıtı
(yeşil görünen ama hiçbir şey ölçmeyen test değil).

**Mutasyon izi taraması (tur sonu):** `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/`
→ yalnızca **önceden var olan meşru test adları** (`gates-manifest.test.ts:222`,
`feature-detail.test.ts` ×6, `thread-read-only-manifest.test.ts:61`,
`transcript-reader.test.ts:124`, `write-gate-manifest.test.ts:124`). `qa_mutation`/`qabak`
kalıntısı **yok**. `git status --porcelain` → yalnızca tur öncesinden gelen dosyalar
(agent-memory ×3, `docs/qa/latest.md`, 1. tur raporu) — **benim bıraktığım hiçbir değişiklik yok**.

---

## 7. Ö5 (YENİ, bloklayıcı DEĞİL) — bayrak değeri "pozisyonel hedef" sanılıyor, kapsam kontrolleri sessizce kapanıyor

**Tekrar üretme:**
```
npm run test -- --maxWorkers 4 --exclude "tests/e2e/**" --exclude "node_modules/**" \
                --exclude "tests/features/**" --exclude "tests/integration/**"
 Test Files  34 passed (34)
      Tests  673 passed (673)
EXIT=0      <-- kapıdan tek satır yok
```
Aynı komut `--maxWorkers 4` **olmadan** KIRMIZI (bkz. §2a). Yani tek bir alakasız bayrak
B1 savunmasını kapatıyor.

**Beklenen:** ya KIRMIZI, ya da en azından "kapsam kontrolleri atlandı" diyen bir satır.
**Gerçek:** hiçbir çıktı yok; kapı sessizce kendini devre dışı bırakıyor.

**Kök neden (`scripts/verify-test-run.mjs:223-245`):** `FLAGS_WITH_VALUE` yalnızca dört bayrak
biliyor (`--exclude`, `--reporter`, `--config`, `-c`). Listede olmayan **her** değer alan bayrağın
değeri "pozisyonel hedef" sayılıyor → `skipScopeChecks = true` → hem disk karşılaştırması hem
`MIN_EXPECTED_TESTS` kapanıyor. Ölçülen: `-t X`, `--testNamePattern X`, `--dir X`, `--shard 1/2`,
`--pool X`, `--maxWorkers N`, `--retry N`, `--bail N`, `--project X`, `--outputFile X`, `--silent true`
→ **hepsi** muafiyet alıyor.

**Neden bloklayıcı saymıyorum (gerekçe açık, CEO isterse tersine çevirebilir):**
1. Varsayılan yol (`npm run test`, argümansız) kapalı — kanıtlandı (§2a).
2. Betik/CI yolu kapalı **ve** bayrak sızdırmaya karşı ayrıca çitli — M2b kanıtı (§3).
   Yani bu delik `verify`/CI'a **taşınamıyor**.
3. Delik ancak bir insanın elle **hem** alakasız bir bayrak **hem** `--exclude` yazmasıyla açılıyor;
   `--exclude` zaten kasıtlı bir dışlama beyanıdır. `-t`/`--dir` gibi gerçekten daraltan
   çağrılarda ise vitest'in kendi özeti (`1215 skipped (1215)`) kaybı zaten ekrana basıyor.
4. Sözleşme §2b'nin Ö3 istisnası ("`-` ile başlamayan bir argüman") **harfiyen** böyle yazılmış;
   uygulama sözleşmeye uyuyor. Kusur sözleşmenin ifadesinde, ve etkisi yukarıdaki 1-3 ile sınırlı.

**Ucuz kapatma (bir sonraki dokunuşta, ~5 satır):** (a) pozisyoneli **yol şekline** bağla
(`/` içeriyor veya `.test.ts(x)` ile bitiyor), ya da `FLAGS_WITH_VALUE` yerine "bilinen
değersiz bayraklar" beyaz listesi kullan; (b) **her muafiyette tek satır bas**:
`[verify-test-run] kapsam kontrolleri atlandı (kasıtlı daraltılmış koşu: <argümanlar>)` —
sessiz muafiyet, `CLAUDE.md`'nin "sessizce ölmüş savunma" sınıfına en yakın kalan yer.

## 8. Ö6 (YENİ, bloklayıcı DEĞİL) — iki ortam değişkeni kapıyı tamamen susturuyor

`MC_TEST_RUN_CMD` (test komutunu tümüyle değiştirir **ve** dosya-sayısı kontrolünü kapatır,
`:343-349`) ve `MC_EXPECTED_TEST_FILE_COUNT` (beklenen sayıyı istenen değere zorlar, `:340-342`).
İkisi de yalnızca test kancası; depoda hiçbir yer bunları ayarlamıyor (grep ile doğrulandı).
Yine de bir güvenlik çitinin ortam değişkeniyle susturulabilmesi kayda değer; sözleşme bunları
"risk" olarak listelemiyor. Öneri: script başında bu değişkenlerden biri set edilmişse
**stderr'e bir uyarı satırı** bas.

---

## 9. Sözleşmeye uyum (yalnızca bu turda genişletilen maddeler)

| Madde | Durum | Kanıt |
|---|---|---|
| §2b disk karşılaştırması (birincil savunma) | ✔ | §2a gerçek komutlar KIRMIZI; M1 kırmızı |
| §2b Ö3 istisnası (pozisyonel argüman) | ✔ uygulanmış, ama **fazla geniş** | Ö5; M5 kırmızı (katman çitli) |
| §2c basit glob/ayrıştırıcı, biçim değişirse elle güncelleme | ✔ **fail-closed** | §2b tablosu (değişken/spread/koşullu → THROW) |
| §3 genelleştirilmiş çökme deseni (ikincil) | ✔ | §4; M3 kırmızı |
| §5b ANSI temizleme (Ö2) | ✔ | `FORCE_COLOR=3` → EXIT 0 |
| §7b bağlantı çiti (B2) | ✔ **talep edilenden geniş** | M2 + M2b kırmızı |
| §3b kalıcı gerçek-suite regresyon testi | ✔ gerçekten gerçek | M1/M5 onu kırmızıya çeviriyor |
| §3b fork bomb koruması (`--exclude` kendi dosyası) | ✔ kodda ve yorumda | tur boyunca süreç sayısı hiç artmadı (§10) |
| §3 regresyon: `verify` + `e2e` yeşil | ✔ | 0 / 0 · 1358 + 55 |

---

## 10. Hijyen

- **Süreç sayımı:** tur başında **2** `node.exe` (PID 4792, 48032 — bu depoya ait değil),
  tur sonunda **aynı 2 süreç, aynı PID'ler**. Yetim süreç **yok**, fork bomb **yok**
  (`electron`/`esbuild` kalıntısı 0). Portlarda yalnızca e2e'den kalan `TIME_WAIT` soketleri;
  `LISTENING` yok. `npm run dev` **çalıştırılmadı**.
- `C:\dev\apps\hayat-mentoru` süreçlerine **dokunulmadı** (hiç görülmedi).
- **Depo durumu:** dört kritik dosyanın md5'i tur öncesiyle birebir aynı; `git status` yalnızca
  tur öncesinden gelen değişiklikleri gösteriyor. Sonda dosyalarının hepsi scratchpad'de
  (`probe-args.mjs`, `probe-config.mjs`, koşu günlükleri) — depoya hiçbir dosya bırakılmadı.
- Altyapı kodu **düzeltilmedi**; yalnızca mutasyon uygulanıp geri alındı. `git push` yapılmadı.
- **Feature notu:** bu iş `docs/features/` altında bir nota sahip değil (altyapı işi; kaydı
  `docs/blockers.md`). `status: done` işaretlenecek not yok. **Öneri (CEO):** blockers.md'deki
  "2026-09-10 — test takımı sessizce test atlıyor" maddesi **KAPANDI** olarak işaretlensin,
  Ö5 + Ö6 yeni ve **düşük öncelikli** bir hardening maddesi olarak açılsın.

## 11. Puanlama gerekçeleri

- **İşlevsellik 8/10** — Hedeflenen arıza biçimini bu turda **iki kez daha canlı** yakaladı;
  1. turun iki kaçış komutu da kapandı; `vitest.config.ts` biçim değişikliklerinde fail-closed.
  Eksik: Ö5 (bayraklı elle çağrılarda sessiz muafiyet). Dosya yeniden adlandırma ve toplu skip
  körlüğü tasarım gereği (diff'te görünür), kabul edilebilir.
- **Özellik bütünlüğü 8/10** — Sözleşmenin yeni 6 maddesinin 6'sı da uygulanmış ve **her biri ayrı
  bir mutasyonla çitli**; B2 talep edilenden geniş çıktı. Eksik: muafiyet anında hiçbir bildirim
  basılmaması, Ö6'nın sözleşmede risk olarak listelenmemesi.
- **Görsel/UX (CLI/DX) 8/10** — Hata çıktısı hâlâ örnek nitelikte (hangi sinyal neden tetiklendi,
  tek tek). Hedefli koşu ve renkli koşu artık sahte kırmızı vermiyor. Eksi: sessiz muafiyet (Ö5b).
- **Kod kalitesi 8/10** — 48 test; uçtan uca testler **gerçek alt süreç**; kalıcı regresyon testi
  **gerçek vitest + gerçek suite** ve mutasyonla kanıtlanmış; genel regex için **ayrı bir yanlış
  pozitif testi** yazılmış; fork bomb tuzağı hem kodda hem yorumda belgelenmiş; tasarım sınırları
  (2c ayrıştırıcısı, kara liste ikincilliği) yorumlarda dürüstçe yazılmış. Eksi: `FLAGS_WITH_VALUE`
  fail-open, iki ortam kill-switch'i, `:69` yorumundaki sayı yine bayat.
