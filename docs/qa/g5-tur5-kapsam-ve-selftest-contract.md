---
status: done
karar: GEÇTİ (docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md). Y3 (self-test gerçek onay dosyalarını siliyordu) kapandı ve emniyet kemeri 4/4 doğrulandı; Y1 kısmının mekanizması JSON tasarımıyla yürürlükten kalktı ama kusur kapandı.
---

# G5 Tur 5 — Y1 (kapsam sızıntısı) ve Y3 (self-test'in gerçek onayları imha etmesi) düzeltmesi

Kaynak: `docs/qa/G5-guvenlik-denetimi-2026-09-10-tur5.md` §3.1 (Y1, BLOKLAYICI) ve §3.3 (Y3,
BLOKLAYICI). Bu turun tek işi bu iki bulguyu kapatmaktır. Y2 ve Y4 bu turun kapsamı DIŞINDADIR
(denetim raporu bunları "eşikli borç" olarak sınıflandırdı, bloklayıcı değil).

## Bu düzeltme neden var (tek cümle)

- **Y1:** `GUARD.ok`'un "## Gerekçe" gibi düzyazı bölümünde salt AÇIKÇA reddedilerek ("bu KAPSAM
  DIŞI") anılan bir dosya adı bile — gerçek CEO operasyonunda iki kez gözlemlendiği gibi —
  kapsama sessizce dahil oluyordu; kullanıcının onayladığı DEĞİŞİKLİK ile sistemin uygulayacağı
  DEĞİŞİKLİK farklıydı.
- **Y3:** `_selftest.cjs`, rutin bakımın standart bir parçası olarak çalıştırılıyor ama
  kullanıcının GERÇEK, henüz tüketilmemiş bir onayını (`docs/approvals/GUARD.ok` vb.) hiçbir
  ayrım yapmadan siliyordu — bir güvenlik testinin, koruduğu şeyi tahrip etmesi.

## Y1 — mekanizma ve karar noktaları

**Mekanizma:** `parseGuardScope()` artık metnin TAMAMINI değil, YALNIZCA `"## Kapsam"` başlığının
BLOĞUNU (o başlık satırından bir sonraki `"##"` başlığına ya da dosya sonuna kadar olan aralığı)
tarar. O blok dışında geçen hiçbir backtick'li ad kapsam sayılmaz.

Karar noktaları (brief §2):

1. **Başlık hiç yoksa:** fail-closed — boş kapsam (`Set` boyutu 0) döner. Çağıran taraf zaten
   `scope.size === 0` durumunda tüm guarded yazmaları reddediyor (mevcut davranış, değişmedi).
2. **Başlık birden çok kez geçerse:** belirsiz sayılır, fail-closed (boş kapsam). Gerekçe: hangi
   bloğun "gerçek" kapsam olduğuna dair güvenilir bir sezgi yok; ilk/son bloğu seçmek keyfi bir
   varsayım olur, bu depoda "belirsizlikte fail-closed" ilkesiyle çelişir.
3. **Başlık harf/boşluk varyantlarıyla yazılırsa** (`## Kapsam`, `##Kapsam`, `## KAPSAM`,
   `##   kapsam`): hepsi `/^\s*##\s*kapsam\s*$/i` ile tanınır — Windows harf duyarsızlığı bu
   depoda dört kez tuzak oldu, aynı disiplin burada da uygulanıyor.
4. **Bölüm var ama içinde hiç backtick'li ad yoksa:** blok boş metin üretir, regex hiçbir eşleşme
   bulamaz, kapsam boş kalır → fail-closed (aynı `scope.size === 0` yolu).
5. **Bölümden SONRA gelen metinde ad geçerse:** blok sınırı (`blockEnd`, bir sonraki `##`
   başlığı ya da dosya sonu) bu adı asla içermez — asıl kusur buydu, artık yapısal olarak imkânsız.

**Kapsam dışı bırakılan:** başlık üç veya daha fazla `#` ile yazılırsa (`### Kapsam`) tanınmaz —
brief yalnızca `##` varyantlarını istedi, `###` için ayrı bir karar verilmedi; bu bilinen bir sınır
olarak kayda geçiyor (gelecekte istenirse `anyHeaderRe`/`kapsamHeaderRe`'nin `#{2,}` kabul edecek
şekilde genişletilmesi tek satırlık bir değişiklik olur).

**Yan etki (bilinçli):** `writeGuardScope()` self-test yardımcı fonksiyonu artık ürettiği GUARD.ok
metnine `"## Kapsam"` başlığı ekliyor (önceden düzyazı içine serpiştiriyordu). Bu, GERÇEK
onay metinlerinin de bundan böyle bu yapıyı taşıması gerektiği anlamına gelir — `gate-check.cjs`'in
red mesajı bunu açıkça belirtiyor ("GUARD.ok yalnızca '## Kapsam' başlığı altında...").

## Y3 — mekanizma ve karar noktaları

