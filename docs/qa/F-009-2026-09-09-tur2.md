KARAR: KALDI
ESKALE: false

---
feature: F-009
title: Spike — transkript format doğrulama + dayanıklı okuyucu + fixture'lar
reviewer: qa-evaluator
date: 2026-09-09
round: 2 (dar kapsamlı düzeltme turu)
---

# F-009 QA tur 2 — düzeltme turu denetimi

Kapsam: 1. turun bulguları (U1-U7) + brief'in üç ek kontrolü. 1. turda GEÇTİ verilen alanlar
(fixture anonimliği, `bom-crlf`'in CRLF'liği, 13/13 yol kaçışı reddi, okuyucunun 10 düşmanca
girdide fırlatmaması, format/`usage` iddiaları) yeniden ölçülmedi.

Düzeltme commit'leri: `68aa13d` (U1/U2), `aec57ab` (U3/U4/U7), `97b9e15` (U5/U6), `188d6cb`.

## Özet

Düzeltmelerin büyük kısmı gerçek: **1. turun 12 sondasının 12'si de artık KIRMIZI**, U2 mutasyonu
kırmızı ve maskesiz, U4 iki katmanda birden çitli, U5'in sayıları örneklenerek doğrulandı,
U6 script'i gerçekten koşuyor. Ama üç şey tutmadı:

1. Gizlilik çiti **yeniden yenildi** — 12 yeni vektörün 11'i geçti. Kök neden yapısal: serbest
   metin taraması yalnızca **çift tırnak içindeki** ve **boşluk içeren** dizgelere uygulanıyor.
2. Çitin **en yük taşıyan yeni katmanı** (onaylı-sözcük beyaz listesi) hiç çitli değil: tarayıcıdan
   tamamen çıkarıldığında **1124 testin tamamı yeşil** kaldı.
3. U3'ün kaynak-şekli çiti hem **yanlış negatif** hem **yanlış pozitif** veriyor, ve konulma
   gerekçesi ("davranışla ayırt edilemez") iki ayrı ölçümle **çürütüldü**.

---

## Y1 — BLOKLAYICI: gizlilik çiti yeni vektörlerle yeniden yenildi (11/12 geçti)

**Kabul kriteri:** AC "Fixture'lar anonimleştirilir … yapısal çit:
`tests/features/thread/transcripts-privacy-guard.test.ts`" · sözleşme T1.

**Tekrar üretme:** sondaları `tests/fixtures/transcripts/` altına yaz →
`npx vitest run tests/features/thread/transcripts-privacy-guard.test.ts --reporter=verbose` →
dosyanın kendi "hiçbir gizlilik ihlali içermiyor" satırına bak (✓ = sızdı, × = yakalandı).

### Önce iyi haber — 1. turun 12 sondası (P1-P12) artık **12/12 KIRMIZI**

`__qa_p1_shortpersonal` · `p2_bashpath` · `p3_envvar` · `p4_unc` · `p5_fwdslash` · `p6_base64` ·
`p7_badline` · `p8_key` · `p9_split` · `p10_unlistedproject` · `p11_leak.json` ·
`__qa_sub/leak.jsonl` → hepsi FAIL (= yakalandı). Özyinelemeli + uzantısız tarama, ham metin
taraması, genişletilmiş yol desenleri ve disk-türetilmiş liste **çalışıyor**.

### Kötü haber — yeni vektörler

