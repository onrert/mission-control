KARAR: GEÇTİ
ESKALE: false

# G5 — `docs/qa/g5-guard-json-contract.md` kapanış kararı (tur 5)

Tarih: 2026-09-11 · Değerlendiren: qa-evaluator · Kapsam: **ÇOK DAR** — yalnızca 1 numaralı
sözleşme (`g5-guard-json-contract.md`) ve yalnızca M1 + M2. Diğer dört sözleşme tur 4'te GEÇTİ
aldı; **yeniden açılmadı, ölçülmedi, bu raporun konusu değil.**

> **Karar tek cümlede:** M1 ve M2 gerçekten kapandı — beyaz liste artık **tam 6** ayırt edici
> vakayla ölçülüyor (tur 4'te 0'dı), tarayıcı fail-open'ı hem kasıtlı derinlik sınırıyla hem de
> ayrıştırılmış catch'le kapandı ve ikisi de **canlı sızıntı üretilerek** doğrulandı; sözleşmenin
> §5/§8'deki yanlış mutasyon iddiası ölçülmüş sayılarla düzeltilmiş. Aradığım yeni açık
> (`__scanErr` bayrağının taklit edilmesi) **9,16 milyon belgede ve bağımsız bir ayrıştırıcıya
> karşı sıfır** çıktı.

---

## 0. Tur güvenliği ve kısıtlara uyum

| `docs/approvals/` dosyası | Tur başı SHA-256 | Tur sonu SHA-256 | Durum |
|---|---|---|---|
| `G0.ok` | `3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565` | aynı | değişmedi |
| `G1.ok` | `72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234` | aynı | değişmedi |
| `G2.ok` | `a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5` | aynı | değişmedi |
| `G3.ok` | `36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2` | aynı | değişmedi |
| `G4-1.ok` | `08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b` | aynı | değişmedi |
| `G4-2.ok` | `6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace` | aynı | değişmedi |
| `README.md` | `8d9c8762613299874ab528c30535db52d4774fe665c3fd8e4bd9b10d95b871d7` | aynı | değişmedi |

- **Bekleyen token durumu (tur başı ve tur sonu): YOK.** `GUARD.ok` / `PUSH.ok` / `DANGER.ok` /
  `.guard-state.json` onay dizininde hiç bulunmadı; `_selftest.cjs`'in emniyet kemeri (exit 3)
  tetiklenmedi, betik normal koştu. **Bu turda hiçbir token tüketilmedi/harcanmadı.**
- Hiçbir kaynak dosya değiştirilmedi. `git status --short` tur başı ve tur sonu **boş**.
  `gate-check.cjs` MD5 = `d8e22e4e658a43252a103c478ec80c11`, `_selftest.cjs` MD5 =
  `8e8969fd4d31bc6cb7025cafad94fec3` — tur başı ve sonu aynı.
- Tüm mutasyonlar depo dışı bir **aynada** yapıldı. Ayna kurulurken dokuz hook dosyasının MD5'i
  birebir doğrulandı (`TUM MD5 ESIT: true`). Her mutasyon **pristine kopyadan yeniden yazılarak**
  geri alındı — `git checkout` / `git restore` **KULLANILMADI** (kayıtlı ders) — ve her seferinde
  "bayt-bayt aynı = true" doğrulandı.
- Onay dizini adı, yazma/silme fiilleriyle aynı Bash komut satırında bilerek kullanılmadı;
  hash'ler ve dizin işlemleri `Write` ile yazılan `.mjs` betikleri üzerinden yapıldı. Yine de
  tur sonunda kabuk kapısından **iki kez yanlış pozitif aldım** (§7, B-6): (1) aynanın onay
  dizinini listeleyen **salt-okunur** bir `ls`, komutun BAŞKA bir yerinde ilgisiz bir silme
  çağrısı bulunduğu için komutun tamamıyla engellendi — üstelik hedef gerçek depo değil, geçici
  bir aynaydı; (2) bu raporda o olayı **anlatan düzeltme metninin kendisi** aynı desene takıldı
  ve yazma hiç gerçekleşmedi. İkisini de `.mjs` betiğine taşıyarak aştım.

