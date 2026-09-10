---
status: qa
---

# G5 — GUARD.ok'un JSON'a taşınması (Y1'in dördüncü yaması değil, tasarım değişikliği)

Kaynak: `docs/qa/G5-sozlesme-kararlari-2026-09-10-tur3.md` (KARAR: KALDI, ESKALE: true — aynı
kabul kriteri (Y1) üç ardışık turda "metnin ŞEKLİ kapsamı belirliyor" ailesinden farklı bir
boyutta yenildi). Kullanıcı kararı: dördüncü bir metin-ayrıştırma yaması **yok**; GUARD.ok'un
makineye giden kısmı serbest markdown olmaktan çıkıp JSON'a taşınıyor (rapor §8 madde 5,
`ADR-013` "beyaz liste zorunlu" ilkesinin bu kapıya uygulanması).

## Bu değişiklik neden var (tek cümle)

Üç turun ortak kök nedeni "serbest metinden makine kararı çıkarmak"tı; kaynağı (markdown
ayrıştırması) tamamen ortadan kaldırıp kapsamı tek, ayrıştırması belirsizliğe yer bırakmayan bir
JSON alanından (`scope`) okumak, başlık-kimliği-devralma sınıfını **yapısal olarak imkânsız**
kılıyor — artık "hangi satır başlık sayılır" sorusu yok, çünkü başlık kavramı yok.

## 1. Kapsam (bu turun dokunduğu iki dosya, nihai hâlleri scratchpad'de)

- `.claude/hooks/gate-check.cjs` — `parseGuardScope()` kaldırıldı, yerine `parseGuardDoc()`
  (JSON ayrıştırıcı) geldi. `.guard-state.json` tabanlı kısmi-tüketim izleme mekanizması
  tamamen kaldırıldı (bkz. §3).
- `.claude/hooks/_selftest.cjs` — markdown'a özgü vakalar (`y1-*`, `y1t2-*`, sentetik `(c)/(e)/(f)`)
  JSON karşılıklarına çevrildi; yeni JSON-saldırısı ve zaman-penceresi vakaları eklendi.

Diğer yedi hook dosyasına (`_common.cjs`, `block-dangerous.cjs`, `asset-guard.cjs`,
`post-format.cjs`, `send-event.cjs`, `session-start.cjs`, `stop-check.cjs`) hiç dokunulmuyor.

## 2. Yeni GUARD.ok biçimi

```json
{
  "scope": [".claude/hooks/gate-check.cjs", ".claude/hooks/_selftest.cjs"],
  "reason": "insan için serbest metin — HİÇBİR ZAMAN taranmaz",
  "created_at": "2026-09-10T19:05:00+03:00",
  "valid_minutes": 30
}
```

### 2.1 Ayrıştırma kuralları ve karar noktaları (brief §2.1)

1. **Dosyanın tamamı `JSON.parse` edilir.** Ayrıştırılamazsa (sözdizimi hatası) → fail-closed
   (boş kapsam, `GUARD.ok` SİLİNMEZ — kullanıcı/CEO düzeltip tekrar denesin diye; yalnızca süresi
   dolan token silinir, bkz. §2.2).
2. **Kök değer bir JSON object olmalı** (dizi/dize/sayı/null/boolean değil). Değilse fail-closed.
3. **`scope` yalnızca kaynak.** Kapsam SADECE `doc.scope` alanından okunur. `reason` dahil
   başka HİÇBİR alan hiçbir zaman ad için taranmaz — bu, üç turun ortak kusurunu (serbest
   metnin herhangi bir yerinde geçen bir adın kapsamı etkilemesi) kaynağında yok eder.
4. **`scope` dolu bir dize dizisi olmalı.** Dizi değilse, boşsa, ya da elemanlarından **biri
   bile** dize değilse (sayı/null/nesne/dizi/boolean) → **TÜM kapsam geçersiz** (fail-closed).
   Gerekçe: "belirsizlik her zaman sıfır erişime çözülür" ilkesinin JSON karşılığı; kısmi kabul
   (geçerli elemanları alıp geçersizleri atlamak) yeni bir ayrıştırma-yorumu tartışması açar.