| # | Sonda | İçerik sınıfı | Sonuç |
|---|---|---|---|
| N1 | `C%3A%5CUsers%5Cpc%5Cgizli%5Cbanka-sifreleri.txt` | URL-kodlanmış Windows yolu | **GEÇTİ** |
| N2 | `//?/D:/ozel/veron/saglik/rapor.pdf` | uzun-yol öneki, `Users` içermeyen mutlak yol | **GEÇTİ** |
| N3 | `veron.seldon@gmail.com` | **e-posta** | **GEÇTİ** |
| N3b | `+90-532-111-22-33` | **telefon** | **GEÇTİ** |
| N4 | onaylı sözcükler + `kart 4242 4242…` | rakam + onaysız kelime | yakalandı (× ) |
| N4b | `ornek istem 05321112233 anonim kullanici 4242 4242 4242 4242 yanit metni` | **yalnızca onaylı sözcükler + gömülü rakamlar** | **GEÇTİ** |
| N5 | `gercek\nkullanici\nadi\nsoyadi\nev\nadresi\nkadikoy…` | satır sonu kaçışlarıyla ayrılmış gerçek metin | **GEÇTİ** |
| N6 | `trepx-xhyynavpv-nqv-fblnqv-ir-onaxn-fvsrfv` | ROT13/boşluksuz şifreleme | **GEÇTİ** |
| N7 | `__qa_n7_plaintext.md` — düz metin, tırnaksız, 3 satır kişisel veri | **tırnaksız dosya** | **GEÇTİ** |
| N8 | `{"a":"\"","leak":"gercek kullanici adi soyadi telefonu ve ev adresi burada"}` | **tek kaçışlı tırnak → hizalama kayması** | **GEÇTİ** |
| N9 | `Şükrü_Yılmaz_Kadıköy_İstanbul_doğum_1987` | Türkçe karakterli, boşluksuz kimlik | **GEÇTİ** |
| N11 | `"_note":"gizli-musteri-listesi-ve-fiyatlandirma-2026"` | şema dışı alana gömülü metin | **GEÇTİ** |
| N12 | `.__qa_n12_hidden` — gizli dosya, tırnaksız | gizli dosya | **GEÇTİ** |
| N13 | gerçek satır şekli, **çift** kaçışlı tırnak | kontrol | yakalandı (×) |
| N14 | gerçek satır şekli, kaçışsız | kontrol | yakalandı (×) |

**Üç yapısal kök neden (dosya:satır):**

1. `transcripts-privacy-guard.test.ts:254` — `if (value.includes(' ') && !hasOnlyApprovedWords(value))`.
   Beyaz liste **yalnızca boşluk içeren** dizgeye uygulanıyor. Boşluksuz her dizge (e-posta,
   telefon, `\n` kaçışlarıyla ayrılmış kelimeler, `snake_case`, tireli/noktalı metin, ROT13)
   serbest kanal: 200 karakter altındaysa ve opak-blok sınıfını (`[A-Za-z0-9+/_=]{40,}`) tek bir
   `-` / `.` / `@` ile kırıyorsa hiçbir desene takılmaz.
2. `transcripts-privacy-guard.test.ts:198-213` (`naiveQuotedSegments` + kullanımı) — serbest metin
   kontrollerinin **tamamı** yalnızca çift tırnak arasındaki parçalara uygulanıyor. Tarama artık
   uzantıdan bağımsız olduğu için dizine giren **her tırnaksız dosya** (`.md`, `.txt`, `.gitignore`,
   nokta ile başlayan dosyalar) yalnızca yol/TC/proje-adı regex'lerinden geçiyor; uzunluk, opak
   blok ve beyaz liste katmanlarının **hiçbiri** çalışmıyor (N7, N12). Uzantı süzgecinin
   kaldırılması bu dosyaları taramaya **soktu**, ama taramanın asıl gövdesi onlara uygulanmıyor —
   sonuç yanlış güven.
