---
type: qa-contract
date: 2026-09-11
status: qa
---

# Sözleşme — B-4: `npm run test` worker-fork kararsızlığı (altyapı turu, yeni feature değil)

**Kaynak:** `docs/blockers.md` "2026-09-11 — CEO — G5 kapanışı: taşınan eşikli borçlar" → B-4.
**Neden var (tek cümle):** G6 (yayın) kapısının dayanağı "testler yeşil" iddiası olacak; bugün bu
iddia koşuların yalnızca ~%57'sinde doğru, geri kalanında `npm run test` gerçek bir ürün-kodu
hatası olmadan kırmızı veriyor — bu, "testler yeşil" ifadesinin G6'da kanıt sayılmasını engelliyor.

**Dosya sahipliği:** `vitest.config.ts` (değişecek), `docs/blockers.md` B-4 maddesi (CEO günceller),
`docs/progress.md` (CEO günceller), bu sözleşme dosyası. `src/**` (ürün kodu) ve mevcut test
dosyalarının içeriği **değişmiyor** — yalnızca çalıştırma/havuz yapılandırması değişiyor.

## 1. Ölçülmüş teşhis (10 ardışık `npm run test` + 1 ek süreç-sayımı koşusu, bu turda, yerelde)

**Taban ölçüm — mevcut yapılandırma (`pool` belirtilmemiş → vitest 5 varsayılanı `forks`,
`isolate: true`, dosya başına 1 fork):**

| Koşu | Sonuç | Neden |
|---|---|---|
| 1 | KIRMIZI | **Assert kırmızısı** — `tests/server/write-gate.test.ts` → `ENOTEMPTY` (temp dizin temizleme yarışı, `tests/helpers/temp-data-dir.ts:14`, `CLAUDE.md`'de zaten bilinen AYRI ve bağımsız bir flake sınıfı) |
| 2 | KIRMIZI | crash-signature — `Worker forks emitted error` / exit `3221226505`, dosya: `tests/integration/features-api.test.ts` |
| 3 | YEŞİL | — |
| 4 | KIRMIZI | crash-signature — aynı sınıf, dosya: `tests/integration/gates-api.test.ts` |
| 5 | YEŞİL | — |
| 6 | YEŞİL | — |
| 7 | KIRMIZI | crash-signature — aynı sınıf, dosya: `tests/integration/sse-stream.test.ts` |
| 8 | YEŞİL | — |
| 9 | YEŞİL | — |
| 10 | YEŞİL | — |

**Sayım:** 10 koşunun 4'ü kırmızı (**%40**, brief'teki "yedi koşuda üç kırmızı ~%43" ile aynı
büyüklük mertebesinde). Bunların **3'ü** (`%30`) B-4'ün tarif ettiği sınıf: `Worker forks emitted
error`, hiçbir zaman assert kırmızısı değil, `scripts/verify-test-run.mjs` çiti doğru şekilde
yakalayıp "1 dosya sessizce eksik" diyerek KIRMIZI veriyor (çit çalışıyor — B-4 "sessiz atlama"
değil, "doğru şekilde raporlanan ama sık tekrarlayan kırmızı" sorunu). **1'i** (`%10`) FARKLI ve
zaten bilinen bir sınıf: gerçek bir assert hatası (`ENOTEMPTY`), B-4'ün kapsamı DIŞINDA — bu
sözleşme onu düzeltmiyor, yalnızca ayrı olduğunu teyit ediyor.

**Ek gözlem (11. koşu, arka planda, süreç sayımı için):** `tasklist` ile örneklenen `node.exe`
sayısı koşu ortasında **36**'ya çıktı — makinede **20 mantıksal işlemci** var
(`Get-CimInstance Win32_Processor`: 14 çekirdek/20 mantıksal, 32 GB RAM, ~12 GB boş). 36 eşzamanlı
süreç 20 mantıksal işlemciyi **aşıyor** (fazla-abonelik). Bu koşu da aynı sınıfla KIRMIZI verdi
(`tests/integration/*.test.ts`, farklı bir dosya).