5. **Her `scope` elemanı beyaz listeye tam olarak uymalı:** `^\.claude\/hooks\/[\w-]+\.cjs$`
   ya da `^\.claude\/settings\.json$` (regex `i` bayrağıyla, harf duyarsız — bu depoda dört kez
   tuzak olan Windows harf duyarsızlığı kuralı). `\w` bayraksız (Unicode değil) olduğu için
   yalnızca ASCII harf/rakam/alt çizgi + tire kabul edilir; bu, ayrı bir Unicode-normalizasyon
   adımına gerek KALMADAN homoglif/aksanlı-karakter saldırılarını (§2.1 saldırı listesi madde
   "unicode normalizasyon") karakter sınıfı düzeyinde eler (bkz. test D-UNI). Eleman ayrıca
   **ters bölü içeremez** (açık kontrol, regex zaten reddeder ama okunabilirlik için ayrı
   kontrol tutuldu). Tam yol, `..`, mutlak yol, UNC, `\\?\` öneki gibi hiçbir varyant literal
   `.claude/hooks/` önekiyle **birebir** başlamadığı için otomatik reddedilir — **elemanlar
   yol olarak `resolve`/`realpath` edilmez**, sabit dizeler olarak karşılaştırılır (brief'in
   açık uyarısı: çözersen tur-4'te kapatılan junction/uzun-yol sınıfını geri açarsın).
6. **`created_at` zorunlu, ISO 8601 dize.** `Date.parse` ile ayrıştırılamazsa → fail-closed.
   `now + 60 sn` toleransından fazla **gelecekte** ise → fail-closed (brief'in "gelecekte" kuralı
   birebir; 60 saniyelik pay yalnızca yazan/okuyan saat farkı yuvarlamasını karşılamak için,
   güvenlik sınırını gevşetmiyor çünkü hâlâ dakikalar mertebesindeki bir manipülasyonu durduruyor).
7. **`valid_minutes` opsiyonel, sayı, > 0, ≤ 120.** Yoksa varsayılan **30**. Sayı değilse, ≤ 0
   ise, ya da **120'yi aşıyorsa** → fail-closed (sınırsız/aşırı uzun pencere yok). **Üst sınır
   120 dakika (2 saat) seçildi:** brief'in dürüst maliyet uyarısı gereği pencere kısa tutulmalı
   ama tek bir developer/QA turu saatlerce sürebiliyor (bu depoda kayıtlı, F-012 dokuz turda
   150-tur sınırına takıldı); 30 dk varsayılan çoğu tek-oturumluk hook bakımı için yeterli, 120 dk
   üst sınırı CEO'nun açıkça daha uzun bir pencere istediği (ör. çok adımlı bakım) durumlar için
   esneklik tanır ama "bir kez onayla, günlerce geçerli" senaryosunu engeller.
8. **Süre dolmuşsa (`now > created_at + valid_minutes`) → fail-closed VE dosya silinir** (§2.2).

### 2.2 Tüketim kuralı — zaman pencereli, kalıcı-yazma-değil

**Karar: token artık tek yazmada tüketilmiyor.** Süresi dolmadığı sürece, kapsamındaki HER
dosyaya **istenildiği kadar** yazılabilir (`.guard-state.json` ve "touched" izleme mantığı
tamamen kaldırıldı — yeni tasarımda gereksiz, çünkü tüketim artık zamana bağlı, yazma sayısına
değil). Bu, bugünkü onay-yorgunluğu kusurunun (bir düzeltmede üç dosya = üç onay) doğrudan
düzeltmesidir.

- **`.guard-state.json` kaldırıldı mı?** Evet — kod hiç yazmıyor/okumuyor. **Sert engel
  korundu** (`docs/approvals/.guard-state.json`'a hiçbir araç doğrudan yazamaz/silemez) —
  saf savunma-derinliği: eski sürümden kalma bir dosya varsa (ya da ileride birisi bu deseni
  geri getirirse) yine korumalı kalsın; maliyeti sıfır, kaldırmanın getirisi yok.
- **Süre dolmuş token ne zaman silinir?** `gate-check.cjs`, hedef `isGuarded` (yani
  `.claude/hooks/**` ya da `.claude/settings.json`) olduğunda GUARD.ok'u **her zaman** okur —
  hedef kapsamda olsun ya da olmasın. Süresi dolduğu bu ilk değerlendirmede fark edilir edilmez
  dosya silinir. Yani **kapsam dışı bir yazma denemesi de** süresi dolmuş bir token'ı temizler
  (brief'in açık sorusunun cevabı: EVET). Bu temizlik **tembeldir** (lazy) — hiçbir arka plan
  süreci yok, yalnızca bir sonraki guarded-yol değerlendirmesinde tetiklenir; tamamen ilgisiz bir
  dosyaya (ör. `src/foo.ts`) yazma GUARD.ok'a hiç bakmaz, süresi dolmuş token orada kalmaya devam
  eder (bu, eski `consume()`'un da zaten tembel olan davranışıyla tutarlı).
- **Dürüst maliyet (brief'in istediği açık beyan):** pencere boyunca token canlıdır — yani TEK
  bir kullanıcı onayı, o pencerede kapsamdaki dosyalara **birden fazla** yazmayı yetkilendirir.
  Bu **bilinçli bir gevşetme**: tehdit modeli yerel/tek-kullanıcı bir araç olduğu için (kullanıcı
  zaten dosya sistemine tam erişimli), riskin büyüklüğü "aynı kullanıcı aynı onaylı dosyaya iki
  kez yazabilir" kadardır — kapsam dışına hiçbir zaman sızma yoktur. Takas, onay yorgunluğunu
  gerçek anlamda azaltmakla bu küçük genişlemeyi kabul etmek arasındadır; CEO/kullanıcı ne zaman
  isterse `valid_minutes`'ı küçülterek (ör. 5) pencereyi daraltabilir.
- **Saat kayması / sistem saati geri alınması:** wall-clock tabanlı süre kontrolü, sistem saati
  geriye alınırsa token'ın efektif ömrünü yapay olarak uzatabilir. Bu **kabul edilen bir sınır**
  (yerel tek-kullanıcı araç; saat oynamasının kullanıcıya zaten sahip olduğu yetkiden (dosya
  sistemine tam erişim) fazlasını kazandırmaması) — `CLAUDE.md`'nin F-011 kapanışındaki "yerel
  tek kullanıcılı araç için orantısız" ilkesiyle aynı sınıf. Monotonik saat kullanılmadı çünkü
  her `gate-check.cjs` çağrısı ayrı bir process'tir (monotonik sayaç process'ler arası hayatta
  kalmaz); bu yüzden wall-clock kaçınılmaz.

### 2.3 Hata mesajları ve README

- Blok mesajları artık üç ayrı durumu ayırt eder: (a) GUARD.ok hiç yok, (b) ayrıştırılamadı
  (sözdizimi/şema hatası — **dosya silinmez**, kullanıcı düzeltip tekrar dener), (c) süresi
  dolmuş (**dosya silinir**), (d) ayrıştı ama hedef kapsamda değil (**ayrıştırılan kapsam
  listelenir**). Her mesajın sonuna beklenen JSON biçimini örnekle anlatan sabit bir yardım
  metni (`GUARD_FORMAT_HELP`) eklendi — kullanıcı/CEO tek denemede doğru yazabilsin diye
  (kayıtlı ders: token deneme-yanılmaya dayanmıyor).
- `docs/approvals/README.md`'ye GUARD.ok bölümü eklendi (bu turda düzenlenen TEK gerçek
  onaylar-dizini dosyası — brief'in açık istisnası): ne işe yarar, tam JSON örneği, alan
  açıklamaları, geçerlilik süresi varsayılanı/üst sınırı, "kapsam dışı yol reddedilir" ve
  "`scope` DIŞINDAKİ hiçbir alan taranmaz" kuralları.

## 3. JSON saldırı vektörleri — karar (brief §2.1 listesi)

| Vektör | Karar | Gerekçe |
|---|---|---|
| Yinelenen `"scope"` anahtarı | `JSON.parse` standart davranışı: **sonuncusu** geçerli olur. Ek kontrol EKLENMEDİ. | Etkili değer hâlâ beyaz listeden geçmek zorunda; "insanın gördüğü ilk `scope`" ile "makinenin okuduğu son `scope`" arasındaki görsel uyumsuzluk bir **okunabilirlik** sorunu, güvenlik açığı değil — hiçbir ek yetki kazandırmıyor. README'de bu davranış açıkça not edildi ki CEO belgeyi tek `scope` alanıyla yazsın. |
| `__proto__` / prototip kirlenmesi | Ek kontrol EKLENMEDİ, test ile doğrulandı. | `JSON.parse`, `__proto__` dahil tüm anahtarları `CreateDataProperty` ile **öz özellik (own property)** olarak yazar (ES2019+, V8'de doğrulandı) — nesnenin prototipini DEĞİŞTİRMEZ. Test D-PROTO bunu canlı ölçüyor: `__proto__` alanına konan sahte bir `scope` kapsamı hiçbir etkilemiyor. |
| `scope` dizi yerine dize | fail-closed | §2.1 madde 4. |
| İç içe nesne/dizi eleman | fail-closed (TÜM kapsam) | §2.1 madde 4 — tip kontrolü `typeof !== 'string'` her iç içe yapıyı da yakalar. |
| `null`/sayı/boolean eleman | fail-closed (TÜM kapsam) | Aynı tip kontrolü. |
| Çok büyük dosya | **8192 bayt üst sınır** (`MAX_GUARD_BYTES`), aşarsa `JSON.parse` denenmeden fail-closed. | Meşru bir GUARD.ok birkaç yüz bayttır (birkaç `scope` elemanı + kısa `reason`); 8 KB, uzun bir gerekçe paragrafı dahil cömert bir pay bırakırken DoS/aşırı bellek okumasını önler. |
| BOM | Baştaki U+FEFF **soyulur**, geri kalan JSON olarak ayrıştırılır (kabul). | Windows Not Defteri gibi editörler UTF-8 dosyalara BOM ekler; bu meşru bir yazım artefaktı — reddetmek aşırı-engelleme olurdu. Test C-BOM negatif kontrolü. |
| CRLF | JSON boşluk-toleranslıdır (jetonlar arası CRLF sorunsuz ayrıştırılır) — ek kod YOK. | `JSON.parse` zaten CR/LF'i jetonlar arasında boşluk sayar. Test C-CRLF negatif kontrolü. |
| `\u0000` (ham bayt, JSON metninde) | Dosya metninde **ham** NUL bayt varsa ayrıştırma öncesi açıkça reddedilir (`indexOf('\u0000')`). `scope` elemanı İÇİNDE **kaçışlı** `\u0000` (yani metnin kendisi `\u0000` altı karakteri, gerçek bayt değil) → normal JSON kaçış dizisi, `JSON.parse` başarıyla bir NUL içeren dizeye çözer, ama bu dize beyaz liste regex'ine UYMADIĞI için (sondaki NUL karakteri `.cjs$` sonrasına eklenir, ya da ortasına girerse `[\w-]` dışı olduğu için) o eleman reddedilir → TÜM kapsam geçersiz. | Çift katman: dosya bütünlüğü (ham bayt) + beyaz liste (kaçışlı biçim). Her iki durumda da sızıntı yok. Test D-NUL-RAW ve D-NUL-ESCAPED. |
| Unicode normalizasyon (görsel homoglif) | Ayrı bir NFC normalizasyon adımı **eklenmedi** — gerek yok. | `[\w-]` bayraksız regex ASCII-dışı HİÇBİR karakteri kabul etmez; Kiril/aksanlı/tam-genişlik bir "cjs" asla eşleşmez. Test D-UNI (Kiril `с` ile `gate-check.cjs` taklidi) bunu canlı doğruluyor. |
| `..`/mutlak yol/UNC/`\\?\` öneki | Otomatik reddedilir (regex tam eşleşme, `resolve` YOK). | §2.1 madde 5. Test D-TRAVERSAL, D-ABS, D-UNC, D-LONGPREFIX. |
| Ters bölü ayracı | Açık `indexOf('\\')` kontrolüyle reddedilir (regex zaten reddederdi, çift katman okunabilirlik için). | §2.1 madde 5. Test D-BACKSLASH. |

## 4. Test planı (`_selftest.cjs`)

Taban: **122 vaka**, hepsi geçiyor (mevcut rapor). Hiçbir davranışsal vaka kaybedilmeyecek:

- `dangerCases` (block-dangerous.cjs), Katman A (`approvalsAskCases`), K-A/K-B kanonikleştirme,
  fail-closed realpath probu, `gateCases`'in K1 temel testleri (GUARD.ok yokken engelli, harf
  varyantı, agents/**-agent-memory/**-src/** serbestliği) **DEĞİŞMEDEN** taşınıyor — bunlar
  scope-ayrıştırma biçiminden bağımsız.
- `writeGuardScope(names)` yardımcı fonksiyonu artık geçerli bir JSON belgesi üretir
  (`{"scope": [...], "created_at": <şimdi>, "valid_minutes": 30}`).
- `writeGuardRaw(content)` artık **ham metni** (JSON ya da kasıtlı bozuk herhangi bir şey)
  olduğu gibi yazar — adı korunuyor, davranışı ("ham içerik yaz") aynı, yalnızca içerik markdown
  yerine JSON/JSON-olmayan dizeler taşıyor.
- **Çevrilen vakalar (markdown'a özgü, artık anlamsız → JSON karşılığına çevrildi, NEDEN
  çevrildiği yorumda belirtilecek):**
  - `y1-a/b/c` (Kapsam/Gerekçe bölümü ayrımı) → **D-FIELD-ISOLATION**: `reason` alanında geçen
    bir ad kapsama girmiyor; `scope` alanındaki ad hâlâ kabul ediliyor. Çeviri nedeni: "bölüm"
    kavramı yok artık, tek alan var.
  - `y1-d` (başlık hiç yok → fail-closed) → **D-NO-SCOPE-FIELD**: `scope` alanı hiç yoksa
    fail-closed.
  - `y1-e` (başlık iki kez → belirsiz, fail-closed) → **D-DUP-KEY**: yinelenen `"scope"`
    anahtarı (§3) — artık "belirsiz" değil, JSON'un kendi kuralıyla çözülüyor (sonuncusu), ayrı
    bir test bunu doğruluyor.
  - `y1-f/g` (başlık harf/boşluk varyantı) → **KALDIRILDI** (anlamsız): JSON'da "başlık" yok,
    alan adı `scope` sabit ve case-sensitive JS property erişimiyle okunuyor (JSON alan adları
    zaten literal eşleşir, "varyant" kavramı yok).
  - `y1-h` (başlık var ama liste yok → fail-closed) → **D-EMPTY-ARRAY**: `scope: []` (boş dizi)
    → fail-closed.
  - `y1t2-a/b/c` (kuyruk düzyazı / h1 / kalın sözde-başlık sonrası ad sızıntısı) →
    **D-REASON-CANNOT-LEAK**: `reason` alanına gömülü, TAM bir eski-biçim `## Kapsam` bloğu +
    başka bir dosya adı → o ad kesinlikle reddedilir (turun bloklayıcı senaryosu, §5).
  - `y1t2-d` (gerçekçi CEO belgesi, "DOKUNULMAYACAK"/"KAPSAMI DIŞINDADIR" notları) →
    **D-REALISTIC-CEO-DOC**: aynı senaryo JSON'da yeniden kurulur (`reason` alanına doğal dilde
    aynı notlar yazılır), `scope` yalnızca tek dosyayı listeler.
  - `y1t2-e` (h3 sonrası ad) → gereksiz (h3 kavramı yok), **KALDIRILDI**.
  - `y1t2-f` (girintili madde kabul) → gereksiz (liste maddesi kavramı yok), **KALDIRILDI**.
  - `y1t2-g` (liste maddeleri arası boş satır şeffaf) → **D-MULTI-WRITE**: iki dosyalık kapsamda
    HER İKİSİNE de ayrı ayrı yazılabiliyor VE token hiçbirinde tükenmiyor (yeni tüketim modelinin
    doğrudan testi, §2.2).
  - `y1t2-h` (madde-biçimli dışlama notu → tüm kapsam geçersiz) → **D-MIXED-TYPE-ARRAY**:
    `scope` dizisinde bir geçerli + bir geçersiz (ör. sayı) eleman → TÜM kapsam geçersiz.
  - `y1t2-i` (tek satırda çoklu ad artık desteklenmiyor) → **KALDIRILDI** (JSON dizisinde zaten
    her eleman ayrı bir dize, "tek satırda çoklu ad" kavramı JSON'da hiç oluşamaz).
  - Sentetik `(c)` (harf varyantı + tüketim) → **D-CASE-VARIANT**: harf varyantıyla eşleşir AMA
    **tüketilmez** (yeni model).
  - Sentetik `(e)` (kapsam dışı, token harcanmaz) → **DEĞİŞMEDEN** taşınıyor (davranış aynı).
  - Sentetik `(f)` (iki dosyalık kapsam, ilk geçer+kalır, ikinci geçer+tükenir) →
    **D-MULTI-WRITE** ile birleştirildi (ikisi de geçer, ikisi de token'ı KALDIRIR — tüketim yok).
  - `gateCases`'teki "GUARD.ok ile gecer VE tuketilir" testleri (block-dangerous.cjs,
    settings.json) → **"GEÇER VE TÜKETİLMEZ"** olarak güncellendi (davranış değişikliği,
    §2.2'nin doğrudan sonucu).

- **Turun zorunlu bloklayıcı senaryosu (§2.2 rapor, "başlık kimliği artık yapısal olarak
  imkânsız"):** `reason` alanına harfiyen tur-3'ün sızdıran belgesi gömülür (`## Kapsam` +
  arşivlenmiş bir dosya adı içeren tam blok), `scope` yalnızca gerçek onaylı dosyayı listeler.
  Beklenen: gömülü addan biri **her zaman** reddedilir (kapsamda değil), `scope`'taki dosya
  kabul edilir. Bu, mekanizmanın **yapısal** garantisidir (ayrıştırıcı `reason`'a hiç bakmıyor),
  tek bir sondaya bağlı bir "kapandı" iddiası değil.

- **Yeni JSON saldırı/uç durum vakaları (§3 tablosu, her satır en az bir test):**
  D-DUP-KEY, D-PROTO, D-SCOPE-NOT-ARRAY, D-NESTED, D-NULL-ELEMENT, D-NUMBER-ELEMENT,
  D-OVERSIZED, C-BOM (kabul), C-CRLF (kabul), D-NUL-RAW, D-NUL-ESCAPED, D-UNI (Kiril homoglif),
  D-TRAVERSAL (`../evil.cjs`), D-ABS (`C:/evil.cjs`), D-UNC (`\\\\server\\share\\x.cjs`),
  D-LONGPREFIX (`\\\\?\\C:\\...`), D-BACKSLASH (`.claude\\hooks\\x.cjs`), D-ROOT-NOT-OBJECT
  (kök dizi/dize/null), D-SYNTAX-ERROR (bozuk JSON).

- **Zaman penceresi vakaları (§2.2, gerçek 30 dk BEKLENMEDEN — `created_at` geçmişe yazılarak
  test edilebilir kılındı, brief'in önerdiği ikinci yöntem):**
  T-FRESH (created_at=şimdi, varsayılan pencere → kabul), T-EXPIRED-DEFAULT (created_at=41 dk
  önce, varsayılan 30 dk → red + **dosya silinir**), T-BOUNDARY-VALID (created_at=29 dk 59 sn
  önce → kabul), T-BOUNDARY-EXPIRED (created_at=30 dk 1 sn önce → red+silinir),
  T-CUSTOM-WINDOW (valid_minutes=90, created_at=60 dk önce → kabul), T-OVER-MAX
  (valid_minutes=121 → fail-closed, created_at şimdi olsa bile), T-NEGATIVE-MINUTES
  (valid_minutes=0 ve -5 → fail-closed), T-NON-NUMERIC-MINUTES (valid_minutes="30" dize →
  fail-closed), T-FUTURE (created_at=şimdi+10 dk → fail-closed), T-CLOCK-SKEW-TOLERATED
  (created_at=şimdi+30 sn → KABUL, 60 sn tolerans içinde), T-NO-CREATED-AT (alan yok →
  fail-closed), T-BAD-CREATED-AT (ayrıştırılamayan dize → fail-closed), T-EXPIRED-OUT-OF-SCOPE
  (süresi dolmuş token + kapsam DIŞI bir hedefe yazma denemesi → yine dosya silinir, brief'in
  açık sorusunun testi), T-REGRESSION-MULTI-WRITE (aynı dosyaya pencere içinde İKİ kez yazma →
  ikisi de kabul, token her ikisinde de KALIR — bugünkü kusurun regresyon testi).

- **Aşırı engelleme negatif kontrolleri (geçerli belge reddedilmemeli):** C-VALID-MINIMAL
  (yalnızca `scope`+`created_at`, `valid_minutes` yok → varsayılan uygulanır, kabul),
  C-VALID-WITH-REASON (uzun, çok satırlı `reason` içeren geçerli belge → kabul),
  C-VALID-TWO-SCOPE (iki elemanlı `scope`, ikisine de yazılabilir).

## 5. Mutasyon kanıtı planı (en az dört, brief zorunlu kılıyor)

1. **Beyaz liste kontrolünü kaldıran mutasyon** (`isWhitelistedScopeEntry` her dizeyi olduğu
   gibi kabul etsin) → D-TRAVERSAL/D-ABS/D-UNC/D-LONGPREFIX/D-BACKSLASH/D-UNI KIRMIZI.
2. **`scope` dışındaki alanları da tarayan mutasyon** (eski kusuru geri getirir — `reason`
   içindeki backtick'li/`.cjs` biten dizeleri de kapsama ekleyen bir "yardımcı" ekle) →
   D-REASON-CANNOT-LEAK ve y1t2-a/b/c karşılığı (D-FIELD-ISOLATION) KIRMIZI.
3. **Zaman penceresi kontrolünü kaldıran mutasyon** (`expiresAt` kontrolünü `if (false)`
   yap) → T-EXPIRED-DEFAULT, T-BOUNDARY-EXPIRED, T-OVER-MAX, T-FUTURE, T-NEGATIVE-MINUTES
   KIRMIZI.
4. **Düzeltmeyi birebir eski hâline döndüren mutasyon** — `parseGuardDoc`'u eski
   `parseGuardScope` (markdown, `## Kapsam` başlık arayan) ile değiştir → JSON-biçimli
   `writeGuardScope` çıktısı artık `## Kapsam` başlığı taşımadığı için NEREDEYSE TÜM
   `gateCases`/D-*/T-* vakaları KIRMIZI (geniş kaskad beklenir, sayı raporda verilecek).