**Mekanizma (iki bağımsız katman, ikisi de uygulandı):**

1. **Emniyet kemeri (pre-check):** Betik, başka HİÇBİR ŞEY yapmadan önce, çağıranın GERÇEK
   `process.cwd()`'sindeki `docs/approvals/{PUSH.ok,DANGER.ok,GUARD.ok,.guard-state.json}`
   dosyalarından herhangi biri var mı diye bakar. Varsa: net bir hata mesajıyla (hangi dosyalar,
   ne yapılması gerektiği) `process.exit(3)` — sıfırdan farklı çıkış kodu, hiçbir dosyaya
   dokunulmadan.
2. **Asıl çözüm (izolasyon):** Pre-check geçerse betik, `.claude/hooks/*.cjs` (kendisi hariç)
   dosyalarını BİREBİR kopyalayarak, kendi izole `docs/approvals/`+`assets/` yapısını kuran geçici
   bir dizine (`fs.mkdtempSync`) `process.chdir()` yapar. Betiğin GERİ KALANI (tüm
   dangerCases/gateCases/(c)(e)(f)/Y1/Katman A/K-A/K-B/fail-closed testleri) HİÇBİR DEĞİŞİKLİK
   OLMADAN çalışır — çünkü hook'ların kendisi (`_common.cjs`, `gate-check.cjs`,
   `block-dangerous.cjs`) zaten `process.cwd()`'ye göreli yollarla çalışıyor, mutlak yol hardcode
   etmiyorlar. Süreç çıkışında (`process.on('exit', ...)`) sandbox'a geri `chdir` yapılıp tüm
   sandbox ağacı `fs.rmSync(..., {recursive:true})` ile silinir.

**"Mümkün mü?" araştırması (brief'in istediği):** EVET, mümkün — ve UYGULANDI (madde 2, asıl
çözüm). `gate-check.cjs`/`block-dangerous.cjs`/`_common.cjs` üçü de onay yollarını sabit
(hardcode mutlak yol yok) `docs/approvals/...` göreli dizgeleriyle çözüyor; bu dizgelerin
kaynağı her zaman `process.cwd()`. `execFileSync('node', [...])` de cwd override verilmediğinde
ebeveynin (bu betiğin) `process.cwd()`'sini miras alır. Dolayısıyla betiğin en başında
`process.chdir()` yapmak, TÜM alt-çağrıları ve doğrudan `fs.*` işlemlerini otomatik olarak
sandbox'a taşır — hook kodlarında HİÇBİR değişiklik gerekmedi. Pre-check (madde 1) artık yalnızca
ikincil bir emniyet katmanı: sandbox kurulumu (mkdtemp/copy/mkdir) her nasılsa başarısız olursa
diye (`try/catch` ile net hatayla `exit(4)`).

**Fixture notu:** `gateCases`'in `SRC_FILE` senaryosu gerçek repoda `docs/approvals/G2.ok`'un VAR
olduğu varsayımına dayanıyordu (o zaman `src/**` serbesttir). Sandbox kendi izole `G2.ok`
fixture'ını yazıyor — gerçek `G2.ok`'a hiç dokunulmuyor/okunmuyor.

## Ölçülebilir kabul kriterleri

Tüm sayılar **sandbox mirror'da** (`%TEMP%\...\scratchpad\y5outer`), gerçek repoya dokunulmadan
ölçüldü:

| # | Kontrol | Beklenen | Ölçülen |
|---|---|---|---|
| 1 | Orijinal (düzeltmesiz) 3 dosya + orijinal `_selftest.cjs`, bağımsız taze sandbox'ta | 98/98 GEÇTİ | 98/98 GEÇTİ |
| 2 | Düzeltilmiş `gate-check.cjs` + düzeltilmiş `_selftest.cjs` (8 yeni Y1 vakası dahil) | 106/106 GEÇTİ | 106/106 GEÇTİ |
| 3 | Y1 sondası: `## Kapsam` bölümü dışında (gerekçede) anılan ad | exit 2 (reddedilir) | exit 2 |
| 4 | Y1 sondası: `## Kapsam` bölümü içindeki ad | exit 0 (kabul + token tüketilir) | exit 0, tüketildi |
| 5 | Y1 sondası: başlık hiç yok | fail-closed (exit 2) | exit 2 |
| 6 | Y1 sondası: başlık harf/boşluk varyantı (`##Kapsam`, `## KAPSAM`) | tanınır (exit 0) | exit 0 (ikisi de) |
| 7 | Y1 sondası: bölüm boş (backtick yok) | fail-closed (exit 2) | exit 2 |
| 8 | Y1 sondası: birden fazla `## Kapsam` başlığı (belirsiz) | fail-closed (ikisi de exit 2) | exit 2 / exit 2 |
| 9 | Y3 sondası: gerçek (stand-in) `docs/approvals/GUARD.ok` pending iken self-test | exit 3, dosya İÇERİĞİ DEĞİŞMEDEN kalır | exit 3, içerik birebir aynı |
| 10 | Y3 sondası: pending yokken self-test | normal çalışır, exit 0 | exit 0, 106/106 |
| 11 | Y3 sondası sonrası: stand-in "gerçek" `docs/approvals/` içinde sandbox artığı yok | yalnızca önceden var olan fixture | doğrulandı |
| 12 | Gerçek `docs/approvals/*.ok` SHA-256 (bu tur boyunca) | öncesi = sonrası | 6/6 birebir aynı |
| 13 | Gerçek `.claude/hooks/*.cjs` MD5 (bu tur boyunca) | öncesi = sonrası (hiç yazılmadı) | 4/4 birebir aynı |

