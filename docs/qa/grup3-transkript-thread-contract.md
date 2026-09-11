---
feature: GRUP3-TRANSKRIPT-THREAD
status: qa
---

# Grup 3 — F-009 (transkript gizlilik çiti) ve F-010 (thread eskalasyon rozeti + ölü kod) borç kapatma

Tarih: 2026-09-11 · Kapsam: `docs/blockers.md`'de "2026-09-09 — F-009 kapanışından taşınan beş
borç" ve "2026-09-10 — F-010 kapanışından taşınan borçlar" altında listelenen maddelerden **bu
turda seçilen 5 tanesi**. Dosya sahipliği: `tests/features/thread/**`,
`src/features/thread/server/thread-detail.ts`, `src/features/thread/web/useProjectFeatureList.ts`,
`docs/qa/F-009-contract.md` (yalnızca §7.1 düzeltmesi, brief istisnası).

## 0. Diskte doğrulanmış durum (kod yazmadan önce ölçüldü)

Beş maddenin BEŞİ de bugün **gerçekten açık** — hiçbiri stale/kapanmış değil. Ölçüm yöntemi:
gerçek dosyada mutasyon uygulayıp `npx vitest run` ile kırmızı/yeşil gözlemlemek (bkz. §2).

| # | Madde | Dosya:satır | Durum |
|---|-------|-------------|-------|
| 1 | Latin-dışı bayt kör noktası | `tests/features/thread/transcripts-privacy-guard.test.ts:144` (`TOKEN_RE`) | **AÇIK** — ölçüldü, gerçek Kiril/CJK metin sessizce geçiyor |
| 2 | `.gitattributes` muafiyeti ada bağlı | `tests/features/thread/transcripts-privacy-guard.test.ts:45,162` (`NON_FIXTURE_FILENAMES`, `walk()`) | **AÇIK** — ölçüldü, alt dizinde aynı adlı dosya taranmıyor |
| 3 | 4 desen (semver/sürücü harfi/msg-id/iki nokta) yalnızca DARALTMAYA (silmeye) karşı korunuyor, GENİŞLETMEYE (gevşetmeye) karşı korunmuyor | `tests/features/thread/transcripts-privacy-guard.test.ts:123-126` (`SEMVER`/`DRIVE_LETTER`/`COLON_LITERAL`/`MSG_ID`) | **AÇIK** — ölçüldü, 4'ü de gevşetilince 55/55 yeşil kalıyor; sözleşme §7.1'in "4+ haneli her sayı reddedilir" cümlesi de sınıf düzeyinde yanlış |
| 4 | Eskalasyon rozeti D8/D9 | `src/features/thread/server/thread-detail.ts:46-51` (`extractHeaderBlock`) | **AÇIK** — ikisi de ölçüldü, gerçek dosyalarda 0-46 satır arası doğrulanan risk |
| 5 | Ölü `retry` API'si | `src/features/thread/web/useProjectFeatureList.ts:9,50` | **AÇIK** — grep ile doğrulandı, tek tüketici `ThreadScreen.tsx:42` `retry`'ı hiç destructure etmiyor, hiçbir test `.retry`'ı çağırmıyor |

**Not:** `docs/blockers.md`'nin F-009 grubunda kayıtlı madde 3 metni ("tek tek gevşetildiğinde
54/54 yeşil kalıyor") **DOĞRU** çıktı — bugün 55/55 (bir test eklendiği için sayı arttı) ama aynı
mekanizma boşluğu duruyor. Bu bir "kayıt yanlış" durumu DEĞİL.

## 1. Neden bu madde var (tek cümle + doğrudan çit)

- **F-009 gizlilik çiti neden var:** `tests/fixtures/transcripts/**` altına eklenen HİÇBİR dosya
  gerçek/gerçek-görünümlü kişisel veri taşımamalı. Doğrudan çit: `scanFixtureForPrivacyViolations`
  gerçek prob dosyaları üzerinde çalıştırılıp violaton üretip üretmediği ölçülür (aşağıdaki
  reprodüksiyonlar).