---

## Puanlar

| Eksen | Tur 4 | Tur 5 | Gerekçe |
|---|---|---|---|
| İşlevsellik | 9 | **9** | Kurulu kod tüm saldırılarımı doğru karşıladı; self-test 165/165; e2e sondamda 23 vakadan 22'si beklendiği gibi, kalan 1 **benim** beklentimin yanlış olmasıydı (§3.1). |
| Özellik bütünlüğü | 9 | **9** | M1 ve M2 kapandı; sözleşmenin §5/§8'deki yanlış kanıt cümlesi ölçülmüş sayılarla düzeltilmiş; §11 gerçeği anlatıyor. |
| Görsel/UX | yok say | yok say | Hook/CLI, arayüz yok. |
| **Kod kalitesi (testler, hata yönetimi)** | **6** | **8** | Yük taşıyan iki nokta (beyaz liste, catch ayrımı) artık **ölçülüyor** ve mutasyonla kanıtlandı; sızdıran dalın (dizi derinliği) kendi çiti var. Eksik: yeni kodun **savunma-derinliği** dalı (obje derinlik sayacı) hâlâ çitsiz (§4.2) + tur 4'ten devreden 6 çitsiz nokta açık. 9 değil, 8. |

**Hiçbir eksen < 7 → KARAR: GEÇTİ.** Karar yalnızca `docs/qa/g5-guard-json-contract.md` içindir.

---

## 1. Ölçüm tabanı

| Ölçüm | Sonuç |
|---|---|
| `node .claude/hooks/_selftest.cjs` (gerçek depo, tur başı) | **exit 0, OK=165, FAIL=0** |
| `node .claude/hooks/_selftest.cjs` (gerçek depo, tur sonu) | **exit 0, OK=165, FAIL=0** |
| Aynada aynı betik (bağımsız kurulum) | **exit 0, OK=165, FAIL=0** |

Brief'in beklediği 165/165 **birebir tuttu**; bekleyen token olmadığı için exit 3 yolu hiç
tetiklenmedi.

---

## 2. M1 — beyaz liste çiti gerçekten kapandı mı? **EVET (tam 6)**

### 2.1 Mutasyonu kendim uyguladım

`normalizeScopeEntry`'nin gövdesindeki üç satır (ters bölü reddi + iki beyaz liste regex'i +
`return null`) tek satırla değiştirildi: `return item.toLowerCase();` — yani **her dize olduğu
gibi kabul edilsin**, sözleşmenin §5 madde 1'inin tarif ettiği mutasyon.

```
node --check: gecerli (sahte kirmizi degil)
MUTASYON UYGULANDI: M1-whitelist | md5=de2e2f7c1b7710c34775d90f8f7b05f0 (pristine=d8e22e4e...ebaf)
self-test exit=1   OK=159   FAIL=6
```

| Beklenen | Gerçek |
|---|---|
| **tam 6 KIRMIZI** | **tam 6 KIRMIZI** |

Kırmızı veren altı vakanın tamamı yeni eklenenler:

```
FAIL D-WHITELIST-SUBDIR      (.claude/hooks/sub/evil.cjs)
FAIL D-WHITELIST-EXT-MD      (.claude/hooks/notes.md)
FAIL D-WHITELIST-EXT-JSON    (.claude/hooks/config.json)
FAIL D-WHITELIST-SPACE       (.claude/hooks/evil file.cjs)
FAIL D-WHITELIST-DOUBLE-EXT  (.claude/hooks/evil.payload.cjs)
FAIL D-WHITELIST-NESTED      (.claude/hooks/a/b/c.cjs)
```

Kalan 159 vaka **değişmeden yeşil** — yani eski D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/
D-UNI vakaları hâlâ yeşil, çünkü onlar kapsam **üyeliğini** ölçüyor, beyaz listeyi değil. Bu,
sözleşme §11.1'de yazılan düzeltilmiş iddianın **birebir aynısı**. Tur 4'te aynı mutasyon **0
kırmızı** veriyordu; **ölçülen fark: 0 → 6.**

