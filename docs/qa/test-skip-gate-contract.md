---
type: qa-contract
date: 2026-09-10
status: fix
karar: KALDI (docs/qa/G5-sozlesme-kararlari-2026-09-10.md) — çitin ana vaadi doğrulandı, ama kalıcı B1 testi tüm suite'i eşzamanlı ikinci kez koşturup 7333 portuna çarpıyor. Bu, "vitest worker kararsızlığı" sanılan flake'in gerçek kaynağı.
---

# Sözleşme — vitest sessiz test atlama çiti (altyapı işi, yeni feature değil)

**Kaynak:** `docs/blockers.md` "2026-09-10 — YÜKSEK ÖNCELİK: test takımı sessizce test atlıyor".
**Dosya sahipliği:** `scripts/verify-test-run.mjs` (var, genişletiliyor),
`tests/verify-test-run.test.ts` (var, genişletiliyor), `tests/fixtures/fake-vitest-*.mjs`
(var + yeni), `package.json` (`test` betiği), `docs/blockers.md`, `docs/progress.md`,
`docs/qa/test-skip-gate-contract.md` (bu dosya). Mevcut ürün kodu (`src/**`) ve mevcut
testlerin hiçbiri değişmez.

## 0. GÜNCELLEME (2026-09-10, düzeltme turu) — QA KALDI kararı sonrası genişletme

`docs/qa/test-skip-gate-2026-09-10.md` KALDI kararı verdi: iki bloklayıcı (B1, B2), dört önemli
bulgu (Ö1-Ö4). Bu güncelleme §2/§3/§4'ü genişletiyor; aşağıdaki maddeler **eskisinin yerine
geçer**, eskisiyle çelişen yerlerde bu bölüm geçerlidir.

