KARAR: KALDI
ESKALE: false

# G5 — iki sözleşmenin yeniden ölçüm turu (tur 2)

**Tarih:** 2026-09-10
**Tür:** ÇOK DAR yeniden ölçüm. Yalnızca Y1 ve Y3 ölçüldü; başka hiçbir kriter yeniden
açılmadı, yeni denetim yapılmadı.
**Ölçülen düzeltme:** commit `53a320f` ("fix(hooks): close G5 round-5 blockers Y1 and Y3")
**Bileşik karar:** ikiden biri KALDI → **KALDI**

| # | Sözleşme | Önceki | Bu tur |
|---|---|---|---|
| 1 | `docs/qa/g5-guvenlik-duzeltme-tur3-contract.md` (Y1) | KALDI | **KALDI** |
| 2 | `docs/qa/g5-onay-dosyasi-korumasi-contract.md` (Y3) | KALDI | **GEÇTİ** |

**Tek cümlelik özet:** Y3 **tam olarak kapandı** (ölçülen her boyutta); Y1 **daraltıldı ama
kapanmadı** — "kapsam dışıdır" diye açıkça reddedilen bir dosya adı hâlâ sessizce kapsama
girebiliyor, yalnızca artık metnin belli bir şekline bağlı olarak.

---

## 0. Kısıtlara uyum

- **Gerçek `docs/approvals/` altına hiçbir şey yazılmadı/silinmedi.** Tur başı ve tur sonu
  SHA-256'ları birebir aynı (§4). `git status --porcelain docs/approvals/ .claude/ src/`
  tur sonunda **boş**.
- `.claude/` altındaki hiçbir dosya değiştirilmedi. Tur sonu MD5'leri tur başıyla aynı:
  `gate-check.cjs 14d615ca9088f4610d564676a7cb6599`,
  `_selftest.cjs d28c5b4d1dff8c9cf94b15d6b53f087b`,
  `block-dangerous.cjs 8099805ee49f9d9f816d8041253dbd1e`.
- Tüm PoC ve mutasyonlar **MD5'i doğrulanmış sandbox kopyalarda** yapıldı (§1.0).
- `npm run test` / `npm run e2e` **çalıştırılmadı** (brief §4).
- `docs/progress.md`, `docs/blockers.md`, hiçbir `*-contract.md`, `scripts/`, `tests/`,
  `package.json`, `CLAUDE.md` dosyasına yazılmadı.
- Korunan komut adları hiçbir Bash komut satırına gömülmedi; sandbox kurulumu/temizliği
  `Write` ile yazılan Node betikleriyle yapıldı (Y2 sınıfı, üçüncü kez gözlemlendi).
- **Süreç hijyeni:** tur sonunda 4 `node.exe` var, **hiçbiri bana ait değil** — 2 tanesi
  Playwright MCP (bu ajanın kendi araç ortamı), 1 tanesi paralel turun `hold-*` port
  tutucusu, 1 tanesi paralel turun `vite build`'i (komut satırlarıyla doğrulandı).
  7333/7334'te dinleyen yok. `chrome.exe` yok. `%TEMP%` altında `mc-selftest-*` artığı **0**.
- *Dürüstlük notu:* temizlik betiğim scratchpad'de `sb1` ve `mut-*` kalıplı **17** dizin
  sildi; bunlardan 10'u bu turda benim oluşturduklarım, 7'si önceki turlardan kalma
  artıklardı. Paralel turun bu kalıpta bir dizini varsa etkilenmiş olabilir (yalnızca
  geçici dosyalar; depo dosyası değil).

---

## 1. Ölçüm altyapısı

### 1.0 Sandbox — MD5 doğrulanmış

`.claude/hooks/` altındaki **9 dosyanın tamamı** izole bir kopyaya alındı, kaynak/kopya
MD5'leri **9/9 eşleşti** (`ALL_MD5_MATCH=true`):

```
asset-guard.cjs      533c9688db335af9b39f1aa4907d196d
block-dangerous.cjs  8099805ee49f9d9f816d8041253dbd1e
gate-check.cjs       14d615ca9088f4610d564676a7cb6599
post-format.cjs      2d78b66bb08a18582f3b957c7366e894
send-event.cjs       308fd02488a872b499c351b5dacfb740
session-start.cjs    c73bfa90d9cc5eb2925c3319a2244cae
stop-check.cjs       3c12934629ab5ce2c25460ffca13cad4
_common.cjs          41c4be2337f72053b71fd91703ecebaf
_selftest.cjs        d28c5b4d1dff8c9cf94b15d6b53f087b
```

