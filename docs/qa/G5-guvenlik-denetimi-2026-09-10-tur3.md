---
type: qa
gate: G5
date: 2026-09-10
tur: 3 (nihai doğrulama — GUARD.ok mekanizmasının kendisi + K1-YENİ kapanışı)
denetci: security-reviewer (bağımsız alt agent)
kapsam: (1) CEO'nun şüphesi — onay dosyalarının kendi kendine üretilebilirliği,
  (2) K1-YENİ (harf duyarsızlık) kapanışının doğrulanması, (3) kapsam mekanizmasını yenme
  denemeleri, (4) GG2 yanlış pozitif taraması, (5) test sayılarının bizzat koşturulması.
  Tur1/tur2'de "sağlam" bulunan maddeler (yazma sınırı genel mimarisi, HTTP, Electron,
  bağımlılıklar, K2/K3'ün kendisi) yeniden denetlenmedi — brief gereği.
---

# G5 Güvenlik Denetimi — Tur 3 (nihai doğrulama)

İşaretler: **✓ DOĞRULANDI** (komut/script bizzat koşturuldu, çıktı bu raporda) ·
**⊢ ÇIKARIM** (koddan mantıksal sonuç) · **[T] TAHMİN**.

**Görev kısıtı doğrulaması:** Gerçek `docs/approvals/*.ok` dosyalarına hiçbir yazma/silme
işlemi yapılmadı. Tüm istismar denemeleri, gerçek repodan kopyalanan `gate-check.cjs`/
`_common.cjs` ile kurulan **izole bir sandbox**'ta (`scratchpad/guard-sandbox`, repo dışında)
çalıştırıldı. Gerçek repoda yalnızca hook'ları **salt-okunur** şekilde stdin üzerinden
çağırdım (`echo '{"tool_input":...}' | node .claude/hooks/gate-check.cjs`) — bunlar GUARD.ok
yokken hep `block()`'a düşüp exit 2 ile bitti, hiçbir dosyaya yazmadı. Denetim öncesi/sonrası
altı `G*.ok` dosyasının SHA-256'ları **birebir aynı** (§6), `git status --porcelain` **boş**
(hiçbir dosya değişmedi), dört hook dosyasının MD5'i de altta kayıtlı ve değişmedi. Port 7333
denetim başında ve `npm run test`/`npm run e2e` sonrasında **boş**; `tasklist` yetim `node.exe`
göstermedi.

---

## 0. CEO'nun birinci sorusu — onay dosyalarının kendi kendine üretilebilirliği

### 0.1 Kod okuma (✓ DOĞRULANDI)

`gate-check.cjs`'in `free` listesi (satır 96):
```js
const free = [/^docs\//i, /^\.claude\//i, /^assets\//i, /^README\.md$/i, /^\.gitignore$/i, /^CLAUDE\.md$/i, /^KURULUM\.md$/i];
```
`docs/` **tamamen** serbest — `docs/approvals/GUARD.ok`, `DANGER.ok`, `PUSH.ok` ve her
`G*.ok` dahil, bunların hepsi `docs/approvals/` altında. `isGuarded` yalnızca
`.claude/hooks/**` ve `.claude/settings.json`'ı kapsıyor (satır 71) — `docs/approvals/**`
**hiçbir hook tarafından korunmuyor**.

`.claude/settings.json`'ın `permissions.allow` listesi de bunu doğruluyor:
```
"Edit(docs/**)", "Write(docs/**)"
```
`deny` listesinde `docs/approvals/**` için **hiçbir istisna yok** (yalnızca `.env*` ve
`**/secrets/**` okuma engelleniyor). Yani Claude Code'un kendi harness-seviyesi izin
sistemi de bu yazmayı **kullanıcıya sormadan, otomatik olarak** onaylıyor.

### 0.2 Canlı sömürü — sandbox'ta (✓ DOĞRULANDI)

Gerçek `gate-check.cjs`+`_common.cjs` sandbox'a kopyalandı, boş `docs/approvals/` ve sahte
bir `.claude/hooks/block-dangerous.cjs` ("// original content") kuruldu.

