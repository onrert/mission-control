---
type: qa-contract
date: 2026-09-11
status: done
karar: GEÇTİ — negatif sonuç kabul edildi (docs/qa/borc-turlari-kararlari-2026-09-14.md). Kök neden bulunamadı ama ölçüm titiz bulundu ve "yönetilen risk" kararı savunulabilir sayıldı. QA'nın bağımsız örneklemi: 5 tam koşu → 1 kırmızı (%20), saf Sınıf A, test kapısı doğru şekilde kırmızı verdi. QA G6 kuralını sıkılaştırdı: yayın kanıtı için ardışık **üç** tam yeşil koşu, kırmızıda sayaç sıfırlanır.
karar: kısmi sonuç — kök neden bulunamadı, denenen hiçbir yapılandırma (maxWorkers 8/1, pool:'threads') kırmızı oranını güvenilir şekilde düşürmedi; `vitest.config.ts` değiştirilmedi (orijinaline geri alındı). `pool:'threads'` ikinci turda ÖLÇÜLDÜ (n=10): kırmızı oranını %25'ten %100'e çıkardı ve Sınıf A çökmesini iki yeni, biri daha az teşhis edilebilir (sessiz süreç ölümü) sorunla değiştirdi — orijinal a priori red gerekçesi (env sızıntısı) ayrıca ölçüldü ve YANLIŞ çıktı (sızma yok), ama bağımsız bir sebeple red hâlâ geçerli. Çit (`scripts/verify-test-run.mjs`) zaten her çökmeyi doğru şekilde kırmızıya çeviriyor — B-4'ün riski "sessiz atlama" değil, "gerçek ama sık tekrarlayan, ürün kodundan bağımsız kırmızı". **Turu 3 (bkz. §6):** alt-süreç-doğurma hipotezi ölçüldü ve Sınıf A/varsayılan yapılandırma için DOĞRULANMADI (8 çöken dosyanın yalnızca 1'i alt süreç başlatıyor, şansla ayırt edilemez); manipülasyon/düzeltme denenmedi, `vitest.config.ts` bu turda hiç dokunulmadı.
---

# Sözleşme — B-4: `npm run test` worker-fork kararsızlığı (altyapı turu, yeni feature değil)

**Kaynak:** `docs/blockers.md` "2026-09-11 — CEO — G5 kapanışı: taşınan eşikli borçlar" → B-4.
**Neden var (tek cümle):** G6 (yayın) kapısının dayanağı "testler yeşil" iddiası olacak; bugün bu
iddia koşuların önemli bir kısmında ürün-kodu hatası olmadan kırmızı veriyor — bu, "testler yeşil"
ifadesinin G6'da tek koşuyla kanıt sayılmasını engelliyor.

**Dosya sahipliği:** `vitest.config.ts` (denendi, SONUÇTA değiştirilmedi — bkz. §3), bu sözleşme
dosyası. `src/**` (ürün kodu) ve mevcut test dosyalarının içeriği **değişmedi**.

## 1. Ölçülmüş teşhis — dört ayrı ölçüm turu, toplam 44 `npm run test` koşusu

### 1a. Temel bulgu: İKİ FARKLI, BİRBİRİNDEN BAĞIMSIZ kırmızı sınıfı var

Ölçüm boyunca gözlemlenen her kırmızının tam olarak ikiden birine ait olduğu doğrulandı:

