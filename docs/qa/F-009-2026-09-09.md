KARAR: KALDI
ESKALE: false

---
feature: F-009
title: Spike — transkript format doğrulama + dayanıklı okuyucu + fixture'lar
reviewer: qa-evaluator
date: 2026-09-09
round: 1 (kod turu QA)
---

# F-009 QA raporu — transkript spike

Kaynaklar: `docs/features/F-009-transkript-spike.md` (7 AC), `docs/qa/F-009-contract.md` (T1-T6),
`docs/wiki/pages/desen/claude-transcript-formati.md`, `docs/02-architecture.md` §9, ADR-007,
`CLAUDE.md` "Öğrenilen kurallar".

## Özet

Okuyucunun kendisi (asla-fırlatmama + en küçük yetki yol çiti) **sağlam**: 8 düşmanca girdi,
izin reddi (ACL), dizin, derin JSON, 12 MB tek satır ve 13 yol kaçış denemesi altında tek bir
istisna yok, tek bir kaçış yok. `bom-crlf` fixture'ı **gerçekten** CRLF+BOM taşıyor (diskte,
git blob'unda ve temiz klonda).

Ama bu feature'ın **asıl riski sızıntı**, ve o riski taşıyan tek yapısal savunma —
`transcripts-privacy-guard.test.ts` — **yenildi**: yazdığım 12 sızdıran fixture'ın **12'si de**
çitten yeşil geçti. Ayrıca wiki sayfasının `✓ DOĞRULANDI` işaretli sürüm iddiası **yanlış**;
sayfanın tek işi olan "bir sonraki güncellemede yeniden doğrula" temeli hatalı bir taban değere
dayanıyor.

---

## B1 — BLOKLAYICI: gizlilik çiti yenildi (12/12 sızdıran fixture yeşil geçti)

**Kabul kriteri:** F-009 AC "Fixture'lar anonimleştirilir … yapısal çit:
`tests/features/thread/transcripts-privacy-guard.test.ts`" · sözleşme T1.

**Tekrar üretme:**
1. `tests/fixtures/transcripts/` altına aşağıdaki 10 sonda dosyasını yaz (hepsi sentetik ama
   "gerçek sızıntı" biçiminde).
2. `npx vitest run tests/features/thread/transcripts-privacy-guard.test.ts`

**Beklenen:** çit her birini yakalar, KIRMIZI.
**Gerçek:** `Tests 20 passed (20)` — 10 sondanın **10'u da** ayrı ayrı "hiçbir gizlilik ihlali
içermiyor" diye yeşil raporlandı (verbose çıktıda `__qa_p1…p10.jsonl … ✓`).

| # | Sonda | İçerik sınıfı | Sonuç |
|---|---|---|---|
| P1 | `__qa_p1_shortpersonal` | 96 karakterlik tamamen kişisel Türkçe prompt (TC kimlik + maaş + boşanma) | **GEÇTİ** |
| P2 | `__qa_p2_bashpath` | `/c/Users/pc/Documents/vergi-beyani-2025.pdf` (Git Bash biçimi) | **GEÇTİ** |
| P3 | `__qa_p3_envvar` | `%USERPROFILE%\Desktop\ozel-notlar\banka.txt` | **GEÇTİ** |
| P4 | `__qa_p4_unc` | `\\FILESRV01\pc-yedek\saglik-raporu.docx` (UNC) | **GEÇTİ** |
| P5 | `__qa_p5_fwdslash` | `C:/Users/pc/Desktop/gizli` (ileri bölü) | **GEÇTİ** |
| P6 | `__qa_p6_base64` | base64 gömülü parola/IBAN (52 karakter, 80 eşiğinin altında) | **GEÇTİ** |
| P7 | `__qa_p7_badline` | **ayrıştırılamayan** son satırda 3000 karakterlik "gerçek konuşma kopyası" | **GEÇTİ** |
| P8 | `__qa_p8_key` | uzun metin JSON **anahtarı** olarak (değer değil) | **GEÇTİ** |
| P9 | `__qa_p9_split` | uzun prompt 20 parçaya bölünmüş (her parça < 200 karakter) | **GEÇTİ** |
| P10 | `__qa_p10_unlistedproject` | listede olmayan gerçek proje adları (`sandbox`, `workdir`, `sdk`) | **GEÇTİ** |