## Mutasyon kanıtları

**Y1 (iki ayrı mutasyon, sandbox'ta, `git checkout` KULLANILMADI — dosyalar scratchpad'de,
üzerine yazılarak geri alındı):**

- **Mutasyon A** — `parseGuardScope`'u eski (bölüm sınırı olmayan, metnin tamamını tarayan)
  hâline döndür: **102/106 GEÇTİ, 4 KIRMIZI** — tam olarak beklenen 4 Y1 vakası
  (`y1-b` gerekçe-kapsam-dışı, `y1-d` başlık-yok, `y1-e` belirsiz-başlık, `y1-h` boş-bölüm).
  `y1-a/c/f/g` (pozitif yol + varyant tanıma) YEŞİL kaldı — çit gerçekten hedeflenen davranışı
  ölçüyor, komşu bir yolu değil.
- **Mutasyon B** — YALNIZCA "birden fazla başlık → fail-closed" dalını kaldır (ilk başlığı
  kullanacak şekilde gevşet), bölüm-sınırlama mekanizmasının geri kalanı sabit: **105/106 GEÇTİ,
  1 KIRMIZI** (`y1-e`, tam olarak o karar noktası). Diğer 7 Y1 vakası dahil TÜM diğer testler
  yeşil kaldı — bu, her karar noktasının BAĞIMSIZ ölçüldüğünü, kaskad bir yeşil/kırmızıya
  dayanmadığını kanıtlıyor.

**Y3 (iki mutasyon, "stand-in gerçek" olarak `y5outer` sandbox'ı kullanıldı; içine gerçek bir
kullanıcı onayını taklit eden imzasız bir `GUARD.ok` marker dosyası — `REAL-USER-APPROVAL-
MARKER-XYZ` içerikli — yerleştirildi):**

- **Mutasyon 1** — yalnızca pre-check bloğunu kaldır, izolasyon (chdir+sandbox) yerinde kalsın:
  sonuç `exit=0` / `"TUM TESTLER GECTI"` — REDDETMESİ gereken senaryoda sessizce devam etti
  (davranış sözleşmesi KIRMIZI: beklenen exit 3, gözlenen exit 0). Ancak marker dosyasının
  İÇERİĞİ birebir korundu (izolasyon katmanı hâlâ gerçek dosyayı koruyor) — bu, iki katmanın
  BAĞIMSIZ olduğunu gösteriyor: pre-check'in kaybı yalnızca "reddet" sözleşmesini kırıyor,
  dosya güvenliğini değil.
- **Mutasyon 2** — düzeltmeyi BİREBİR eski hâline döndür (gerçek, değiştirilmemiş orijinal
  `_selftest.cjs`, ne pre-check ne izolasyon): marker dosyası çalıştırma sonunda **tamamen
  silindi** (`docs/approvals/GUARD.ok` yok oldu) — orijinal betiğin sonundaki koşulsuz `rm()`
  temizlik bloğu. Bu, Y3'ün ele aldığı gerçek tehlikenin sandbox'ta birebir yeniden üretilmiş
  kanıtıdır: düzeltme olmadan, kullanıcının GERÇEK onayına benzer bir dosya sessizce yok oluyor.

## Kapsam dışı bırakılanlar

- Y2 (block-dangerous çapraz eşleşme yanlış pozitifi) ve Y4 (`.claude/hooks/**` için Katman B
  simetrisi eksikliği) — denetim raporu bunları bloklayıcı saymadı, bu tur dokunmuyor.
- `### Kapsam` (üç veya daha fazla `#`) başlık varyantı — brief yalnızca `##` istedi, bilinen
  sınır olarak yukarıda not edildi.
- `.claude/hooks/**` altındaki diğer `.cjs` dosyaları (asset-guard, post-format, send-event,
  session-start, stop-check) — Y3'ün kopyalama döngüsü bunları da (kendisi hariç TÜMÜNÜ)
  sandbox'a taşıyor ama içerikleri bu turda değiştirilmedi.
- `npm run test` / `npm run e2e` bu turda çalıştırılmadı — kapsam yalnızca iki hook dosyası ve
  self-test'tir, `src/`'ye dokunulmadı.