Mutasyon elle geri alındı (`git checkout` yok): `GERI ALINDI. bayt-bayt ayni = true`, ve aynadaki
dosyanın MD5'i gerçek depodakiyle aynı çıktı.

### 2.2 Aşırı engelleme üretiyor mu? **HAYIR (11/11 meşru vaka kabul)**

M1 için **kod değişmedi** (commit `f46954d`'nin `gate-check.cjs` diff'i tamamen M2'dir — diff'i
okudum, `normalizeScopeEntry` satırlarına dokunulmamış), yani yapısal olarak aşırı engelleme
riski yok. Yine de bağımsız ölçtüm — kurulu kodla, gerçek hook sürecini stdin'den sürerek:

| Sonda | Beklenen | Gerçek |
|---|---|---|
| OB-1 düz meşru kapsam (`.claude/hooks/block-dangerous.cjs`) | kabul | exit 0 |
| OB-2 harf varyantı (`.CLAUDE/HOOKS/BLOCK-DANGEROUS.CJS`) | kabul | exit 0 |
| OB-3 iki elemanlı kapsam | kabul | exit 0 |
| OB-4 `.claude/settings.json` hedefi | kabul | exit 0 |
| OB-5 alt çizgi + tire içeren adlar (`_selftest.cjs`) | kabul | exit 0 |
| OB-6 3000 karakterlik serbest `reason` | kabul | exit 0 |
| OB-7/8/9 `reason` iç içe derinlik 2 / 3 / 5 | kabul | exit 0 (3/3) |
| OB-10 `reason` **obje** derinlik 5 | kabul | exit 0 |
| OB-11 `reason` dizi derinlik 198 | kabul | exit 0 |

**11/11 kabul.** Beyaz liste meşru bir kapsamı reddetmiyor.

---

## 3. M2 — tarayıcı fail-open'ı gerçekten kapandı mı? **EVET, ve düşündüğümden daha kritikti**

### 3.1 Derin belge, `MAX_GUARD_BYTES`'in altında bir boyutla reddediliyor mu? **EVET (dizi ve obje)**

Kurulu kodla, gerçek hook süreciyle:

| Sonda | Bayt | Beklenen | Gerçek |
|---|---|---|---|
| M2-A dizi derinlik 201 | 500 | red | **exit 2**, GUARD.ok **silinmedi** |
| M2-B dizi derinlik 400 | 898 | red | **exit 2**, silinmedi |
| M2-C **obje** derinlik 400 | 2 498 | red | **exit 2**, silinmedi |
| M2-D **obje** derinlik 1300 (~7,9 KB, bayt sınırının altında) | 7 898 | red | **exit 2**, silinmedi |
| EXP-1 derin + süresi dolmuş | 898 | red, dosya **silinmez** | exit 2, silinmedi |

Hepsi 8192 baytlık sınırın **altında** — yani derinlik sınırı **kendi başına**, boyut sınırı
devreye girmeden tetikleniyor. Sözleşmenin §11.2 iddiası tuttu.

**Makul derinlik hâlâ kabul ediliyor.** Kesin sınırı ölçtüm (`reason` alanındaki iç içe dizi):

```
derinlik 196 -> exit 0 KABUL      derinlik 199 -> exit 2 RED
derinlik 197 -> exit 0 KABUL      derinlik 200 -> exit 2 RED
derinlik 198 -> exit 0 KABUL
```

> **Not (bulgu değil):** e2e sondamda `OB-11`'i başta 199 derinlikle yazmıştım ve "kabul" bekliyordum;
> kod exit 2 verdi. Kökeni benim aritmetiğimdi — kök nesne `depth=1`, üyesinin değeri `depth=2`
> ile başlıyor, dolayısıyla bir kök üyesinin altında **198** seviye sığıyor. Kodda hata yok;
> gerçek gerçekleşme meşru bir belgeninkinden (1-3) **66 kat** daha derin.