Ek iki kaçış (ayrı koşu, aynı sonuç):

| # | Sonda | Sonuç |
|---|---|---|
| P11 | `__qa_leak.json` — `C:\Users\pc\gizli` + 500 karakter, uzantı `.json` | **TARANMADI** (10 passed, dosya sayıya bile girmedi) |
| P12 | `__qa_sub/leak.jsonl` — aynı içerik, **alt dizinde** | **TARANMADI** |

**Kök nedenler (dosya:satır):**
- `transcripts-privacy-guard.test.ts:59` — `listFixtureFiles` yalnızca **üst seviye** ve yalnızca
  `.jsonl`. `readdirSync` kullanmak tek başına "yapısal çit" yapmıyor: `.json`/`.txt`/`.md` ve
  alt dizinler kapsam dışı (P11/P12).
- `transcripts-privacy-guard.test.ts:83` — `JSON.parse` başarısız olursa satır `continue` ile
  **atlanıyor**. Secret / uzun-opak / 200-karakter kontrollerinin **tamamı** yalnızca ayrıştırılmış
  JSON üzerinde çalışıyor. Yani fixture setinin **tanım gereği bozuk satır içeren** üyesi
  (`truncated-last-line.jsonl`) sınıfı, gerçek prompt taşımak için serbest bir kanal (P7).
  Bu, `CLAUDE.md`'deki "testin yorumu ile taradığı şey çelişebiliyor" dersinin birebir tekrarı.
- `transcripts-privacy-guard.test.ts:28` — `WINDOWS_USER_PATH_PATTERN = /[A-Za-z]:\\+Users\\+/i`
  yalnızca ters bölülü Windows biçimini görüyor; POSIX (`/c/Users/…`), ileri bölü (`C:/Users/…`),
  ortam değişkeni (`%USERPROFILE%`) ve UNC biçimleri kapsam dışı (P2/P3/P4/P5).
- `transcripts-privacy-guard.test.ts:22-33` — ilgisiz proje adları **elle yazılmış 6'lık sabit
  liste**. Makinede `~/.claude/projects` altında 16 dizin var; listede olmayan gerçek proje adları
  serbest (P10). `CLAUDE.md`: "çiti feature'a değil yapıya koy" — liste diskten türetilmeli.
- `collectStringLeaves` (`:44-56`) yalnızca **değerleri** topluyor, anahtarları değil (P8);
  ve dizi elemanlarını tek tek ölçtüğü için 200 karakter eşiği parçalayarak aşılabiliyor (P9).

**Neden bloklayıcı:** mevcut beş fixture'ı satır satır okudum, **gerçekten anonim** (aşağıya bkz.),
yani bugün sızan bir veri yok. Bloklayıcılık şuradan: bu çit AC'nin "elle dikkat ettim yetmez"
gerekçesiyle konmuş **tek** savunma ve F-010/F-011 bu dizine yeni fixture ekleyecek. En olası
gerçek sızıntı yolu — "gerçek bir transkriptin kesik kuyruğunu yeni fixture olarak kopyalamak" —
çitten %100 geçiyor. Yanlış güven, çitsizlikten kötüdür.

**Öneri (ucuz ve yeterli):** (a) `listFixtureFiles` tüm dosyaları özyinelemeli numaralandırsın,
uzantı süzgeci kalksın; (b) secret/opak/uzunluk kontrolleri **ham satır metnine** de uygulansın
(ayrıştırma başarısızsa satır atlanmasın); (c) yol deseni POSIX/ileri-bölü/`%USERPROFILE%`/UNC
biçimlerini kapsasın; (d) ilgisiz proje listesi `~/.claude/projects` taranarak türetilsin
(izin verilen proje çıkarılarak). (e) tercihen kara liste yerine beyaz liste: fixture'larda
serbest metin yalnızca sabit bir sentetik sözcük dağarcığından gelebilsin.