- **F-010 eskalasyon rozeti neden var:** panel kullanıcısı (Veron) `docs/qa/latest.md`'nin GERÇEK
  güncel kararını görmeli, gövdedeki bir alıntıyı ya da gerçek bir eskalasyonu KAÇIRMAMALI.
  Doğrudan çit: `buildThreadDetail(...).detail.eskale` gerçek dosya içerikleriyle ölçülür.

## 2. Reprodüksiyon (KIRMIZI, kod yazılmadan önce ölçüldü)

Tüm mutasyonlar **elle** (git checkout/restore KULLANILMADI) uygulanıp `git diff --stat` ile temiz
duruma dönüldüğü doğrulandı; hiçbiri commit edilmedi.

### 1 — Latin-dışı bayt kör noktası
`tests/fixtures/transcripts/__debt1_probe/leak.jsonl` içine gerçek Kiril metni
(`"Иванов Иван Иванович домашний адрес Москва"`) ve ayrı bir denemede gerçek CJK metni
(`"田中太郎の自宅住所は東京都渋谷区"`) yazıldı. `npx vitest run tests/features/thread/transcripts-privacy-guard.test.ts`
→ **56/56 yeşil** (yeni dosya taranmasına rağmen SIFIR ihlal bulundu) — kör nokta doğrulandı.
Neden: `TOKEN_RE = /[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._-]+/g` yalnızca Latin+Türkçe karakter sınıfını
tanıyor; Kiril/CJK karakterler hiç token ÜRETMİYOR, dolayısıyla `isApprovedToken` hiç çağrılmıyor.

### 2 — `.gitattributes` muafiyeti ada bağlı
`tests/fixtures/transcripts/__debt2_probe/.gitattributes` adıyla, İÇERİĞİ gerçek kişisel veri
biçimli metin (`"gercek kullanici adi soyadi telefon adres bilgisi burada saklaniyor"`) olan bir
dosya yazıldı. `npx vitest run …` → **55/55 yeşil**, `listFixtureFiles()` bu dosyayı **hiç
listelemedi** (yeni bir `it.each` girdisi bile oluşmadı) — çünkü `walk()` (satır 162)
`NON_FIXTURE_FILENAMES.has(entry.name)` ile YALNIZCA dosya ADINA bakıyor, tam yola değil.

### 3 — 4 desenin gevşetmeye karşı çitsizliği
Her biri ayrı ayrı, TEK BAŞINA gevşetildi (silinmedi — silme zaten kırmızı verdiği önceden
doğrulandı, bkz. aşağıdaki not), her seferinde `npx vitest run …` çalıştırılıp elle geri alındı:

| Desen | Gevşetme | Sonuç |
|-------|----------|-------|
| `SEMVER` | `\d{1,3}` → `\d{1,}` (her üç bölüm) | 55/55 yeşil |
| `DRIVE_LETTER` | `[A-Za-z]:` → `[A-Za-z]{1,}:` | 55/55 yeşil |
| `COLON_LITERAL` | `[0-9]{1,3}` → `[0-9]{1,}` | 55/55 yeşil |
| `MSG_ID` | `\d{1,4}` → `\d{1,}` | 55/55 yeşil |