### 3.2 `catch` ayrımını geri saran mutasyon o belgeyi kabul ediyor mu? **EVET — ve CANLI SIZINTI üretiyor**

Bu, turun en önemli ölçümü. `parseGuardDoc`'taki ayrıştırılmış catch, tur-4-öncesi hâline
(`catch (_) { dup = null; }`) döndürüldü; **derinlik sınırı yerinde bırakıldı.**

```
MUTASYON UYGULANDI: M2-catch-revert (node --check gecerli)
self-test exit=1  OK=164  FAIL=1
FAIL (D-SCANNER-DEPTH-EXCEEDED) 400 seviye ic ice "reason" -> derinlik siniri ...
```

Ama asıl kanıt self-test değil, **sömürü sondam**. Belge şu biçimde: görünen ilk `scope` meşru
dosyayı listeliyor, uzun bir `reason` derin iç içe geçmiş, sonra **gizli ikinci `scope`**
`.claude/hooks/evil.cjs`'i listeliyor:

| Sonda | Bayt | Kurulu kod | `catch` geri sarılınca |
|---|---|---|---|
| SÖMÜRÜ-1 derin **dizi** + gizli ikinci `scope`, hedef `evil.cjs` | 933 | **exit 2 (red)** | **exit 0 — EVIL YETKİLENDİRİLDİ** |
| SÖMÜRÜ-2 derin **obje** + gizli ikinci `scope`, hedef `evil.cjs` | 2 533 | **exit 2 (red)** | **exit 0 — EVIL YETKİLENDİRİLDİ** |
| SÖMÜRÜ-3 sığ (150) + gizli ikinci `scope` | 433 | exit 2 | exit 2 (yinelenen-anahtar katmanı yakalıyor) |