**Sözleşmenin kendi kusuru (QA §9, düzeltilen asıl şey):** Aşağıdaki eski madde 4 (`MIN_EXPECTED_
TESTS` alt sınırı) yalnızca **"vitest sıfır test topladı"** felaket senaryosunu ele alıyordu.
Bloklayıcının orijinal kapatma önerisi ("koşulan test sayısını **beklenen sayıyla** karşılaştır")
sözleşmeye taşınırken bu tek cümleye **daraltılmıştı** — "beklenen sayı" hiçbir zaman "diskteki
gerçek test dosyası sayısı" olarak tanımlanmamıştı, yalnızca sabit bir tabana (500) indirgenmişti.
**Kısmi toplama kaybı** (bir dosya/birkaç dosya düşer, kalan sayı hâlâ 500'ün üstünde) hiç
ele alınmamıştı. Bu daralma B1'in doğrudan nedeni. Bu güncelleme bunu düzeltiyor: "beklenen sayı"
artık **diskten türetilen** bir sayı, sabit bir tahmin değil.

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
   sabit bir sayı bakımı gerekmez. **(değişmedi — B1 ile ilgisiz, o katman zaten çitliydi.)**
2b. **YENİ (B1 kapatma — DIŞ REFERANS, ana savunma).** `vitest.config.ts`'in `include`/`exclude`
   dizilerini (dosyadan, basit bir string-literal ayrıştırıcıyla — bkz. madde 2c) okuyup diskteki
   `tests/**` altını bu desenlere göre numaralandırır (`fs.readdirSync(..., {recursive:true})`,
   emsal: `tests/build-css.test.ts`). Bulunan dosya sayısı, vitest'in raporladığı `Test Files`
   parantez içi toplamıyla **eşleşmelidir**; eşleşmezse (disk sayısı > rapor edilen), bu **kısmi
   toplama kaybının kanıtı** ve kırmızı sayılır — sum/total kendi içinde tutarlı olsa bile
   (bloklayıcının tam olarak yakaladığı boşluk). Bu kontrol `sum==total` kontrolünden **bağımsız**
   çalışır; ikisi ayrı bug sınıflarını (kategori içi vs. dosya düzeyinde kayıp) yakalar.
   - **Beyan edilen (kasıtlı) dışlamalar** yalnızca `vitest.config.ts`'in kendi `exclude`
     dizisidir (`tests/e2e/**`, `node_modules/**`) — bu dosyada değişen bir dışlama, kaynağı
     kod incelemesinde (diff) görünür, "sessiz" değildir. Gate'in **görmediği** ve dolayısıyla
     her zaman kırmızı sayacağı şey, `vitest.config.ts`'e hiç yansımayan, yalnızca komut satırı
     bayrağıyla (`--exclude ...`) verilen ek dışlamalardır — B1'in gerçek saldırı yüzeyi tam
     olarak budur.
   - **Ö3 istisnası (kasıtlı daraltılmış koşu):** komut satırında **pozisyonel** bir dosya/desen
     argümanı (ör. `vitest run tests/foo.test.ts`, `-`ile başlamayan bir argüman) varsa, bu kontrol
     (ve madde 4'teki alt sınır) **atlanır** — geliştirici bilerek tek dosya çalıştırıyor demektir,
     bu "sessiz" bir kayıp değil. Yalnızca **bayrak** argümanları (`--exclude ...` gibi, pozisyonel
     hedef YOK) varsa kontrol **aktif kalır** — B1'in gerçek yeniden üretimi tam olarak bu şekle
     giriyor (`npm run test -- --exclude "..."`, pozisyonel hedef yok).
2c. Basit string-literal ayrıştırıcı yalnızca bu depodaki `vitest.config.ts`'in bugünkü şeklini
   (düz `include: [...]`/`exclude: [...]` string dizileri) hedefler; genel bir TS/AST ayrıştırıcı
   DEĞİLDİR (istenmeyen soyutlama, "ileride lazım olur" kodu değil — CLAUDE.md ilke 2). Glob
   eşleştirme yalnızca bu depoda fiilen kullanılan üç yapıyı destekler: `**` (sıfır veya daha
   fazla dizin), `*` (tek segment), `?(x)` (extglob opsiyonel grup). Desenler değişirse
   (`vitest.config.ts`'e yeni bir glob yapısı eklenirse) bu ayrıştırıcı elle güncellenmeli —
   bu, kabul edilen bir bakım maliyeti (nadiren değişen bir dosya).
3. Ayrıca çıktıda bilinen çökme imzalarını arar (**ikincil, erken-uyarı katmanı — DD1/madde 2b
   birincil savunmadır**): `"Worker forks emitted error"`, `"Worker exited unexpectedly"`,
   `"Unhandled Error"`, ve **YENİ**: `"Worker terminated"`, `"ERR_IPC_CHANNEL_CLOSED"`,
   `"heap out of memory"`. Biri bulunursa (sayılar tesadüfen eşleşse bile) kırmızı sayılır.
   **YENİ — genelleştirilmiş yedek:** yukarıdaki liste dışındaki, henüz görülmemiş worker/fork/
   IPC çökme biçimlerini de yakalamak için bir düzenli ifade deseni (`worker`/`tinypool`/`child
   process` gibi bir sözcüğün, 80 karakter içinde bir çökme fiiliyle -- `crashed`/`terminated`/
   `killed`/`segmentation fault`/`access violation`/`out of memory` vb. -- birlikte geçmesi)
   ikincil bir ağ olarak eklenir. Kara listeye **dayanılmaz**; liste tükenirse bile bilinmeyen
   biçimler bu genel desenle yakalanabilir.
4. Sabit, açık bir **alt sınır** da tutulur (`MIN_EXPECTED_TESTS`, betikte sabit = 500) — yalnızca
   "vitest 0 test topladı ve bunu başarı saydı" gibi felaket senaryosuna karşı ucuz bir son çare;
   bugünkü **1327** testin çok altında olduğu için testler eklendikçe **bakım gerektirmez**,
   yalnızca test sayısı kasıtlı olarak bu sınırın altına düşerse (olası değil) elle yükseltilir —
   betikteki yorum bunu açıklar. **Not (Ö1b/B1b'den öğrenilen):** bu sınır tek başına yetersizdi
   (suite'in %52'si düşse bile aşılmıyordu) — asıl savunma artık madde 2b'dir, bu sınır yalnızca
   ikincil bir son çare olarak kalıyor.
5. Özet satırı hiç bulunamazsa (format tanınmıyor/çıktı boş) **kapalı-hata** (fail-closed) —
   belirsizlik başarı sayılmaz.
5b. **YENİ (Ö2 kapatma).** Özet satırlarını ayrıştırmadan önce ANSI renk kaçış dizileri
   (`[...m`) temizlenir — `FORCE_COLOR` ile çalıştırılan sağlıklı bir koşunun yanlışlıkla
   kırmızı görünmesini önler (ayrıştırma çıpası `\s*$` ANSI kodlarıyla kırılıyordu).
6. Vitest'in kendi çıkış kodu zaten sıfır değilse, o korunur (gate bunu asla 0'a çevirmez).
7. `package.json`'daki `test` betiği bu sarmalayıcıyı çağıracak şekilde değişir
   (`"test": "node scripts/verify-test-run.mjs"`); `npm run verify` bunu zaten zincirlediği için
   otomatik kapsanır. `test:watch`, `test:chat-live`, `test:gates-live` gibi diğer betiklere
   DOKUNULMAZ (kapsam dışı, farklı amaçlı).
7b. **YENİ (B2 kapatma — bağlantı katmanının pozitif kontrolü).** `tests/verify-test-run.test.ts`
   `package.json`'ı okuyup `scripts.test`'in tam olarak `scripts/verify-test-run.mjs`'i çağırdığını
   ve `scripts.verify`'ın `npm run test`'i zincirlediğini doğrudan (metin karşılaştırmasıyla)
   doğrular. Bu, çitin **kendisinin** `package.json`'dan sessizce çıkarılmasına karşı ayrı bir
   test — madde 2b/3'ün "kararı doğru veriyor mu" sorusundan farklı, "karar hiç çağrılıyor mu"
   sorusu.

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

### 3b. YENİ — B1/B2/Ö1-Ö4 kapatma doğrulaması (düzeltme turu)

- **B1 — disk/rapor karşılaştırması, sentetik (birim seviyesi, hızlı):** yeni saf fonksiyonlar
  (`globToRegExp`, `extractArrayLiteral`, `countDeclaredTestFiles`, `hasExplicitPositionalFilter`)
  küçük, kontrollü girdilerle doğrudan test edilir. `evaluateOutput`'a yeni bir `expectedFileCount`
  seçeneği eklenir; `Test Files` toplamı bu sayıyla uyuşmuyorsa (ve pozisyonel argüman yoksa)
  kırmızı — sentetik girdiyle (gerçek dosya sistemine dokunmadan) doğrulanır.
- **B1 — QA'nın GERÇEK komutu, KALICI regresyon testi (gerçek alt süreç, gerçek suite):**
  `tests/verify-test-run.test.ts`'e gate script'i **gerçek `vitest`** ile (MC_TEST_RUN_CMD YOK)
  ve QA'nın B1a repro'suna eşdeğer bir `--exclude <gerçek-tek-dosya>` argümanıyla çalıştıran bir
  test eklenir; gate **0'dan farklı** dönmeli (disk 86 dosya bekliyor, vitest daha azını
  raporluyor). Bu test suite'in tamamını (~85 dosya) gerçekten çalıştırdığı için pahalı
  (~15-20 sn) ama QA'nın "kalıcı test yap" talebinin birebir karşılığı — fixture ile
  taklit edilemez, gerçek `vitest.config.ts` + gerçek dosya sistemi + gerçek `vitest` gerekir.
  **Kritik uygulama notu (bu turda gerçek bir fork bomb'la bulundu, 185+ node.exe süreci):**
  bu testin spawn ettiği gerçek suite, `tests/verify-test-run.test.ts`'in KENDİSİNİ de
  içerdiğinden, `--exclude tests/verify-test-run.test.ts` de MUTLAKA eklenmeli — yoksa iç içe
  suite kendi B1 testini tekrar çalıştırıp yeni bir suite daha başlatır (üstel büyüme).
- **B2 — bağlantı çiti:** `package.json`'ı okuyup `scripts.test`/`scripts.verify` metnini
  doğrudan assert eden yeni test. Mutasyon: `scripts.test`'i `"vitest run"` yapıp SADECE bu testi
  çalıştır → KIRMIZI; elle geri al → YEŞİL.
- **Ö1 — kara liste + genelleştirme:** üç yeni literal imza (`Worker terminated`,
  `ERR_IPC_CHANNEL_CLOSED`, `heap out of memory`) için birer birim testi (silinirse o test tek
  başına KIRMIZI verir — listenin kendisi çitli). Ayrıca listede OLMAYAN bir ifade
  (`tests/fixtures/fake-vitest-unknown-crash.mjs`) için genelleştirilmiş desenin yakaladığını
  gösteren bir uçtan-uca test.
- **Ö2 — ANSI:** `stripAnsi` birim testi + gerçek `FORCE_COLOR=1 npm run test` koşusunun
  (manuel, bu turda) **0** döndüğü ölçülür.
- **Ö3 — hedefli koşu:** `hasExplicitPositionalFilter` birim testleri + gerçek
  `npm run test -- tests/verify-test-run.test.ts` koşusunun (manuel, bu turda) artık **0**
  döndüğü ölçülür (önceden 500 tabanına takılıp kırmızı veriyordu).
- **Ö4:** `scripts/verify-test-run.mjs`'teki ve bu sözleşmedeki bayat sayılar (1309/85) güncel
  değerlerle (1327/86) değiştirilir.
- **Mutasyon kanıtı (mevcut, korunuyor):** `evaluateOutput` içindeki toplam-karşılaştırma satırı
  elle devre dışı bırakılıp `fake-vitest-silent-drop` testi tekrar çalıştırılır → YEŞİL; geri
  alınır → KIRMIZI. `git checkout` KULLANILMAZ.

## 4. Kapsam dışı / bilinçli yapılmayanlar

- Worker fork çökmesinin (`3221226505`) kök nedenini (Windows AV/bellek vb.) çözmek — bu ayrı,
  bilinen bir sınıf (`CLAUDE.md`), bu turun konusu değil.
- `--no-file-parallelism`, `retry`, `--bail` gibi ayarlarla sorunu gizlemek — YAPILMAYACAK
  (brief kısıtı).
- `npm run e2e`/Playwright tarafı — bu bloklayıcı yalnızca `vitest` için.
- Genel bir glob/AST kütüphanesi eklemek (ör. `fast-glob`/`picomatch`) — bunlar zaten `node_modules`
  içinde geçişli bağımlılık olarak mevcut ama `package.json`'da BİLDİRİLMİYOR; onlara doğrudan
  bağımlı olmak "yeni bağımlılık ekleme" sayılır (brief kısıtı: önce sor). Bunun yerine bu depoda
  fiilen kullanılan üç glob yapısını (`**`, `*`, `?(x)`) hedefleyen ~30 satırlık özel bir
  dönüştürücü yazıldı (madde 2c).
- `vitest.config.ts`'in kendisini genel bir TS/AST ayrıştırıcıyla okumak — basit regex tabanlı
  string-literal çıkarımı yeterli (dosya bugün düz string dizileri içeriyor).