```
--- ADIM 1: GUARD.ok yokken guarded yazma denemesi ---
$ echo '{"tool_input":{"file_path":".claude/hooks/block-dangerous.cjs"}}' | node .claude/hooks/gate-check.cjs
Engellendi: ... docs/approvals/GUARD.ok ... gerekli.
exit=2

--- ADIM 2: hosted oturum KENDISI docs/approvals/GUARD.ok yaziyor (docs/ serbest oldugu icin,
    kullaniciya hic sorulmadan) ---
$ node -e "require('fs').writeFileSync('docs/approvals/GUARD.ok',
    'Onay: \`block-dangerous.cjs\` dosyasi guncellenebilir.\n')"

--- ADIM 3: ayni guarded yazma artik geciyor mu? ---
$ echo '{"tool_input":{"file_path":".claude/hooks/block-dangerous.cjs"}}' | node .claude/hooks/gate-check.cjs
exit=0   <-- GECTI, hicbir gercek kullanici onayi olmadan

--- ADIM 4: token tuketildi mi? ---
GUARD.ok silinmis (kapsam tek dosyaydi, tamami "goruldu" sayildi).
```

Aynı deneme `DANGER.ok`, `PUSH.ok`, `G6.ok`, `G2.ok` için de tekrarlandı — **hepsi**
`gate-check.cjs`'in `Edit|Write` yolundan **hiçbir engelle karşılaşmadan** (exit 0)
yazılabiliyor:
```
docs/approvals/DANGER.ok -> exit=0
docs/approvals/PUSH.ok   -> exit=0
docs/approvals/G6.ok     -> exit=0
docs/approvals/G2.ok     -> exit=0
```

### 0.3 İkinci vektör — mevcut (gerçek) bir onayın kapsamını genişletme (✓ DOĞRULANDI, daha ciddi)

Bu, "kullanıcı gerçekten bir GUARD.ok onayladı" senaryosunda bile geçerli. `docs/` serbest
olduğu için `GUARD.ok`'un **kendisi de** hosted oturum tarafından **tüketilmeden önce**
değiştirilebiliyor:

```
--- Varsayım: kullanıcı SADECE `block-dangerous.cjs` için GUARD.ok onayladı (gerçek onay) ---
docs/approvals/GUARD.ok: "Kullanici onayi: yalnizca `block-dangerous.cjs` guncellenebilir."

--- Hosted oturum, GUARD.ok'u TÜKETMEDEN ÖNCE kendi kapsamını genişletiyor ---
$ node -e "fs.appendFileSync('docs/approvals/GUARD.ok',
    'Ayrica \`gate-check.cjs\` de bu onay kapsamindadir.\n')"

--- Şimdi gate-check.cjs'in KENDİSİ, hiçbir kullanıcı onaylamadığı halde değiştirilebiliyor mu? ---
$ echo '{"tool_input":{"file_path":".claude/hooks/gate-check.cjs"}}' | node .claude/hooks/gate-check.cjs
exit=0   <-- EVET
```

`docs/approvals/.guard-state.json` (tüketim izleyicisi) de aynı nedenle serbest — elle
düzenlenip "görüldü" sayılan dosyalar sahtelenebilir:
```
$ echo '{"tool_input":{"file_path":"docs/approvals/.guard-state.json"}}' | node .claude/hooks/gate-check.cjs
exit=0
```

### 0.4 Sonuç — KRİTİK, sömürülebilir (PRATİK, teorik değil)

**CEO'nun şüphesi doğrulandı ve daha geniş bir sınıfa ait çıktı.** Sorun yalnızca
`GUARD.ok`'a özgü değil: `docs/approvals/` altındaki **her** onay dosyası (`GUARD.ok`,
`DANGER.ok`, `PUSH.ok`, `G0.ok`…`G6.ok`, `.guard-state.json`) **hiçbir hook ve hiçbir
harness-izin kuralı tarafından korunmuyor**. Kapı, "kullanıcı onayı" ile "hosted oturumun
kendi ürettiği metin" arasında **hiçbir ayrım yapamıyor** — dosyanın var olması tek kriter,
ve o dosyayı kim yazdığı denetlenmiyor. Bu, tasarımın temel varsayımını (`docs/approvals/*.ok`
= kullanıcı rızası) geçersiz kılıyor: **kapı, kendi anahtarını üretebilen (ve mevcut bir
anahtarın kapsamını genişletebilen) bir tarafa karşı hiçbir koruma sağlamıyor.**

Bunun pratik olduğunu gösteren üç somut yol:
1. Sıfırdan kendi GUARD.ok/DANGER.ok/PUSH.ok/G*.ok'unu yazmak (§0.2).
2. Gerçek, kullanıcı onaylı bir GUARD.ok'un kapsamını tüketilmeden önce genişletmek (§0.3).
3. `.guard-state.json`'ı elle düzenleyip "kapsam tamamlandı" yalanını söylemek (§0.3 son).