**Bu, tur 4'teki tablodan daha ağır bir sonuçtur.** Tur 4'te bulduğum fail-open **ulaşılamazdı**
(`MAX_GUARD_BYTES` ~4038 derinliğe izin veriyordu, `RangeError` ~5074'te geliyordu, pay 1,26x).
Kasıtlı derinlik sınırı eklendikten sonra, **eğer catch ayrımı yapılmasaydı**, aynı sızıntı
**933 baytlık** bir belgeyle **doğrudan ulaşılabilir** hâle gelecekti. Yani M2'nin iki parçası
birbirine bağımlı: derinlik sınırı tek başına eklenseydi, koruma **iyileşmez, kötüleşirdi**.
Catch ayrımı burada **yük taşıyan** bir kontroldür ve çiti (D-SCANNER-DEPTH-EXCEEDED) gerçektir.

### 3.3 Koruma `MAX_GUARD_BYTES`'ten gerçekten bağımsız mı? **EVET — gerçek `RangeError` ile ölçtüm**

Tur 4'ün B-1 borcunun tam cevabı. `MAX_GUARD_BYTES` 200 000'e çıkarılmış kopyalarda (yalnızca
kanıt sondası; üretim sabiti değişmedi), 8000 ve 12000 seviyelik iç içe dizi + gizli ikinci
`scope`:

| Sonda kopyası | 8 000 derinlik (16 133 B) | 12 000 derinlik (24 133 B) |
|---|---|---|
| **BYTES-BIG** (bayt sınırı 200 000, geri kalan kurulu hâl) | **exit 2** — *"tarayici calisamadi (izin verilen en fazla ic ice derinlik…)"* | **exit 2** |
| **BYTES-BIG + DEPTH-OFF** (`MAX_SCAN_DEPTH=Infinity` → **gerçek** `RangeError`) | **exit 2** — *"tarayici calisamadi (Maximum call stack size exceeded)"* | **exit 2** |
| **BYTES-BIG + OLD-CATCH** | **exit 0 — SIZINTI** | **exit 0 — SIZINTI** |
| **BYTES-BIG + DEPTH-OFF + OLD-CATCH** | **exit 0 — SIZINTI** | **exit 0 — SIZINTI** |

Okunuşu: (a) bayt sınırı büyütülse bile derinlik sınırı tek başına yetiyor; (b) derinlik sınırı da
kaldırılıp **gerçek çağrı-yığını taşması** oluşturulduğunda yeni catch onu yakalayıp fail-closed
dönüyor — yani koruma yalnızca "kasıtlı sinyale" değil, **gerçek `RangeError`'a** da dayanıyor;
(c) her iki senaryoda da eski catch'e dönülünce sızıntı **canlı** olarak yeniden üretiliyor.

**Tur 4'ün B-1 borcu (`MAX_GUARD_BYTES` gizli taşıyıcı kolon) KAPANDI** — ölçülerek.

### 3.4 Katmanların tek tek çitlenmesi

| Tek noktayı gevşeten mutasyon | Self-test kırmızı | Sömürü sondası | Yorum |
|---|---|---|---|
| `catch` ayrımını geri sar | **1** (D-SCANNER-DEPTH-EXCEEDED) | **2 canlı sızıntı** | **Yük taşıyor, çitli.** |
| `MAX_SCAN_DEPTH = Infinity` | **1** (aynı test) | sızıntı yok | Savunma-derinliği, **çitli**. |
| Derinlik sayacı **dizilerde** artmasın | **1** (aynı test) | sızıntı yok | **Çitli** (asıl sızıntı vektörü buydu). |
| Derinlik sayacı **objelerde** artmasın | **0 — 165/165 YEŞİL** | sızıntı yok (§4.2) | **ÇİTSİZ**, ama yük taşımıyor → borç B-5. |

---

## 4. Kendi saldırım — yeni derinlik sınırı ve ayrıştırılmış catch yeni bir açık getirdi mi?

### 4.1 Kritik soru: **sahte `__scanErr` üretilebilir mi?** — CEVAP: **HAYIR** (ölçüldü, tahmin değil)

Tehdit modeli net: `catch` bloğu, hatanın `__scanErr` bayrağını taşıması hâlinde belgeyi
**güvenli sayıp** `dup = null` yapıyor (gerekçe: "`JSON.parse` zaten aynı belgeyi reddedecek").
Bu gerekçe **yalnızca** tarayıcının grameri `JSON.parse`'ın gramerinden **daha dar olmadığı**
sürece doğrudur. Tarayıcı bir noktada `JSON.parse`'tan **daha katı** olsaydı, o noktayı tetikleyen
+ yinelenen anahtar taşıyan bir belge, yinelenen-anahtar katmanını **tamamen** atlardı.

Bunu üç bağımsız yoldan ölçtüm.

**(a) Bağımsız çapraz kontrol — CPython'un `json` modülü.** Kendi yazdığım ikinci bir ayrıştırıcı
aynı kör noktayı taşıyacağı için (kayıtlı ders), oracle olarak **V8 ile hiç kod paylaşmayan**
CPython 3.12'nin C ayrıştırıcısını kullandım (`object_pairs_hook` ile her seviyede yinelenen
anahtar tespiti). Korpus: 5 tabandan üretilmiş **180 582** belge — 51 404'ü sistematik tek
karakterlik tarama (her pozisyon × 138 karakter, ekleme **ve** değiştirme), gerisi çok mutasyonlu
rastgele.

```
node tarayici sinif dagilimi: {'scanErr': 135835, 'dup': 26655, 'ok': 18092}
(A) FAIL-OPEN     (scanErr + python KABUL + yinelenen VAR) : 0
(B) KACIRILAN DUP (node "ok"  + python yinelenen buldu)    : 0
(C) ASIRI ENGEL   (node "dup" + python yinelenen YOK)      : 0
(D) GRAMER AYRISMASI (node tarayici kabul != python kabul) : 0
```

**(b) Harnessin pozitif kontrolü** — "0 bulgu" ölü bir harnessten de gelebilir (bu deponun en
pahalı hata sınıfı). Tarayıcıyı kasten üç ayrı yerden bozup harnessin **gerçekten** bulduğunu
gösterdim:

