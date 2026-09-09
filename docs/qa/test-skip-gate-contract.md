# Sözleşme — vitest sessiz test atlama çiti (altyapı işi, yeni feature değil)

**Kaynak:** `docs/blockers.md` "2026-09-10 — YÜKSEK ÖNCELİK: test takımı sessizce test atlıyor".
**Dosya sahipliği:** `scripts/verify-test-run.mjs` (yeni), `tests/verify-test-run.test.ts` (yeni),
`tests/fixtures/fake-vitest-*.mjs` (yeni), `package.json` (`test` betiği), `docs/blockers.md`,
`docs/progress.md`. Mevcut ürün kodu (`src/**`) ve mevcut testlerin hiçbiri değişmez.

## 1. Teşhis (kod okuma + canlı tekrar üretim ile doğrulanacak)

- `node_modules/vitest/dist/chunks/index.B89dZ0-N.js:11463` — worker fork çöktüğünde
  (`ChildProcess.emitUnexpectedExit`) `Pool.schedule()` bunu `[vitest-pool]: Worker forks emitted
  error.` mesajıyla reddediyor; bu, `runFiles()`'ta (`:21045-21049`) yakalanıp
  `state.catchError(err, "Unhandled Error")`'a düşüyor; `_checkUnhandledErrors` (`:21374-21375`)
  `errors.length && !dangerouslyIgnoreUnhandledErrors` ise `process.exitCode = 1` yazıyor.
- **10 canlı `npx vitest run` koşusunda** (bu turda, yerelde) çökme **5/10** koşuda tekrar etti
  (`Worker exited unexpectedly with exit code 3221226505`, Windows STATUS_ACCESS_VIOLATION) —
  **hepsinde** vitest kendi kendine doğru şekilde `exit 1` verdi ve eksik dosyayı raporladı.
  Yani bu depodaki **pinned `vitest@5.0.0`'da** (`package-lock.json:7463`), çökme+exit-0
  kombinasyonu bu turda **tekrar üretilemedi** — kod okuması da exit-1 yolunun var olduğunu
  doğruluyor.
- **Sonuç:** kök neden **kesin olarak tekrar üretilip kanıtlanamadı** (dürüstçe: "neden bazen
  exit 0 oluyor" sorusu açık kalıyor — muhtemelen zamanlamaya bağlı bir yarış durumu, örn.
  worker'ın çökme sinyali `onFinished` mesajından SONRA/YARIŞARAK gelirse resolver zaten
  `resolve()` olmuş olabilir). Bu yüzden düzeltme kök-neden-kapatma değil, **çit** stratejisiyle
  ilerliyor (brief'in izin verdiği "çözemiyorsan bile sessizlik kabul edilemez" yolu).
- **Ayrım korunuyor:** kırmızı veren çökme (`3221226505`) `CLAUDE.md`'de zaten bilinen ayrı sınıf;
  bu sözleşme onu "düzeltmiyor", yalnızca onun ve HERHANGİ bir sessiz düşüşün `verify`'ı kırmızıya
  çevirmesini GARANTİ ALTINA ALIYOR.

## 2. Ne yapılacak

`vitest run`'ı saran bağımsız bir Node betiği (`scripts/verify-test-run.mjs`):

1. `vitest run`'ı alt süreç olarak çalıştırır (stdout/stderr canlı olarak ekrana yazılırken aynı
   zamanda tamponlanır — davranış/çıktı kullanıcıya göründüğü gibi kalır, gizleme yok).
2. Vitest'in KENDİ özet satırlarını (`Test Files  X passed | Y skipped (T)` /
   `Tests  X passed | Y skipped (T)`) ayrıştırır ve **kategori toplamının parantez içindeki
   toplamla eşleştiğini** doğrular. Eşleşmezse (`sum < total`) bu, testlerin sessizce
   koşulmadığının **kendi kendini güncelleyen** kanıtıdır — yeni test eklendikçe `T` de büyür,
   sabit bir sayı bakımı gerekmez.
3. Ayrıca çıktıda bilinen çökme imzalarını arar: `"Worker forks emitted error"`,
   `"Worker exited unexpectedly"`, `"Unhandled Error"`. Biri bulunursa (sayılar tesadüfen eşleşse
   bile) kırmızı sayılır.
4. Sabit, açık bir **alt sınır** da tutulur (`MIN_EXPECTED_TESTS`, betikte sabit = 500) — yalnızca
   "vitest 0 test topladı ve bunu başarı saydı" gibi felaket senaryosuna karşı ucuz bir son çare;
   bugünkü 1309 testin çok altında olduğu için testler eklendikçe **bakım gerektirmez**, yalnızca
   test sayısı kasıtlı olarak bu sınırın altına düşerse (olası değil) elle yükseltilir — betikteki
   yorum bunu açıklar.