Somut sızıntı kanıtı (yalnızca `COLON_LITERAL` için, temsili): `{"content":12345678901}` (TC-kimlik
uzunluğunda çıplak sayı, JSON'da tırnaksız değer olduğu için `:12345678901` TEK token) — sıkı
düzenli ifadeyle **KIRMIZI** (ihlal bulunuyor, doğru), gevşetilmiş düzenli ifadeyle **56/56 yeşil**
(sessizce onaylanıyor) — mutasyon çifti `npx vitest run` ile ölçüldü.

**Karşı-kontrol** (bu maddenin "silme" ile karıştırılmadığını kanıtlamak için): dört deseni TAMAMEN
KALDIRMAK (gevşetmek değil) her seferinde 2 testi kırmızı veriyor (bir doğrudan `isApprovedToken`
birim testi + `valid.jsonl`/`bom-crlf.jsonl` gibi gerçek fixture testlerinden biri) — yani "silme"
zaten çitli, borç yalnızca "gevşetme"de.

Sözleşme yanlışlığı (`docs/qa/F-009-contract.md:195`): *"4+ haneli her sayı … otomatik
reddedilir"* cümlesi SINIF düzeyinde yanlış — ISO zaman damgası (15 hane), msg-id (4 haneye kadar)
gibi KENDİ yapısal desenine uyan token'ların İÇİNDEKİ 4+ haneli sayı dizileri reddedilmiyor; kural
yalnızca **`BARE_NUMBER` ile değerlendirilen, başka hiçbir desene uymayan STANDALONE sayı
token'ları** için geçerli. Ayrıca `docs/qa/F-009-contract.md:187` "~57 sabit dize" diyor,
gerçek `ALLOWED_TOKENS.size` **63** (script ile sayıldı).

### 4 — Eskalasyon rozeti D8/D9
`buildThreadDetail` üzerinden iki gerçek senaryo (fix sonrası kalıcı test olarak eklenecek):
- **D9** — `docs/qa/latest.md` GERÇEK YAML frontmatter ile başlıyor (`---` satır 1). Bugünkü
  `extractHeaderBlock` (satır 46-51) `delimiterIndex=0` bulup `lines.slice(0,0)` = **boş dize**
  döndürüyor — frontmatter İÇİNDEKİ gerçek `ESKALE: true` hiç görülmüyor, rozet **her zaman**
  `false` kalıyor.
- **D8** — frontmatter YOK, gerçek durum satır 1-2'de `ESKALE: false`, ama belgede ÇOK AŞAĞIDA
  (satır 25) raporun kendi biçimini gösteren bir alıntı `ESKALE: true` İÇERİYOR, ve gerçek `---`
  ayracı bundan da SONRA (satır 27) geliyor. `docs/qa/*.md` genelinde gerçek ilk `---` konumu
  ÖLÇÜLDÜ: 0-46 satır arası (ör. `docs/qa/F-001.md` satır 46, `docs/qa/G5-guvenlik-denetimi-
  2026-09-10-tur4.md` satır 41) — yani "başlık bloğu" bugünkü kodda gerçekten 46 satıra kadar
  şişebiliyor. Bu pencere içindeki HERHANGİ bir tam-satır `ESKALE: true` alıntısı (mevcut testlerin
  kapsamadığı bir konumda) rozeti YANLIŞ tetikler.

Her iki senaryo da `tests/features/thread/server/thread-detail.test.ts`'e KIRMIZI olarak eklendi,
sonra düzeltmeyle yeşile döndü (bkz. §3).

### 5 — Ölü `retry` API'si
Kanıt yöntemi (madde ölü kod olduğu için "kırmızı test" yerine arama): `grep -rn
"useProjectFeatureList\|\.retry\b" src/features/thread` → tek üretim çağrısı
`ThreadScreen.tsx:42`, ve o satır `const { features, loadState: featuresLoadState } =
useProjectFeatureList(...)` — `retry` hiç destructure edilmiyor. `grep -rln
"useProjectFeatureList" tests/` → SIFIR eşleşme (hook'un kendi test dosyası bile yok, `retry` hiç
çağrılmamış).

## 3. Düzeltme mekanizması

1. **TOKEN_RE Unicode'a açılıyor:** `/[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._-]+/g` → `/[\p{L}\p{N}:._-]+/gu`.
   `\p{L}`/`\p{N}` TÜM Unicode harf/rakam kategorilerini kapsar (Kiril, CJK dahil) — tasarım
   DEĞİŞMİYOR (hâlâ beyaz liste), yalnızca tokenizer artık bu karakterleri de token'a çeviriyor;
   `ALLOWED_TOKENS`'ta olmadıkları için otomatik reddediliyorlar. Emoji (`\p{S}`) kapsam DIŞI
   bırakıldı — brief'in odağı Kiril/CJK, emoji JSON transkript metninde pratik taşıyıcı değil ve
   ayırıcı olarak kalması mevcut tokenizasyonu bozmuyor.
2. **`.gitattributes` muafiyeti TAM YOLA bağlanıyor:** `NON_FIXTURE_FILENAMES` (ad kümesi)
   kaldırılıyor, yerine `GIT_ATTRIBUTES_EXEMPT_PATH = path.join(FIXTURES_DIR, '.gitattributes')`
   (tek, mutlak yol) geliyor; `walk()` içindeki karşılaştırma `entry.name` yerine `full !==
   GIT_ATTRIBUTES_EXEMPT_PATH` oluyor. Alt dizindeki aynı adlı dosya artık İSTİSNA KAPSAMINA
   GİRMİYOR, normal şekilde taranıyor.
3. **4 desene sınır-ihlali (boundary) birim testleri ekleniyor** (üretim kodu/regex DEĞİŞMİYOR —
   desenler zaten doğru dar; eksik olan TESTTİ): `isApprovedToken` kategorisine dört yeni satır —
   `:1234` (4 hane) → `false`, `1234.1.1` (4 haneli segment) → `false`, `msg_example12345` (5
   hane) → `false`, `AB:` (2 harf) → `false`. Bu, `BARE_NUMBER`'ın zaten sahip olduğu
   `4242`/`12345678901` → `false` sınır testleriyle SİMETRİK hale getiriyor — bundan sonra biri bu
   4 deseni GEVŞETİRSE (silmese bile) ilgili sınır testi KIRMIZI verecek.
   `docs/qa/F-009-contract.md` §7.1 iki yerde düzeltiliyor: "~57" → "63" (ölçülen gerçek sayı) ve
   "4+ haneli her sayı … otomatik reddedilir" cümlesine kapsam netliği ekleniyor (yalnızca
   `BARE_NUMBER` ile değerlendirilen standalone token'lar için geçerli).
4. **`extractHeaderBlock` yeniden yazılıyor** (`thread-detail.ts`):
   - Belge TAM `---` ile başlıyorsa (satır 0), başlık bloğu bu açılış ile KAPANIŞ `---`'i
     ARASINDAKİ içeriktir (D9 düzeltmesi — açılış satırının kendisi "ilk `---`" sayılıp header'ı
     boşaltmıyor).
   - Aksi halde (bugünkü tüm gerçek `docs/qa/*.md` dosyalarının durumu), başlık bloğu ilk `---`'e
     kadar olan satırlardır AMA `MAX_HEADER_LINES = 10` ile SINIRLIDIR (D8 düzeltmesi). Sınır
     KEYFİ değil: `KARAR:`/`ESKALE:` bu depodaki TÜM `docs/qa/*.md` dosyalarında satır 1-2'de
     (script ile tarandı, en yüksek gözlenen: `docs/qa/F-001.md` satır 8) — 10 satır bu gözlemin
     üzerinde rahat bir güvenlik payı, gerçek ilk `---` konumunun gözlenen üst sınırı (46) ise çok
     daha yüksek, yani sınır narrative gövdeyi güvenle dışarıda bırakıyor.
   - Ayraç hiç yoksa davranış AYNI kalıyor (`lines.slice(0, 5)`).
5. **Ölü `retry` temizleniyor** (`useProjectFeatureList.ts`): `UseProjectFeatureListResult`
   arayüzünden `retry` alanı ve dönüş değerindeki `retry: () => void load()` kaldırılıyor. `load`
   fonksiyonu `useEffect` içindeki kendi çağrısı için KALIYOR (hâlâ kullanılıyor).

## 4. Ölçülebilir kabul kriterleri

- [x] Kiril/CJK probe'ları (`__debt1_probe`) fix SONRASI KIRMIZI (ihlal bulunuyor) veriyor, sonra
      probe silinip commit'e karışmıyor. (Commit `8a1b668` — bkz. mesajdaki mutasyon notu.)
- [x] `.gitattributes`-adlı alt-dizin probe'u (`__debt2_probe`) fix SONRASI taranıp KIRMIZI veriyor.
      (Commit `8a1b668`.)
- [x] 4 yeni sınır-ihlali testi (`:1234`, `1234.1.1`, `msg_example12345`, `AB:`) eklendiğinde
      MEVCUT kodla (fix öncesi hâliyle, yani hiçbir regex değişmeden) zaten YEŞİL geçiyor (çünkü
      desenler doğru dar); bu testler var OLMADAN yapılan gevşetme mutasyonu (§2 madde 3) YEŞİL
      kalıyordu, VARKEN aynı mutasyon KIRMIZI verir — dört desenin dördü de `8a1b668`'in mesajında
      "reproduced and reverted the widening mutation for each" ile doğrulandı.
- [x] D8/D9 testleri `thread-detail.test.ts`'e eklendiğinde fix ÖNCESİ KIRMIZI, fix SONRASI YEŞİL.
      Commit `4ffabe4` sonrası ek doğrulama (bu turda): pre-fix `extractHeaderBlock`'a tam geri
      dönüş → D8 VE D9 ikisi de KIRMIZI (2/20 fail); elle geri alındı (`git diff --stat` temiz,
      `git checkout` KULLANILMADI); ardından yalnızca D8'in `MAX_HEADER_LINES` sınırını kaldıran
      TEK NOKTALI mutasyon → yalnızca D8 KIRMIZI, D9 YEŞİL kaldı (1/20 fail) — iki düzeltme
      birbirinden bağımsız doğrulandı, kaskad değil. Elle geri alındı, `git diff --stat` temiz.
- [x] `useProjectFeatureList.ts`'te `retry` kaldırıldıktan sonra `tsc --noEmit` ve `eslint` sıfır
      hata (bu turda tekrar doğrulandı); `grep -rn "useProjectFeatureList\|\.retry\b"
      src/features/thread` tek üretim tüketicisinin (`ThreadScreen.tsx:42`) `retry`'ı hiç
      destructure etmediğini, `grep -rln "useProjectFeatureList" tests/` sıfır eşleşme olduğunu
      (davranışı koruyan ayrı bir test dosyası yok, dolayısıyla kaldırma hiçbir testi kırmadı)
      doğruladı.
- [x] Mutasyon turu: 5 düzeltmenin BEŞİ de kanıtlı — madde 1-3 commit `8a1b668` mesajında
      (gevşetme mutasyonu → kırmızı → elle geri alma), madde 4 bu turda §4 yukarıda (iki ayrı
      mutasyon: tam geri dönüş + tek nokta), madde 5 kod kaldırma olduğu için mutasyon yerine
      grep+tsc+eslint ile "hiçbir yerden çağrılmıyor" kanıtı (bkz. §2 madde 5). Hiçbiri
      `git checkout`/`restore` ile geri alınmadı; her seferinde `git diff --stat` temiz doğrulandı.
- [x] `npm run test`: 2 kez koşuldu. 1. koşu ortamsal "Worker forks emitted error" (assert kırmızısı
      SIFIR, 86/87 dosya, 1831/1845 test — dosya/test sayımı silent-skip guard tarafından
      yakalandı) → CLAUDE.md kuralı gereği tekrar koşuldu → 2. koşu 86 passed/1 skipped (87),
      1841 passed/4 skipped (1845), sıfır kırmızı. `npm run e2e` izole koşuldu: **55/55 yeşil**
      (42.6s, tek worker). `npx tsc --noEmit`=0, `npx eslint .`=0,
      `node .claude/hooks/_selftest.cjs`=**206/206**. Tur sonunda `tasklist | grep node` boş
      (yetim süreç yok).

## 5. Kapsam dışı / bilinçli sınır

- `docs/blockers.md`'deki "D3 — transcript-reader.ts bayat yorumu" bu turun 5 maddesine DAHİL
  DEĞİL (brief'te açıkça listelenmedi); dokunulmuyor.
- Emoji/diğer sembol kategorileri (`\p{S}`, `\p{P}` dışındakiler) tokenizer'a dahil edilmiyor —
  brief'in odağı Kiril/CJK harflerdi, emoji ayrı bir borç olarak gerekirse ayrıca açılabilir.
- `MAX_HEADER_LINES = 10` yeni bir gerçek rapor formatı ortaya çıkarsa (ör. KARAR/ESKALE artık
  satır 1-2'de değil) yeniden ölçülmesi gereken bir varsayımdır — bu eşik sözleşmede AÇIKÇA not
  düşülüyor, gizli bir sabit değil.