---

## B2 — BLOKLAYICI: wiki sayfasının `✓ DOĞRULANDI` sürüm iddiası yanlış

**Kabul kriteri:** AC "Doğrulanan format `docs/wiki/pages/desen/claude-transcript-formati.md`
sayfasına yazılır (…tekrarlanacak kontrol listesiyle)" · sözleşme T6.

**İddia** (`claude-transcript-formati.md:17-19`):
"Transkriptlerin kendi `version` alanı: **2.1.261** — CLI binary sürümünden farklı.
✓ DOĞRULANDI (**217 dosyanın tamamında aynı değer gözlendi**)."

**Tekrar üretme:**
```
find ~/.claude/projects/C--dev-apps-mission-control -name '*.jsonl' -print0 \
  | xargs -0 grep -oh '"version":"[^"]*"' | sort | uniq -c
```
**Beklenen:** tek değer, `2.1.261`.
**Gerçek (2026-09-09, 218 dosya, toplam alan yazımı):**

| `version` | satır | dosya |
|---|---:|---:|
| `2.1.260` | 45 358 | çoğunluk |
| `2.1.261` | 1 894 | 94 |
| `2.1.205` | 8 | 1 |

Üç ayrı değer var; **baskın değer sayfada hiç geçmeyen `2.1.260`** (%96). Dahası `2.1.205` — yani
**kurulu CLI sürümünün kendisi** — transkriptlerin içinde de geçiyor; bu, sayfanın "transkript
sürümü CLI'dan ayrı bir SDK/harness sürümü olmalı" ⊢ ÇIKARIM'ını doğrudan zayıflatıyor.

**Neden bloklayıcı:** bu feature'ın teslimatı kod değil, **doğrulanmış format belgesi**.
Sayfanın tek işlevi bir sonraki Claude Code güncellemesinden sonra karşılaştırma tabanı olmak
(kontrol listesi madde 1-2 tam olarak bunu söylüyor). Taban değer yanlışsa kontrol listesi de
yanlış alarm/yanlış sessizlik üretir. Ayrıca `✓ DOĞRULANDI` işareti sayfanın güvenilirlik
mekanizmasının kendisi — yanlış bir iddiaya konmuş olması diğer ✓'ların ağırlığını düşürüyor
(sözleşme "217 dosya tarandı" derken `version` alanının hiç toplanmadığı, tek bir dosyanın ilk
satırından okunduğu anlaşılıyor).

**Not:** aynı taramada sayfanın **doğru** çıkan iddiaları: 13 `type` değerinin listesi birebir
tutuyor; `summary` gerçekten hiç gözlenmiyor; dört `usage` alanı `assistant` satırlarının
**%100'ünde** mevcut (20 961/20 961); ek alanlar (`iterations`, `cache_creation`,
`output_tokens_details`, `speed`, `service_tier`, `inference_geo`, `server_tool_use`) da
sayfadaki listeyle uyuşuyor; gerçek dosyalarda **0 bozuk satır** var.

---

## B3 — ÖNEMLİ: 200 karakterlik serbest metin eşiğinin hiçbir testi yok (maskelenmiş)

**Mutasyon M1c:** `transcripts-privacy-guard.test.ts:39` → `MAX_FREE_TEXT_CHARS = 100000`.
**Beklenen:** T1c ("200+ karakterlik serbest metin çiti KIRMIZI yapar") kırmızı.
**Gerçek:** `Tests 69 passed (69)` — **yeşil**.

**Maskeleyen yan etki:** T1c'nin sondası `'x'.repeat(250)` yazıyor; bu dizge eşikten bağımsız
olarak `LONG_OPAQUE_BLOB_PATTERN` (`[A-Za-z0-9+/_=]{80,}`) ile eşleşiyor, dolayısıyla test
"ihlal bulundu" diye geçiyor ama **ölçtüğünü sandığı eşiği hiç ölçmüyor**. F-008'in "mutasyon
maskelenebilir" dersinin birebir tekrarı. Sonda metni boşluk içeren gerçekçi bir cümle olsaydı
maskeleme kalkardı.

