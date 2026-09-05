# F-003 QA raporu — kod turu (qa-evaluator, 2026-09-05)

KARAR: KALDI
ESKALE: false

Feature: F-003 — SSE akışı + canlı zaman çizelgesi ekranı + filtreler
İncelenen commit: `cc33199` (öncesi: `08b7670`, `f3b4bd4`, `e8e031a`)
Bağlayıcı ölçütler: `docs/features/F-003-sse-zaman-cizelgesi.md` 6 AC · `docs/qa/F-003-contract.md`
(CEO düzeltmesi → CEO onayı → D1-D10 → gövde §1-§9 → tur 2 NOT'ları)

## Puanlar

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | 6 | Sunucu tarafı (SSE hub, resync, N-1, zarif kapanış) sağlam ve canlı doğrulandı; duraklat çalışıyor. Ama **kaydırma ile otomatik dondurma üretimde hiç çalışamıyor** (B2). |
| Özellik bütünlüğü | 5 | AC1-AC4 ve AC6'nın duraklat yarısı karşılanıyor. AC5'in rozet davranışı sözleşmenin sert assert'inin tersi (Ö2); AC6'nın kaydırma yarısı ne uygulanabilir durumda ne test edilmiş (B2). |
| Görsel/UX | 2 | Ekranın **tüm** Tailwind stilleri üretim derlemesinde eksik (B1). G3 onaylı `docs/03-ux.md` ekran-1 tasarımı teslim edilmemiş; `sr-only` canlı bölge ekranda görünüyor. |
| Kod kalitesi | 5 | 314 test, gerçek fault-injection, sağlam deps/host guard'ları. Ama CEO'nun **zorunlu** çiti totoloji (Ö1), yeni `/api/stream` güvenlik çitinin testi yok (Ö3), kaydırma kodunun sıfır testi var, ve CSS regresyonunu yakalayacak hiçbir görsel çit yok. |

Dört boyutun üçü < 7 → **KALDI**.

## 1. Komutlar ve gerçek çıktılar

| Komut | Çıkış kodu | Sonuç |
|---|---|---|
| `npm run verify` | **0** | `Test Files 26 passed (26)` / `Tests 314 passed (314)`, `vite build ✓ built in 980ms` |
| `npm run e2e` | **0** | `7 passed (11.5s)` |
| `npm run e2e:dev` | **0** | `1 passed (4.6s)` |
| `npm audit` | 0 | `found 0 vulnerabilities` |

Developer'ın bildirdiği 314 test / 26 dosya, e2e 7, e2e:dev 1 sayıları **doğrulandı**.

`verify` çıktısındaki `EISDIR ... 503 storage_unavailable` satırları kasıtlı fault-injection
testlerinden geliyor (F-002 B1 hata yolu) — hata değil, hata yolunun gerçekten koşturulduğunun
kanıtı.

Gözlem (NOT-3): `npm run e2e` ilk denemede **exit 127** verdi (`playwright` shim'i bulunamadı,
hiçbir hata mesajı basılmadan). Aynı komut ikinci denemede sorunsuz koştu; `npx playwright
--version` ve `./node_modules/.bin/playwright --version` her zaman 0 döndü. Tekrarlanabilir
değil, ama CI'da sessiz bir kırmızıya yol açabilir.

## 2. AC → kanıt tablosu

| AC | Durum | Bağımsız kanıtım |
|---|---|---|
| AC1 — olay ≤2 sn, sayfa yenilenmeden görünür | **KARŞILANDI** | Canlı gözlem: `npm start` + tarayıcı; kendi araç çağrılarım F-004 hook'u üzerinden 7333'e POST edildi ve zaman çizelgesinde **yenileme olmadan** belirdi (rozet "Bağlı", "12 olay/dk"). E2E `timeline.spec.ts:49` `toBeVisible({ timeout: 2000 })` — tavan gerçekten 2000 ms'ye kısılmış, Playwright varsayılanı (5 sn) devre dışı. Ekran görüntüsü: `docs/qa/screens/F-003-timeline-live-2026-09-05.png` |
| AC2 — zaman/proje/agent/araç/özet | **KARŞILANDI (görsel çekinceyle)** | E2E `timeline.spec.ts:65-68` beş alanı ayrı ayrı `data-testid` ile assert ediyor. Canlıda beş alan da veride ve DOM'da doğru (`seq 20 … project_name 'mission-control', agent_type 'qa-evaluator', tool_name 'mcp__playwright__browser_snapshot'`). **Ama** B1 yüzünden sütunlar ekranda bitişik render ediliyor ("23:05:02mission-control—Bash—"), UX doc'un satır düzeni görsel olarak teslim edilmemiş. |
| AC3 — tüm tipler; filtre yalnızca görünümü etkiler | **KARŞILANDI** | `useEventStream.test.ts` sahte `fetch`'in tam URL eşitliğini ve filtre parametresi olmadığını ölçüyor — M4 mutasyonumla bu testin **gerçekten** ölçtüğü kanıtlandı (URL değişince KIRMIZI). Sunucu tarafında `query.ts`'e filtre parametresi eklenmemiş (kapsam denetimi §5). E2E filtre uygulanıp kaldırılınca verinin geri geldiğini gösteriyor. |
| AC4 — çoklu seçim proje/agent/tip | **KARŞILANDI** | E2E `timeline.spec.ts:106-135` iki ayrı proje ile daraltmayı ölçüyor; canlıda üç filtre grubu (Proje/Agent/Tip) ve "Filtreleri temizle" mevcut. |
| AC5 — kopma → gösterge → otomatik yeniden bağlanma → `Last-Event-ID` telafisi | **KISMEN — bkz. Ö2, Ö4** | Yeniden bağlanma ve kayıpsızlık gerçek süreç kill/restart ile E2E'de doğrulanıyor (koştu, geçti). **Ama** (a) rozet assert'i sözleşmenin sert şartının tersi; (b) E2E `Last-Event-ID` telafisini yapısal olarak ölçmüyor. Telafinin kendisi entegrasyon katmanında gerçekten ölçülüyor (M1 kanıtı). |
| AC6 — duraklat: yeni olaylar kaydırmaz, devamda görünür | **KISMEN — bkz. B2** | Duraklat yarısı canlı doğrulandı (aşağıda ölçüm). Kaydırma yarısı **üretimde çalışmıyor ve hiç test edilmemiş.** |

### AC1 + AC6 (duraklat) canlı ölçümü

Gerçek sunucu (`npm start`, 7333) + gerçek tarayıcı üzerinde, kendi POST'umla:

```
{ paused: true, before: 6, during: 6, probeVisibleWhilePaused: 0,
  badge: "1 yeni olay ↑ En üste git", probeAfterResume: 1 }
```

Duraklatken satır sayısı sabit kaldı, olay görünmedi, bekleyen rozeti belirdi, "Devam et"te olay
göründü. AC6'nın duraklat yarısı **gerçekten çalışıyor.**

## 3. Kendi mutasyon turum (developer'ın 14'ünden bağımsız)

| # | Mutasyon | Dosya:satır | Beklenen | Gerçek |
|---|---|---|---|---|
| M1 | `hello` çerçevesine `id: ringBounds?.to` geri kondu | `src/server/sse/stream.ts:71-77` | KIRMIZI | **KIRMIZI** — `sse-stream.test.ts:90` `expected "0" to be undefined` |
| M2 | `shutdown()`'da `closeAll()` ile `server.close()` sırası ters çevrildi | `src/server/index.ts:305-306` | KIRMIZI | **KIRMIZI** — `graceful-shutdown.test.ts:58` çağrı sırası dizisi, 2 test |
| M3 | `ring.push` yazma denemesinden ÖNCEye alındı (N-1 hayalet olay) | `src/server/store/jsonl-store.ts:218-224` | KIRMIZI | **KIRMIZI** — `jsonl-store.test.ts` + `events-api.test.ts`, 2 test |
| M4 | İlk yükleme URL'ine `since_seq=-1` geri kondu | `src/web/lib/useEventStream.ts:124` | KIRMIZI (CEO şartı) | **KISMİ** — mock'lu birim testi kırmızı (1/314); **CEO'nun zorunlu kıldığı entegrasyon çiti YEŞİL kaldı**; E2E 7/7 kırmızı. Bkz. **Ö1** |
| M5 | `handleScroll` → `stream.setScrolledAway(false)` (kaydırma-dondurma tamamen devre dışı) | `src/features/events/web/TimelineScreen.tsx:114` | KIRMIZI | **YEŞİL** — 314/314 unit + 7/7 e2e + 1/1 e2e:dev. Bkz. **B2** |
| M6 | `/api/stream` Host/DNS-rebinding kontrolünden muaf tutuldu | `src/server/index.ts:237` | KIRMIZI | **YEŞİL** — 314/314. Bkz. **Ö3** |

Her mutasyon uygulandıktan hemen sonra yedekten birebir geri alındı; her geri alma sonrası
`git diff --stat` boş doğrulandı.

## 4. Developer'ın "düzelttiği" 3 zayıf testin denetimi

| Mutasyon | Yeniden uyguladım mı | Sonuç |
|---|---|---|
| 7 — `hello` çerçevesine `id:` | Evet (= M1) | **Gerçekten KIRMIZI.** Yeni test bağlantıyı ring **dolu** iken açıyor (`ringBounds.to = 0`), bu yüzden `id` artık `undefined` olmaktan çıkıyor. Düzeltme geçerli. |
| 11 — `ring.push` başarı dalından hata dalına | Evet | **Gerçekten KIRMIZI, geniş kapsamlı**: `events-api.test.ts` 4 test (yeni yarış testi dahil) + `jsonl-store.test.ts` 5 test. Düzeltme geçerli. |
| 13 — `ScreenErrorBoundary` kaldırıldı, kullanılmayan `import` bırakıldı | Evet | **Gerçekten KIRMIZI** — `App.interaction.test.tsx:73` `Error: boom (mutasyon 13 testi)` yakalanmadan fırladı. Test artık kaynak metni değil davranışı ölçüyor: `vi.doMock` ile `TimelineScreen` fırlatacak şekilde mock'lanıyor, `App` dinamik `import()` ile yükleniyor, "Bu ekran yüklenemedi." + kabuğun ayakta kalması assert ediliyor. Düzeltme geçerli. |

Üç düzeltme de gerçek. Bu turdaki bulgular bu üçünden değil, **hiç mutasyon planlanmamış**
kod yollarından (kaydırma, Host çiti, CSS üretimi) çıktı.

## 5. Ürün kodunda mutasyon artığı denetimi

`grep -rn "useState(false)\|mutasyon\|MUTATION\|TODO\|FIXME\|HACK" src/` →
kalan üç `useState(false)` meşru (`staleData`, `pausedByUser`, `scrolledAway`,
`src/web/lib/useEventStream.ts:109-111`). `src/web/App.tsx` hiç `useState` içermiyor;
MUTATION-12 artığı (`timelineVisible`) **yok**. Ürün kodu temiz.

## 6. Bulgular

### BLOKLAYICI

#### B1 — Zaman Çizelgesi ekranının TÜM Tailwind stilleri üretim derlemesinde üretilmiyor

**Tekrar üretme:**
1. `npm run build` (veya `npm run verify`)
2. `npm start`
3. Tarayıcıda `http://127.0.0.1:7333`

**Beklenen:** `docs/03-ux.md` ekran-1: koyu temalı, sütunlu satır düzeni, çerçeveli filtre
çipleri, gizli (`sr-only`) canlı bölge.
**Gerçek:** Ekran büyük ölçüde stilsiz. Ekran görüntüsü:
`docs/qa/screens/F-003-timeline-live-2026-09-05.png` ve
`docs/qa/screens/F-003-timeline-stil-bozuk-2026-09-05.png`
- `aria-live` **`sr-only`** canlı bölgesi ekranda görünür metin olarak render ediliyor ("Bağlı",
  sol üst) — hem görsel hata hem erişilebilirlik hatası.
- Filtre çipleri bitişik: `Agent:ceoqa-evaluator`, `Tip:PostToolUsePreToolUseunknown`
- `12 olay/dkDuraklat` — etiket ve buton arasında boşluk yok; "Duraklat" butonunun çerçevesi/
  dolgusu yok.
- Satır sütunları bitişik: `23:05:02mission-control—Bash—`

**Ölçüm (kesin):** Üretilen `dist/web/assets/index-CR2QSlEX.css` (8545 bayt) içinde sınıf arama:

| Yalnızca `src/web/App.tsx`'te kullanılan | CSS'te | Yalnızca `src/features/events/web/**`'de kullanılan | CSS'te |
|---|---|---|---|
| `gap-6`, `px-4`, `h-14`, `text-amber-400`, `border-b`, `shrink-0`, `ml-auto`, `whitespace-nowrap` | **8/8 VAR** | `sr-only`, `gap-3`, `px-3`, `rounded-full`, `overflow-y-auto`, `animate-pulse`, `text-amber-300`, `min-h-8`, `bg-amber-950` | **0/9 YOK** |

**Muhtemel kök neden:** `vite.config.ts:11` `root: 'src/web'`. Tailwind v4'ün
(`@tailwindcss/vite`, `vite.config.ts:3,12`) otomatik kaynak taraması Vite kökünden başlıyor;
`src/features/events/web/**` bu kökün **dışında** kaldığı için o dosyalardaki hiçbir sınıf
üretilmiyor. F-001/F-002'de tüm UI `src/web/` altındaydı, bu yüzden sorun ilk kez F-003 ile
görünür oldu.

**Neden hiçbir test yakalamadı:** jsdom testleri CSS yüklemiyor; E2E `toBeVisible()`/metin
assert'i kullanıyor ve stilsiz öğe de görünürdür; `shell.spec.ts`'in üçüncü renk ölçüm noktası
`timeline-screen` kökünün `bg-zinc-950`'sini ölçüyor — o sınıf `App.tsx`'te de geçtiği için
**tesadüfen** üretiliyor ve assert yeşil kalıyor.

#### B2 — Kaydırma ile otomatik dondurma üretimde hiç çalışamıyor ve sıfır test kapsamı var

**Tekrar üretme (canlı, gerçek tarayıcı, 900×400 görünüm, ~30 olay):**
```
{ metrics: { scrollHeight: 888, clientHeight: 888 }, scrollTopAfter: 0,
  pauseBtn: "Duraklat", frozenProbeVisible: 1, badge: null }
```
**Beklenen:** liste kaydırılabilir; yukarı kaydırınca `scrolledAway` → `frozen`, yeni olay listeye
girmez, "N yeni olay ↑ En üste git" rozeti belirir (`TimelineScreen.tsx:150-159`).
**Gerçek:** `scrollHeight === clientHeight` — liste kabı **hiç kaydırılamıyor**; `scrollTop` 200'e
set edilse bile 0 kalıyor, `onScroll` hiç ateşlenmiyor, rozet çıkmıyor, yeni olay anında görünüyor.
**Kök neden:** B1'in doğrudan sonucu — `overflow-y-auto` (`TimelineScreen.tsx:215`) ve
`h-full`/`min-h-0` zinciri üretilen CSS'te yok, kap içeriği kadar büyüyor.

**Bağımsız ikinci kusur — test kapsamı:** M5 mutasyonu (`TimelineScreen.tsx:114`
`stream.setScrolledAway(el.scrollTop > 0)` → `stream.setScrolledAway(false)`, yani özelliğin
tamamen iptali) **322 testin tamamını yeşil bıraktı** (314 unit + 7 e2e + 1 e2e:dev).
`grep -rn "scrollTop\|mouse.wheel\|onScroll" tests/` → hiçbir test dosyasında yok.

Bu, sözleşmenin **açık taahhüdünü** ihlal ediyor — §5 AC6 satırı: *"'Kaydırınca oto-dondurma',
'N yeni olay ↑ En üste git' rozetinin belirmesi ve 'Devam et'te listenin sıçramadan başa dönmesi
**yalnızca** gerçek layout'un olduğu `timeline.spec.ts`'te (Playwright, gerçek `mouse.wheel`/
`Page.evaluate(() => list.scrollTop)`) doğrulanır."* Bu test hiç yazılmadı; jsdom'da da yok
(orası doğru — CEO kararı D4), yani davranışın **hiçbir katmanda** kanıtı yok.

Not: CEO kararı D4'ün endişesi ("jsdom'da kalmış kaydırma assert'i") **gerçekleşmemiş** —
jsdom'da yanlış yere konmuş bir `scrollTop` assert'i yok. Sorun tam tersi: assert hiçbir yere
konmamış.

### ÖNEMLİ

#### Ö1 — CEO'nun "zorunlu ek çit"i ölçmüyor (totoloji)

CEO düzeltmesi şunu şart koşuyordu: *"Mutasyon: URL'e `since_seq=-1` geri koy → bu test
**KIRMIZI** vermeli."*

`tests/integration/events-api.test.ts:489`:
```ts
const res = await fetch(`${handle.baseUrl}/api/events?limit=200`)
```
URL literal olarak testin içine yazılmış; `useEventStream.ts`'in kurduğu URL'den türetilmiyor.
M4 ile `src/web/lib/useEventStream.ts:124` `?since_seq=-1&limit=200` yapıldığında bu test
**YEŞİL kaldı** (`Test Files 1 passed`, `Tests 15 passed`). Yani çit, "sunucu `?limit=200`'ü kabul
ediyor" diyor; "sunucu istemcinin gönderdiği URL'i kabul ediyor" **demiyor**. Bu, mutasyon 13'ün
(kaynak-metni testi) tam olarak aynı sınıfı.

Hafifletici: E2E aynı mutasyonda 7/7 KIRMIZI verdi ve `npm run e2e` artık CI'da ayrı bir job'da
koşuyor. Bu yüzden bloklayıcı saymadım — ama CEO'nun istediği **hızlı** (`verify` içi) çit
mevcut değil.

Canlı doğrulama (gerçek sunucu):
`GET /api/events?limit=200` → **HTTP 200**; `GET /api/events?since_seq=-1&limit=200` → **HTTP 400**.
Düzeltmenin kendisi doğru.

#### Ö2 — AC5 E2E'si sözleşmenin sert assert'ini ters çevirdi; "CEO/QA'ya bildirildi" iddiası yanlış

Sözleşme §5 "AC5 E2E tasarımı" adım 4: *"rozetin `\"Bağlantı koptu\"`'ya döndüğü assert edilir
(`\"Yeniden bağlanıyor\"` ara durumu bu senaryoda **best-effort** gözlemlenir — sert bir assert'e
bağlanmaz … sert olan tek şey nihai \"Bağlantı koptu\" durumudur)."*

`tests/e2e/timeline.spec.ts:292` bunun **tam tersini** yapıyor:
```ts
await expect(shellBadge).toContainText('Yeniden bağlanıyor', { timeout: 10000 })
```
"Bağlantı koptu" hiç assert edilmiyor.

Developer'ın teknik gerekçesi (`timeline.spec.ts:282-291`) **muhtemelen doğru**: WHATWG spec'inde
`readyState = CLOSED` yalnızca "fail the connection" adımında oluşur; basit ECONNREFUSED'da
tarayıcı `CONNECTING`'de kalır. Canlı doğrulamamda da `disconnected` durumuna hiç ulaşılmadı.
Sorun kararın kendisi değil, **süreç**:
- Kod yorumu "bkz. `docs/progress.md` F-003 bölümü, CEO/QA'ya bildirildi" diyor.
  `grep -n "Yeniden bağlanıyor\|Bağlantı koptu\|readyState" docs/progress.md` → **hiç eşleşme yok**
  (yalnızca satır 625'te alakasız bir "D1" geçiyor). Bildirim yapılmamış.
- Sözleşmede bu sapmayı kaydeden bir CEO kararı (D11 vb.) yok.
- Feature notu AC5 hâlâ `[x]` ve metni "panel **'bağlantı koptu'** durumunu gösterir" diyor;
  kanıt olarak `timeline.spec.ts` AC5 gösteriliyor — o test bunu ölçmüyor.

Sonuç: `disconnected` ("Bağlantı koptu", kırmızı, `WifiOff`) durumunun **yalnızca sahte
`EventSource` ile birim testi var**; gerçek bir senaryoda ulaşılabilirliği hiç gösterilmemiş.

#### Ö3 — `/api/stream` Host/DNS-rebinding çitinin regresyon testi yok

M6 (`src/server/index.ts:237` → `if (pathname !== '/api/stream' && !isAllowedHost(...))`)
→ **314/314 YEŞİL**. `grep -rn "api/stream" tests/` → hiçbir test kötü `Host` başlığıyla
`/api/stream`'e istek atmıyor.

Koruma bugün **çalışıyor** (canlı ölçüm):
```
curl -H "Host: evil.example.com" http://127.0.0.1:7333/api/stream
{"success":false,"error":{"code":"forbidden_origin","message":"İstek kaynağı reddedildi."}}
```
Ama F-003 uzun ömürlü, yeni bir saldırı yüzeyi (`/api/stream`) ekledi ve ADR-008 kararı için
bu rotada hiçbir çit yok. Sözleşme §3 madde 3 "otomatik miras alıyor, kod değişikliği yok" diyor;
miras doğru ama test edilmemiş.

#### Ö4 — AC5 E2E'si `Last-Event-ID` telafisini yapısal olarak ölçmüyor

`timeline.spec.ts:311-313`:
```ts
// kayıpsız + çiftsiz: "önceki" olay hâlâ tam olarak bir kez görünüyor.
await expect(rowBefore).toHaveCount(1)
```
Senaryoda kesinti **sırasında hiç olay üretilmiyor**. Yeniden başlatmadan sonra ring
`{from: 0, to: 0}`, tarayıcının `Last-Event-ID`'si `0` → `computeResyncDecision` `replay` der,
`store.read(0, ringSize)` **boş** döner. Yani sunucu hiçbir telafi çerçevesi göndermez ve
`rowBefore`'un 1 kalmasını sağlayan şey istemcinin **bellekteki** state'idir; `Last-Event-ID`
hiç gönderilmese de assert yeşil kalırdı.

Gerçek telafi kanıtı entegrasyon katmanında var ve **gerçekten ölçüyor** (M1: `hello`'ya `id:`
eklendiğinde `sse-stream.test.ts` KIRMIZI). Bulgu, E2E'nin fazladan bir güvence verdiği
izleniminde — feature notu AC5 kanıtı olarak E2E'yi sayıyor.

### NOT (GEÇTİ'yi engellemez)

- **NOT-1:** `aria-live="polite"` canlı bölgesinin (`TimelineScreen.tsx:134-136`) hiç testi yok.
  Sözleşme §1 madde 4 ve §3 madde 10 erişilebilirlik kapsamına alıyor. `aria-current="page"`,
  `role="tab"`/`aria-selected` negatif assert'leri ve grup klavye alternatifi (Enter/Boşluk)
  **iyi çitlenmiş** (`App.test.tsx:42-49`, `shell.spec.ts:46-50`,
  `TimelineScreen.test.tsx:182-204`).
- **NOT-2:** `tests/integration/sse-stream.test.ts` bir kez vitest worker çökmesiyle düştü
  (`Worker exited unexpectedly with exit code 3221226505` = `0xC0000409`). Aynı komut 3 kez
  tekrarlandığında üretilemedi (3/3 yeşil, 45/45 test). Flaky risk olarak kaydedildi.
- **NOT-3:** `npm run e2e` bir kez sessizce **exit 127** verdi (bkz. §1).
- **NOT-4:** Satırda yalnızca saat gösteriliyor, tarih yok (`row-time`, `TimelineRow.tsx`).
  Canlıda dünkü 23:05 olayları bugünkü 08:20 olaylarıyla aynı biçimde görünüyor. UX doc bunu
  açıkça istemiyor; ileriki bir tur için not.

## 7. Kapsam denetimi

`git diff edc9a86..HEAD --stat` → 44 dosya, +4451/-64.

Sızma **yok**. Kontrol edilenler:
- F-005/F-006/F-007/F-008 veya Faz 2 ekranı: yok. `App.tsx:6` Kanban/Ayarlar hâlâ statik
  `<span>` placeholder.
- Sunucu taraflı filtreleme: `src/features/events/server/query.ts` diff'te **yok** — CEO kararı F
  korunmuş.
- Sanallaştırma / `react-window`: yok.
- Yeni durum yönetimi kütüphanesi: yok. `package.json` yalnızca sözleşme §2.2'de taahhüt edilen
  4 devDependency'yi ekliyor (`jsdom@27.0.1` tam sabit, `@testing-library/{react,dom,user-event}`).
- `EventDetailPanel.tsx`, `groupEvents.ts`, `icons.tsx`, `projectColor.ts` — dördü de sözleşme
  §2.1 yeni-dosya tablosunda **açıkça taahhüt edilmiş**; kapsam dışı değil.

## 8. Güvenlik denetimi

| Kontrol | Sonuç |
|---|---|
| Sabit kodlanmış sır | Yok (`src/` taraması temiz) |
| `127.0.0.1` dışı ağ literali | `tests/no-external-host.test.ts` `src/server/**` + `src/features/**` (`.ts`/`.tsx`) glob'unu yürüyor; yeni dosyalar otomatik kapsamda, test yeşil |
| `/api/stream` Host koruması | **Kodda var** (`index.ts:235-240`, `/api/` öneki route dispatch'ten önce), **canlıda çalışıyor** (403 ölçüldü) — ama **testi yok**, bkz. Ö3 |
| `/api/stream` Origin koruması | Kasıtlı olarak yok — Origin kontrolü yalnızca `POST /api/events`'te (`index.ts:241-246`). SSE için tarayıcının kendi CORS'u koruyor; ADR-008 eki bunu genişletmiyor |
| Yeni bağımlılıklar `tests/deps.test.ts` guard'ını bozdu mu | Hayır — guard `hasInstallScript` beyaz listesi + native derleme aracı taraması yapıyor, `verify` yeşil |
| `npm audit` | `found 0 vulnerabilities` |

## 9. CI denetimi

`.github/workflows/ci.yml`: `verify` job'ı (satır 6-19) değişmemiş; yeni bağımsız `e2e` job'ı
(satır 21-32, `needs` yok, `windows-latest`, `npx playwright install chromium`, `npm run e2e`)
eklenmiş. `tests/ci-workflow.test.ts:30-45` hem job'ın varlığını hem de `verify:` bloğunun
`npm run e2e` **içermediğini** dize-dilimleme ile assert ediyor. CEO kararı D2 **karşılanmış**.

`playwright.config.ts:9-10,23` — CEO kararı **D10** karşılanmış: paylaşılan `webServer`'a
`createTempDataDir()` ile geçici `MC_DATA_DIR` veriliyor, `process.on('exit')` ile temizleniyor.
AC5 bloğu (`timeline.spec.ts:239`) kendi ayrı geçici dizinini kullanıyor. Bu, F-004 hook'unun
testler koşarken canlı olay üretmesine karşı gerçek izolasyon sağlıyor.

## 10. Sekme deseni / erişilebilirlik denetimi

- `role="tab"` / `aria-selected` / `tablist`: `src/` içinde **hiç yok** (CEO kararı D8 uygulanmış).
- `shell.spec.ts` "üst çubukta tıklanabilir öğe = 0" assert'i **korunmuş ve hâlâ doğru** —
  `App.tsx:28` Zaman Çizelgesi `<span aria-current="page">`, buton değil.
- `aria-current="page"` tam olarak bir kez var (`App.test.tsx:49` sayıyı da assert ediyor).
- `role="tab"`/`aria-selected` negatif assert'leri hem birim (`App.test.tsx:46-47`) hem E2E
  (`shell.spec.ts:50`) katmanında.
- Grup klavye alternatifi (Enter/Boşluk) `TimelineRow.tsx:31-32,89-90` + testi var.
- Eksik: `aria-live` testi (NOT-1) ve B1 yüzünden `sr-only` içeriğin görünür olması.

## 11. Çalışma ağacı ve süreç temizliği

```
git diff HEAD --stat  -> (bos)
git status --porcelain -> ?? docs/qa/screens/F-003-timeline-live-2026-09-05.png
                          ?? docs/qa/screens/F-003-timeline-stil-bozuk-2026-09-05.png
```
Ürün kodunda **hiçbir kalıcı değişiklik yok**; yalnızca bu raporun ekran görüntüsü kanıtları
eklendi. `npm run verify` mutasyonlar geri alındıktan sonra tekrar 0 / 314 test.

Süreç ve port kontrolü:
- Başlangıç taban çizgisi: 2 `node.exe` (PID 28136, 25032 — Claude/MCP), hiçbir port LISTENING.
- Tüm koşular ve canlı sunucu (`npm start`, PID 5552) sonrası `taskkill /F /T` ile kapatıldı.
- Kapanış: `netstat` → 7333/7334/7335/7433/7434 hiçbirinde **LISTENING yok** (yalnızca
  `TIME_WAIT`); `tasklist` → yine tam olarak aynı 2 taban `node.exe`.
- **Yetim süreç bırakılmadı.**

## 12. Düzeltme turu için istenenler

1. **B1** — `src/features/events/web/**`'in Tailwind kaynak taramasına dahil edilmesi
   (ör. `src/web/index.css`'e `@source` yönergesi veya Vite kökü/plugin yapılandırması).
   Düzeltmeyle birlikte **regresyon çiti**: E2E'de üretilen CSS'in ekran sınıflarını içerdiğini
   veya hesaplanmış stil ölçümünü (`getComputedStyle` ile `overflow-y`/`position` gibi kritik
   birkaç değer) assert eden bir test. Aksi hâlde aynı hata bir sonraki ekranda tekrarlanır.
2. **B2** — B1 düzeltildikten sonra sözleşme §5'in taahhüt ettiği kaydırma E2E'sini yaz
   (gerçek `mouse.wheel`/`scrollTop`, oto-dondurma + "N yeni olay ↑" rozeti + "Devam et"te
   başa dönme). Mutasyon kanıtı: `setScrolledAway(el.scrollTop > 0)` → `setScrolledAway(false)`
   **KIRMIZI** vermeli.
3. **Ö1** — Entegrasyon çitini `useEventStream.ts`'in kurduğu URL'den türet (ör. URL kurucuyu
   dışa aktar ve testte onu çağır). Mutasyon: `since_seq=-1` geri konunca **bu test** KIRMIZI.
4. **Ö2** — CEO kararı gerekiyor: AC5'in rozet metni "Yeniden bağlanıyor" olarak mı sabitlenecek
   (feature notu AC5 metni + sözleşme §5 adım 4 güncellenir), yoksa `disconnected` durumunun
   gerçek bir senaryoda ulaşılabilirliği mi gösterilecek. Feature notu AC5 kanıt satırı düzeltilmeli.
5. **Ö3** — `/api/stream`'e kötü `Host` başlığıyla 403 bekleyen bir entegrasyon testi.
   Mutasyon: kontrolü bu rota için atla → KIRMIZI.
6. **Ö4** — AC5 E2E'sinin "kayıpsız" iddiasını ya gerçekten ölçülebilir hâle getir
   (kesinti sırasında olay üret) ya da iddiayı kaldırıp telafiyi entegrasyon katmanına bırak.
