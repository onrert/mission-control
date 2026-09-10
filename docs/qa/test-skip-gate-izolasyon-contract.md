---
type: qa-contract
date: 2026-09-10
status: done
karar: GEÇTİ (docs/qa/G5-sozlesme-kararlari-2026-09-10-tur4.md). Port izolasyonu bağımsız üretildi: eski komut 7 `check-ports` hatası + EADDRINUSE veriyordu, yeni komut 0. Kalan kırmızılar (7 koşuda 3) worker fork çökmesi kaynaklı, assert kırmızısı yok — ayrı bir altyapı borcu olarak `docs/blockers.md`'de eşiğiyle kayıtlı.
---

# Sözleşme — B1 kalıcı regresyon testinin iç içe koşumunu paylaşılan kaynaklardan izole etme

**Kaynak:** `docs/qa/G5-sozlesme-kararlari-2026-09-10.md` §3.5, karar KALDI (5. sözleşme:
`docs/qa/test-skip-gate-contract.md`). Çitin ana vaadi zaten kanıtlanmış durumda (üç ayrı
yoldan doğrulandı, bu turda tekrar dokunulmadı). Bu düzeltme yalnızca kalıcı regresyon
testinin (`tests/verify-test-run.test.ts:414-445`, "B1 kalıcı regresyon" describe bloğu)
izolasyon eksiğini kapatıyor.

**Dosya sahipliği:** yalnızca `tests/verify-test-run.test.ts` (mevcut "B1 kalıcı regresyon"
testinin `--exclude` listesi genişletiliyor) ve bu sözleşme dosyası. `scripts/
verify-test-run.mjs`, `vite.config.ts`, `vitest.config.ts`, `tests/scripts/check-ports.
test.ts`, `tests/build-css.test.ts` — hiçbiri değişmiyor (aşağıda gerekçelendirildiği gibi,
bu dosyalara dokunmadan da izolasyon sağlanabiliyor).

## 1. Bu düzeltme neden var (tek cümle)

`npm run test`'in kalıcı regresyon testi, kendi başına gerçek suite'i ikinci kez eşzamanlı
koşturarak, izole olmayan iki paylaşılan kaynağa (sabit TCP portları 7333/7334 ve `dist/web`
derleme çıktısı) çarpıyor ve bu, depoda aylardır "vitest worker fork kararsızlığı" sanılan
flake'in **en az bir bölümünün gerçek kaynağı**.

## 2. Kök neden analizi — ÖLÇÜLDÜ, tahmin edilmedi

### 2.1 Hangi paylaşılan kaynaklar taranmış, sonuç