Her mutasyon **elle** geri alınacak (`Edit` ile ters işlem), `git checkout`/`git restore`
KULLANILMAYACAK (kayıtlı ders — mutasyon commit'siz iş üstünde yapılırsa checkout komşu
değişiklikleri de siler; bu turda zaten dosyalar scratchpad'de, gerçek depoya hiç yazılmıyor,
ama disiplin aynı şekilde uygulanacak: sandbox kopyasında mutasyon uygulanıp ölçülüp, sonra
kaynak taslaktan yeniden kopyalanarak "geri alınacak", asla `git` komutuyla değil).

## 6. Kurulum sırası — ZORUNLU

**Önce `_selftest.cjs`, EN SON `gate-check.cjs`.** PreToolUse hook'u diskteki `gate-check.cjs`'i
çalışma anında çalıştırır. `gate-check.cjs` son yazılmazsa, `_selftest.cjs`'in yazılması dahil
iki yazma da **eski (markdown) ayrıştırıcıyla** değerlendirilir — CEO'nun elindeki onay
(muhtemelen zaten markdown biçiminde, çünkü yeni JSON kuralı henüz devrede değil) kabul edilir,
ama `gate-check.cjs` yazıldıktan SONRA aynı GUARD.ok artık JSON beklendiği için geçersiz kalır ve
kurulum ortada kalabilir. Doğru sıra: `_selftest.cjs` önce (bu dosya `.claude/hooks/**`'te
GUARD.ok kapsamına göre korunuyor ama henüz gate-check.cjs eski olduğu için CEO'nun elindeki
mevcut/markdown GUARD.ok ile geçer), SONRA `gate-check.cjs` (bu yazmadan itibaren JSON kuralı
devreye girer — CEO bu ikinci yazma için **yeni bir JSON biçimli GUARD.ok** hazırlamış olmalı).