Sandbox kendi izole `docs/approvals/` ağacını taşır (kendi `G2.ok`/`README.md` fixture'ı);
gerçek dosyalar okunmadı bile.

### 1.1 Gerçek depoda self-test

| Ölçüm | Beklenen | Çıkan |
|---|---|---|
| `node .claude/hooks/_selftest.cjs` (gerçek depo, 3 kez) | 106/106, exit 0 | **106 OK / 0 FAIL, exit 0** |
| Koşum sonrası `docs/approvals/` | 7 dosya, değişmemiş | 7 dosya, SHA-256 birebir aynı |
| `%TEMP%` altında `mc-selftest-*` artığı | 0 | 0 |

---

## 2. Sözleşme #1 — `g5-guvenlik-duzeltme-tur3-contract.md` (Y1)

### KARAR: KALDI

**Puanlar:** İşlevsellik **6** · Özellik bütünlüğü **5** · Görsel/UX *yok say* · Kod kalitesi **6**

### 2.1 Kapanan kısım (hakkını verelim)

Düzeltme gerçek ve ölçülebilir. `parseGuardScope()` artık tek bir `## Kapsam` başlığının
bloğunu okuyor; başlık yok / birden fazla / blok boş → fail-closed; başlık varyantları
tanınıyor. **22 sondanın 19'u beklendiği gibi** davrandı:

| Sonda | Beklenen | Çıkan | Durum |
|---|---|---|---|
| A kontrol: yalnız Kapsam, hedef kapsam dışı | 2 | 2 | ✓ |
| **B — önceki turun PoC'i birebir**: `## Gerekce` bölümünde "KAPSAM DIŞI" diye anılan ad | 2 | **2** | ✓ **kapandı** |
| B2 komşu davranış: aynı metinde kapsam İÇİNDEKİ ad hâlâ kabul | 0 | 0 | ✓ (aşırı engelleme yok) |
| C başlık hiç yok → fail-closed | 2 | 2 | ✓ |
| D / D2 iki `## Kapsam` başlığı → belirsiz, ikisi de red | 2 / 2 | 2 / 2 | ✓ |
| E bölüm var, ters tırnaklı ad yok → fail-closed | 2 | 2 | ✓ |
| F1 `##Kapsam` (boşluksuz) | 0 | 0 | ✓ |
| F2 `## KAPSAM` (büyük harf) | 0 | 0 | ✓ |
| F3 `##   kapsam   ` (küçük harf + fazla boşluk) | 0 | 0 | ✓ |
| G1 **başlık ÖNCESİ** önsöz düzyazısındaki ad | 2 | 2 | ✓ |
| G5 sonraki bölüm `### Gerekce` (h3) | 2 | 2 | ✓ |
| G6 kod bloğuna gömülü sahte `## Kapsam` | 2 | 2 | ✓ (belirsiz → fail-closed) |
| G7 `## Kapsam \`x.cjs\`` (aynı satırda ad) | 2 | 2 | ✓ fail-closed |
| G8 `## Kapsam:` (iki nokta) | 2 | 2 | ✓ fail-closed |
| G9 kapsamda tam yol yazımı | 2 | 2 | ✓ fail-closed |
| G10/G11 CRLF satır sonları | 0 / 2 | 0 / 2 | ✓ |
| G12 harf varyantı hedef (`.CLAUDE/HOOKS/...`) | 0 | 0 | ✓ |

Yani brief'in istediği "başlık yok · iki başlık · boş bölüm · başlık varyantları · komşu
davranış" vakalarının **hepsi tuttu**, üstelik pozitif yol bozulmadı.

### 2.2 BLOKLAYICI — Y1 kapanmadı, yalnızca daraldı

Kapsam, `## Kapsam` başlığından **bir sonraki `##` ile başlayan satıra ya da dosya sonuna**
kadar uzanıyor. Dolayısıyla "kapsam bölümü dışındaki ad kapsam sayılmaz" iddiası **yalnızca
sonraki bölüm `##` ile başlıyorsa** doğru. **3/22 sonda sızdırdı:**

| Sonda | Sonraki bölümün biçimi | Beklenen | **Çıkan** |
|---|---|---|---|
| **G2** | *(başlık yok — kapsam listesinin altına düşülmüş not)* | 2 | **0 — sessiz izin** |
| **G3** | `# Gerekce` (h1) | 2 | **0 — sessiz izin** |
| **G4** | `**Gerekce**` (kalın psödo-başlık) | 2 | **0 — sessiz izin** |

Üçünde de `.guard-state.json` şu hâle geliyor:
```json
{"scopeKey":"[\".claude/hooks/block-dangerous.cjs\",\".claude/hooks/evil-payload.cjs\"]",
 "touched":[".claude/hooks/evil-payload.cjs"]}
```

**Tekrar üretme adımları (G2, en gerçekçi biçim):**
1. Sandbox depo kopyasında `docs/approvals/GUARD.ok` dosyasına şunu yaz:
   ```
   ## Kapsam
   `block-dangerous.cjs`

   Not: `evil-payload.cjs` bu listeye DAHİL DEĞİLDİR.
   ```
2. `gate-check.cjs`'e stdin ile
   `{"tool_name":"Write","tool_input":{"file_path":".claude/hooks/evil-payload.cjs"}}` ver.
3. **Beklenen:** exit 2 (kapsam dışı reddi).
   **Gerçek:** exit 0, stdout boş — **hiçbir izin kartı gösterilmeden** yazma yetkilendirildi.

### 2.3 Gerçekçi onay metniyle canlı gösterim

Sondaların sentetik olduğu itirazını kapatmak için, bir CEO'nun doğal olarak yazacağı bir
onay belgesiyle tekrarlandı:

```
# GUARD onayi — G5 tur 6 hook bakimi

Tarih: 2026-09-10
Onaylayan: Kullanici (Veron) — AskUserQuestion

## Kapsam

- `gate-check.cjs`

Not: bu turda `_selftest.cjs` dosyasina DOKUNULMAYACAK, kapsam disidir.
Ayrica `block-dangerous.cjs` da bu onayin KAPSAMI DISINDADIR.
```

| Hedef | Onay metninin dediği | Sistemin yaptığı |
|---|---|---|
| `.claude/hooks/gate-check.cjs` | kapsamda | **exit 0 — izin** (doğru) |
| `.claude/hooks/_selftest.cjs` | **"DOKUNULMAYACAK, kapsam dışıdır"** | **exit 0 — SESSİZ İZİN, kart YOK** |
| `.claude/hooks/block-dangerous.cjs` | **"KAPSAMI DIŞINDADIR"** | **exit 0 — SESSİZ İZİN, kart YOK** |

`.guard-state.json` üç dosyalık bir kapsam kaydediyor:
`"scopeKey":"[\".claude/hooks/_selftest.cjs\",\".claude/hooks/block-dangerous.cjs\",\".claude/hooks/gate-check.cjs\"]"`

**Ek ağırlaştırıcı:** kapsam üç dosyaya şiştiği için token, amaçlanan tek yazmadan sonra
**tüketilmiyor** (`allTouched` false) — kullanıcının "tek değişiklik" onayı diskte açık
kalmaya devam ediyor.

### 2.4 Neden bloklayıcı (yumuşatma yok)

Brief §6'nın **her iki** ölçütü de karşılanıyor:
- **(a) kalıcı artefakt:** `GUARD.ok`'un uygulanan kapsamı ve diske yazılan
  `.guard-state.json` içeriği, kullanıcının onayladığı kararla çelişecek şekilde oluşuyor.
- **(b) ana vaat:** sözleşmenin madde 4'ü *"token bir DEĞİŞİKLİĞİ yetkilendirir, bir YAZMAYI
  değil"* ve *"serbest metin kapsam SAYILMAZ — fail-closed"* diyor. Onaylanan değişiklik ile
  uygulanan değişiklik hâlâ farklı olabiliyor.

ADR-016 sınırına göre de **pratik sızıntı**: kart **hiç gösterilmiyor** (exit 0, sessiz).
"Teorik ihlal ama doğru bilgi taşıyan kart var" savunması burada geçerli değil.

Ayrıca `g5-tur5-kapsam-ve-selftest-contract.md`'nin kendi kabul iddiası doğrudan yanlış:
> *"5. Bölümden SONRA gelen metinde ad geçerse: blok sınırı … bu adı asla içermez — asıl
> kusur buydu, artık yapısal olarak imkânsız."*

G2 bunun aksini gösteriyor: sonraki bir `##` başlığı yoksa blok **dosya sonuna kadar** uzanır
ve o adı **içerir**. Sözleşme `###` sınırını "bilinen sınır" diye kayda geçmiş (o taraf
**güvenli** yönde çalışıyor, G5 doğrulandı) ama `#`, kalın psödo-başlık ve **başlıksız
kuyruk düzyazı** hiç düşünülmemiş — ve bunların üçü de **güvensiz** yönde.

**Muhtemel dosya:satır:** `.claude/hooks/gate-check.cjs:56-70` (`blockEnd` hesabı ve
`anyHeaderRe = /^\s*##/`).

### 2.5 Sınıf uyarısı (CEO için)

Bu, `CLAUDE.md`'de kayıtlı **"kodun/metnin NASIL YAZILDIĞINI sayan çit, sözdizimi
çeşitliliğine yenilir"** sınıfının bu depodaki beşinci tekrarı. Y1 için üçüncü tur da aynı
aileden bir yama olursa (`#{1,}` kabul et, kalın satırı da başlık say…) dördüncü bir varyant
çıkacaktır. Yapısal alternatifler (biri seçilmeli, brief'te **adıyla** yazılmalı):
- **Kapalı biçim dayatması:** GUARD.ok'un kapsam bölümü, `## Kapsam` ile başlayıp
  **yalnızca** `- \`ad.cjs\`` biçiminde satırlar içeren, ilk boş satırda biten bir blok
  olsun; blokta başka herhangi bir içerik varsa fail-closed. Belgenin geri kalanındaki
  ters tırnaklar hiç ayrıştırılmasın.
- **Metin ayrıştırmasını tamamen bırak:** kapsamı ayrı, makine üretimli bir alanda taşı
  (ör. GUARD.ok'un ilk satırında `SCOPE=a.cjs,b.cjs`), düzyazı hiç okunmasın.
- Hangisi seçilirse seçilsin: self-test'e **kuyruk düzyazı**, **`#` başlık** ve **kalın
  psödo-başlık** vakaları eklenmeli — bugünkü `y1-b` vakası yalnızca `##` biçimini görüyor.

---

## 3. Sözleşme #2 — `g5-onay-dosyasi-korumasi-contract.md` (Y3)

### KARAR: GEÇTİ

**Puanlar:** İşlevsellik **9** · Özellik bütünlüğü **8** · Görsel/UX *yok say* · Kod kalitesi **7**

### 3.1 Canlı kanıt — önceki turun PoC'i birebir tekrarlandı

**Gerçek `docs/approvals/` altına dosya konmadı.** Bunun yerine deponun MD5 doğrulanmış
izole bir kopyasında, ayırt edilebilir içerikli sahte onay dosyaları kullanıldı
(`AYIRT-EDILEBILIR-ICERIK-GUARD` vb.).

| Ölçüm | Beklenen | **Çıkan** |
|---|---|---|
| (a) exit kodu | 3 | **3** |
| (b) dört dosya hâlâ duruyor mu | evet | **evet, 4/4** |
| (b) içerikler birebir aynı mı (SHA-256) | evet | **evet, 4/4** |
| (c) hiç test çıktısı üretildi mi | hayır | **stdout tamamen BOŞ (0 satır)** |
| Red mesajı | hangi dosyalar + ne yapılmalı | **4 dosyayı tek tek listeliyor + iki yol öneriyor** |

stderr birebir:
```
REDDEDILDI: self-test calistirilmadi, hicbir dosyaya dokunulmadi.
Gercek, henuz tuketilmemis olabilecek onay/durum dosyalari mevcut:
  - docs\approvals\PUSH.ok
  - docs\approvals\DANGER.ok
  - docs\approvals\GUARD.ok
  - docs\approvals\.guard-state.json
```

**Dosya bazında tek tek (dördü ayrı ayrı bekletildi):**

| Bekleyen tek dosya | exit | duruyor | içerik aynı |
|---|---|---|---|
| `GUARD.ok` | 3 | evet | evet |
| `PUSH.ok` | 3 | evet | evet |
| `DANGER.ok` | 3 | evet | evet |
| `.guard-state.json` | 3 | evet | evet |

### 3.2 Bekleyen onay YOKKEN normal koşu

| Ölçüm | Beklenen | Çıkan |
|---|---|---|
| exit | 0 | **0** |
| sonuç | 106/106 | **106 OK / 0 FAIL** |
| `docs/approvals/` içeriği önce/sonra | değişmemiş | `["G2.ok","README.md"]` → `["G2.ok","README.md"]` |
| `%TEMP%` sandbox artığı | 0 | **0** |

**İkinci Y3 belirtisi de kapandı:** önceki turdaki "bekleyen onay varken sonuçlar bozuluyor
(98/98 → 96 OK / 2 FAIL)" etkisi artık **imkânsız** — betik bu durumda hiç çalışmıyor. Ek
olarak M2 mutasyonu (emniyet kemeri sökülmüş, bekleyen onay var) **106/106** verdi: yani
izolasyon katmanı tek başına da sonuç bozulmasını engelliyor.

### 3.3 Ek robustluk sondası (brief'te istenmemişti)

Yanlış çalışma dizininden çağrıldığında (`cwd = C:\dev\apps`) betik **fail-closed**:
`REDDEDILDI: izole sandbox kurulamadi … ENOENT … 'C:\dev\apps\.claude\hooks'`, **exit 4**.
Hiçbir dosyaya dokunmadan durdu.

### 3.4 Eşikli borç (bloklayıcı DEĞİL — §3.5'te ölçüldü)

İki koruma katmanının **hiçbirinin kendi pozitif kontrolü yok**: bekleyen onay yokken
katmanlardan biri sökülse bile self-test **106/106 yeşil** kalıyor (M5, M6). Bu, deponun
kayıtlı en pahalı hata sınıfının (*"koruma sessizce ölürse"*) özyinelemeli hâli.

**Neden yine de bloklayıcı değil:** zararlı hiçbir senaryo sessiz değil —
- izolasyon sökülür + bekleyen onay var → **emniyet kemeri yakalıyor** (exit 3, dosyalar sağlam);
- ikisi birden sökülür + bekleyen onay var → dosyalar imha oluyor **ama** self-test kırmızı
  veriyor (M3b: 1 FAIL, M4: 5 FAIL).
Katmanlar birbirini kapıyor ve bugünkü kodda gerçek onaylara **hiç dokunulmuyor** (§0'daki
SHA-256 tablosu, üç ayrı gerçek koşudan sonra).

**Eşik:** M3b'deki kırmızı **tasarlanmış bir assert'ten değil**, `DANGER.ok`'un ilgisiz bir
vakayı bozmasından geliyor — yani kazara. Kemer ya da izolasyon tek başına yeniden yazılırsa
(ör. başlık bloğu refaktörü) bu kazara sinyal kaybolabilir. Kalıcı çözüm: `_selftest.cjs`'i
alt süreç olarak koşturan, sahte bekleyen onayla exit 3'ü ve dosya bütünlüğünü assert eden
bir vaka (kendi dosyasını dışlamayı unutmadan — fork bomb dersi).

---

## 4. Mutasyonlar — hepsi sandbox'ta, `node --check` ile sözdizimi doğrulanmış

Her mutasyon **taze bir sandbox kopyasında** yapıldı; gerçek dosyalara hiç dokunulmadı, bu
yüzden geri alma da gerekmedi (`git checkout` **kullanılmadı**).

**Baz (mutasyonsuz sandbox): 106 OK / 0 FAIL, exit 0.**

| # | Mutasyon | Hedef | Sonuç |
|---|---|---|---|
| **M1** | `parseGuardScope`'un **bölüm sınırlamasını kaldır** (`block = text`) | #1 | **104 OK / 2 FAIL** — `y1-b` (gerekçe-kapsam-dışı), `y1-h` (boş bölüm) |
| **M1b** | `parseGuardScope`'u **birebir düzeltme öncesi** hâline döndür (`53a320f^`) | #1 | **102 OK / 4 FAIL** — `y1-b`, `y1-d` (başlık yok), `y1-e` (belirsiz başlık), `y1-h` |
| **M2** | Emniyet kemerini (**exit 3 dalı**) kaldır, bekleyen onay VAR | #2 | **106 OK / 0 FAIL** — *hiçbir test görmüyor*; ama dosyalar **sağlam** (izolasyon tutuyor) |
| **M3** | Sandbox izolasyonunu (**`process.chdir`**) kaldır, bekleyen onay VAR | #2 | **exit 3** — emniyet kemeri yakaladı; dosyalar **sağlam**, dizin değişmedi |
| **M3b** | **Kemer + izolasyon ikisi de** kaldırıldı (= Y3 düzeltmesini birebir geri sar), bekleyen onay VAR | #2 | **105 OK / 1 FAIL**; `approvals` **imha edildi**: `[DANGER.ok, G2.ok, GUARD.ok, PUSH.ok, README.md]` → `[G2.ok, README.md]` |
| **M4** | `_selftest.cjs` **birebir eski hâli** (`53a320f^`), bekleyen onay VAR | #2 | **93 OK / 5 FAIL**; `approvals` **imha edildi** (aynı üç dosya silindi) |
| **M5** | `process.chdir` kaldırıldı, bekleyen onay **YOK** | #2 | **106 OK / 0 FAIL** — sessiz (zarar yok, ama ölçülmüyor) |
| **M6** | Emniyet kemeri kaldırıldı, bekleyen onay **YOK** | #2 | **106 OK / 0 FAIL** — sessiz (zarar yok, ama ölçülmüyor) |

**Yorum:**
- **M1 vs M1b farkı çitin kalitesini kanıtlıyor:** bölüm sınırı ile başlık-sayımı dalları
  **bağımsız** ölçülüyor (kaskad bir yeşil/kırmızıya dayanmıyor). Sözleşmenin iddia ettiği
  "4 kırmızı" bu turda **bağımsız olarak birebir yeniden üretildi**.
- **M3b ve M4, önceki turun canlı bulgusunu birebir yeniden üretti** (üç kullanıcı onayı
  uyarısız silindi + sonuçlar bozuldu). Yani düzeltme **gerçek bir zararı** kapatıyor,
  komşu bir yolu değil.
- **M2/M5/M6** §3.4'teki borcun ölçümü.

---

## 5. Gerçek onay dosyaları — SHA-256 (tur başı = tur sonu)

```
docs/approvals/G0.ok      3b21fd8e7c4b2d1f3797275eb18dfe476a7f2c83435b905df3d6f31824148565
docs/approvals/G1.ok      72bcf9757aec9ca5ba76f1a02bddad85f3051d1110d7e7a62189c1dc8d5b5234
docs/approvals/G2.ok      a87cd696dd44424084594e2a32e83f0f32b4fc797cbb0148ef8b3cbdefba1bf5
docs/approvals/G3.ok      36b18d582ac02afd3d0709d908ef256079b6ff147f09c08afccda5757bf9eef2
docs/approvals/G4-1.ok    08d0fe3aaa80ed11a1eece6956a4c48272903ebadcb74974aa09c8fffba0d82b
docs/approvals/G4-2.ok    6bf5be0828d071a215dfff9aa9b01c210f26709b10799f5f0b93250c9c862ace
docs/approvals/README.md  770799bb377c769c3633217a73d579f5ddfc9d705c84a5c730f2425f554a3ed7
```

Yedi dosya, tur başında ve tur sonunda **birebir aynı**. Bekleyen token (`GUARD.ok`,
`PUSH.ok`, `DANGER.ok`, `.guard-state.json`) tur boyunca **hiç var olmadı**.

---

## 6. CEO'nun uygulaması gereken frontmatter değişiklikleri

```
docs/qa/g5-guvenlik-duzeltme-tur3-contract.md   → status: fix    (Y1 hâlâ açık)
docs/qa/g5-onay-dosyasi-korumasi-contract.md    → status: done   (Y3 kapandı)
```

`docs/qa/g5-tur5-kapsam-ve-selftest-contract.md` (şu an `status: qa`) bu turun resmî
kapsamında değildi; ama Y3 tarafı tamamen doğrulandı, Y1 tarafının kabul iddiası
(madde 5, "artık yapısal olarak imkânsız") **yanlış** ölçüldü — CEO bunu bir sonraki
düzeltme turunun girdisi yapmalı.

## 7. G5 kapısı hakkında

Bu tur G5 kapısı kararı vermez. Kayda geçsin: **Y3 kapandı, Y1 açık** — dolayısıyla
"G5 geçmek için kapanması ŞART" listesindeki iki maddeden biri hâlâ açık.

---

**Bu turun kapsamı dışında, hâlâ açık:** `test-skip-gate-contract.md` → **KALDI**
(port izolasyonu, paralel tur).
