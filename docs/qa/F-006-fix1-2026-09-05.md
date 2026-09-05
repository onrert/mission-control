KARAR: GEÇTİ
ESKALE: false

# F-006 — yazma kapısı + sınır testleri · QA **düzeltme turu 1** doğrulaması (qa-evaluator, 2026-09-05)

Kapsam (bağlayıcı, dar tur): B1, B2, Ö1-Ö5, D34-D39 ve düzeltmenin ürettiği regresyon.
Yeniden açılmadı: delme denemelerinin sonucu, fazlalık iddiasının doğruluğu, F-005 regresyonu,
kapsam denetimi, ADR-013/ADR-008 denetimi (hepsi `docs/qa/F-006-2026-09-05.md`'de duruyor).
İncelenen commit'ler: `75eae40` · `ed53893` · `24298d2` · `25850c8`.

Ürün kodu **kalıcı değiştirilmedi**: 12 mutasyonun tamamı uygulandıktan sonra geri alındı,
`git diff HEAD -- src tests` **boş** (kanıt §7).

## Puanlar

| Boyut | Önceki | Şimdi | Gerekçe |
|---|---|---|---|
| İşlevsellik | 7 | **8** | Ö2'nin ölçülen frontmatter bozulması kapandı: `x⏎---⏎BODY`, `\r`, `\r\n` ve tek `\r` varyantlarının hepsi `invalid_body` alıyor ve **dosya bayt bayt değişmiyor** (ölçüldü, §4). Düşüren: `safeYamlValue` (`write-gate.ts:190`) hâlâ yalnızca `:#\r\n` görünce tırnaklıyor; `"x`, `[x`, `*x`, `!x` gibi YAML gösterge karakteriyle **başlayan** değerler ayrıştırılamaz bir `status:` satırı üretiyor (NOT-3 — bugün çağıranı yok). |
| Özellik bütünlüğü | 5 | **8** | AC3 artık gerçekten çitli: `write-gate.ts`'e eklenen **5 farklı silme yolu** (unlinkSync / rmSync / promises.unlink / rmdir / fsp.rm) **beşi de KIRMIZI** (§3 M1-M5). AC7'nin taraması önceki turun **9 kaçağının 9'unu da** yakalıyor (§5). AC5'in yanlış "statik tarama doğrular" iddiası metinden çıkarıldı (Ö3). Düşüren: alıcı-takma-adı + belirsiz-ad birleşimi hâlâ kaçıyor (NOT-1) ve adım 6'nın bağımsız kapsaması sıfır (NOT-4). |
| Görsel/UX (doküman + hata mesajları) | 7 | **7** | D38'in yeni mesajı ayırt edici ve Türkçe (`status değeri satır sonu içeremez.`); sözleşme/feature notu artık kendi sınırlarını dürüst yazıyor. Değişmedi: NOT-2'nin (harf duyarlılığı) teşhis edilemez `İşlem, hedef yolla eşleşmiyor.` mesajı ve F-006 için kullanıcıya dönük hiçbir not — CEO bunları bilinçli olarak N5'te kapsam dışı bıraktı, dolayısıyla önceki tur gerekçesi aynen ayakta. |
| Kod kalitesi | 6 | **8** | İki tekrarlayan sınıf da kapandı: `archiveDenial`'ın hata dalı artık çitli (M8 KIRMIZI) ve guard'ın **yorumu ile taradığı** ayrışması giderildi (bare/scoped ikili tasarımın gerekçesi kodda yazılı ve doğru: `process.stderr.write(` gibi meşru kullanımlar bu yüzden yanlış pozitif üretmiyor — `src/features/events/server/ingest.ts:79`, `src/features/projects/server/service.ts:60,79`). Düşüren: `safeYamlValue` adı yaptığından fazlasını vaat ediyor (NOT-3); dizge-seviyesi izinli küme değişken adına duyarlı (NOT-2). |

**Dört boyut da ≥ 7 → GEÇTİ.** Açık BLOKLAYICI/ÖNEMLİ bulgu yok; kalan 4 madde NOT.

---

## 1. Komutlar — kendim çalıştırdım

| Komut | Çıkış kodu | Gerçek çıktı |
|---|---|---|
| `npm run verify` | **0** | typecheck + lint + `Test Files 41 passed (41)` / `Tests 564 passed (564)` + `vite build ✓ built in 999ms` |
| `npm run e2e` | **0** | `15 passed (15.2s)` |
| `npm run e2e:dev` | **0** | `1 passed (4.4s)` |

Developer'ın bildirdiği sayılar (**564** / 15 / 1) **birebir doğrulandı**; N1'in sayı sapması
(`docs/progress.md:1288` artık "564/564 test, 41 dosya") kapandı.

---

## 2. B1/B2/Ö1-Ö5/D34-D39 kapanış tablosu

| # | Karar | Durum | Bağımsız kanıtım |
|---|---|---|---|
| **B2** | D34 | ✅ **KAPANDI** | `write-gate.ts` artık dosya-seviyesinde muaf **değil** (`no-write-gate-bypass.test.ts:130` `scannedFiles = allSourceFiles`, filtre yok; muafiyet `STORE_FILES:141-163`'te **tam çağrı metni** olarak). Beş ayrı silme mutasyonu (M1-M5) **beşi de KIRMIZI** ve hepsi aynı testten düşüyor: *"write-gate.ts: DENIED ile eşleşen her çağrı izinli kümedeki tam dizgelerden biriyle eşleşir"*. İstisna gerçekten **dize seviyesinde**. |
| **B1** | D35 | ✅ **KAPANDI** | Önceki turun **9 kaçağının 9'u da yakalanıyor** (§5, gerçek `src/server/index.ts`'e enjekte edilip tarama koşturularak ölçüldü — desen listesine bakılarak değil). `'fs.rm('` nesne-öneki bağımlılığı giderildi: `fsp.rm(`, `promises.rm(`, `fs.promises.rm(` üçü de yakalanıyor. |
| **Ö1** | D36 | ✅ **KAPANDI** | M8 (`mkdirSync`+`renameSync` `try` **dışına**) → **KIRMIZI, 10 test**; ilk düşen tam da yeni eklenen `arşiv hedef dizini bir dosyayla işgal edilmişse fırlamaz, write_failed döner (D36/Ö1)` testi. |
| **Ö2** | D38 | ✅ **KAPANDI** (dar tanımıyla) | M7 (satır sonu kontrolü etkisizleştirildi) → **KIRMIZI, 3 test**. Çalışma zamanı ölçümü (§4): `\n`, `\r`, `\r\n`, tek `\r`, sondaki `\n` → hepsi `invalid_body` + **dosya UNCHANGED**. Test yalnızca dönen kodu değil, `expect(fs.readFileSync(full,'utf8')).toBe(before)` ile **dosyanın bozulmadığını** da assert ediyor (`write-gate.test.ts:212-224`). Kalıntı → NOT-3. |
| **Ö3** | D39 | ✅ **KAPANDI** | AC5 metnindeki yanlış "(statik tarama testi doğrular)" ifadesi kaldırıldı, yerine "elle kod incelemesiyle doğrulandı" + neden otomatik çit yazılmadığının gerekçesi kondu (`F-006-yazma-kapisi.md` AC5). Yanlış güven üreten cümle gitti. |
| **Ö4** | D37 | ✅ **KAPANDI** | M9 (arşiv deseni → `^docs\/approvals\/archive\/.*$`) → **KIRMIZI**. Gevşetme yönü artık çitli. |
| **Ö5** | — | ✅ **KAPANDI** | M10 (ata döngüsü yalnızca son segmenti kontrol etsin) → **KIRMIZI, 1 test**, düşen test tam olarak `ata dizin lstatSync taraması TÜM üst segmentleri kontrol eder, yalnızca sonuncuyu değil (Ö5)`. Casus testi `docs` **ve** `docs/features` segmentlerinin ikisinin de `lstatSync`'lendiğini kanıtlıyor — önceki turda YEŞİL kalan MQ1 artık KIRMIZI. |
| **D39** | — | ✅ **KAPANDI** | Sözleşme `F-006-contract.md` mutasyon 10 satırı düzeltilmiş: "geometrik olarak mümkün değil" argümanı YANLIŞ ilan edilmiş, yerine gerçek yapısal neden yazılmış (`path.relative(anc, candidate)` asla `..` içeremez → `resolvedAnc` kök dışındaysa adım 8'in çapası hiçbir hâlde tutmaz, `write-gate.ts:114`). **Adım 3 ve adım 6'nın bugün sıfır bağımsız test kapsaması olduğu açıkça yazılı** (sözleşme mutasyon 10 satırı + D39 bölümü). |
| **N1** | — | ✅ | Test sayısı 564'e düzeltildi. |
| **N2-N5** | — | ⏸ Bilinçli | Kod değişikliği almadı, feature notunda ve `progress.md`'de neden yazılı. Bu turda yeniden açılmadı. |

---

## 3. Kendi mutasyon tablom (12 mutasyon)

Yöntem: mutasyon `src/server/write-gate.ts`'e uygulandı → `npx vitest run` (564 test) → sonuç
kaydedildi → dosya orijinaline geri yazıldı (her turda `reverted: true` doğrulandı).

| # | Mutasyon | Beklenen | **Sonuç** | Düşen test |
|---|---|---|---|---|
| **M1** | `setFeatureStatus`'a `fs.unlinkSync(resolved.targetPath)` silme yolu | KIRMIZI | **KIRMIZI 1** | statik tarama, write-gate.ts izinli-küme testi |
| **M2** | aynı yol `fs.rmSync(resolved.targetPath)` | KIRMIZI | **KIRMIZI 1** | aynı |
| **M3** | aynı yol `fs.promises.unlink(resolved.targetPath)` | KIRMIZI | **KIRMIZI 1** | aynı |
| **M4** | aynı yol `fs.rmdir(dirname(target), cb)` | KIRMIZI | **KIRMIZI 1** | aynı |
| **M5** | `const fsp = fs.promises` + `fsp.rm(resolved.targetPath)` | KIRMIZI | **KIRMIZI 1** | aynı |
| **M6** | `const tmp = resolved.targetPath` + `fs.unlinkSync(tmp)` (izinli dizgenin **değişken adıyla** yeniden kullanımı) | ? | **YEŞİL 564/564** | — → **NOT-2** |
| **M7** | D38 satır sonu kontrolü etkisizleştirildi (`.test(nextStatus)` → `.test('')`) | KIRMIZI | **KIRMIZI 3** | `nextStatus satır sonu içeriyorsa … invalid_body` ×3 |
| **M8** | `archiveDenial`'ın `mkdirSync`+`renameSync`'i `try` dışına | KIRMIZI | **KIRMIZI 10** | `arşiv hedef dizini bir dosyayla işgal edilmişse fırlamaz (D36/Ö1)` |
| **M9** | `OPERATION_PATTERNS.archive` → `^docs\/approvals\/archive\/.*$` | KIRMIZI | **KIRMIZI** | `write-gate.test.ts` + `write-gate-manifest.test.ts` |
| **M10** | ata `lstat` döngüsü `i = 0` → `i = len-2` (yalnızca son ata) | KIRMIZI | **KIRMIZI 1** | `ata dizin lstatSync taraması TÜM üst segmentleri… (Ö5)` |
| **M11** | **ikinci savunma hattı sondası:** kaçan biçimle (`const w1 = fs.unlinkSync; w1(root/README.md)`) fixture dosyası silindi | ? | **KIRMIZI 24** | `write-gate-manifest.test.ts` "izin verilenler dışında hiçbir dosya değişmez" |
| **M12** | (§5'teki 20 statik tarama enjeksiyonu — ayrı tabloda) | — | — | — |

**M11 önemli:** ADR-005'in *"Manifest testi ikinci savunma hattıdır ve dolaylı çağrıları da
yakalar"* iddiası **kâğıt üzerinde değil, ölçülerek doğrulandı** — statik taramanın gördüğü hiçbir
desen içermeyen bir silme bile manifest testini kırıyor. NOT-1'in şiddet değerlendirmesi buna dayanıyor.

---

## 4. Ö2 — frontmatter enjeksiyonu, çalışma zamanı ölçümü

Harness: `scratchpad/inject.mts` + `inject2.mts`, gerçek `setFeatureStatus`, her vaka için ayrı
`os.tmpdir()` fixture'ı, sonda silindi. Başlangıç dosyası `---⏎status: todo⏎owner: x⏎---⏎body⏎`.

| Girdi | Dönen | Diskte |
|---|---|---|
| `x⏎---⏎BODY` (QA'nın ölçtüğü girdi) | `ok:false invalid_body` | **UNCHANGED** |
| `x<CR>---<CR>BODY` · `x<CRLF>---<CRLF>BODY` · `a<CR>b` · `done⏎` | `ok:false invalid_body` | **UNCHANGED** |
| `---` (tek satır, satır sonu yok) | `ok:true` | `status: ---` — frontmatter **sağlam**, 2 anahtar satırı, tırnaklar dengeli |
| `x --- y` | `ok:true` | `status: x --- y` — sağlam |
| `a: b` · `a #c` | `ok:true` | `status: "a: b"` / `status: "a #c"` — doğru tırnaklanmış |
| `"x` · `'x` · `[x` · `{x` · `&x` · `*x` · `!x` · `\|` · `>` | `ok:true` | `status: "x` / `status: [x` … — **tırnaklanmıyor**, ayrıştırılamaz YAML → **NOT-3** |

Ö2'nin raporlanan tanımı (satır sonu) **tam olarak** kapandı; gövde ve diğer anahtarlar her vakada
bayt bayt korundu.

---

## 5. Kaçak denemeleri (statik tarama)

Yöntem: her parçacık gerçek `src/server/index.ts`'in sonuna eklendi →
`npx vitest run tests/no-write-gate-bypass.test.ts` → sonuç → dosya geri yazıldı. **Desen listesine
bakarak değil, taramayı koşturarak** ölçüldü.

| # | Deneme | Yakalandı mı | İstismar edilebilir mi |
|---|---|---|---|
| E1 | `fs.open(p,'w',cb)` + `fs.write(fd,d)` (tam işlevsel yazma yolu) | ✅ **YAKALANDI** | — |
| E2 | `fs.writevSync(fd,b)` | ✅ YAKALANDI | — |
| E3 | `fs.promises.rm(p)` | ✅ YAKALANDI | — |
| E4 | `fs.rmdir(p,cb)` | ✅ YAKALANDI | — |
| E5 | `fs.promises.rmdir(p)` | ✅ YAKALANDI | — |
| E6 | `fs.symlinkSync(a,b)` | ✅ YAKALANDI | — |
| E7 | `fs.linkSync(a,b)` | ✅ YAKALANDI | — |
| E8 | `const fsp = fs.promises` + `fsp.rm(p)` | ✅ YAKALANDI | — |
| E9 | `const { promises } = fs` + `promises.rm(p)` | ✅ YAKALANDI | — |
| **N-a** | `const w1 = fs.writeFileSync` + `w1(p,d)` (özellik ataması) | ❌ kaçtı | evet, ama **M11 ile ölçüldü: manifest testi yakalıyor** |
| **N-b** | `(fs as any)['write'+'File'+'Sync'](p,d)` (dinamik erişim) | ❌ kaçtı | **ADR-005'te adıyla kabul edilmiş sınır** ("`fs['write'+'File']` gibi dolaylı çağrı … kasıtlı atlatmayı yakalamaz") |
| N-c | `import * as fsAll from 'node:fs'` + `fsAll.writeFileSync(p,d)` | ✅ YAKALANDI | — |
| **N-d** | `import * as fsAll2` + `fsAll2.rm(p,cb)` (namespace + belirsiz ad) | ❌ kaçtı | evet (bkz. NOT-1) |
| N-e | `require('fs').writeFileSync(p,d)` | ✅ YAKALANDI | — |
| **N-f** | `import fsPromises from 'node:fs/promises'` + `fsPromises.rm(p,{recursive:true})` | ❌ kaçtı | evet — **NOT-1'in en doğal biçimi** (Node'un kendi dokümantasyon adlandırması) |
| **N-g** | `import fsP2 from 'node:fs/promises'` + `fsP2.open(p,'w')` + `h.write(d)` | ❌ kaçtı | evet |
| **N-h** | `const fs2 = fs` + `fs2.rm(p,cb)` (alıcı takma adı) | ❌ kaçtı | evet |
| **N-i** | `const { writeFileSync: wfs } = await import('node:fs')` + `wfs(p,d)` | ❌ kaçtı | evet |
| N-j | `import fsP3 from 'node:fs/promises'` + `fsP3.writeFile(p,d)` | ✅ YAKALANDI | — (çıplak ad listesi alıcıdan bağımsız) |
| N-k | `fs.appendFileSync(p,d)` (kontrol vakası, yakalanmalı) | ✅ YAKALANDI | — |

**Örüntü:** kaçan her biçim ya (a) **dinamik/kasıtlı gizleme** (N-b, N-a, N-i) ya da (b) **standart
dışı bir alıcı adı + 7 belirsiz addan biri** (`write`, `writev`, `open`, `rm`, `rmdir`, `symlink`,
`link` — N-d, N-f, N-g, N-h). Çıplak ad listesi (`writeFileSync`, `unlink`, `rmSync`, `mkdir`, …)
alıcıdan **bağımsız** çalışıyor, o yüzden en yaygın yazma API'leri her alıcı adıyla yakalanıyor.

Belirsiz adların alıcıya bağlanması **gerekli bir tasarım**, keyfi değil: `src/` içinde meşru
`process.stderr.write(` kullanımları var (`ingest.ts:79`, `service.ts:60,79`); çıplak `write(`
taransaydı bunlar yanlış pozitif olurdu. **Yanlış pozitif ölçümü: yok** — 564/564 yeşil, Tailwind
`truncate` sınıfı ve `truncateSummary`/`Math.trunc` de takılmıyor. Körlük assert'leri duruyor
(`:234-236` `scannedFiles.length > 0` ve `:317` her store dosyası için `found.length > 0`).

---

## 6. Adım 6'nın çitsizliği hakkında görüşüm (görev maddesi 5)

**Kabul edilebilir — çitlenmesini şart koşmuyorum.** Gerekçe:

1. Adım 6'yı **davranışsal olarak izole eden bir girdi yoktur.** `resolvedAnc` yalnızca zincirde bir
   symlink/junction varsa kök dışına çıkabilir; o durumu adım 2 ve adım 3 zaten reddediyor. Symlink
   yokken `realpathSync.native` yalnızca büyük/küçük harf ve 8.3 kısa ad kanonikleştirmesi yapar,
   bunlar kökten **çıkamaz**. Yani adım 6 için yazılacak bir test, ancak diğer adımları devre dışı
   bırakan bir mutasyonla anlam kazanır — yani "test" değil, mutasyon senaryosudur.
2. Ö5 için eklenen casus testi de adım 3'ü **bağımsız yapmıyor**; yalnızca "bu satır gerçekten
   koşuyor mu" sorusunu kapatıyor. Adım 6 için simetrik karşılığı `vi.spyOn(path, 'relative')` ile
   ~10 satırda yazılabilir ve değeri **aynı derecede sınırlı** olur.
3. Kritik olan şey **yapıldı**: sözleşme, adım 3 ve 6'nın sıfır bağımsız kapsaması olduğunu artık
   açıkça yazıyor. Tehlike "çitin olmaması" değil, "çit var sanılarak adım 8'in bir gün
   gevşetilmesi"ydi; D39 tam olarak bunu kapattı.

**Ama bir koşul yazıyorum:** adım 8'in regex'i (`OPERATION_PATTERNS`) ileride herhangi bir şekilde
gevşetilirse (yeni bir yazma hedefi, yeni bir kapı deseni), adım 3 ve 6 o anda **tek kalan savunma**
olur ve o değişiklikle **aynı** turda çitlenmeleri gerekir. Bu, F-007'nin sözleşmesine bir madde
olarak girmelidir.

---

## 7. Bulgular (hepsi NOT — açık BLOKLAYICI/ÖNEMLİ yok)

| # | Şiddet | Dosya:satır | Bulgu |
|---|---|---|---|
| **NOT-1** | NOT | `tests/no-write-gate-bypass.test.ts:67-71` | **Standart dışı alıcı adı + belirsiz ad birleşimi taramadan kaçıyor.** Tekrar üretme: `src/server/index.ts`'e `import fsPromises from 'node:fs/promises'` + `fsPromises.rm(p,{recursive:true})` ekle → `npx vitest run tests/no-write-gate-bypass.test.ts` → **YEŞİL**. `FS_RECEIVER` yalnızca `fs`/`fs.promises`/`fsp`/`promises` alıcılarını tanıyor. **Neden bloklayıcı değil:** (a) ADR-005 "Sonuçlar/riskler" bölümü statik guard'ın kaçak verebileceğini ve **kasıtlı atlatmayı yakalamadığını** adıyla kabul ediyor; (b) ikinci savunma hattı (manifest testi) bu sınıfı gerçekten yakalıyor — **M11 ile ölçüldü, 24 test KIRMIZI**; (c) `src/`'teki 9 dosyanın 9'u da tek konvansiyonu (`import fs from 'node:fs'`) kullanıyor, sapma göze batar. **Ucuz iyileştirme:** `FS_RECEIVER`'a `[A-Za-z_$][\w$]*[Ff]s[\w$]*` yerine, **`node:fs`/`node:fs/promises`'ten yapılan default/namespace import'un yerel adını dosyadan okuyup** alıcı listesine eklemek (import satırı zaten ayrıştırılıyor, `IMPORT_ALIAS_PATTERNS`). F-007'ye önerilir. |
| **NOT-2** | NOT | `tests/no-write-gate-bypass.test.ts:141-163` | **Dizge-seviyesi izinli küme değişken adına duyarlı.** M6: `const tmp = resolved.targetPath` + `fs.unlinkSync(tmp)` → **564/564 YEŞİL**, çünkü `fs.unlinkSync(tmp)` izinli kümede (meşru tmp temizliği için) tam metin olarak var. Yani hedefi `tmp` adlı bir değişkene atayan bir silme yolu kaçar. Bu, önceki turda **benim önerdiğim** tasarımın (dizge-seviyesi tam-çağrı kümesi) doğal sınırı ve ADR-005'in "kasıtlı atlatma" muafiyetine giriyor; kaza eseri ihlali (`fs.unlinkSync(resolved.targetPath)`) yakalıyor — M1 KIRMIZI. Kayda geçiyorum ki gelecekte "bu çit her silmeyi yakalar" sanılmasın. |
| **NOT-3** | NOT | `src/server/write-gate.ts:190` (`safeYamlValue`) | **Ö2'nin sınıfı tam kapanmadı: satır sonu dışındaki YAML gösterge karakterleri hâlâ tırnaklanmıyor.** Tekrar üretme: `setFeatureStatus(root,'F-001.md','"x',hash)` → `ok:true`, dosyada `status: "x` (kapanmamış tırnak = ayrıştırılamaz YAML). Aynısı `'x`, `[x`, `{x`, `&x`, `*x`, `!x` için de geçerli (§4). **Neden bloklayıcı değil:** `setFeatureStatus`'un `src/` içinde **hiç çağıranı yok** (`grep -rn 'setFeatureStatus' src/ | grep -v write-gate.ts` → 0 satır) — F-006 hiçbir rotayı bağlamadı, değer bugün ağdan ulaşılamıyor; gövde ve diğer frontmatter anahtarları her vakada bayt bayt korunuyor. **F-007 bu fonksiyonu bir handler'a bağlamadan ÖNCE kapatılmalı:** ya `safeYamlValue`'nun `needsQuoting` koşuluna baştaki gösterge karakterleri eklenmeli, ya da (tercihim, Karpathy §2) `nextStatus` için sabit bir sözcük dağarcığı allowlist'i (`todo\|doing\|qa\|fix\|done`) konmalı — fonksiyonun adı ("safe") bugün yaptığından fazlasını vaat ediyor. |
| **NOT-4** | NOT | `src/server/write-gate.ts:106-111` | **Adım 6'nın bağımsız kapsaması sıfır** (adım 3'ünki Ö5 casus testiyle "satır koşuyor" düzeyine çıkarıldı). Sözleşmede açıkça yazılı olduğu için kabul ediyorum; §6'daki koşul geçerli: `OPERATION_PATTERNS` gevşetilirse aynı turda çitlenmeli. |

---

## 8. Regresyon denetimi

- `npm run verify` / `e2e` / `e2e:dev` → **0 / 0 / 0**; 564 + 15 + 1.
- **Statik taramanın genişlemesi yanlış pozitif üretmiyor:** 564/564 yeşil; belirsiz adların
  alıcıya bağlanması sayesinde `process.stderr.write(` (2 dosya, 3 çağrı), Tailwind `truncate`
  sınıfı, `truncateSummary`, `Math.trunc` hiçbiri takılmıyor (§5).
- **Körlük assert'leri duruyor:** `scannedFiles.length > 0` (`:234-236`) **ve** her STORE dosyası
  için `found.length > 0` (`:317`) — ikincisi, izinli kümenin sessizce boşalmasına karşı ikinci
  bir körlük çiti; yeni ve iyi.
- Ürün kodunda düzeltme turunun dokunduğu tek satır kümesi: `write-gate.ts` +7 satır (D38 kontrolü
  + yorum). Yeni ekran/rota/dışa açılan fonksiyon **yok** — `git show --stat 24298d2 ed53893`.

---

## 9. Temizlik kanıtı

- `git diff HEAD -- src tests` → **boş** (0 satır). Uygulanan 12 mutasyon + 20 tarama enjeksiyonunun
  tamamı geri alındı; her mutasyon betiği sonunda `reverted: true` doğrulandı.
- `git diff HEAD` içindeki tek değişiklik **bu raporun** yazımı ve feature notunun
  `status: qa → done` satırıdır (rol gereği QA yazar).
- Portlar: `netstat -ano | grep LISTENING` → 7333/7334/7335/7433/7434 üzerinde **0 dinleyen soket**
  (yalnızca kendi e2e koşumdan kalan TIME_WAIT girdileri).
- Süreçler: `tasklist` → 2 `node.exe`; `Win32_Process` ile komut satırları okundu, **ikisi de
  Playwright MCP** (pid 37600, 37592). Yetim `npm run dev`/`tsx` ağacı **yok**.
- Fixture'lar yalnızca `os.tmpdir()` altında kuruldu ve her vakadan sonra `fs.rmSync` ile silindi;
  gerçek proje klasörlerine yazılmadı.

---

## 10. F-007'ye devredilen (kapanış notları, bu turu bloklamaz)

1. NOT-3 — `setFeatureStatus` bir handler'a bağlanmadan önce `status` değer doğrulaması.
2. NOT-1 — tarama alıcı listesini `node:fs` import'unun yerel adından türetsin.
3. §6 koşulu — `OPERATION_PATTERNS` gevşetilirse adım 3/6 aynı turda çitlensin.
4. N2-N5 (önceki tur) — bilinçli olarak açık; feature notunda gerekçesi yazılı.