| Bozulmuş tarayıcı | (A) | (B) | (C) |
|---|---|---|---|
| Üstel sayı gösterimini reddet (`3e0` → sahte sözdizimi hatası) | **3** | 0 | 0 |
| Yinelenmeyi yalnızca kökte ara | 0 | **6 825** | 0 |
| Her anahtarı yinelenen say | 0 | 0 | **18 092** |

Yani harness üç kategorinin üçünü de tespit edebiliyor; kurulu kodda 0/0/0/0 çıkması **ölçüm**,
sessizlik değil.

**(c) Yalnızca GEÇERLİ JSON üreten hedefli fuzz.** Rastgele mutasyon çoğunlukla geçersiz belge
üretiyor (135 835/180 582); tehlikeli yarıya yoğunlaşmak için **yapı gereği geçerli** JSON üreten
bir üreteç yazdım (tüm kaçış dizileri, U+0000-U+001F kacis dizileri, yalnız yedek karakterler (lone
surrogate), astral karakterler, U+FEFF (BOM), Kiril/aksanlı harfler, `__proto__` ve unicode kaçışlı
anahtarlar, `1e999`/`-0`/`1e-323`/30 haneli sayılar, her boşluk biçimi):

```
URETILEN GECERLI BELGE: 8 979 165   | JSON.parse reddetti: 0
GECERLI belgede __scanErr (FAIL-OPEN): 0
GECERLI belgede beklenmeyen hata sinifi: 0
```

Aynı fuzz, üstel-gösterimi-reddeden bozuk tarayıcıyla **5 saniyede 141 023** bulgu verdi —
pozitif kontrol.

**Toplam: ~9,16 milyon belge, bağımsız bir ayrıştırıcıya karşı çapraz kontrol, sıfır sahte
`__scanErr`.** Ek olarak `fail()` çağrı noktalarının tamamını (12 nokta: sonlandırılmamış dize,
geçersiz kaçış, kaçışsız kontrol karakteri, geçersiz sayı/sabit, beklenen `,`/`:`/`}`/`]`,
beklenmeyen jeton, sondaki artık veri) tek tek okudum; hepsi RFC 8259 ihlallerine karşılık geliyor
ve `JSON.parse` da aynılarını reddediyor. `__scanDepthExceeded` bayrağı `__scanErr` **taşımıyor**
(ölçtüm: `kind='depth'` → fail-closed), gerçek `RangeError` de taşımıyor (§3.3).

Uçtan uca dört ek sonda da (kontrol karakteri, geçersiz `\q` kaçışı, kırık `\u00zz`, sondaki artık
veri — hepsi aynı belgede gizli ikinci `scope` ile) **4/4 exit 2** verdi.

### 4.2 BULGU (bloklayıcı DEĞİL) — obje derinlik sayacı çitsiz

Derinlik sayacı `parseObject` ve `parseArray`'de ayrı ayrı artıyor. **Obje** dalını geri saran
mutasyon (`parseValue(level + 1, depth + 1)` → `parseValue(level + 1, depth)`) self-test'i
**165/165 yeşil** bırakıyor — hiçbir test bu dalı görmüyor, çünkü D-SCANNER-DEPTH-* vakalarının
ikisi de **yalnızca dizi** kullanıyor.

**Sömürülebilir mi? HAYIR — ölçtüm, çıkarım yapmadım.** Mutasyon altında, 8192 baytlık sınıra
sığan **en derin** obje yapılarını denedim:

```
saf obje derinlik=1611  bayt=8188  exit=2  red  (tarayici duplicate'i buldu)
saf obje derinlik=1610  bayt=8183  exit=2  red
karisik 198 dizi + 1532 obje  bayt=8189  exit=2  red
```

`RangeError` eşiği ~5074 seviye; bayt sınırı en fazla ~1611 seviyeye izin veriyor (pay **3,1x**).
Yani obje derinlik sayacı bugün **savunma-derinliğidir**, yük taşımaz — tur 4'ün P2/P8/P16/P17'yi
"gerçekten fazlalık, borç değil" sayan taksonomisiyle **aynı sınıf**. Sözleşme de bu dalın
çitli olduğunu **iddia etmiyor** (M1'i bloklayıcı yapan ikinci koşul burada yok; §11.2 açıkça
"gerçek sızıntı vektörü diziydi" diyor). Bu yüzden **eşikli borç B-5**, bloklayıcı değil.