**Yoğunlaşma analizi — SONUÇ: RASTGELE, tek dosyaya YOĞUNLAŞMIYOR.** Üç ayrı koşuda üç FARKLI
dosya çöktü (`features-api`, `gates-api`, `sse-stream`) — hepsi `tests/integration/**` altında,
hepsi gerçek bir `http.createServer` + gerçek SSE/istek döngüsü kuruyor, ama bu desenin kendisi
`tests/integration/`'daki **9/11** dosyada ortak (yalnızca ikisi hariç: `chat-hooks-live.test.ts`,
`gates-write-permission-live.test.ts`). Çöken dosya kümesi, "gerçek sunucu kuran entegrasyon
testi" popülasyonunun rastgele bir alt kümesi gibi davranıyor — belirli bir dosyanın kendine özgü
bir kusuru değil. **Sonuç:** kök neden tek bir testte değil, **eşzamanlı fork sayısında/kaynak
baskısında** — vitest varsayılanı `forks` havuzunda dosya başına 1 ayrı işlem açıyor (86 dosya →
86 fork, aynı anda çalışan sayısı `os.availableParallelism()`'e yakın sınırlanıyor ama gözlemlenen
36 süreç bunun ötesinde). Bu, Windows'ta yoğun eşzamanlı `child_process.fork()` altında bilinen ve
bu depoda `CLAUDE.md`/`test-skip-gate-contract.md`'de zaten kayıtlı `STATUS_ACCESS_VIOLATION`
(`3221226505`) ailesiyle uyumlu; kök neden (Node/Windows/libuv seviyesinde) bu turda da **kesin
olarak kanıtlanamıyor** — yalnızca **eşzamanlı fork sayısını azaltmanın** ölçülebilir bir azalma
sağlayıp sağlamadığı test edilebilir, ki bu turun asıl deneyi bu.

## 2. Seçenekler ve gerekçeli seçim

| Seçenek | Artı | Eksi | Karar |
|---|---|---|---|
| `pool: 'threads'` | Fork yerine worker thread — Windows fork kararsızlığını muhtemelen tamamen atlatır | Testler AYNI süreçte çalışır; global durum (module-level singleton, `process.env` mutasyonu, zamanlayıcılar) dosyalar arasında sızabilir. Bu depoda `tests/setup/chat-disabled-by-default.ts` gibi süreç-geneli `process.env` mutasyonu yapan setup dosyaları VAR — thread'ler arası sızıntı riski somut, teorik değil. | **REDDEDİLDİ** — izolasyonu en çok zayıflatan seçenek, kanıtlanmamış bir kazanç için en büyük yeni risk sınıfını açar. |
| `isolate: false` | Worker'ları dosyalar arasında yeniden kullanır, daha hızlı | Modül önbelleği/global durum dosyalar arasında SIZAR (vitest'in kendi uyarısı: "reuses workers across files instead of one per file") — bu, "çit duruyor ama hiçbir şey ölçmüyor" sınıfına doğrudan girer | **REDDEDİLDİ** — aynı gerekçe, izolasyon kaybı fork sayısını azaltmanın yan etkisi olmadan gelmiyor. |
| Çöken belirli bir testi izole etmek/düzeltmek | Kök neden düzeltmesi olurdu | §1'in yoğunlaşma analizi bunu **desteklemiyor** — üç farklı, ilgisiz dosya çöktü; "düzelt"ilecek tek bir kusurlu test yok | **UYGULANAMAZ** — ölçüm bunu reddetti, tahmine dayalı yama olurdu. |
| `poolOptions.forks.maxForks` sınırlama (fork havuzu KALIR, izolasyon KORUNUR, yalnızca eşzamanlı fork sayısı düşer) | İzolasyon modeli değişmiyor (hâlâ dosya başına ayrı süreç); yalnızca aynı anda kaç tanesinin çalıştığı azalıyor; §1'in "fazla-abonelik" bulgusunu doğrudan hedefliyor | Suite daha yavaş çalışır (daha az paralellik) | **SEÇİLDİ** |