| Kaynak | Tarandı mı | Sonuç |
|---|---|---|
| TCP portları 7333/7334 | ✓ ölçüldü | **Çarpışıyor** — bkz. §2.2 |
| `dist/` çıktı dizini | ✓ ölçüldü (kod okuma + QA'nın önceki gözlemi) | **Çarpışıyor** — bkz. §2.3 |
| Geçici dizinler (`os.tmpdir()` altı) | ✓ grep ile tarandı | Çarpışmıyor — bu depodaki tüm gerçek-alt-süreç testleri (`network-capability-guard.test.ts`, `send-event-hook.test.ts`, vb.) `fs.mkdtempSync` veya `net.createServer().listen(0, ...)` (efemeral port) kullanıyor; her ikisi de OS tarafından benzersiz ayrılıyor. |
| `data/` altındaki kayıtlar | ✓ grep ile tarandı (`writeFileSync`/`mkdirSync` çağrıları) | Çarpışmıyor — repodaki testler `data/` yerine ya bellek-içi sahte depo ya da `mkdtempSync` kullanıyor; hiçbir test dosyası gerçek `data/` dizinine sabit bir yoldan yazmıyor. |
| Ortam değişkenleri | ✓ grep ile tarandı | Çarpışmıyor — testler kendi `env` kopyalarını (`{ ...process.env, ... }`) çocuk sürece geçiriyor; global/paylaşılan bir mutasyon yok. |

**Tarama yöntemi (dosya:satır):**
`grep -rn "listen(7\|listen(0,\|createServer()" tests/` ve `grep -rln "vite build\|spawnSync.*vite"
tests/` (yalnızca `tests/e2e/**` dışındaki dosyalar; o dizin zaten `vitest.config.ts:7`'nin
`exclude`'unda, hiç bu suite'e girmiyor).

### 2.2 Kaynak A — sabit TCP portları 7333/7334

`tests/scripts/check-ports.test.ts:71-97` **kasıtlı olarak** gerçek 7333 ve 7334'ü bağlıyor
(`server.listen(7333, '127.0.0.1')` satır 73; `server.listen(7334, '127.0.0.1')` satır 87) ve
ek olarak satır 60-65'teki test *"gerçek varsayılan portlar boş"* varsayımına dayanıyor
(yorum bunu açıkça kabul ediyor: *"Gerçek 7333/7334'ün bu makinede boş olduğu varsayımıyla"*).
Bu dosya `vitest.config.ts`'in `include` deseniyle eşleşiyor ve **hem dış (outer) hem iç içe
(nested) koşumda birer kopyası çalışıyor** — B1 kalıcı regresyon testi öncesi bu dosyayı
`--exclude` etmiyordu.

**Ölçüm (bu turda, deterministik):** kalıcı regresyon testinin bugün (düzeltme öncesi)
kullandığı **birebir komut** (`node scripts/verify-test-run.mjs --exclude tests/scripts/
install-hook.test.ts --exclude tests/verify-test-run.test.ts`) 7333'ü **dışarıdan** (harici
bir `net.createServer().listen(7333, ...)` ile, `npm run test`'in outer koşumunun kendi
`check-ports.test.ts` kopyasının o anda 7333'ü meşgul ettiği durumu simüle ederek) tutulmuş
hâlde çalıştırıldı:

```
[harness] gate exit status: 1
 ❯ tests/scripts/check-ports.test.ts (6 tests | 2 failed)
   × MC_PORT geçersizse gerçek varsayılan port (7333) kullanılır, 0 değil (Ö3)
 FAIL tests/scripts/check-ports.test.ts > ... gerçek varsayılan portlar boşsa exit 0 verir
 FAIL tests/scripts/check-ports.test.ts > ... (Ö3)
   Error: listen EADDRINUSE: address already in use 127.0.0.1:7333
 Test Files  1 failed | 82 passed | 1 skipped (84)
      Tests  2 failed | 1310 passed | 4 skipped (1316)
```

**Yorum:** bu, `docs/qa/g5-tur4-izin-karti-onizlemesi-contract.md`'nin kapanış notunda
*"paralel `.claude` turunun kendi canlı denetimi"* diye **yanlış teşhis edilen** aynı belirtinin
(`check-ports.test.ts`'in bir kez EADDRINUSE ile kırmızı vermesi) **doğru kaynağı**: `npm run
test` her koştuğunda hem outer hem nested süreç kendi `check-ports.test.ts` kopyasını taşıyor;
ikisinin 7333'e aynı anda dokunma penceresi çakışırsa (ya da burada olduğu gibi bir üçüncü
taraf 7333'ü tutuyorsa) nested kopya da kırmızı veriyor — bu **B1 çitinin kendisini** değil,
kalıcı regresyon testinin **iç içe kopyasını** etkiliyor.

### 2.3 Kaynak B — `dist/web` derleme çıktısı

`vite.config.ts:19-22`: `outDir: '../../dist/web'`, `emptyOutDir: true`. `tests/
build-css.test.ts` bu dizine **4 ayrı `describe`/`beforeAll` bloğunda** (satır 28-37, 80-89,
138-147, 192-201) gerçek `vite build` çağırıyor; her çağrı önce dizini **boşaltıyor**
(`emptyOutDir: true`), sonra yeniden dolduruyor. Bu dosya da hem outer hem nested koşumda
birer kopya olarak çalışıyordu (B1 kalıcı regresyon testi öncesi `--exclude` listesinde yoktu).

**Ölçüm ve dürüstlük notu:** bu turda gerçek bir eşzamanlı `vite build` çakışmasını canlı
zorlamaya çalışan bir deneme (harici döngüde sürekli `vite build` çalıştırıp aynı anda nested
komutu koşturmak) pratik/performans nedeniyle güvenilir sonuç vermeden yarıda kesildi
(betik `spawnSync` içeren `while` döngüsünü `async` fonksiyon içine yanlış yazdığım için event
loop'a hiç dönmedi, süreç askıda kaldı ve elle sonlandırıldı — scratchpad script hatası, depoya
hiç dokunmadı). Bu nedenle bu spesifik çakışma **bu turda yeniden zorlanarak üretilmedi**.
Ancak `docs/qa/G5-sozlesme-kararlari-2026-09-10.md` §3.5 bunu zaten **bir kez canlı gözlemlemiş**
(koşu 1: `ENOENT ... scandir 'dist\web\assets'`) ve mekanizmayı kod okumasıyla doğrulamış
(`emptyOutDir: true`'yu tetikleyen tek kod yolu `vite build`, ve iki eşzamanlı `vite build`
birbirinin çıktısını silebilir). **Oluş ✓ önceki turda gözlemlendi, mekanizma ✓ kod okumasıyla
doğrulandı, bu turda yeniden zorlama ✗ denenmedi (denendi, güvenli biçimde vazgeçildi).**
Bu dürüstlük notu §7'de tekrarlanıyor.

Aşağıdaki mekanizma (madde 3) bu kaynağı da **olasılık azaltarak değil, yapısal olarak**
ortadan kaldırıyor: `build-css.test.ts` nested koşumdan tamamen çıkarılınca, nested sürecin
`vite build`'e hiç dokunmaması **kodun kendisinden** garanti ediliyor (bkz. §5 "Test Files"
sayısı kanıtı) — zamanlamaya bağlı bir iyileşme değil.

## 3. Mekanizma (adıyla) — seçim ve gerekçe

**Seçilen: iç içe koşumu, paylaşılan kaynağa dokunan iki test dosyasını (`tests/scripts/
check-ports.test.ts`, `tests/build-css.test.ts`) `--exclude` ile dışlayacak şekilde
daraltmak.**

Değerlendirilen alternatifler:

| Seçenek | Neden seçilmedi |
|---|---|
| Nested koşuma efemeral/dinamik port (ör. `MC_PORT=0`) vermek | `check-ports.test.ts`'in **kendi konusu** sabit varsayılan port davranışıdır (`resolvePort` gerçek 7333'e düşüyor mu); bir env değişkeniyle bunu bypass etmek testin ölçtüğü şeyi bozar, product/test kodunu (`src/**`, mevcut testler) değiştirmeyi gerektirir — brief'in "mevcut testlerin hiçbiri değişmez" kısıtına aykırı. |
| Nested koşuma ayrı bir `outDir`/geçici dizin vermek | `vite.config.ts`'in `outDir`'i ortam değişkenine bağlı değil (sabit `../../dist/web`); bunu parametrik hâle getirmek **ürün kodunu** (`vite.config.ts`) değiştirmek demek — dosya sahipliği dışına çıkar, "gereksiz soyutlama ekleme" (CLAUDE.md ilke 2) sayılır: tek ihtiyaç iki test dosyasını nested koşumdan çıkarmak, tüm build sistemini parametrize etmek değil. |
İç içe koşumu tamamen kaldırıp yalnızca sahte (`fake-vitest-*.mjs`) betiklerle ölçmek | Zaten var olan fixture testleri (satır 340-411) bunu yapıyor, ama B1'in **gerçek** kanıtı (QA'nın kendi talebi, `docs/qa/G5-sozlesme-kararlari-2026-09-10.md`: *"kalıcı test yap ... fixture ile taklit edilemez"*) tam olarak gerçek `vitest.config.ts` + gerçek dosya sistemi + gerçek `vitest`'i gerektiriyor; bu seçenek B1'in kalıcı regresyon kanıtını tamamen kaldırır, kabul edilemez. |
| **Paylaşılan kaynağa dokunan dosyaları `--exclude` ile daraltmak** | Tek satırlık, cerrahi değişiklik; yalnızca `tests/verify-test-run.test.ts`'in kendi `spawnSync` çağrısına iki `--exclude` bayrağı ekliyor; hiçbir başka dosyaya dokunmuyor; testin ölçtüğü şeyi (disk sayısı ≠ raporlanan sayı) **değiştirmiyor** çünkü beklenen sayı (`computeExpectedFileCount`) `vitest.config.ts`'in kendi include/exclude'undan türetiliyor, CLI `--exclude` bayraklarından değil (`scripts/verify-test-run.mjs:210-218` — bkz. §4) — yani ek dışlamalar testin "silme tespit ediliyor mu" iddiasını **güçlendiriyor** (daha büyük, hâlâ doğru tespit edilen bir fark), zayıflatmıyor. QA'nın kendi önerisiyle birebir örtüşüyor (§3.5 "Kapanış için gereken"). |

## 4. Neden bu daraltma testin ölçtüğü şeyi bozmuyor (kritik doğrulama)

`scripts/verify-test-run.mjs:338-355` (`resolveExpectedFileCount`): `explicitFilterGiven`
`hasExplicitPositionalFilter`'a bakıyor — bu yalnızca **pozisyonel** bir argüman olup
olmadığını kontrol ediyor (`--exclude X` gibi yalnızca bayrak argümanları pozisyonel
SAYILMIYOR, satır 235-245). Dolayısıyla dört `--exclude` bayrağıyla (eski 2 + yeni 2) çağrılan
nested komut hâlâ `explicitFilterGiven = false` alıyor, yani `computeExpectedFileCount`
**hâlâ çalışıyor** ve `vitest.config.ts`'in include/exclude'undan (CLI bayraklarından değil)
diskteki **86** dosyayı bekliyor. Nested vitest ise gerçekte yalnızca **82** dosya
çalıştırıyor (86 - 4 dışlanan). `82 ≠ 86` → test hâlâ **kırmızı** (`toContain('does not match
the')` assert'i hâlâ tutuyor) — testin amacı (bir dosyanın CLI bayrağıyla sessizce
düşürülmesini tespit etmek) **değişmiyor**, yalnızca düşürülen dosya sayısı 2'den 4'e çıkıyor.

## 5. Ölçülebilir kabul kriterleri

1. `tests/verify-test-run.test.ts:414-445`'teki "B1 kalıcı regresyon" testinin `spawnSync`
   çağrısına `--exclude tests/scripts/check-ports.test.ts` ve `--exclude tests/build-css.
   test.ts` eklenir (mevcut iki `--exclude` bayrağına ek, çıkarma değil).
2. Testin kendisi hâlâ **kırmızı** bekliyor olmalı (`res.status).not.toBe(0)`,
   `res.stderr).toContain('does not match the')`) — davranış değişmiyor, yalnızca dışlanan
   dosya sayısı değişiyor.
3. **Deterministik kanıt:** port 7333 harici olarak tutulup aynı (güncellenmiş) komut
   çalıştırıldığında, çıktıda `"check-ports"` dizesi **hiç geçmemeli** (dosya artık nested
   koşuma hiç dahil değil) — düzeltme öncesi bu dizenin geçtiği ve 2 testin EADDRINUSE ile
   kırmızı verdiği ölçülmüştü (§2.2).
4. `npm run test` **beş ardışık koşu** aynı sonucu vermeli (1371 geçti / 4 atlandı, 85 dosya —
   bu tur başı taban; kalıcı regresyon testinin kendisi bu 85 dosyanın biri).
5. `npm run test -- --exclude tests/scripts/check-ports.test.ts` (B1'in orijinal zorlanmış
   repro'su, artık farklı bir dosyayla) hâlâ kırmızı vermeli (çitin ana vaadi bozulmamalı).
6. Mutasyon: yeni eklenen iki `--exclude` bayrağı elle geri alınıp (çitin kendisi değil, bu
   izolasyon düzeltmesi geri alınarak) test tekrar çalıştırıldığında port çakışması kanıtı
   (madde 3) yeniden ortaya çıkmalı — `git checkout` KULLANILMADAN, elle ters işlemle geri
   alınacak.
7. `npx tsc --noEmit` = 0, `npx eslint .` = 0.
8. `node .claude/hooks/_selftest.cjs` yalnızca çalıştırılır (dosyaya dokunulmaz), sonucu
   raporlanır.

## 5b. Uygulama sonrası kanıt (bu turda ölçüldü)

**Düzeltme öncesi (mutasyon/karşılaştırma noktası) — port 7333 harici tutulup TAM OLARAK
`tests/verify-test-run.test.ts`'in eski (2 `--exclude`'lu) komutu çalıştırıldı:**

```
[harness] gate exit status: 1
"check-ports" mentions in output: 7
FAIL tests/scripts/check-ports.test.ts > ... gerçek varsayılan portlar boşsa exit 0 verir
FAIL tests/scripts/check-ports.test.ts > ... (Ö3)  Error: listen EADDRINUSE: address already in use 127.0.0.1:7333
Test Files  1 failed | 82 passed | 1 skipped (84)
```

**Düzeltme sonrası (aynı harici port tutma, yeni 4 `--exclude`'lu komut):**

```
[harness] gate exit status: 1
"check-ports" mentions in output: 0
Test Files  81 passed | 1 skipped (82)
    - "Test Files" total reported by vitest (82) does not match the number of test files on
      disk matching vitest.config.ts's include/exclude patterns (86)
```

`check-ports.test.ts` artık nested koşuma hiç girmiyor (0 geçiş, dosya sayısı 84→82), çitin
kendisi hâlâ doğru şekilde kırmızı (madde 4'ün önden verdiği garanti tutuyor).

**Mutasyon (elle, `git checkout` KULLANILMADAN):** yeni iki `--exclude` bayrağı `Edit` ile
kaldırılıp aynı harici-port deneyi tekrarlandı → port çakışması **aynen geri geldi** (7
"check-ports" geçişi, 2 FAIL, EADDRINUSE) — düzeltmenin gerçekten bu çakışmayı önlediğinin
kanıtı. Ardından `Edit` ile birebir ters işlemle geri eklendi; `diff` ile dosyanın düzeltilmiş
hâliyle **bayt bayt aynı** olduğu doğrulandı.

**`npm run test` — 7 ardışık koşu (brief 5 istiyordu, karışık sonuç nedeniyle 7'ye çıkarıldı):**

| Koşu | Sonuç | Not |
|---|---|---|
| 1 | YEŞİL | 1371 geçti / 4 atlandı, 85/86 dosya |
| 2 | YEŞİL | 1371 / 4, 85/86 |
| 3 | **KIRMIZI** | `crash signature detected: "Worker forks emitted error"` — bilinen, `CLAUDE.md`'de kayıtlı organik worker-fork çökmesi sınıfı. `check-ports`/`build-css`/`EADDRINUSE`/`ENOENT` **hiçbiri** çıktıda yok — bu turun düzelttiği kaynak sınıfıyla **ilgisiz**, çit doğru şekilde kırmızı verdi. |
| 4 | **KIRMIZI** | `tests/integration/send-event-hook.test.ts:185` — gerçek bir test **assertion**'ı başarısız (`expect(events).toHaveLength(1)`), gate'in kendi mantığı değil. Bu dosya efemeral port (`listen(0)`) kullanıyor, sabit kaynak paylaşmıyor — bu turun kapsamındaki B1/port/dist sınıfıyla **ilgisiz görünüyor**. Dosya sahipliği bu sözleşmenin dışında (`tests/integration/send-event-hook.test.ts`), düzeltilmedi. |
| 5 | YEŞİL | 1371 / 4, 85/86 |
| 6 | YEŞİL | 1371 / 4, 85/86 |
| 7 | **KIRMIZI** | Yine `"Worker forks emitted error"` — koşu 3 ile aynı sınıf. |

**Dürüstlük — bu turun hedeflediği çakışma sınıfı 0/7 koşuda görüldü** (hiçbir koşuda
`check-ports`, `EADDRINUSE`, `build-css` veya `dist/web` ile ilgili bir hata çıkmadı) —
bu, §5b'nin yukarıdaki doğrudan kanıtıyla birlikte düzeltmenin **hedeflediği** sınıfı
kapattığını gösteriyor. Ancak makine bu turda **yoğun bellek baskısı altındaydı**
(`Total Physical Memory: 32535 MB`, `Available: 11587 MB` — ~%64 kullanımda, muhtemelen bu
oturumdan bağımsız başka süreçler/uygulamalar) ve bu, 3/7 koşuda görülen **başka, bu
sözleşmenin kapsamı dışındaki** kırmızıları (organik worker-fork çökmesi ×2, `send-event-
hook.test.ts` zamanlama flake'i ×1) açıklayan makul bir ortam faktörü olabilir — ama bu
**çıkarım**, ölçülmüş bir kanıt değil. `send-event-hook.test.ts` flake'i **yeni gözlemlenen,
daha önce bu depoda adı geçen bir sınıfla eşleşmeyen** bir bulgu; ayrı bir incelemeyi hak
ediyor ama bu sözleşmenin dosya sahipliği dışında olduğu için burada düzeltilmedi.

## 6. Kapsam dışı / bilinçli yapılmayanlar

- `check-ports.test.ts`'in kendi "gerçek 7333/7334 boş" varsayımını (genel host-ortam
  kırılganlığı, nesting'den bağımsız) düzeltmek — bu ayrı bir sorun sınıfı, bu sözleşmenin
  konusu değil (dosya sahipliği dışında).
- `vite.config.ts`'e parametrik `outDir` eklemek — gereksiz soyutlama, madde 3'te
  gerekçelendirildi.
- `dist/` çakışmasını canlı, zorlanmış bir eşzamanlılıkla yeniden üretmek — §2.3'te
  dürüstçe not edildi, denenmedi denemedi değil, denendi ve güvenli biçimde vazgeçildi;
  yapısal çözüm (dosyayı nested koşumdan tamamen çıkarmak) zaten zamanlamadan bağımsız.

## 7. CLAUDE.md düzeltmesi (ayrı görev, aynı tur)

`CLAUDE.md`'nin "vitest worker fork kararsızlığı" kuralı **silinmeyecek**, altına bu turun
bulgusunu düzelten yeni bir madde eklenecek: gözlenen flake'in **en az bir bölümünün** gerçek
kök nedeni artık ölçülü (bu sözleşmenin kendi testi/kalıcı regresyon testinin paylaşılan
kaynaklara çarpması), "bir kez daha koştur" bir teşhis değil semptom yönetimidir. `dist/`
yarışı hâlâ "gözlenmiş oluş, çıkarılmış mekanizma" durumunda kalıyor (yeniden zorlanmadı, ama
yapısal olarak artık imkânsız hâle getirildi).