5. Özet satırı hiç bulunamazsa (format tanınmıyor/çıktı boş) **kapalı-hata** (fail-closed) —
   belirsizlik başarı sayılmaz.
6. Vitest'in kendi çıkış kodu zaten sıfır değilse, o korunur (gate bunu asla 0'a çevirmez).
7. `package.json`'daki `test` betiği bu sarmalayıcıyı çağıracak şekilde değişir
   (`"test": "node scripts/verify-test-run.mjs"`); `npm run verify` bunu zaten zincirlediği için
   otomatik kapsanır. `test:watch`, `test:chat-live`, `test:gates-live` gibi diğer betiklere
   DOKUNULMAZ (kapsam dışı, farklı amaçlı).

## 3. Davranışlar nasıl doğrulanacak (qa-evaluator için)

- **Birim seviyesi:** `parseSummaryLine`/`findCrashSignature`/`evaluateOutput` saf fonksiyonları
  `tests/verify-test-run.test.ts`'te doğrudan import edilip sentetik girdilerle test edilir
  (gerçek vitest çıktısından alınmış birebir örnek satırlarla, bu turda canlı koşulardan
  kopyalanmış).
- **Uçtan uca (gerçek alt süreç):** `MC_TEST_RUN_CMD` ortam değişkeniyle gerçek `vitest`
  komutunun yerine sahte "vitest" betikleri (`tests/fixtures/fake-vitest-*.mjs`) geçirilir; gate
  betiği GERÇEKTEN alt süreç olarak çalıştırılıp (`spawnSync`) çıkış kodu ölçülür — model/tahmin
  değil, mekanizmanın kendisi tetiklenir (`CLAUDE.md`: "korunan mekanizmayı doğrudan tetikle").
  - `fake-vitest-ok.mjs` (sağlıklı özet, exit 0) → gate **0** dönmeli.
  - `fake-vitest-silent-drop.mjs` (raporun BİREBİR tarif ettiği şekli: sayılar toplama eşit
    değil AMA kendi exit kodu 0) → gate **0'dan farklı** dönmeli — bu, bloklayıcının kendisinin
    canlı kanıtıdır.
  - `fake-vitest-crash-text-but-counts-match.mjs` (sayılar eşit ama çökme metni de var) → gate
    **0'dan farklı** dönmeli (metinsel çit, sayı çitinden bağımsız çalışıyor mu diye).
  - `fake-vitest-red.mjs` (gerçekten başarısız testler, kendi exit kodu 1) → gate **0'dan farklı**
    kalmalı (gate gerçek kırmızıyı maskelemiyor).
  - `fake-vitest-missing-summary.mjs` (tanınabilir özet satırı yok, exit 0) → gate **0'dan
    farklı** dönmeli (kapalı-hata).
- **Mutasyon kanıtı (çitin kendi pozitif kontrolü):** `evaluateOutput` içindeki toplam-karşılaştırma
  satırı elle geçici olarak devre dışı bırakılıp yalnızca `fake-vitest-silent-drop` uçtan-uca
  testi tekrar çalıştırılacak — mutasyonla **YEŞİL** (gate'in artık bloklayıcıyı yakalamadığının
  kanıtı) beklenmeli, sonra elle geri alınıp tekrar **KIRMIZI/doğru** olduğu teyit edilecek.
  `git checkout` KULLANILMAYACAK; değişiklik `scratchpad`'e alınan yedekten elle geri yazılacak.
- **Regresyon:** `npm run verify` ve `npm run e2e` turun sonunda **yeşil** olmalı (koşulan test
  sayısıyla birlikte raporlanacak); gerçek vitest çıktısına karşı en az bir gerçek `npm run test`
  koşusu da (fixture değil, GERÇEK vitest) gate'in altından sorunsuz geçmeli.

## 4. Kapsam dışı / bilinçli yapılmayanlar

- Worker fork çökmesinin (`3221226505`) kök nedenini (Windows AV/bellek vb.) çözmek — bu ayrı,
  bilinen bir sınıf (`CLAUDE.md`), bu turun konusu değil.
- `--no-file-parallelism`, `retry`, `--bail` gibi ayarlarla sorunu gizlemek — YAPILMAYACAK
  (brief kısıtı).
- `npm run e2e`/Playwright tarafı — bu bloklayıcı yalnızca `vitest` için.
