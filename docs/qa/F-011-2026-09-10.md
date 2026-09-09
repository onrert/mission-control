KARAR: KALDI
ESKALE: false

---
feature: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
reviewer: qa-evaluator
date: 2026-09-10
round: kod turu 1
verdict: KALDI
---

# F-011 QA raporu — Token Kullanımı ekranı

**Puanlar:** İşlevsellik **2/10** · Özellik bütünlüğü **4/10** · Görsel/UX **6/10** ·
Kod kalitesi **6/10** → herhangi biri < 7 olduğu için **KALDI**.

**Tek cümlelik özet:** Ekran çalışıyor, çökmüyor, hata yollarının hepsi kapalı ve test disiplini
güçlü — **ama gösterdiği rakam iki katına yakın yanlış.** Panel bu depo için
**4.831.555.797** token diyor; aynı verinin doğru toplamı **2.401.357.301** (+%101,3).
Bu ekranın tek varlık gerekçesi rakamın doğru olması olduğu için karar KALDI'dır.

Ortam: Windows 11 · `npm run build && npm start` (`MC_PORT=4599`, gerçek `./data`, gerçek
`~/.claude/projects`) · Chromium (Playwright) · `npm run dev` KULLANILMADI · `git push` yapılmadı.

---

## 0. Bağımsız çapraz kontrol — ÖNCE SAYILAR

Üç bağımsız yöntemle ölçüldü. Panelin ürettiği rakam **kendi bağımsız yeniden uygulamamla
BİREBİR** aynı çıktı (yani kod, yapmayı amaçladığı şeyi kusursuz yapıyor) — ama **amaçlanan şey
yanlış**.

### 0.1 Kendi bağımsız toplamım (ürün kodundan tamamen ayrı okuyucu)

Sandviç ölçümü (canlı oturum dosyaya yazmaya devam ettiği için bağımsız toplam → panel →
bağımsız toplam sırasıyla, üçü de aynı saniyelerde):

| Ölçüm | Toplam (4 alan) | `lines_ok` |
|---|---|---|
| Bağımsız betik (önce) | 4.831.555.797 | 56.350 |
| **Panel `/api/usage`** | **4.831.555.797** | **56.350** |
| Bağımsız betik (sonra) | 4.831.555.797 | 56.350 |

→ **Sapma 0.** Ayrıştırma, dosya numaralandırma, gün/oturum/agent kırılımı ve dört alanın
toplanması doğru uygulanmış. Betik: `scratchpad/independent-sum.cjs` (230 dosya, 155 MB,
0 bozuk satır, 23.173 `assistant` satırı).

### 0.2 Aynı verinin DOĞRU toplamı (mükerrer satırlar tekilleştirilmiş)

| Ölçüm | Toplam | Fark |
|---|---|---|
| Panel (ham `assistant` satırı toplamı) | 4.832.974.386 | — |
| `message.id`+`requestId` ile tekil | **2.401.357.301** | **panel +%101,3** |

Gün bazında şişme: 2026-09-04 **+%87,1** · 09-05 **+%78,8** · 09-06 **+%81,6** · 09-08 **+%79,4**
· 09-09 **+%175,0**. Yani yalnızca mutlak toplamlar değil, ekrandaki **yüzde çubukları ve
günler-arası oranlar da** bozuk (09-09 diğerlerinin iki katı şişiyor).

### 0.3 `ccusage` çapraz kontrolü (AC6, README'nin tarif ettiği yol)

`npx ccusage@latest daily` **çalıştı** (exit 0, ağ erişimi vardı).

- `ccusage session` çıktısındaki, bu projenin 67 üst düzey oturum kimliğine karşılık gelen
  toplam: **2.405.914.546**. Bu, benim tekilleştirilmiş toplamımdan (2.401.357.301) yalnızca
  **%0,19** farklı (aradaki fark canlı oturumun büyümesi) → **üçüncü parti araç benim
  hesabımı doğruluyor, panelinkini değil.**