Madde 4'ün sözleşmesi (`g5-guvenlik-duzeltme-tur3-contract.md`) bu tehdit modelini hiç ele
almamış — yalnızca "kapsam metni GUARD.ok içinde nasıl ayrıştırılır"ı tasarlamış, "GUARD.ok'un
kendisi kim tarafından yazılabilir"i hiç sormamış. `_selftest.cjs`'in 50 vakası da bunu hiç
ölçmüyor (hepsi `write(GUARD_OK)` yardımcı fonksiyonuyla, testin kendi içinde, "onay zaten
var" varsayımıyla çalışıyor — GUARD.ok'un nereden geldiği sorgulanmıyor).

**Bu, K1'in orijinal amacını (barındırılan CEO oturumunun kendi güvenlik hook'unu sessizce
değiştirememesi) tamamen boşa çıkarıyor — üstelik harf duyarsızlık düzeltmesinden BAĞIMSIZ
bir yoldan.**

---

## 1. K1-YENİ (harf duyarsızlık) — kapandı mı

### 1.1 Kendi orijinal sömürünü birebir tekrarla (✓ DOĞRULANDI, gerçek repo, GUARD.ok yok)

```
.CLAUDE/HOOKS/block-dangerous.cjs   -> exit 2 (Engellendi)
.claude/Hooks/block-dangerous.cjs   -> exit 2
.Claude/hooks/block-dangerous.cjs   -> exit 2
.claude/hooks/Block-Dangerous.cjs   -> exit 2
.claude/settings.JSON               -> exit 2
.CLAUDE/SETTINGS.JSON               -> exit 2
```
Tur2'de bu altı varyanttan ikisi (`.CLAUDE/HOOKS/...`, `.claude/Hooks/...`) **exit 0**
(serbest) veriyordu. Şimdi **hepsi engelleniyor** — `isGuarded` regex'ine `/i` bayrağı
eklenmiş (`gate-check.cjs:71`), iddia doğru. **K1-YENİ (harf duyarsızlık vektörü) KAPANDI.**

### 1.2 `_selftest.cjs` — bizzat koşturuldu (✓ DOĞRULANDI)

```
$ node .claude/hooks/_selftest.cjs
... (50 satır "OK")
TUM TESTLER GECTI
```
**Sayım notu (küçük tutarsızlık, önem değil):** sözleşme/kontrat metninde "49/49" bekleniyor
gibi okunabiliyordu, ben bizzat saydığımda **50** `OK` satırı var (7 GG2 kısaltma vakası +
1 tam-hâl + 2 yanlış-pozitif = 10 block-dangerous vaka'sı dahil önceki 26 + yeni gate-check
14 vaka). Fark yalnızca raporlama/sayma farkı, testlerin kendisi **hepsi geçiyor** — bloklayıcı
değil, ama sayı raporlarken "50/50" yazılmalı.

### 1.3 Kapsam mekanizmasını yenmeye çalışma — sandbox'ta (kısmen ✓ DOĞRULANDI)

`parseGuardScope`'un backtick ayrıştırıcısını (yorum içi ad, çoklu backtick, glob, unicode
benzeri karakter) kandırmaya çalıştım:

