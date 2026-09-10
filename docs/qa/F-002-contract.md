---
feature: F-002
title: Olay alma uç noktası + JSONL depo + retention + N1/N4 borçları
author: developer
status: approved
date: 2026-09-04
---

# F-002 Sözleşmesi — Olay alma + JSONL depo + retention

Bu belge, kod yazılmadan önce "ne yapılacağı + nasıl doğrulanacağı" sözleşmesidir
(`docs/PROCESS.md` §5). qa-evaluator bu belgeyi inceleyip onaylar/düzeltir; anlaşınca kod
başlar. Kaynaklar: `docs/features/F-002-olay-alma-jsonl-depo.md`, `docs/02-architecture.md`
§5, §6.1, §8.2, ADR-001, ADR-003, ADR-006, `docs/01-prd.md` (Özellik 1), `docs/qa/F-001-contract.md`
(biçim örneği), mevcut kod (`src/server/index.ts`, `package.json`, `vite.config.ts`,
`tests/**`).

Bu turda **hiçbir `src/` veya `tests/` dosyası değiştirilmedi**; bu, kod yazılmadan önceki
sözleşme metnidir.

---

## 1. Kapsam

**İçinde (bu feature'da yapılacak):**
- `POST /api/events` — hook olayı alımı, normalizasyon, `flags` politikası, JSONL'e append.
- `GET /api/events` — **yalnızca** `since_seq` + `limit` sorgu parametreleri (feature notu
  "Kapsam sınırı" bölümü bağlayıcı — tam filtre seti bu feature'da yok).
- JSONL depo: günlük dosyalar (`data/events/YYYY-MM-DD.jsonl`), append-only, `seq` üretimi ve
  `.seq` dayanıklılığı, açılışta ring buffer yükleme (≥100 olay, hedef `MC_RING_SIZE`).
- Retention: gün + adet sınırı, yalnızca dosya silme, güvenlik çiti.
- Bozuk satır toleransı (okuma tarafı, oturum içi sayaç → `/api/health.corrupt_lines`).
- **N1** — `tests/e2e/shell.spec.ts` tema assert'inin kök kaba genişletilmesi.
- **N4** — `npm run dev` port çakışmasında tümüyle ve gürültülü ölmesi + `/api/health`'e
  `instance_id`/`service` alanları eklenmesi.
- **Host/Origin koruması (ADR-008 karar 1, KAPANDI — tur 2'de eklendi).** `/api/health` ve
  `/api/events` (GET+POST) üzerinde loopback `Host` beyaz listesi; `POST /api/events` üzerinde
  ayrıca cross-origin `Origin` reddi. Ayrıntı §3 madde 11, API davranışı §4.2a, test §5 AC-8,
  mutasyon §7 madde 7. Kapsam ADR-008'in çizdiği minimumla sınırlı: auth/token/CORS ince ayarı
  **yok**.

**Dışında (bu feature'da KESİNLİKLE yapılmayacak):**
- SSE (`GET /api/stream`), canlı zaman çizelgesi UI, `useEventStream` → **F-003**.
- Tam filtre seti (`type`, `agent`, `session_id`, `before_seq`, `q`, `project_id`) → ilgili
  tüketici feature'ı (F-003/F-005).
- `send-event.js` hook scripti, `install-hook` → **F-004**.
- Proje kayıt defteri (`projects.json`, `ProjectRecord`, `POST/GET/PATCH/DELETE /api/projects`)
  → **F-005**. `project_id` alanı `EventRecord`'da **var** (mimari §5.1) ama bu feature'da
  hiçbir zaman doldurulmaz (kayıt defteri yok); her zaman `undefined`/boş kalır. Bu bilinçli
  bir eksiklik, hata değil.
- Yazma kapısı (`write-gate.ts`) → **F-006**. `POST /api/events` yazma kapısını hiç
  kullanmaz (mimari §6.1: "yazma kapısıyla ilgisi yok, yalnızca `MC_DATA_DIR` altına yazar").
- Herhangi bir UI ekranı/bileşeni (`src/web/**`'e dokunulmaz — N1 hariç, o da yalnızca bir
  E2E test dosyasıdır, üretim kodu değil).
- Auth, token, CORS preflight ince ayarı (ADR-008: "Kimlik doğrulama, token, CORS preflight
  ince ayarı bu ADR'nin dışındadır") — yalnızca loopback `Host` + cross-origin `Origin` reddi
  yazılır, başka hiçbir erişim kontrolü katmanı eklenmez.
- Gün dosyası 50 MB rotasyonu (`YYYY-MM-DD.1.jsonl`, mimari §5.5) — **ADR-008 karar 2 ile
  KAPANDI** (ertelendi). Gerekçe ve devralınan koşul (dosya adının tek fonksiyondan üretilmesi)
  §3 madde 6'da.
- `src/features/events/web/**` (zaman çizelgesi bileşenleri) — F-003.

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni dosyalar

| Dosya | Amaç |
|---|---|
| `src/shared/types.ts` | `EventRecord`, `ApiResponse<T>`, `ErrorCode` (yalnızca F-002'nin kullandığı alt küme; `ProjectRecord`/`FeatureCard`/`GateState` bu feature'da eklenmez). |
| `src/server/store/jsonl-store.ts` | Append (sıralı kuyruk), `seq` çözümleme/dayanıklılık, günlük dosya seçimi (`dayFileName(date)` — ADR-008 karar 2 koşulu, tek fonksiyon, append/okuma/retention'ın hepsi bunu çağırır), açılışta ring buffer yükleme, bozuk satır sayacı, gün dosyası başına satır sayımı (§3 madde 2), `since_seq`/`limit` okuma. |
| `src/server/store/retention.ts` | Gün + adet budama, güvenlik çiti — dışa aktarılmış saf yüklem `isInsideDataRoot(root, target)` (realpath + `path.relative` kapsama kontrolü, §3 madde 3), zamanlayıcı (açılış + saatte bir). |
| `src/features/events/server/normalize.ts` | Ham payload → `EventRecord` alan çıkarımı, `flags` politikası, `summary` türetme tablosu, `raw` kırpma. |
| `src/features/events/server/ingest.ts` | `POST /api/events` işleyicisi: gövde okuma (256 KB üst sınır, akış hâlinde kesme), JSON parse toleransı, normalize + store çağrısı, yanıt zarfı. |
| `src/features/events/server/query.ts` | `GET /api/events` işleyicisi: `since_seq`/`limit` ayrıştırma + doğrulama, store'dan okuma, yanıt zarfı. |
| `scripts/check-ports.mjs` | N4 katman (a): `npm run dev`'in `predev` adımı — `MC_PORT`/`MC_WEB_PORT` dolu ise gürültülü Türkçe hata + `exit(1)`. |
| `tests/features/events/server/normalize.test.ts` | Normalizer birim testleri (AC-2, AC-3). |
| `tests/features/events/server/query.test.ts` | `since_seq`/`limit` ayrıştırma birim testleri. |
| `tests/server/store/jsonl-store.test.ts` | Append/okuma/ring buffer/seq dayanıklılık/bozuk satır birim testleri. |
| `tests/server/store/retention.test.ts` | Retention algoritması + güvenlik çiti testleri (AC-6). |
| `tests/integration/events-api.test.ts` | Gerçek `node:http` + gerçek geçici `MC_DATA_DIR` ile uçtan uca: POST→GET, restart-reload (AC-5), eşzamanlılık (AC-7), yük testi (AC-4). |
| `tests/scripts/check-ports.test.ts` | N4: `check-ports.mjs`'i gerçek dolu bir portla çocuk süreç olarak çalıştırır. |
| `tests/helpers/temp-data-dir.ts` | Her testin kendi geçici `MC_DATA_DIR`'ini kurup temizlemesi için paylaşılan yardımcı (mimari §4 `tests/helpers/` konumuyla uyumlu). |
| `tests/e2e/dev-port-conflict.spec.ts` | **Yazılmayacak** (bkz. §6.2 gerekçe) — burada listelenmemesi bilinçlidir, karışıklığı önlemek için not düşüldü. |

### 2.2 Değişecek dosyalar

| Dosya | Değişiklik | Gerekçe / F-001 dosyasına dokunuş izni |
|---|---|---|
| `src/server/index.ts` | (a) `POST/GET /api/events` route'ları `features/events/server/{ingest,query}.ts`'e devredilir — mevcut `if (pathname === '/api/health')` zincirine iki dal eklenir, ayrı bir router dosyasına **çıkarılmaz** (bkz. §3 madde 1). (b) `handleHealth` yanıtına `instance_id` (süreç başında `crypto.randomUUID()`), `service: 'mission-control'` ve `corrupt_lines` eklenir (N4 katman b + §5 corrupt_lines kanıtı). (c) Açılışta `store` ve `retention` başlatılır (`mkdir -p data/events`, ring buffer yükle, retention zamanlayıcısını kur). (d) `isAllowedHost(hostHeader, port, webPort)` ve `isAllowedOrigin(originHeader, port, webPort)` saf fonksiyonları eklenir ve istek işleyicisinin başında `/api/*` yolları için çağrılır (§3 madde 11, §4.2a). (e) **`createServer` imzası `createServer(port, dataDir?)` olur** — ikinci parametre verilmezse `process.env.MC_DATA_DIR` (veya varsayılan `./data`) kullanılır; bu, AC-5'in sunucu-seviyeli yeniden başlatma testinin (§3 madde 9) aynı `dataDir`'e karşı iki ayrı sunucu örneği kurabilmesi için gerekli. | Bu dosya F-001'in ürünüdür ama her feature'ın bootstrap'ı buradan geçer — F-001 sözleşmesi de bunu öngörmüştü ("F-001'in ilk işi" notları F-002'ye devrediliyordu, bkz. F-001 sözleşmesi §1 "data/ klasörünün oluşturulması F-002'nin ilk adımı"). Değişiklik yalnızca wiring'dir, mevcut `/api/health`/statik servis/port mantığı **davranış olarak** değişmez (yalnızca health'e üç alan eklenir, Host/Origin kontrolü yalnızca `/api/*`'ye uygulanır — bkz. §3 madde 11 kapsam notu). `createServer`'ın ikinci parametreyi opsiyonel almasıyla `tests/server/health.test.ts`'teki mevcut `createServer(0)` çağrıları **değişmeden çalışmaya devam eder**. |
| `package.json` | `scripts.predev`: `"node scripts/check-ports.mjs"` eklenir (npm bunu `dev`'den önce otomatik çalıştırır — ek araç gerekmez). `scripts.dev`: `concurrently --kill-others-on-fail "npm:dev:server" "npm:dev:web"` (bayrak eklenir, N4 katman a ek güvence — bkz. §6.2 dürüst sınırlama notu). Yeni bağımlılık **yok** (`crypto`, `node:net` yerleşik). | N4 borcu feature notunda F-002'ye açıkça atanmış (`docs/features/F-002-olay-alma-jsonl-depo.md` "F-001'den taşınan borçlar"). Script listesi dışında hiçbir alan değişmez. |
| `tests/server/health.test.ts` | (a) `GET /api/health` testine `typeof body.instance_id === 'string'`, `body.service === 'mission-control'` ve `typeof body.corrupt_lines === 'number'` assert'leri eklenir. (b) Yeni `describe('isAllowedHost/isAllowedOrigin')` bloğu: saf fonksiyonlar tablo testiyle (geçerli `127.0.0.1:<port>`/`localhost:<port>`, geçersiz yabancı host, eksik/yabancı `Origin`) doğrulanır. (c) Yeni `it`'ler: `createServer(0)`'a sahte `Host: evil.com` başlığıyla `/api/health` isteği → `403 forbidden_origin`; geçerli `Host` ile → `200` (regresyon, mevcut testler bozulmaz). | N4 katman (b)'nin ve Host/Origin korumasının (§3 madde 11, AC-8) doğrudan kanıtı; dosya zaten F-001'in test dosyası, genişletiliyor. |
| `tests/e2e/shell.spec.ts` | Renk/koyuluk bloğu genişletilir: `document.body` ölçümüne ek olarak `#root > div` (App'in kök kabı) aynı teknikle ölçülür ve aynı token'a eşit olduğu + luminance eşiği doğrulanır. **`src/web/App.tsx`'e dokunulmaz** — `#root`, Vite'ın `index.html`'inde zaten var (`src/web/index.html:10`), App'in tek kök elemanı `#root`'un tek çocuğu olduğu için `data-testid` eklemeden yapısal seçici (`#root > div`) yeterli (doğrulandı: `src/web/main.tsx` + `App.tsx` okunarak). | N1 borcu feature notunda F-002'ye açıkça atanmış. Yalnızca test dosyası değişir, üretim kodu (`src/web/**`) F-002'nin dosya sahipliği dışında kalır. |
| `tests/e2e/dev-shell.spec.ts` | Mevcut testte zaten okunan `proxied` (7434 üzerinden) ve `direct` (7433'e doğrudan) `/api/health` yanıtları JSON'a çevrilir ve **`proxied.instance_id === direct.instance_id`** assert edilir (ayrıca ikisinin de `service === 'mission-control'` döndürdüğü) — N4'ün asıl ölçmek istediği şey kimlik **eşitliğidir**, alan varlığı değil (bkz. §6.2, Bulgu 9). | Aynı dosya zaten F-001'in; davranış değişmiyor, yalnızca zaten yapılan iki isteğin gövdesi karşılaştırılıyor. |

**Not — dokunulmayan ama incelenen dosyalar:** `vite.config.ts`, `playwright.config.ts`,
`playwright.dev.config.ts`, `tsconfig.json`, `vitest.config.ts` okundu, hiçbiri değişmiyor.
`vitest.config.ts`'in `include: ['tests/**/*.test.ts?(x)']` deseni yeni alt klasörleri
(`tests/features/**`, `tests/server/store/**`, `tests/integration/**`, `tests/scripts/**`)
otomatik kapsar — doğrulandı (dosya okunarak), config değişikliği gerekmiyor.

---

## 3. Tasarım kararları

### 1) Dosya sahipliği çelişkisi

Feature notu `src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts`
diyor; mimari §4 hedef ağacı ayrıca `src/server/http/` (router, gövde okuma, Host/Origin)
gösteriyor. **Karar: `src/server/http/` bu feature'da açılmıyor.** Gerekçe:
- Mimari kendisi bunu bir *hedef durum* olarak sunuyor ("Fonksiyon imzaları... developer'ın
  kararıdır", mimari giriş paragrafı) ve F-001 sözleşmesi zaten emsal koydu: "`/api/health`
  router'ı ayrı bir `http/router.ts` gerektirmeyecek kadar küçüktür... sonraki feature'lar
  router'ı ayrı dosyaya çıkarabilir" (F-001 sözleşmesi §2 not). F-002 iki route ekliyor
  (toplam 4 dal); bu, `index.ts`'i mimari §3.2'nin kendi eşiğinin (120 satır yönlendirme)
  yakınına bile getirmiyor.
- Feature notunun **bağlayıcı** dosya sahipliği listesi `src/server/http/**` içermiyor;
  Karpathy §3 "yalnızca görevle ilgili dosyalara dokun" ilkesiyle en tutarlı yorum, listede
  olmayan yeni bir klasör **açmamak**.
- Host/Origin koruması (ADR-008 karar 1 ile bu turda kapsama girdi, madde 11) `http/`'yi açmayı
  gerektirmiyor: kontrol iki saf fonksiyon (`isAllowedHost`, `isAllowedOrigin`) + `index.ts`'in
  istek işleyicisinin başında üç satırlık bir çağrı; bunun için ayrı bir router/middleware
  katmanı kurmak YAGNI olurdu. `index.ts` toplamda hâlâ mimari §3.2'nin 120 satır yönlendirme
  eşiğinin uzağında kalıyor.
- Sonuç: gövde okuma `ingest.ts` içinde kalır (tek çağıran var, paylaşılan soyutlama şimdilik
  gereksiz — YAGNI); route dispatch `index.ts`'te kalır, yalnızca `features/events/server/*`
  fonksiyonlarını çağıran ince bir kabuk olarak.

`src/server/store/**` ve `src/shared/types.ts` feature notu ile mimari arasında zaten
**çelişmiyor** — ikisi de aynı klasörleri gösteriyor, doğrudan uygulanıyor.

### 2) Retention algoritması

Sıra ve birleşim (mimari §5.5 + ADR-001 karar 4'ün somutlaştırılması):
1. **Aktif (bugünün) gün dosyası hiçbir koşulda silinmez** — o an append edilen dosyadır;
   silinmesi veri kaybı değil veri **bozulması** (yazma sırasında dosyanın altının çekilmesi)
   anlamına gelir. Bu, sorunun "en yeni gün dosyası asla silinmemeli mi" kısmına net cevaptır:
   **evet, asla.**
2. **Gün bazlı budama önce çalışır:** `data/events/` dizini listelenir, dosya adları
   `YYYY-MM-DD.jsonl` desenine göre ayıklanır (adlar sözlük sırasına göre zaten kronolojik
   sıralanır, ayrı bir tarih ayrıştırma/karşılaştırma gerekmez). Bugünün UTC tarihinden
   `MC_RETENTION_DAYS` çıkarılıp bu tarihten **eski** (küçük) dosya adları silinir.
3. **Adet bazlı budama sonra çalışır:** toplam satır sayısı `MC_RETENTION_EVENTS`'i aşıyorsa,
   en eski gün dosyasından başlanarak (aktif gün dosyası hariç) dosyalar tek tek silinir; her
   silmeden sonra toplam yeniden hesaplanır (bellekteki sayaçtan, disk taraması değil — aşağı
   bakınız), toplam sınırın altına inince veya yalnızca aktif dosya kalınca durulur.
4. **Satır sayısını ucuz tutma (tur 2 düzeltmesi — Bulgu 4):** her gün dosyasının satır sayısı
   bellekte bir `Map<string /* YYYY-MM-DD */, number>` içinde tutulur. **Bu harita ring buffer
   yüklemesinden bağımsız, ayrı bir geçişte doldurulur** — ring buffer taraması `MC_RING_SIZE`
   olaya ulaşınca durur (mimari §5.5: "…toplanana kadar") ve bu noktadan sonraki gün
   dosyalarını hiç açmaz; satır sayısı haritası bu yüzden ring taramasına **binemez**. Açılışta,
   gün bazlı budamadan **hemen sonra** kalan her gün dosyası için ayrı, ucuz bir geçiş yapılır:
   dosya `fs.readFileSync(file, 'utf8')` ile okunur (JSON.parse **yok**, yalnızca `\n` sayımı —
   `content.split('\n').filter(Boolean).length` veya eşdeğeri bayt sayımı), sonuç haritaya
   yazılır. Bu geçiş dosya içeriğini JSON'a çevirmediği için ring buffer'ın JSON-parse eden
   taramasından ucuzdur ve tipik ≤31 gün dosyasında önemsiz maliyetlidir. Harita her başarılı
   append'te aktif günün sayacına `+1` ile güncellenir; retention çalıştığında
   `Array.from(map.values()).reduce(sum)` ile toplam O(gün sayısı) sürede hesaplanır.
   **Kanıt testi:** `tests/server/store/retention.test.ts` içinde `MC_RING_SIZE` fixture'ın
   **altında** ayarlanır (ör. ring=5, 3 gün dosyası × 5 olay = toplam 15, `MC_RETENTION_EVENTS`
   = 10) — düzeltilmemiş (yalnızca ring taramasından sayan) kod toplamı 5 sanır ve hiç
   budamaz; düzeltilmiş kod toplamı 15 görür ve en eski dosyaları eşiğin altına inene kadar
   siler. Bu fixture, Bulgu 4'ün orijinal sözleşmesinin "küçük fixture'da ring hiç dolmaz"
   eleştirisini doğrudan hedefler.
5. Neden bu sıra (gün önce, adet sonra) ve neden tersi değil: gün bazlı silme adet haritasını
   zaten güncelliyor (silinen dosyanın satırları toplamdan düşüyor), bu yüzden adet kontrolü
   ikinci adımda güncel veriyle çalışıyor. Tersi sırada (önce adet) gereksiz yere gün dosyası
   silinebilir ve sonra gün kontrolü zaten silinmiş bir dosyayı tekrar aramaya çalışırdı —
   işlevsel fark yok ama gereksiz karmaşıklık.
6. Zamanlama: açılışta bir kez + `setInterval` ile saatte bir (mimari §5.5). `setInterval`
   `unref()` edilir ki testlerde/`npm start`'ın kapanışında süreç asılı kalmasın.

### 3) Retention güvenlik çiti (tur 2 düzeltmesi — Bulgu 3)

- Başlangıçta bir kez `const dataRoot = fs.realpathSync(MC_DATA_DIR)` çözülür (dizin yoksa
  önce `mkdirSync(recursive:true)` ile oluşturulur, sonra realpath alınır).
- Silinecek her dosya adı **yalnızca** `fs.readdirSync(path.join(dataRoot,'events'))`
  çıktısından gelir (kullanıcı/istemci girdisi asla yol kurmaz) ve silinmeden **önce**
  `^\d{4}-\d{2}-\d{2}(\.\d+)?\.jsonl$` desenine karşı doğrulanır (savunma katmanı — normalde
  sunucu kendi ürettiği adları görür, ama bu ucuz bir ek kontrol).
- Hedef yol `path.join(dataRoot, 'events', fileName)` ile kurulur (dizge birleştirme/`+`
  **yok**, S6 uyumlu).
- **Kapsama kontrolü dışa aktarılmış, saf bir yüklem olarak yazılır:**
  `export function isInsideDataRoot(root: string, target: string): boolean` —
  `fs.realpathSync(target)` (hedef var olmalı) alınır, `path.relative(root, resolved)` boşsa
  ya da `..` ile başlıyorsa ya da `path.isAbsolute(...)` ise `false` döner (mimari §3.6'daki
  write-gate deseniyle birebir aynı teknik); dizge önek karşılaştırması (`startsWith`) **hiçbir
  yerde kullanılmaz**. `root` da fonksiyona çağrılmadan önce `realpathSync` ile çözülmüş
  gelir. Silme öncesi retention bu fonksiyonu **her dosya için ayrı ayrı** çağırır (TOCTOU'ya
  karşı, açılışta bir kez değil).
- **Kanıt testi — platform bağımsız, ana kanıt (`tests/server/store/retention.test.ts` ›
  `describe('isInsideDataRoot')`):** gerçek geçici dizinlerle (symlink **gerekmez**, yalnızca
  `fs.mkdtempSync` + `fs.mkdirSync`/`fs.writeFileSync` ile üretilmiş gerçek dosya/dizinler)
  tablo testi:
  1. hedef `root`'un gerçek bir alt dosyası → `true`.
  2. hedef, mutlak yolla verilmiş tamamen ayrı bir gerçek dizindeki dosya → `false`.
  3. **kardeş önek tuzağı (asıl mutasyon kırıcı):** `root = mkdtempSync(...,'mc-root-')`,
     `sibling = root + '-sibling'` (gerçek, ayrı bir dizin, içinde gerçek bir `victim.jsonl`
     dosyası) → `isInsideDataRoot(root, sibling/victim.jsonl)` **`false`** olmalı. `target.
     startsWith(root)` mutasyonuyla bu dizge önek eşleşmesi nedeniyle yanlışlıkla `true` döner
     — bu senaryo §7 madde 3 mutasyonunu **kesin** kırmızı verir.
  4. `..` ile çıkış (`path.join(root, 'events', '..', '..', 'evil.jsonl')` gerçek bir dosyaya
     çözülüyorsa) → `false`.
  5. Windows'ta karışık ayraç (`/` ve `\` karışık) ve büyük/küçük harf farkıyla verilen ama
     gerçekte `root` altında olan bir hedef → `true` (yanlış negatif üretmediğini kanıtlar).
  Bu test hiçbir admin izni gerektirmez, her platformda koşar ve GEÇTİ kararına **tam olarak**
  katkı sayılır (Windows sembolik link kısıtına bağımlı değildir).
- **Ek, opsiyonel kanıt (GEÇTİ kararına katkı saymaz):** `data/events/` içine `MC_DATA_DIR`
  dışındaki bir "kurban" dizine işaret eden gerçek bir sembolik link yerleştirilir (Windows'ta
  `fs.symlinkSync(target, link, 'file')`; yönetici izni gerekirse `test.skip` ile **açıkça**
  atlanır — bu skip AC-6'nın GEÇTİ kararını **etkilemez**, çünkü asıl kanıt yukarıdaki tablo
  testidir). Kurban dosyanın silinmeden kaldığı assert edilir.
- Dosya adı deseni dışı bir ad verilirse (`readdir` gerçekte böyle bir ad döndürmese de,
  fonksiyon doğrudan sahte bir liste ile birim test edilerek) silme atlanır (ayrı, küçük bir
  test — kapsama kontrolünden bağımsız savunma katmanı).

### 4) Seq dayanıklılığı

- **JSONL kazanır, `.seq` yalnızca hızlandırma katmanıdır.** Açılışta:
  1. En yeni gün dosyası bulunur (yoksa `nextSeq = 0`'dan başlanır — ilk çalıştırma).
  2. Dosyanın sonundan geriye doğru, satır satır (bellekte tüm dosyayı okumadan; dosya
     `MC_RING_SIZE` yükleme geçişinde zaten okunuyorsa o taramadan elde edilir) ilk **geçerli**
     JSON satırı bulunur (son satır çökme sırasında yarım kalmış olabilir — o satır atlanır,
     bir öncekine bakılır); o satırın `seq` değeri `fileSeq` olur. Hiç geçerli satır yoksa
     (dosya bomboş/tamamen bozuk) bir önceki güne bakılmaz — `fileSeq = -1` kabul edilir (yeni
     günün seq'i eski günden devam eder, dosyanın kendisi değil).
  3. `.seq` dosyası okunur (varsa) → `fileFromDotSeq` (sayı ayrıştırılamazsa yok sayılır).
  4. `nextSeq = Math.max(fileSeq, fileFromDotSeq ?? -1) + 1` — **iki kaynağın maksimumu**,
     hiçbir zaman geriye gitmez (`.seq` bozuksa/eskiyse JSONL kazanır; JSONL'in son satırı
     bozuksa ve `.seq` ondan ileriyse `.seq` kazanır — böylece hiçbir durumda bir `seq` iki kez
     verilmez).
  5. Çözülen `nextSeq` **hemen** `.seq` dosyasına (senkron, `fs.writeFileSync`, küçük dosya,
     `fsync` gerekmez çünkü sonraki her append zaten kendi güncellemesini yapacak) yazılır —
     böylece bir sonraki çökme bu turun ilerlemesini kaybetmez.
- **Çalışma sırasında:** her `append(event)` çağrısı senkron olarak `seq = nextSeq++` atar
  (JS tek iş parçacıklı olduğu için `await` öncesi bu satır güvenlidir, iki çağrı arasında
  kesinti olamaz), sonra event'i yazma kuyruğuna ekler (madde 7). `.seq` dosyası her append'te
  **best-effort** (fire-and-forget, `fsync` yok) güncellenir; bu yazının kaybolması sorun
  değildir çünkü açılıştaki JSONL taraması zaten doğru değeri bulur — `.seq` yalnızca "açılışta
  tüm dosyayı taramak yerine hızlı yol" sağlar, tek doğruluk kaynağı değildir.
- **Tekrarlanan seq önleme:** madde 4'teki `Math.max` + adım 5'teki anında yazma, "çökme →
  yeniden başlama → aynı seq'in iki kez verilmesi" senaryosunu kapatır: her yeniden başlamada
  `nextSeq` en az "şimdiye kadar görülen en yüksek seq + 1" olur.

### 5) Bozuk satır / kısmi yazım

- Okuma tarafında (açılış yüklemesi, retention'ın satır sayımı, olası ileri-taramalar) her
  satır ayrı `try/catch` ile `JSON.parse` edilir; başarısız olan atlanır.
- Sayaç **yalnızca bellekte**, süreç ömrü boyunca (mimari §5.5: "sayaç `data/events/
  .corrupt-count` yerine yalnızca log + `/api/health` alanı") — her yeniden başlatmada 0'a
  döner, diske yazılmaz, ayrı bir dosya **yok**.
- `/api/health` yanıtına `corrupt_lines: number` eklenir (F-001'in health şeması `{ok, version,
  port, node, uptime_s}`'e additive; mimari §6.6 zaten bu alanı health şemasının bir parçası
  sayıyor). Bu, F-001 sözleşmesinin "kalan alanlar ilgili feature'da eklenecek" notuyla
  uyumludur.
- Sunucu logu (`process.stderr`/`console.error` değil — proje genelinde `console.log` yasak
  değil ama gürültü istenmiyor; tek satırlık Türkçe uyarı `process.stderr.write` ile, F-001'in
  `resolvePort` deseniyle tutarlı) her bozuk satırda **değil**, yalnızca dosya bazında bir kez
  ("N.jsonl: K bozuk satır atlandı") yazılır — satır başına log akışı gürültüyü artırır.
- **Kanıt testi (tur 2 düzeltmesi — Bulgu 12):** `tests/server/store/jsonl-store.test.ts`
  içinde, içinde bilerek bozuk satır(lar) bulunan bir gün dosyası fixture'ı hazırlanır (ör. 8
  geçerli JSON satırı + 2 bozuk satır); store `init()` sonrası `corrupt_lines` sayacının `2`
  olduğu assert edilir. Aynı sayı `tests/server/health.test.ts`'in `handleHealth` testine
  eklenen bir senaryoda **uçtan uca** doğrulanır: aynı bozuk-satır fixture'ıyla `createServer`
  kurulur, `GET /api/health` yanıtındaki `corrupt_lines` alanı aynı sayıya eşit olur.

### 6) Boyut sınırları

- **İstek gövdesi üst sınırı: 256 KB, sabit (env ile değiştirilemez, mimari §6.1'in kendi
  literal değeri).** Aşılırsa: akış hâlinde sayılan bayt 262144'ü geçtiği an istek **hemen**
  kesilir (`req.destroy()`), gövdenin tamamı beklenmez; yanıt `400 { success:false, error:
  {code:'invalid_body', message:'İstek gövdesi çok büyük.'} }`. **Olay hiç kaydedilmez** —
  mimari bunu açıkça 400 olarak tanımlıyor, bu tek istisna PRD F1/AC5'in "5xx dönmez" kuralına
  aykırı değildir çünkü 400 bir 4xx'tir (istemci hatası), 5xx değildir.
- **`raw` alanı üst sınırı: `MC_MAX_PAYLOAD` (vars. 65536 bayt), env ile ayarlanabilir.** Bu,
  256 KB'lık sert sınırın **altında** kalan ama yine de "büyük" sayılan olaylar için: normalize
  adımı, `JSON.stringify(payload).length > MC_MAX_PAYLOAD` ise `raw = {truncated:true,
  byte_length, keys:[...]}` yazar ve `raw_truncated` bayrağını ekler; **olay yine 202 ile
  kaydedilir** (mimari §5.1). İki sınır birbirinden bağımsızdır: biri sert red (400), diğeri
  yumuşak kırpma (202 + bayrak).
- **Gün dosyası 50 MB rotasyonu: bu feature'da YOK — ADR-008 karar 2 ile KAPANDI.** Gerekçe:
  (a) feature notunun kabul kriterlerinde yok, (b) mimari kendisi bunu "tek kullanıcıda
  beklenmiyor, güvenlik supabı" olarak nitelendiriyor — yani bir garanti değil, ihtiyaç
  doğarsa eklenecek bir gelecek işi, (c) retention zaten toplam hacmi (~60 MB, 20.000 olay ×
  ~3 KB) sınırlıyor; tek bir günde 50 MB'a ulaşmak yalnızca aşırı bir patlama senaryosunda
  olur ve bu senaryoda bile veri **kaybolmaz**, yalnızca tek dosya büyük kalır. (d) Karpathy
  §2 "ileride lazım olur" kodu yasağıyla doğrudan çakışırdı: hiçbir AC bunu ölçmüyor.
  **ADR-008'in koşulu:** gün dosyası adı **tek bir fonksiyondan** üretilir —
  `dayFileName(date: Date): string` (`src/server/store/jsonl-store.ts`), append/açılış
  yüklemesi/retention'ın hepsi bu fonksiyonu çağırır; ileride rotasyon eklenirse yalnızca bu
  fonksiyon değişir, çağıran taraflar değişmez. Bu bir soyutlama katmanı değildir, tek bir
  saf fonksiyondur. Yeniden açılma tetikleyicisi (ADR-008): `MC_RETENTION_EVENTS` 20.000'in
  belirgin üstüne çıkarılırsa veya bir gün dosyası pratikte 50 MB'ı aşarsa.

### 7) Eşzamanlılık kanıtı

- Node'un `fs.appendFile`'ı **kendiliğinden sıraya girmez** — her çağrı bağımsız açar/yazar/
  kapatır; mimari §5.5'teki "Node aynı süreç içinde append çağrılarını sıraya koyar" iddiası
  kodda **açıkça garanti edilmediği** için (? INFERRED → doğrulanacak varsayım, güvenilmemeli),
  bu sözleşme kendi garantisini kod ile kurar: `jsonl-store.ts` içinde bir **yazma kuyruğu**
  (`let queue: Promise<void> = Promise.resolve()`) tutulur; her `append(event)` çağrısı
  `queue = queue.then(() => fs.promises.appendFile(file, line))` ile zincire eklenir ve
  döndürdüğü promise'i bekler. Bu, JS'in tek iş parçacıklı doğası sayesinde çağrı sırasını
  **kesin olarak** disk yazma sırasına eşler — OS seviyesinde `O_APPEND`'in atomikliğine
  güvenmek yerine, uygulama seviyesinde hiçbir zaman iki eşzamanlı `appendFile` çağrısı aynı
  anda uçuşta olmaz.
- `seq` ataması (madde 4) kuyruğa girmeden **önce**, senkron olarak yapılır — böylece kuyruktaki
  sıra ile `seq` sırası her zaman birebir örtüşür (kuyruğa girme sırası = `seq` artış sırası).
- Kanıt testi (`tests/integration/events-api.test.ts`): gerçek bir sunucuya (efemeral port)
  `Promise.all` ile N (ör. 300) eşzamanlı `POST /api/events` gönderilir; test sonunda gün
  dosyası okunur ve (a) tam olarak N satır olduğu, (b) her satırın geçerli JSON olduğu
  (`JSON.parse` hiçbirinde throw etmiyor — "satır bozulması yok" kanıtı), (c) `seq`
  değerlerinin `[start..start+N-1]` aralığında, tekrarsız ve **dosyadaki satır sırasıyla
  birebir artan** olduğu assert edilir.

### 8) AC4 yük testi (tur 2 düzeltmesi — Bulgu 2)

- Gerçek zamanda 1 dakika beklenmez. Bunun yerine **50/dk'nın çok üzerinde bir patlama**
  gönderilir: 500 olay, mümkün olan en kısa sürede (art arda `Promise.all` ile eşzamanlı POST,
  hız sınırlama yok). Gerekçe: sistemin saniyeler içinde 500 eşzamanlı isteği kayıpsız ve
  sırayla işleyebildiğini kanıtlamak, "50/dk" gibi çok daha düşük bir sürekli hızı işleyebildiğini
  kanıtlamaktan **daha sıkı** bir testtir.
- **Kanıt kaynağı artık ring buffer/`GET /api/events` DEĞİL, günün JSONL dosyasının fiziksel
  satır sırasıdır** (eski tasarımın totoloji hatası: kaynak ring buffer olduğu için dizi zaten
  `seq` artan sırada dolar, yazma sırası bozulsa bile yeşil kalırdı — bkz. Bulgu 2). Yeni test
  adımları:
  1. 500 eşzamanlı `POST /api/events` gönderilir; **her birinin** HTTP yanıt durumu toplanır.
  2. **Beklenti tam (%100), tolerans yok:** 500 yanıtın **tamamı** `202` olmalı — mimari zaten
     "asla 5xx" ve tasarımdaki tek yazma kuyruğu (madde 7) hiçbir isteği reddetmediği/kaybetmediği
     için gerçek beklenti budur; AC metnindeki "%99" PRD'nin verdiği **alt sınır**dır, sözleşme
     bunun üstünde bir taahhüt veriyor ve testi buna göre yazıyor (aşağıdaki adım 4 gerçek
     eşiktir).
  3. Test, günün `.jsonl` dosyasını **doğrudan `fs.readFileSync`** ile okur (GET çağrılmaz),
     satırlara böler ve her satırı `JSON.parse` eder (biri bile throw ederse test başarısız).
  4. `data`ki satır sayısının **tam olarak 500** olduğu ve her satırdan çıkarılan `seq`
     dizisinin — **dosyadaki fiziksel sırayla**, sıralama/`Array.sort` uygulanmadan —
     `[start, start+1, …, start+499]` beklenen diziye `toEqual` ile **birebir** eşit olduğu
     assert edilir. `toEqual` ile tam dizi karşılaştırması, yalnızca "artan mı" kontrolünden
     farklı olarak atlama/tekrar/eksik satırı da yakalar; AC metninin "%99" toleransı burada
     yalnızca PRD'nin izin verdiği bir alt sınırdır, testin kendisi %100 ister.

### 9) AC5 yeniden başlatma testi (başlık düzeltmesi: bu AC-5'tir, AC-6 retention'dır — tur 2)

- **Süreç içi ama sunucu seviyesinde**, gerçek dosya sistemiyle; **çocuk süreç spawn edilmez.**
  Gerekçe (modül seviyesi yerine sunucu seviyesi seçiminin nedeni — Bulgu 6):
  - F-001 emsali tüm vitest testlerini süreç içinde (`createServer(port)` doğrudan çağrılarak)
    yazdı; Playwright'ın kendi `webServer`'ı dışında hiçbir testte `child_process.spawn`
    kullanılmadı. Sunucu seviyesi bu emsali bozmuyor, aynı `createServer` fabrikasını **iki
    kez** çağırıyor.
  - CLAUDE.md'nin kayıtlı dersi: "Uygulamayı çalıştıran agent turları (developer/qa) arkada
    yetim `npm run dev` süreç ağaçları bırakıyor... tur sonunda kontrol et." Windows'ta gerçek
    süreç spawn eden testler, bu ortamda zaten gözlemlenen bir kırılganlık kaynağı; bu riski
    testin kendisine taşımamak daha güvenli — sunucu seviyesi bunu ihlal etmiyor, hâlâ tek
    Node süreci içinde iki `http.Server` örneği kurup kapatıyor.
  - **Bulgu 6'nın düzelttiği eksik:** salt modül seviyesi (iki store örneği) `src/server/
    index.ts`'in bootstrap'ının store'u gerçekten `init()` ettiğini ve yüklenen ring'in
    `GET /api/events`'ten göründüğünü kanıtlamıyordu — wiring hatası (ör. `main()` store'u hiç
    başlatmasa) o testte yeşil kalırdı. Sunucu seviyesi bu boşluğu kapatır.
  - Somut adım: `createServer(port, dataDir)` **aynı** geçici `dataDir`'e karşı **birinci**
    sunucu örneğiyle kurulur (efemeral port), 150 `POST /api/events` gönderilir, sunucu
    `server.close()` ile kapatılır. **İkinci, yeni** bir `createServer(port2, dataDir)` örneği
    (farklı efemeral port, aynı `dataDir`) kurulur; bu örneğe `GET /api/events?limit=1000`
    atılır ve dönen olay sayısının **en az 100** (gerçekte 150) olduğu, `seq` sırasının
    korunduğu (artan, tekrarsız) assert edilir. Çocuk süreç yine spawn edilmiyor — ikisi de
    aynı test sürecinde yaşayan `http.Server` örnekleri.
  - Bu, `createServer`'ın ikinci parametre olarak veri dizinini alması gerektiği anlamına
    gelir (§2.2'ye işlendi); parametre verilmezse mevcut `env.MC_DATA_DIR`/varsayılana düşer,
    böylece F-001'in `createServer(port)` çağrıları (ör. `tests/server/health.test.ts`'in
    mevcut testleri) **değişmeden** çalışmaya devam eder.

### 10) `data/` dizini

- `.gitignore` **zaten** `data/` içeriyor (dosya okunarak doğrulandı, `C:\dev\apps\mission-control\.gitignore`
  satır 6) — bu feature'da `.gitignore`'a **dokunulmayacak**, ek işlem gerekmiyor (✓ VERIFIED,
  ? INFERRED değil).
  Not: `.gitignore`'daki mevcut girdi düz `data/` (kök dizine göre) biçiminde; `MC_DATA_DIR`
  testlerde her zaman `os.tmpdir()` altında bir dizine ayarlanacağı için repo'nun gerçek
  `data/` klasörüyle hiçbir test hiçbir zaman etkileşime girmez.
- Test izolasyonu: `tests/helpers/temp-data-dir.ts` her çağrıda
  `fs.mkdtempSync(path.join(os.tmpdir(), 'mc-events-'))` ile taze bir dizin döndürür; her test
  dosyası `afterEach`/`afterAll` içinde `fs.rmSync(dir, {recursive:true, force:true})` çağırır.
  Hiçbir test `process.env.MC_DATA_DIR`'i kalıcı biçimde global olarak set etmez — store/
  retention fonksiyonları `dataDir` parametresini **açıkça** alır (env okuma yalnızca
  `src/server/index.ts`'in bootstrap'ında, F-001'in `resolvePort` deseniyle tutarlı biçimde
  yapılır); bu, testlerin env değişkeni sızıntısı yaşamadan paralel çalışabilmesini sağlar.
- `data/events/` alt dizini ilk kullanımda `fs.mkdirSync(recursive:true)` ile oluşturulur (F-001
  sözleşmesinin "F-002'nin ilk adımı" notunun karşılığı).

### 11) Host/Origin koruması (ADR-008 karar 1 — tur 2'de kapsama alındı, Bulgu 1)

CEO, developer'ın erteleme önerisini reddetti (ADR-008): `POST /api/events` "ilk yazma ucu"
olduğu için F-001 sözleşmesinin taahhüdü (F-001 §1, satır 39-41) şimdi devreye giriyor. Kapsam
ADR-008'in çizdiği minimumla sınırlı: loopback `Host` beyaz listesi + cross-origin `Origin`
reddi. Auth/token/CORS ince ayarı yok.

**Tasarım (mimari §10'un doğrudan uygulanması, gerekli yerde netleştirilmiş):**

1. **`isAllowedHost(hostHeader: string | undefined, port: number, webPort: number): boolean`**
   — `hostHeader` (`req.headers.host`, küçük harfe çevrilmiş) şu kümede olmalı:
   `{127.0.0.1:<port>, localhost:<port>, 127.0.0.1:<webPort>, localhost:<webPort>}`.
   **Netleştirme (mimari'nin ötesinde, gerekçeli bir uzatma):** mimari §10 yalnızca API portunu
   sayıyor, ama Vite'ın dev proxy'si (`vite.config.ts`, `changeOrigin` **ayarlanmamış**,
   varsayılan `false`) istemcinin özgün `Host` başlığını (`localhost:<webPort>`) **olduğu
   gibi** hedef sunucuya iletir — mimari'nin literal kümesiyle kontrol edilirse proxy üzerinden
   gelen **meşru** `npm run dev` trafiği (`tests/e2e/dev-shell.spec.ts`'in bizzat test ettiği
   akış) yanlışlıkla reddedilirdi. Bu yüzden `webPort` kümeye eklenir — bu, Origin beyaz
   listesinin zaten yaptığı şeyle (mimari §10: "`http://localhost:<MC_WEB_PORT>` kümesinde
   olmalı") simetriktir, yeni bir mekanizma değil, aynı ilkenin Host tarafına taşınmasıdır.
   `hostHeader` eksikse veya kümede değilse `false`.
2. **`isAllowedOrigin(originHeader: string | undefined, port: number, webPort: number):
   boolean`** — `originHeader` **yoksa** `true` (mimari §10: "GET uçları Origin yokluğunu
   kabul eder"; yazma ucunda da eksik `Origin` başlığı tarayıcı-dışı istemcilerde (`curl`,
   hook script'i) normaldir, mimari bunu 403'e bağlamıyor). Varsa şu kümede olmalı:
   `{http://127.0.0.1:<port>, http://localhost:<port>, http://localhost:<webPort>}`.
3. **Uygulama kapsamı:** her iki kontrol de **yalnızca `/api/*` yollarında** çalışır (statik
   dosya servisine uygulanmaz — kapsam daraltması, gerekçe: statik SPA gövdesi gizli veri
   içermez, DNS-rebinding riski API'nin veri/aksiyon uçlarına erişimle ilgilidir; mimari §10'un
   "her istekte" ifadesi bu feature'ın yorumuyla "her API isteğinde" olarak daraltılmıştır).
   - `GET /api/health`, `GET /api/events`: yalnızca `isAllowedHost` kontrol edilir.
   - `POST /api/events`: **hem** `isAllowedHost` **hem** `isAllowedOrigin` kontrol edilir.
   - Reddedilirse: `403 { success:false, error:{ code:'forbidden_origin', message:'İstek
     kaynağı reddedildi.' } }` (mimari §6'nın `ErrorCode`/HTTP eşlemesinde `forbidden_origin` →
     403 zaten tanımlı).
4. Kontroller `createServer`'ın istek işleyicisinin **en başında**, route dispatch'ten önce
   çalışır (yalnızca `/api/` önekli yollar için).

---

## 4. Olay şeması ve API sözleşmesi

Kaynak: mimari §5.1 (EventRecord alanları — burada F-002'nin gerçekten doldurduğu alt küme
listelenir) ve §6.1 (API). Zarf: `ApiResponse<T> = { success, data?, error?, meta? }` (mimari
§6).

### 4.1 `EventRecord` (F-002'nin ürettiği alanlar)

| Alan | Kaynak | Eksikse davranış |
|---|---|---|
| `seq` | sunucu (§3 madde 4) | — (her zaman üretilir) |
| `id` | `` `${seq}-${random6hex}` `` | — |
| `ts` | `new Date().toISOString()` (sunucu alım anı) | — |
| `received_ms` | `Date.now()` | — |
| `project_path` | **öncelik sırası (tur 2 düzeltmesi — Bulgu 13):** (1) gövde `project_path` varsa **olduğu gibi** kullanılır (mimari §6.1: bu alanı `send-event.js`/F-004 zaten `realpath`'leyerek ekler, normalizer'ın tekrar dokunmasına gerek yok); (2) yoksa gövde `cwd` kullanılır ve normalizer `fs.realpathSync(cwd)` dener — başarılıysa sonucu yazar, **path yoksa/erişilemezse `realpathSync` atar, bu durumda ham `cwd` değeri değişmeden korunur** (normalizer asla throw etmez, savunma katmanı); (3) ikisi de yoksa boş dizge. | boş dizge `""` + `missing_fields` (yalnızca hem `project_path` hem `cwd` yoksa) |
| `project_name` | `project_path` (üstteki kuralla çözülmüş) varsa `path.basename(project_path)`, yoksa `""` | (üstteki bayrağa dahil) |
| `project_id` | **hiçbir zaman doldurulmaz** (F-005 yok) | her zaman `undefined` |
| `hook_event_name` | gövde `hook_event_name` | `"unknown"` + `missing_fields` |
| `session_id`,`agent_id`,`agent_type`,`tool_name`,`tool_use_id`,`permission_mode`,`transcript_path`,`prompt_id` | gövdeden aynen | `undefined` (opsiyonel, bayrak **eklenmez** — bunlar zaten `?` alanlar) |
| `summary` | §5.1 türetme tablosu (mimari, aynen uygulanır) | türetilemezse `""` (bayrak eklenmez — bkz. §3 not) |
| `flags` | normalizer çıktısı | `[]` (boş dizi = normal) |
| `raw` | ham payload, `MC_MAX_PAYLOAD`'ı aşarsa kırpılmış obje | JSON parse başarısızsa `{raw_text: <kırpılmış metin>}` |

**Bayrak kümesi (bu feature'da üretilenler):** `missing_fields` (zorunlu-ama-client-kaynaklı
alan eksik: `project_path` veya `hook_event_name`), `raw_truncated`, `parse_error`,
`oversize` (kullanılmıyor — 256 KB aşımı olayı hiç kaydetmiyor, bu yüzden bir bayrak değil 400
üretir; mimari'de adı geçen `oversize` bayrağı bu feature'da **üretilmez**, not olarak
belirtilir). `unknown_event` mimari listesinde var ama F-002'nin normalizer'ı `hook_event_name`
bilinmiyorsa onu olduğu gibi saklar (mimari §5.1: "Bilinmiyorsa 'unknown'" yalnızca alan
**yoksa** geçerli; alan varsa ama tabloda karşılığı yoksa `summary` boş kalır, `flags`'e bir
şey eklenmez) — bu netleştirme F-002'nin kendi kararıdır, mimari örtük bırakmış.

### 4.2 `POST /api/events`

İstek: `Content-Type: application/json`, gövde ≤ 256 KB.

```jsonc
// Geçerli istek (tur 2 düzeltmesi — Bulgu 13: `project_path` alanı §4.1 kuralına uygun
// olarak açıkça gönderiliyor; `cwd`-yalnızca senaryosu normalize.test.ts'te ayrıca test edilir)
{ "hook_event_name": "PreToolUse", "project_path": "C:\\dev\\apps\\demo", "tool_name": "Bash",
  "tool_input": { "command": "npm test" }, "session_id": "s1" }
```
```jsonc
// 202 yanıt
{ "success": true, "data": { "id": "42-a1b2c3", "seq": 42, "flags": [] } }
```
```jsonc
// Eksik alanlı istek → yine 202
{ "tool_name": "Bash" }
```
```jsonc
{ "success": true, "data": { "id": "43-f00baa", "seq": 43, "flags": ["missing_fields"] } }
```
```jsonc
// Gövde JSON değil → yine 202
```
```jsonc
{ "success": true, "data": { "id": "44-9c0d1e", "seq": 44, "flags": ["parse_error"] } }
```
```jsonc
// Gövde > 256 KB → 400, KAYDEDİLMEZ
{ "success": false, "error": { "code": "invalid_body", "message": "İstek gövdesi çok büyük." } }
```

Durum kodları: **202** (kaydedildi, bayraklı olsa da), **400** (`invalid_body`, yalnızca boyut
aşımı), **403** (`forbidden_origin`, aşağıda) — **asla 5xx** (PRD F1/AC5).

### 4.2a Host/Origin reddi (ADR-008 karar 1, §3 madde 11)

```
POST /api/events
Host: evil.com
Content-Type: application/json

{ "hook_event_name": "PreToolUse" }
```
```jsonc
// 403 — Host loopback beyaz listesinde değil, gövde hiç okunmaz/kaydedilmez
{ "success": false, "error": { "code": "forbidden_origin", "message": "İstek kaynağı reddedildi." } }
```
```
POST /api/events
Host: 127.0.0.1:7333
Origin: http://evil.com
Content-Type: application/json

{ "hook_event_name": "PreToolUse", "project_path": "C:\\dev\\apps\\demo" }
```
```jsonc
// 403 — Host geçerli ama Origin cross-origin
{ "success": false, "error": { "code": "forbidden_origin", "message": "İstek kaynağı reddedildi." } }
```

`Origin` başlığı **hiç yoksa** (ör. `curl`, gelecekteki `send-event.js`) ve `Host` geçerliyse
istek normal işlenir — yazma ucu yalnızca *bilinen bir tarayıcı sekmesinin* cross-origin
sızıntısını engeller, başlıksız istemcileri reddetmez (§3 madde 11 madde 2). `GET /api/events`
ve `GET /api/health` yalnızca `Host` ile kontrol edilir, `Origin`'e bakılmaz.

### 4.3 `GET /api/events`

Sorgu: yalnızca `since_seq` (opsiyonel, sayı) ve `limit` (opsiyonel, vars. 200, max 1000).
Başka bir parametre gelirse **sessizce yok sayılır** (400 verilmez — ileride başka feature'lar
aynı uca yeni parametre eklediğinde geriye dönük uyumluluk için).

```
GET /api/events?since_seq=40&limit=50
```
```jsonc
{ "success": true, "data": [ /* EventRecord[], seq artan sırada, seq > 40 */ ],
  "meta": { "total": 2, "next_seq": 44 } }
```

- `total` = `data` dizisinin uzunluğu (limit sonrası, filtre sonrası — F-002'de tek filtre
  `since_seq` olduğu için bu basittir).
- `next_seq` = döndürülen son olayın `seq + 1`; hiç olay dönmediyse `since_seq` aynen geri
  verilir (istemci bir sonraki pollingde aynı noktadan devam eder).
- **Kaynak yalnızca ring buffer'dır (bellek), diske gidilmez.** `since_seq` ring buffer'ın en
  eski tuttuğu seq'ten daha küçükse, ring buffer'ın elindeki en eski olaydan itibaren döner
  (kırpma, hata değil). Ring buffer `MC_RING_SIZE` (vars. 2000) olay tutar ve açılışta diskten
  doldurulur; F-002'nin hiçbir AC'si bunun ötesinde disk-destekli tam geçmiş sorgusu istemiyor
  (bu, F-003'ün SSE `resync` senaryosunda ele alınacak — mimari §6.1 `resync` olayı zaten "istemci
  `/api/events` ile tam yeniden yükleme yapar" diyor ama bu, F-003'ün SSE'siyle birlikte anlamlı;
  F-002 tek başına yalnızca ring buffer'ı sorgulanabilir kılıyor). **Bilinen sınırlama, §8'de
  tekrar not edildi.**

Hata durumları: `since_seq` sayı değilse veya negatifse → `400 invalid_body`. `limit` sayı
değilse/0'dan küçükse/1000'den büyükse → sınıra kırpılır (400 **değil** — okuma ucu daha
toleranslı tutuluyor, mimari bunu açıkça hata olarak tanımlamıyor).

### 4.4 `GET /api/health` (F-002'nin genişlettiği alanlar)

```jsonc
{ "ok": true, "version": "0.1.0", "port": 7333, "node": "v22.9.0", "uptime_s": 12.3,
  "instance_id": "3f6a...(uuid)", "service": "mission-control", "corrupt_lines": 0 }
```

`instance_id`: `crypto.randomUUID()` ile süreç başında **bir kez** üretilir, süreç ömrü
boyunca sabit kalır (yeniden başlatmada değişir — bu istenen davranış, "hangi çalıştırma"yı
ayırt etmek içindir).

---

## 5. Kabul kriteri → test eşlemesi

Numaralandırma `docs/features/F-002-olay-alma-jsonl-depo.md` "Kabul kriterleri" listesinin
sırasıyla aynıdır (7 madde); **AC-8, ADR-008 karar 1'in getirdiği ek kabul kriteridir** (feature
notunun orijinal 7 maddesinde yok, ADR-008 "Sonuçlar" bölümünün açık talebiyle eklendi).

| # | Kabul kriteri (özet) | Kanıtlayan test |
|---|---|---|
| AC-1 | Geçerli olay POST → 2xx + JSONL'e satır yazılır | `tests/integration/events-api.test.ts` › `"POST sonrası satır dosyaya yazılır ve GET ile geri döner"` — POST sonrası günün `.jsonl` dosyası doğrudan `fs.readFileSync` ile okunur, satır sayısı ve içeriği doğrulanır. |
| AC-2 | Eksik/bilinmeyen alan → 5xx yok, "eksik alan" bayrağıyla kaydedilir | `tests/features/events/server/normalize.test.ts` › `"project_path eksikse missing_fields eklenir, olay düşürülmez"`, `"hook_event_name eksikse 'unknown' + missing_fields"`, `"bilinmeyen hook_event_name değeri korunur, flag eklenmez"`. **(Tur 2 düzeltmesi — Bulgu 13)** `"yalnızca cwd verilmişse project_path ondan türetilir, missing_fields eklenmez"`, `"cwd erişilemez bir yolsa ham değer korunur, throw etmez"`. **(Tur 2 düzeltmesi — Bulgu 8)** `tests/integration/events-api.test.ts` › `"patolojik gövdelerde asla 5xx"` — tablo testi: boş gövde, `null`, `[]`, JSON olmayan düz metin, `Content-Type` eksik, `Content-Type: text/plain`, çok derin iç içe nesne (ör. 50 seviye), UTF-8 dışı bayt dizisi, 256 KB sınırının **1 bayt altında** gövde; her biri için ayrı `POST` atılır ve dönen `status`'un `< 500` olduğu assert edilir (tek senaryo değil, evrensel iddiaya uygun çoklu senaryo). |
| AC-3 | `raw` saklanır; şema değişikliği veri kaybettirmez | `tests/features/events/server/normalize.test.ts` › `"bilinmeyen ek alanlar raw içinde korunur"` (tabloda olmayan rastgele bir alan içeren payload verilir, `raw`'da aynen bulunduğu assert edilir), `"MC_MAX_PAYLOAD aşan raw kırpılır ve raw_truncated eklenir"`. **(Tur 2 düzeltmesi — Bulgu 7)** Ayrıca `tests/integration/events-api.test.ts` › `"raw alanı diske yazılıp geri okunurken kaybolmaz"` — tabloda olmayan bir alan (`custom_marker: 'xyz123'`) içeren payload POST edilir; hem **günün `.jsonl` dosyasından `fs.readFileSync` ile okunan satırda** hem de `GET /api/events` yanıtında o alanın `raw.custom_marker === 'xyz123'` olarak birebir bulunduğu assert edilir (yalnızca normalizer çıktısı değil, tam disk round-trip). |
| AC-4 | 50/dk yükte ≥%99 sırayla kaydedilir | `tests/integration/events-api.test.ts` › `"500 eşzamanlı POST — tamamı 202, JSONL fiziksel satır sırası seq ile birebir örtüşür"` (bkz. §3 madde 8, tur 2 düzeltmesi — Bulgu 2: kaynak artık dosya, ring buffer değil). |
| AC-5 | Yeniden başlatmada ≥100 olay geri yüklenir | **(Tur 2 düzeltmesi — Bulgu 6)** `tests/integration/events-api.test.ts` › `"sunucu yeniden başlatılınca en az 100 olay GET /api/events'ten geri döner"` — aynı `dataDir`'e karşı iki ayrı `createServer` örneği (bkz. §3 madde 9); wiring'in (bootstrap store `init()` çağrısı) gerçekten çalıştığını da kanıtlar. |
| AC-6 | Retention yalnızca panelin kendi dosyalarını siler, izlenen projelere dokunmaz | `tests/server/store/retention.test.ts` › `"MC_RETENTION_DAYS aşan gün dosyaları silinir, aktif dosya kalır"`; **(Tur 2 düzeltmesi — Bulgu 4)** `"ring buffer MC_RING_SIZE'ın altında kaldığında bile toplam satır sayısı doğru hesaplanır ve MC_RETENTION_EVENTS tetiklenir"` (bkz. §3 madde 2 alt madde 4); **(Tur 2 düzeltmesi — Bulgu 3)** `describe('isInsideDataRoot')` tablo testi (bkz. §3 madde 3) — **asıl, platform bağımsız kanıt**; `"MC_DATA_DIR dışına symlink edilen hedef silinmez"` yalnızca **opsiyonel ek** (admin izni yoksa `test.skip`, GEÇTİ kararını etkilemez). |
| AC-7 | Eşzamanlı POST'ta satır bozulması olmaz | `tests/integration/events-api.test.ts` › `"300 eşzamanlı POST — her satır geçerli JSON, satır sayısı = istek sayısı"` (bkz. §3 madde 7). Ayrıca `tests/server/store/jsonl-store.test.ts` › `"yazma kuyruğu olmadan (mutasyon) test kırmızı verir"` referansı için bkz. §7. |
| AC-8 | **(Yeni — ADR-008 karar 1, Bulgu 1)** Host/Origin koruması: loopback dışı `Host` veya cross-origin `Origin` içeren istek `403 forbidden_origin` ile reddedilir, olay kaydedilmez | `tests/server/health.test.ts` › `describe('isAllowedHost/isAllowedOrigin')` tablo testi + `"yabancı Host → 403"`; `tests/integration/events-api.test.ts` › `"cross-origin Origin ile POST → 403, olay kaydedilmez"`, `"Origin başlığı yoksa POST normal işlenir"` (bkz. §3 madde 11, §4.2a). |

`corrupt_lines` sayacının test bağlantısı (Bulgu 12) §3 madde 5'te; feature'ın 7 kabul kriteri
listesine dahil değil ama §1 kapsamında olduğu için kanıtlanması zorunlu. N1 ve N4 borçları
ayrı bir tabloda (§6) ele alınıyor; feature notunun kabul kriterleri listesine dahil olmasalar
da "bu feature kapsamına alındı" notuyla bağlayıcıdır.

---

## 6. N1 ve N4 planı

### 6.1 N1 — tema testi kök bileşene kör

| | |
|---|---|
| **Mevcut davranış** | `tests/e2e/shell.spec.ts` (satır 57-78, bugünkü hâliyle okunarak doğrulandı) yalnızca `document.body`'nin `backgroundColor`'ını `--color-zinc-950` token'ıyla piksel bazında karşılaştırıyor. `App.tsx`'in kendi kök `<div className="...bg-zinc-950...">` elemanının zemin rengi **hiç ölçülmüyor**. |
| **Hedef davranış** | Aynı ölçüm tekniği (canvas piksel dönüşümü + luminance) `#root > div` (App'in kök kabı) için de çalıştırılır; ikisi de aynı token'a eşit olmalı. `src/web/App.tsx`'e dokunulmadan, yapısal seçici (`#root > div`) ile — `#root`'un `src/web/index.html:10`'da zaten var olduğu ve `App`'in tek kök elemanı olduğu doğrulandı (`src/web/main.tsx`, `src/web/App.tsx` okunarak). |
| **Test** | `tests/e2e/shell.spec.ts` — mevcut renk bloğu genişletilir, `page.evaluate` içindeki `toRgb`/`getImageData` yardımcı fonksiyonu **iki** hedef için (`document.body`, `document.querySelector('#root > div')`) çağrılır. |
| **Mutasyon kanıtı** | Geçici olarak `App.tsx`'in kök `div`'inin sınıfını `bg-zinc-950` → `bg-zinc-900` yapıp `body`'nin sınıfını **değiştirmeden** bırakırsam: **düzeltmeden önceki** test (yalnızca `body` ölçen) yeşil kalır (kör nokta kanıtlanır); **düzeltmeden sonraki** test (kök kabı da ölçen) kırmızı verir. Bu mutasyon kod turunda uygulanıp geri alınacak, `git diff`'te iz bırakmayacak. |

Panel yüzeyi genişletmesi yapılmıyor çünkü F-002 kapsamında yeni bir UI yüzeyi **yok**
(görev brifi bunu açıkça öngörmüştü: "eğer ölçülecek yeni yüzey yoksa, testi kök kaba
genişletmekle yetin"). F-003 gerçek bir panel yüzeyi (zaman çizelgesi) getirdiğinde bu test
üçüncü bir ölçüm noktasıyla genişletilecek.

### 6.2 N4 — dev sunucusu yabancı sürece proxy'liyor

| | |
|---|---|
| **Mevcut davranış (kendi gözlemim, 2026-09-04)** | 127.0.0.1:7333'ü tutan sahte bir dinleyici açtım, `npm run dev:server` çalıştırdım: `src/server/index.ts:119-126`'daki `EADDRINUSE` dalı Türkçe hata basıp `process.exit(1)` çağırıyor — **ama** `tsx watch` bu çıkışı yutuyor, kendisi asla sonlanmıyor (8 saniyelik gözlemde `timeout` komutuyla zorla öldürülene kadar askıda kaldı, ne yeniden denedi ne çıktı). `npm run dev` (`concurrently`, `--kill-others` **yok**) çalıştırdığımda `dev:web` (Vite) `dev:server` başarısız olsa da normal şekilde ayağa kalktı ve 7334'te dinlemeye başladı; `curl http://127.0.0.1:7333/api/health` sahte sürecin yanıtını (`foreign`) döndürdü — yani Vite'ın `/api` proxy'si gerçekte 7333'ü tutan **yabancı** sürece gidiyor, panel sessizce yanlış backend'e bağlanıyor. Gözlem scripti geçiciydi, silindi; portlar temizlendi. |
| **Hedef davranış** | (a) `npm run dev`, `MC_PORT`/`MC_WEB_PORT` doluysa **hiçbir alt süreç başlamadan** (Vite dahil) gürültülü bir Türkçe hatayla `exit(1)` verir. (b) `/api/health` bir `instance_id` (UUID, süreç başına sabit) + `service: 'mission-control'` döndürür; bu, herhangi bir istemcinin (gelecekteki F-003/F-004 tüketicileri, ya da elle `curl`) yanıtın gerçek Mission Control sürecinden mi geldiğini ayırt etmesini sağlar. |
| **Neden `tsx watch`'ın kendi exit kodunu düzeltmek yerine önden kontrol** | `tsx watch`, dosya değişikliğinde yeniden başlatma (nodemon benzeri) aracıdır ve **tasarım gereği** sarmaladığı sürecin çıkış kodunu üst sürece iletmez — gördüğüm davranış bir hata değil, aracın "çökersen de izlemeye devam et" felsefesinin bir sonucu. Bunu "düzeltmeye" çalışmak (`concurrently --kill-others-on-fail` **tek başına**) işe yaramaz çünkü `tsx watch` süreci kendisi hiç çıkmıyor — `concurrently` "sıfırdan farklı çıkış" olayını hiç görmüyor (bunu da doğruladım: `--kill-others-on-fail` eklense bile bu spesifik senaryoda `dev:server`'ı saran `tsx watch` süreci ölmediği için tetiklenmez). **Daha basit ve sağlam alternatif (benim seçimim):** port kontrolünü `tsx watch` başlamadan **önce**, `predev` npm lifecycle hook'unda ayrı, basit bir script (`scripts/check-ports.mjs`) ile yap. npm bunu `dev`'den önce otomatik çalıştırır (ek araç/bağımlılık gerekmez); script `net.createServer().listen()` ile her iki portu senkron dener, doluysa gürültülü mesaj + `exit(1)` — bu noktada `concurrently` henüz **hiç başlamamıştır**, dolayısıyla Vite'ın da başlamasına gerek kalmaz, yanlış-proxy senaryosu yapısal olarak oluşamaz. `concurrently --kill-others-on-fail` bayrağı yine de eklenir (madde: §2.2) ama bu yalnızca ek bir güvence katmanıdır — asıl kilit `predev` script'idir; sözleşme bunu abartmadan, dürüstçe böyle kaydeder. |
| **Port kaynağı (tur 2 düzeltmesi — Bulgu 10)** | `check-ports.mjs` portları **literal yazmaz**, `src/server/index.ts`'teki `resolvePort` ile **aynı semantikte** `process.env.MC_PORT`'tan çözer (geçersiz/boş → varsayılan 7333) ve `MC_WEB_PORT` için de aynı davranışı uygulayan bir kardeş fonksiyon kullanır (varsayılan 7334). Bu zorunlu: `playwright.dev.config.ts` (satır 9-11) `webServer.command: 'npm run dev'`'i `MC_PORT=7433`/`MC_WEB_PORT=7434` ile çalıştırıyor — yani `predev`, `npm run e2e:dev`'de de tetikleniyor. Portlar literal (7333/7334) yazılsaydı, geliştirici `npm run dev`'i açıkken `npm run e2e:dev` çalıştıramazdı (7333 dolu diye script yanlış pozitif `exit(1)` verirdi, oysa gerçek çakışan port 7433'tür ve boştur). §8 R8 bu iki yolun (`npm run dev`, `npm run e2e:dev`) ikisinin de `predev`'den geçtiğini not eder. |
| **Test** | `tests/scripts/check-ports.test.ts`: gerçek bir `net.Server` ile env'den okunan test portu (`{env:{MC_PORT:<dolu port>}}`, gerçek 7333/7433'e dokunulmaz) tutulur, `child_process.execFileSync('node', ['scripts/check-ports.mjs'], {env:{MC_PORT:<dolu port>}})` çağrılır, **non-zero exit** ve stderr'de Türkçe mesaj beklenir; sonra port serbest bırakılıp aynı script **exit 0** ile biter. Ayrıca `MC_PORT` verilmeden (varsayılan 7333) çalıştırılan bir senaryo, gerçek 7333 boşken script'in 0 ile çıktığını doğrular (varsayılan çözümleme kanıtı). Script kendi başına hiçbir sunucu açık bırakmaz (yalnızca bağlanmayı dener, hemen kapatır) — Windows'ta yetim süreç riski yok. Ayrıca `tests/server/health.test.ts` `instance_id`/`service`/`corrupt_lines` alanlarını, `tests/e2e/dev-shell.spec.ts` (tur 2 düzeltmesi — Bulgu 9) `instance_id` **eşitliğini** doğrular (§2.2, aşağıda). |
| **Mutasyon kanıtı** | `scripts/check-ports.mjs` içinde `EADDRINUSE` dalını geçici olarak "yok say, her zaman 0 ile çık" hâline getirirsem → `tests/scripts/check-ports.test.ts` kırmızı verir (dolu portta script sessizce 0 ile çıkar, test bunu yakalar). Ayrıca `handleHealth`'ten `instance_id` alanını geçici olarak kaldırırsam → `tests/server/health.test.ts` kırmızı verir. |
| **N4 katman (b) kanıtının netleştirilmesi (tur 2 düzeltmesi — Bulgu 9)** | Yalnızca `instance_id` alanının **varlığı**, proxy'nin yabancı bir Mission Control sürecine gitmesi hâlinde de yeşil kalırdı (o süreç de bir `instance_id` döndürür). `tests/e2e/dev-shell.spec.ts` artık zaten okuduğu iki yanıtın (`proxied` = 7434 üzerinden, `direct` = 7433'e doğrudan) `instance_id` alanlarının **birbirine eşit** olduğunu assert eder — bu, "proxy doğru sürece mi gidiyor" sorusunu ayırt eden **tek** doğru kanıttır (bkz. §2.2). |

**Kasıtlı olarak yazılmayan test:** `npm run dev`'in tamamını (gerçek `concurrently` + gerçek
`tsx watch` + gerçek Vite) uçtan uca, dolu bir portla Playwright/`child_process` ile spawn edip
sürecin gerçekten öldüğünü doğrulayan bir E2E senaryosu **yazılmıyor**. Gerekçe: (a)
`check-ports.mjs`'in kendi testi zaten kilit mekanizmanın çalıştığını kanıtlıyor —
`predev`'in `dev`'den önce çalıştığı npm'in kendi belgelenmiş, test edilmiş davranışıdır, ayrıca
doğrulamak npm'in kendisini test etmek olurdu; (b) gerçek `npm run dev` sürecini spawn etmek
Windows'ta yetim süreç/port bırakma riski taşıyor (CLAUDE.md kaydı) ve F-002'nin hiçbir AC'si
bunu talep etmiyor (N4 feature notu metni "iki katmanda kapatılacak" diyor, ikisi de yukarıda
birim/entegrasyon seviyesinde kanıtlanıyor).

---

## 7. Mutasyon planı

Kod turunun sonunda aşağıdaki 8 mutasyon **kasıtlı olarak** uygulanıp testlerin KIRMIZI
verdiği doğrulanacak, sonra `git checkout`/elle geri alınacak (F-001'in QA turunda uygulanan
disiplinin aynısı, bkz. `docs/qa/latest.md`):

1. **Normalizer'ın `missing_fields` mantığını devre dışı bırak** (her zaman `flags:[]` dön) →
   `tests/features/events/server/normalize.test.ts`'teki `missing_fields` testleri kırmızı
   vermeli (AC-2'nin gerçekten ölçtüğünün kanıtı).
2. **Yazma kuyruğunu kaldır** (tur 2 düzeltmesi — Bulgu 11: deterministik hâle getirildi).
   `jsonl-store.ts`'te `append`'i kuyruğa eklemeden doğrudan `fs.appendFile` çağırt. Kanıt testi
   artık **HTTP üzerinden değil, doğrudan store üzerinden** koşar ve satır boyutu büyütülür:
   `tests/server/store/jsonl-store.test.ts`'te 200 eşzamanlı `store.append(...)` çağrısı yapılır,
   her olayın `raw` alanı **≥256 KB** dolgu içerir (tek `fs.appendFile` çağrısının işletim
   sistemi tarafından kısmi yazımlara bölünme ihtimalini artırmak için — küçük satırlarda tek
   `write` syscall'ı atomik kalabilir, büyük satırlarda kuyruksuz hâlde iç içe geçme neredeyse
   kesinleşir). Test, sonuç dosyasında (a) tam 200 satır olduğunu, (b) her satırın geçerli JSON
   olduğunu assert eder — mutasyon altında en az biri bozulmalı. "Ampirik olarak N artırılacak"
   ifadesi **kaldırıldı**; N=200 ve satır boyutu ≥256 KB sözleşmenin kendi sabit parametresidir.
3. **Retention güvenlik çitini gevşet** (`isInsideDataRoot`'taki `path.relative` kontrolünü
   kaldırıp yalnızca `target.startsWith(root)` dizge karşılaştırmasına düşür) → tur 2
   düzeltmesiyle (Bulgu 3) bu artık **kesin** kırmızı verir: §3 madde 3'teki "kardeş önek
   tuzağı" tablo satırı (`root`'un yanında `root + '-sibling'` gerçek dizini) `startsWith`
   mutasyonu altında yanlışlıkla `true` döner, test `false` beklediği için kırmızı verir.
   Symlink testinin skip edilmesi bu mutasyonun yakalanmasını **artık etkilemiyor** (eski
   sözleşmenin zayıflığı buydu).
4. **Seq çözümlemesini `Math.max` yerine yalnızca `.seq` dosyasına bağla** (JSONL taramasını
   atla) → `tests/server/store/jsonl-store.test.ts`'teki ".seq dosyası JSONL'den eskiyse JSONL
   kazanır" testi kırmızı vermeli.
5. **N1 düzeltmesini geri al** (`#root > div` ölçümünü kaldır, yalnızca `body` bırak) →
   `tests/e2e/shell.spec.ts` yeşil **kalır** (bu, N1'in orijinal kör noktasının hâlâ orada
   olduğunu ama artık test edilmediğini gösterir — yani bu mutasyon "kırmızı vermeli" değil,
   tam tersi "genişletilmiş test olmadan kör nokta sessiz kalır" iddiasını kanıtlar; genişletilmiş
   hâliyle, `App.tsx`'in kök rengini bozan bir mutasyon (bkz. §6.1) kırmızı vermeli — asıl kanıt
   budur).
6. **(Yeni — tur 2, Bulgu 4) Satır sayısı haritasını eski (hatalı) davranışa döndür** — yalnızca
   ring buffer taramasından say, gün dosyalarının ayrı geçişini kaldır → §3 madde 2 alt madde
   4'ün kanıt testi (`MC_RING_SIZE` fixture'ın altında, 3 gün dosyası × 5 olay = 15 toplam,
   `MC_RETENTION_EVENTS`=10) kırmızı vermeli: mutasyon altında toplam 5 sanılır, hiç budama
   tetiklenmez, eski dosyalar silinmeden kalır.
7. **(Yeni — tur 2, Bulgu 1) Host/Origin kontrolünü bypass et** (`isAllowedHost`/
   `isAllowedOrigin`'i geçici olarak her zaman `true` dönecek şekilde değiştir) →
   `tests/server/health.test.ts`'teki yabancı `Host` testi ve `tests/integration/
   events-api.test.ts`'teki cross-origin `Origin` testi (AC-8) kırmızı vermeli.
8. **(Yeni — tur 2, Bulgu 13) `project_path`/`cwd` öncelik sırasını boz** (`cwd`'ye hiç
   bakmadan yalnızca `project_path`'e bak) → `tests/features/events/server/normalize.test.ts`'te
   yalnızca `cwd` içeren bir payload'ın `missing_fields` almaması gerektiğini doğrulayan test
   kırmızı vermeli.

---

## 8. Riskler ve bilinmeyenler

| # | Risk/bilinmeyen | Durum / azaltım |
|---|---|---|
| R1 | ~~Host/Origin koruması bu feature'da yok~~ **KAPANDI (ADR-008 karar 1).** Tur 2'de kapsama alındı, §3 madde 11, §4.2a, §5 AC-8, §7 madde 7. | — |
| R2 | 50 MB gün dosyası rotasyonu yok | **KAPANDI (ADR-008 karar 2).** Erteleme onaylandı; koşul (`dayFileName` tek fonksiyonu) §3 madde 6'ya işlendi. |
| R3 | `GET /api/events` yalnızca ring buffer'ı sorgular, `MC_RING_SIZE`'ın ötesindeki disk geçmişine erişemez | F-002'nin hiçbir AC'si bunu istemiyor; F-003'ün SSE `resync` senaryosu bunu gerektirdiğinde ele alınacak. Şimdilik doküman edilen bir sınırlama. |
| R4 | Windows'ta `rename`/`unlink` antivirüs/açık dosya nedeniyle `EPERM` verebilir (retention silmesi) | Silme başarısız olursa retention o dosyayı atlar, bir sonraki saatlik turda tekrar dener, süreç çökmez; log'a Türkçe uyarı yazılır. Sert bir "3 deneme" mekanizması (write-gate'inki gibi) burada **gerekmiyor** çünkü retention zaten periyodik — bir sonraki tur doğal bir yeniden deneme. |
| R5 | ~~Retention güvenlik çiti testi (symlink senaryosu) Windows'ta yönetici izni gerektirebilir~~ **Azaltıldı (Bulgu 3).** Asıl kanıt artık platform bağımsız `isInsideDataRoot` tablo testi (§3 madde 3); symlink testi yalnızca opsiyonel ek, skip edilse de AC-6 GEÇTİ kararı etkilenmez. | — |
| R6 | ~~Eşzamanlılık mutasyon testi küçük N'de hâlâ yeşil kalabilir~~ **Giderildi (Bulgu 11).** Mutasyon testi artık HTTP değil doğrudan store üzerinden, sabit N=200 ve satır boyutu ≥256 KB ile deterministik kırmızı verecek şekilde tasarlandı (§7 madde 2); "ampirik artır" ifadesi kaldırıldı. | — |
| R7 | `.seq` dosyasının fire-and-forget yazımı, çok sık restart senaryosunda her seferinde dosya sonu taramasına düşebilir | Performans riski, doğruluk riski değil — tarama yalnızca en yeni gün dosyasının **son geçerli satırına** kadar geriden okur (tüm dosya değil), pratikte önemsiz. |
| R8 | `check-ports.mjs`'in `predev` olarak çalışması, `npm run dev` dışında (ör. doğrudan `concurrently` çağrılırsa) korumasız kalır | Kabul edilen sınır — proje her zaman `npm run dev` (veya `npm run e2e:dev`, o da `npm run dev`'i çağırır — tur 2 düzeltmesi, Bulgu 10) ile başlatılıyor. Portlar artık env'den (`resolvePort` semantiği) çözüldüğü için bu iki yol birbirini yanlış pozitifle bloklamaz. |
| R9 | **(Yeni)** Host whitelist'i mimari §10'un literal port kümesinin ötesine (webPort da dahil) genişletiyoruz (§3 madde 11) | Kasıtlı, gerekçeli bir uzatma — Vite dev proxy'sinin `changeOrigin:false` davranışıyla meşru trafiği kırmamak için. Kod turunda gerçek proxy akışıyla (`dev-shell.spec.ts`) doğrulanacak. |
| R9 | Bu sözleşme `data/` altına ilk `mkdir`'ı `index.ts`'in bootstrap'ına koyuyor; F-001 açıkça "F-001 sunucusu data/'yı hiç okumaz/yazmaz" demişti — bu artık değişiyor | Kasıtlı, feature notunun kendisi tarafından öngörülmüş bir devir (§1). Davranış değişikliği: sunucu artık açılışta `data/events/` dizinini oluşturuyor; F-001'in hiçbir AC'sini bozmuyor (health/statik servis davranışı aynı). |

---

## 9. CEO'ya sorular

1. ~~Host/Origin (DNS-rebinding/CSRF) koruması~~ — **KAPANDI: ADR-008 karar 1
   (2026-09-04).** CEO ertelemeyi reddetti, F-002'de yazılması onaylandı. Sözleşme tur 2'de
   buna göre güncellendi (§1, §3 madde 11, §4.2a, §5 AC-8, §7 madde 7).
2. ~~Gün dosyası 50 MB rotasyonu~~ — **KAPANDI: ADR-008 karar 2 (2026-09-04).** Erteleme
   onaylandı, koşuluyla birlikte (`dayFileName` tek fonksiyonu, §3 madde 6).

Her iki soru da ADR-008 ile karara bağlandı; bu turda CEO'ya yöneltilen yeni bir açık soru
**yok**.

---

## Bitti tanımı (bu tur)

Bu belge (`docs/qa/F-002-contract.md`) diskte; `git status --porcelain` bu dosya dışında boş.
Kod yazılmadı. Sıradaki adım: qa-evaluator bu sözleşmeyi inceler; onaylanırsa (veya CEO §9'daki
sorulara cevap verdikten sonra) kod turu başlar.

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-04)

KARAR: DÜZELTME

Kod turu başlayamaz. 4 bloklayıcı, 9 önemli, 2 not bulgu. Sözleşmenin yapısı, dosya
sahipliği kararları ve kapsam disiplini sağlam; kapsam sızması **yok** (SSE, tam filtre seti,
`send-event.js`, UI bileşeni sözleşmeye girmemiş — §1 doğrulandı). Sorun kapsamda değil,
(a) ADR-008'in sözleşmeye hiç işlenmemiş olmasında ve (b) birkaç kabul kriterinin kanıtının
ihlal hâlinde yeşil kalabilecek olmasında.

Bu inceleme sözleşme metnine karşı yapıldı; hiçbir `src/`, `tests/`, `package.json` veya
config dosyası değiştirilmedi.

### Bulgular

| # | Şiddet | Sözleşme bölümü/satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §1 satır 50-55, §3 madde 11 satır 323-332, §8 R1 satır 540, §9 madde 1 satır 554-559 | ADR-008 karar 1 (2026-09-04, "Kabul edildi") Host/Origin korumasının F-002'de **yazılmasına** karar verdi ve developer'ın erteleme önerisini açıkça reddetti. Sözleşme hâlâ ADR öncesi hâlinde: korumayı kapsam dışı sayıyor, gerekçesini savunuyor ve CEO'ya kapanmış bir soruyu tekrar soruyor. Feature notu satır 35 de bunu bağlayıcı ek kapsam olarak listeliyor. | §1 "içinde" listesine, §2 dosya listesine, §4'e (403 `forbidden_origin` yanıt sözleşmesi), §5'e (yeni AC-8 satırı + testi) ve §7'ye (yeni mutasyon: kontrolü kaldır → test kırmızı) Host/Origin'i ekle; §3 madde 11, §8 R1 ve §9 madde 1'i sil veya "ADR-008 ile karara bağlandı, kapsam içi" olarak yeniden yaz. Kapsam ADR-008'deki minimumdur: loopback `Host` beyaz listesi + cross-origin `Origin` reddi. |
| 2 | BLOKLAYICI | §3 madde 8 satır 274-282, §5 AC-4 satır 456 | AC-4'ün sıra kanıtı totoloji. Test 500 POST sonrası `GET /api/events` çıktısındaki `seq` dizisinin "kesin artan" olduğunu assert ediyor; ama GET kaynağı ring buffer'dır (§4.3 satır 420) ve ring buffer zaten `seq` artış sırasında doldurulur. Yazma sırası tamamen bozulsa bile bu assert yeşil kalır — ölçtüğü tek şey ring buffer'ın kendi sıralamasıdır. Ayrıca "≥495 (%99)" toleransı, 5 POST'un 202 dönmemesini veya sessizce düşmesini gizler. | AC-4 testi (a) 500 yanıtın **tamamının** 202 olduğunu, (b) gün dosyasında **tam olarak 500** satır bulunduğunu, (c) **dosyadaki fiziksel satır sırasının** `seq` sırasıyla birebir örtüştüğünü assert etsin (ring buffer değil, disk okunsun). %99 eşiği yalnızca AC metnini karşılayan alt sınır olarak kalsın, gerçek beklenti %100 olsun. |
| 3 | BLOKLAYICI | §3 madde 3 satır 154-180, §5 AC-6 satır 458, §8 R5 satır 544, §7 madde 3 satır 518-523 | AC-6'nın güvenlik çitini kanıtlayan tek gerçek test (symlink saldırı senaryosu) Windows'ta `test.skip` ile atlanabilir ve sözleşme bunu "GEÇTİ'ye katkı saymaz" diye kabul ediyor. Geriye kalan kanıt yalnızca dosya-adı-deseni testi; o da §7 madde 3'ün mutasyonunu (`path.relative` yerine `startsWith`) **kırmızı vermez**, çünkü desen kontrolü kapsama kontrolünden bağımsızdır. Sözleşme bu boşluğu satır 522-523'te kendisi itiraf ediyor. Sonuç: birincil platformda (Windows) AC-6'nın kapsama çiti hiçbir testle kanıtlanmayabilir. | Kapsama kontrolü saf bir dışa aktarılmış yüklem olarak yazılsın (ör. `isInsideDataRoot(root, target)`) ve tablo testiyle kanıtlansın: dışarıdaki mutlak yol, `..` ile çıkış, **kardeş önek tuzağı** (kök `...app` iken hedef `...app-factory` — mimari §3.6'nın açıkça yasakladığı `startsWith` hatası), büyük/küçük harf farkı, karışık ayraç. Bu test admin izni gerektirmez, her platformda koşar ve §7 madde 3 mutasyonunu **kesin** kırmızı verir. Symlink testi bunun üstüne opsiyonel ek kalsın. |
| 4 | BLOKLAYICI | §3 madde 2 alt madde 4 satır 141-145, §5 AC-6 satır 458 | Adet bazlı retention'ın veri kaynağı hatalı. Satır sayısı haritasının "ring buffer yüklemesiyle aynı geçişte doldurulacağı" söyleniyor; ama mimari §5.5'in okuma sözleşmesi "en yeni dosyadan geriye doğru **`MC_RING_SIZE` olay toplanana kadar**" der — ring dolunca tarama durur, eski gün dosyaları hiç okunmaz, satır sayıları haritada eksik kalır. Gerçek kullanımda (ring 2000 dolu, 30 gün dosyası) toplam olduğundan küçük çıkar ve `MC_RETENTION_EVENTS` budaması hiç tetiklenmez. Daha kötüsü: planlanan test bu hatayı **göremez**, çünkü küçük fixture'da ring hiç dolmaz ve harita tam olur. | Satır sayısı haritasının nasıl doldurulacağı düzeltilsin: ya açılışta tüm gün dosyaları yalnızca satır sayısı için ayrıca (ucuz) taransın, ya da ring buffer taraması ring dolduktan sonra da sayım için devam etsin. AC-6 adet testi, **ring buffer'ın dolduğu** bir rejimde (ör. `MC_RING_SIZE` fixture'ın altında) koşsun — aksi hâlde test bu hatayı yapısal olarak gizler. |
| 5 | ÖNEMLİ | §3 madde 6 satır 240-249, §8 R2 satır 541, §9 madde 2 satır 560-563 | ADR-008 karar 2 rotasyon ertelemesini onayladı — sözleşmenin sonucu doğru, ama (a) hâlâ açık CEO sorusu gibi sunuluyor, (b) ADR'nin **koşulu** sözleşmede yok: "depo katmanı, ileride rotasyon eklenirse çağıran tarafı değiştirmeyecek şekilde dosya adını **tek bir yerden** üretmelidir". | §9 madde 2 kaldırılsın/ADR-008'e atıfla kapatılsın; §3 madde 6'ya gün dosyası adının tek bir fonksiyondan (ör. `dayFileName(date)`) üretileceği ve append/okuma/retention'ın hepsinin bu fonksiyonu çağıracağı taahhüdü yazılsın. |
| 6 | ÖNEMLİ | §2.1 satır 78 vs §3 madde 9 satır 286-303 vs §5 AC-5 satır 457 | AC-5 kanıtı sözleşme içinde çelişiyor: §2.1 restart-reload'u `tests/integration/events-api.test.ts`'e (gerçek `node:http`) yazıyor, §3 madde 9 ve §5 AC-5 ise modül seviyesinde `jsonl-store.test.ts`'e. Modül seviyesi seçimi (çocuk süreç yok) **savunulabilir**, ama kanıt gücü eksik: iki store örneğiyle yapılan test, `src/server/index.ts` bootstrap'ının store'u gerçekten `init()` ettiğini ve yüklenen ring'in `GET /api/events`'ten göründüğünü kanıtlamaz — wiring hatası testte yeşil kalır. | Çelişki tek yönde çözülsün: AC-5 testi süreç içi ama **sunucu seviyesinde** olsun — aynı geçici veri dizinine karşı sunucu örneği kur, 150 POST at, sunucuyu kapat, **yeni** bir sunucu örneği kur, `GET /api/events` ile ≥100 olayın döndüğünü ve `seq` sırasının korunduğunu assert et. Çocuk süreç yine spawn edilmez. Bunun için `createServer`'ın veri dizinini parametre olarak alması gerektiği §2.2'ye yazılsın. |
| 7 | ÖNEMLİ | §5 AC-3 satır 455 | AC-3 ("şema değişikliği veri kaybettirmez") yalnızca normalizer birim testine bağlanmış. Normalizer `raw`'ı doğru üretse bile serileştirme/append/geri okuma yolunda `raw`'ın düşmesi (ör. yazarken alan atlanması, okurken şemaya göre yeniden kurulması) testte yeşil kalır. | AC-3'e uçtan uca bir satır eklensin: tabloda olmayan bir alan içeren payload POST edilsin, **gün dosyasından okunan satırda** ve `GET /api/events` yanıtında o alanın `raw` içinde birebir bulunduğu assert edilsin. |
| 8 | ÖNEMLİ | §5 AC-2 satır 454 | "5xx asla" iddiası tek bir senaryoyla (eksik alanlı POST) kanıtlanıyor. AC-2/PRD F1-AC5 evrensel bir iddiadır; tek örnek onu kanıtlamaz. | Entegrasyon testinde patolojik gövde tablosu koşulsun ve hepsinde `status < 500` assert edilsin: boş gövde, `null`, `[]`, JSON olmayan metin, `Content-Type` yok/yanlış, çok derin iç içe nesne, UTF-8 dışı bayt, 256 KB sınırının hemen altındaki gövde. |
| 9 | ÖNEMLİ | §2.2 satır 91, §6.2 satır 487-489 | N4 katman (b)'nin E2E kanıtı zayıf. `dev-shell.spec.ts`'e yalnızca "`service`/`instance_id` alanı var" assert'i ekleniyor. N4'ün gerçek hata modu proxy'nin **yabancı sürece** gitmesidir; alan varlığı bunu ayırt etmez (yabancı süreç de bir Mission Control örneği olabilir; F-001'in kendi dev sunucusu 7333'te koşarken bu senaryo gerçek). | `dev-shell.spec.ts` proxy üzerinden alınan `/api/health` ile doğrudan `127.0.0.1:7433`'ten alınan `/api/health` yanıtlarının `instance_id` değerlerinin **birbirine eşit** olduğunu assert etsin. Kimlik eşitliği, N4'ün ölçmek istediği tek ayırt edici özelliktir. |
| 10 | ÖNEMLİ | §2.1 satır 73, §6.2 satır 488, §8 R8 satır 547 | `check-ports.mjs`'in hangi portu kontrol edeceği sözleşme içinde çelişiyor: §2.1 env'e bağlı ("`MC_PORT`/`MC_WEB_PORT` dolu ise"), §6.2 ise literal "(7333, 7334)" diyor. Ayrıca R8 "`npm run dev` dışında korumasız" derken tersini kaçırmış: `playwright.dev.config.ts` satır 10-11 `webServer.command` olarak `npm run dev`'i `MC_PORT=7433`/`MC_WEB_PORT=7434` ile çalıştırır — yani `predev` **`npm run e2e:dev`'de de tetiklenir**. Portlar literal yazılırsa, geliştirici `npm run dev`'i açıkken `npm run e2e:dev` koşamaz (7333 dolu diye yanlış pozitif abort). | §6.2'deki literal port ifadesi kaldırılsın; script portları `src/server/index.ts`'teki `resolvePort` ile **aynı** semantikte çözsün (geçersiz/boş `MC_PORT` → 7333 gibi) ve `MC_WEB_PORT` için de aynı davranış tanımlansın. R8, `e2e:dev` yolunun da `predev`'den geçtiğini kaydetsin. |
| 11 | ÖNEMLİ | §7 madde 2 satır 513-517, §8 R6 satır 545 | Eşzamanlılık mutasyonunun kırmızı vereceği garanti değil; sözleşme "N'yi kırmızı verene kadar artırırım" diyor. Bu, mutasyon testini sonuca göre ayarlanan bir işlem hâline getirir ve yarış penceresi dar kalırsa mutasyon sessizce yeşil geçer. | Mutasyonun deterministik kırmızı vermesini sağlayan parametreler sözleşmede sabitlensin: mutasyon testi HTTP üzerinden değil doğrudan store üzerinden koşsun ve **satır boyutu büyütülsün** (ör. 200 eşzamanlı `append`, her satır ≥256 KB) — tek `appendFile` çağrısının kısmi yazımlara bölünmesi kuyruksuz hâlde satır karışmasını neredeyse kesinleştirir. "Ampirik olarak artırılacak" ifadesi kaldırılsın. |
| 12 | ÖNEMLİ | §1 satır 32, §4.4 satır 436-437, §5 tablosu | `corrupt_lines` §1'de kapsam içi, §4.4'te health şemasında; ama §5 AC tablosunda ve §2.2'nin `health.test.ts` değişikliğinde (yalnızca `instance_id`/`service`) **hiçbir teste bağlanmamış**. Kapsamda olup testi olmayan teslimat, "görüntüde var" riskidir. | Bozuk satır içeren bir gün dosyası fixture'ıyla store `init()` edilsin; sayaç değeri hem store'da hem `GET /api/health.corrupt_lines` yanıtında assert edilsin (§2.2'nin health testi değişikliğine eklensin). |
| 13 | ÖNEMLİ | §4.1 satır 350 vs §4.2 satır 374-375 | `project_path` kaynağı çelişkili. §4.1 tablosu kaynağı "gövde `project_path`" diyor; §4.2'nin "**Geçerli istek**" örneğinde ise `project_path` yok, `cwd` var — bu örnek §4.1 kuralına göre `missing_fields` bayrağı alırdı, yani "geçerli" örnek değil. Mimari §5.1 `project_path`'i "Hook `cwd`'sinden gelir" ve "`realpath`'lenmiş" diye tanımlıyor; sözleşme realpath'ten hiç söz etmiyor. AC-2 testlerinin beklentisi doğrudan buna bağlı. | §4.1/§4.2 tek kurala indirgensin: alan öncelik sırası (`project_path` yoksa `cwd`) açıkça yazılsın, `realpath` uygulanıp uygulanmayacağı ve yol mevcut değilse ne olacağı (ham değer korunur mu) belirtilsin; §4.2'nin "geçerli istek" örneği bu kurala uygun hâle getirilsin. |
| 14 | NOT | §4.4 satır 436-437 | Mimari §6.6 health şemasında `events_total`, `ring_from`, `ring_to` da var; bunlar F-002'nin ürettiği ring buffer'a ait ve doğal sahibi bu feature. Sözleşme bunlara hiç değinmiyor (reddetmiyor da). | Kod turunda ele alınır; ya eklenir ya da §1'de açıkça F-003'e (SSE `hello`/`ring_from` tüketicisi) devredildiği not düşülür. Sözleşme düzeltmesi şart değil. |
| 15 | NOT | §6.1 satır 477-480 | N1'in kök kap genişletmesi **gerçek bir şey ölçüyor** (doğrulandı: `body` zemini `src/web/index.css` satır 47-51'deki `@layer base` bloğundan, kök `div` zemini `src/web/App.tsx` satır 5'teki sınıftan gelir — bağımsız iki kaynak, §6.1'deki mutasyon gerçekten kırmızı verir). Ancak feature notu satır 29 N1 için "kök kap **ve en az bir panel yüzeyi**" diyor; F-002'de panel yüzeyi yok, yani N1 yalnızca yarısıyla kapanıyor. | Kod turunda: N1 "done" işaretlenirken panel yüzeyi yarısının F-003'e taşındığı feature notuna/`progress.md`'ye yazılsın. Sözleşme düzeltmesi gerekmez. |

## ADR-008 uyum kontrolü

| ADR-008 kararı | Sözleşmeye işlenmiş mi | Kanıt |
|---|---|---|
| **Karar 1 — Host/Origin koruması F-002'de yazılır (erteleme reddedildi)** | **HAYIR.** Sözleşme ADR öncesi hâlinde; kararın tersini savunuyor. | §1 satır 50-55 korumayı "KESİNLİKLE yapılmayacak" listesinde sayıyor; §3 madde 11 (satır 323-332) ertelemeyi gerekçelendiriyor; §8 R1 (satır 540) "bilinçli erteleme" diyor; §9 madde 1 (satır 554-559) CEO'ya kapanmış soruyu tekrar soruyor. §2 dosya listesinde ilgili dosya yok, §5 AC tablosunda karşılık gelen satır yok, §7 mutasyon planında (5 madde) ilgili mutasyon yok. ADR-008 "Sonuçlar" bölümü tam olarak bu beş bölümün güncellenmesini şart koşuyor. → Bulgu 1, BLOKLAYICI. |
| **Karar 2 — 50 MB rotasyonu ertelenir** | **KISMEN.** Sonuç (rotasyon yok) doğru ve §1 satır 56 ile §3 madde 6'da yazılı; ama hâlâ açık soru olarak sunuluyor ve ADR'nin koşulu eksik. | §3 madde 6 satır 248 "CEO'ya soru olarak işaretlendi (§9)"; §9 madde 2 satır 560-563 soruyu tekrarlıyor. ADR-008'in koşulu ("dosya adı tek bir yerden üretilmelidir") sözleşmenin hiçbir yerinde geçmiyor — §3 madde 2'de gün dosyası adı deseni birbirinden bağımsız üç yerde (append, retention deseni, ring yükleme) örtük olarak kuruluyor. → Bulgu 5, ÖNEMLİ. |

Not: sözleşme §9 iki soruyu da "CEO onayı beklenirken kod turu başlamayacak" diyerek kapatıyor;
ADR-008 bu iki soruyu 2026-09-04'te zaten karara bağladı. Sözleşme ADR'den önce yazılmış
görünüyor ve ADR sonrası güncellenmemiş. Tur 2'de tek yapılması gereken, ADR-008'i metne
işlemek ve aşağıdaki ölçüm boşluklarını kapatmaktır — yeniden tasarım gerekmiyor.

## Ölçmeyen test riski

Aşağıdaki assert'ler, ölçtüklerini iddia ettikleri şey bozulsa bile **yeşil kalabilir**:

1. **AC-4 "dönen `seq` dizisi kesin artan"** (§3 madde 8, §5 AC-4) — en tehlikelisi. Kaynak ring
   buffer olduğu için dizi tanımı gereği artan; yazma sırası tamamen bozulsa dahi yeşil.
   Ayrıca "≥%99" toleransı, 5 isteğin hata dönmesini/kaybolmasını gizler. → Bulgu 2.
2. **AC-6 adet bazlı budama testi** (§5 AC-6) — küçük fixture'da ring buffer hiç dolmadığı için
   satır sayısı haritası tam olur; üretimdeki asıl hata (ring dolunca eski dosyaların hiç
   sayılmaması) test rejiminde yapısal olarak görünmez. → Bulgu 4.
3. **AC-6 güvenlik çiti** (§5 AC-6, §7 madde 3) — symlink testi Windows'ta atlanırsa geriye kalan
   dosya-adı-deseni testi `startsWith` mutasyonunu kırmızı vermez; AC-6 kanıtsız GEÇTİ alabilir.
   → Bulgu 3.
4. **AC-5 "yeni store örneği ring'i yükler"** (§3 madde 9) — store doğru çalışsa da
   `index.ts` bootstrap'ı store'u hiç `init()` etmezse veya `GET /api/events` ring'e bağlanmazsa
   test yeşil kalır; gerçek yeniden başlatma davranışı ölçülmemiş olur. → Bulgu 6.
5. **AC-3 `raw` korunması** (§5 AC-3) — yalnızca normalizer çıktısı ölçülüyor; `raw` diske
   yazılırken veya geri okunurken düşerse test yeşil kalır. → Bulgu 7.
6. **AC-2 "5xx asla"** (§5 AC-2) — tek senaryo evrensel iddiayı kanıtlamaz; ölçülmeyen gövde
   biçimlerinde 5xx mümkün kalır. → Bulgu 8.
7. **N4 katman (b) E2E assert'i** (§2.2 satır 91) — `instance_id` alanının **varlığı**, proxy'nin
   yabancı bir Mission Control sürecine gitmesi hâlinde de yeşil kalır; ayırt edici olan
   kimliklerin eşitliğidir. → Bulgu 9.
8. **§7 madde 2 eşzamanlılık mutasyonu** — sözleşmenin kendi kabulüyle küçük N'de yeşil
   kalabilir; "kırmızı verene kadar N artır" bir kanıt değil, sonuca göre ayarlamadır. → Bulgu 11.

Yeşil kalma riski **olmayan** ve olduğu gibi kabul edilen assert'ler: N1 kök kap ölçümü
(§6.1 — bağımsız iki CSS kaynağı doğrulandı), `check-ports.mjs` mutasyonu (§6.2 — dolu portta
exit kodu deterministik), AC-7 dosya satır sayısı/JSON geçerliliği (§3 madde 7 — dosyadan okuyor,
ring'den değil), §7 madde 1 (`missing_fields`) ve §7 madde 4 (`.seq` vs JSONL) mutasyonları.

---

## Developer düzeltme yanıtı — tur 2 (2026-09-04)

Tüm değişiklikler yalnızca bu dosyada (`docs/qa/F-002-contract.md`); hiçbir `src/`, `tests/`,
`package.json` veya config dosyası dokunulmadı. `git status --porcelain` bunu doğrular.

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| 1 (BLOKLAYICI) | ADR-008 karar 1'i sözleşmeye işledim: Host/Origin koruması artık kapsam içi. Yeni tasarım (`isAllowedHost`/`isAllowedOrigin`, 403 `forbidden_origin`), dosya değişikliği, API sözleşmesi, AC-8, mutasyon eklendi; eski erteleme metni silindi. | §1 (İçinde listesi), §2.2 (`src/server/index.ts` satırı), §3 madde 11 (tamamen yeniden yazıldı), §4.2/§4.2a (yeni), §5 AC-8 (yeni satır), §7 madde 7 (yeni mutasyon), §8 R1 (kapandı), §9 madde 1 (kapandı) |
| 2 (BLOKLAYICI) | AC-4'ün kanıt kaynağını ring buffer/`GET`'ten günün JSONL dosyasının fiziksel satır sırasına taşıdım; tolerans %99'dan gerçek beklenti %100'e çıkarıldı (AC metnindeki %99 yalnızca PRD alt sınırı olarak korundu). | §3 madde 8 (yeniden yazıldı), §5 AC-4 satırı |
| 3 (BLOKLAYICI) | Kapsama kontrolünü dışa aktarılmış saf yüklem `isInsideDataRoot(root, target)` olarak tanımladım ve platform bağımsız, admin izni gerektirmeyen bir tablo testi (kardeş önek tuzağı dahil) ekledim; bu artık **asıl** kanıt, symlink testi yalnızca opsiyonel ek (skip GEÇTİ'yi etkilemez). | §3 madde 3 (yeniden yazıldı), §5 AC-6 satırı, §7 madde 3 (güncellendi), §8 R5 |
| 4 (BLOKLAYICI) | Satır sayısı haritasının doldurulmasını ring buffer taramasından ayırdım — gün bazlı budamadan sonra kalan her dosya için ayrı, ucuz bir satır-sayma geçişi eklendi. `MC_RING_SIZE`'ın altında kalan bir fixture ile bu hatayı yakalayan test tasarımı eklendi. | §3 madde 2 alt madde 4 (yeniden yazıldı), §5 AC-6 satırı, §7 madde 6 (yeni mutasyon) |
| 5 (ÖNEMLİ) | ADR-008 karar 2'yi kapalı olarak işledim; `dayFileName(date)` tek fonksiyon koşulu eklendi. | §1 (Dışında listesi), §3 madde 6, §9 madde 2 |
| 6 (ÖNEMLİ) | AC-5 restart testini modül seviyesinden sunucu seviyesine taşıdım (`createServer(port, dataDir)` — iki ayrı sunucu örneği, aynı `dataDir`); bootstrap wiring'i de kanıtlıyor artık. `createServer` imza değişikliği §2.2'ye işlendi (geriye dönük uyumlu, ikinci parametre opsiyonel). Ayrıca §3 madde 9 başlığındaki "AC6" yazım hatasını "AC5" olarak düzelttim. | §2.2 (`src/server/index.ts` satırı), §3 madde 9 (yeniden yazıldı), §5 AC-5 satırı |
| 7 (ÖNEMLİ) | AC-3'e uçtan uca disk round-trip testi ekledim: tabloda olmayan bir alan hem `.jsonl` dosyasından hem `GET /api/events`'ten `raw` içinde birebir doğrulanıyor. | §5 AC-3 satırı |
| 8 (ÖNEMLİ) | AC-2'nin "5xx asla" iddiasını tek senaryodan patolojik gövde tablosuna genişlettim (boş gövde, `null`, `[]`, JSON-olmayan metin, eksik/yanlış `Content-Type`, derin iç içe nesne, UTF-8 dışı bayt, sınır-altı gövde). | §5 AC-2 satırı |
| 9 (ÖNEMLİ) | N4 katman (b) E2E kanıtını alan varlığından `instance_id` **eşitliğine** çevirdim (`dev-shell.spec.ts`'in zaten okuduğu proxied/direct yanıtları karşılaştırıyor). | §2.2 (`tests/e2e/dev-shell.spec.ts` satırı), §6.2 |
| 10 (ÖNEMLİ) | `check-ports.mjs`'in port kaynağını literal değerlerden `resolvePort` semantiğiyle env okumaya çevirdim (`MC_PORT`/`MC_WEB_PORT`); R8'e `npm run e2e:dev`'in de `predev`'den geçtiği notunu ekledim. | §6.2 (yeni "Port kaynağı" satırı), §8 R8 |
| 11 (ÖNEMLİ) | Eşzamanlılık mutasyonunu deterministik hâle getirdim: HTTP yerine doğrudan store, sabit N=200, satır boyutu ≥256 KB; "ampirik artır" ifadesi kaldırıldı. | §7 madde 2, §8 R6 |
| 12 (ÖNEMLİ) | `corrupt_lines` sayacına store seviyesinde ve `GET /api/health` seviyesinde birer kanıt testi bağladım. | §3 madde 5, §5 (AC tablosu sonrası not) |
| 13 (ÖNEMLİ) | `project_path`/`cwd` çelişkisini tek kurala indirgedim: öncelik `project_path` → `cwd` (+`realpath`, hata durumunda ham değer korunur); §4.2'nin "geçerli istek" örneğini `project_path` kullanacak şekilde düzelttim; yeni testler ve mutasyon eklendi. | §4.1 (`project_path` satırı), §4.2 (örnek), §5 AC-2 satırı, §7 madde 8 (yeni mutasyon) |
| 14 (NOT) | Sözleşme değişikliği yok. Kod turunda `events_total`/`ring_from`/`ring_to` ya eklenecek ya da F-003'e devredildiği not düşülecek — karar kod turunda verilecek, bu bir tasarım kararı değil. |
| 15 (NOT) | Sözleşme değişikliği yok. Kod turunda N1'in panel-yüzeyi yarısının F-003'e taşındığı `progress.md`'ye yazılacak. |

**İTİRAZ:** Yok. ADR-008'in iki kararına da tam uyumlu şekilde işlendi; QA'nın 13 BLOKLAYICI/
ÖNEMLİ bulgusunun hepsi kapsam genişletmeden, mevcut dosya sahipliği sınırları içinde
kapatıldı (yeni dosya açılmadı; yalnızca mevcut dosyalara yeni saf fonksiyonlar/testler
eklenmesi planlandı).

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-04)

KARAR: DÜZELTME
ESKALE: false

Dar doğrulama turu: yalnızca tur 1 bulgularının kapanışı ve düzeltmelerin ürettiği regresyonlar
incelendi. Tur 1'de onaylanan konular (kapsam disiplini, N1 kök kap ölçümü, AC-6'nın modül
seviyesi kararı, AC-7 dosya tabanlı assert'i, biçim/üslup) yeniden açılmadı. ADR-008'in iki
kararı tartışılmadı; yalnızca metne doğru işlenip işlenmediği kontrol edildi.

Tur 1'in 13 BLOKLAYICI/ÖNEMLİ bulgusunun **tamamı kapandı**. Ancak Bulgu 1'in düzeltmesi (Host
beyaz listesi) yeni bir çelişki üretti (R-1): planlanan testlerin tamamı efemeral portla koşuyor
ve sözleşmenin kendi "mevcut testler bozulmaz" iddiası bu tasarımla yanlış. Tek başına kod
turunu bloklar; düzeltme bir paragraf.

### Tur 1 bulgu kapanış tablosu

| # | Durum | Gerekçe (dosya:satır) |
|---|---|---|
| 1 (BLOKLAYICI) | KAPANDI | Host/Origin artık §1 "içinde" listesinde (satır 36-40) ve "yapılmayacaklar"dan çıkarılmış — satır 55-57 yalnızca auth/token/CORS'u dışlıyor, çifte kayıt yok. §2.2 satır 91 (d) dosya değişikliği, §3 madde 11 (satır 390-424) tasarım, §4.2a (satır 497-527) API davranışı, §5 AC-8 (satır 590) test eşlemesi, §7 madde 7 (satır 690-694) mutasyon; §8 R1 ve §9 madde 1 kapalı işaretli. ADR-008 "Sonuçlar" (satır 47-48) beş bölümün hepsinin güncellenmesini istiyordu, hepsi var. |
| 2 (BLOKLAYICI) | KAPANDI | §3 madde 8 (satır 324-341): kanıt kaynağı `fs.readFileSync` ile günün `.jsonl` dosyası; "GET çağrılmaz" açıkça yazılı, ring/`GET` kalıntısı yok. 500 yanıtın tamamının 202 olması ayrı adım (satır 329-333); fiziksel satır sırası `toEqual` ile birebir (satır 336-341). "%99" yalnızca AC metninin PRD alt sınırı olarak geçiyor (satır 331, 340, 583) — çelişkili ikinci bir beklenti üretmiyor. |
| 3 (BLOKLAYICI) | KAPANDI | §3 madde 3 (satır 184-216): `isInsideDataRoot(root,target)` dışa aktarılmış saf yüklem; 5 vakalı tablo testi (alt dosya, dış mutlak yol, kardeş-önek tuzağı `root`+`-sibling`, `..` ile çıkış, Windows karışık ayraç/harf farkı), her platformda koşuyor. Kardeş-önek vakası `target.startsWith(root)` mutasyonu altında `true` döner, test `false` bekler → §7 madde 3 kesin kırmızı (olasılığa bağlı değil). Symlink testinin opsiyonelliği ve GEÇTİ'ye katkı saymadığı üç yerde yazılı: satır 209-213, §5 AC-6 (satır 588), §8 R5. |
| 4 (BLOKLAYICI) | KAPANDI | §3 madde 2 alt madde 4 (satır 148-165): satır sayımı ring taramasından ayrıştırılmış, gün budamasından sonra ayrı `readFileSync` geçişi. Fixture mantığı elle yürütüldü: ring=5 iken hatalı kod yalnızca en yeni dosyayı tarar, toplamı 5 sanar, 5 < `MC_RETENTION_EVENTS`=10 → hiç budama yapmaz; doğru kod 15 görür → en az bir eski gün dosyası silinir. §7 madde 6 mutasyonu deterministik kırmızı. |
| 5 (ÖNEMLİ) | KAPANDI | ADR-008 karar 2'nin koşulu §3 madde 6 satır 289-294'te yazılı (`dayFileName(date)`, append/açılış/retention hepsi bu fonksiyonu çağırır) ve §2.1 `jsonl-store.ts` satırında (satır 72) tekrarlanmış; §9 madde 2 kapalı. |
| 6 (ÖNEMLİ) | KAPANDI | §3 madde 9 (satır 343-370) sunucu seviyesine taşınmış; §2.1 satır 82 ile §5 AC-5 (satır 586) artık aynı dosyayı gösteriyor, çelişki yok. Bootstrap wiring'in neden kanıtlandığı satır 356-359'da. |
| 7 (ÖNEMLİ) | KAPANDI | §5 AC-3 satırı (582): `custom_marker` hem günün `.jsonl` satırında hem `GET /api/events` yanıtında assert ediliyor — tam disk round-trip, yalnızca normalizer çıktısı değil. |
| 8 (ÖNEMLİ) | KAPANDI | §5 AC-2 satırı (581): 9 senaryoluk patolojik gövde tablosu (boş, `null`, `[]`, düz metin, eksik/yanlış `Content-Type`, 50 seviye iç içe, UTF-8 dışı bayt, sınır-altı gövde), her biri için ayrı POST ve `status < 500`. |
| 9 (ÖNEMLİ) | KAPANDI | §2.2 satır 95 + §6.2 satır 622: `proxied.instance_id === direct.instance_id` **eşitliği** assert ediliyor, varlık değil. Beklenen kimliğin aktarımı somut: iki yanıt da aynı testte okunuyor (`tests/e2e/dev-shell.spec.ts:21,26` zaten bu iki isteği yapıyor), dışarıdan kimlik taşınmasına gerek yok. |
| 10 (ÖNEMLİ) | KAPANDI | §6.2 "Port kaynağı" satırı (619): literal port kalıntısı yok, `resolvePort` semantiği + `MC_WEB_PORT` kardeş fonksiyonu. `playwright.dev.config.ts:9-11`'in `npm run dev`'i `MC_PORT=7433`/`MC_WEB_PORT=7434` ile çağırdığı (dosya okundu, doğru) ve `predev`'in `npm run e2e:dev`'de de tetiklendiği hem satır 619'da hem §8 R8'de kayıtlı. |
| 11 (ÖNEMLİ) | KAPANDI | §7 madde 2 (satır 665-676): mutasyon testi HTTP değil doğrudan store üzerinden, sabit N=200 ve satır ≥256 KB; "ampirik olarak N artırılacak" ifadesi kaldırılmış. §8 R6 kapalı. |
| 12 (ÖNEMLİ) | KAPANDI | §3 madde 5 satır 261-266: 8 geçerli + 2 bozuk satırlık fixture ile store `corrupt_lines === 2`, aynı sayı `GET /api/health` üzerinden uçtan uca doğrulanıyor. (§2.2'nin `health.test.ts` satırı yalnızca `typeof` assert'ini anıyor — kod turu notu N3.) |
| 13 (ÖNEMLİ) | KAPANDI | §4.1 `project_path` satırı (546): 3 adımlı öncelik (`project_path` → `cwd` + `realpathSync` → boş dizge), erişilemeyen yolda ham değerin korunması ve normalizer'ın throw etmemesi yazılı; §4.2 "geçerli istek" örneği artık `project_path` içeriyor; §5 AC-2'ye iki test, §7 madde 8'e mutasyon eklendi. |
| 14 (NOT) | AÇIK — kod turuna devredildi | Sözleşme değişikliği istenmemişti; `events_total`/`ring_from`/`ring_to` kararı kod turunda verilecek (bkz. N4). |
| 15 (NOT) | AÇIK — kod turuna devredildi | Sözleşme değişikliği istenmemişti; N1'in panel-yüzeyi yarısının F-003'e devri kod turunda yazılacak (bkz. N5). |

### YENİ (regresyon) bulgular

| # | Şiddet | Bölüm | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| R-1 | ÖNEMLİ | §3 madde 11 madde 1 (satır 399-410), §2.2 satır 91 ve 93, §5 AC-8 | Bulgu 1'in düzeltmesi `Host` beyaz listesini `createServer`'a **verilen** `port` parametresine bağlıyor. Planlanan testlerin tamamı ise efemeral port kullanıyor: `tests/server/health.test.ts:43,51,77` `createServer(0)` çağırıyor; §3 madde 7 (satır 310), §3 madde 9 (satır 361-363) ve `tests/integration/events-api.test.ts` de "efemeral port" diyor. `fetch`/undici `Host: 127.0.0.1:<gerçek efemeral port>` gönderir; beyaz liste `{127.0.0.1:0, localhost:0, 127.0.0.1:webPort, localhost:webPort}` olduğu için bu isteklerin **hepsi** 403 alır. Sonuç: (a) §2.2 satır 91'in "mevcut `createServer(0)` çağrıları değişmeden çalışmaya devam eder" iddiası yanlış — F-001'in `GET /api/health` 200 testi (health.test.ts:50-74) ve `/api/nope` 404 testi (satır 76-87) kırılır; (b) §2.2 satır 93'ün "geçerli `Host` ile → 200" regresyon assert'i bu tasarımla yazılamaz; (c) AC-1…AC-8'in bütün entegrasyon kanıtları 403'e düşer. Bu boşluk kod turunda "testi geçirmek için" güvenlik kontrolünü gevşetme (ör. `port === 0` ise kontrolü atla) baskısı yaratır; sözleşmede kapatılmalı. | §3 madde 11 madde 1'e tek paragraf: karşılaştırmanın **etkin dinleme portu** (`server.address().port` — `port: 0` verilse bile gerçek port) üzerinden yapılacağı yazılsın; veya bilinçli olarak port bileşeninin yok sayılıp yalnızca ana bilgisayar adının (`127.0.0.1`/`localhost`) beyaz listeleneceği karara bağlansın (bu da DNS-rebinding korumasını kaybettirmez, ADR-008 minimumunu karşılar). Seçilen kural §2.2'nin `health.test.ts` satırına ve §5 AC-8 tablo testine yansıtılsın; §2.2 satır 91'deki "değişmeden çalışmaya devam eder" cümlesi doğrulanabilir hâle getirilsin. |
| R-2 | NOT | §8 | Tur 2'de eklenen Host whitelist riski `R9` numarasıyla yazılmış, ama `R9` zaten `data/` mkdir riski için kullanılıyor — §8'de iki satır aynı numarada. Kod turunda düzeltilsin; sözleşme düzeltmesi şart değil. |

### Developer'ın bildirdiği iki riskin değerlendirmesi

1. **Host beyaz listesine `webPort` eklenmesi — YORUM DOĞRU, onaylandı.** `vite.config.ts`
   (satır 15-22) proxy'yi `{'/api': 'http://127.0.0.1:<apiPort>'}` olarak tanımlıyor ve
   `changeOrigin` **hiç ayarlanmamış** (dosya okundu; http-proxy varsayılanı `false`) → istemcinin
   `Host` başlığı olduğu gibi API sürecine iletilir. `playwright.dev.config.ts:7` `baseURL:
   'http://127.0.0.1:7434'` olduğu için `tests/e2e/dev-shell.spec.ts:21`'deki proxy'li istek API
   sürecine `Host: 127.0.0.1:7434` (webPort) olarak ulaşır; mimari §10'un literal kümesi
   uygulansaydı bu meşru akış 403 alırdı. Uzatma gerekçeli ve minimum kapsamda, R9 notu yerinde.
   **Kod turunda doğrulaması:** `npm run e2e:dev` koşusunda `dev-shell.spec.ts:21-22` (proxied
   200) ve satır 26-27 (direct 7433 200) yeşil kalmalı; ayrıca `isAllowedHost` tablo testine
   `127.0.0.1:<webPort>` → `true` ve `127.0.0.1:<ilgisiz port>` → `false` satırları konsun ki
   uzatma sessizce "her portu kabul et"e kaymasın (R-1'in kararına bağlı).
2. **`createServer(port, dataDir?)` imza değişikliği — GÜVENLİ.** `src/server/index.ts:105`
   bugün `createServer(port: number)`; çağıranlar `src/server/index.ts:138` (`main`) ve
   `tests/server/health.test.ts:43,51,77` (`createServer(0)`). İkinci parametre opsiyonel olduğu
   için üç çağrı da tip ve davranış olarak bozulmaz. Mevcut health testi gövdeyi `typeof` ile
   kontrol ediyor (satır 67-71), anahtar kümesi eşitliği aramıyor → `instance_id`/`service`/
   `corrupt_lines` eklenmesi de bu testleri kırmaz (yalnızca "beş alanı içerir" test adı bayatlar,
   kod turunda güncellensin). Tek gerçek kırılma kaynağı imza değil, R-1'dir.

## Kod turuna devredilen notlar

- **N1 — store'un örneklenebilirliği (en önemlisi).** §3 madde 4/7 modül seviyesinde durum ima
  ediyor (`let queue`, `nextSeq`), §3 madde 10 ise `dataDir`'in parametre olarak geçtiğini
  söylüyor. AC-5 (aynı süreçte iki sunucu örneği), AC-7 ve `corrupt_lines` testleri farklı
  `dataDir`'lerle aynı süreçte koşacağı için store **örnek üreten bir fabrika** olmalı;
  modül-global `nextSeq`/`corrupt_lines` testler arasında sızar ve `corrupt_lines === 2`
  assert'ini kırılgan yapar. Kod turunun ilk kontrolü bu olsun.
- **N2 — `check-ports.mjs` ile `resolvePort` ikizliği.** Script `.mjs`, `resolvePort` TypeScript'te;
  semantik elle kopyalanacak. `tests/scripts/check-ports.test.ts`'e en az bir "geçersiz/boş
  `MC_PORT` → varsayılana düşer" vakası konsun, yoksa iki uygulama sessizce ayrışır.
- **N3 — §2.2'nin `health.test.ts` satırı** yalnızca `typeof corrupt_lines` assert'ini sayıyor;
  Bulgu 12'nin gerçek kanıtı §3 madde 5'teki bozuk-satır fixture'lı uçtan uca senaryodur, o da
  bu dosyaya yazılmalı. Ayrıca "beş alanı içerir" test adı güncellensin.
- **N4 (tur 1 Bulgu 14)** — `events_total`/`ring_from`/`ring_to` ya `/api/health`'e eklenir ya da
  F-003'e devredildiği §1'e ve `docs/progress.md`'ye not düşülür.
- **N5 (tur 1 Bulgu 15)** — N1 "done" işaretlenirken panel-yüzeyi yarısının F-003'e taşındığı
  feature notuna ve `docs/progress.md`'ye yazılsın.
- **N6 — mutasyon turunun maliyeti/temizliği.** §7 madde 2 fixture'ı 200 × ≥256 KB ≈ 51 MB
  geçici veri yazar; §3 madde 2 alt madde 4'ün sayım geçişi her açılışta tüm gün dosyalarını
  okur. İkisi de kabul edilebilir, ama geçici dizinler `afterEach`/`afterAll`'da gerçekten
  silinmeli (§3 madde 10'daki taahhüt) ve tur sonunda yetim süreç/dosya bırakılmamalı.
- **N7** — §8'deki çift `R9` numarası düzeltilsin (R-2).

---

## CEO kararı — R-1 (2026-09-04)

QA tur 2, tur 1'in 13 bulgusunun tamamını KAPANDI işaretledi; açık kalan tek madde kendi
düzeltmemizin ürettiği **R-1 regresyonudur**. Bir developer turu daha harcamadan karara
bağlıyorum. Bu bölüm, çeliştiği yerde §2.2 (satır 91 ve 93), §3 madde 11 (madde 1 ve 2),
§5 AC-8 ve §8 R9'un **yerine geçer**; kod turu bu kuralı uygular.

### Karar: Host ve Origin kontrolünde **port bileşeni yok sayılır**

İki saf fonksiyon da port parametresi ALMAZ. İmzalar sadeleşir:

- `isAllowedHost(hostHeader: string | undefined): boolean` — `Host` başlığının **ana bilgisayar
  adı** bileşeni `127.0.0.1`, `localhost` veya `::1`/`[::1]` ise `true`. Port ne olursa olsun
  (yokluğu dahil) sonucu etkilemez. Başlık yoksa `false`.
- `isAllowedOrigin(originHeader: string | undefined): boolean` — `Origin` başlığı yoksa
  `true` (tarayıcı dışı istemci; §4.2a'daki mevcut kural korunur). Varsa: `http`/`https`
  şemasıyla ayrıştırılabilmeli ve ana bilgisayar adı yukarıdaki loopback kümesinde olmalı.
  Ayrıştırılamayan veya loopback dışı her `Origin` reddedilir.

### Gerekçe

1. **Port, tehdit modelinde hiçbir şey satın almıyor.** Bu kontrolün amacı (mimari §10,
   ADR-008) DNS-rebinding ve cross-origin CSRF'tir. Saldırı vektörü, kurbanın tarayıcısındaki
   uzak bir sayfanın `evil.com`'u `127.0.0.1`'e çözüp isteği göndermesidir — bu istek
   `Host: evil.com` taşır ve **ana bilgisayar adı** kontrolüyle zaten reddedilir. Portu
   ayrıca doğrulamak, portumuzu zaten bilen bir saldırgana karşı koruma sağlamaz.
2. **R-1'i kökünden çözer.** Efemeral port (`createServer(0)`) ile koşan mevcut ve planlanan
   testlerin hepsi çalışır; `server.address().port` üzerinden geç bağlama (late binding)
   kurmaya gerek kalmaz. §2.2 satır 91'in "mevcut `createServer(0)` çağrıları değişmeden
   çalışır" iddiası bu kuralla **doğru** hâle gelir.
3. **R9'u ortadan kaldırır.** `webPort` özel durumu tümüyle gereksizleşir; mimari §10'un
   literal port kümesini "genişletme" yorumuna artık ihtiyaç yok. QA'nın doğruladığı Vite
   `changeOrigin: false` davranışı (`vite.config.ts:15-22`) bu kuralla kendiliğinden uyumlu.
4. **Karpathy §2.** İki fonksiyon da tek argümanlı ve saf; çağıran tarafın port/webPort
   taşımasına, `createServer` içinde ek durum tutmasına gerek yok.

### Kabul edilen artık risk

Bu kural, kullanıcının makinesinde çalışan **başka bir yerel sayfanın** (ör. `http://localhost:3000`)
panele olay POST etmesini engellemez. Bilinçli kabul: bu senaryo saldırganın zaten yerel kod
çalıştırdığı anlamına gelir, ve F-002'de etkisi yalnızca panelin kendi olay kaydının
kirletilmesidir (retention tavanı zaten var, izlenen projelere dokunulmaz).

**Yeniden açılma tetikleyicisi: F-006 (yazma kapısı).** Orada sunucu diske kullanıcı adına
yazacağı için tehdit modeli değişir; F-006 sözleşmesi bu kararı yeniden değerlendirmek ve
gerekirse origin kontrolünü sıkılaştırmak (ör. etkin porta bağlama veya token) zorundadır.
Bu, F-006 feature notuna taahhüt olarak eklenmiştir.

### Test tablosuna yansıması (§5 AC-8 yerine geçer)

`isAllowedHost` tablo testi şu vakaları içerir: `127.0.0.1:7333` → true · `127.0.0.1:54321`
(rastgele efemeral) → true · `localhost:7434` → true · `127.0.0.1` (portsuz) → true ·
`[::1]:7333` → true · `evil.com` → false · `evil.com:7333` → false · `192.168.1.10:7333` →
false · `undefined` → false.
`isAllowedOrigin`: `undefined` → true · `http://localhost:7434` → true ·
`http://127.0.0.1:5173` → true · `https://evil.com` → false · `null` (dize) → false ·
ayrıştırılamayan dize → false.
§7 madde 7'deki mutasyon (kontrolü her zaman `true` döndür → ilgili testler kırmızı)
değişmeden geçerlidir.

**KARAR: sözleşme ONAYLANDI.** Kod turu başlayabilir; yukarıdaki kural ve QA tur 2'nin
"Kod turuna devredilen notlar" bölümü bağlayıcıdır.

---

## Kod turu notu — B1 (QA düzeltme turu 1, 2026-09-04)

QA kod turu KALDI verdi (`docs/qa/latest.md`, Bulgu B1): ana yazma yolunda (`jsonl-store.ts`
`append`, `ingest.ts`) hiç hata yakalama yoktu — tek bir disk yazma hatası (ör. gün dosyası
adında bir dizin) süreci `unhandledRejection` ile öldürüyor, istemciye hiç yanıt dönmüyor ve
yazma kuyruğu kalıcı zehirleniyordu. Düzeltme bu bölümü şu şekilde günceller:

- **Yeni durum kodu: `POST /api/events` artık `503` de dönebilir** (`storage_unavailable`,
  `src/shared/types.ts` `ErrorCode`'a eklendi). §4.2'deki "Durum kodları: 202/400/403, asla
  5xx" cümlesi şu şekilde daraltılır: **PRD F1/AC5'in "5xx dönmez" kuralı yalnızca payload
  kaynaklı sorunlar içindir** (eksik/bilinmeyen alan, JSON-olmayan gövde, aşırı derin nesne —
  hepsi 202 + bayrak olarak kaydedilmeye devam eder, bu davranış **değişmedi**). Gerçek bir
  disk I/O arızası (dizin çakışması, disk dolu, izin hatası) bu kuralın kapsamı dışındadır:
  olay gerçekten saklanamadığında 202 dönüp saklandı numarası yapmak, istemciyi (ve olası
  F-003 SSE tüketicisini) yanıltır. `503` seçildi çünkü RFC 9110 anlamıyla eşleşiyor
  (`Service Unavailable` — geçici bir sunucu tarafı kapasite/kaynak sorunu, istemci hatası
  değil) ve mevcut `ErrorCode`/`ApiResponse` zarfıyla uyumlu.
- **Yazma kuyruğu artık asla reddedilmiş durumda kalmıyor** (`jsonl-store.ts` `append`):
  `fs.promises.appendFile`'ın sonucu ayrı bir `writeResult` promise'inde izlenir; `queue`
  buna hem başarı hem hata durumunda (`.then(success, errorHandler)`) bağlanır, hata
  loglanıp yutulur — böylece bir sonraki `append` çağrısı kuyrukta bekletilmeye devam eder.
  `ingest.ts` ise `store.append()`'i `try/catch` içine alır; hata durumunda istemciye 503
  döner, `void (async () => {...})()` içinde yakalanmamış bir reddi bir daha bırakmaz.
- **Gözlemlenebilirlik:** `getWriteErrors()` (`jsonl-store.ts`) ve `/api/health`'in yeni
  `write_errors: number` alanı (`corrupt_lines` deseniyle tutarlı).
- **Güvenlik ağı:** `src/server/index.ts` modül yüklemesinde bir `process.on('unhandledRejection')`
  dinleyicisi eklendi (yalnızca bir kez, `globalThis` sembol bayrağıyla korunur) — asıl çözüm
  değildir, yalnızca öngörülemeyen bir sızıntıya karşı sürecin `exit(1)` ile ölmesini önler.
- **Kanıt:** `tests/integration/events-api.test.ts` › `"B1 (QA düzeltme turu 1)"` (QA'nın
  ürettiği senaryonun birebir aynısı: gün dosyası adında dizin → POST → 503, engel kalkınca
  ikinci POST → 202) ve `tests/server/store/jsonl-store.test.ts` › `"append gerçek bir disk
  yazma hatasında reddeder ama kuyruk zehirlenmez"`. Her ikisi de mutasyonla (eski davranışa
  dönülerek) kırmızı verdiği doğrulanıp geri alındı.

Ayrıca bu turda Ö1 (`.seq` semantiği: artık her yerde "bir sonraki atanacak seq" — tutarlı
tek anlam), Ö2 (`DAY_FILE_PATTERN` çitini gerçekten ölçen `retention.test.ts` senaryosu), Ö3
(`check-ports.test.ts`'in gerçek varsayılan portu meşgul ederek totolojiyi kapatması) ve Ö4
(`tests/no-external-host.test.ts`'in tarama kökünün `src/features/**` + `scripts/**`'e
genişletilmesi, `query.ts`'in yardımcı taban URL'sinin `http://127.0.0.1`'e çevrilmesi)
düzeltildi. Detaylar `docs/progress.md` "2026-09-04 — F-002 düzeltme turu 1" kaydında.