3. `transcripts-privacy-guard.test.ts:191-196` — "naif split"in tek/çift indeks hizalaması
   **kaçışlı tırnakla kayıyor**. Testin kendi yorumu bunu kabul ediyor ("bu turda fixture'ların
   hiçbirinde kaçışlı tırnak yok") ama bu, kabul edilebilir bir varsayım değil: sızıntının **asıl
   yolu** gerçek bir transkript satırını yapıştırmaktır ve gerçek satırlar kaçışlı tırnak doludur.
   Ölçüm (`~/.claude/projects/C--dev-apps-mission-control`, 220 dosya, 51 933 satır, yalnızca
   sayım): **15 042 satırda en az bir `\"`**, **282 satırda TEK sayıda `\"`**. Tek sayılı olan her
   satırda ilk kaçıştan sonraki **tüm** içerik çift indekse düşer ve hiç taranmaz (N8 birebir bunu
   gösteriyor); çift sayılı satırlarda ise kaçışlı tırnak **çiftleri arasındaki** metin taranmaz.

**Neden bloklayıcı:** aynı taramada **638 satır e-posta biçimli dizge** içeriyor (gerçek
transkriptlerde kullanıcı e-postası rutin olarak geçiyor). Yani "bir fixture'a yanlışlıkla gerçek
içerik girdi" senaryosunun en olası somut biçimlerinden biri — e-posta/telefon — çitten **sessizce**
geçiyor. AC'nin "elle dikkat ettim yetmez" gerekçesi hâlâ karşılanmıyor. Bugün depoda sızan veri
**yok** (5 fixture + `.gitattributes` temiz), bloklayıcılık gelecekteki fixture'lar için.

**Ucuz düzeltme önerisi:** (a) beyaz liste kontrolünden `value.includes(' ')` koşulunu kaldır —
her dizgeyi kelimelere ayır, onaysız kelime VEYA `[0-9]{6,}` VEYA `@` görünce tetikle;
(b) serbest metin kontrollerini tırnak parçalarına ek olarak **ham satırın tamamına** da uygula
(tırnaksız dosyalar ve hizalama kayması aynı anda kapanır); (c) e-posta/telefon için iki desen ekle.
Not: (b) uygulanınca mevcut 5 fixture'ın ham satırları da taranır — eşiklerin yeniden kalibre
edilmesi gerekir (bu turda ölçülen satır-başı toplam en yüksek değer 413 karakter).

---

## Y2 — BLOKLAYICI: beyaz liste katmanı hiç çitli değil (mutasyon 1124/1124 YEŞİL)

**Mutasyon:** `transcripts-privacy-guard.test.ts:254` →
`if (false && value.includes(' ') && !hasOnlyApprovedWords(value)) {`
(çitin **tek** kısa-kişisel-metin savunması devre dışı).

**Beklenen:** en az bir test KIRMIZI.
**Gerçek:** `npx vitest run` (tüm depo) → **`Tests 1124 passed | 4 skipped`**.

Neden kaçıyor: P1 sondası kişisel metnin yanında **TC-kimlik biçimli sayı** taşıyor, bu yüzden TC
deseni tarafından yakalanıyor; beyaz liste devre dışı olsa da test yeşil kalıyor. T1d
(`:342-347`) `hasOnlyApprovedWords`'ü **doğrudan** çağırıyor — yardımcının kendisini kanıtlıyor
ama tarayıcının onu **kullandığını** kanıtlamıyor. Bu, 1. turun U7/B6 bulgusunun (kendi kendine
referans veren test) bir kademe yukarı taşınmış hâli: fonksiyon gerçek, bağlantı çitsiz.
`CLAUDE.md`: "savunma derinliğini katman başına bir mutasyonla sına".

**Düzeltme:** beyaz listeyi tetikleyen, başka **hiçbir** desene takılmayan bir sonda ekle
(ör. `'gercek kullanici adi soyadi ve ev adresi burada yaziyor'` — TC yok, yol yok, < 200 karakter,
opak blok yok) ve `scanFixtureForPrivacyViolations` üzerinden koştur.

---

## Y3 — BLOKLAYICI (U3 kararım: **kabul edilemez sapma**)

Developer M10/M11 için davranış çiti yerine kaynak-şekli çiti koydu
(`transcript-reader.test.ts:536-559`), gerekçe: *"L2/L3 sağlamken bu iki katman matematiksel
olarak L4 ile örtüşür … hiçbir black-box senaryo TEK BAŞINA bu ikisini davranışla ayırt edemez"*.

### (a) Gerekçe yanlış — iki katman da davranışla ayırt edilebiliyor

Ölçüm: gerçek `resolveAllowedTranscriptPath`, geçici hermetik kök, `tsx` ile doğrudan çağrı.

| Senaryo | Temiz kod | M10 uygulanmış | M11 uygulanmış |
|---|---|---|---|
| S1 — kök **dışında**, **var olmayan** dosya | `outside-root` | **`not-found`** | `outside-root` |
| S2 — kök dışında, var olan dosya | `outside-root` | `outside-root` | `outside-root` |
| S3 — kökün kendisi **junction** üzerinden veriliyor | `outside-root` | `outside-root` | **`ok:true`** |
| S4 — izinli proje içinde junction → kök dışı (1. turun kaçışı) | `symlink` | `symlink` | `symlink` |
| S5 — proje dizininin kendisi junction | `symlink` | `symlink` | `symlink` |

S1 ve S3, M6/M6b için **zaten kullanılan** yöntemin (kesin `reason` iddiası) birer satırlık
uygulamasıdır. Yani davranış çiti mümkündü; kaynak-şekli çitine gerek yoktu. Ayrıca M10
kaldırıldığında guard, kökün **dışındaki** yollarda `existsSync`/`lstatSync` çağırmaya başlıyor —
gözlemlenebilir bir yan etki.

### (b) Kaynak-şekli çiti hem yanlış negatif hem yanlış pozitif veriyor

| Mutasyon | Koruma | Kaynak-şekli çiti |
|---|---|---|
| M10-**yorum satırı** (`if` bloğunun 3 satırı `// M10 ` ile yorumlandı, metin yerinde) | **KALKTI** (S1 → `not-found`) | **YEŞİL — 51/51** ✗ |
| M10-**silme** (aynı 3 satır silindi) | kalktı | KIRMIZI ✓ |
| M11-**doğrudan** (`resolved` → `candidatePath`) | kalktı | KIRMIZI ✓ |
| M11-**tuzak satırlı** (`relFromRootCanonical` adıyla eski satır korunur, kontrol `candidatePath` ile yapılır) | **KALKTI** (S3 → `ok:true`) | **YEŞİL — 51/51** ✗ |
| Eşdeğer yeniden yazım (`relFromRootRaw` → `rawRelativeFromRoot`, davranış aynı) | **yerinde** | **KIRMIZI** ✗ (yanlış pozitif) |

Yani çit, QA'nın 1. turda kullandığı **yorum satırına alma** mutasyon biçimini hiç görmüyor;
buna karşılık zararsız bir yeniden adlandırmayı bloklayıcı sanıyor. Bir güvenlik çitinin en kötü
kombinasyonu budur: koruduğunu sandığın şeyi korumaz, korumadığı şey için gürültü üretir.
`write-gate-manifest.test.ts` emsali burada geçerli değil — orada denetlenen şey **derleme/paket
çıktısı**dır, davranışla erişilemeyen bir yüzeydir; burada davranış yolu açıktı ve ölçüldü.

### (c) 1. turun M6+M11 birleşik kaçışı — **kapalı** ✓

Kendi repro'mu tekrarladım (S4): izin verilen proje dizini içine junction, kök dışı gerçek dosya →
temiz kodda **`{"ok":false,"reason":"symlink"}`**. M6 ve M6b mutasyonları artık **tek başlarına**
KIRMIZI veriyor (1. turda ikisi de 69/69 yeşildi). Bu kısım gerçekten düzeldi.

**Kararım:** M6/M6b düzeltmesi kabul; M10/M11'in kaynak-şekli çiti **kabul edilemez** — davranış
çiti mümkün olduğu ölçüldüğü için ve mevcut çit en olası mutasyon biçimini kaçırdığı için.

---

## U2 — DOĞRULANDI ✓ (eşik mutasyonu artık KIRMIZI ve maskesiz)

**Mutasyon:** `MAX_FREE_TEXT_CHARS = 200` → `100000`.
**Sonuç:** `Tests 1 failed | 22 passed` — **KIRMIZI** ✓ (1. turda 69/69 yeşildi).

Sondanın doğru deseni tetiklediğini ayrıca kanıtladım (brief'in istediği kontrol): geçici bir test
dosyasından **gerçek** `scanFixtureForPrivacyViolations` çağrıldı, 245 karakterlik onaylı-sözcük
metniyle:

- temiz kod → `["200 karakterden uzun serbest metin bulundu (245 karakter) — gerçek prompt kopyası şüphesi"]`
  — **tek** ihlal, yalnızca uzunluk deseni. Opak-blok maskelemesi (1. turun B3'ü) gitmiş.
- mutasyonlu kod → `VIOLATIONS []` — koruma gerçekten kalkıyor, yani test gerçek bir şey ölçüyor.

Tek not (bloklayıcı değil): mutasyonda ilk kırılan satır testin **ön koşulu**
(`expect(longApprovedText.length).toBeGreaterThan(MAX_FREE_TEXT_CHARS)`, `:324`), davranış
iddiası değil. Davranış iddiası da kırmızı olurdu (yukarıdaki `[]` ölçümü), ama eşik büyütülürse
bakımcı testin ön koşulunu "düzeltip" sondayı uzatma yoluna sapabilir. Geçici test dosyası silindi.

## U4 — DOĞRULANDI ✓ (iki katmanda birden çitli)

`transcript-reader.ts:200` `degraded: linesBad > 0 || dataLostNoLineBoundary`. Testi
(`transcript-reader.test.ts:174-192`) benim 1. turdaki repro'mun birebir aynısı (bir geçerli satır
+ 4096 baytlık newline'sız kuyruk, `maxBytesBeforeTail:100, tailBytes:64`) ve `lines_ok:0`,
`lines_bad:0`, `file_read_failed:false`, `degraded:true` dördünü birden iddia ediyor.

| Mutasyon | Sonuç |
|---|---|
| M-B: `degraded: linesBad > 0` (bayrak `degraded`'dan çıkarıldı) | **1 failed** ✓ KIRMIZI |
| M-B2: `readRelevantText`'te `dataLostNoLineBoundary: true` → `false` (düzeltmeyi kaynağında geri sarar) | **1 failed** ✓ KIRMIZI |

İki farklı katmanda da kırmızı → düzeltme komşu bir yolu değil, kendisini koruyor.

## U5 — DOĞRULANDI ✓ (sayılar örneklenerek değil, tam taramayla)

Wiki iddiası (2026-09-09, düzeltme turu): 219 dosya / 47.396 `version` satırı; `2.1.260` 45.494,
`2.1.261` 1.894, `2.1.205` 8.

Bağımsız ölçümüm (aynı gün, ~1 saat sonra, `~/.claude/projects/C--dev-apps-mission-control`,
yalnızca sayım — hiçbir içerik kopyalanmadı):

| `version` | benim satır sayım | wiki | fark |
|---|---:|---:|---|
| `2.1.260` | 45 887 | 45 494 | +393 (bu oturum yazmaya devam ediyor) |
| `2.1.261` | 1 894 | 1 894 | **0** |
| `2.1.205` | 8 | 8 | **0** |
| toplam | 47 789 | 47 396 | +393 |
| dosya | 220 | 219 | +1 (bu QA oturumunun kendi transkripti) |

Değer **kümesi** birebir aynı (üç değer, başka yok); fark yalnızca canlı oturumun büyümesi. Kanıt
etiketleri dürüst: `✓ DOĞRULANDI` yalnızca gerçekten sayılan şeylere konmuş, `2.1.205 = CLI
sürümü` gözlemi doğru, önceki turun yanlış ⊢ ÇIKARIM'ı açıkça çürütülmüş ve yerine "her satır
kendi sürecinin sürümünü yazar" çıkarımı ⊢ ile işaretlenmiş. Kontrol amaçlı tüm ağacı da taradım
(414 dosya, 5 farklı `version` değeri) — sayfa kapsamını **bu projenin dizini** olarak açıkça
sınırladığı için bu bir çelişki değil.

**DÜŞÜK not:** sayfa aynı bölümde bir yerde "219 dosya", iki satır altında "217 gerçek `.jsonl`
dosyası ✓ DOĞRULANDI" diyor (ikincisi dev turunun eski tip taramasından kalma). Gerçek sayı
ölçüm anına göre 219/220. Sayının yanına tarih/kapsam notu düşülmeli.

## U6 — DOĞRULANDI ✓ (script gerçekten koşuyor, çıktı eşleşiyor)

Sayfadaki Python bloğunu **birebir kopyalayıp** kendim koşturdum (tek eklemem dosya/bozuk satır
sayacı):

```
files 220 bad 0
assistant 21214 · attachment 13753 · user 12476 · queue-operation 1080 · agent-setting 652 ·
last-prompt 638 · atis-latch 636 · bridge-session 451 · system 365 · custom-title 346 ·
mode 337 · permission-mode 2 · file-history-snapshot 2
```

Sayfadaki çıktı (`assistant 21123`, `attachment 13701`, … `file-history-snapshot 2`) ile **tip
kümesi birebir aynı** (13 tip), sayılar oturum büyüdüğü için birkaç yüz fazla. `if False` ölü dalı
gitmiş; blok kopyala-yapıştır çalışıyor. **0 bozuk satır** iddiası da doğrulandı.

## U7 — BÜYÜK ÖLÇÜDE DOĞRULANDI (3/4), biri kâğıt üzerinde kaldı

| 1. turdaki test | Şimdi | Değerlendirme |
|---|---|---|
| `transcript-reader.test.ts:343` "T4 `alwaysAllowed`" | **kaldırıldı** (gerekçeli yorum bırakılmış) | ✓ |
| `transcript-reader.test.ts:411` "T5 `not.toBe(false)`" | **kaldırıldı** | ✓ |
| `transcript-reader.test.ts:212` (T3) | duruyor ama **gerçek** `findAllowedTranscriptDirectories`'i çağırıp `toHaveLength(1)` iddia ediyor; M4 mutasyonu 1. turda KIRMIZI vermişti | ✓ |
| `transcripts-privacy-guard.test.ts:159` (T1d, boş `RegExp[]`) | gerçek `hasOnlyApprovedWords` çağrısına çevrildi | **kısmen** — yardımcıyı kanıtlıyor, tarayıcıya bağlandığını kanıtlamıyor (bkz. **Y2**) |

---

## Mutasyon tablosu (10 bağımsız mutasyon, hepsi birebir geri alındı)

| # | Mutasyon | Hedef | Beklenen | Sonuç |
|---|---|---|---|---|
| M-A | `MAX_FREE_TEXT_CHARS` 200 → 100000 | privacy-guard:181 | KIRMIZI | **1 failed** ✓ (U2 kapandı) |
| M-B | `degraded`'dan `dataLostNoLineBoundary` çıkarıldı | reader:200 | KIRMIZI | **1 failed** ✓ |
| M-B2 | `readRelevantText` bayrağı `false` sabitlendi | reader:115 | KIRMIZI | **1 failed** ✓ |
| M-C | ata dizin symlink kontrolü silindi (M6) | reader:288 | KIRMIZI | **1 failed** ✓ (1. turda yeşildi) |
| M-D | hedef dosya symlink kontrolü silindi (M6b) | reader:292 | KIRMIZI | **1 failed** ✓ (1. turda yeşildi) |
| M-E | M10 **yorum satırına alındı** (metin yerinde) | reader:278-280 | KIRMIZI | **51 passed** ✗ **Y3** |
| M-F | M10 **silindi** | reader:278-280 | KIRMIZI | **1 failed** ✓ |
| M-G | M11 tuzak satırla atlandı (şekil çiti memnun) | reader:295 | KIRMIZI | **51 passed** ✗ **Y3** |
| M-H | eşdeğer yeniden adlandırma (davranış aynı) | reader (tüm dosya) | YEŞİL | **1 failed** ✗ **Y3** (yanlış pozitif) |
| M-I | beyaz liste katmanı devre dışı (`false &&`) | privacy-guard:254 | KIRMIZI | **1124 passed** ✗ **Y2** |

Her yeşil mutasyonda önce sonda sorgulandı (U2'de sondanın kendisi ölçüldü — koruma gerçekten
kalkıyordu, sonda doğruydu). `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` →
yalnızca meşru test adları (`write-gate-manifest.test.ts:124` dahil, dokunulmadı;
`transcript-reader.test.ts` ve `transcripts-privacy-guard.test.ts` içindeki "MUTASYON hedefi"
test adları). `git status` temiz (yalnızca bu turdan önce de var olan `developer` hafıza dosyaları).

## Test / koşu sayıları

| Koşu | Sonuç |
|---|---|
| `npx vitest run tests/features/thread/` (temiz) | **51 passed (2 dosya)** |
| `npx vitest run` (temiz) | 1116 passed, 4 skipped — **2 worker-fork hatası** (bilinen sınıf, CLAUDE.md) |
| `npm run verify` (1. deneme) | tsc + eslint + test + build çalıştı, kırmızı yok |
| `npm run verify` (2. deneme, elle) | **YEŞİL** — tsc + eslint + **1131 passed, 4 skipped (76 dosya)** + vite build |
| `python3` tip taraması (U6) | 220 dosya, **0 bozuk satır**, 13 tip |

**Yetim süreç: 0.** `npm run dev` hiç kullanılmadı; `npm start` bu turda gerekmedi (bulguların
hiçbiri HTTP yolunda değil). Playwright kullanılmadı — bu feature'ın arayüzü yok, teslimatı
kütüphane + wiki sayfası. `C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı. Yazdığım 16 sonda
dosyası + 1 geçici test dosyası + 6 geçici junction dizini silindi; `git status` temiz.

## Puanlama

| Boyut | Puan | Gerekçe |
|---|---:|---|
| İşlevsellik | **8** | Okuyucu ve yol çiti hâlâ kusursuz: 1. turun M6+M11 birleşik kaçışı kapandı (S4 → `symlink`), beş senaryonun beşi doğru sonuç veriyor, U4'ün sessiz veri kaybı artık dürüstçe raporlanıyor. |
| Özellik bütünlüğü | **5** | AC "fixture'lar anonimleştirilir (yapısal çit)": 12 eski sonda kapandı ama 11 yeni vektör geçiyor — e-posta/telefon gibi gerçek transkriptlerde **638 satırda** ölçülen sınıflar dahil (Y1). |
| Görsel/UX (wiki sayfası) | **8** | Sürüm iddiası düzeltildi ve bağımsız taramamla eşleşti, yanlış çıkarım dürüstçe çürütüldü, kontrol listesi script'i gerçekten koşuyor. Tek nokta: aynı bölümde 219/217 tutarsızlığı. |
| Kod kalitesi (test/hata yönetimi) | **5** | Dört katmanın ikisi (M6/M6b) artık gerçekten çitli ✓; ama çitin en yeni katmanı hiç ölçülmüyor (Y2, 1124/1124 yeşil) ve M10/M11'in kaynak-şekli çiti en olası mutasyon biçimini kaçırıp zararsız yeniden yazımı bloklıyor (Y3). |

İki boyut 7'nin altında → **KARAR: KALDI** (ikinci tur, `ESKALE: false`).

## Düzeltme turu için asgari liste

1. **Y1-a** — beyaz liste kontrolünden `value.includes(' ')` koşulunu kaldır; kelime ayrıştırmasına
   rakam dizisi (`[0-9]{6,}`), `@` ve telefon biçimlerini ekle. Sonda: N3, N3b, N4b, N6, N9.
2. **Y1-b** — serbest metin kontrollerini (uzunluk, opak blok, beyaz liste) tırnak parçalarına ek
   olarak **ham satırın kendisine** de uygula; böylece tırnaksız dosyalar (N7, N12) ve kaçışlı
   tırnak hizalama kayması (N8) aynı anda kapanır. Eşikleri mevcut 5 fixture'a göre yeniden
   kalibre et (ölçülen en yüksek satır-başı toplam: 413 karakter).
3. **Y2** — beyaz listeyi **tek başına** tetikleyen bir sonda ekle (TC/yol/uzunluk desenlerine
   takılmayan kişisel cümle) ve `M-I` mutasyonunu koşturup KIRMIZI gördüğünü rapora yaz.
4. **Y3** — M10 ve M11 için kaynak-şekli çitini davranış çitiyle **değiştir**: S1 (kök dışı +
   var olmayan dosya → `reason` KESİNLİKLE `outside-root`) ve S3 (kök junction üzerinden verildi →
   `ok:false`). İkisi de M6/M6b testlerinin birebir aynı desenidir. Kaynak-şekli testleri
   kaldırılabilir (yanlış pozitif üretiyorlar); tutulacaksa yorumdaki "davranışla ayırt edilemez"
   gerekçesi düzeltilmeli.
5. **DÜŞÜK** — wiki'de 219/217 dosya sayısı tutarsızlığına kapsam/tarih notu düş.