| Vektör | Sonuç | Değerlendirme |
|---|---|---|
| Yorum içinde ad: `` // bkz. `block-dangerous.cjs` `` | kapsama girer (aynen amaçlandığı gibi) | Beklenen — ayrıştırıcı "yorum" ile "onay metni"ni ayırt etmiyor, ama bu zaten önemsiz: **§0 bulgusu** nedeniyle metnin kendisi zaten hosted oturumun serbestçe yazabildiği bir şey |
| Çoklu backtick: `` `a.cjs` ve `b.cjs` `` | ikisi de kapsama girer | Beklenen davranış (madde 4 tasarımı zaten çoklu dosyaya izin veriyor) |
| Glob: `` `*.cjs` `` | kapsama GİRMEZ (`/^[\w-]+\.cjs$/` `*`'ı reddeder, `\w` içermiyor) | Ayrıştırıcı glob'u reddediyor — iyi, ama zaten önemsiz (§0) |
| Yol içeren ad: `` `../hooks/gate-check.cjs` `` | kapsama GİRMEZ (regex `/` karakterini reddeder) | Doğru davranış |
| Unicode benzeri (Kiril `с` ile `blocк-dangerous.cjs`) | kapsama GİRMEZ, dolayısıyla gerçek `block-dangerous.cjs` hiç "görülmüyor" — GUARD.ok TÜKENMEZ | Zararsız (fail-closed yönünde bir hata: token boşa gitmeyip diskte kalır ama yeni bir guarded yazmaya izin vermez) |

**Sonuç: backtick ayrıştırıcısının kendisi görece sağlam (glob/yol/unicode reddediliyor).**
Ama bu sağlamlık **anlamsız** — çünkü §0 bulgusu, ayrıştırıcının doğru çalışıp çalışmadığından
bağımsız olarak, saldırganın GUARD.ok'un **metnini** sıfırdan/serbestçe yazabildiğini
gösteriyor. Ayrıştırıcıyı "kandırmaya" gerek yok; saldırgan zaten içeriğin yazarı.

### 1.4 `.guard-state.json` elle düzenlenip token yeniden kullanılabilir mi

**✓ DOĞRULANDI, EVET** — §0.3'te gösterildi: dosya `docs/` altında, hiçbir hook tarafından
korunmuyor. Token teknik olarak "tüketiliyor" (dosya siliniyor) ama saldırgan `.guard-state.json`'ı
veya `GUARD.ok`'un kendisini tüketimden önce **istediği gibi** değiştirebildiği için "tüketim"
kavramı bir güvenlik sınırı değil, yalnızca dürüst bir agent için bir ritüel/hesap verebilirlik
kaydı.

### 1.5 Kapsam çıkarılamazsa gerçekten fail-closed mi (✓ DOĞRULANDI)

```
$ echo '{"tool_input":{"file_path":".claude/hooks/block-dangerous.cjs"}}' | node .claude/hooks/gate-check.cjs
# GUARD.ok var ama içinde backtick'li hiçbir token yok (ör. sadece "onaylandı" yazıyor)
Engellendi: ... GUARD.ok kapsamı dışında ...
exit=2
```
Backtick'siz/boş kapsamlı bir GUARD.ok gerçekten **hiçbir guarded yazmaya izin vermiyor** —
bu alt-mekanizma iddia edildiği gibi çalışıyor (yalnızca §0 nedeniyle pratikte önemsiz,
çünkü saldırgan backtick'li bir metin yazmakta özgür).

---

## 2. GG2 (Remove-Item kısaltmaları) — yeniden doğrulama

`_selftest.cjs`'in (g) grubu 7/7 kısaltmayı (`-r,-re,-rec,-recu,-recur,-recurs,-recurse`)
kapsıyor, yanlış pozitif yok (§1.2 çıktısı). Ek manuel kontrol (§ "Spot-check"):
```
rmdir emptydir          -> exit 0 (doğru, zararsız)
del myfile.txt           -> exit 0 (doğru)
git commit -m "rd bug fixed" -> exit 0 (doğru, metinde bare "rd")
ri build                 -> exit 0 (doğru, bayraksız)
Remove-Item -Force build -> exit 0 (doğru, farklı bayrak)
```
**GG2 kapandı, yeni yanlış pozitif bulunamadı.**

---

## 3. Sandbox mutasyon kanıtı hakkında karar

Developer'ın raporu, kapsam-kontrolü mutasyonunun (`scope.has(relLower)` bloğunun
kaldırılması) **sandbox'ta bir kopya üzerinde** koşulduğunu, gerçek dosyada koşulamadığını
belirtiyor. **Karar: bu kanıt türü olarak kabul edilebilir ama yetersiz kapsamlı.**

- Kabul edilebilir yön: mutasyonun kendisi salt kod-mantığı testi — `scope.has(...)`
  kontrolünü kaldırmak "kapsam dışı reddi" (vaka e) kırmızıya düşürür; bu, hangi dosyada
  koşulduğundan bağımsız olarak **doğru bir mantıksal test**. `_selftest.cjs`'in
  kendisi zaten gerçek `gate-check.cjs`'i **gerçek repo kökünde** (`process.cwd()` = repo)
  çalıştırıyor, yalnızca `docs/approvals/GUARD.ok`/`.guard-state.json` gibi **durum**
  dosyalarını sandbox/geçici konumlarda tutuyor olabilir — bu, üretim kodunun (gate-check.cjs)
  kendisinin test edildiği anlamına geliyor, "kopya kod" değil.
- Yetersiz kalan yön: bu tur boyunca bizzat yaptığım testler (§0, §1.3) da **gerçek
  `gate-check.cjs` dosyasının aynı kopyası**yla ama **sandbox'ın kendi `docs/approvals/`
  dizini** üzerinde koşuldu — yani "çit fiilen doğrulanmamış" iddiası **yanlış**: mekanizmanın
  kod-mantığı hem developer'ın hem benim testlerimde gerçek koda karşı doğrulandı. Ama asıl
  **doğrulanmamış olan**, çitin arkasındaki varsayım: "GUARD.ok bir kullanıcı rızası temsil
  eder" — bu varsayım hiçbir mutasyonla test edilmemiş çünkü test edilebilecek bir kod yolu
  değil, bir **mimari boşluk** (§0).

**Sonuç: kod-mantığı mutasyon kanıtı yeterli ve geçerli; ama bu turun asıl kritik bulgusu
(§0) zaten mutasyon testiyle yakalanamayacak bir sınıf — orada "çit" diye bir şey yok,
çünkü korunması gereken kaynak (`docs/approvals/**`) hiç guarded değil.**

---

## 4. Ortam doğrulaması (bizzat koşturuldu)

```
$ node .claude/hooks/_selftest.cjs   -> 50/50 OK, "TUM TESTLER GECTI"
$ npm run test                       -> Test Files 85 passed | 1 skipped (86)
                                         Tests 1361 passed | 4 skipped (1365)
$ npm run e2e                        -> 55 passed (42.7s)
```
Port 7333 denetim başında ve `npm run e2e` sonrasında **boş** (yalnızca `TIME_WAIT` kalıntı
bağlantılar, `LISTENING` yok); `tasklist` yetim `node.exe` göstermedi.
`npm run test` çıktısındaki "Hata:"/"Uyarı:" satırları testlerin **kasıtlı olarak enjekte
ettiği** hata-yolu senaryoları (F-005/F-008 desenleri) — regresyon değil.

---

## 5. Onay dosyaları bütünlüğü (denetim öncesi/sonrası)

SHA-256, tur2 ile **birebir aynı**:
```
G0.ok   3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565
G1.ok   72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234
G2.ok   a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5
G3.ok   36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2
G4-1.ok 08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b
G4-2.ok 6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace
```
`GUARD.ok`/`DANGER.ok`/`PUSH.ok` gerçek repoda **hiç yazılmadı** (yalnızca sandbox'ta,
scratchpad altında). `git status --porcelain` boş. Dört hook dosyasının (`gate-check.cjs`,
`block-dangerous.cjs`, `_selftest.cjs`, `_common.cjs`) MD5'i denetim boyunca değişmedi
(yalnızca okundu ve stdin ile salt-okunur çağrıldı).

---

## 6. G5 için CEO'ya tavsiye

### Birinci sorunun cevabı: **EVET — KRİTİK.**

Barındırılan bir oturum, `docs/approvals/GUARD.ok`'u (ve aynı nedenle `DANGER.ok`, `PUSH.ok`,
her `G*.ok`, `.guard-state.json`'ı) **kullanıcıya hiç sormadan kendi kendine yazabiliyor**
çünkü `gate-check.cjs`'in `free` listesi `docs/` yolunun tamamını serbest bırakıyor ve
`.claude/settings.json`'ın `permissions.allow`'u `Write(docs/**)`'i **otomatik onaylı**
listede tutuyor, `deny` listesinde `docs/approvals/**` için istisna yok. Bu, yalnızca
GUARD.ok'a özgü değil — **tüm onay-dosyası mimarisinin temel varsayımını** (dosyanın
varlığı = kullanıcı rızası) geçersiz kılıyor. Üstelik mevcut, gerçekten kullanıcı onaylı
bir GUARD.ok'un bile **kapsamı, tüketilmeden önce genişletilebiliyor** (§0.3) — bu ikinci
yol, ilkinden bile daha sinsi çünkü "GUARD.ok var, demek ki biri onayladı" varsayımını
kırıyor.