- En keskin sinyal: `ccusage daily` **bu makinedeki 16 projenin TAMAMI** için 2026-09-04 gününe
  **266.426.800** token diyor; panel **tek bir proje** için aynı güne **305.375.474** diyor.
  Panelin tek projesi, tüm makinenin toplamını aşıyor — bu tek başına bir "imkânsız sayı"
  alarmıdır.

---

## 1. BLOKLAYICI

### B1 — Panel her API çağrısını, yanıtın içerik bloğu sayısı kadar tekrar sayıyor (+%101 şişme)

**Kök neden (kanıt, tahmin değil):** Claude Code tek bir asistan yanıtını **birden çok
`type:"assistant"` satırı** olarak yazıyor — her içerik bloğu (`text`, `thinking`, `tool_use`)
için bir satır — ve **her satır aynı, tam `message.usage` nesnesini taşıyor** (aynı `message.id`,
aynı `requestId`, aynı sayılar). Okuyucu her satırın `usage`'ını topladığı için tek bir API
çağrısı 2-3 kez sayılıyor.

Gerçek örnek (`~/.claude/projects/C--dev-apps-mission-control/799bb786-….jsonl`, satır 27-28):

```
satır 27: blocks=["text"]     msg_011CeikrG2p3tp56Kt8bBKUV req_011CeikrESKBEqQpZXqYpd9o
          usage{input 2, output 197, cache_creation 47980, cache_read 7266}
satır 28: blocks=["tool_use"] msg_011CeikrG2p3tp56Kt8bBKUV req_011CeikrESKBEqQpZXqYpd9o
          usage{input 2, output 197, cache_creation 47980, cache_read 7266}   ← BİREBİR AYNI
```

Tek bir dosyada grup büyüklüğü dağılımı: 297 mesaj 1 satır, 81 mesaj 2 satır, **244 mesaj 3
satır**. Depo genelinde 23.178 `assistant` satırı yalnızca **11.935 gerçek API çağrısına**
karşılık geliyor; **11.243 satır mükerrer** ve toplamın **%50,32'si** bu mükerrerlerden geliyor.

**Tekrar üretme (2 dakika):**
1. `npm run build && npm start` (`MC_PORT=4599`), tarayıcıda Token sekmesi → "Toplam:
   4.834.627.270 token" (ekran görüntüsü: `.playwright-mcp/qa-f011-token-1280.png`).
2. `node scratchpad/dedup-total.cjs` → `HAM 4.832.974.386 / TEKIL 2.401.357.301 / +%101,3`.
3. `npx ccusage@latest session --json` → aynı projenin oturumları toplamı 2.405.914.546.

**Beklenen:** Panel, gerçekte harcanan tokenı gösterir (≈2,40 milyar).
**Gerçek:** ≈4,83 milyar — **%101 fazla**, hiçbir uyarı yok, `degraded:false`.

**Muhtemel dosya:satır:** `src/features/thread/server/transcript-reader.ts:179-192` — `usage`
alanları satır bazında koşulsuz toplanıyor; `message.id`/`requestId` hiç okunmuyor. Tüketici:
`src/features/usage/server/usage-aggregator.ts:120-133`.