**Seçilenin riski nasıl karşılandığı:** `maxForks` sınırlaması izolasyon modelini DEĞİŞTİRMEZ —
her test dosyası hâlâ kendi ayrı işleminde, kendi temiz modül kaydıyla çalışır (`isolate: true`
varsayılanı korunur). Tek değişen, aynı anda kaç sürecin canlı olduğu. Bu nedenle bu seçenek
"testler birbirini kirletir" risk sınıfını **açmıyor** — dolayısıyla §3.3'teki "izolasyonu
zayıflatan seçenek" kanıt yükümlülüğü (shuffle/pozitif kontrol) bu seçenek için **gerekmiyor**;
yine de mutasyon kanıtı (test kapısının hâlâ çalıştığı) ayrıca sağlanacak.

**Seçilen değer:** `poolOptions.forks.maxForks: 8` (20 mantıksal işlemcinin ~%40'ı — gözlemlenen
36 süreçlik fazla-abonelikten belirgin şekilde aşağıda, ama suiteyi tek sürece indirmeyecek kadar
yüksek). Sabit bir sayı seçildi (CPU sayısına oranlı bir hesap değil) çünkü bu makineye özgü
gözlemlenen fazla-abonelik sınırına dayanıyor; başka bir makinede farklı davranabileceği bilinen
bir sınırlama olarak burada not düşülüyor.

## 3. Ölçülebilir kabul kriteri

1. `poolOptions.forks.maxForks: 8` ile **≥10 ardışık `npm run test`** koşusu: hepsi YEŞİL, YA DA
   §4 (dürüstlük şartı) uyarınca kırmızı oranının taban %40'tan **ölçülebilir şekilde düştüğü**
   dürüst bir rapor (sayılarla).
2. `npm run e2e` (55/55), `npx tsc --noEmit` (0), `npx eslint .` (0), `node
   .claude/hooks/_selftest.cjs` (165/165) değişiklikten etkilenmeden yeşil kalır.
3. Mutasyon kanıtı: `scripts/verify-test-run.mjs`'in test kapısı hâlâ çalışıyor —
   `vitest.config.ts`'e geçici bir `exclude` eklenip bir dosya suiteten düşürülünce `npm run test`
   KIRMIZI verir ("Test Files total does not match disk count"); geri alınınca YEŞİL. `git
   checkout`/`git restore` KULLANILMAZ, elle geri alınır, `git diff` ile iz kalmadığı doğrulanır.
4. `ENOTEMPTY` temp-dizin flake'i (§1, koşu 1) bu sözleşmenin kapsamı DIŞINDA bırakılır —
   `docs/blockers.md`'ye CEO tarafından ayrı bir madde olarak taşınması önerilir (bu turda
   `blockers.md`'ye yazma yetkim yok, yalnızca burada işaretliyorum).

## 4. Dürüstlük şartı (brief madde 4 uyarınca önceden taahhüt)

Eğer `maxForks: 8` sonrası ≥10 koşunun HEPSİ yeşil değilse: kırmızı oranını rapor edip (ör.
"4/10 → 1/10"), kalan riski aşağıdaki eşikle bırakacağım: **kök neden (Windows'ta yoğun eşzamanlı
fork altında ara sıra `STATUS_ACCESS_VIOLATION`) hâlâ Node/vitest/işletim sistemi seviyesinde,
bu depronun kontrolü dışında kalabilir; bu durumda `maxForks`'u daha da düşürüp (ör. 4 veya
`singleFork: true`) tekrar ölçeceğim, sonuç yine tam yeşil olmazsa "kısmi başarı" olarak
raporlayıp qa-evaluator'a bırakacağım** — "buldum" demeyeceğim.