## 7. Kısıtlara uyum (bu tur, kod yazılmadan önce taahhüt)

- `.claude/hooks/**`'e gerçek yazma **denenmeyecek** (§0a) — nihai dosyalar yalnızca
  scratchpad'e yazılacak, doğrulama repo dışı bir `repo-sim/` ağacında yapılacak (gerçek
  `.claude/hooks/*.cjs` dosyaları yalnızca OKUNUP değiştirilmeden oraya kopyalanacak).
- `docs/approvals/*` gerçek dosyalarına dokunulmayacak; tur başı/sonu SHA-256 (README dahil,
  README için önce/sonra ayrı) raporlanacak.
- `docs/qa/latest.md` yazılmayacak; yalnızca bu yeni dosya (`g5-guard-json-contract.md`)
  yazılıp commit edilecek.
- `docs/progress.md`, `docs/blockers.md` yazılmayacak.
- `src/`, `tests/`, `scripts/`, `package.json`, `CLAUDE.md`, `data/` dokunulmayacak.
- `npm run test` / `npm run e2e` çalıştırılmayacak; yalnızca `node --check` ve sandbox
  self-test koşuları.
- Korunan komut adları Bash komut satırına gömülmeyecek; bu belge ve kod dosyaları `Write`
  aracıyla yazılacak.