---

## B4 — ÖNEMLİ: yol çitinin dört savunma katmanının **hiçbirinin** kendi testi yok

`resolveAllowedTranscriptPath` dört katmanlı. Katman katman mutasyon (her biri tek başına):

| Mutasyon | Kaldırılan katman | dosya:satır | Sonuç |
|---|---|---|---|
| M6 | ata dizin symlink kontrolü | `transcript-reader.ts:267` | **69/69 YEŞİL** |
| M6b | hedef dosya symlink kontrolü | `transcript-reader.ts:271` | **69/69 YEŞİL** |
| M10 | realpath **öncesi** kapsama kontrolü | `transcript-reader.ts:259-262` | **69/69 YEŞİL** |
| M11 | realpath **sonrası** kapsama kontrolü (`resolved` → `candidatePath`) | `transcript-reader.ts:274-277` | **69/69 YEŞİL** |

Geliştiricinin junction testi (`transcript-reader.test.ts:322`) yalnızca `{ok:false}` iddia ediyor;
`reason` alanına bakmadığı için bir katman düşünce diğerinin farklı bir `reason` ile reddetmesi
testi yeşil bırakıyor.

**Ürün kodu doğru** (temiz kodda junction → `{"ok":false,"reason":"symlink"}`), eksik olan çit.
Ama iki katman **birlikte** düşünce gerçek kaçış oluyor: M6+M11 uygulandığında izin verilen proje
dizini içindeki bir junction, kökün **tamamen dışındaki** bir dosyayı okuttu
(`{"ok":true,"targetPath":"…\qa-outside-…\gizli.jsonl"}`, `OKUNDU lines_ok=1`). Bu birleşik hâlde
geliştiricinin testi kırmızı verdi (1 failed) — yani ancak iki katman aynı anda bozulursa yakalanıyor.
`CLAUDE.md`: "iki katmanlı kontrolde her katmanı ayrı ayrı kaldır."

---

## B5 — ÖNEMLİ: kuyruk okuma yolu sessizce her şeyi kaybediyor, `degraded` yalan söylüyor

`transcript-reader.ts:96-97` — dosya `maxBytesBeforeTail`'i aşıyor ve son `tailBytes` içinde hiç
`\n` yoksa fonksiyon `''` dönüyor.

**Tekrar üretme:** `readTranscript(f, { maxBytesBeforeTail: 100, tailBytes: 64 })`, dosya =
bir geçerli satır + 4096 baytlık newline'sız kuyruk.
**Beklenen:** veri kaybı dürüstçe bildirilsin.
**Gerçek:**
```
{"lines_ok":0,"lines_bad":0,"unknown_type_lines":0,"degraded":false,"file_read_failed":false}
```
Yani **dosyanın tamamı kayboldu** ama sonuç "sağlıklı, hiçbir sorun yok" diyor. Sözleşme T5
"`degraded` dürüst" diyor; bu yol dürüst değil. Gerçek 64 MB+ dosya bu makinede gözlenmedi
(wiki de bunu [T] TAHMİN olarak işaretliyor), bu yüzden bloklayıcı değil — ama F-011 token
toplamını buradan okuyacak ve sıfırı "sıfır token" sanacak.

---

## B6 — ÖNEMLİ: dört "MUTASYON hedefi" testi kendi kendine referans veriyor, hiçbir şey ölçmüyor

- `transcript-reader.test.ts:343` (T4): `const alwaysAllowed = () => ({ok:true,…});
  expect(alwaysAllowed()).toMatchObject({ok:true})` — kendi tanımladığı sabiti doğruluyor.
- `transcript-reader.test.ts:411` (T5): `expect(real.degraded).toBe(true)` ardından
  `expect(real.degraded).not.toBe(false)` — aynı iddianın tekrarı.