**G5 bu haliyle GEÇEMEZ.** K2 ve K3 gerçekten kapandı, K1-YENİ (harf duyarsızlığı) gerçekten
kapandı, GG2 gerçekten kapandı — ama bunların hepsi, altlarındaki onay dosyası mekanizmasının
kendisi sömürülebilir olduğu için **pratikte anlamsız hâle geliyor**. Kilit sağlam ama kapı
menteşesiz.

### Kapanış için gerekli (öneri, kısıtlı — bu turda kod düzeltmedim):

1. **(BLOKLAYICI) `docs/approvals/*.ok` ve `docs/approvals/.guard-state.json` dosyalarının
   YAZILMASINI/DÜZENLENMESİNİ de bir hook ile kısıtlayın.** En basit yol: `gate-check.cjs`'e
   yeni bir kontrol ekleyin — `docs/approvals/` altındaki `*.ok` ve `.guard-state.json`
   dosyalarına yapılan Edit/Write çağrılarını **her zaman** `AskUserQuestion` ile kullanıcıya
   sorulmasını zorunlu kılan ayrı bir kapı yapın (ör. bu dosyalara yazmak, kullanıcının
   **kendi** terminalinden/etkileşimli onayından gelmeli, hosted oturumun Write aracından
   değil). Teknik olarak bir hook bunu %100 ayırt edemez (her ikisi de aynı Write tool call'u
   gibi görünür) — bu nedenle asıl çözüm muhtemelen **mimari**: onay dosyalarını agent'ın
   yazamayacağı bir kanaldan (ör. kullanıcının kendisinin çalıştırdığı ayrı bir CLI komutu,
   ya da harici bir onay sunucusu/dosya sistemi izni) üretmek. Bu, bu depronun mevcut
   "agent kendi onayını AskUserQuestion sonrası kendi yazar" desenini **temelden** değiştirir
   — küçük bir yama değil, tasarım kararı gerektirir.