**Neden testler yakalamadı:** Tüm birim testleri, her `assistant` satırının ayrı bir API çağrısı
olduğu **elle yazılmış** fixture'lara dayanıyor (`tests/features/usage/server/
usage-aggregator.test.ts:41` "elle hesaplanan değerlerle eşleştirir"). Gerçek transkriptte aynı
`message.id`'yi iki kez taşıyan bir fixture **yok**. F-009 spike'ı (`docs/wiki/pages/desen/
claude-transcript-formati.md`) `usage` alan **adlarını** doğruladı ama **toplama semantiğini**
hiç doğrulamadı — bu, ADR-007'nin "format değişirse token rakamları sessizce yanlış olabilir"
riskinin format değişmeden gerçekleşmiş hâli.

**Not:** Düzeltmenin şekli (tekilleştirme anahtarı, hangi katmanda yapılacağı, F-010'un aynı
okuyucuyu kullanması) bir tasarım kararıdır; bu rapor yalnızca hatayı ve büyüklüğünü tespit eder.
Fixture'a **aynı `message.id`/`requestId`'yi taşıyan çok bloklu bir mesaj** eklenmeden düzeltme
kabul edilmemeli.

---

## 2. ÖNEMLİ bulgular

### Ö1 — "Tanınan satır oranı" ölçülmüyor; format değişirse ekran sessizce 0 gösteriyor

AC4 ve ADR-007 azaltımı "**tanınan** satır oranı düştüğünde uyarı" diyor. Uygulama bunun yerine
**ayrıştırılabilen** satır oranını ölçüyor (`usage-aggregator.ts:273-276`, `lines_ok` = `JSON.parse`
başarılı satır sayısı). Okuyucu `unknown_type_lines`'ı hesaplıyor
(`transcript-reader.ts:172-177`) ama toplayıcı bu alanı **kullanmıyor** ve `UsageReport`
(`src/shared/types.ts:250-260`) hiç taşımıyor.

**Canlı kanıt:** Sandbox'ta tüm `"type":"assistant"` dizgelerini `"type":"assistant_message"`
yaptım (formatın yeniden adlandırılması senaryosu):

```
usage {0,0,0,0}  lines_ok 8  lines_bad 0  degraded false  source_unreadable false
```

Tarayıcıda: **"Toplam: 0 token"**, tablo dolu ama tüm satırlar 0, **uyarı YOK**
(`.playwright-mcp/qa-f011-format-degisti.png`). Kullanıcı "bu hafta hiç token harcamamışım"
sonucuna varır. Bu, ADR-007'nin kapatmak için azaltım yazdığı riskin tam olarak açık kalması.

### Ö2 — Okunamayan tek bir dosya sessizce toplamdan düşüyor (yarı-başarı)

`usage-aggregator.ts:123` — `file_read_failed` olan dosya `return` ile atlanıyor; hiçbir sayaç
artmıyor, `degraded` etkilenmiyor, arayüze hiçbir sinyal gitmiyor.

**Gerçek Windows ACL ile ölçüldü** (mock değil):
`icacls <ana-oturum.jsonl> /deny "<kullanıcı>:(RA,RD,RX)"` →

| | toplam | degraded | source_unreadable |
|---|---|---|---|
| önce | 140 | false | false |
| sonra | **30** | **false** | **false** |

Tokenların **%79'u** kayboldu, "ana oturum" satırı agent kırılımından tamamen silindi ve
kullanıcıya **hiçbir şey söylenmedi**. `docs/03-ux.md` ekran 6 açıkça "sessiz kısmi başarı yok"
diyor; `CLAUDE.md` bunu deponun en pahalı hata sınıfı ilan ediyor.

### Ö3 — 32 MB kuyruk kırpması kullanıcıya HİÇ söylenmiyor (AC7'nin görünmeyen yüzü)

`transcript-reader.ts:108-117` — 64 MB üstü dosyada son 32 MB okunur; satır sınırı **bulunduğu**
sürece `degraded` **false** kalır (`:200`). Yani "veri kaybı oldu" bayrağı yalnızca kuyrukta hiç
newline olmayan patolojik durumda yükseliyor; normal kırpmada hiç yükselmiyor.

**Ölçüldü:** Sandbox'a 70 MB'lık gerçek bir `.jsonl` (219.115 `input_token`) koydum →
panel **99.870** gösterdi, `degraded:false`. **Verinin %54,4'ü sessizce düştü.**
(Bu makinedeki gerçek dosyaların hiçbiri 64 MB'ı aşmıyor — en büyüğü 32 MB altı — yani bugün
tetiklenmiyor; ama transkriptler büyüdükçe tetiklenecek ve kullanıcı fark etmeyecek.)

### Ö4 — AC6'daki `ccusage` çapraz kontrol yordamı kullanıcıyı yanlış yere yönlendiriyor

`README.md:93-118` iki noktada uygulanamaz/yanıltıcı:
1. `ccusage daily` **proje filtresi almıyor** (`--help` ile doğrulandı: `--since/--until/
   --timezone/--sections/--by-agent…`, proje seçeneği yok). Panel yalnızca **izlenen** projeleri
   toplarken ccusage **makinedeki tüm projeleri** topluyor. README adım 2 ("aynı takvim gününe
   ait Input/Output sütunlarını okuyun") bu kapsam farkını hiç anmıyor; bu makinede 16 projeden
   1'i izleniyor.
2. README adım 3 diyor ki: "Büyük bir sapma (ör. %10+) varsa panelin **'veri eksik olabilir'
   uyarısını kontrol edin**". Gerçek sapma **%101** ve o uyarı **hiç görünmüyor** (`degraded:false`).
   Yani AC6'nın sağladığını iddia ettiği doğrulama değeri, B1'i tespit etmek yerine kullanıcıyı
   çıkmaz bir sokağa gönderiyor.

### Ö5 — Y3 ağ çiti 8 sondanın 6'sıyla yeniliyor

Çit yalnızca `globalThis.fetch` / `http.request` / `https.request` üzerine kurulmuş bir çalışma
zamanı casusu (`usage-aggregator.test.ts:325-361`). `computeUsageReport`'un başına sonda ekleyip
`npx vitest run … -t "ağ"` koşturdum:

| # | Sonda | Sonuç |
|---|---|---|
| 1 | `fetch('http://…')` | **KIRMIZI** ✔ |
| 2 | `globalThis.fetch(…)` | **KIRMIZI** ✔ |
| 3 | `http.get({…})` | YEŞİL ✘ (çitin KENDİ kapsamı: "http isteği" — `get`, `request` özelliğini okumadan çağırıyor) |
| 4 | `net.connect({…})` (`node:net`) | YEŞİL ✘ |
| 5 | `dns.lookup(…)` | YEŞİL ✘ |
| 6 | `execFileSync('curl', …)` | YEŞİL ✘ |
| 7 | `import('node:https').then(m => m.request(…))` | YEŞİL ✘ |
| 8 | modül yüklenirken yakalanan `const r = http.request; r(…)` | YEŞİL ✘ |

`tests/no-external-host.test.ts` de yardımcı olmuyor: o yalnızca `http(s)://` **dizge
literallerini** tarıyor, ağ API'lerini değil (sonda 4/5/6/8'de hiç URL literali yok).
**Ürün kodu bugün doğru** (`usage-aggregator.ts` yalnızca `node:fs`/`node:path` import ediyor),
sorun çitin iddia ettiğini yapmaması. Ucuz yapısal çözüm: import beyaz listesi
(`src/features/usage/**` yalnızca `node:fs`, `node:path` ve iç modülleri import edebilir) —
`CLAUDE.md`'nin "dördüncü tekrarda yapısal çit koy" kuralı.