- `transcripts-privacy-guard.test.ts:159` (T1d): boş bir `RegExp[]` dizisinin hiçbir şey
  eşleştirmediğini doğruluyor (`[].some(...)` → `false`).
- `transcript-reader.test.ts:212` (T3) kısmen anlamlı (case-sensitive eşleştiricinin kaçırdığını
  gösteriyor) ama yine üretim kodunu mutasyonlamıyor.

Yalnızca T2 (`:124`) gerçek bir şey kanıtlıyor (`JSON.parse` o satırda gerçekten fırlatıyor).
Bu dört test, 35 thread testinin 4'ü; sayıyı şişiriyor ve "mutasyonla doğrulandı" izlenimi veriyor.
Gerçek mutasyonlar (aşağıdaki tablo) zaten ayrı koşulmalı ve rapora yazılmalı — teste gömülmemeli.

---

## B7 — DÜŞÜK: wiki kontrol listesinin 3. adımındaki script hiçbir şey yapmıyor

`claude-transcript-formati.md:123` — verilen tek satırlık Python
(`… for d in [json.loads(l)] if True] if False else None`) koşullu ifadenin `if False` dalında
olduğu için **hiç çalışmıyor**, `None` değerlendiriyor ve hiçbir çıktı üretmiyor. Hemen altındaki
"Pratikte: … repoya dahil edilmedi" notu bunu kabul ediyor. Sayfanın en kritik tekrarlanabilirlik
adımı, çalışmayan bir kod bloğuyla süsleniyor; ya gerçekten çalışan bir satır konmalı ya da blok
tamamen kaldırılıp yalnızca tarif bırakılmalı.

---

## B8 — DÜŞÜK (kabul edilebilir, not düşülerek): `record()` hiçbir üretim kodu tarafından çağrılmıyor

`grep -rn "\.record(" src/ electron/ scripts/` → yalnızca iki **yorum** satırı
(`transcript-reader.ts:326`, `src/server/index.ts:335`). Canlı ölçüm:
`npm run build && npm start` → `GET /api/health` → `"transcript_reader":{"files_seen":0,
"lines_ok":0,"lines_bad":0}` (HTTP 200).

**Kararım: bu bir bloklayıcı değil, hatta "yeşil ama ölçmeyen" sınıfına da girmiyor.** Ayrım
şurada: o sınıf bir testin **ölçtüğünü iddia edip ölçmemesi**. Burada hiçbir şey ölçüldüğünü iddia
etmiyor — sözleşme (§1 "Kapsam dışı", §6), kod yorumu ve `health.test.ts:175`'in
`toEqual({0,0,0})` iddiası üçü birden "henüz hiç okuma yok" diyor; `files_seen: 0` da "hiç
okunmadı"yı "sorun yok"tan zaten ayırıyor. Yine de tüketicisi olmayan ~25 satır üretim kodu
Karpathy §2'ye ("ileride lazım olur kodu yok") aykırı; F-010 bunu bağlamazsa health alanı
kaldırılmalı. Bu turda kabul.

---

## Doğrulanan iddialar (GEÇTİ tarafı)

### `bom-crlf` fixture'ı gerçekten CRLF mi — **EVET**

| Ölçüm | Sonuç |
|---|---|
| Diskte `0d0a` sayısı | **3** (BOM `efbbbf` de mevcut, ilk 3 bayt) |
| `git show HEAD:…bom-crlf.jsonl` blob'unda `0d0a` | **3** |
| **Temiz klonda** (`git clone --no-hardlinks .`) `0d0a` | **3** |
| `valid.jsonl` (kontrol) `0d0a` | **0** — fixture gerçekten ayırt edici |
| `git check-attr -a` | `text: unset`, `eol: lf` |

`eol: lf` hâlâ görünüyor ama `text` **unset** olduğu için etkisiz — üç ölçüm de bunu ampirik
olarak doğruluyor. `tests/fixtures/transcripts/.gitattributes` (`* -text`) düzeltmesi çalışıyor;
fixture ölçtüğünü ölçüyor.

