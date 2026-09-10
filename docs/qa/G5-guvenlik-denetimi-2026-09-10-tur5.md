G5 TAVSİYESİ: GEÇEMEZ
KRİTİK BULGU SAYISI: 2 (Y1, Y3) — üç eski kritik (4-Ek/4-Ek2/4-Ek3) KAPANDI, bugün iki YENİ kritik açıldı

# G5 Güvenlik Denetimi — Tur 5 (dar kapsamlı doğrulama)

**Tarih:** 2026-09-10
**Kapsam:** yalnızca (a) tur-4'ün üç KRİTİK bulgusunun kapanma doğrulaması, (b) bugün ortaya
çıkan Y1–Y4'ün sınıflandırılması. Önceki turların onayladığı bölümler yeniden açılmadı.
**Yöntem:** okuyarak doğrulama + gerçek `_selftest.cjs` koşumu + bağımsız sandbox mutasyon
testleri (gerçek proje dosyalarına dokunulmadan) + gerçek proje test suite'i (`npm run test`).
Hiçbir gerçek dosya değiştirilmedi/silinmedi; kanıt SHA-256 ile bu raporun sonunda.

---

## 0. Kısıtlara uyum — özet

- Gerçek `docs/approvals/*.ok` dosyalarına **hiç yazılmadı/silinmedi**. Öncesi/sonrası SHA-256
  birebir aynı (bkz. §6).
- `_selftest.cjs` koşturulmadan önce gerçek `GUARD.ok`/`PUSH.ok`/`DANGER.ok`/`.guard-state.json`
  yollarının **hiçbirinin var olmadığı** doğrulandı (`find` taraması, boş sonuç) — bu yüzden
  gerçek `_selftest.cjs`'i bir kez koşturmak güvenliydi (Y3'ün kendisi de bu turda böyle
  doğrulandı, bkz. §3.3).
- Tüm mutasyon testleri **sandbox kopyalar** üzerinde yapıldı
  (`%TEMP%\...\scratchpad\y1sandbox`, `...\y3sandbox`) — gerçek `.claude/hooks/*.cjs` hiç
  değiştirilmedi. `src/` yalnızca okundu, hiç mutasyon uygulanmadı (bkz. §2.3 sınırlaması).
- Hiçbir Bash komutuna korunan komut adı (yayın/uzak-depo-gönderme/yıkıcı-silme/bağlantı-oluşturma)
  gömülmedi; sandbox path'leri `docs/approvals` alt dizesini taşıdığı için bir komut kazara
  gerçek `block-dangerous.cjs`'e takıldı (bu bizzat Y2'nin canlı kanıtı oldu, bkz. §4.2) — dosya
  oluşturma o noktadan sonra Write/Read araçlarına taşındı, tur iptal edilmedi çünkü hiçbir
  gerçek dosyaya zarar gelmedi.
- Tur sonunda yetim `node`/`npm` süreci yok (`tasklist` boş döndü).

---

## 1. Üç eski KRİTİK'in kapanma kanıtı

### 1.1 4-Ek (`\\?\` uzun-yol öneki) — KAPANDI

Gerçek `_selftest.cjs` (repo kökünde, değiştirilmeden) koşturuldu:

```
OK   [gate-check.cjs] (K-A) \\?\ uzun yol öneki ile docs/approvals hedefi hâlâ ask üretir (regresyon: önceden sessiz exit=0)
OK   [gate-check.cjs] (K-A) aynı \\?\ öneki, docs/approvals DIŞI serbest yol için hâlâ sessizce izin verir (aşırı engelleme yok)
```