### Ö6 — Salt okunurluk için manifest/anlık görüntü testi YOK; statik çit dolaylı yazmayla aşılıyor

Kardeş feature'ın (Thread, aynı sınıf salt-okunur ekran) `tests/features/thread/server/
thread-read-only-manifest.test.ts` dosyası var; F-011'in eşdeğeri **yok**. Tek savunma
`tests/no-write-gate-bypass.test.ts`'in statik dizge taraması.

- `fs.writeFileSync(...)` doğrudan eklendiğinde → **KIRMIZI** ✔ (1 test).
- Dolaylı biçim (`(fs as …)['w'+'riteFileSync'](…)`) eklendiğinde → **1255/1255 YEŞİL** ✘ ve
  mutasyon **gerçekten dosya yazdı**: `computeUsageReport`'u tsx ile çağırdım, taranan kökte
  `qa-write-probe2.txt` oluştu. (Sonda temizlendi.)

### Ö7 — Tablonun sütun başlıkları yok (UX ekran 6'dan sapma) ve 320px'te proje sütunu kayboluyor

`docs/03-ux.md:311-321` mockup'ı `│ Proje │ Gün │ Giriş │ Çıkış │ Dağılım │` başlık satırını
açıkça çiziyor. Uygulamada başlık satırı **hiç yok** (`UsageScreen.tsx:172-198`): kullanıcı
`mission-control  2026-09-04  3.708  959.483  6%` görüyor ve 3.708'in ne olduğunu tahmin etmek
zorunda. "Yanlış rakam" riski olan bir ekranda etiketsiz sütun ciddi bir eksiklik; ekran okuyucu
için de hiçbir bağlam yok.

Ayrıca 320px'te (`docs/03-ux.md:17` birincil senaryo) `grid-cols-[1fr_1fr_auto_auto_auto]`
sıkışınca proje sütunu **5 satırın 3'ünde tamamen boşalıyor**, 2'sinde `mi…`'ye düşüyor —
ekran görüntüsü `.playwright-mcp/qa-f011-token-320.png`. Bu ekranda proje **filtresi olmadığı**
için (tasarım kararı) satırın hangi projeye ait olduğu tek ayırt edici bilgidir.

Ek tutarsızlık: satırda **giriş ve çıkış** gösteriliyor ama yüzde çubuğu ve "Toplam" **dört
alanın** toplamı üzerinden hesaplanıyor. Ekrandaki görünür sayıların toplamı (≈4,8 M) ile
"Toplam: 4,83 milyar" arasında 1000 kat fark var ve bunu açıklayan hiçbir metin yok.

---

## 3. Küçük bulgular / notlar (karar etkilemez)

- **N1 — Gün UTC'ye göre türetiliyor** (`usage-aggregator.ts:73`, `toISOString().slice(0,10)`).
  UTC+3'te 00:00-03:00 arası değiştirilen dosyalar bir önceki güne yazılıyor; ölçtüm: 2026-09-04
  UTC'de 305.375.474, yerel takvimde 219.713.229 (%28 fark). **Bloklayıcı değil**, çünkü deponun
  geri kalanı da UTC gün kullanıyor (`src/server/store/jsonl-store.ts:18-19`) — yani Zaman
  Çizelgesi ile tutarlı. Yine de sözleşme §1 madde 3 "takvim günü" diyor; yerel/UTC seçimi
  yazılı değil.
- **N2 — 280px'te "Token" sekmesinin kırpılmış görünür genişliği 0 px.** Sözleşme 320-767px
  iddia ediyor, developer 280'i ölçmediğini bildirmişti; 280px `docs/03-ux.md`'nin tanımlı
  aralığının (320-480) dışında → not.
- **N3 — 320px'te sekme şeridi hâlâ taşıyor.** `App.tsx:126-131` yorumu "320px'te 6 sekmenin
  TAMAMINI (`scrollWidth <= clientWidth`) sığdırıyor" diyor; gerçek ölçüm: `scrollWidth 317 /
  clientWidth 296` → **21 px taşma**, Token sekmesi **12/33 px**. Yorum yanlış. Davranış F-008'in
  DÜŞÜK önem verdiği sınıfla aynı (kaydırılabilir şerit) → bulgu **yorumun yanlışlığı**dır.
  E2E eşiği `> 0` olduğu için 12 px'lik kıymık da geçiyor (F-010 dersi: eşiği pikselle kalibre et).
- **N4 — Uyarı metninde ek yanlış:** "Toplam 9 satırdan **1'sı** ayrıştırılamadı" → `1'i`.
- **N5 (F-011'e ait DEĞİL):** Konsolda `Encountered two children with the same key, m:<uuid>:text`
  hatası var; kaynak `src/features/chat/web/ChatScreen.tsx:462-464` (F-012). Token sekmesi hiç
  açılmadan da üretiliyor → proje borcu.
- **N6 (proje borcu):** `npx vitest run` 3 koşudan 2'sinde "Worker forks emitted error" verip
  **10-16 testi sessizce koşmadan** bitirdi (1245/1243 vs 1255) — ve **çıkış kodu yine 0**.
  `CLAUDE.md`'de kayıtlı vitest kararsızlığının bu sefer görünen yüzü: `verify` yeşil derken
  testlerin %1'i hiç koşmamış olabiliyor.

---

## 4. Doğrulanan iddialar (developer haklıydı)

| İddia | Sonuç |
|---|---|
| **Y2** — `subagents/*.meta.json` gerçek, `agentType` dolu | ✔ **Tam tarama**: 132 dosya, **132/132** geçerli JSON, `agentType` dağılımı `developer 79, qa-evaluator 48, explorer 2, ux 1, architect 2` (developer 131/47 demişti; fark bu QA oturumunun kendisi). Yetim `.jsonl` **0**. |
| **AC1** — yalnızca `type:"assistant"` sayılır | ✔ Sandbox'ta `user`/`system`/`summary`/`queue-operation` satırlarına **usage koydum**, hiçbiri toplama girmedi (elle hesap 140 = panel 140). Mutasyon M1 KIRMIZI. |
| **AC2/Y8** — kaynak okunamazsa çökmez | ✔ **Gerçek EPERM** ile (`icacls /deny` kökte): `/api/usage` **HTTP 200**, `source_unreadable:true`, ekranda "Token verisi okunamadı…", `/api/health` ve `/api/events` 200, Zaman Çizelgesi/Kanban/Thread etkilenmedi, süreç yaşadı (`.playwright-mcp/qa-f011-eperm-okunamadi.png`). "Bulunamadı" ve "fırlattı" ayrı testlerle kapalı. |
| **Y5** — uyarı gerçekten arayüzde | ✔ Bozuk satırlı fixture ile tarayıcıda görüldü: `role="status"`, "⚠ Toplam 9 satırdan 1'sı ayrıştırılamadı — veri eksik olabilir." (`.playwright-mcp/qa-f011-degraded-uyari.png`). F-010'un "hesaplanıyor ama taşınmıyor" hatası **tekrarlamamış**. |
| **D10 / 6 sekme** | ✔ 320/375/480/640/700/767px'in hiçbirinde 0 px yok (kendi kırpılmış-genişlik ölçümüm, üretim 6 sekmesiyle, gerçek sunucuda `chat_enabled:true`): 320→12 px, ≥360→33 px. Bkz. N2/N3. |
| **Kapalı sekme kümesi** | ✔ Yedinci sekme ekleyen mutasyon (M7) **5 test KIRMIZI**. |
| **CSS `@source`** | ✔ `src/features/usage/web` `index.css`'te; yalnızca bu dizinde geçen 8 sınıfın **8'i de** `dist/web/assets/*.css`'te var (eksik 0). Yapısal çit (`build-css.test.ts:223`) dizinleri dosya sisteminden numaralandırıyor. |
| **Test sayıları** | ✔ `npm run verify` **exit 0**, `1255 passed / 4 skipped (1259)`; `npx playwright test` **52/52** yeşil. |
| **`git checkout` kullanılmadı** | ✔ Bu turda da kullanılmadı; tüm mutasyonlar scratchpad'teki `.bak` kopyalarından elle geri alındı, md5 ile doğrulandı, `git status` temiz. |

---

## 5. Mutasyon tablosu (10 bağımsız + 8 ağ sondası)

| # | Mutasyon | Dosya | Sonuç |
|---|---|---|---|
| M1 | satır tipi filtresi: `type==='assistant'` → `'assistant' \|\| 'user'` | `transcript-reader.ts:179` | **KIRMIZI** (1) |
| M2 | toplama aritmetiği: `a.output + b.output` → `a.output` | `usage-aggregator.ts:64` | **KIRMIZI** (5) |
| M4 | uyarı görünürlüğü: `{report.degraded && (` → `{false && …` | `UsageScreen.tsx:187` | **KIRMIZI** (1) |
| M5 | dar-genişlik CSS'i geri alındı (`gap-1`→`gap-4`, `text-[11px]`→`text-sm`) | `App.tsx:157,171` | **KIRMIZI** (E2E, 320 ve 375px'te `#tab-usage` = 0 px) |
| M6 | fırlatan yol: `isSourceUnreadable`'ın `try/catch`'i kaldırıldı | `usage-aggregator.ts:246` | **KIRMIZI** (1) |
| M7 | yedinci sekme eklendi | `App.tsx:35` | **KIRMIZI** (5) |
| M8 | eşik: `RECOGNIZED_RATIO_WARNING_THRESHOLD 0.99 → 0` | `usage-aggregator.ts:48` | **KIRMIZI** (1) |
| M9 | Y2 uydurma: `bilinmiyor` → `'developer'` | `usage-aggregator.ts:97` | **KIRMIZI** (3) |
| M10 | oturum kimliği dosya adından değil sabitten | `usage-aggregator.ts:172` | **KIRMIZI** (1) |
| M11 | salt okunurluk: mutlu yola `fs.writeFileSync` | `usage-aggregator.ts:263` | **KIRMIZI** (1) |
| M11b | aynı yazma, **dolaylı** (`fs['w'+'riteFileSync']`) | aynı | **YEŞİL** ✘ (Ö6) — gerçekten dosya yazdı |
| P1-P8 | ağ çiti sondaları | `usage-aggregator.ts` | 2 KIRMIZI / **6 YEŞİL** ✘ (Ö5) |