## 8. Kabul kriterleri (ölçülebilir)

1. Sandbox'ta `node .claude/hooks/_selftest.cjs` (repo-sim ağacında) **exit 0**, toplam vaka
   sayısı raporlanır (taban 122'den değişebilir, azalmaz-anlamsız-olanlar hariç).
2. Tur-3'ün bloklayıcı senaryosu (D-REASON-CANNOT-LEAK) KIRMIZI vermeden **geçer** (yani ad
   reddedilir) — kanıt çıkış koduyla.
3. T-REGRESSION-MULTI-WRITE geçer (aynı dosyaya iki yazma, token tükenmez).
4. §5'teki dört mutasyonun her biri belirtilen testleri KIRMIZI'ya çevirir, geri alınca YEŞİL.
5. `docs/approvals/README.md` güncel ve tam örnekli (bu tur içinde commit edilir).
6. Gerçek `docs/approvals/*` dosyalarının (README hariç, README için ayrı) SHA-256'ları
   değişmemiş; `git status --short` temiz (yalnızca bu contract dosyası + README + scratchpad
   dışı hiçbir iz yok).

## 9. Kalan risk ve kabul edilen sınırlar

- **Saat kayması (§2.2):** wall-clock tabanlı süre kontrolü sistem saati geriye alınırsa
  atlatılabilir. Kabul edilen sınır — yerel tek-kullanıcı araç, ek yetki kazandırmıyor.
- **Zaman penceresi takası (§2.2):** tek onay, pencere boyunca kapsamdaki dosyalara **birden
  fazla** yazmayı yetkilendiriyor. Bilinçli takas — onay yorgunluğunu azaltmak için kabul edildi.
- **`.guard-state.json`'un sert engeli artık ölü kod gibi görünebilir** (hiçbir yol onu
  yazmıyor) ama savunma-derinliği için korunuyor; gelecekte biri bu dosyayı gerçekten
  kullanılmayan bir kalıntı sayıp kaldırabilir — o zaman bu karar metni referans alınmalı.
  Yeniden ele alınma eşiği: `.claude/hooks/**` üzerinde çalışan bir sonraki güvenlik turu.
- **Yinelenen `"scope"` anahtarı görsel kafa karışıklığı yaratabilir** (§3) — güvenlik açığı
  değil ama README'de açıkça uyarılmazsa bir CEO'yu şaşırtabilir. README'ye eklendi.
- **`.claude/settings.json` dışında ".claude/" altında `.claude/agents/**`/`.claude/agent-memory/**`
  hâlâ serbest** (bu turun kapsamı dışı, mevcut tasarım korunuyor, değiştirilmedi).