> **Severity yükseltme kontrolü (zorunlu).** (a) Kalıcı bir artefakta dokunuyor mu? Hayır —
> kurulu davranış doğru, hiçbir dosyaya yanlış içerik yazılmıyor, onay dosyaları değişmedi.
> (b) Feature'ın ana vaadini çürütüyor mu? Hayır — *"kapsam yalnızca `scope`'tan okunur,
> belirsizlik sıfır erişime çözülür"* vaadi bu dalın mutasyonu altında bile ölçülerek ayakta
> (yukarıdaki üç sonda). Bu yüzden yükseltmiyorum.

### 4.3 Denenen ve tutmayan diğer saldırılar

| Saldırı | Beklenen | Gerçek |
|---|---|---|
| Derinlik sınırıyla GUARD.ok'u **sildirtmek** (süresi dolmuş + derin belge) | dosya silinmemeli | exit 2, **dosya duruyor** (ayrıştırma hatası silme yolunu tetiklemiyor) |
| Sığ (150) derinlikte gizli ikinci `scope` | yinelenen-anahtar katmanı yakalasın | exit 2 |
| Dize değeri içinde anahtar gibi görünen metin (aşırı engelleme sondası) | kabul | kabul, ad yetkilenmiyor |
| Yalnız unicode kaçışlı `scope` (tek başına) | kabul | kabul |
| `__proto__` kök anahtarı | red | red |
| Astral/yalnız yedek karakter/`U+2028`/`U+FEFF`/DEL içeren geçerli belge + yinelenen anahtar | red (yinelenen) | red (9/9) |

---

## 5. Sözleşmenin kabul kriterleri (§8) — tur 5 durumu