### Okuyucu asla fırlatmıyor — **EVET** (10/10)

`yarım UTF-8` · `\0` baytları · 12 MB tek satır (newline yok) · 200 000 seviye iç içe JSON ·
dosya yerine **dizin** (`EISDIR` → `file_read_failed:true`) · var olmayan yol · kuyruk yolu ·
`icacls /deny (RD,RA)` ile **okuma izni kapalı dosya** · okuma izni kapalı **dizin** ·
bozuk/uzun/`NUL`/`CON` aday yolları guard'a verme. Hiçbirinde istisna yok; hepsinde anlamlı
sonuç nesnesi döndü.

**Mutasyon M2** (satır bazlı `try/catch` kaldırıldı) → **2 failed** ✓ KIRMIZI.
**Mutasyon M7** (dosya düzeyi `try/catch` kaldırıldı) → **1 failed** ✓ KIRMIZI.
Guard yolunda `lstatSync`/`realpathSync` çağrıları `try/catch` dışında ama izin reddi altında
bile fırlatmadı (Windows'ta `lstat`/`realpath` DACL okuma izni gerektirmiyor) — bu turda bulgu değil.

### Yol çiti — 13 kaçış denemesinin 13'ü reddedildi

| Deneme | Sonuç |
|---|---|
| izin verilen proje dosyası (kontrol) | `ok:true` |
| izin verilmeyen proje dosyası | `not-allowed` |
| `…/C--dev-allowed/../C--dev-secret-other/x.jsonl` | `not-allowed` |
| `…/C--dev-allowed/../../outside/x.jsonl` | `outside-root` |
| büyük harfli izinli dizin (`C--DEV-ALLOWED`) | `ok:true` (harf duyarsız — doğru) |
| küçük harfli izinsiz dizin | `not-allowed` |
| `\\?\` uzun yol öneki (izinli ve izinsiz) | `outside-root` (ikisi de) |
| sondaki nokta (`x.jsonl.`) | `not-found` |
| ADS akışı (`x.jsonl:$DATA`) | `not-found` |
| karışık bölü (`root/C--dev-secret/x.jsonl`) | `not-allowed` |
| junction, izinli ada sahip, izinsiz hedefe | `symlink` |
| junction adı **izin listesine eklenmiş** hâlde | `symlink` |
| 8.3 kısa ad | bu birimde 8.3 üretimi kapalı (`dir /x` kısa ad döndürmüyor) — denenemedi |

Dosya symlink'i `mklink` ile kurulamadı (yönetici/geliştirici modu gerekiyor) — junction ile
eşdeğer yol sınandı.

**Gerçek makinede kanıt (sözleşmenin T4 iddiası):**
- `readAllowedTranscript(~/.claude/projects, ['C:\dev\apps\mission-control'], <gerçek ilgisiz
  projenin gerçek .jsonl'ı>)` → **`RED not-allowed`** ✓
- aynı çağrı izin verilen projenin gerçek dosyasıyla → `OKUNDU lines_ok=38 bad=0 unk=27` ✓
- **Mutasyon M3** (izin listesi kontrolü kaldırıldı) → **3 failed** ✓ KIRMIZI.
- **Mutasyon M8** (`readAllowedTranscript` guard'ı atlıyor) → **1 failed** ✓ KIRMIZI.

### Fixture'lar gerçekten anonim mi — **EVET**

Beş fixture'ın tamamını satır satır okudum. Tüm UUID'ler `00000000-0000-4000-8000-00000000000N`
kalıbında sentetik; `cwd` değerleri `C:\workspace\ornek-proje` (gerçek kullanıcı yolu değil);
metinler "ornek kullanici istemi (anonim)" gibi açıkça yer tutucu; model adı `claude-example`,
mesaj kimlikleri `msg_example001`. Gerçek prompt kalıntısı **yok**. F-009 commit'inin
(`7249351`) eklediği satırlarda geçen `C:\Users` / `hayat-mentoru` / `video-factory` dizgelerinin
altısı da **çitin kendi desen listesinde veya yorumlarda** — fixture verisinde değil.

### Format iddiaları (örnekleme değil, tam tarama)

218 dosya, toplam-sayı taraması (içerik hiçbir yere kopyalanmadı): 13 `type` değeri sayfadaki
tabloyla birebir aynı; `summary` **hiç yok**; dört `usage` alanı `assistant` satırlarının
20 961/20 961'inde mevcut; ek `usage` anahtarları sayfadaki listeyle uyuşuyor; **0 bozuk satır**;
boyut aralığı 97 bayt – 9.78 MB (sayfa "97 bayt – 9.3 MB" diyor, oturum sürerken büyümüş, sapma
değil). Tek yanlış iddia B2'deki sürüm satırı.

---

## Mutasyon tablosu (13 bağımsız mutasyon; hepsi birebir geri alındı)

| # | Mutasyon | Hedef | Beklenen | Sonuç |
|---|---|---|---|---|
| M1a | `WINDOWS_USER_PATH_PATTERN` kontrolü devre dışı | privacy-guard:73 | KIRMIZI | **2 failed** ✓ |
| M1b | ilgisiz proje adı kontrolü devre dışı | privacy-guard:70 | KIRMIZI | **1 failed** ✓ |
| M1c | `MAX_FREE_TEXT_CHARS` 200 → 100000 | privacy-guard:39 | KIRMIZI | **69 passed** ✗ **B3** |
| M2 | satır bazlı `try/catch` kaldırıldı | reader:141-147 | KIRMIZI | **2 failed** ✓ |
| M3 | izin listesi kontrolü kaldırıldı | reader:283-285 | KIRMIZI | **3 failed** ✓ |
| M4 | dizin eşleşmesi harf **duyarlı** yapıldı | reader:224 | KIRMIZI | **2 failed** ✓ |
| M5 | `degraded: linesBad>0` → `false` | reader:179 | KIRMIZI | **2 failed** ✓ |
| M6 | ata dizin symlink kontrolü kaldırıldı | reader:267 | KIRMIZI | **69 passed** ✗ **B4** |
| M6b | hedef dosya symlink kontrolü kaldırıldı | reader:271 | KIRMIZI | **69 passed** ✗ **B4** |
| M7 | dosya düzeyi `try/catch` kaldırıldı | reader:112-117 | KIRMIZI | **1 failed** ✓ |
| M8 | `readAllowedTranscript` guard'ı atlıyor | reader:305-307 | KIRMIZI | **1 failed** ✓ |
| M9 | `stripBom` etkisiz | reader:104 | KIRMIZI | **1 failed** ✓ |
| M10 | realpath **öncesi** kapsama kontrolü kaldırıldı | reader:259-262 | KIRMIZI | **69 passed** ✗ **B4** |
| M11 | realpath **sonrası** kapsama `resolved` yerine `candidatePath` | reader:274-277 | KIRMIZI | **69 passed** ✗ **B4** |
| M6+M11 | birleşik | — | KIRMIZI | **1 failed** ✓ (ama gerçek kök-dışı okuma gerçekleşti) |

Maskeleme sorgusu her mutasyonda soruldu; M1c'de **maskeleme bulundu** (B3). Sözleşmenin
planladığı 5 mutasyonun 5'i kırmızı verdi; **planlanmamış 8 mutasyonun 4'ü yeşil kaldı** —
`CLAUDE.md`'nin "geliştiricinin listesini kopyalama" dersi yine karşılığını verdi.

`grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` → yalnızca meşru test adları
(`write-gate-manifest.test.ts:124` dahil, dokunulmadı). `git status` temiz, `git diff HEAD`
yalnızca bu tur öncesinden kalan `developer` hafıza dosyalarını gösteriyor.

---

## Test / koşu sayıları

| Koşu | Sonuç |
|---|---|
| `npm run verify` (1. deneme) | worker-fork kararsızlığı (`exit 3221226505`, `features-api.test.ts`) — bilinen sınıf |
| `npm run verify` (2. deneme, elle) | **YEŞİL** (typecheck + lint + 1115 test + build) |
| `npx vitest run` (temel) | **1115 passed, 4 skipped (76 dosya)** |
| `npx vitest run tests/features/thread/` | **35 passed (2 dosya)** |
| `npm run e2e` | **36 passed (37.6s)** |
| `npm run build && npm start` + `GET /api/health` | HTTP 200, `transcript_reader:{0,0,0}` |

**Yetim süreç: 0.** `npm start` süreci (PID 21020, port 7333) durduruldu; kalan `node.exe`
süreçleri yalnızca Playwright MCP araçları. `C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı.
Yazdığım tüm sonda fixture'ları ve geçici test dosyaları silindi (`git status` temiz).

---

## Puanlama

| Boyut | Puan | Gerekçe |
|---|---:|---|
| İşlevsellik | **7** | Okuyucu ve yol çiti 23 düşmanca girdi/kaçış denemesinde kusursuz. B5 (kuyruk yolunda sessiz tam veri kaybı + `degraded:false`) gerçek bir dürüstlük hatası ama üretimde erişilmeyen yolda. |
| Özellik bütünlüğü | **5** | AC "fixture'lar anonimleştirilir (yapısal çit)" — çit 12/12 sızıntıda yenildi (B1). AC "doğrulanan format wiki'ye yazılır" — sayfada `✓ DOĞRULANDI` işaretli yanlış iddia (B2). `record()` tüketicisiz (B8). |
| Görsel/UX | **6** | Bu feature'ın "arayüzü" wiki sayfası: yapısı ve ✓/⊢/[T] işaretleme disiplini örnek alınacak kalitede, kontrol listesi gerçekten uygulanabilir; ama taban değeri yanlış (B2) ve 3. adımın script'i çalışmıyor (B7). |
| Kod kalitesi (test/hata yönetimi) | **6** | Hata yönetimi çok iyi (asla fırlatmama, anlamlı `reason` kodları, savunmalı `usage` ayrıştırma). Testler zayıf: 4 katmanın hiçbirinin kendi çiti yok (B4), 200-karakter eşiği maskelenmiş (B3), 4 test kendi kendine referans (B6). |

Üç boyut 7'nin altında → **KARAR: KALDI**.

---

## Düzeltme turu için asgari liste

1. **B1** — gizlilik çitini genişlet: özyinelemeli + uzantısız numaralandırma, ham satır taraması
   (ayrıştırılamayan satırlar dahil), POSIX/ileri-bölü/`%USERPROFILE%`/UNC yol biçimleri,
   ilgisiz proje listesinin diskten türetilmesi. Yukarıdaki P1-P12 sondalarının **her biri** için
   ayrı bir regresyon testi ekle (sonda dosyalarını depoda bırakma — testin içinde üret ve sil,
   mevcut T1a/T1b deseni gibi).
2. **B2** — `version` alanını **tüm dosyalar üzerinde** yeniden say, sayfaya üç değeri de yaz,
   `2.1.205`'in transkriptte de geçtiğini not düş ve ⊢ ÇIKARIM cümlesini buna göre düzelt.
3. **B3** — T1c sondasını boşluk içeren gerçekçi bir cümleye çevir (opak-blok deseni maskelemesin),
   M1c mutasyonunu koştur ve kırmızı gördüğünü rapora yaz.
4. **B4** — dört katman için dört ayrı test (junction testi `reason`'a da baksın; dosya symlink'i
   kurulamıyorsa testi atla-değil-belgele; realpath kapsama kontrolü için ayrı senaryo).
5. **B5** — kuyruk yolunda satır sınırı bulunamazsa `degraded:true` (veya yeni bir
   `tail_truncated` bayrağı) döndür ve testle çitle.
6. **B6/B7** — kendi kendine referans veren dört testi ya gerçek bir şey ölçecek şekilde yaz ya da
   kaldır; wiki'deki çalışmayan Python bloğunu düzelt veya sil.