2. **(BLOKLAYICI, ara-çözüm önerisi — kalıcı çözüme kadar)** En azından `.claude/settings.json`
   `permissions.deny` listesine `"Edit(docs/approvals/**)"` ve `"Write(docs/approvals/**)"`
   ekleyip, bu yolun **ayrı** ve **her seferinde** kullanıcıya sorulan bir izin sınıfı
   olmasını sağlayın (Claude Code'un kendi "sor" davranışına düşecektir, çünkü artık `allow`
   listesindeki genel `Write(docs/**)` kuralına düşmeyecek — deny, allow'dan önceliklidir).
   Bu, hosted oturumun **sessizce** GUARD.ok/DANGER.ok/PUSH.ok/G*.ok üretmesini engeller;
   kullanıcı en azından her seferinde bir onay isteği görür. **Tek başına yeterli değil**
   (bir istismarlı/manipüle edilmiş prompt yine kullanıcıyı "evet" demeye ikna edebilir) ama
   şu anki **hiçbir sorulmadan geçen** durumdan çok daha iyi bir taban çizgi.
3. **(BLOKLAYICI)** madde 1/2 kapanmadan `_selftest.cjs`'e, "GUARD.ok'un kendisi guarded
   değilse kapı anlamsızdır" sınıfını ölçen en az bir regresyon vakası ekleyin (ör.
   `docs/approvals/GUARD.ok`'a yazma denemesinin de bir onay/kayıt gerektirdiğini doğrulayan
   test) — aksi hâlde bu bulgu ileride sessizce tekrar açılabilir.
4. K1-YENİ (harf duyarsızlığı), GG2 ve K1'in kapsam-metni ayrıştırma sağlamlığı (§1.3)
   **kapalı sayılabilir** — yalnızca madde 1/2 kapanana kadar bunların **hiçbiri** gerçek
   bir güvenlik sınırı oluşturmuyor, sadece "dürüst agent için sürtünme" sağlıyor.

### Orantı notu
Bu yerel, tek kullanıcılı bir araç; asıl tehdit modeli kötü niyetli bir dış saldırgan değil,
**hatalı/manipüle edilmiş bir prompt'un veya kaçan bir alt-görevin kendi güvenlik
sınırlarını sessizce genişletmesi**. Mevcut hâliyle sistem bu tehdide karşı **sıfır** direnç
gösteriyor (bir Write tool call'u yeterli) — bu, "savunmanın bir tavanı var" ilkesiyle
tutarlı olarak kabul edilebilecek bir kalıntı risk değil, **temel varsayımın kendisi
çürük** olduğu bir durum. Madde 2 (deny listesi) ~5 dakikalık bir düzeltme ve hemen
uygulanmalı; madde 1 (mimari kanal ayrımı) bir sonraki tur için planlanmalı.