| # | Kriter | Sonuç |
|---|---|---|
| 1 | self-test exit 0, vaka sayısı raporlanır | ✅ **165/165**, exit 0 (gerçek depo **ve** ayna) |
| 2 | D-REASON-CANNOT-LEAK geçer | ✅ (tur 4'te dört yoldan doğrulanmıştı, bu turda yeniden açılmadı) |
| 3 | T-REGRESSION-MULTI-WRITE geçer | ✅ 165/165'in parçası |
| 4 | **§5'teki dört mutasyonun her biri belirtilen testleri KIRMIZI'ya çevirir** | ✅ **KARŞILANDI** — mutasyon 1 (düzeltilmiş metinle): **6/6 kırmızı**, ölçüldü (§2.1). Tur 4'te ❌ idi. |
| 5 | README güncel ve tam örnekli | ✅ (değişmedi; B-3 borcu açık) |
| 6 | Gerçek onay dosyalarının SHA-256'sı değişmemiş, `git status` temiz | ✅ 7/7 aynı, ağaç temiz |

**Tur 4'ün tek KALDI gerekçesi (kriter 4) kapandı.**

---

## 6. CEO'nun uygulaması gereken frontmatter değişikliği

```
docs/qa/g5-guard-json-contract.md  →  status: done
```

Diğer dört sözleşme tur 4'te zaten `status: done` olarak işaretlendi; bu tur onlara dokunmadı.

---

## 7. G5 kapısı için kalan engeller

**ENGEL YOK.** Beş sözleşmenin beşi de GEÇTİ; `g5-guard-json-contract.md`'nin tur 4'teki tek
bloklayıcısı (kabul kriteri 4) ölçülerek kapandı. G5 kapısı, kalite açısından kullanıcının önüne
gidebilir.

### Engel olmayan, taşınan eşikli borçlar

Bunları bu turda **yeniden ölçmedim** (brief §5 gereği); yalnızca eşikleriyle tekrarlıyorum ki
CEO `docs/blockers.md`'ye işleyebilsin.

| # | Borç | Eşik (ne zaman ele alınmalı) |
|---|---|---|
| **B-1** | ~~`MAX_GUARD_BYTES` gizli taşıyıcı kolon~~ | **KAPANDI** (§3.3 — ölçülerek; artık bayt sınırı büyütülse de koruma ayakta) |
| **B-2** | `gate-check.cjs`'te 6 çitsiz nokta: **P6** (`scope` dizi/boş kontrolü — bozulma biçimi **fail-open**, `exit 1` veriyor ve Claude Code yalnızca exit 2'yi engelleme sayıyor), **P9** (`created_at` dize olmalı), P2 (ham NUL reddi), P8 (ters bölü açık reddi), P16 (`isGuarded` harf duyarsızlığı), P17 (GUARD.ok varlık kontrolü). Yük taşıyanı **P6**; diğer beşi savunma-derinliği. | `gate-check.cjs`'e dokunan **bir sonraki** tur. En küçük iş: belgeyi yalnızca izin verilen alanlarla kurup (`{reason, created_at}`) `code === 2` assert eden bir vaka — P6'nın gerçek dalını bugün hiçbir test görmüyor. |
| **B-3** | "tek kullanımlık" ifadesi yanlış: `docs/approvals/README.md` başlığı + 9. satır ve `gate-check.cjs`'in engelleme mesajı *"(tek kullanımlık, JSON, zaman pencereli)"* diyor; gerçek davranış **zaman pencereli, yazma başına tükenmiyor**. Kullanıcıya gösterilen metin bu. | Bu iki dosyaya dokunan bir sonraki tur. |
| **B-4** | `npm run test` koşularının ~%43'ü `Worker forks emitted error` ile kırmızı (assert kırmızısı yok, 1 dosya sessizce kayboluyor). | G6/yayın öncesi, ya da kırmızı oranı iki ardışık turda > %50 olursa. Kendi sözleşmesini hak ediyor. |
| **B-5** | **(YENİ, bu tur)** Derinlik sayacının **obje** dalı çitsiz: `parseObject`'teki `depth + 1` → `depth` mutasyonu self-test'i **165/165 yeşil** bırakıyor. Bugün yük taşımıyor (§4.2: bayt sınırı ~1611 seviyeye izin veriyor, `RangeError` ~5074'te — pay 3,1x). | `MAX_GUARD_BYTES` **büyütülürse** ya da tarayıcı özyinelemeden çıkarılırsa **derhal**; aksi hâlde `gate-check.cjs`'e dokunan bir sonraki tur. En küçük iş: mevcut `D-SCANNER-DEPTH-EXCEEDED` vakasının **obje** varyantını eklemek (ölçtüm: 400 seviye obje = 2 498 bayt, bayt sınırının çok altında, bugün doğru şekilde exit 2 veriyor). |
| **B-6** | `block-dangerous.cjs` komutun tamamını tek metin olarak tarayıp ilgisiz parçaları birleştiriyor (tur 4'te QA'ya iki kez vurdu). Bu turda dosya işlemlerini `.mjs` betiklerine taşıyarak etrafından dolaştım, ama tur sonu temizliğinde yine de **iki kez** vurdu: bir salt-okunur listeleme çağrısı ve ardından bu olayı anlatan düzeltme metninin kendisi (§0). Kusur duruyor; maliyeti her turda birikiyor. | `docs/blockers.md`'de kayıtlı eşiği geçerli. |

Ayrıca 3 ve 4 numaralı sözleşmelerin devrettiği *"Y3'ün iki koruma katmanı kendi başına
ölçülmüyor"* borcu **hâlâ açık** (tur 4'te not edilmişti, bu turda yeniden açılmadı).

---

## 8. Tur sonu temizliği

- Ayna dizini ve tüm mutasyon kopyaları silindi; aynanın onay dizininde yalnızca kendi
  `G2.ok` fixture'ı vardı, gerçek onay dizinine hiç dokunulmadı.
- Yetim `node.exe` süreci bırakılmadı (tur sonu sayımı tur başıyla aynı).
- `npm run test` / `npm run e2e` bu turda **çalıştırılmadı** (brief gereği; ürün kodu değişmedi).