Tüm mutasyonlar geri alındı: `md5sum` dört dosyada da `.bak` ile aynı, `git status` temiz,
`grep -rn "MUTATION\|MUTASYON\|QA-.*-PROBE" src/ tests/ electron/ scripts/` yalnızca meşru test
adlarını döndürüyor (`gates-manifest.test.ts:222`, `feature-detail.test.ts`,
`thread-read-only-manifest.test.ts:61`, `transcript-reader.test.ts:124` — dokunulmadı).

---

## 6. Kanıt dosyaları

- `.playwright-mcp/qa-f011-token-1280.png` — üretim ekranı, "Toplam: 4.834.627.270 token"
- `.playwright-mcp/qa-f011-token-320.png` — 320px, proje sütunu 5 satırın 3'ünde boş
- `.playwright-mcp/qa-f011-token-280.png` — 280px
- `.playwright-mcp/qa-f011-format-degisti.png` — format değişimi → "Toplam: 0 token", uyarı yok
- `.playwright-mcp/qa-f011-degraded-uyari.png` — "veri eksik olabilir" uyarısı arayüzde
- `.playwright-mcp/qa-f011-eperm-okunamadi.png` — gerçek EPERM → "okunamadı", diğer ekranlar sağlam

Ölçüm betikleri (depoya **girmedi**, scratchpad'te): `independent-sum.cjs`, `dup-check.cjs`,
`dup-inspect.cjs`, `dedup-total.cjs`, `make-sandbox.cjs`, `make-big.cjs`, `css-check.cjs`,
`net-probe.cjs`, `mutate.cjs`.

⛔ Depoya hiçbir gerçek transkript içeriği bırakılmadı; sandbox
(`%TEMP%\mcqa11`) ve tüm sondalar silindi. `git status` temiz.

---

## 7. KALDI'yı kaldırmak için gereken minimum

1. **B1**: mükerrer `assistant` satırları tekilleştirilsin; çit olarak fixture'a aynı
   `message.id`+`requestId`'yi taşıyan **çok bloklu** bir mesaj eklensin ve tekilleştirmeyi
   kaldıran mutasyon KIRMIZI versin. Ayrıca `docs/wiki/pages/desen/claude-transcript-formati.md`
   bu gözlemi (bir yanıt = N satır, `usage` tekrarlanır) yazsın.
2. **Ö1**: `unknown_type_lines` rapora taşınsın ve uyarı eşiği **tanınan satır** oranına bağlansın;
   "tüm satırlar tanınmıyor → 0 token" senaryosu bir testle çitlensin.
3. **Ö2 + Ö3**: okunamayan dosya sayısı ve kuyruk kırpması rapora + arayüze taşınsın
   (sessiz kısmi başarı yok).
4. **Ö4**: README çapraz kontrolü, kapsam farkını (izlenen projeler vs tüm makine) ve
   `ccusage session` ile proje bazlı karşılaştırmayı anlatsın; "%10+ sapmada uyarıya bak"
   yönlendirmesi düzeltilsin.
5. **Ö5 + Ö6**: ağ çiti yapısal hâle getirilsin (import beyaz listesi) ve F-011 için Thread
   emsalinde bir salt-okunur manifest testi eklensin.
6. **Ö7**: sütun başlıkları eklensin; 320px'te proje sütunu okunur kalsın.