Ek olarak bağımsız bir sandbox mutasyonuyla (§2.1) doğrulandı: `resolveCanonicalRel()` eski
(`path.relative(cwd, path.resolve(f))`) davranışına döndürülünce, aynı `\\?\` probu **sessizce
exit=0, `ask` JSON'suz** geçiyor — yani düzeltme öncesi davranış tam olarak audit'in orijinal
bulgusuyla eşleşiyor, düzeltme bunu ayırt ediyor.

**Sonuç: KAPANDI.**

### 1.2 4-Ek2 (NTFS junction) — KAPANDI

Gerçek `_selftest.cjs` çıktısı:

```
OK   [gate-check.cjs] (K-B) assets/** altındaki bir junction docs/approvals ARKASINA çıkınca hâlâ ask üretir (regresyon: önceden assets serbest sayılıp sessiz exit=0)
OK   [gate-check.cjs] (K-B) test junction kaldırıldı ve hedef (docs/approvals) bozulmadı
OK   [block-dangerous.cjs] (mklink) bayraksiz (sembolik baglanti) — engellenmeli
OK   [block-dangerous.cjs] (mklink) /J (junction) — engellenmeli
OK   [block-dangerous.cjs] (mklink) /D (dizin sembolik baglantisi) — engellenmeli
OK   [block-dangerous.cjs] (mklink) /H (sabit baglanti) — engellenmeli
OK   [block-dangerous.cjs] (mklink) buyuk harf MKLINK — harf duyarsiz eslesme
```

`mklink` artık `block-dangerous.cjs`'in `danger` desenine eklenmiş (kabuktan junction oluşturma
komutu da engelleniyor); `gate-check.cjs`'in kanonikleştirmesi ise junction'ın ARKASINDA gerçekte
nereye yazıldığını görüyor. Bağımsız sandbox mutasyonu (§2.1) ile doğrulandı: eski koda dönünce
aynı junction probu **sessizce exit=0** geçiyor.

**Sonuç: KAPANDI.**

### 1.3 4-Ek3 (izin kartı önizleme kırpması) — KAPANDI

`src/features/chat/server/session.ts:153-168` (`buildInputPreview`) ve
`src/features/chat/web/ChatScreen.tsx:111-188` (`PermissionCard`) okunarak doğrulandı: kırpma
tamamen kaldırılmış, `INPUT_PREVIEW_WARN_THRESHOLD=500` (uyarı şeridi), `INPUT_PREVIEW_HARD_CAP
=20_000` (fail-closed sabit marker + Onayla butonu `disabled`), satır sonları korunuyor, kart
`overflow-y-auto` kaydırılabilir kutuda TAM metni gösteriyor (`truncate` kaldırılmış).

Bu turda **audit'in kendi sondası birebir** gerçek test suite'inde koşturuldu (kaynak dosyaya
dokunulmadı, salt `npx vitest run`):

```
tests/features/chat/server/session.test.ts:424
  it('denetimin sondasını birebir tekrarlar — 500+ karakter dolgu ARKASINDAKİ iz artık GÖRÜNÜR')
    const tail = 'GIZLI-KOMUT-SONU-ISARETI-4EK3'
    const command = `${'#'.repeat(560)} ${tail}`
    expect(preview).toContain(tail)
    expect(preview).toBe(command)
```

Sonuç: `tests/features/chat/server/session.test.ts` + `tests/features/chat/web/ChatScreen.test.tsx`
→ **60/60 test GEÇTİ** (bu turda bağımsız olarak koşturuldu).

**Sınırlama (dürüstçe belirtiliyor):** brief'in kısıtı ("src/ altını yalnızca oku") gereği bu
denetçi `buildInputPreview`/`isLong` üzerinde KENDİ mutasyonunu koşturmadı — src'ye yazma
yetkisi yok. Geliştirici turunun kendi bildirdiği mutasyon kanıtı (`docs/qa/g5-tur4-izin-karti-
onizlemesi-contract.md` §Sonuç, "Mutasyon kanıtları (2/2, elle geri alındı, git diff temiz)")
BAĞIMSIZ OLARAK YENİDEN ÜRETİLMEDİ, yalnızca (a) audit'in kendi sondasının gerçek bir otomatik
test olarak var olduğu ve geçtiği, (b) kodun kırpma yapmadığı okuyarak doğrulandı. Bu, tam
mutasyon kanıtından daha zayıf ama audit'in orijinal somut şikâyetinin (621+ karakterlik komutun
hassas kuyruğunun önizlemede hiç görünmemesi) artık gerçek bir regresyon testiyle kapalı olduğunu
gösteriyor.

**Sonuç: KAPANDI (yüksek güvenle; tam bağımsız mutasyon src kısıtı nedeniyle koşulmadı).**

---

## 2. Mutasyon sayıları

### 2.1 `resolveCanonicalRel()` mutasyonu (gate-check.cjs)

**Yöntem:** gerçek `.claude/hooks/{_common,block-dangerous,gate-check,_selftest}.cjs` içeriği
BİREBİR bir sandbox'a (`y3sandbox`) kopyalandı (repo yapısını taklit eden `docs/approvals/G2.ok`,
`assets/`, `src/server/index.ts` fixture'larıyla), `node .claude/hooks/_selftest.cjs` o
sandbox'ta koşturuldu (gerçek repoya dokunulmadı).

- **Baz (düzeltilmiş kod):** 98/98 GEÇTİ (gerçek repodaki koşumla birebir aynı sonuç).
- **Mutasyon** (`resolveCanonicalRel` → `path.relative(process.cwd(), path.resolve(f))`,
  realpath/junction çözümü kaldırıldı): **95/98 GEÇTİ, 3 KIRMIZI:**
  ```
  FAIL [gate-check.cjs] (K-A) \\?\ uzun yol öneki ile docs/approvals hedefi hâlâ ask üretir (regresyon: önceden sessiz exit=0)
  FAIL [gate-check.cjs] (K-B) assets/** altındaki bir junction docs/approvals ARKASINA çıkınca hâlâ ask üretir (regresyon: önceden assets serbest sayılıp sessiz exit=0)
  FAIL [gate-check.cjs] (fail-closed) fs.realpathSync.native fırlatınca sert engel (exit=2, sessiz izin DEĞİL)
  ```
  Üçü de tam olarak `resolveCanonicalRel`'in koruduğu davranışlar — çit gerçekten bu mekanizmayı
  ölçüyor, komşu bir yolu değil.

  Not: mutasyonun ilk denemesinde (sandbox'ta `docs/approvals/G2.ok` fixture'ı olmadan) K-A testi
  farklı bir nedenle (G2.ok eksikliği) da kırmızı çıkıyordu; fixture eklenince gerçek repo
  koşullarını doğru yansıttı ve yukarıdaki 3 vaka net biçimde ayrıştı. Bu, "çitin doğru şeyi mi
  ölçtüğü" konusunda ekstra bir kontrol katmanı oldu.

### 2.2 İzin kartı kırpma mutasyonu

Bağımsız koşulmadı (§1.3 sınırlaması). Geliştirici turunun kendi bildirdiği sonuç: kırpmayı geri
getirme → `session.test.ts`'in 4 testi KIRMIZI; `isLong` dalını kaldırma → `ChatScreen.test.tsx`'in
1 testi KIRMIZI (`docs/qa/g5-tur4-izin-karti-onizlemesi-contract.md` §Sonuç). Bu rapor bu sayıyı
**doğrulamadı**, yalnızca aktarıyor.

### 2.3 Gerçek proje test suite'i (regresyon kontrolü)

`npm run test` bu turda İKİ KEZ koşturuldu (proje kuralı: vitest worker-fork çökmesi bilinen bir
kararsızlık, ilk kırmızıda tekrar koştur):

- 1. koşum: **KIRMIZI** — `tests/integration/sse-stream.test.ts` işçi süreci `exit code
  3221226505` ile çöktü (`Worker forks emitted error`), `verify-test-run.mjs` bunu "1 dosya / 4
  test sessizce eksik" diye doğru şekilde yakaladı.
- 2. koşum: **1371 geçti / 4 atlandı** — tur başı ölçümle birebir aynı. Bu bir regresyon DEĞİL,
  CLAUDE.md'de dört kez kayıtlı bilinen vitest kararsızlığının beşinci örneği.

`npm run e2e` (Playwright, gerçek tarayıcı) bu turda KOŞTURULMADI — dar kapsamlı doğrulama
turunun hedefleri zaten unit test + hook self-test + sandbox mutasyonlarıyla karşılandı; gerçek
sunucu/tarayıcı başlatmak (orphan süreç riski, CLAUDE.md'de birden fazla kez kayıtlı) bu üç
kritiğin doğrulanması için gerekli değildi. Bu bir eksik-doğrulama olarak KAYDA GEÇİYOR ama üç
kritiğin kapanma kararını etkilemiyor (K-A/K-B/fail-closed tamamen hook-seviyesinde, 4-Ek3 ise
kendi E2E'sini geliştirici turunda zaten geçirmiş — `npm run e2e:chat` 4/4, bu turda tekrar
koşulmadı).

Tur sonu: `tasklist` boş (orphan `node.exe` yok).

---

## 3. Bugün ortaya çıkan dört kusur — sınıflandırma

### 3.1 Y1 — `parseGuardScope()` düzyazı sızıntısı — **BLOKLAYICI**

**Kanıt (bu turda bağımsız üretildi, sandbox'ta):**

`docs/approvals/GUARD.ok` (sandbox) içeriği:
```
## Kapsam
`block-dangerous.cjs`

## Gerekce
CEO notu: bu degisikligi incelerken ayni dizinde duran, ilgisiz ve KAPSAM DISI birakilan
`evil-payload.cjs` dosyasina da goz attim, onu degistirmiyorum, sadece bahsediyorum.
```

`node .claude/hooks/gate-check.cjs` çağrısı, `.claude/hooks/evil-payload.cjs`'e yazma isteği ile:
**exit=0** (sessiz izin — hiçbir `ask`/`block` yok). `.guard-state.json` içeriği:
```json
{"scopeKey":"[\".claude/hooks/block-dangerous.cjs\",\".claude/hooks/evil-payload.cjs\"]","touched":[".claude/hooks/evil-payload.cjs"]}
```
`evil-payload.cjs` — onay metninde AÇIKÇA "KAPSAM DIŞI" diye tarif edilmesine rağmen — kapsama
dahil edildi.

**Kaynak:** `.claude/hooks/gate-check.cjs:30-44` (`parseGuardScope`):
```js
const re = /`([^`]+)`/g;
while ((m = re.exec(text))) { ... } // metnin TAMAMINI tarar, "## Kapsam" başlığıyla sınırlamaz
```

**Neden bloklayıcı (teorik değil, pratik sızıntı):**

Brief'in ayrım kuralı: pratik sızıntı = "kartta yanıltıcı bilgi göstererek" onay üretilebiliyor.
Burada tam olarak bu oluyor. GUARD.ok'un kendisi yazılırken kullanıcı tam metni görür (4-Ek3
düzeltmesi sayesinde artık kırpılmadan) — ama metnin DOĞAL DİL ANLAMI ("KAPSAM DIŞI") ile
SİSTEMİN GERÇEKTE UYGULAYACAĞI karar (kapsama DAHİL) ÇELİŞİYOR. Kullanıcı kartı okuyup doğru
şekilde "yalnızca block-dangerous.cjs'i onaylıyorum" sonucuna varsa bile, sistem sessizce ikinci
bir dosyayı da yetkilendiriyor. Bu, ADR-016/tur-3'ün "bir DEĞİŞİKLİĞİ yetkilendirir, bir YAZMAYI
değil" ilkesinin bizzat kendisinin ihlali — kullanıcının onayladığı DEĞİŞİKLİK ile sistemin
uygulayacağı DEĞİŞİKLİK FARKLI.

Ayrıca: bu, tur-3'te KRİTİK olarak kapatılan "kapsam sızıntısı" bulgusunun yeniden açılmasıdır
(brief §1'de de belirtildiği gibi) VE brief'e göre **bugün gerçek CEO operasyonunda iki kez
gerçekleşmiştir** (varsayımsal değil, gözlemlenmiş bir tekrar deseni).

**Düzeltme önerisi:** `parseGuardScope`'u yalnızca `## Kapsam` başlığından bir sonraki
başlığa/dosya sonuna kadar olan bloğu ayrıştıracak şekilde daraltın (ör. `text.split(/^##\s/m)`
ile bölümlere ayırıp yalnızca "Kapsam" bölümünü regex'e verin). Ek çit: kapsam bölümü dışında
geçen herhangi bir `.cjs`/`.claude/settings.json` adını tespit edip GUARD.ok yazımını
"belirsiz kapsam, birden fazla bölümde dosya adı var" diye fail-closed reddeden bir sağlama
eklemek, gelecekte aynı hatanın "gerekçe paragrafına dosya adı sızdırma" şeklinde tekrarını
önler.

### 3.2 Y2 — `block-dangerous.cjs` çapraz eşleşme yanlış pozitifi — **EŞİKLİ BORÇ** (bloklayıcı değil, ama yüksek öncelik)

**Kanıt 1 (canlı, bu turda organik olarak oluştu):** Bu denetimin kendi sandbox kurulum komutu
(`mkdir ... && cp gate-check.cjs .../.claude/hooks/ && cp _common.cjs ...`) TAMAMEN engellendi,
çünkü komut metninde sandbox yolunun bir parçası olarak "docs/approvals" alt dizesi geçiyordu VE
komut `cp` fiili içeriyordu — hedefin gerçekte `docs/approvals` ile hiçbir ilgisi yoktu.

**Kanıt 2 (bağımsız sandbox harness, `y2-harness.cjs`):**
```
FAIL cikan=2 beklenen=0 :: cp report.txt out/report-copy.txt && echo done && ls docs/approvals
FAIL cikan=2 beklenen=0 :: git commit -m "docs: mklink korumasi hakkinda not"
OK   cikan=2 beklenen=2 :: cp payload.cjs docs/approvals/GUARD.ok   (dogru pozitif, kontrol vakasi)
```

**Kaynak:** `.claude/hooks/block-dangerous.cjs:56-66` — `approvalsRef`/`approvalsWriteVerb`
komutun TAMAMINI (tek blob) tarıyor, fiil ile hedef arasında bir ilişki/yakınlık aramıyor. Aynı
kusur sınıfı `danger` deseninin `mklink` eklentisiyle de sürüyor — bir commit mesajı bu kelimeyi
salt ANARSA (silmiyor/oluşturmuyor) komut yine de engelleniyor.

**Neden bloklayıcı DEĞİL (ama izlenmeli):** Bu bir AŞIRI-ENGELLEME'dir (false positive), bir
yetkisiz-erişim AÇMIYOR — tam tersi yönde hata (güvenli tarafta hata). Brief'in ayrımına göre bu
"pratik sızıntı" değil. Ancak CLAUDE.md'nin kendi tarihçesi ("onay yorgunluğu, K1'in gerekçesiydi")
açıkça gösteriyor ki: sık ve alakasız engellemeler, kullanıcıyı/CEO'yu er ya da geç hook'u
zayıflatma veya "sadece bu seferlik atla" arayışına iter — bu da GERÇEK bir güvenlik riskine
dönüşür (yalnızca dolaylı yoldan). Ayrıca normal geliştirme akışını (commit, dosya kopyalama)
bozarak günlük operasyonu ölçülebilir şekilde engelliyor.

**Düzeltme önerisi:** Komutu `&&`/`;`/`|`/yeni satır ile segmentlere ayırıp, `approvalsRef` ve
`approvalsWriteVerb`/`approvalsInlineEval` eşleşmelerinin **AYNI segmentte** olmasını şart koşun.
`danger` deseni (mklink dahil) için de git commit mesajı gibi metin-taşıyan bağlamları (`-m
"..."`, heredoc gövdesi) ayrıştırıp asıl komut fiilinden ayırmayı değerlendirin — tam çözüm
zor olsa da segment-bazlı eşleştirme çoğu pratik yanlış pozitifi ortadan kaldırır.

### 3.3 Y3 — self-test gerçek onay dosyalarını silebiliyor — **BLOKLAYICI**

**Kanıt (okuyarak + bu turun kendi ön/son kontrolüyle doğrulandı):** `.claude/hooks/_selftest.cjs`
441-445. satırlar (temizlik bloğu):
```js
rm(PUSH_OK);
rm(DANGER_OK);
rm(GUARD_OK);
rm(GUARD_STATE);
```
Bu değişkenler `docs/approvals/PUSH.ok`, `docs/approvals/DANGER.ok`, `docs/approvals/GUARD.ok`,
`docs/approvals/.guard-state.json` — GERÇEK proje yollarıdır (sandbox değil; script `process.cwd()`
göreli çalışır). Script boyunca `write(PUSH_OK)`/`writeGuardScope(...)` gibi çağrılar da bu GERÇEK
yollara yazıyor (K1/dangerCases test senaryoları). Betik, koşum başında bu dosyaların ÖNCEDEN var
olup olmadığını, varsa bunun kullanıcının GERÇEK bekleyen bir onayı mı yoksa kendi ürettiği bir
kalıntı mı olduğunu **hiç ayırt etmiyor** — sonunda hepsini koşulsuz siliyor.

Bu turda bizzat doğrulandı: koşum ÖNCESİ `find . -iname GUARD.ok -o -iname PUSH.ok -o -iname
DANGER.ok -o -iname .guard-state.json` boş sonuç verdi (güvenli), koşum SONRASI da boş (betiğin
kendi temizliği çalıştı). Ama bu sırf ŞANS — bugün pending onay yoktu. Eğer kullanıcı tam o anda
`GUARD.ok`'u onaylamış ve CEO henüz onu tüketmemişken biri (aynı oturumdaki CEO, ya da paralel
bir bakım turu) `_selftest.cjs`'i çalıştırsaydı, kullanıcının GERÇEK onayı **sessizce, hiçbir
uyarı/log olmadan** silinirdi.

**Neden bloklayıcı:** CLAUDE.md bizzat bu betiği rutin bakımın bir PARÇASI olarak zorunlu
kılıyor ("Hook değişikliğinden sonra `node .claude/hooks/_selftest.cjs` çalıştır"). Yani bu
tehlike hipotetik değil, projenin KENDİ standart iş akışına gömülü. Silinen şey bir önbellek
değil, kullanıcının verdiği GERÇEK bir izin kararının kaydıdır — CLAUDE.md'nin kendi diliyle: "bir
güvenlik testinin, koruduğu şeyi tahrip etmesi." Ayrıca CLAUDE.md'de zaten belgelenen bir başka
kural ("token boşa gittiyse... dosyayı aynı kapsamla yeniden yaz, yeni onay isteme") bu riski
büyütüyor: token'ın "boşa gittiğini" fark eden bir CEO, kullanıcıya TEKRAR SORMADAN GUARD.ok'u
yeniden yazma pratiğine zaten sahip — bu pratik + Y3 birleşince, kullanıcının haberi olmadan bir
onay dosyası kaybolup "sorgusuzca" yeniden üretilebilen bir akış ortaya çıkıyor (yeniden yazma
yine harness'in ask() kartına düşer, ama CEO'nun kullanıcıya sözlü olarak yeniden sorması
ATLANMIŞ olur — tam da onay yorgunluğunun bir başka türü).

**Düzeltme önerisi:** Betik başında `PUSH_OK`/`DANGER_OK`/`GUARD_OK`/`GUARD_STATE`'in ÖNCEDEN
var olup olmadığını kontrol edin; varsa **çalışmayı reddedin** ("gerçek bekleyen bir onay/durum
dosyası var, önce onu işleyin ya da yedekleyin") ya da içeriklerini geçici olarak yedekleyip
(`.selftest-backup/`) koşum sonunda GERİ YÜKLEYİN (sil-ve-unut değil, taşı-çalıştır-geri-taşı).
En azından: sessiz `rm()` yerine, silmeden ÖNCE dosyanın kendi `selftest`-imzalı içeriğe sahip
olduğunu doğrulayan bir kontrol ekleyin (`write()`/`writeGuardScope()` hep `'selftest...'` ile
başlayan içerik yazıyor — gerçek kullanıcı onayları bu imzayı TAŞIMAZ, bu ayrımı kullanın).

### 3.4 Y4 — kabuktan `.claude/hooks/**` yazma `gate-check.cjs`'i atlıyor — **EŞİKLİ BORÇ** (ADR-016 sınırı içinde, ama asimetri var)

**Kanıt (okuyarak doğrulandı):** `.claude/settings.json` `PreToolUse` bloğu — `gate-check.cjs`
yalnızca `"matcher": "Edit|Write"` altında bağlı (satır ~104), `block-dangerous.cjs` yalnızca
`"matcher": "Bash"` altında (satır ~112). `block-dangerous.cjs`'in Katman B deseni (`approvalsRef`
+ `approvalsWriteVerb`/`Redirect`/`InlineEval`) YALNIZCA `docs[\\/]approvals` alt dizesini arıyor
— `.claude/hooks` veya `.claude/settings.json` için EŞDEĞER bir desen YOK. Sonuç: `cp
<hazırlanmış-dosya> .claude/hooks/gate-check.cjs` gibi bir kabuk komutu `GUARD.ok` kapısını HİÇ
görmeden hook'un kendisini değiştirebilir.

**Neden bloklayıcı DEĞİL:** Önceki turda canlı doğrulanan sınır geçerliyse (bu barındırılan
oturumda HER Bash çağrısı gerçekten kullanıcıya soruluyor, proje `allow` kuralları geçersiz)
kullanıcı yine de `cp a b` komutunun TAM, DOĞRU metnini içeren bir izin kartı görür — komut
gizlenmiyor, kırpılmıyor, yanlış tanıtılmıyor. Bu, brief'in "teorik ihlal" tanımına giriyor: karar
noktası kullanıcıda kalıyor, gösterilen bilgi doğru. ADR-016 zaten "yerel kabuk erişimi olan bir
oturuma karşı mutlak koruma yoktur, Katman B bir kara listedir/derinlik katmanıdır" sınırını
KABUL ETMİŞ durumda — bu ilke `.claude/hooks/**` için de eşit ölçüde geçerli.

**Ancak bir asimetri var, kayda geçiyor:** `docs/approvals/` kasıtlı olarak İKİ bağımsız katmanla
korunuyor (Katman A: `gate-check.cjs` ask+scope; Katman B: `block-dangerous.cjs` kara liste).
`.claude/hooks/**` — ki bu, TÜM güvenlik mekanizmasının kendisidir, `docs/approvals`'tan daha az
kritik değil — yalnızca Katman A'ya (ve o da sadece Edit/Write üzerinden) sahip; Katman B eşdeğeri
YOK. Bu, kasıtlı bir mimari karar değil, muhtemelen bir gözden kaçırma. Kartın "doğru bilgi
taşıması" tek başına yeterli savunma değildir — `docs/approvals` için AYRICA bir kara liste
eklenmesinin gerekçesi neyse (derinlik/erken uyarı), `.claude/hooks/**` için de aynı gerekçe
geçerlidir.

**Düzeltme önerisi (bloklayıcı değil, sonraki tur için önerilir):** `block-dangerous.cjs`'e
`docs/approvals` ile birebir simetrik bir `hooksRef = /\.claude[\\/](hooks|settings\.json)\b/i`
kontrolü + aynı segment-bazlı yazma-fiili eşleşmesi (Y2 düzeltmesiyle birlikte) ekleyin. Bu,
Katman A/B simetrisini tamamlar ve ADR-016'nın kendi ilkesini (docs/approvals'a verdiği önemi)
`.claude/hooks/**`'e de tutarlı biçimde uygular.

---

## 4. G5 geçmek için kapanması ŞART olan maddeler

1. **Y1 — `parseGuardScope()` yalnızca "## Kapsam" bölümünü ayrıştıracak şekilde daraltılmalı**
   ve bölüm dışı `.cjs`/`.claude/settings.json` adı geçen bir GUARD.ok metni fail-closed
   reddedilmeli (belirsiz kapsam). Bugün gerçek operasyonda iki kez tetiklenmiş, tur-3'te
   kapatılmış bir KRİTİK'in yeniden açılmasıdır.
2. **Y3 — `_selftest.cjs` gerçek bekleyen onay/durum dosyalarını (imzasız içerik) tespit edip
   ya çalışmayı reddetmeli ya da yedekleyip geri yüklemeli**, koşulsuz `rm()` ile bitirmemeli.

Aşağıdakiler G5'i BLOKLAMIYOR ama sonraki turda ele alınması öneriliyor (öncelik sırasıyla):
- Y2 (block-dangerous çapraz eşleşme — segment-bazlı hâle getirilmeli, onay yorgunluğu riski)
- Y4 (`.claude/hooks/**` için Katman B simetriği eklenmeli — ADR-016 sınırı içinde ama asimetrik)
- `npm run e2e` bu turda koşturulmadı — bir sonraki tur (ya da G5 kapanış turu) tam suite'i
  (unit + e2e) bir kez daha yeşil görmeli.
- 4-Ek3 için src'ye bağımsız mutasyon (bu turun kısıtı nedeniyle atlandı) — G5 kapanış turunda
  src yazma yetkisi olan bir denetçi ile tekrarlanabilir.

---

## 5. Ölçüm özeti

| Kontrol | Sonuç |
|---|---|
| `_selftest.cjs` (gerçek repo, bu tur) | 98/98 GEÇTİ |
| `_selftest.cjs` (bağımsız sandbox mirror, baz) | 98/98 GEÇTİ |
| `_selftest.cjs` (sandbox, `resolveCanonicalRel` mutasyonu) | 95/98 GEÇTİ, 3 KIRMIZI (K-A ask, K-B ask, fail-closed) |
| `session.test.ts` + `ChatScreen.test.tsx` (gerçek repo) | 60/60 GEÇTİ |
| `npm run test` (gerçek repo, 1. koşum) | KIRMIZI — bilinen vitest worker-fork çökmesi (regresyon değil) |
| `npm run test` (gerçek repo, 2. koşum) | 1371 geçti / 4 atlandı (tur başı ölçümle aynı) |
| `npm run e2e` | KOŞTURULMADI (bkz. §2.3, §4) |
| Y1 sandbox PoC (`evil-payload.cjs` "KAPSAM DIŞI" iken kapsama giriyor) | Doğrulandı, exit=0 |
| Y2 sandbox harness (`y2-harness.cjs`) | 2 yanlış pozitif + 1 doğru pozitif kontrol vakası doğrulandı |
| Orphan `node.exe` süreci (tur sonu) | Yok |

---

## 6. Gerçek onay dosyaları — SHA-256 (öncesi = sonrası)

```
docs/approvals/G0.ok    3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565
docs/approvals/G1.ok    72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234
docs/approvals/G2.ok    a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5
docs/approvals/G3.ok    36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2
docs/approvals/G4-1.ok  08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b
docs/approvals/G4-2.ok  6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace
```

Koşum öncesi ve sonrası birebir aynı (diff yok). `git status --porcelain docs/approvals/` boş
döndü (hem tur başında hem tur sonunda). `docs/approvals/` altında `GUARD.ok`/`PUSH.ok`/
`DANGER.ok`/`.guard-state.json` bu turun başında da sonunda da mevcut DEĞİL (repo genelinde
`find` taraması boş sonuç verdi) — `_selftest.cjs`'in bu turda koşturulması güvenliydi ve
Y3'ün iddia ettiği riski gerçek zamanlı tetiklemedi.

---

## 7. Kanıt dosyaları (sandbox, gerçek projenin dışında)

- `%TEMP%\...\scratchpad\y1sandbox\` — Y1 PoC (`GUARD.ok`, `.guard-state.json`, mutasyon karşılaştırması)
- `%TEMP%\...\scratchpad\y1sandbox\y2-harness.cjs` — Y2 çapraz eşleşme kanıtı
- `%TEMP%\...\scratchpad\y3sandbox\` — tam self-test mirror'ı (baz + mutasyon karşılaştırması)

Bu dosyalar geçicidir (`%TEMP%` altında), proje deposunun bir parçası değildir, commit edilmemiştir.