- **Sınıf A — worker-fork çökmesi (B-4'ün asıl konusu).** Çıktıda her zaman `[vitest-pool]:
  Worker forks emitted error` + `exit code 3221226505` (Windows STATUS_ACCESS_VIOLATION ailesi).
  **Asla bir assert hatası değil.** `scripts/verify-test-run.mjs` bunu doğru şekilde yakalayıp
  "N dosya sessizce eksik" diyerek KIRMIZI veriyor — çit çalışıyor, sessiz atlama YOK.
- **Sınıf B — `ENOTEMPTY` temp-dizin yarışı (B-4'ün kapsamı DIŞINDA, zaten bilinen ayrı bir
  flake — `CLAUDE.md`, `tests/helpers/temp-data-dir.ts:14`).** Gerçek bir **assert kırmızısı**:
  `fs.rmSync(dir, { recursive: true, force: true })` bazen Windows'ta hâlâ yazılmakta olan bir
  dizini siliyor. Bu turda 44 koşuda **2 kez** görüldü (`tests/server/write-gate.test.ts` içinde,
  iki farklı test — biri de aslında bir T5/40-40 kapsam testiydi, spesifik teste bağlı değil,
  aynı yardımcı fonksiyonun genel bir yarış durumu).

### 1b. Ölçüm turları (kronolojik, hepsi bu oturumda, yerelde)

| Tur | Yapılandırma | n | Kırmızı | Sınıf A | Sınıf B | Not |
|---|---|---|---|---|---|---|
| 1 | varsayılan (değişiklik yok) | 10 | 4 (%40) | 3 | 1 | **temiz** — hiçbir eşzamanlı iş yok |
| 2 | `poolOptions.forks.maxForks: 8` | 30 | 4 (%13) | 3 | 1 | **GEÇERSİZ** — bkz. §1c, ayar hiç uygulanmadı |
| 3 | `poolOptions.forks.maxForks: 4` | 10 | 2 (%20) | 2 | 0 | **GEÇERSİZ**, aynı sebep |
| 4 | `poolOptions.forks.singleFork: true` | 10 | 4 (%40) | 3 | 1 | **GEÇERSİZ**, aynı sebep |
| 5 | `maxWorkers: 8` (düzeltilmiş, GERÇEKTEN uygulanan API) | 10 | 4 (%40) | 4 | 0 | **temiz** |
| 6 | `maxWorkers: 1` (tam sıralı) | 4 (10 hedeflendi, kesildi) | 4 (%100) | 4 | 0 | **temiz**, ama bkz. §1d (maliyet) |
| 7 | varsayılan (geri alındı, final) | 10 | 1 (%10) | 1 | 0 | **temiz** |

**Varsayılan yapılandırmanın birleşik temiz örneklemi (tur 1 + tur 7): n=20, kırmızı=5 (%25)** —
Sınıf A %20, Sınıf B %5. Turlar arası oran (%40 → %10) tek başına büyük varyans gösteriyor; bu,
~%20-25 gerçek oranlı bir Bernoulli sürecinde 10'luk örneklemlerin doğal geniş güven aralığıyla
tutarlı — "iyileşme" gibi görünüp görünmediğini yorumlarken bu varyansı hesaba katmak gerekiyor.

### 1c. Kendi kendine yakalanan hata: `poolOptions.forks` vitest 5'te YOK

Tur 2-4'te kullanılan `test.poolOptions.forks.{maxForks,singleFork}` şekli **vitest 4 ve öncesi
API'si** — vitest 5.0.0 (bu depoda pinned, `package-lock.json`) bunu **top-level `maxWorkers`**
(`number | string`) ve `fileParallelism` (`false` → `maxWorkers` zorunlu `1`) ile değiştirmiş;
eski `poolOptions` anahtarı `InlineConfig` tipinde artık **tanımlı değil**. Bu obje sessizce
`defineConfig`'e geçti (TypeScript'in `--noEmit` çalıştırılmadığı sürece fark edilmez) ve vitest
muhtemelen bilinmeyen alanı yok sayıp **varsayılan davranışa devam etti** — yani tur 2-4'ün
ölçtüğü şey aslında hep varsayılan yapılandırmaydı. **Bunu `npx tsc --noEmit` yakaladı** (tur 5
öncesi, kod yazmadan önce çalıştırılan zorunlu tip kontrolünde) — tam da brief'in "önce ölç"
disiplini ve bu depronun "sözleşmede mekanizmaya dayanmadan önce VAR olduğunu doğrula" dersinin
bir örneği. Düzeltildikten sonra (tur 5, gerçek `maxWorkers`) ölçüm tekrarlandı.

### 1d. Yoğunlaşma analizi — SONUÇ: RASTGELE, hiçbir dosyaya/yapılandırmaya YOĞUNLAŞMIYOR

44 koşu boyunca Sınıf A çöken dosyalar: `features-api`, `gates-api` (×3, farklı turlarda),
`sse-stream` (×2), `send-event-hook`, `health.test.ts`, `adr-013-write-header.test.ts`,
`projects-api`, `events-api`. Sekiz farklı dosya, ortak bir özellik dışında (çoğu gerçek
`http.createServer` kuruyor, ama `health.test.ts` gibi biri kurmuyor bile) belirgin bir kalıp
yok. **Tek bir kusurlu test yok** — "belirli testi izole et/düzelt" seçeneği bu yüzden
uygulanamaz. `maxWorkers` sınırlamasının (8 ya da 1) kırmızı oranını **güvenilir şekilde
DÜŞÜRMEDİĞİ**, `maxWorkers: 1`'in ise (n=4, temiz, hiçbir eşzamanlı iş yokken) **daha da kötü**
göründüğü (%100) ölçüldü — bu, "eşzamanlı fork sayısı/kaynak baskısı kök nedendir" hipotezini
**çürütüyor**. `maxWorkers: 1` ayrıca koşu başına ~3 dk 20 sn'ye çıkıyor (varsayılanın ~10 katı)
— bu maliyetle 10 tam koşu (~33 dk) bu turun bütçesini aşacağından **4 koşuda kesildi**; kesilen
örneklem küçük ama yön zaten diğer bulgularla tutarlı (iyileşme yok).

**Ek dolaylı bulgu (kayda değer, ders):** Bu turda `maxWorkers: 1` arka planda 10 koşu
tamamlarken paralelde `npx tsc/eslint/playwright` çalıştırıldığında `npm run e2e` **8/55 test**
başarısız oldu (bağlantı/zaman aşımı hataları). Aynı e2e suite'i hiçbir eşzamanlı iş yokken
tekrar çalıştırılınca **55/55 yeşil**. Bu, B-4'ün kendisiyle **ilgisiz** ama onu doğrulayan bir
kanıt: bu makine yoğun eşzamanlı süreç yüküne genel olarak hassas; B-4'ün "arka planda başka bir
şey çalışırken ölç" riskini bizzat tekrarladık ve doğru şekilde izole ederek düzelttik.

## 2. Seçenekler ve gerekçeli seçim

| Seçenek | Ölçülen sonuç | Karar |
|---|---|---|
| `pool: 'threads'` | **ÖLÇÜLDÜ (bkz. §5).** n=10 ardışık koşu: **10/10 kırmızı (%100)** — varsayılanın (n=20 birleşik) %25'inden belirgin biçimde KÖTÜ. İzolasyon endişesi (env sızıntısı) ayrıca doğrudan ölçüldü ve **sızmadığı** kanıtlandı — orijinal red gerekçesi (a priori varsayım) bu noktada YANLIŞTI. Ama threads yine de bağımsız, daha ciddi bir sebeple (alt süreç zaman aşımı + sessiz çökme) reddedildi. | **REDDEDİLDİ (artık ÖLÇÜLMÜŞ gerekçeyle)** — `vitest.config.ts` denendi, `git diff` boş olacak şekilde elle geri alındı |
| `isolate: false` | Ölçülmedi, aynı gerekçe | **REDDEDİLDİ** (a priori) |
| Belirli bir testi izole etmek/düzeltmek | §1d'nin yoğunlaşma analizi bunu desteklemiyor (8 farklı, ilgisiz dosya) | **UYGULANAMAZ** — ölçüm reddetti |
| `maxWorkers` düşürme (8 ya da 1) | **ÖLÇÜLDÜ, gerçek API ile.** 8: n=10, %40 kırmızı (varsayılanın n=20 birleşik %25'inden daha KÖTÜ). 1: n=4, %100 kırmızı, ~10× yavaş. | **DENENDİ, İŞE YARAMADI** — geri alındı |
| Yapılandırmaya dokunmamak | Varsayılan, n=20 birleşik, %25 kırmızı — hiçbir alternatif bundan iyi çıkmadı | **SEÇİLDİ (sonuç: değişiklik yok)** |

**Sonuç:** `vitest.config.ts` **değiştirilmedi** — orijinal haliyle bırakıldı (`git diff
vitest.config.ts` bu sözleşmenin sonunda boş). Denenen hiçbir yapılandırma kırmızı oranını
güvenilir biçimde düşürmedi; biri (tam sıralı) açıkça kötüleştirdi. Kök neden Node/vitest/Windows
etkileşiminde kalıyor gibi görünüyor (bilinen `STATUS_ACCESS_VIOLATION` ailesi,
`docs/qa/test-skip-gate-contract.md`'de zaten kayıtlı) ve bu depronun kontrol edebileceği bir
yapılandırma değişikliğiyle **kanıtlanabilir şekilde düzeltilemedi**.

## 3. Ölçülebilir kabul kriteri — DÜRÜSTLÜK ŞARTI UYGULANDI (brief madde 4)

**"buldum" DEMİYORUM.** Kök neden bulunamadı. Aşağıdakiler ölçülen, dürüst sonuçlar:

1. Varsayılan yapılandırmada (değişiklik yapılmadı) temiz koşullarda ölçülen kırmızı oranı:
   **n=20 birleşik, %25** (Sınıf A worker-fork çökmesi %20, Sınıf B ENOTEMPTY %5, ikisi de
   ürün-kodu hatası DEĞİL, ikisi de test kapısı tarafından doğru raporlanıyor).
2. Denenen iki alternatif yapılandırma (`maxWorkers: 8`, `maxWorkers: 1`) bu oranı **düşürmedi**;
   biri **kötüleştirdi**. Bu nedenle hiçbiri uygulanmadı.
3. `npm run e2e` = 55/55 (izole koşuda; eşzamanlı ağır işle çalıştırıldığında kirlenebileceği bu
   turda ayrıca gösterildi — bkz. §1d).
4. `npx tsc --noEmit` = 0, `npx eslint .` = 0, `node .claude/hooks/_selftest.cjs` = 165/165.
5. Test kapısının (`scripts/verify-test-run.mjs`) hâlâ çalıştığı mutasyonla doğrulandı:
   `vitest.config.ts`'e geçici olarak `tests/server/health.test.ts` `exclude`'a eklendi → `npm
   run test` KIRMIZI (`tests/verify-test-run.test.ts`'in `vitest.config.ts` içerik-eşitliği
   testi tetiklendi). Elle geri alındı (`git checkout` KULLANILMADI), `md5sum` başlangıç
   değeriyle birebir eşleşti, `git diff vitest.config.ts` boş.
6. **Kalan risk, eşikle:** B-4 kapanmadı. G6 öncesi "testler yeşil" iddiası tek bir `npm run
   test` koşusuyla kanıtlanamaz — CEO'nun `CLAUDE.md`'de zaten kayıtlı "kırmızı görünce bir kez
   daha koştur, ikisi de kırmızıysa gerçek hata" kuralı, ölçülen ~%20-25 taban oranıyla hâlâ
   **tek başına yetersiz** (iki ardışık koşunun ikisi de Sınıf A çarpması ~%4-6 ihtimalle olur,
   nadir ama sıfır değil). **Öneri (CEO/qa-evaluator kararı):** G6 kapısı için "testler yeşil"
   iddiası tek koşu yerine **N ardışık yeşil koşu** (ör. 3) şartına bağlanabilir, ya da mevcut
   çit zaten kırmızıyı doğru ayırt ettiği için (Sınıf A/B ikisi de ürün-kodu değil) G6 değer­len­
   dirmesi kırmızı bir koşuyu görürse **otomatik olarak bir kez daha** koşup ikinci sonucu esas
   alabilir. Bu karar bu sözleşmenin kapsamı dışında (yalnızca ölçüm ve yapılandırma denemesi
   yetkim vardı) — qa-evaluator'a bırakılıyor.

## 4. Kapsam dışı bırakılan, ayrı not edilen bulgu

**Sınıf B (`ENOTEMPTY`, `tests/helpers/temp-data-dir.ts:14`)** bu sözleşmenin konusu değil —
zaten `CLAUDE.md`'de bağımsız bir flake olarak kayıtlı. Bu turda 44 koşuda 2 kez daha gözlendi
(sıklık tahmini: ~%5). Düzeltme önerisi (uygulanmadı, kapsam dışı): `removeTempDataDir`'e kısa bir
retry/backoff eklemek (`fs.rmSync` ENOTEMPTY'de birkaç kez tekrar dener) — bu, `tests/helpers/**`
dosyasına dokunmayı gerektirir, B-4'ün dosya sahipliği dışında.

## 5. Threads ölçümü — B-4 turu 2 (a priori reddi ölçüme çevirme)

**Görev:** §2 tablosundaki `pool: 'threads'` satırı önceki turda **ölçülmeden** reddedilmişti
(gerekçe: risk varsayımı). Bu tur onu ölçtü. Sonuç: **hâlâ reddedildi, ama artık ölçülmüş
gerekçeyle** — ve red gerekçesi orijinal varsayımdan **farklı** çıktı.

### 5a. Kırmızı oranı — n=10 ardışık `npm run test` koşusu, `vitest.config.ts`'e yalnızca
`pool: 'threads'` eklenmiş hâliyle (başka hiçbir ayar değişmedi)

| Koşu | Sonuç | Başarısız test sayısı | Süre |
|---|---|---|---|
| 1 | KIRMIZI | özet satırı YOK (tamamen sessiz çökme, bkz. 5b) | 12s |
| 2 | KIRMIZI | 3 | 19s |
| 3 | KIRMIZI | 4 | 19s |
| 4 | KIRMIZI | 2 | 19s |
| 5 | KIRMIZI | 2 | 17s |
| 6 | KIRMIZI | 3 | 19s |
| 7 | KIRMIZI | 2 | 18s |
| 8 | KIRMIZI | 3 | 18s |
| 9 | KIRMIZI | 4 | 20s |
| 10 | KIRMIZI | 3 | 18s |

**Kırmızı oranı: 10/10 (%100)** — varsayılanın (§1b, n=20 birleşik) %25'inden **belirgin biçimde
KÖTÜ**. Bu, herhangi bir örneklem varyansıyla açıklanamayacak kadar büyük bir fark (Bernoulli
%25 gerçek oranla n=10'da hepsinin kırmızı gelmesi ~%0.00001 ihtimalli — yani gerçek oran %25
DEĞİL, çok daha yüksek).

### 5b. Başarısızlık türü tamamen FARKLI — bu, ayrı ve daha ciddi bir sorun

Baseline'ın Sınıf A'sı (`Worker forks emitted error` / `exit 3221226505`) **hiçbir threads
koşusunda görülmedi.** Bunun yerine iki yeni, ilgisiz başarısızlık sınıfı ortaya çıktı:

- **Yeni Sınıf C — `Error: Test timed out in 5000ms`, alt-süreç başlatan testlerde
  yoğunlaşıyor.** 10 koşunun **hepsinde** en az bir kez, çoğunda 2-4 kez: `tests/scripts/
  check-ports.test.ts`, `tests/scripts/install-hook.test.ts`, `tests/integration/
  send-event-hook.test.ts`, `tests/integration/chat-hooks-live.test.ts` — dördü de testin
  içinde `execSync`/`spawn` ile gerçek bir Node alt süreci başlatıp bekliyor (`runScript`,
  `runInstall`, `runHookDirect`, hook script'i çalıştırma). Bu, Sınıf A'nın rastgele
  dağılımından (8 ilgisiz dosya) FARKLI: burada **tekrarlayan, tutarlı bir aile** var — alt
  süreç başlatan testler threads pool'unda güvenilir biçimde zaman aşımına uğruyor. Muhtemel
  mekanizma: `worker_threads` içinden `child_process` başlatmanın/beklemenin event-loop veya
  handle davranışı, `child_process` fork'larından farklı ve burada engelleniyor gibi görünüyor
  — kesin kök neden bu turun kapsamı dışında (yalnızca ölçüm yetkim var), ama örüntü net.
- **Yeni Sınıf D — tam sessiz süreç çökmesi, Sınıf A'dan bile KÖTÜ.** Koşu 1'de ve ayrıca
  `--sequence.shuffle` koşu 2'de (§5d) vitest **hiçbir özet satırı, hiçbir hata mesajı
  yazmadan** çıktı verdi (`RUN v5.0.0 ...` başlığından sonra yalnızca testlerin kendi
  `console.error` çıktıları var, sonra çıktı aniden kesiliyor). Sınıf A en azından `[vitest-pool]:
  Worker forks emitted error` diagnostiği basıyordu; burada o bile yok. `scripts/
  verify-test-run.mjs` yine de bunu doğru şekilde yakalayıp KIRMIZI verdi ("Test Files" özeti
  bulunamadı) — çit burada da sessiz atlamaya İZİN VERMEDİ, ama debug edilebilirlik Sınıf A'dan
  daha kötü.

**Sonuç:** threads pool, B-4'ün asıl derdini (Sınıf A) çözmüyor — onu tamamen farklı, en az bir
tanesi (Sınıf D) daha az teşhis edilebilir iki yeni sorunla DEĞİŞTİRİYOR, ve toplam kırmızı oranı
%25'ten %100'e çıkıyor.

### 5c. İzolasyon iddiası doğrudan ölçüldü — orijinal red gerekçesi YANLIŞ çıktı

Önceki turun reddi şu varsayıma dayanıyordu: "`tests/setup/chat-disabled-by-default.ts` gibi
süreç-geneli `process.env` mutasyonu yapan setup dosyaları threads'te dosyalar arasına sızabilir."
Bu doğrudan ölçüldü:

- İki geçici test dosyası yazıldı (`tests/tmp-env-leak-writer.test.ts`,
  `tests/tmp-env-leak-reader.test.ts`): writer `process.env.TMP_ENV_LEAK_PROBE` set ediyor,
  reader aynı değişkeni okuyup `undefined` olduğunu assert ediyor. **4 ayrı koşuda (`npx vitest
  run` ile, threads pool'la) reader HER SEFERİNDE `undefined` gördü — sızma YOK.** Bu, brief'in
  öne sürdüğü teoriyle tutarlı: Node'un `worker_threads`'i `SHARE_ENV` açıkça verilmedikçe her
  worker'a kendi `process.env` kopyasını veriyor; ayrıca vitest'in varsayılan `isolate: true`
  davranışı (çıktıda görülen "86 workers spawned" — dosya başına bir worker) bunu ayrıca
  güvence altına alıyor. **Geçici dosyalar tur sonunda silindi, `git status --short` temiz.**
- `--sequence.shuffle` ile **3 ayrı koşu** yapıldı (tam suite, `tests/e2e/**` ve geçici
  env-leak dosyaları hariç): sonuçlar KIRMIZI/KIRMIZI(sessiz, Sınıf D)/KIRMIZI, hep aynı
  Sınıf C aile üyeleri (alt-süreç zaman aşımı) + bir kez Sınıf D. Sıra karıştırıldığında
  **farklı bir örüntü ortaya çıkmadı** — bu, kirlenmenin sıraya/önceki dosyalara bağlı
  olmadığını, doğrudan threads+child_process etkileşiminden kaynaklandığını destekliyor.
- Süreç-geneli durum kullanan diğer yerler tarandı (`process.env` ataması, `process.chdir`,
  `vi.stubGlobal`, `globalThis` mutasyonu): `tests/setup/chat-disabled-by-default.ts` (idempotent,
  yalnızca tanımsızsa set ediyor), `tests/integration/{chat-api,thread-api,usage-api}.test.ts` ve
  `tests/electron/chat-enabled.test.ts` (hepsi kendi `beforeEach`/`try-finally`'inde önceki
  değeri kaydedip geri yüklüyor), `tests/features/projects/web/useProjects.test.ts`
  (`vi.stubGlobal`, dosya-yerel). Hiçbiri "geri yüklemeyen, sessizce sızan" bir mutasyon
  değil — orijinal riskin somut bir örneği bulunamadı.

**Yani: orijinal red gerekçesi (env sızıntısı) YANLIŞTI — ölçüldü, sızma yok. Ama bu, threads'i
kabul edilebilir yapmıyor; §5a/§5b'deki bağımsız ve çok daha büyük kırmızı-oranı artışı tek
başına reddetmeye yetiyor.**

### 5d. Karar

`pool: 'threads'` **REDDEDİLDİ** — artık a priori değil, ölçülmüş gerekçeyle: kırmızı oranını
%25'ten %100'e çıkarıyor ve mevcut Sınıf A'yı, biri daha az teşhis edilebilir (Sınıf D) iki yeni
sorunla değiştiriyor. `vitest.config.ts` denendi (yalnızca `pool: 'threads'` satırı eklendi),
ölçüldü, elle geri alındı — `git diff vitest.config.ts` bu turun sonunda **boş**. Doğrulama:
`npx tsc --noEmit` = 0, `npx eslint .` = 0, `node .claude/hooks/_selftest.cjs` = 165/165 (değişiklik
bırakılmadığı için `npm run e2e` bu turda ayrıca koşulmadı — brief madde 4/§bitti tanımı bunu yalnızca
değişiklik bırakılırsa istiyor). Tur boyunca ve sonunda `tasklist`'te `node.exe` sayısı 0 (yetim
süreç yok).

**Değişmeyen sonuç:** B-4 hâlâ kapanmadı, kök neden hâlâ bulunamadı, `vitest.config.ts` hâlâ
varsayılan haliyle. Bu turun katkısı yalnızca: bir seçeneği a priori reddetmekten ölçülmüş
reddetmeye taşımak, ve bu süreçte orijinal riskin (env sızıntısı) gerçek olmadığını ama daha
büyük, farklı bir riskin (alt-süreç zaman aşımı + sessiz çökme) gerçek olduğunu göstermek.

## 6. Alt süreç hipotezi — B-4 turu 3

**Hipotez (H):** Sınıf A (fork'ta çökme) ve Sınıf C (threads'te zaman aşımı, §5b) arızalarının
ortak paydası testlerin gerçek bir Node alt süreci başlatması. H doğruysa Sınıf A'nın çöktüğü 8
dosyanın çoğu alt süreç başlatan testler kümesiyle örtüşmeli.

### 6a. Alt süreç başlatan test dosyalarının numaralandırılması

`tests/**/*.test.ts?(x)` (vitest'in gerçekten dahil ettiği küme, `tests/e2e/**` hariç) içinde
`execFileSync`/`execSync`/`spawnSync`/`spawn`/`fork`/`child_process` için doğrudan ve dolaylı
(yardımcı modül üzerinden) tarama yapıldı. Toplam dosya sayısı: **86** (contract §5c'deki "86
workers spawned" ile tutarlı, doğrulandı: `find tests -type f \( -name "*.test.ts" -o -name
"*.test.tsx" \) | grep -v "^tests/e2e/" | wc -l` → 86).

Gerçekten çalışma zamanında bir Node alt süreci **başlatan** (bir fixture string'i içinde geçen
değil — bkz. aşağıdaki negatif bulgu) test dosyaları, **7 dosya**:

| # | Dosya | Mekanizma |
|---|---|---|
| 1 | `tests/verify-test-run.test.ts` | `spawnSync(process.execPath, [gateScript], ...)` — gate script'i ve (ayrı bir testte) `npm run test`'i alt süreç olarak çalıştırır |
| 2 | `tests/integration/chat-hooks-live.test.ts` | `spawnSync(process.execPath, [BLOCK_DANGEROUS_HOOK], ...)` |
| 3 | `tests/build-css.test.ts` | `execFileSync(...)` ×4 — tailwind build'i alt süreçte çalıştırır |
| 4 | `tests/features/usage/server/usage-aggregator.test.ts` | `execFileSync('icacls', ...)` ×2 — Windows ACL testi |
| 5 | `tests/scripts/check-ports.test.ts` | `execFileSync('node', [scriptPath], ...)` |
| 6 | `tests/scripts/install-hook.test.ts` | `execFileSync('node', [scriptPath, ...], ...)` ×3 |
| 7 | `tests/integration/send-event-hook.test.ts` | dolaylı — `tests/helpers/emit-hook.ts` üzerinden `spawn('node', [scriptPath], ...)` |

**Negatif bulgu (önemli):** `tests/features/usage/server/network-capability-guard.test.ts` grep'te
`execFileSync` string'i içeriyor ama **çalışma zamanında hiçbir alt süreç başlatmıyor** — bu
string bir geçici fixture dosyasına yazılıp `scanModuleGraph` ile statik olarak ayrıştırılıyor
(kaynak metin taraması, çalıştırma değil). Bu dosya listeye **dahil edilmedi**. `tests/e2e/
timeline.spec.ts` da alt süreç başlatıyor ama `vitest.config.ts`'in `exclude`'unda (Playwright
suite'i, `npm run test` kapsamı dışı) — sayıma dahil değil.

**Oran:** 7/86 ≈ **%8.1** dosya çalışma zamanında gerçek bir alt süreç başlatıyor.

### 6b. Sınıf A'nın 8 çöken dosyasıyla kesişim

Contract §1d'deki 8 kısa ad tam dosya yoluna çözüldü ve her birinin importları (doğrudan ve
`tests/helpers/**` üzerinden dolaylı) tek tek kontrol edildi:

| Sınıf A dosyası | Alt süreç başlatıyor mu? | Kullandığı helper'lar |
|---|---|---|
| `tests/integration/features-api.test.ts` | HAYIR | `temp-data-dir` (subprocess yok) |
| `tests/integration/gates-api.test.ts` | HAYIR | `temp-data-dir`, `sse-client` (ikisi de subprocess yok) |
| `tests/integration/sse-stream.test.ts` | HAYIR | `temp-data-dir`, `sse-client` |
| `tests/integration/send-event-hook.test.ts` | **EVET** | `emit-hook` (spawn) |
| `tests/server/health.test.ts` | HAYIR | `temp-data-dir` |
| `tests/server/adr-013-write-header.test.ts` | HAYIR | `temp-data-dir` |
| `tests/integration/projects-api.test.ts` | HAYIR | `temp-data-dir`, `sse-client` |
| `tests/integration/events-api.test.ts` | HAYIR | `temp-data-dir` |

`tests/helpers/temp-data-dir.ts` ve `tests/helpers/sse-client.ts` içinde `child_process`/`spawn`/
`exec` grep'i **sıfır sonuç** verdi — doğrudan doğrulandı, varsayım değil.

**Kesişim: 8 dosyanın yalnızca 1'i (`send-event-hook.test.ts`) alt süreç başlatıyor.**

Şansla beklenen kesişim (hipergeometrik, N=86, K=7 alt-süreç-başlatan, n=8 çeken dosya):
beklenen değer = 8 × 7/86 ≈ **0.65**; P(en az 1 örtüşme) ≈ %51, P(tam 1 örtüşme) rastgele
dağılımla tamamen tutarlı. Gözlenen 1 örtüşme, 0.65 beklenenden **anlamlı derecede yüksek
değil** — saf şansla ayırt edilemiyor.

**Karşılaştırma (bilgi amaçlı, brief'te istenmedi ama örüntüyü netleştiriyor):** Aynı 7 alt-süreç
dosyasının **4'ü** — `check-ports`, `install-hook`, `send-event-hook`, `chat-hooks-live` —
contract §5b'de `pool:'threads'` altında Sınıf C (zaman aşımı) ile **tam örtüşüyor**. Yani alt
süreç başlatma, **threads pool'undaki zaman aşımı ailesini** güçlü biçimde açıklıyor ama
**varsayılan fork pool'undaki Sınıf A çökmesini** açıklamıyor. İki arıza biçimi göründüğünden
daha bağımsız: threads'in Sınıf C'si gerçekten "alt süreç doğurma" ile ilişkili, fork'un Sınıf
A'sı değil.

### 6c. Karar — H DOĞRULANMADI (Sınıf A / varsayılan yapılandırma için), dur

Brief §3.1 karar noktası: "kesişim zayıfsa (ör. 8'in 2-3'ü) H doğrulanmadı → §4'e geç, yeni
araştırma açma." Gözlenen kesişim (8'in **1**'i, hipergeometrik şansla ayırt edilemez) bu
eşiğin altında. **H, B-4'ün asıl konusu olan Sınıf A / varsayılan (fork) yapılandırma için
doğrulanmadı.**

Brief §4 gereği: **§3.2 (dahil-et/hariç-tut manipülasyonu) ve §3.3 (hedefli düzeltme) bu turda
çalıştırılmadı.** Zayıf korelasyonda manipülasyon denemek "ölçmeden reddetmek"in tersi ama aynı
kalitede bir hata olurdu — negatif bir korelasyonu zorlamak. Sonuç ölçülmüş bilgi olarak
kaydedildi, yeni yapılandırma denemesi yapılmadı.

**Not (kapsam dışı, ayrı bir tur için aday, bu turda kovalanmadı):** `pool:'threads'` zaten
§5'te bağımsız gerekçeyle reddedildiği için, "alt süreç testlerini threads altında zaman
aşımından koru" fikri B-4'ü kapatmaz — mevcut varsayılan (fork) yapılandırmanın Sınıf A
çökmesiyle hâlâ hiçbir doğrulanmış nedensel bağı yok. Kök neden, önceki turların vardığı sonuçla
tutarlı biçimde hâlâ Node/vitest/Windows fork etkileşiminde, bu depronun ölçülebildiği bir
test-dosyası özelliğine (alt süreç kullanımı dahil) bağlanamadı.

### 6d. Doğrulama ve hijyen

- `git status --short` bu turun sonunda: temiz (hiçbir dosya değiştirilmedi — yalnızca bu
  sözleşme dosyası güncellendi).
- `git diff vitest.config.ts`: boş (bu turda hiç dokunulmadı).
- `npx tsc --noEmit` = 0 hata.
- `npx eslint .` = 0 hata.
- `node .claude/hooks/_selftest.cjs` = **165/165**.
- `tasklist | findstr node.exe`: tur öncesi ve sonrası **0 satır** (yetim süreç yok). Bu turda
  hiçbir `npm run test` koşusu yapılmadı (karar noktasında durulduğu için §3.2/§3.3'ün
  gerektirdiği koşular tetiklenmedi).

**Tek cümlelik sonuç:** Alt-süreç hipotezi (H) **doğrulanmadı** — Sınıf A çöken 8 dosyanın
yalnızca 1'i alt süreç başlatıyor (şansla ayırt edilemez, beklenen 0.65); düzeltme denenmedi
(gerek kalmadı) ve B-4 **kapanmadı**, yönetilen risk olarak (mevcut çit doğru KIRMIZI veriyor,
kök neden hâlâ bulunamadı) kayıtlı kalmaya devam ediyor.
