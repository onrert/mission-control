---
feature: F-003
title: SSE akışı + canlı zaman çizelgesi ekranı + filtreler
author: developer
status: draft
date: 2026-09-05
revision: tur 3 (2026-09-05) — QA tur 1'in 5 BLOKLAYICI + 9 ÖNEMLİ bulgusu + CEO kararları D1-D7
  (tur 2), ardından QA tur 2'nin 3 YENİ (regresyon) bulgusu (YENİ-1/2/3) + CEO kararları D8-D10 +
  3 NOT (NOT-2/3/4) uygulandı. Bkz. sonundaki "Developer düzeltme yanıtı — tur 3".
---

# F-003 Sözleşmesi — SSE akışı + canlı zaman çizelgesi ekranı + filtreler

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-003-sse-zaman-cizelgesi.md` (6 AC + devralınan taahhütler),
`docs/02-architecture.md` §6.1 (SSE API sözleşmesi), §10 (Host/Origin), §11 (test stratejisi),
`docs/decisions/ADR-004-gercek-zamanli-tasima.md`, `ADR-003`, `ADR-008` + eki, `docs/03-ux.md`
ekran 1 ("Zaman Çizelgesi") + "Bilgi yoğunluğu ve gürültü yönetimi" + "Erişilebilirlik notları" +
"Türkçe metin sözlüğü", `docs/01-prd.md` Özellik 1 (AC2/AC3/AC7/AC9), `docs/qa/F-004-contract.md`
(biçim örneği), `CLAUDE.md` (Karpathy kuralları + Öğrenilen kurallar), `docs/HANDOFF.md`. Mevcut
kod: `src/shared/types.ts`, `src/server/index.ts`, `src/server/store/jsonl-store.ts`,
`src/features/events/server/{ingest,query,normalize}.ts`, `src/web/{App.tsx,main.tsx,index.css}`,
`package.json`, `vitest.config.ts`, `vite.config.ts`, `playwright.config.ts`,
`playwright.dev.config.ts`, `tsconfig.json`, `eslint.config.js`, `tests/no-external-host.test.ts`,
`tests/deps.test.ts`, `tests/web/App.test.tsx`, `tests/web/theme.test.ts`.

Bu turda `src/`, `tests/`, `scripts/`, `.claude/`, `package.json`, `.github/workflows/ci.yml`
altında **hiçbir dosya değiştirilmedi**; yalnızca bu sözleşme metni yazıldı. Sürüm numaraları
(jsdom/testing-library) `npm view`/`npm pack` ile gerçek npm registry'sinden ve Node sürüm
listesi `nodejs.org/dist/index.json`'dan bu turda (tur 1 ve tur 2) okundu (bkz. §6), hiçbir
dosyaya yazılmadı.

---

## 1. Kapsam

**İçinde:**

1. `GET /api/stream` SSE uç noktası + sunucu tarafı hub (`src/server/sse/**`) — `hello`, `event`,
   `resync` kanalları. `features`/`projects`/`gates` kanalları **jenerik olarak yayınlanabilir**
   (hub tek bir `broadcast(name, data, id?)` fonksiyonuyla herhangi bir kanal adını taşıyabilir,
   ADR-004 madde 1'in "tek bağlantı çok kanal" kararına sadık kalmak için) ama bu turda **hiçbir
   üretici yok** — F-005/F-007/F-008 kendi olaylarını ürettiğinde yalnızca `hub.broadcast(...)`
   çağıracaklar, taşıma katmanını yeniden yazmayacaklar. Bkz. §3 madde 1.
2. **N-1 hayalet olay düzeltmesi** (CEO kararı C) — `src/server/store/jsonl-store.ts`'te ring
   buffer'a yazma, yalnızca disk yazması BAŞARILI olduğunda olur. `GET /api/events` ve SSE `event`
   kanalı artık aynı "yalnızca kalıcı yazılan olaylar" kümesinden beslenir.
3. İstemci tarafı `src/web/lib/useEventStream.ts` — `EventSource` yaşam döngüsü, ilk yükleme
   (`GET /api/events`), seq bazlı de-duplikasyon, `resync` işleme, duraklat/oto-kaydırma dondurma
   durumu, bağlantı durumu.
4. Zaman Çizelgesi ekranı (`src/features/events/web/**`): satır/grup görünümü, filtre çip
   grupları (Proje/Agent/Tip, tamamı istemci tarafı — CEO kararı F, oturum boyunca hatırlanır,
   bkz. §3 madde 12), bağlantı rozeti (hem ortak kabuk hem ekran-yerel, **3 durum** — Bağlı/
   Yeniden bağlanıyor/Bağlantı koptu, CEO kararı D1, bkz. §3 madde 6), olay detay paneli,
   gruplama (`groupEvents`), proje renk paleti, "şimdi" vurgusu, eksik-alan rozeti, olay hızı
   göstergesi ("N olay/dk"), boş/yükleniyor/hata/"veri okunamadı" durumları (UX doc "Durum
   tasarımı" tablosu, bkz. §3 madde 11), sekme bazlı hata sınırı (`ScreenErrorBoundary`, bkz. §3
   madde 11), erişilebilirlik (aria-live, grup klavye alternatifi).
5. **Asgari `src/web/App.tsx` kablolama** (dosya sahipliği genişletmesi, gerekçe §2.2): "Zaman
   Çizelgesi" etiketi **`role`/`onClick` taşımayan, statik ama görsel/semantik olarak vurgulanmış**
   bir öğe olur — tek işaretleyici `aria-current="page"` (F-003 tek gerçek ekran getirdiği için
   tıklanacak/geçilecek başka bir sekme yok, gerçek bir `tablist`/`tab` deseni kurmuyoruz, bkz.
   Bulgu 4 düzeltmesi §3 madde 12 ve QA tur 2 YENİ-1 kararı D8) ve altında gerçek ekran koşulsuz
   render edilir; ortak kabuk başlığına bağlantı rozeti eklenir. Kanban/Ayarlar sekmeleri **aynı
   statik, tıklanamaz `<span>`'da kalır** — F-003 onları değiştirmez, `<button>`'a çevirmez (QA
   tur 1 Bulgu 4). Gerçek `role="tablist"`/`role="tab"`/`aria-controls`/ok tuşu deseni bu turda
   **kurulmuyor** — F-003 hâlâ tek ekran getirdiği için ARIA'nın zorunlu tuttuğu `tablist`
   bağlamı/`tabpanel` hedefi/klavye gezinmesi anlamsız olurdu (axe `aria-required-parent`
   ihlaline yol açardı); gerçek sekme geçişi ilk kez birden fazla ekran getiren feature'ın
   (F-005/F-007) işi olacak.
6. **`playwright.config.ts` `testMatch` genişletmesi** (dosya sahipliği genişletmesi, gerekçe
   §2.2) — yeni `timeline.spec.ts` `npm run e2e`'ye dahil olsun diye.
7. `package.json` devDependencies eklemesi (jsdom + testing-library ailesi, §6).
8. `docs/decisions/ADR-010-dom-test-altyapisi.md` **taslağı** — bu dosyanın §6'sında; CEO
   onaylarsa kalıcı ADR dosyasını CEO/architect yazacak (bu turda dosya oluşturulmuyor).

**Kapsam DIŞI (bilinçli):**

- Disk destekli sayfalama/tam geçmiş sorgusu (CEO kararı A) — `GET /api/events` değişmiyor.
- Liste sanallaştırma / `react-window` (CEO kararı B) — bkz. §3 madde 4 (render üst sınırı).
- Sunucu taraflı filtreleme (CEO kararı F) — `query.ts`'e `type`/`project_id`/`agent`/`q`
  parametresi **eklenmiyor**.
- Kanban (F-007), Kapılar paneli (F-008), proje kayıt/izleme + Ayarlar ekranı (F-005), yazma
  kapısı (F-006), Thread/Token (Faz 2), yeni sekme/ekran (CEO kararı G).
- `features`/`projects`/`gates` SSE kanallarının gerçek üreticileri (yukarı bakınız, madde 1).
- ADR-004'ün alternatifler bölümünde bahsedilen "3 kez üst üste bağlanamazsa 5 sn polling'e
  düşme" — hiçbir AC bunu istemiyor, Karpathy §2 (bkz. §9).
- Özel yeniden bağlanma/geri çekilme kodu — ADR-004 madde 3 zaten yasaklıyor, tarayıcının
  `EventSource`'una bırakılıyor. **3 durumlu rozet dahil**: `readyState`'i okuyup türetiyoruz,
  kendi retry/backoff zamanlayıcımızı yazmıyoruz (bkz. §3 madde 6, CEO kararı D1 — tur 1'de bu
  turda yalnızca 2 durum vardı, tur 2'de geri alındı).
- Global klavye kısayolları (`1`-`6` sekme geçişi, `/` arama odağı) — ortak kabuk/gelecek
  feature'ların işi, F-003 yalnızca grup expand/collapse (Enter/Boşluk) ve `aria-live`
  uygular (madde 10, erişilebilirlik).
- `lucide-react` bağımlılığı — bu turda 3 ikon elle (Lucide MIT kaynaklı SVG path'i) çizilir,
  bkz. §9.
- Dev-modu (Vite proxy) için ayrı bir SSE E2E testi — ADR-004 "Sonuçlar/riskler" son maddesi bu
  riski yalnızca prod-modu E2E'nin kapsamadığını bilinçli olarak kabul ediyor; `playwright.dev.
  config.ts`'e dokunulmuyor.
- Eşzamanlı istemci sayısı sınırı/reddi — ADR-004 "Sonuçlar/riskler" madde 1 bunu tarayıcının
  kendi HTTP/1.1 bağlantı limitine bırakıyor, kodda sınır yok (bkz. §3 madde 2).

---

## 2. Dokunacağım dosyalar

### 2.1 Yeni dosyalar

| Dosya | Amaç |
|---|---|
| `src/server/sse/hub.ts` | `formatSseFrame(name,data,id?)` (saf fonksiyon, tek kaynak SSE tel-formatı) + `createSseHub()`: `subscribe(res): unsubscribe`, `broadcast(name,data,id?)` (tüm abonelere fan-out), `closeAll()` (sunucu kapanışında/test teardown'da tüm açık `res`'leri `res.end()` ile kapatır — bkz. §3 madde 2 alt not). Dosya I/O yok, saf bellek içi kayıt defteri. |
| `src/server/sse/stream.ts` | `handleStream(req,res,store,hub,ringSize)` — `GET /api/stream` işleyicisi: başlıklar, `Last-Event-ID` çözümü, `hello`, gerekirse `resync` veya ring'den telafi, hub'a abone olma, 15 sn keepalive, `req.on('close')` temizliği. `computeResyncDecision(lastEventId, ringBounds)` saf fonksiyonu burada dışa aktarılır (birim testi için). |
| `src/web/lib/useEventStream.ts` | (Zaten dosya sahipliğinde listeliydi.) `EventSource` kurulumu (enjekte edilebilir `EventSourceImpl` parametresiyle, varsayılan `window.EventSource` — test edilebilirlik için, §6), ilk `GET /api/events` çağrısı, seq bazlı de-dup reducer, `resync` → yeniden `GET /api/events`, duraklat/dondurma durumu, bağlantı durumu (`connected`/`disconnected`), 1000 olayla sınırlı bellek. |
| `src/features/events/web/TimelineScreen.tsx` | Ekranın kökü: `useEventStream` + filtre state + gruplama + render. `App.tsx` bunu **koşulsuz olarak** (sekme geçişine bağlı olmadan, bkz. Bulgu 4 sonrası §3 madde 12) mount eder — bileşen hiç unmount olmadığı için içindeki filtre state'i doğal olarak "oturum boyunca" hayatta kalır, ayrı bir kaldırma/taşıma gerekmez. |
| `src/features/events/web/TimelineRow.tsx` | Tekil satır + katlanmış grup satırı (`GroupRow`) — aynı dosyada iki küçük bileşen. |
| `src/features/events/web/FilterChips.tsx` | Proje/Agent/Tip çoklu seçim çip grubu (tek jenerik bileşen, üç kez kullanılır) + "Filtreleri temizle". |
| `src/features/events/web/ConnectionBadge.tsx` | `CanlıDurumRozeti` (ortak kabukta, 2 durum: Bağlı/Bağlantı koptu) + ekran-yerel `CANLI`/`DUYGUSUZ` mini rozeti — aynı `connected: boolean` prop'undan iki farklı render. |
| `src/features/events/web/EventDetailPanel.tsx` | Sağdan kayan salt-okunur detay çekmecesi (UX ekran-1 kaynağı) — focus trap + `Esc` kapatma. |
| `src/features/events/web/ScreenErrorBoundary.tsx` | Sınıf tabanlı React error boundary — "sekme bazlı hata sınırı" (UX doc "Durum tasarımı" girişi). Render sırasında fırlayan hatayı yakalar, "Bu ekran yüklenemedi. [Tekrar dene]" gösterir; "Tekrar dene" `state.error`'ı sıfırlayıp yeniden render dener. `App.tsx` yalnızca aktif ekranın mount noktasını bu boundary ile sarar (bkz. §2.2, §3 madde 11). |
| `src/features/events/web/groupEvents.ts` | Saf fonksiyon: aynı `session_id`+agent'ın ardışık ≥3 `tool_call`/`tool_result` olayını `GroupItem`'a katlar. |
| `src/features/events/web/projectColor.ts` | Saf fonksiyon: proje adından 6 tonluk sabit palet döngüsünden bir Tailwind sınıf çifti döner. |
| `src/features/events/web/icons.tsx` | 3 minimal inline SVG bileşeni (`Wifi`, `WifiOff`, `AlertTriangle`) — Lucide (MIT) path verisinden elle alınmış, `lucide-react` bağımlılığı eklenmeden (bkz. §9). |
| `tests/server/sse/hub.test.ts` | Birim, sahte `res` nesneleriyle (`{write, end}` stub) — gerçek soket yok: `formatSseFrame`, `subscribe`/`broadcast` fan-out, `unsubscribe` sonrası veri gitmemesi, `closeAll()`'ın **abone olan her sahte `res`'e** `end()` çağırdığı ve iç abone listesini boşalttığı (bkz. §3 madde 2 — bu turda `closeAll()` gerçek soket/`server.close()` akışına bağlanmıyor, saf bir hub-seviyesi ilkel; §7 Bulgu 1). |
| `tests/server/sse/stream.test.ts` | Birim: `stream.ts`'ten dışa aktarılan `computeResyncDecision(lastEventId, ringBounds)` saf fonksiyonunun tüm dalları (header yok / `L===from` / `L===from-1` (bilinçli fazla-çekim, bkz. §3 madde 9) / `L===to` / **`L>to`** (yeni dal, Bulgu 3) / `ringBounds===null` / geçersiz `lastEventId` — boş dizge / `"1e3"` / `" 12 "` / `"abc"` / `"-1"` / çok büyük sayı, hepsi **`resync`** üretmeli, bkz. Bulgu 7) — I/O'suz, hızlı. |
| `tests/helpers/sse-client.ts` | `connectSse(port, headers?)`: `node:http` ile `/api/stream`'e bağlanır, ham `text/event-stream` gövdesini `\n\n` sınırına göre çerçevelere ayırıp `{event,id,data}` dizisi biriktirir; testler `waitForFrame(predicate)` ile bekler; ayrıca dönen nesne bir `closed: Promise<void>` alanı taşır (yanıt akışının `'end'`/`'close'` olayında çözülür) — istemci tarafında akışın gerçekten sonlandığını gözlemlemek için (ölçmeyen-test riski #6). F-004'ün `emit-hook.ts`/F-002'nin `startServer` desenleriyle tutarlı, yeni bağımlılık yok. |
| `tests/integration/sse-stream.test.ts` | Gerçek `createServer` + gerçek `sse-client.ts`: **`hello` çerçevesinde `id:` alanı YOK** (Bulgu 2) ve gövdesi `{seq,server_version,ring_from}`; canlı `event` teslimi + `id:`=seq; `Last-Event-ID` telafisinin ilk çerçevesinin `id`'si tam `L+1` olduğu ve akışta `id<=L` hiçbir çerçeve bulunmadığı (ölçmeyen-test riski #3 düzeltmesi); düşük `MC_RING_SIZE` ile zorlanmış `resync`; **`L>ring.to`** ve **bozuk `Last-Event-ID`** (`""`,`"1e3"`,`"abc"`) durumlarının ikisinin de `resync`'e bağlandığı ve istemcinin `GET /api/events` ile kendiliğinden toparlandığı (Bulgu 3/7, §4 "kendiliğinden toparlanma" örneği); N-1'in SSE negatif testi (503 sonrası 300 ms içinde **hiçbir** `event` gelmez) her zaman aynı bağlantı üzerinde **ardından gelen pozitif** bir `event` teslimiyle eşleştirilir (Bulgu 6, ölçmeyen-test riski #4); bağlantı `req.destroy()` ile koparılınca hub'ın abone sayısının düşmesi **ve** istemci tarafında `sse-client.ts`'in akışın bittiğini (`res.on('end'/'close')`) gözlemlediği (ölçmeyen-test riski #6); açık bir SSE aboneliği varken `stopServer`'ın (`server.closeAllConnections()` + `server.close()`) 2 sn içinde tamamlandığı (Bulgu 1). |
| `tests/features/events/web/groupEvents.test.ts` | Birim (node ortamı, DOM gerekmez). |
| `tests/features/events/web/projectColor.test.ts` | Birim. |
| `tests/features/events/web/FilterChips.test.tsx` | jsdom+RTL: çoklu seçim, varsayılan hepsi açık, temizle. |
| `tests/features/events/web/TimelineRow.test.tsx` | jsdom+RTL: AC2 alan eşlemesi + eksik-alan rozeti + "şimdi" vurgusunun 5 sn sonra sönmesi (sahte zamanlayıcı). |
| `tests/features/events/web/TimelineScreen.test.tsx` | jsdom+RTL: AC3 (tüm tipler + görünüm-yalnız filtre), AC6 dar kapsam — **yalnızca** "duraklatılmışken (`pausedByUser` veya `scrolledAway`) render edilen satır sayısı değişmez, `pendingCount` artar" (kaydırma/layout gerektiren yarısı `timeline.spec.ts`'e taşındı, bkz. §3 madde 5/madde 12, §5), grup expand/collapse (Enter/Boşluk), render üst sınırı (1000, filtresiz listeye uygulanır — bkz. §3 madde 4), boş/yükleniyor/hata/"veri okunamadı" durumlarının her biri (bkz. §3 madde 11), olay hızı hesaplaması (sahte zamanlayıcı ile "60 sn'de N olay"). |
| `tests/features/events/web/ScreenErrorBoundary.test.tsx` | jsdom+RTL: render sırasında hata fırlatan bir alt bileşenle "Bu ekran yüklenemedi. [Tekrar dene]" göründüğünü, "Tekrar dene"nin (hatayı düzelten bir yeniden render sağlanınca) içeriği geri getirdiğini, hatanın `console.error`'a bir kez loglanıp öğütülmediğini (React'in kendi çift-loglamasını maskelemeyecek şekilde) doğrular. |
| `tests/web/lib/useEventStream.test.ts` | jsdom: sahte `EventSourceImpl` + sahte `fetch` enjekte edilir; de-dup, resync→refetch, **3 bağlantı durumu geçişi** (`open` olayı→`connected`; `error` olayı + `readyState===CONNECTING`→`reconnecting`; `error` olayı + `readyState===CLOSED`→`disconnected` — bkz. §3 madde 6, Bulgu 13), ilk `GET /api/events` başarısız olursa `error` durumu + "veri okunamadı" ayrımı (bkz. §3 madde 11), sahte `fetch`'in **tam olarak bir kez, tam URL eşitliğiyle** çağrıldığı ve gövdesinde/URL'sinde filtre parametresi **hiç geçmediği** (Decision F kanıtı, çağrı sayısı dahil — ölçmeyen-test riski #5 düzeltmesi). |
| `tests/helpers/fake-event-source.ts` | `EventSource`'un test edilebilir sahte implementasyonu (`addEventListener`/`removeEventListener`/`close`/`readyState`/`dispatch(name,data)` yardımcı metodu). |
| `tests/server/graceful-shutdown.test.ts` | Birim (NOT-3 düzeltmesi): gerçek `http.Server`'a ihtiyaç yok — sahte `server` (`{close: (cb) => cb()}` stub, çağrı sırasını kaydeden) + sahte `hub` (`{closeAll: fn}`) ile `shutdown(server, hub, exitStub)` çağrılır; `hub.closeAll()`'ın `server.close()`'dan **önce** çağrıldığı (çağrı sırası dizisiyle) ve `exitStub`'ın `close()`'un callback'i çalıştıktan **sonra** `0` ile çağrıldığı assert edilir. Gerçek `SIGINT`/`SIGTERM` gönderimi test edilmez (bkz. §3 madde 2 sonu — Windows'ta programatik sinyal gönderimi güvenilir değil, §5 madde 4/NOT-2 ile aynı kısıt); bu yalnızca `shutdown()`'ın kendi mantığını (sıra + tek seferlik çağrı) doğrular. |
| `tests/web/App.interaction.test.tsx` | jsdom+RTL (YENİ-1 sonrası güncellendi — Zaman Çizelgesi etiketi tıklanabilir olmadığı için tıklama senaryosu **yok**): `TimelineScreen` App mount olur olmaz, hiçbir kullanıcı eylemi olmadan **koşulsuz** render edilir (Bulgu 4'ün QA düzeltmesi sonrası sekmeler arası geçiş yok, bkz. §3 madde 12) — bu tek başına Bulgu 12/4'ün "filtre oturum boyunca hatırlanır" gereğini karşılar çünkü unmount edecek hiçbir etkileşim yok. Bileşen kimliğinin kalıcılığı, App'te doğal olarak oluşan bir yeniden render ile kanıtlanır: sahte `EventSourceImpl` üzerinden bir `error`→`open` geçişi tetiklenip bağlantı rozetinin (App-seviyesi state) güncellendiği, buna rağmen `TimelineScreen`'in kendi içinde önceden seçilmiş bir filtrenin (ör. bir `FilterChips` seçimi) DOM'da **aynı kaldığı** assert edilir — yani App-seviyesi bir re-render `TimelineScreen`'i unmount/remount etmez. `TimelineScreen` içinde fırlayan bir hata yalnızca o ekranı `ScreenErrorBoundary` ile "Bu ekran yüklenemedi" durumuna düşürür, sekme çubuğu ve bağlantı rozeti etkilenmez. |
| `tests/e2e/timeline.spec.ts` | Playwright: AC1-AC4 ve AC6'nın "duraklat" yarısı paylaşılan Playwright `webServer`'ında (port 7333) koşar. AC5 ve AC6'nın kaydırma/oto-dondurma yarısı **kendi izole alt sunucusunu** spawn eden ayrı bir `test.describe` bloğunda koşar (gerçek `child_process`, gerçek kill/restart, gerçek tarayıcı `EventSource`) — bkz. §5 "AC5 E2E tasarımı", §8, §9. |

### 2.2 Değişecek dosyalar

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `src/server/store/jsonl-store.ts` | `append()`: `ring.push(event)` (+ taşma budaması) çağrısı **satır 195-196'dan kaldırılıp**, `queue = writeResult.then(...)` başarı geri çağrımının **içine** (satır 214-216, `lineCounts.set(...)` ile aynı bloğa) taşınır — çağırana dönen `writeResult.then(() => ({seq,id}), ...)` (satır 226-231) bu geri çağrımdan SONRA aynı `writeResult` üzerinde kayıtlı olduğu için (promise `.then()` geri çağrımları kayıt sırasına göre çalışır), `POST` yanıtı çözülmeden önce ring güncel olur — yarış yok (Bulgu 6). Yeni `getRingBounds(): {from:number; to:number} \| null` getter'ı (ring boşsa `null`; `from` = `ring[0].seq`, `to` = `ring[ring.length-1].seq`). | CEO kararı C (N-1). §7'de ayrıntılı. |
| `src/features/events/server/ingest.ts` | `handleIngest`'e yeni `hub: SseHub` parametresi eklenir; `store.append()` başarıyla dönünce `{...normalized, seq, id}` ile tam `EventRecord` kurulup `hub.broadcast('event', record, record.seq)` çağrılır. `503` dalında **hiçbir yayın yapılmaz** (N-1'in SSE tarafı, negatif test §8 mutasyon 7). | SSE'nin yalnızca kalıcı olayları yayması (§3 madde 1, §7). |
| `src/server/index.ts` | `createSseHub()` bir kez kurulur; `GET /api/stream` route'u eklenir (`handleStream(req,res,store,hub,ringSize)`); `handleIngest` çağrısına `hub` argümanı eklenir. **`hub.closeAll()` `server.on('close', ...)`'a BAĞLANMAZ** (Bulgu 1 — bu tam olarak deadlock'un kaynağıydı: açık bir SSE soketi varken `close` olayı hiç ateşlenmez, `hub.closeAll()`'ı orada çağırmak onu asla çalıştırmaz demektir). Gerçek soket kapatma ihtiyacı **test teardown'ında** `server.closeAllConnections()` ile çözülür (bkz. `tests/integration/events-api.test.ts` satırı). **NOT-3 düzeltmesi (`closeAll()` artık ölü kod değil):** `main()`'e (yalnızca `isMainModule` dalında, satır ~276-286) küçük, saf bir `shutdown(server, hub, exit = process.exit)` fonksiyonu eklenir — sırasıyla `hub.closeAll()` (açık SSE `res`'lerine `end()`), sonra `server.close(() => exit(0))` çağırır; `process.on('SIGINT', () => shutdown(server, hub))` ve aynısı `SIGTERM` için kaydedilir. Fonksiyon `export` edilir (birim testi için, `isSupportedNodeVersion`/`resolvePort` ile aynı desen) ama sinyal kaydı yalnızca gerçek süreç girişinde (`isMainModule`) olur — testler `createServer()`'ı doğrudan çağırdığı için (main() hiç koşmadan) bu handler'lar testlerde **kayıtlı olmaz**, mevcut `stopServer` akışını etkilemez. | Sunucunun SSE'yi ve N-1 düzeltmesini birbirine bağlaması gerekiyor; kapanış sırası hatası düzeltildi (§3 madde 2). NOT-3 — gerekçe ve doğrulama planı için bkz. §3 madde 2 sonu ve "Developer düzeltme yanıtı — tur 3". |
| `src/web/App.tsx` | `useEventStream()` bir kez çağrılır (App kökünde, tek bağlantı); **"Zaman Çizelgesi" etiketi `role`/`onClick` TAŞIMAZ**, yalnızca `aria-current="page"` taşıyan görsel olarak vurgulanmış statik bir öğedir (YENİ-1/CEO kararı D8 — gerçek `tablist`/`tab` deseni kurulmuyor, bkz. §1 madde 5), altında `<ScreenErrorBoundary><TimelineScreen events=... connectionStatus=.../></ScreenErrorBoundary>` **koşulsuz** render edilir (aktif-sekme `useState`'i YOK — bkz. §3 madde 12, Bulgu 4 sonrası sekmeler arası geçiş kavramı kalkıyor); filtre state'i `TimelineScreen`'in kendi içinde kalır (App.tsx'e taşınmıyor, prop yok). Kanban/Ayarlar **hiç `<button>`'a çevrilmez**, mevcut statik `<span>` placeholder'ları AYNEN kalır, F-005/F-007'ye kadar tıklanamaz. Kabuk başlığına `<ConnectionBadge variant="shell" status="connected"\|"reconnecting"\|"disconnected" />` eklenir (3 durum, Bulgu 13/CEO kararı D1). | §2.2 madde "App.tsx kablolama" — F-002'nin kendi notu ("panel-yüzeyi yarısı F-003'e devredildi... F-003 gerçek bir yüzey getirdiğinde") bunu açıkça öngörüyor; onsuz Zaman Çizelgesi ekranı **hiçbir yerde görünmez** (stub bırakma yasağı). Bulgu 4 sonrası kapsam **daraldı**: F-003 tek ekran getirdiği için sekmeler arası geçiş yok, dolayısıyla Kanban/Ayarlar'ı tıklanabilir yapmanın hiçbir işlevsel karşılığı olmazdı (F-001 "iş yapmayan buton" yasağına tam girerdi) — QA'nın istediği gibi yalnızca Zaman Çizelgesi değişiyor; bu aynı zamanda Bulgu 12'yi de ek kod olmadan çözüyor (§3 madde 12). YENİ-1 sonrası: aynı "iş yapmayan buton" gerekçesiyle Zaman Çizelgesi de `<button>` OLMUYOR (tıklaması zaten no-op olurdu) — statik `aria-current` etiketi hem F-001 yasağını hem geçersiz ARIA riskini aynı anda kapatıyor. |
| `tests/web/App.test.tsx` | "üst çubukta gerçek `<button>`/`<a>` elemanı yok" iddiası **korunur** (YENİ-1 sonrası artık doğru — Zaman Çizelgesi de buton olmuyor); eklenen tek iddia: Zaman Çizelgesi etiketinin `aria-current="page"` taşıdığı, Kanban/Ayarlar'ın taşımadığı, ve **hiçbirinin** `role="tab"`/`aria-selected` içermediği (axe `aria-required-parent` riskine hiç girilmediğinin negatif kanıtı). Diğer tüm iddialar (başlık, `data-testid`, Faz 2 ekranlarının görünmemesi) **değişmeden** kalır. | YENİ-1 — F-001'in "buton var ama iş yapmıyorsa" yasağı Zaman Çizelgesi için de geçerli kalıyor (tıklaması hâlâ no-op olurdu), bu yüzden o da `<span>`+`aria-current` kalıyor, `<button>` olmuyor. |
| `playwright.config.ts` | `testMatch: 'shell.spec.ts'` → `testMatch: ['shell.spec.ts', 'timeline.spec.ts']`. **YENİ-3 düzeltmesi:** modül üst seviyesinde `tests/helpers/temp-data-dir.ts`'ten (değişmiyor, zaten var) `createTempDataDir()` bir kez çağrılıp `webServer.env = { MC_DATA_DIR: e2eDataDir }` olarak paylaşılan sunucuya (port 7333, `shell.spec.ts`+`timeline.spec.ts`'nin AC5 dışı kısmı) verilir; `process.on('exit', () => removeTempDataDir(e2eDataDir))` ile Playwright çalıştırıcı süreci kapanırken temizlenir (best-effort — `os.tmpdir()` altında olduğu için sert bir `SIGKILL`'de bile OS temizliği devreye girer, mevcut testlerin zaten güvendiği varsayım). AC5'in kendi `test.describe` bloğu **kendi ayrı** `MC_DATA_DIR`'ini kullanmaya devam eder (§5 madde 1, değişmedi) — bu, ikisinin birbirine karışmaması içindir. | Yeni E2E dosyası `npm run e2e`'ye dahil olmadan sözleşmenin "gerçek SSE E2E" gereksinimi sağlanamaz (testMatch). MC_DATA_DIR eklemesi YENİ-3'ün gerektirdiği izolasyon (bkz. QA tur 2 YENİ-3 bulgusu). |
| `tests/e2e/shell.spec.ts` | Satır 39-40'taki "üst çubukta tıklanabilir öğe sayısı = 0" iddiası **korunur, değişmez** (YENİ-1 sonrası hâlâ doğru — Zaman Çizelgesi de buton olmadığı için tıklanabilir öğe sayısı gerçekten 0 kalıyor). Eklenen tek assert: Zaman Çizelgesi etiketinin `aria-current="page"` taşıdığı, Kanban/Ayarlar'ın taşımadığı. F-002'nin devrettiği "üçüncü renk ölçüm noktası" (satır 58-61 yorumu) karşılanır: `TimelineScreen`'in kök elemanına (`data-testid="timeline-screen"`) aynı luminance/oklch↔canvas tekniğiyle üçüncü bir arkaplan-rengi assert'i eklenir — bu artık YENİ-3'ün izole `MC_DATA_DIR`'i sayesinde deterministik (gerçek `./data`'daki tarihsel olaylarla karışmıyor). Sekme içi etkileşim derinliği (filtre/duraklat vb.) buraya **eklenmez** — o, ucuz ve deterministik olan jsdom testlerinin işi. | Devralınan N1 borcu + YENİ-1/YENİ-3 sonrası tutarlılık. Test başlığı (satır 9, NOT-5) "tıklanabilir öğe yok" ifadesiyle **aynı kalabilir** — YENİ-1 kararı sayesinde artık gerçekten doğru. |
| `package.json` | `devDependencies`'e `jsdom` **tam sabitlenmiş `27.0.1`** (caret değil — bkz. §6, Bulgu 14), `@testing-library/react@^16`, `@testing-library/dom@^10`, `@testing-library/user-event@^14` eklenir. Script değişikliği yok. `engines.node` **değişmiyor** (`>=20.11` kalıyor — seçilen jsdom sürümü zaten bununla çelişmiyor). | ADR-010 taslağı, Bulgu 14 — çelişmeyen sürüm seçildi, projenin Node tabanı değiştirilmedi (minimum blast radius). |
| `.github/workflows/ci.yml` | Mevcut `verify` job'ı **değişmeden** kalır. Yeni, bağımsız (paralel, `needs` yok) bir `e2e` job'ı eklenir: `windows-latest`, `actions/setup-node@v4` (node 22), `npm ci`, `npx playwright install chromium`, `npm run e2e`. | CEO kararı D2 — AC1/AC5'in tek kullanıcı-seviyesi kanıtı artık CI'da koşuyor; `verify` hızlı kalıyor (E2E'siz), matris hâlâ tek platform (ADR-009). |
| `tests/ci-workflow.test.ts` | Yeni assert'ler: `ciContent` içinde `'e2e:'` (job anahtarı), `'npm run e2e'`, `'playwright install'` geçiyor; `windows-latest`/`ubuntu-latest` yok/`matrix:` yok kontrolü **tüm dosyaya** (her iki job'a) genişletilmiş kalır (zaten `ciContent`'in tamamını tarıyordu); `verify:` job bloğunun içinde `npm run e2e` **geçmediğini** basit bir dize-dilimleme kontrolüyle (regex, YAML parser eklenmeden — kapalı bağımlılık listesi) doğrulayan bir test eklenir. | D2 — yeni job'un gerçekten var olduğunu ve `verify`'a sızmadığını kanıtlamadan sözleşme D2'yi karşılamış sayılmaz. |
| `tests/server/store/jsonl-store.test.ts` | N-1 için yeni test grubu eklenir (mevcut testler değişmez). | §7. |
| `tests/integration/events-api.test.ts` | N-1'in uçtan uca kanıtı için yeni test eklenir (mevcut testler değişmez). Paylaşılan `stopServer(handle)` yardımcı fonksiyonu **değişir**: `handle.server.closeAllConnections()` (Node ≥18.2 native API, tüm aktif soketleri — açık SSE bağlantıları dahil — anında yok eder, bu da `req.on('close')` temizliğini tetikler) `handle.server.close()`'dan ÖNCE çağrılır, sonra `await once(handle.server, 'close')` beklenir. Yeni test: bir SSE bağlantısı açık kalmışken `stopServer`'ın 2 sn içinde döndüğü (Bulgu 1) — bu test hem burada hem `sse-stream.test.ts`'te (aynı yardımcıyı kullanan) koşar. | §7, Bulgu 1 — mevcut `afterEach`'in askıda kalmaması SSE testlerinin ön koşulu. |

**Not — dokunulmayan ama incelenen dosyalar:** `vite.config.ts` (mevcut `/api` proxy'si SSE'yi
olduğu gibi geçiriyor — ADR-004 son bölüm, `changeOrigin` gerektirmiyor çünkü istemci ve hedef
aynı loopback'te ve Host kontrolümüz zaten port'u yok sayıyor; ✓ VERIFIED kod okunarak), `tsconfig.
json` (`lib: ["ES2022","DOM"]` zaten var, `include` `src`+`tests`'i kapsıyor, değişiklik
gerekmiyor), `eslint.config.js` (typescript-eslint recommended preset'i `.tsx`'te `no-undef`'i TS'e
bırakıyor, tarayıcı globalleri için ayrı bir `languageOptions.globals` bloğu **gerekmiyor** —
mevcut `src/web/main.tsx` zaten `document` kullanıyor ve lint 0 veriyor), `tests/no-external-host.
test.ts` (zaten `src/server/**` + `src/features/**` (`.ts`/`.tsx`) yürüyor — yeni dosyalarım bu
glob'un altına otomatik giriyor, dosyaya dokunmaya gerek yok, ✓ VERIFIED kod okunarak), `tests/
deps.test.ts` (yeni paketler eklenince otomatik çalışacak, dosyanın kendisi değişmiyor),
`playwright.dev.config.ts` (§1 "Kapsam DIŞI" — yalnızca `npm run e2e` CI'a bağlanıyor, D2
`e2e:dev`'i istemiyor), `src/server/index.ts`'teki `isSupportedNodeVersion`/`>=20.11` kontrolü ve
`package.json`'ın `engines.node` alanı (Bulgu 14 seçilen jsdom sürümüyle çelişmediği için **bu
turda dokunulmuyor** — bkz. §6, minimum blast radius), `docs/02-architecture.md` (G2 onaylı,
developer'ın sahiplik alanı dışında — `lucide-react` önerisi §9'da CEO'ya not olarak bırakıldı,
kendim eklemedim).

---

## 3. Tasarım kararları

### 1) Hub jenerik ama F-003 yalnızca 3 kanal yayınlıyor

`createSseHub()` tek bir `broadcast(name: string, data: unknown, id?: number)` alır — `name`
sabit bir union'a kilitlenmez (ADR-004'ün 6 kanalının hepsini taşıyabilsin diye). F-003 bu turda
yalnızca `hello` (bağlantı açılışında, doğrudan `stream.ts`'ten, hub'tan geçmeden — tek alıcıya
özel), `event` (`ingest.ts`'ten, başarılı yazımda), `resync` (`stream.ts`'ten, tek alıcıya özel,
reconnect anında) üretir. `features`/`projects`/`gates` için üretici **yok** — bu, "ileride lazım
olur" kodu değil; ADR-004 zaten kabul edilmiş bir mimari kararı, F-003 onu **uygulamadan
kırmamak** için taşımayı genel tutuyor (aksi hâlde F-005/F-007 taşıma katmanını F-003'ün üstüne
yeniden yazardı — bu daha büyük bir maliyet olurdu).

### 2) Bağlantı yaşam döngüsü: 15 sn keepalive, sınırsız eşzamanlı istemci, `closeAll()` test teardown'ında VE gerçek `SIGINT`/`SIGTERM`'de kullanılıyor (QA tur 1 Bulgu 1 + tur 2 NOT-3 sonrası düzeltildi)

- **Keepalive:** her açık bağlantı için `setInterval(() => res.write(': keepalive\n\n'), 15000).
  unref()`; `req.on('close')` içinde `clearInterval`. Yorum satırı, ADR-004 madde 6'nın belirttiği
  gibi yalnızca **taşıma seviyesinde** canlılık sağlar (ara katman/OS'a "bu soket ölü değil"
  sinyali) — tarayıcı JS'i bu satırı **hiç göremez** (bkz. §9 bilgi notu, ADR-004 metninin
  literal "istemci 45 sn'de kapatır" cümlesiyle uzlaştırma).
- **`hub.closeAll()` gerçek soket kapanışına BAĞLANMAZ** (tur 1'deki tasarım hatası, Bulgu 1):
  Node'da `http.Server`'ın `'close'` olayı **tüm** bağlantılar bitene kadar ateşlenmez; açık bir
  SSE soketi varken `server.on('close', () => hub.closeAll())` yazmak `closeAll()`'ı hiçbir zaman
  çalıştırmayan bir kilit yaratır (`server.close()` onu asla tetiklemediği için `'close'` de
  gelmez → döngüsel bekleme). Test teardown'ında ihtiyaç, hub'tan bağımsız olarak, Node'un kendi
  `server.closeAllConnections()`'ı (≥18.2 native API) ile test yardımcı fonksiyonunda çözülür —
  bu, hub'ın abone listesini okumaya/dolaşmaya gerek kalmadan **tüm** aktif soketleri (SSE dahil)
  anında yok eder, bu da her SSE bağlantısının kendi `req.on('close')` temizliğini (unsubscribe +
  `clearInterval`) tetikler (§2.2 `tests/integration/events-api.test.ts`).
  **NOT-3 düzeltmesi:** `hub.closeAll()` artık üretimde de bir çağrı yeri kazanıyor —
  `main()`'e (`isMainModule` dalı) eklenen küçük bir `shutdown(server, hub, exit=process.exit)`
  fonksiyonu `SIGINT`/`SIGTERM`'de `hub.closeAll()`'ı `server.close()`'dan ÖNCE çağırır (§2.2
  `src/server/index.ts`). Bu, gerçek dünyada bir geliştiricinin `npm start` çalışırken terminalde
  Ctrl+C basmasını (Windows konsolunda `SIGINT`/`CTRL_C_EVENT` foreground sürece güvenilir şekilde
  iletilir — bu, §5 madde 4/NOT-2'nin bahsettiği "başka bir süreçten programatik `child.kill()`"
  kısıtından FARKLI bir senaryodur) düzgün kapanan bir sürece çeviriyor: açık SSE bağlantıları
  `res.end()` ile bilgilendirilip kapatılıyor, sonra sunucu kapanıyor. `shutdown()` `export`
  edilir ve doğrudan çağrılarak (gerçek sinyal göndermeden) birim testlenir — bkz. §2.1
  `tests/server/graceful-shutdown.test.ts`; **gerçek `SIGINT`/`SIGTERM` gönderimi otomatik testte
  doğrulanmaz** çünkü Windows'ta başka bir süreçten programatik sinyal iletimi güvenilir değildir
  (aynı kısıt §5 madde 4'te ölçüldü) — bu, manuel bir duman testi olarak kalır (bkz. "Developer
  düzeltme yanıtı — tur 3").
- **Eşzamanlı istemci sınırı: YOK.** ADR-004 "Sonuçlar/riskler" madde 1 bunu bilinçli olarak
  tarayıcının kendi HTTP/1.1 host-başı bağlantı limitine (6) bırakıyor; kodda sayaç/red mekanizması
  **eklenmiyor** (Karpathy §2 — ADR zaten "UI 'başka bir sekmede açık' uyarısı vermez, gereksiz
  karmaşıklık" diyor).

### 3) Host/Origin: `/api/stream` mevcut korumayı otomatik miras alıyor, kod değişikliği yok

`src/server/index.ts`'in router'ı **her** `/api/*` isteğinde dispatch'ten önce `isAllowedHost`
çalıştırıyor (✓ VERIFIED, `index.ts` satır ~200 civarı, route eşleşmesinden önce). `/api/stream`
bu önekin altına eklendiği an Host koruması otomatik uygulanır — ek kod gerekmez. `Origin`
kontrolü şu an yalnızca `POST /api/events`'te çağrılıyor (✓ VERIFIED); mimari §10 "GET uçları
Origin yokluğunu kabul eder (SSE, doğrudan tarayıcı gezinmesi)" diyor — `/api/stream` bir `GET`
olduğu için Origin kontrolüne **tabi tutulmuyor**, mevcut davranışla tutarlı. `EventSource`'un
gönderdiği başlıklar: aynı-origin bir `GET` isteği olduğu için tarayıcılar `Origin` başlığını
**göndermez** (yalnızca cross-origin veya `POST` gibi "complex" isteklerde eklenir — WHATWG Fetch
spec davranışı, kodda test edilecek varsayım değil, mevcut `isAllowedOrigin(undefined) === true`
davranışıyla zaten uyumlu); `Host` her zaman gönderilir (HTTP/1.1 zorunlu başlığı); reconnect'te
`Last-Event-ID` otomatik eklenir (WHATWG EventSource spec — "user agents must include ...
Last-Event-ID request header").

### 4) İstemci durum yönetimi: `useReducer`, seq bazlı de-dup, 1000 olay üst sınırı

Yeni state kütüphanesi (Redux/Zustand) **eklenmiyor** — tek bir `useReducer` (olay listesi
`Map<seq, EventRecord>` iç temsili + türetilmiş sıralı dizi) yeterli; tüketici tek bileşen
(`TimelineScreen`), çapraz-bileşen paylaşım yok (bağlantı durumu App kökünden prop olarak iner,
ekstra context/store gerektirmez — tek seviye prop iletimi). **Render/bellek üst sınırı: 1000
olay, filtresiz asıl listeye uygulanır** (Bulgu 9 düzeltmesi — tavan, ekrandaki görünür/filtrelenmiş
alt kümeye değil, `useEventStream`'in tuttuğu **tam** listeye uygulanır; filtre yalnızca bu 1000
olayın üstünde bir görünüm süzgecidir, CEO kararı F ile tutarlı: filtre kayıt kümesini asla
değiştirmez, o kayıt kümesinin *bu istemcideki* üst sınırı da filtreden bağımsızdır). Aşımda en
eski olay(lar) hem bellekten hem render'dan düşer — ayrı iki katman yok, tek sınır. "Devam et"in
UX'teki "o ana kadar biriken **tüm** olaylarla devam eder" ifadesi bu tavanla **çelişmiyor** ama
kelimesi kelimesine doğru değil; sözleşme bunu netleştirir: "biriken, 1000 olayı aşmayan tüm
olaylar" — tavanı aşan (yani duraklıyken gelen 1000'den fazla olay) en eskiden düşer. Kullanıcı
ayrıca bilgilendirilmez (ek bir "N olay düştü" uyarısı **eklenmiyor** — Karpathy §2: zaten var
olan "N yeni olay ↑" rozeti kullanıcıyı birikimden haberdar ediyor, ikinci bir uyarı katmanı
ölçülmüş bir ihtiyaç olmadan eklenen karmaşıklık olurdu; 1000 olayı aşacak kadar uzun bir
duraklama pratikte nadir ve kullanıcının kendi seçimi). Gerekçe (sayı): varsayılan `MC_RING_SIZE`
2000'in yarısı; sıkı yoğunluk satırı (~28px, UX §"Boşluk sistemi") × 1000 ≈ 28.000px DOM
yüksekliği — modern tarayıcılarda düz `flex`/`div` satırlarının sanallaştırmasız kalabileceği
genel kabul görmüş eşik birkaç bin satırdır; CEO kararı B ölçülmüş bir ihtiyaç olmadan
`react-window` eklenmesini yasaklıyor, bu sayı o ölçütü karşılıyor. Ölçülmüş bir performans
sorunu çıkarsa (E2E'de veya gerçek kullanımda) sanallaştırma **o zaman** değerlendirilir. De-dup,
gerek initial `GET /api/events`, gerek canlı `event`, gerekse `resync` sonrası yeniden-fetch
**aynı** `ADD_EVENTS(records)` reducer aksiyonundan geçer — `seq` zaten `Map` anahtarıysa yok
sayılır (idempotent birleştirme), bu da initial-load/live-event yarışını (bkz. madde 8) ayrı kod
olmadan çözer.

### 5) Duraklat: `pausedByUser` ve `scrolledAway` iki bağımsız bayrak, `frozen` ikisinin OR'u (Bulgu 8 düzeltmesi)

Tur 1'in tek `frozen: boolean` tasarımı iki farklı kullanıcı niyetini (manuel Duraklat butonu vs.
kullanıcının listeyi yukarı kaydırması) tek bir bayrakta birleştiriyordu — bu, "Duraklat'a basıp
sonra en üste kaydırınca duraklatmanın sessizce iptal olması" ve tersi gibi istenmeyen çapraz
etkiler doğuruyordu; UX doc bu ikisini ayrı davranışlar olarak tanımlıyor (satır 78-79). Düzeltme:
iki bağımsız `boolean` state — `pausedByUser` (yalnızca "Duraklat"/"Devam et" butonuna tıklamayla
değişir) ve `scrolledAway` (yalnızca liste `scrollTop`'u 0'dan uzaklaştığında `true`, listenin
başına dönüldüğünde `false` olur — E2E'de ölçülür, bkz. §3 madde 11/§5, jsdom'da ölçülmez). Render
edilen listeye yeni olay eklenip eklenmeyeceğini belirleyen türetilmiş değer:
`frozen = pausedByUser || scrolledAway`. Davranışlar:
- **Duraklat + en üste kaydır → hâlâ duraklı** (`pausedByUser` hâlâ `true`, `scrolledAway` `false`
  olsa da `frozen` `true` kalır) — yalnızca "Devam et" `pausedByUser`'ı kaldırabilir.
- **Kaydırılmışken "Devam et"e basmak yalnızca duraklatmayı kaldırır**: UX'te "Devam et" butonu
  yalnızca manuel Duraklat durumunda görünür; kaydırma kaynaklı dondurmanın kendi eylemi "N yeni
  olay ↑ En üste git" rozetidir — ikisi de aynı `resume()`'u çağırır (`pausedByUser=false`,
  `scrolledAway=false`, `pendingBuffer` ana diziye taşınır, liste başa kaydırılır); farkları
  yalnızca hangi UI elemanının tetiklediğidir, alttaki mekanizma tek (Karpathy §2 — iki ayrı
  mekanizma yazılmıyor).
`frozen` iken gelen olaylar render edilen diziye eklenmez, ayrı bir `pendingCount`/
`pendingBuffer`'da tutulur (hiçbir olay kaybolmaz — hepsi zaten `useEventStream`'in kendi
state'inde var, yalnızca "görünür" listeye alınmıyor).

### 6) Bağlantı rozeti: 3 durum — Bağlı/Yeniden bağlanıyor/Bağlantı koptu (CEO kararı D1, Bulgu 13 düzeltmesi)

Tur 1'in "yalnızca 2 durum, `CONNECTING`/`CLOSED` ayrımı güvenilir değil" gerekçesi **yanlıştı**
ve CEO tarafından reddedildi: WHATWG `EventSource` spec'i şu davranışı garanti eder — bağlantı
koptuğunda ve tarayıcı native olarak yeniden denerken (`reconnect timeout` sırasında)
`readyState`, `error` olayı dispatch edilmeden **önce** `CONNECTING`'e döner; yalnızca "kalıcı
başarısızlık" durumlarında (spec'in "fail the connection" adımı — ör. ilk bağlantıda 2xx
olmayan/yanlış `Content-Type` yanıt, veya `.close()` çağrısı) `readyState` `CLOSED` olur ve
tarayıcı **bir daha denemez**. Yani `CONNECTING` ile `CLOSED` arasında native API'de gerçek ve
gözlemlenebilir bir ayrım **var**. Uygulama: `useEventStream`, `EventSourceImpl`'e `'open'` ve
`'error'` dinleyicileri ekler:
- `'open'` olayı → `status = 'connected'` ("Bağlı", emerald, `Wifi`).
- `'error'` olayı, `es.readyState === EventSourceImpl.CONNECTING` iken → `status = 'reconnecting'`
  ("Yeniden bağlanıyor", amber, pulsing `Wifi`, UX doc satır 58).
- `'error'` olayı, `es.readyState === EventSourceImpl.CLOSED` iken → `status = 'disconnected'`
  ("Bağlantı koptu", red, `WifiOff`) — bu, spec'in "fail the connection" adımına girdiği,
  **kalıcı** ve native reconnect'in bir daha denemeyeceği tek durumdur (bkz. §4 "Hata/kalıcı
  başarısızlık" paragrafı, aynı düzeltme).
İlk bağlanma anında (henüz hiç `open`/`error` gelmeden) durum `'connecting'` olarak başlatılır ve
rozette "Yeniden bağlanıyor" ile aynı görsel muameleyi görür (ayrı bir 4. durum **eklenmiyor** —
UX doc yalnızca 3 durum tanımlıyor, ilk bağlanma "henüz Bağlı değil" anlamında Yeniden
bağlanıyor'un bir alt kümesi sayılır). Zamanlama riski (native reconnect gecikmesi tarayıcıya
göre değişir, E2E'de `reconnecting` durumunu yakalamak flaky olabilir) §9'da ayrıca not edilmiştir.

### 7) Ekran-yerel `CANLI`/`DUYGUSUZ` rozeti — aynı `connected` değerinden ikinci render

UX ekran-1'in durum çubuğu "canlı rozet (`CANLI`/`DUYGUSUZ`)" ayrı bir kelime çiftiyle gösteriyor.
Bu, ortak kabuğun 3-değerli "Bağlı/Bağlantı koptu/Yeniden bağlanıyor" rozetinden **farklı bir
bileşen örneğidir**, aynı 3-değerli `status`'tan türetilen ikili bir izdüşümdür:
`connected = status === 'connected'`, sonra `connected ? 'CANLI' : 'DUYGUSUZ'` (yani hem
`reconnecting` hem `disconnected` bu mini rozette `DUYGUSUZ` olarak birleşir — UX doc bu rozet
için yalnızca 2 kelime tanımlıyor, 3. bir kelime **icat edilmiyor**). İki metin
**literal olarak** JSX'e yazılır (CSS `text-transform:uppercase` KULLANILMAZ — CLAUDE.md'nin
`lang="tr"` + `uppercase` yasağı, F-001'in "MİSSİON CONTROL" hatasıyla aynı sınıf risk). Sözlükte
"Duyguşuz" (ş ile) yazıyor ama ekran-1 wireframe'i "DUYGUSUZ" (düz s) gösteriyor — gerçek Türkçe
sözcük "duygusuz"dur (`-sız/-siz/-suz/-süz` eki her zaman düz `s` alır, `ş` hiçbir zaman) —
sözlükteki "Duyguşuz" bir yazım hatısı olarak değerlendirildi, uygulamada **"Duygusuz"** (düz s,
baş harf büyük, madde 6'daki gibi literal yazılır) kullanılacak. Bkz. §9.

### 8) İlk yükleme + canlı akış arasında yarış yok: senkron replay + subscribe

`stream.ts`'te bağlantı açıldığında: (1) `Last-Event-ID` çözülür, (2) `store.getRingBounds()`
okunur (senkron), (3) `resync` gerekiyorsa gönderilir; gerekmiyorsa `store.read(lastEventId,
ringSize)` ile eksik olaylar **senkron** yazılır, (4) hemen ardından, **aynı senkron blokta**,
`hub.subscribe(res)` çağrılır. Node tek iş parçacıklı olduğu için (2)-(4) arasında hiçbir başka
kod çalışamaz — bir `broadcast` bu pencerede asla "kaybolamaz" (ne çift gönderilir ne atlanır).
İstemci tarafında ayrıca `useEventStream`'in `ADD_EVENTS` reducer'ı seq bazlı de-dup yaptığı için
(madde 4), ilk `GET /api/events` çağrısı ile SSE üzerinden aynı anda gelen bir olay çakışsa bile
(örn. sayfa ilk açılışında REST çağrısı devam ederken yeni bir olay SSE'den gelirse) sonuç
kümesi bozulmaz — iki kaynak da aynı state'e "ekleme" yapar, hangisi önce gelirse gelsin.

### 9) `hello` yalnızca bilgi taşır; ilk yükleme her zaman `GET /api/events`'ten gelir

Mimari §6.1'in API tablosu `hello`'nun gövdesini `{seq, server_version, ring_from}` olarak
sabitliyor (olay dizisi YOK) — ADR-004'ün düzyazısındaki "hello + son N olay" ifadesiyle çelişiyor
gibi görünse de, CEO kararı A ("ilk yükleme ring buffer'dan/mevcut `GET /api/events`'ten gelir")
bu çelişkiyi API tablosu lehine çözüyor: istemci `hello`'yu yalnızca "sunucu şu an seq X'te,
ring Y'den başlıyor" bilgisi için okur (şu an kullanılmıyor bile — gelecekte teşhis/health amaçlı
faydalı olabilir), gerçek ilk render **her zaman** ayrı bir `GET /api/events?limit=200` (since_seq PARAMETRESİ
GÖNDERİLMEZ — CEO düzeltmesi, dosya sonu)
çağrısıyla doldurulur (App/TimelineScreen mount olduğunda, `EventSource` açılışından bağımsız;
`limit=200`, CEO kararı A uyum kontrolünün istediği somut değer — PRD F1/AC6'nın "≥100 olay"ını
rahatça karşılıyor, `MC_RING_SIZE` varsayılanı 2000'in %10'u, keyfi ama makul bir yuvarlak sayı).
**Tel formatında `hello` çerçevesi artık `id:` satırı TAŞIMAZ** (Bulgu 2 — bkz. §4): yalnızca
`event:`/`data:` içerir, `id:` yalnızca gerçek `event` çerçevelerinde bulunur. Sebep: WHATWG
`EventSource` spec'i her dispatch edilen olayın `id:`'sini istemcinin "son olay kimliği tamponu"na
yazar ve bir sonraki reconnect'te `Last-Event-ID` olarak gönderir; `hello`'ya `id: ringBounds.to`
koymak istemcinin `Last-Event-ID`'sini bağlantı **daha hiçbir `event` almadan** ring'in sonuna
sıçratıyordu — `hello` ile ilk telafi çerçevesi arasında kopma olursa `(L, ring.to]` aralığı
kalıcı olarak kaybolurdu. `id:` yalnızca olay `seq`'i olmalı (mimari §6.1, ADR-004 madde 2).

### 10) Erişilebilirlik: `aria-live` yalnızca durum değişikliklerinde, grup klavye alternatifi

UX doc birebir: "Zaman çizelgesindeki her yeni olay ekran okuyucuya anons edilmez ... yalnızca
durum değişiklikleri (... bağlantı koptu/geri geldi) `aria-live=\"polite\"` ile duyurulur." Tek bir
görünmez `<div aria-live="polite" className="sr-only">` bağlantı durumu **değiştiğinde** metnini
günceller (yeni olay eklendiğinde GÜNCELLENMEZ). Grup satırları `role="button" tabIndex={0}
aria-expanded={...}`, `Enter`/`Boşluk` ile genişler/daralır (UX "Kısayollar" maddesi, yalnızca bu
ekrana yerel kısım uygulanıyor — global `1`-`6`/`/` kısayolları kapsam dışı, §1). Hedef boyutu:
tüm tıklanabilir öğeler (`button`, çip) en az `32px` yükseklik (`py-1.5`/`min-h-8` Tailwind
sınıfları). Renk körlüğü: bağlantı/eksik-alan rozetleri her zaman ikon+metin birlikte (madde 6/7,
UX "Renk körlüğü kuralı").

### 11) Durum tasarımı: boş/yükleniyor/hata/"veri okunamadı", sekme bazlı hata sınırı, olay hızı (Bulgu 12 düzeltmesi)

UX doc "Durum tasarımı" tablosunun Zaman Çizelgesi satırı G3'te onaylandı; tur 1 sözleşmesi
bunları atlamıştı. Beşi de bu turda uygulanıyor, hepsi `TimelineScreen.tsx` içinde, yeni dosya
gerektirmeden (yalnızca `ScreenErrorBoundary.tsx` istisna, aşağıda):
- **Boş durum:** `events.length === 0` ve yükleme bitmişse `"Henüz olay yok. İzlenen bir
  projede bir agent çalıştığında burada görünecek."` (UX doc satır 287, birebir). "Hiç proje
  yoksa: Ayarlar'a git" varyantı **uygulanmıyor** — F-003'ün hiçbir API'si "kaç proje izleniyor"
  bilgisini taşımıyor (proje kaydı F-005'in işi, bu turun kapsamı dışı, §1); bu, gözlemlenebilir
  hiçbir AC'yi değiştirmiyor çünkü F-005 gelene kadar zaten hiç izlenen proje kavramı yok — tek
  varyant (jenerik boş metin) yeterli, ikinci varyant F-005 ile birlikte eklenir.
- **Yükleniyor:** ilk `GET /api/events` çağrısı beklerken iskelet satırlar + üstte
  `"Son 100 olay yükleniyor…"` (UX doc birebir metin, sayı `limit`'ten bağımsız sabit dize —
  UX doc'un kendisi "100" yazıyor, `limit=200` seçimiyle çelişse de literal metin UX doc'tan
  aynen alınıyor, davranışı etkilemiyor).
- **Hata (ilk yükleme başarısız):** `GET /api/events` ilk çağrısı reddedilirse kırmızı banner
  `"Olay geçmişi yüklenemedi. [Tekrar dene]"`, liste boş kalır, "Tekrar dene" aynı çağrıyı
  yeniden dener (UX doc birebir).
- **"Veri okunamadı" (sonraki bir yeniden-yükleme başarısız, akış canlı):** yalnızca `resync`
  sonrası tetiklenen yeniden-`GET` başarısız olursa ve SSE bağlantısı hâlâ `connected`/
  `reconnecting` ise `"Olay deposu okunamadı, ancak yeni gelen canlı olaylar gösterilmeye devam
  ediyor."` — mevcut liste **temizlenmez**, yalnızca bu bilgi metni gösterilir (UX doc birebir;
  bu, "Hata" durumundan farklıdır çünkü burada zaten gösterilecek veri var).
- **Sekme bazlı hata sınırı:** `App.tsx`, aktif ekranın mount noktasını `ScreenErrorBoundary`
  (§2.1 yeni dosya) ile sarar; `TimelineScreen` render sırasında fırlarsa yalnızca o ekranın
  içerik alanı `"Bu ekran yüklenemedi. [Tekrar dene]"` durumuna düşer, sekme çubuğu/bağlantı
  rozeti/diğer sekmeler etkilenmez (UX doc "Durum tasarımı" girişi, birebir).
- **Olay hızı ("N olay/dk"):** `TimelineScreen`, görünür (filtresiz) olay listesindeki
  zaman damgası son 60 saniye içinde olan olayları sayıp durum çubuğunda gösterir; her yeni olay
  eklendiğinde ve ayrıca 1 sn'lik bir `setInterval` ile (eski olaylar pencereden çıktıkça sayı
  düşsün diye, olay gelmese bile) yeniden hesaplanır — yeni bir bağımlılık veya sunucu değişikliği
  gerektirmez, tamamen türetilmiş istemci-taraflı bir değer.

### 12) Filtre hafızası: `TimelineScreen` hiç unmount olmadığı için state zaten kalıcı (Bulgu 12 düzeltmesi, Bulgu 4 ile birleşik)

UX doc "Bilgi yoğunluğu" madde 1: "Filtre seçimi tarayıcı oturumu boyunca hatırlanır." Tur 1'in
tasarımı bu gereği karşılamıyordu çünkü tur 1'de Kanban/Ayarlar de gerçek `<button>`'a çevrilip
"aktif sekme" `App.tsx`'te bir `useState` ile tutuluyordu — `TimelineScreen` yalnızca Zaman
Çizelgesi aktifken koşullu mount ediliyordu, Kanban'a geçmek onu unmount edip filtre state'ini
sıfırlıyordu. Bulgu 4'ün QA düzeltmesiyle (yukarıda, §2.2 `App.tsx` satırı) Kanban/Ayarlar hiç
`<button>`'a çevrilmiyor ve **sekmeler arası geçiş kavramı tamamen kalkıyor** — F-003 tek gerçek
ekran getiriyor (CEO kararı G), dolayısıyla `App.tsx`'te "aktif sekme" state'i de gerekmiyor:
`TimelineScreen` App mount olur olmaz koşulsuz render edilir ve hiçbir kullanıcı eylemiyle
unmount olmaz. Sonuç: filtre state'i `TimelineScreen`'in kendi içinde kalabilir (App.tsx'e
taşımaya, prop drilling'e gerek yok) — bileşen hiç unmount olmadığı için "oturum boyunca
hatırlanır" gereği **ek kod yazılmadan** karşılanır (Karpathy §2 — sorunu çözen en basit yapı,
var olmayan bir sekme-geçiş mekanizması için state kaldırma altyapısı kurmuyoruz). Kapsam
bilinçli olarak dar: "tarayıcı oturumu boyunca" yalnızca React bileşen ömrünü kapsıyor, sayfa
**yenilemesini** (F5) kapsamıyor — `sessionStorage` hiçbir AC tarafından istenmiyor, eklenmiyor.
İleride F-005/F-007 gerçek sekme geçişi getirdiğinde (Kanban/Ayarlar gerçek ekranlar olduğunda),
o zaman filtre state'inin nereye taşınacağı o feature'ın kararı olur — bu turun kapsamı dışı.

**YENİ-1/CEO kararı D8 eklentisi:** Bu turun "sekmeler arası geçiş kavramı tamamen kalkıyor"
kararının doğal sonucu olarak, Zaman Çizelgesi etiketi de bir `tablist`/`tab` deseni **kurmuyor**
(bkz. §1 madde 5) — yalnızca `aria-current="page"` taşıyan statik bir öğe. Gerçek `role="tablist"`/
`role="tab"`/`aria-controls`/ok tuşu deseni, ARIA'nın zorunlu tuttuğu bağlamı (birden fazla
`tab`+`tabpanel`) sağlayacak ilk feature'ın (F-005/F-007) işidir; F-003'te kurulursa tek elemanlı,
bağlamsız bir `tab` axe'in `aria-required-parent` kuralını ihlal eder ve hiçbir gerçek klavye/
ekran-okuyucu faydası sağlamaz. **NOT-4 (devralınan sekme borcu):** `docs/03-ux.md` satır 19
tıklanamaz/yarım sekmeleri, satır 21 Ayarlar'ın sekme çubuğunda durmamasını (sağda sabit dişli
ikonu) öngörüyor — Kanban/Ayarlar'ın hâlâ ölü `<span>` olması bu turun yarattığı bir şey değil,
F-001/F-002'den devralınan bir borç. F-003 bunu kapatmıyor; UX satır 19/21'e göre yeniden düzenleme
(Ayarlar'ın dişli ikonuna taşınması, Kanban'ın F-007 ile gerçek sekme olması) o feature'ların işi
olarak kalıyor.

---

## 4. SSE sözleşmesi

**Uç nokta:** `GET /api/stream`. Başlıklar: `Content-Type: text/event-stream; charset=utf-8`,
`Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`. `res.flushHeaders()`
hemen çağrılır (ADR-004 madde 7).

**Bağlantı açılışı (her zaman) — `id:` satırı YOK (Bulgu 2 düzeltmesi, §3 madde 9):**
```
event: hello
data: {"seq": <ringBounds?.to ?? null>, "server_version": "<pkg.version>", "ring_from": <ringBounds?.from ?? null>}
```

**`Last-Event-ID` ayrıştırma kuralı (Bulgu 7 düzeltmesi):** header değeri **tam olarak**
`/^[0-9]+$/` desenine uymalı (baş/son boşluk, işaret, ondalık, üstel gösterim, boş dizge —
**hepsi geçersiz**; `Number()`'ın gevşek semantiği KULLANILMAZ). Geçerliyse `Number.parseInt`
ile tam sayıya çevrilir (güvenli aralık: `Number.MAX_SAFE_INTEGER`'ı aşan bir dizge de geçersiz
sayılır). Header hiç yoksa (ilk bağlanma) bu, "geçersiz" ile **aynı dal değildir** — ayrı bir durum.

**`Last-Event-ID` çözümü (`computeResyncDecision`, saf fonksiyon) — Bulgu 3/7 düzeltmesi:**
```
header yok (ilk bağlanma)                    → hiçbir şey yapma, canlı akışa geç (CEO kararı A)
header var ama yukarıdaki kurala göre GEÇERSİZ → event: resync  { reason: "gap" }  (kayıpsız taraf)
ringBounds === null (ring hiç dolmamış)       → event: resync  { reason: "gap" }
lastEventId < ringBounds.from                 → event: resync  { reason: "gap" }
lastEventId > ringBounds.to (istemci ileride — veri dizini silinmiş/`.seq` sıfırlanmış/eski
  yedeğe dönülmüş)                            → event: resync  { reason: "gap" }  (YENİ dal, Bulgu 3)
ringBounds.from <= lastEventId <= ringBounds.to → store.read(lastEventId, ringSize) sırayla
                                                  "event" çerçeveleri olarak gönder, sonra
                                                  canlı akışa geç
```
Not (bilgi, düzeltme değil): `lastEventId === ringBounds.from - 1` teknik olarak gereksiz bir
`resync` üretir (`from..to` zaten ring'de, kayıp yok) — ADR-004 madde 4'ten miras bir off-by-one,
kayıpsız ama pahalı (tam yeniden yükleme). Bilinçli kabul edildi, düzeltilmiyor (kayıpsız taraf
zaten tercih edilen taraf, madde daha karmaşık bir sınır koşulu getirmeden basitçe düzeltilemiyor).

**Canlı olay (`ingest.ts`'ten, yalnızca başarılı yazımda):**
```
event: event
id: <seq>
data: <EventRecord JSON>
```

**Keepalive (15 sn'de bir, tüm bağlantılarda):** `: keepalive\n\n` (yorum satırı, JS'e görünmez).

**Örnek akış (yeni istemci, ring'de 40 olay var, en yenisi seq=139):**
```
< event: hello
< data: {"seq":139,"server_version":"0.1.0","ring_from":100}
<
  (canlı akış başlar, henüz Last-Event-ID yok → resync/replay YOK — hello id: taşımadığı için
   istemcinin dahili "son olay kimliği" değeri hâlâ boş, bir sonraki gerçek reconnect'te
   Last-Event-ID header'ı GÖNDERİLMEZ, ilk bağlanma dalına düşer)
< event: event
< id: 140
< data: {"seq":140, ...}
<
: keepalive
```

**Örnek akış (reconnect, istemci `Last-Event-ID: 140` gönderdi, sunucu hâlâ ring_from=100'de):**
```
< event: hello
< data: {"seq":141,"server_version":"0.1.0","ring_from":100}
<
< event: event
< id: 141
< data: {"seq":141, ...}
<
  (canlı akış devam eder)
```

**Örnek akış (reconnect, `Last-Event-ID: 40`, ama `ring_from` artık 100 — 40 budandı):**
```
< event: hello
< data: {"seq":141,"server_version":"0.1.0","ring_from":100}
<
< event: resync
< data: {"reason":"gap"}
<
  (istemci GET /api/events?limit=200 ile tam yeniden yükleme yapar — since_seq GÖNDERİLMEZ,
   CEO düzeltmesi, dosya sonu; SSE bağlantısı
   KAPANMAZ, yalnızca REST çağrısı tetiklenir — reconnect döngüsü riski yok, bkz. §3 madde 8/9)
```

**Örnek akış — kendiliğinden toparlanma (Bulgu 3, `L > ring.to` veya bozuk `Last-Event-ID`):**
```
İstemci veri dizini silinmiş bir sunucuya `Last-Event-ID: 9999` ile bağlanıyor, sunucunun ring'i
yeniden seq=0'dan başlamış (ring_from=0, ring_to=5):
< event: hello
< data: {"seq":5,"server_version":"0.1.0","ring_from":0}
<
  (9999 > ring_to=5 → computeResyncDecision "gap" döner)
< event: resync
< data: {"reason":"gap"}
<
  (istemci ADD_EVENTS ile GET /api/events?limit=200 sonucunu (since_seq GÖNDERİLMEZ) — seq 0-5 — yükler;
   Map<seq,EventRecord> tamamen bu yeni kümeyle güncellenir, hayalet seq=9999 hiç var olmadığı
   için bir "temizleme" adımına gerek yoktur — istemci sadece elindeki en güncel resmi baz alır)
< event: event
< id: 6
< data: {"seq":6, ...}
<
  (canlı akış normal devam eder — bağlantı hiç kapanmadı, kullanıcı yalnızca bağlantı rozetinde
   kısa bir "Yeniden bağlanıyor" YAŞAMAYABİLİR bile çünkü SSE soketi hiç kopmadı, yalnızca
   REST tabanlı bir "gap" telafisi oldu; rozet zaten "Bağlı" kalır — resync bir bağlantı hatası
   değil, bir veri-telafi sinyalidir, bkz. §3 madde 6)
```
Bozuk `Last-Event-ID` (`"abc"`, `""`, `"1e3"`) vakası da aynı `resync` dalına düşer — tek fark
`computeResyncDecision`'a giden değerin `NaN`/ayrıştırılamaz olması, davranış ve toparlanma
akışı birebir aynıdır.

**Hata/kalıcı başarısızlık davranışı (Bulgu 13 düzeltmesi — tur 1'in "403 sonsuz döngüsü"
iddiası yanlıştı):** Sunucu tarafında SSE için özel bir hata gövdesi yok (bağlantı kurulduktan
sonra "hata" kavramı yalnızca soketin kopmasıdır). `Host` yanlışsa `/api/stream` dispatch'e hiç
girmeden `403 forbidden_origin` JSON döner. WHATWG `EventSource` spec'i şunu tanımlar: bağlantı
girişiminde sunucu 200 dışı bir durum kodu (veya yanlış `Content-Type`) döndürürse, spec'in
"fail the connection" adımı çalışır — `readyState` `CLOSED` olur, `error` olayı dispatch edilir
ve tarayıcı **bir daha yeniden bağlanmayı denemez** (native reconnect yalnızca *kurulmuş bir
bağlantı sonradan koptuğunda* devreye girer, ilk bağlantı denemesindeki kalıcı bir 200-dışı
yanıtta değil). Yani "403 sonsuz döngüsü" riski **yok** — istemci `readyState===CLOSED`
("Bağlantı koptu" rozeti, madde 6) ile kalır ve sayfa yenilenmeden bir daha denemez; bu, Host
zaten yanlış olduğu sürece (loopback dışından erişim) beklenen ve kabul edilebilir bir sonuçtur.
`Origin` kontrolü uygulanmıyor (madde 3).

---

## 5. AC → test eşlemesi

| AC | Katman | Neden bu katman | Test dosyası |
|---|---|---|---|
| AC1 — 2 sn içinde, yenilemeden görünür | Entegrasyon (gerçek http + `sse-client.ts`) + E2E (Playwright) | Bulgu 10 düzeltmesi — somut bir sayısal tavan konuldu: entegrasyonda `POST` 202 yanıtından `event` çerçevesinin `waitForFrame`'e düşmesine kadar geçen süre olay-güdümlü ölçülür ve `2000 ms`'lik bir `waitForFrame` timeout'una bağlanır (timeout aşılırsa test KIRMIZI olur — "bekleme olay-güdümlü, tavan sabit" CEO kararı D'yle tutarlı); E2E'de `expect(row).toBeVisible({ timeout: 2000 })` (Playwright'ın varsayılan 5 sn'lik auto-retry'ı yerine **açıkça** 2000 ms'ye düşürülür, yoksa 4.9 sn'de görünen bir uygulama da yeşil kalırdı). | `tests/integration/sse-stream.test.ts`, `tests/e2e/timeline.spec.ts` |
| AC2 — satır alanları (zaman, proje, agent, araç, özet) | Bileşen (jsdom+RTL) + E2E (1 doğrulama) | Alan eşlemesi saf render mantığı — jsdom'da hızlı/deterministik; E2E yalnızca gerçek POST edilmiş verinin de aynı şekilde göründüğünü bir kez doğrular. | `tests/features/events/web/TimelineRow.test.tsx`, `tests/e2e/timeline.spec.ts` |
| AC3 — tüm tipler gösterilir, filtre yalnızca görünüm | Bileşen (jsdom) + hook birimi (sunucuya filtre param'ı GİTMEDİĞİ kanıtı) + E2E | Görünüm mantığı saf/deterministik; ama "kayıt etkilenmiyor" iddiası sunucuya giden gerçek istek URL'sini görmeden kanıtlanamaz — `useEventStream.test.ts` sahte `fetch`'in aldığı URL'yi assert eder (Decision F'nin doğrudan kanıtı). E2E: filtre uygulanıp kaldırılınca veri kaybolmadığını gösterir. | `tests/features/events/web/TimelineScreen.test.tsx`, `tests/web/lib/useEventStream.test.ts`, `tests/e2e/timeline.spec.ts` |
| AC4 — çoklu seçim proje/agent/tip filtreleri (PRD F1/AC7 proje) | Bileşen (jsdom) + E2E (1 doğrulama, ≥2 proje) | Çip etkileşimi (toggle, "hepsi açık" varsayılan, temizle) saf UI durumu; E2E gerçek çoklu-proje verisiyle daraltmayı bir kez kanıtlar. | `tests/features/events/web/FilterChips.test.tsx`, `tests/e2e/timeline.spec.ts` |
| AC5 — bağlantı koptu göstergesi + otomatik yeniden bağlanma + `Last-Event-ID` telafisi | Birim (`computeResyncDecision`) + Entegrasyon (gerçek soket, düşük `MC_RING_SIZE` ile zorlanmış resync, `L>to`, bozuk id) + E2E (**izole kendi sunucusu**, gerçek süreç kill/restart) | En riskli AC — üç katman gerekli: birim saf karar mantığının tüm dallarını (yok/aralıkta/aralık dışı/ileride/bozuk) ucuz test eder; entegrasyon gerçek TCP üzerinden `id:`/`resync` çerçevelerini doğrular; E2E gerçek kullanıcı deneyimini (rozet durumu değişimi + canlıya dönüş) kanıtlar, çünkü yalnızca gerçek bir süreç ölümü `EventSource`'un `error`/`readyState` geçişini gerçekçi tetikler. | `tests/server/sse/stream.test.ts` (birim, `computeResyncDecision` `stream.ts`'ten dışa aktarılır), `tests/integration/sse-stream.test.ts`, `tests/e2e/timeline.spec.ts` |
| AC6 — duraklat: yeni olaylar kaydırmaz, devamda hepsi görünür | Bileşen (jsdom, sahte zamanlayıcı, dar kapsam) + E2E (gerçek kaydırma + "N yeni olay ↑") | Bulgu 11 düzeltmesi — jsdom layout yapmaz, `scrollTop`/`clientHeight` her zaman 0, gerçek `scroll` olayı üretilemez; bu yüzden jsdom testi yalnızca "duraklatılmışken (`pausedByUser`/`scrolledAway`, state olarak zorlanmış) render edilen satır sayısı sabit kalır, `pendingCount` artar" iddiasına daraltıldı (§3 madde 5). "Kaydırınca oto-dondurma", "N yeni olay ↑ En üste git" rozetinin belirmesi ve "Devam et"te listenin sıçramadan başa dönmesi **yalnızca** gerçek layout'un olduğu `timeline.spec.ts`'te (Playwright, gerçek `mouse.wheel`/`Page.evaluate(() => list.scrollTop)`) doğrulanır. | `tests/features/events/web/TimelineScreen.test.tsx`, `tests/e2e/timeline.spec.ts` |

**En tartışmalı katman seçimi:** AC5'in E2E'si "gerçek kill/restart" ile test edilir (bkz. Bulgu 5
düzeltmesi aşağıda) — sahte/mock disconnect yerine gerçekten `child_process` ile başlatılan bir
sunucuyu `kill()` ile öldürüp yeniden başlatmak. Daha yavaş ve potansiyel olarak Windows'ta sinyal
davranışı farklı (bkz. §9), ama bu, `EventSource`'un `error`/`readyState` geçişini **gerçekten**
tetikleyen tek yol — mock'lanmış bir "disconnect" senaryosu tarayıcının gerçek TCP hata algılama
davranışını kanıtlamaz.

**AC5 E2E tasarımı (Bulgu 5 düzeltmesi — tur 1'in tasarımı uygulanabilir değildi):** Tur 1,
Playwright'ın paylaşılan `webServer`'ını (sabit port 7333, `MC_DATA_DIR` yok, `playwright.
config.ts`'in kendisinin başlattığı ve testin **öldüremeyeceği** bir süreç — `index.ts:262-268`
`EADDRINUSE`'ta `process.exit(1)` yapar, yani aynı porta yeniden `listen` etmeye çalışan bir
restart yarışı kaybederdi) "gerçek kill/restart" için kullanmayı varsayıyordu; bu, mimari olarak
imkânsızdı. Düzeltme: AC5'in kill/restart senaryosu, `timeline.spec.ts` içinde ayrı bir
`test.describe('AC5 - bağlantı kopması ve toparlanma')` bloğunda, **kendi izole alt sunucusunu**
kurar (yeni bir yardımcı dosya yok — mantık bu `describe` bloğuna yerel, `tests/helpers/
temp-data-dir.ts`'i yeniden kullanır):
1. `beforeAll`: `createTempDataDir()` ile geçici bir `MC_DATA_DIR`; sabit alternatif port
   **`7335`** (YENİ-2 düzeltmesi — QA tur 2, port çakışması ölçüldü: projenin belgelenmiş dört
   portu `7333`/`7334` (`vite.config.ts:6`, `MC_WEB_PORT` varsayılanı) /`7433`/`7434`
   (`playwright.dev.config.ts:7,11`) hepsi dosyaları okuyarak ✓ VERIFIED edildi; `7335` bu dörtten
   hiçbiriyle çakışmıyor ve `docs/02-architecture.md`'nin kaçınılması istenen portlarıyla da
   (4000, 3000/5173/8080/4318) örtüşmüyor). Spawn **öncesi** `isPortFree(7335)` kontrolü yapılır
   (`scripts/check-ports.mjs`'teki `net.createServer().listen(...)` desenin birebir aynısı, yeni
   bağımlılık yok, test dosyasına yerel küçük bir yardımcı olarak yazılır) — port doluysa test
   anlamlı bir hatayla (`"7335 portu dolu, AC5 E2E'si atlanamaz/koşulamaz"`) **KIRMIZI** olur,
   10 sn'lik yanıltıcı health-check zaman aşımına düşmez. Süreç, **npm wrapper'ı ATLANARAK**
   doğrudan `node_modules/.bin/tsx` (`spawn(require.resolve('tsx/cli'), ['src/server/index.ts'],
   { env: {...process.env, MC_PORT:'7335', MC_DATA_DIR: tempDir}, cwd: repoRoot })` benzeri) ile
   başlatılır — `npm start` üzerinden spawn edilseydi `child.kill()` yalnızca `npm.cmd`
   sarmalayıcısını öldürür, gerçek Node süreci Windows'ta öksüz kalıp yaşamaya devam edebilirdi
   (bilinen bir tuzak); doğrudan `tsx` spawn'ı testin öldürdüğü sürecin **gerçekten** sunucu
   süreci olmasını garanti eder. **NOT-2 düzeltmesi (savunma katmanı):** bu garanti `tsx`'in
   sürüme bağlı davranışına dayanıyor (`package.json`'da `"tsx": "^4"`, sabitlenmemiş — ✓
   VERIFIED) — üç savunma eklenir: (a) `child.on('exit', ...)` olayı da beklenir, yalnızca
   `kill()` çağrısının kendisi yeterli sayılmaz; (b) kill sonrası adım 2'nin health-check'inin
   **tersi** — port gerçekten boşalana kadar kısa aralıklı `isPortFree(7335)` polling'i (aynı
   10 sn tavan); (c) Windows'a özgü son çare: (a)/(b) tavanı aşarsa `taskkill /F /T /PID <pid>`
   (`/T` bayrağı **süreç ağacının tamamını** öldürür — bu, tur 2'nin eksik bıraktığı bayrak) ile
   zorlama, `try/finally` içinde (`afterAll`/`afterEach` her koşulda bu temizliği çalıştırır,
   test başarısız olsa bile).
2. Hazır olma kontrolü: `http://127.0.0.1:7335/api/health`'e **sabit `sleep` YOK**, kısa aralıklı
   (100 ms) bir polling döngüsüyle (toplam 10 sn tavan) 200 yanıtı beklenir — bu saf "olay
   güdümlü" değildir (gerçek bir push/webhook yok) ama her denemede **gerçek sunucu durumunu**
   ölçer, kör bir sabit bekleme değildir; tavan aşılırsa test, "port zaten doluydu" (adım 1) ile
   "sunucu 10 sn'de ayağa kalkmadı" (bu adım) durumlarını **ayrı mesajlarla** ayırt eder.
3. `page.goto('http://127.0.0.1:7335')` (bu tek `describe` bloğu için `baseURL`'i geçersiz kılar);
   rozetin "Bağlı" olduğu, bir `POST /api/events` sonrası olayın göründüğü doğrulanır.
4. `child.kill()` (Windows'ta `TerminateProcess`'e eşdeğer, "temiz kapanma" garantisi yok — bu
   tam olarak istenen "aniden öldü" senaryosu, §9 madde 5 ile tutarlı); rozetin
   `"Bağlantı koptu"`'ya döndüğü assert edilir (`"Yeniden bağlanıyor"` ara durumu bu senaryoda
   **best-effort** gözlemlenir — sert bir assert'e bağlanmaz, çünkü native retry zamanlaması
   tarayıcıya göre değişir ve bu geçiş çok kısa sürebilir; sert olan tek şey nihai
   "Bağlantı koptu" durumudur). Kill sonrası, yeniden spawn'dan ÖNCE adım 1(b)'nin
   `isPortFree(7335)` beklemesi çalışır.
5. Aynı `MC_PORT`/`MC_DATA_DIR` ile süreç yeniden `spawn` edilir (adım 2'deki health-check
   tekrarlanır); ring/seq disk üzerinden (`.seq` dosyası + günlük JSONL) yeniden yüklendiği için
   istemcinin eski `Last-Event-ID`'siyle sorunsuz telafi olur; yeni bir `POST` gönderilir, olayın
   **çift göstermeden ve kayıpsız** göründüğü ve rozetin `"Bağlı"`ya döndüğü assert edilir.
6. `afterAll` (`try/finally` içinde): son ayakta kalan süreç `kill()` + `exit` beklemesi +
   `isPortFree(7335)` beklemesi (tavan aşılırsa `taskkill /F /T`), sonra `removeTempDataDir(tempDir)`
   çağrılır — sıra önemli, port/süreç temizliği veri dizini silinmeden önce tamamlanmalı.

`MC_PORT=0` (efemeral port) bu tasarımda kullanılmıyor: `index.ts`'in `main()`'i yalnızca
çözülen `port` değişkenini (girişte verileni) stdout'a basıyor, işletim sisteminin seçtiği gerçek
portu ayrıştırıp geri okuyacak bir mekanizma yok — "boş port seç + stdout'tan ayrıştır" yolu ek
üretim kodu isterdi; sabit ama ölçülerek çakışmadığı doğrulanmış bir port + spawn öncesi/sonrası
boşluk kontrolü daha ucuz ve bu turun kapsamına (yalnızca test dosyası) sadık kalıyor.

---

## 6. DOM test altyapısı — `ADR-010` taslağı

> Bu bölüm, CEO onaylarsa `docs/decisions/ADR-010-dom-test-altyapisi.md` olarak (CEO/architect
> tarafından) kalıcı hâle getirilecek taslaktır. Bu turda ayrı dosya oluşturulmadı.

**Bağlam:** F-001/F-002/F-004 yalnızca `renderToStaticMarkup` (DOM'suz, SSR) kullanıyor. F-003
ilk etkileşimli ekranı getiriyor (tıklama, klavye, state geçişleri) — gerçek bir DOM ortamı ve
etkileşim simülasyonu gerekiyor.

**Karar:** `jsdom` (test ortamı) + `@testing-library/react` (render/query) +
`@testing-library/user-event` (gerçekçi tıklama/klavye simülasyonu) + `@testing-library/dom`
(peer, explicit). `@testing-library/jest-dom` **eklenmiyor** — native `expect(el.textContent)`/
`el !== null`/`el.getAttribute(...)` yeterli, bir bağımlılık daha azaltılıyor (kapalı liste
felsefesi, §3.4).

**Sürümler — Bulgu 14 düzeltmesi (`engines` çelişkisi):** tur 1, en güncel `jsdom@30.0.1`'i
öneriyordu ama bu sürümün `engines.node` alanı `^22.22.2 || ^24.15.0 || >=26.0.0` — projenin
`package.json engines.node: ">=20.11"` beyanı ve `src/server/index.ts`'in
`isSupportedNodeVersion` kontrolüyle **çelişiyor** (Node 20/21/22.0-22.22.1/23/24.0-24.14/25'te
`npm ci` EBADENGINE uyarısı verir). Bu turda gerçek veriyle ölçüldü (2026-09-05, `npm view`/
`npm pack` ile canlı registry'den, `nodejs.org/dist/index.json`'dan gerçek Node sürüm listesiyle
— tahmin değil):

| Kontrol | Sonuç |
|---|---|
| Node 22.x'in en güncel yayını | `v22.23.2` (LTS "Jod") — `jsdom@30`'un `^22.22.2` şartını karşılıyor |
| `ci.yml`'nin kurduğu Node sürümü | `setup-node@v4` ile `node-version: '22'` — **kayan** etiket, her koşuda o anki en güncel 22.x'i kurar; bugün 22.23.2, ileride yalnızca artabilir (Node yalnızca ileri yamalanır) → CI'da jsdom@30 **çalışırdı** |
| Projenin beyan edilen tabanı | `package.json engines.node: ">=20.11"`, `isSupportedNodeVersion` aynısını uyguluyor — bu, CI dışı (yerel geliştirme, gelecekteki bir contributor) ortamlarda Node 20.11-22.22.1 ile **gerçek bir çelişki** |
| `jsdom` sürüm geçmişinde `engines` daralması | `27.0.0`(2025-09-13)/`27.0.1`(2025-10-18): `{node:'>=20'}` — **çelişmiyor**; `27.1.0`(2025-10-31)'den itibaren `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`'a daraldı (20.11-20.18 dışlanıyor) — tekrar çelişiyor |

**Karar:** `jsdom` **tam sabitlenmiş `27.0.1`** (caret/tilde DEĞİL — `^27`/`~27.0.1` gelecekte
`27.1.0`'a yükselip çelişkiyi geri getirebilir; `package.json`'a düz `"27.0.1"` yazılır).
Gerekçe: projenin beyan ettiği Node tabanını (`>=20.11`) ya da `isSupportedNodeVersion`/`ci.yml`'i
değiştirmek bu ADR'nin (DOM test altyapısı) kapsamını aşan, alakasız bir yan etki olurdu
(Karpathy §3 — cerrahi değişiklik); `27.0.1` hem `EventSource`'u aynı şekilde uygulamıyor (aşağıda
bağımsız doğrulandı) hem de mevcut hiçbir dosyaya dokunmadan çelişkiyi ortadan kaldırıyor. Yaklaşık
bir yıl önce yayınlanmış olması (30.0.1'e göre) kabul edilebilir bir taviz — proje ileride Node
tabanını yükseltirse (ayrı bir karar/ADR) bu pin gözden geçirilebilir, bilgi notu §9'a eklendi.

| Paket | Sürüm | Not |
|---|---|---|
| `jsdom` | **`27.0.1`** (tam sabit, caret yok) | `engines: {node:'>=20'}` — projenin `>=20.11` tabanıyla çelişmiyor (Bulgu 14) |
| `@testing-library/react` | `^16` (registry günceli 16.3.3) | `engines: {node:'>=18'}` — çelişki yok |
| `@testing-library/dom` | `^10` (peer, günceli 10.4.1) | `engines: {node:'>=18'}` — çelişki yok |
| `@testing-library/user-event` | `^14` (registry günceli 14.6.7) | `engines: {node:'>=12'}` — çelişki yok |

**Native derleme durumu (✓ VERIFIED, gerçek `npm view jsdom@27.0.1 <pkg> --json | .hasInstallScript`
kontrolüyle, tur 2'de sürüm pini `27.0.1`'e göre yeniden doğrulandı):** `jsdom@27.0.1`,
`@testing-library/react`, `@testing-library/user-event` — üçünde de `hasInstallScript`
**tanımsız** (yok). `jsdom@27.0.1`'in tek native-derleme riski taşıyan bağlantısı `canvas` — bu
**opsiyonel bir peer dependency** (`peerDependenciesMeta.canvas.optional === true`, aynı
30.0.1'deki gibi), npm bunu otomatik kurmaz, F-003 hiçbir yerde `canvas` API'si kullanmıyor
(`document.getContext('2d')` yok). `jsdom`'un kendi bağımlılık ağacı — hiçbiri npm registry
düzeyinde `hasInstallScript` taşımıyor gibi görünüyor (üst seviye kontrol edildi); **kesin
doğrulama gerçek `npm install` sonrası `npx vitest run tests/deps.test.ts` ile yapılacak** (kod
turunun ilk adımı) — kırmızı çıkarsa bu ADR güncellenip alternatif sürüm/paket değerlendirilecek.

**Alternatifler ve neden reddedildi:**

| Seçenek | Olgunluk/hız | `EventSource` desteği | Karar |
|---|---|---|---|
| `jsdom@27.0.1` | En yaygın, `@testing-library/react` + Vitest'in resmi örneklerinde varsayılan; Jest'in de tarihsel varsayılanı — devasa kullanım hacmi, yüksek spec-uyumluluk geçmişi. `30.0.1`'e göre ~1 yıl daha eski ama aktif bakımlı bir majör sürüm hattının patch'i (27.x, 2025-09-13→2025-12 arası birden fazla minör aldı). | **Yok** (✓ VERIFIED — `27.0.1` tarball'ı `npm pack` ile indirilip açıldı, `package/lib` altında "EventSource" dizgesi **0 kez** geçiyor — `30.0.1` ile aynı sonuç). | **Seçildi** (Bulgu 14 — `engines` çelişkisi olmayan tek sürüm). |
| `happy-dom` | İddia edilen performans avantajı var (resmi karşılaştırmalarında öne çıkıyor) ama daha küçük ekosistem/daha genç proje, spec-uyumluluk geçmişi jsdom kadar uzun değil. | **Yok** (✓ VERIFIED — aynı yöntemle test edildi, `Window`'da `EventSource` `undefined`). | Reddedildi — tek potansiyel avantajı (hız) bu projenin birkaç düzine bileşen testi ölçeğinde anlamsız; `EventSource` farkı da yok (ikisi de desteklemiyor), yani asıl karar faktörü olgunluk/dokümantasyon/topluluk büyüklüğü — jsdom + Testing Library en çok denenmiş kombinasyon. |
| Vitest Browser Mode (`@vitest/browser` + Playwright provider) | Gerçek tarayıcı, gerçek `EventSource` çalışır — TEK gerçek avantajı bu. Ama: (a) zaten kurulu `@playwright/test` tarayıcı ikilisini paylaşabilir (yeni binary indirmez), (b) `vitest.config.ts`'e workspace/`projects` ayarı + ayrı bir provider paketi gerektirir, (c) her test dosyası gerçek bir tarayıcı bağlamı açar — jsdom'a göre gözle görülür şekilde daha yavaş, (d) mevcut 187 node-ortamlı testle aynı çalıştırma modelini bozar. | **Var** (gerçek tarayıcı). | Reddedildi — bu projenin test stratejisi zaten SSE PROTOKOLÜNÜ tarayıcı dışı, ham `node:http` ile (§2.1 `sse-client.ts`, F-002/F-004'ün kurduğu desenle birebir) doğruluyor; DOM testleri yalnızca RENDER mantığını ölçüyor ve gerçek ağ/`EventSource` gerektirmiyor (enjekte edilebilir sahte, §3 madde 4/dosya listesi). Yani Browser Mode'un tek gerçek avantajı bu sözleşmenin ihtiyaç duymadığı bir şey — Karpathy §2 (kullanılmayacak altyapı kurma). |

**Mevcut guard'lara etkisi:**
- `tests/deps.test.ts` — yukarıda ele alındı; gerçek `npm install` sonrası doğrulanacak.
- `tests/no-external-host.test.ts` — yeni `.tsx`/`.ts` dosyaları zaten taranan köklerin
  (`src/features/**`, `src/server/**`) altında, ayrıca değişiklik gerekmiyor (✓ VERIFIED, §2.2
  not).
- Vitest ortam ayarı: `vitest.config.ts`'in global `environment: 'node'`'una **dokunulmuyor** —
  yeni bileşen/hook test dosyalarının **her birinin başına** `// @vitest-environment jsdom`
  docblock'u eklenir (Vitest'in resmi dosya-bazlı geçersiz kılma mekanizması). Bu, mevcut 187
  node-ortamlı testin hızını/davranışını etkilemez — global config değişikliği yerine tercih
  edilen, daha dar kapsamlı yol.

**Enjekte edilebilirlik notu:** `useEventStream(streamUrl, eventsUrl, { EventSourceImpl =
window.EventSource } = {})` — üretimde varsayılan gerçek tarayıcı API'si kullanılır; testlerde
`tests/helpers/fake-event-source.ts` enjekte edilir. Bu, jsdom'un `EventSource` eksikliğini
DOM-testi seviyesinde aşmanın tek yoludur (bir polyfill paketi eklemek yerine — ek bir bağımlılık
daha, gereksiz).

---

## 7. N-1 düzeltme planı (hayalet olay)

**Mevcut davranış (✓ VERIFIED, `jsonl-store.ts` okunarak):** `append()` içinde `ring.push(event)`
disk yazımı **denenmeden önce**, iyimser olarak çalışır. `writeResult` reddedilirse (`ingest.ts`
bunu yakalayıp `503 storage_unavailable` döner), olay **yine de** ring'de kalır — `GET /api/events`
onu döndürmeye devam eder, diskte hiçbir karşılığı olmadan (`docs/features/F-003-...md` N-1
notundaki gözlemle birebir: `{"seq":0,...,"next_seq":1}` gerçek diskte yok).

**Hedef (Bulgu 6 düzeltmesi — tam yer):** `ring.push(event)` (+ `if (ring.length > ringSize)
ring.shift()`) mevcut satır 195-196'dan kaldırılıp, `queue = writeResult.then(...)`'in **başarı**
geri çağrımının içine (satır 214-216, `lineCounts.set(day, ...)` ile **aynı bloğa**) taşınır.
Bunun sırayı garanti etmesinin nedeni promise `.then()` semantiği: `writeResult` üzerinde iki
ayrı `.then()` kaydediliyor — önce `queue = writeResult.then(success1, error1)` (satır 213),
sonra `return writeResult.then(success2, error2)` (satır 226, `ingest.ts`'e dönen değer). Aynı
promise'e kayıtlı `.then()` geri çağrımları **kayıt sırasına göre** çalışır (spec garantisi) —
yani `ring.push` (yeni yeri: `success1` içinde) her zaman `ingest.ts`'in aldığı `{seq,id}`
sonucundan (yeni yeri: `success2`) ÖNCE çalışır. Bu, `ingest.ts`'in `hub.broadcast(...)`
çağırmadan/HTTP yanıtını döndürmeden önce ring'in güncel olmasını garanti eder — bir istemcinin
`POST` 202 aldıktan hemen sonra `GET /api/events` çağırması artık asla o olayı kaçırmaz (tur 1'de
bu garanti yoktu, teorik bir yarış vardı). Sıra ayrıca korunur çünkü `queue` zaten önceki
yazmaların tamamlanmasını bekleyecek şekilde zincirleniyor (✓ VERIFIED, mevcut kod). Sonuç:
`GET /api/events` ve SSE `event` kanalı (ki `ingest.ts`'ten yalnızca başarı dalında tetiklenir,
§2.2) artık **aynı** "yalnızca kalıcı yazılan olaylar" kümesinden besleniyor — hayalet olay
hiçbir yerde görünmüyor.

**Test:**
1. `tests/server/store/jsonl-store.test.ts` — yeni senaryo: geçici olarak `eventsDir`'i (veya tek
   bir `append` çağrısını) yazılamaz hâle getir (ör. hedef gün dosyasının yolunda bir dizin
   oluştur — F-002'nin kendi QA turunda kullandığı **aynı, gerçek gözlemlenmiş teknik**), bir
   olay POST/`append` et → reddedilsin → `store.read(-1, 10).events`'in bu olayı **içermediğini**
   assert et. Ardından dizini kaldırıp başka bir olay `append` et → bu ikincisinin ring'de
   **var olduğunu** ve seq numaralandırmasının bozulmadığını (F-002'nin "seq bir daha
   verilmez" kararıyla tutarlı bir boşluk bırakabileceğini) assert et.
2. `tests/integration/events-api.test.ts` — uçtan uca: gün dosyası yoluna dizin koy → `POST
   /api/events` → `503` → dizini kaldır → geçerli bir olay `POST` et → `GET /api/events` → yalnızca
   ikinci olayın göründüğünü, ilkinin (503 dönen) **hiçbir yerde** olmadığını assert et.
3. `tests/integration/sse-stream.test.ts` — aynı senaryo SSE tarafında, **tek bir bağlantı
   üzerinde ardışık iki assert** (ölçmeyen-test riski #4 düzeltmesi — yalnızca "hiçbir şey
   gelmedi" iddiası `hub.broadcast` hiç çağrılmasa da geçerdi): `sse-client.ts` ile abone ol →
   503 tetikleyen POST'u gönder → belirli bir süre (300 ms) içinde **hiçbir** `event` çerçevesi
   gelmediğini assert et → dizini kaldırıp geçerli bir POST gönder → **aynı bağlantıda** tam
   olarak BİR `event` çerçevesi geldiğini ve `id:`'nin doğru `seq`'e eşit olduğunu assert et
   (negatif iddia, ardından gelen pozitif teslimle eşleştirilmeden tek başına anlamsız).

**Mutasyon:** Düzeltmeyi geri al (`ring.push(event)`'i tekrar yazma denemesinden ÖNCEye taşı) →
yukarıdaki 1 ve 2 numaralı testler **KIRMIZI** vermeli (hayalet olay tekrar görünür) → düzeltme
geri konup **YEŞİL** olduğu doğrulanır (kod turunda yapılacak, bu sözleşmede yalnızca planlanıyor).

---

## 8. Mutasyon planı (14 kritik test — tur 2'de 8 yeni mutasyon eklendi)

| # | Mutasyon | Beklenen KIRMIZI | Ne kanıtlar |
|---|---|---|---|
| 1 | N-1 düzeltmesi geri alınır (`ring.push` yazmadan önceye/eski satır 195-196'ya taşınır) | `jsonl-store.test.ts` + `events-api.test.ts` N-1 testleri | §7 — hayalet olay gerçekten engelleniyor mu |
| 2 | `computeResyncDecision`'da `lastEventId < ringBounds.from → resync` dalı tersine çevrilir/silinir | `sse-stream.test.ts`'in düşük `MC_RING_SIZE` ile zorlanmış resync testi | AC5'in telafi mantığı gerçekten çalışıyor mu |
| 3 | `useEventStream`'in seq bazlı de-dup'ı kaldırılır (aynı seq iki kez eklenebilir) | `useEventStream.test.ts` — initial fetch + çakışan canlı olay senaryosu | §3 madde 4/8 — yarış durumunda çift satır oluşmuyor mu |
| 4 | `pausedByUser`/`scrolledAway`'den biri bypass edilir (duraklatken olaylar yine de render edilir) | `TimelineScreen.test.tsx` AC6 testi + `timeline.spec.ts` AC6 (E2E) | Duraklat gerçekten dondurma yapıyor mu (Bulgu 8/11) |
| 5 | İstemci tarafı filtre gizleme mantığı kaldırılır (tüm satırlar her zaman render edilir) | `TimelineScreen.test.tsx` AC3/AC4 görünür-satır-sayısı testi | Filtre gerçekten görünümü değiştiriyor mu (ve ayrıca §3 madde 4'ün "sunucuya param gitmiyor" testiyle birlikte, CEO kararı F'nin İKİ yönü de ölçülüyor) |
| 6 | `stream.ts`'te `req.on('close')` temizliği (unsubscribe + `clearInterval`) kaldırılır | `sse-stream.test.ts` — bağlantı `req.destroy()` ile koparıldıktan sonra hub'ın abone sayısının 0'a düştüğü **ve** `sse-client.ts`'in `closed` promise'inin çözüldüğü testi | Bağlantı kapanışında sızıntı olmuyor mu (§3 madde 2, ölçmeyen-test riski #6) |
| 7 | `hello` çerçevesine `id: ringBounds.to` **tekrar eklenir** | `sse-stream.test.ts` — "hello çerçevesinde `id:` yok" assert'i | Bulgu 2 — veri kaybı yolu gerçekten kapalı mı |
| 8 | `computeResyncDecision`'dan `L > ringBounds.to → resync` dalı silinir | `stream.test.ts` — `L=to+1` sınır testi | Bulgu 3 — istemci ileride kaldığında kendiliğinden toparlanma gerçek mi |
| 9 | Bozuk `Last-Event-ID` ayrıştırması eski "sessizce düşür" davranışına döndürülür | `stream.test.ts` — `""`,`"1e3"`,`" 12 "`,`"abc"` vakaları | Bulgu 7 — kayıpsız taraf gerçekten seçili mi |
| 10 | `ingest.ts`, 503 dalında da `hub.broadcast(...)` çağıracak şekilde değiştirilir | `sse-stream.test.ts` N-1 negatif testi (mad. 3) | Bulgu 6 — yalnızca kalıcı yazılan olaylar mı yayınlanıyor |
| 11 | `ring.push` yeniden `writeResult`'ın **hata** dalına veya çağırana-dönüş `.then()`'inden **sonraya** taşınır (satır sırası bozulur) | Yeni bir "POST 202 sonrası hemen GET" yarış testi (`events-api.test.ts`, N-1 grubu) | Bulgu 6 — push, yanıt dönmeden önce mi gerçekten tamamlanıyor |
| 12 | `App.tsx`'e yeniden bir "aktif sekme" `useState`'i eklenip `TimelineScreen`'in mount'u bu state'e (varsayılan `false`/gizli) bağlanır — YENİ-1 sonrası tetikleyecek hiçbir tıklanabilir öğe olmadığı için bu mutasyon `TimelineScreen`'i **hiç görünmez** kılar | `App.interaction.test.tsx` — "`TimelineScreen` App mount olur olmaz, hiçbir etkileşim olmadan görünür" testi (immediate-render assert'i) KIRMIZI olur; ayrıca aynı dosyanın "App-seviyesi re-render (bağlantı durumu değişimi) `TimelineScreen`'i unmount etmez" testi de filtre state'inin App-tetikli bir yeniden render'da korunduğunu bağımsız doğrular | Bulgu 12/4/YENİ-1 — sekmeler arası geçiş kavramının gerçekten kalktığı, filtre hafızasının rastlantı değil tasarım olduğu |
| 13 | `ScreenErrorBoundary` kaldırılıp `TimelineScreen` doğrudan mount edilir | `ScreenErrorBoundary.test.tsx` + `App.interaction.test.tsx`'teki hata sınırı testi | Bulgu 12 — sekme bazlı hata sınırı gerçek mi |
| 14 | `useEventStream`'de `'error'`/`readyState` ayrımı kaldırılıp her hata `disconnected`'a eşlenir | `useEventStream.test.ts` — `reconnecting` durumu testi | Bulgu 13 — 3 durumlu rozet gerçek mi |

Her mutasyon kod turunda: uygula → ilgili testi izole çalıştır → KIRMIZI gözlemi kaydet → Edit ile
birebir geri al → tekrar YEŞİL olduğu doğrulanacak (F-002/F-004 örnekleriyle aynı disiplin).

---

## 9. Riskler ve CEO'ya sorular

**Bloklayıcı soru: YOK.** Aşağıdakiler CEO'nun önceden verdiği kararlar (A-G) veya benim kendi
düşük etkili/geri alınabilir teknik kararlarımla çözüldü; şeffaflık için bilgi notu olarak
listeleniyor (CLAUDE.md: "düşük etkili olanları CEO karara bağlayıp ADR'ye yazsın, yalnızca ürün
davranışını değiştirenleri sor" — aşağıdakilerin hiçbiri kullanıcının göreceği bir AC'yi
değiştirmiyor):

1. **Doküman tutarsızlığı (bilgi, düzeltme istemiyorum):** `docs/03-ux.md`'nin Türkçe metin
   sözlüğü "Duyguşuz" (ş ile) yazıyor, ekran-1 wireframe'i "DUYGUSUZ" (düz s) gösteriyor. Gerçek
   Türkçe sözcük "duygusuz"dur (`-suz` eki `ş` almaz) — sözlükteki yazım muhtemelen bir yazım
   hatası. Ben "Duygusuz" (düz s) kullanacağım (§3 madde 7). `docs/03-ux.md` benim dosya
   sahipliğimde değil, düzeltmiyorum — CEO/architect isterse tek satırlık bir düzeltme.
2. **`lucide-react` bağımlılığı eklenmedi.** UX doküman Lucide'ı öneriyor ve gelecekteki
   feature'ların (F-005/F-007/F-008) onlarca ikona ihtiyacı olacak — bu F-003'ün 3 ikonu (Wifi/
   WifiOff/AlertTriangle) için elle SVG çizmek makul, ama F-007 (8 kanban durum ikonu) muhtemelen
   gerçek paketi eklemeli. Bu paket eklendiğinde `docs/02-architecture.md` §3.4'ün kapalı
   bağımlılık listesine bir satır eklenmesi gerekecek (mimari dokümanı benim sahiplik alanım
   dışında, dokunmuyorum).
3. **ADR-004'ün "istemci 45 sn'de kapatır" cümlesi literal uygulanamıyor** (§3 madde 2) —
   `EventSource` yorum satırlarını (`: keepalive`) JS'e hiç göstermiyor (WHATWG spec, jsdom'da da
   ✓ VERIFIED test edilebilir). Native `onerror` + süresiz reconnect (ADR-004 madde 3, zaten
   zorunlu) bu işlevi dolaylı olarak karşılıyor; ek bir 45 sn'lik istemci zamanlayıcısı
   **yazılmıyor** çünkü gerçek sinyali (comment satırları) hiç göremiyor, yazılsa bile yalnızca
   gerçek `event`/`hello`/`resync` mesajlarını sayabilir ki bu da sessiz dönemlerde gereksiz
   reconnect'e yol açar.
4. **`jsdom` sürümü tam sabitlendi (`27.0.1`), en güncel değil** (§6, Bulgu 14) — proje ileride
   Node tabanını `>=22.22.2`/`>=24.15.0`'a yükseltirse (ayrı bir karar) bu pin gözden geçirilip
   `30.0.1`'e yükseltilebilir; şimdilik gündemde değil.
5. **"Yeniden bağlanıyor" durumunun E2E'de yakalanması best-effort** (§5 AC5 tasarımı, §3 madde
   6) — native `EventSource` reconnect gecikmesi tarayıcıya/işletim sistemine göre değişir;
   AC5'in E2E'si bu geçişi gözlemlemeye çalışır ama sert bir assert'e bağlamaz, yalnızca nihai
   "Bağlantı koptu"/"Bağlı" durumları sert assert edilir. `reconnecting` durumunun **var
   olduğunu** kanıtlayan sert test `useEventStream.test.ts`'te sahte `EventSourceImpl` ile
   deterministik olarak yapılır (§8 mutasyon 14) — E2E'nin görevi yalnızca gerçek tarayıcı
   deneyimini bir kez doğrulamak, birim/entegrasyon testinin yerini almak değil.

**En büyük risk:** AC5'in E2E katmanı (gerçek süreç kill/restart + gerçek tarayıcı `EventSource`)
— üç ayrı hareketli parça (Playwright, Node child process yönetimi, native tarayıcı reconnect
zamanlaması) aynı testte buluşuyor; ayrıca artık kendi izole sunucusunu spawn ediyor (§5 "AC5 E2E
tasarımı") — dördüncü bir hareketli parça (`tsx` CLI'ının doğrudan spawn edilmesi, health-check
polling). Kod turunda bu test flaky çıkarsa, F-004'ün "zamanlamayı dışarıdan değil içeriden ölç"
dersi uygulanacak: sabit `waitForTimeout` yerine Playwright'ın `expect(locator).toHaveText(...)`'
inin kendi auto-retry'ı ve `page.on('request')` ile gerçek ağ isteklerinin gözlemlenmesi tercih
edilecek (§5 tablosunda zaten planlandı). İkinci risk: Windows'ta `child.kill()`'in gerçekten
alt süreci öldürüp öldürmediği (npm wrapper yerine doğrudan `tsx` spawn edilerek azaltıldı, §5).
QA tur 2'nin NOT-2 ölçümü bu makinede bugün `tsx@4.23.13`'ün ebeveyn ölünce torun `node` sürecini
de düşürdüğünü gösterdi, ama bu belgelenmemiş ve sürüme bağlı bir davranış (`tsx: "^4"`,
sabitlenmemiş) — bu yüzden artık "yanlış çıkarsa" koşullu bir yedek değil, §5 madde 1/6'ya
**baştan** yazılmış üç katmanlı bir savunma var: `exit` olayını bekleme, kill sonrası port
boşalmasını polling ile doğrulama, tavan aşılırsa `taskkill /F /T /PID` (`/T` bayrağı **tüm alt
süreç ağacını** öldürür — ADR-009 zaten Windows-only, bu ek bir platform karmaşıklığı değil,
mevcut platformun kendi aracı).

---

## QA sözleşme incelemesi — tur 1 (qa-evaluator, 2026-09-05)

**KARAR: DÜZELTME**
**ESKALE: false**

Kapsam: yalnızca sözleşme metni + mevcut kod/doküman okundu. Hiçbir dosya değiştirilmedi
(bu bölüm hariç). Uygulama başlatılmadı. `npm view` ve `npm pack` ile salt-okunur registry
doğrulaması yapıldı (geçici dizinde; depoya hiçbir şey yazılmadı, dizin silindi).

Genel değerlendirme: ciddi, ödevini büyük ölçüde yapmış bir sözleşme — CEO kararlarına uyum
yüksek, ADR-010 iddialarının neredeyse hepsi bağımsız doğrulandı, N-1 teşhisi kodla birebir
örtüşüyor. Ancak SSE tel-protokolünde bir veri kaybı yolu, bir test-teardown kilitlenmesi, bir
tanımsız sınır koşulu ve iki uygulanamaz/kırıcı test planı var. Bunlar kod yazılmadan kapanmalı.

### Bulgular

| # | Şiddet | Bölüm / satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| 1 | BLOKLAYICI | §2.2 satır 126 (`src/server/index.ts` satırı) vs §3 madde 2 satır 172-176 | `hub.closeAll()` `server.on('close', ...)` içine bağlanıyor. Node'da `close` olayı **tüm bağlantılar bittikten sonra** ateşlenir; açık bir SSE soketi varken `server.close()` asla tamamlanmaz. Mevcut `stopServer` (`tests/integration/events-api.test.ts:26-29`) `await once(server, 'close')` yapıyor → SSE'li her entegrasyon testi teardown'da süresiz kilitlenir. Sözleşme tuzağı §3 madde 2'de doğru tarif edip §2.2'de tam o tuzağa kabloluyor. | `closeAll()` kapanışın **başında** çağrılsın (ör. `createServer`'ın döndürdüğü sunucuya `closeStream()` iliştirilip `server.close()`'tan ÖNCE çağrılması, veya `server.closeAllConnections()`); §5'e "açık SSE istemcisi varken `stopServer` 2 sn içinde döner" testi eklensin. |
| 2 | BLOKLAYICI | §4 satır 292-296 (`hello` çerçevesi) | `hello` çerçevesi `id: <ringBounds.to>` taşıyor. WHATWG EventSource `id:` alanını **dispatch edilen her olayda** son-olay-kimliği tamponuna yazar — `hello` alınır alınmaz tarayıcının `Last-Event-ID`'si ring'in sonuna sıçrar. Bağlantı `hello` ile telafi çerçeveleri arasında koparsa `(L, ring.to]` aralığı **kalıcı olarak kaybolur**; ilk açılışta REST yüklemesi başarısız olursa aynı sonuç. ADR-004 madde 2 ve mimari §6.1 tablosu `id:`'yi yalnızca olay `seq`'i olarak tanımlıyor — `hello`'ya `id:` koymak sözleşmenin kendi icadı. | `hello` çerçevesinden `id:` satırı kaldırılsın (yalnızca `event` çerçeveleri `id:` taşısın); `sse-stream.test.ts`'e "hello çerçevesinde `id:` alanı yok" assert'i ve §8'e "hello'ya `id:` geri eklenir → KIRMIZI" mutasyonu eklensin. |
| 3 | BLOKLAYICI | §4 satır 298-306 (`computeResyncDecision` tablosu) | `L > ringBounds.to` (istemci sunucudan ileride) dalı **tanımsız**. Veri dizini silinince / `.seq` sıfırlanınca / eski yedeğe dönülünce `L >= from` doğru olur, `store.read(L, n)` boş döner: ne `resync` gider ne olay. İstemci hayalet satırlarla kalır ve her yeniden bağlanmada aynı sonuç — kendiliğinden **hiç toparlanmaz**. | Tabloya `L > ringBounds.to → resync {reason:"gap"}` dalı eklensin; `stream.test.ts`'e `L = to` ve `L = to + 1` sınır testleri, §8'e ilgili mutasyon eklensin. |
| 4 | BLOKLAYICI | §2.2 satır 127 (`src/web/App.tsx`) vs `tests/e2e/shell.spec.ts:39-40` | Sekmeler gerçek `<button role="tab">` olunca mevcut E2E'nin `header button, header a, header [role=button]` sayısı = 0 assert'i **kırmızıya döner**. `tests/e2e/shell.spec.ts` §2.2'de hiç listelenmemiş. Aynı dosyadaki F-002 devri de ("F-003 gerçek bir panel yüzeyi getirdiğinde üçüncü bir ölçüm noktası eklenecektir", shell.spec.ts N1 yorumu) sözleşmede hiç geçmiyor. Ayrıca Kanban/Ayarlar'ı işlevsiz `<button>`'a çevirmek F-001'in "iş yapmayan buton" yasağına giriyor. | `tests/e2e/shell.spec.ts` §2.2'ye eklensin: (a) tıklanabilir-öğe assert'inin yerine ne geleceği yazılsın, (b) yeni panel yüzeyi için üçüncü renk ölçüm noktası eklensin, (c) Kanban/Ayarlar F-005/F-007'ye kadar tıklanamaz kalsın — yalnızca Zaman Çizelgesi gerçek buton olsun. |
| 5 | BLOKLAYICI | §5 satır 374 ve 377-382, §9 madde 5 | AC5 E2E'si "gerçek süreç kill/restart" diyor ama **hangi süreç** olduğu tanımsız. `playwright.config.ts`'teki tek sunucu Playwright'ın kendi `webServer`'ı: sabit 7333 portu, `MC_DATA_DIR` **verilmemiş** (mimari §11.3 geçici veri dizini istiyor), Playwright öldürülen webServer'ı yeniden başlatmaz ve `src/server/index.ts:264-268` EADDRINUSE'ta `process.exit(1)` yapıyor → Windows'ta port serbest kalmadan restart yarışı. Plan bu hâliyle uygulanabilir değil. | §5'te mekanizma yazılsın: E2E kendi sunucusunu (ayrı port + geçici `MC_DATA_DIR`) spawn edip sayfayı ona yönlendirsin ve **onu** öldürsün; ya da kill/restart entegrasyon katmanına (gerçek soket `destroy`) indirilip E2E yalnızca rozet metni + canlıya dönüşü doğrulasın. Seçilen yol §2.2 dosya listesine yansısın. |
| 6 | ÖNEMLİ | §7 satır 458-463 · `src/server/store/jsonl-store.ts:195,213,226` | N-1 planı `ring.push`'un **hangi** `.then` dalına gideceğini söylemiyor. `queue = writeResult.then(...)` (satır 213) geri çağrımı, çağırana dönen zincirden (satır 226) önce kayıtlıdır; push oraya konmazsa `POST` 202 aldıktan hemen sonraki `GET /api/events` olayı görmeyebilir (yarış). Ayrıca §7'nin 3. testi (503'te SSE'ye hiçbir şey yayılmaması) §8 mutasyon tablosunda yok. | §7'ye "push, `lineCounts` güncellemesiyle aynı başarı geri çağrımında yapılır; çağırana dönen promise çözülmeden önce ring güncel olur" cümlesi; §8'e "ingest 503 dalında da `hub.broadcast` çağrılır → SSE negatif testi KIRMIZI" mutasyonu eklensin. |
| 7 | ÖNEMLİ | §4 satır 300 ("sayı değil / negatif") | `Last-Event-ID` ayrıştırması `Number()` semantiğiyle yazılmış: `Number("")===0`, `Number("1e3")===1000`, `Number(" 12 ")===12` — hepsi `Number.isInteger` geçer. Ayrıca "çözülemiyor → hiçbir şey yapma, canlı akışa geç" seçimi bozuk başlıkta telafiyi **sessizce** düşürür (AC5'in tam tersi). | Ayrıştırma "yalnızca rakamlardan oluşan kırpılmış dizge" olarak tanımlansın; çözülemeyen değer **`resync`** üretsin (kayıpsız taraf). `stream.test.ts`'e `""`, `"1e3"`, `" 12 "`, `"abc"`, `"-1"` ve çok büyük değer vakaları eklensin. |
| 8 | ÖNEMLİ | §3 madde 5 satır 214-224 · `docs/03-ux.md:78-80` | Tek `frozen` bayrağı iki farklı niyeti birleştiriyor. Kullanıcı "Duraklat"a basıp sonra en üste kaydırırsa `scrollTop===0` koşulu duraklatmayı **sessizce iptal eder**; tersine, kaydırılmış hâldeyken "Devam et" listeyi zorla en üste atar. UX bunları ayrı iki davranış olarak tanımlıyor. | İki bağımsız bayrak (`pausedByUser`, `scrolledAway`), `frozen = pausedByUser veya scrolledAway`; "Duraklat + en üste kaydır → hâlâ duraklı" ve "kaydırılmışken Devam et → yalnızca duraklatmayı kaldırır" testleri §5'e eklensin. |
| 9 | ÖNEMLİ | §3 madde 4 satır 202-208 vs §3 madde 5 satır 221 | 1000 olay tavanı ile "hiçbir olay kaybolmaz" iddiası çelişiyor: duraklatılmış panelde 1000'i aşan olaylar en eskiden düşer, "Devam et" UX'in söylediği "o ana kadar biriken **tüm** olaylar"ı gösteremez. Tavanın filtre uygulanmışken neye göre sayıldığı ve aşımda kullanıcının bilgilendirilip bilgilendirilmediği de tanımsız. | §3'te netleşsin: tavan **filtresiz** olay listesine uygulanır, aşımda en eskiler düşer, "Devam et" ifadesi "tavan içinde biriken tüm olaylar" olarak düzeltilir; kullanıcı bilgilendirilecek mi kararı yazılıp testlensin. |
| 10 | ÖNEMLİ | §5 satır 370 (AC1) | AC1'in "2 saniye"si **hiçbir katmanda** ölçülmüyor: entegrasyon olay-güdümlü ama tavansız, E2E `toBeVisible()` varsayılan 5 sn auto-retry ile geçer. 4,9 sn'de görünen bir uygulama yeşil kalır. CEO kararı D "kırılgan duvar saati kapısı" yasağıydı, "hiç ölçme" değil. | Tek bir nicel tavan konsun: entegrasyonda "202 yanıtından sonra `event` çerçevesi 2000 ms içinde gelir" (bekleme olay-güdümlü, tavan `waitForFrame` timeout'u) ve E2E'de `expect(row).toBeVisible({ timeout: 2000 })`. |
| 11 | ÖNEMLİ | §5 satır 375 (AC6) · §2.1 `TimelineScreen.test.tsx` | AC6'nın "listeyi kaydırmaz" yarısı jsdom'da **ölçülemez**: jsdom layout yapmaz, `scrollTop`/`clientHeight` her zaman 0, gerçek `scroll` olayı üretilmez. Kaydırmayla oto-dondurma ve "N yeni olay ↑" rozeti de aynı sebeple jsdom'da kanıtlanamaz; E2E'de AC6 için yalnızca "Duraklat butonu" (1 doğrulama) planlanmış. | jsdom testinin iddiası "dondurulmuşken render edilen satır sayısı değişmez"e daraltılsın; kaydırmayla oto-dondurma + "N yeni olay ↑" + listenin sıçramaması `timeline.spec.ts`'e (gerçek layout) taşınıp §5 tablosuna yazılsın. |
| 12 | ÖNEMLİ | §1/§2.1/§5 (hiç geçmiyor) vs `docs/03-ux.md:74, 281-289, 300` | G3'te onaylanmış Zaman Çizelgesi durumları sözleşmede yok: boş durum ("Henüz olay yok…"), yükleniyor iskeleti ("Son 100 olay yükleniyor…"), hata banner'ı ("Olay geçmişi yüklenemedi. [Tekrar dene]"), "veri okunamadı" durumu, sekme bazlı hata sınırı. Ekran-1'in durum çubuğundaki **olay hızı ("128 olay/dk")** de yok. Ayrıca "filtre seçimi tarayıcı oturumu boyunca hatırlanır" gereği karşılanmıyor: `TimelineScreen` yalnızca aktif sekmede monte edildiği için filtreler her sekme geçişinde sıfırlanır. | Bu durumlar + olay hızı §1/§2.1'e alınsın ve her biri için en az bir jsdom testi §5'e eklensin; filtre state'i mount noktasının üstünde (veya `sessionStorage`'da) tutulup testlensin. Kapsam dışı bırakılacaksa gerekçesiyle CEO onayına sunulsun. |
| 13 | ÖNEMLİ | §3 madde 6 satır 226-235 · §4 satır 357-362 · §9 madde 2 · `docs/03-ux.md:58` | "Yeniden bağlanıyor" durumunun düşürülmesi, G3'te onaylanmış ekrandan **kullanıcının göreceği** bir sapma → CLAUDE.md'ye göre CEO'ya sorulacak sınıfta; developer'ın tek başına kapatacağı "düşük etkili karar" değil. Dayanak da hatalı: EventSource yeniden denerken `error` olayı `readyState === CONNECTING` ile ateşlenir, `CLOSED` yalnızca kalıcı başarısızlıkta oluşur — ayrım native API'de **mevcut**. Aynı yanlış öncül §4'teki "403 sonsuz reconnect döngüsü" iddiasını da üretiyor: spec, 200 olmayan yanıtta bağlantıyı kalıcı olarak başarısız kılar (yeniden deneme YOK). | Ya 3 durum uygulansın (`OPEN`→Bağlı; hata + `CONNECTING`→Yeniden bağlanıyor; `CLOSED` veya N sn üzeri→Bağlantı koptu — AC5'in "bağlantı koptu"sunun hangi eşikte görüneceği yazılsın), ya da sapma açıkça CEO onayına sunulup sözleşmeye kaydedilsin. §4'teki 403 cümlesi düzeltilsin. |
| 14 | ÖNEMLİ | §6 sürüm tablosu satır 405-409 | `jsdom@30.0.1`'in `engines` alanı `^22.22.2 || ^24.15.0 || >=26.0.0` (✓ VERIFIED, tarball manifesti okunarak). Bu, `package.json`'ın `engines.node: ">=20.11"` beyanı ve `src/server/index.ts:36-44` (`isSupportedNodeVersion` ≥ 20.11) ile **çelişiyor**: Node 20/21/23/24.0-24.14/25'te `npm ci` EBADENGINE uyarısı verir ve jsdom çalışmayabilir. `^30` aralığı bu tabanı ileride daha da yükseltebilir. | ADR-010 taslağına gerçek `engines` aralığı yazılsın; ya proje Node tabanı yükseltilsin (CEO kararı: `package.json` + `isSupportedNodeVersion` + `ci.yml` birlikte) ya da `>=20.11` ile uyumlu bir jsdom sürümü sabitlensin. |

### CEO kararları uyum kontrolü

| Karar | Durum | Kanıt / kayıt |
|---|---|---|
| **A** — ilk yükleme ring'den; disk destekli sayfalama kapsam dışı | Uyulmuş | §1 satır 63 (`GET /api/events` değişmiyor), §3 madde 9 `hello`'yu bilgi taşıyıcıya indirip ilk render'ı REST'e bağlıyor. NOT: §3 madde 9'daki `limit=…` boş bırakılmış; PRD F1/AC6'nın "≥100 olay"ı için somut değer yazılmalı (varsayılan 200 yeterli). |
| **B** — liste sanallaştırma yok | Uyulmuş | §1 satır 64, §3 madde 4: `react-window` yok, yerine 1000 tavanı. Tavanın semantiği eksik → Bulgu 9. |
| **C** — N-1 F-003 kapsamında, sunucuya dokunulabilir | Uyulmuş | §1 madde 2, §2.2 (`jsonl-store.ts`, `ingest.ts`), §7 tam plan. Teşhis kodla birebir örtüşüyor (`jsonl-store.ts:195`, `ring.push` yazma denemesinden önce). Uygulama detayı eksik → Bulgu 6. |
| **D** — "2 saniye" kırılgan duvar saati kapısıyla ölçülmeyecek | Aşırı uyulmuş | §5 AC1: "tek kademeli sert `elapsedMs<X` assert'i YAZILMAZ" — yerine hiçbir tavan konmamış, AC1 ölçülmüyor → Bulgu 10. |
| **E** — DOM test altyapısı ADR taslağı zorunlu, native derleme yasak | Uyulmuş | §6 tam bir taslak; dört pakette de `hasInstallScript` yok, `canvas` opsiyonel peer (aşağıda bağımsız doğrulandı). `tests/deps.test.ts` ve `tests/no-external-host.test.ts` etkisi doğru analiz edilmiş (✓ VERIFIED: guard glob'ları `src/web/**` `.ts` ve `src/features/**` `.tsx`'i zaten yürüyor). Eksik: `engines` çakışması → Bulgu 14. |
| **F** — filtreler yalnızca görünüm, sunucu taraflı filtreleme yok | Uyulmuş | §1 satır 65-66 (`query.ts`'e parametre eklenmiyor), §5 AC3: sahte `fetch`'in aldığı URL assert edilecek. Assert'in ölçmeme riski aşağıda (madde 5). |
| **G** — kapsam yalnızca zaman çizelgesi ekranı | Büyük ölçüde uyulmuş | Kanban, kapılar paneli, proje kayıt, yazma kapısı, sunucu taraflı filtreleme, yeni state kütüphanesi **sızmamış** (§1 "Kapsam DIŞI" + §3 madde 4). Tek sızma: Kanban/Ayarlar sekmelerinin işlevsiz `<button>`'a çevrilmesi → Bulgu 4. `playwright.config.ts` genişletmesi gerekli ve minimal; `src/web/App.tsx` genişletmesi gerekli (onsuz ekran hiçbir yerde görünmez) ama önerilen hâli minimalden bir adım büyük. |

### `testMatch` bulgusunun gerçek kapsamı

✓ VERIFIED: `playwright.config.ts:5` gerçekten `testMatch: 'shell.spec.ts'`; genişletme olmadan
`tests/e2e/timeline.spec.ts` **hiç koşmaz** — sözleşmenin talebi haklı ve minimal.

Ama "diğer E2E'ler de koşmuyor" iması doğru değil: depoda yalnızca iki spec var
(`tests/e2e/shell.spec.ts`, `tests/e2e/dev-shell.spec.ts` — ✓ VERIFIED, `find` ile) ve ikincisi
`playwright.dev.config.ts:5`'in `testMatch: 'dev-shell.spec.ts'` ayarıyla `npm run e2e:dev`
üzerinden koşuyor. `send-event` için E2E dosyası hiç yok (F-004 onu
`tests/integration/send-event-hook.test.ts` ile vitest'te doğruluyor). `docs/progress.md`'deki
"`e2e` = 0 (1/1), `e2e:dev` = 0 (1/1)" kayıtları dürüst; yetim/sessizce atlanan spec **yok**.

Asıl mevcut kusur başka ve sözleşme onu görmüyor: `npm run verify` E2E içermiyor ve
`.github/workflows/ci.yml` yalnızca `verify` çalıştırıyor (✓ VERIFIED) → **CI hiçbir E2E
koşmuyor**. AC1 ve AC5'in kullanıcı seviyesindeki tek kanıtı hiç otomatik koşmayan bir katmanda
duruyor. Bu F-001'in bilinçli kararı olduğu için kapsam genişletmesi istemiyorum; ama sözleşme
"AC1/AC5'in bağlayıcı regresyon katmanı entegrasyondur; E2E kanıtı kod turunda elle koşulup
çıktısı `docs/progress.md`'ye yazılır" cümlesini içermeli.

### Ölçmeyen test riski

Yeşil kalabilecek assert'ler (bu projede beşinci kez aranan sınıf):

1. **AC1 E2E `toBeVisible()`** — varsayılan 5 sn auto-retry; 2 sn kriteri ihlal edilse de yeşil
   (Bulgu 10).
2. **AC6 jsdom "listeyi kaydırmaz"** — jsdom'da layout/scroll yok; uygulama gerçekten sıçrasa
   bile assert yeşil kalır. **En tehlikelisi bu** (Bulgu 11).
3. **`sse-stream.test.ts` "`Last-Event-ID` içeride telafi"** — "eksik olaylar geldi" biçiminde
   yazılırsa, `Last-Event-ID`'yi tamamen yok sayıp **tüm ring'i** tekrar gönderen bir sunucu da
   geçer. İstenen: ilk `event` çerçevesinin `id`'si tam `L+1` olsun ve akışta `id <= L` olan
   hiçbir çerçeve bulunmasın.
4. **N-1'in SSE negatif testi (§7 madde 3, "300 ms içinde hiçbir `event` gelmez")** —
   `hub.broadcast` hiç yazılmamış olsa da geçer; aynı bağlantı üzerinde pozitif teslim
   assert'iyle eşleştirilmeli.
5. **Decision F kanıtı (`useEventStream.test.ts`, "sunucuya filtre param'ı gitmiyor")** — sahte
   `fetch` hiç çağrılmamışsa da geçer; çağrı sayısı + tam URL eşitliği assert edilmeli.
6. **Mutasyon 6 (abone sayısı 0'a düşer)** — hub'ın iç sayacını okumak soketin kapandığını
   kanıtlamaz; istemci tarafında akışın sonlandığı gözlenmeli.

### resync sınır tablosu (elle yürütüldü)

`ringBounds = {from, to}`, `L = Last-Event-ID`. Sözleşme §4 satır 298-306'ya göre:

| Vaka | Sözleşme davranışı | Doğru mu | Yeniden bağlanma döngüsü riski |
|---|---|---|---|
| `L === from` | `store.read(L, ringSize)` → `(L, to]` replay | Doğru, kayıp yok | Yok |
| `L === from - 1` | `resync` | Gereksiz: `from..to` zaten ring'de, kayıp yok. ADR-004 madde 4'ten miras off-by-one; kayıpsız ama pahalı (tam yeniden yükleme). NOT — düzeltme şart değil, bilinçli olduğu yazılmalı. | Yok |
| `L === to` | Replay boş → canlı akış | Doğru | Yok |
| `L > to` (istemci ileride: veri dizini silinmiş / `.seq` sıfırlanmış / yedeğe dönülmüş) | **Tanımsız**; `L >= from` dalına düşer, `read` boş döner, `resync` gitmez | **Kalıcı sessiz bozukluk**: istemci hayalet satırlarla kalır, yeni olay göremez | Döngü değil ama **kendiliğinden toparlanma yok** → Bulgu 3 |
| Ring boş (`ringBounds === null`), sunucu hiç olay görmemiş | `resync` | Doğru; istemci REST'ten boş liste alır, boş durumu gösterir | Yok (bağlantı başına tek `resync`, SSE kapanmıyor) |
| Ring boş ama seq sıfırlanmamış (retention tüm günleri budamış) | `resync` | Doğru | Yok |
| `Last-Event-ID` yok | Replay/resync yok, canlı akışa geç | Doğru (CEO kararı A ile ilk yükleme REST'ten) | Yok |
| `Last-Event-ID` bozuk (`"abc"`) | "Hiçbir şey yapma, canlı akışa geç" | Yanlış taraf: telafi sessizce düşer, `resync` doğru olur | Yok, ama sessiz olay kaybı → Bulgu 7 |
| `Last-Event-ID` = `""` / `"1e3"` / `" 12 "` | `Number()` ile sırasıyla 0 / 1000 / 12 olarak **geçerli** sayılır | Ayrıştırma kuralı belirsiz → Bulgu 7 | `"1e3"` vakası `L > to` ile birleşince yukarıdaki kalıcı bozukluk |
| `hello` sonrası, telafi çerçeveleri gelmeden kopma (her vaka) | — | `hello`'nun `id:`'si istemcinin `Last-Event-ID`'sini ileri sıçratır → telafi aralığı kalıcı kaybolur | Döngü değil, **veri kaybı** → Bulgu 2 |

### ADR-010 iddia doğrulaması

Yöntem: `npm view` (registry metadata) + `npm pack` ile tarball indirilip **paket içeriğinin
kendisi** okundu (geçici dizin, sonra silindi). Depoya hiçbir paket kurulmadı, `package.json`
ve `package-lock.json` değişmedi.

| Sözleşmenin iddiası | Sonuç | Kanıt |
|---|---|---|
| `jsdom` en güncel 30.0.1 | Doğru | `npm view jsdom version` → 30.0.1 |
| `@testing-library/react` 16.3.3 | Doğru | `npm view` |
| `@testing-library/user-event` 14.6.7 | Doğru | `npm view` |
| `@testing-library/dom` peer `^10.0.0` | Doğru (registry'deki güncel sürüm 10.4.1) | `npm view @testing-library/react peerDependencies` |
| Adaylarda `hasInstallScript` yok | Doğru | `npm view <pkg> hasInstallScript` → alan yok (jsdom, RTL, user-event, @testing-library/dom) |
| `canvas` opsiyonel peer, npm otomatik kurmaz | Doğru | `npm view jsdom peerDependenciesMeta` → `{ canvas: { optional: true } }`. Peer aralığı `^3.2.3`; kurulursa node-gyp derlemesi olur, kurulmadığı için `deps.test.ts` etkilenmez |
| `jsdom` `EventSource` uygulamıyor | Doğru | `jsdom-30.0.1.tgz` açıldı; `package/lib` altında "EventSource" dizgesi **0 kez** geçiyor |
| `happy-dom` `EventSource` uygulamıyor | Doğru | `happy-dom-20.14.0.tgz` açıldı; paketin **tamamında** "EventSource" 0 kez geçiyor |
| `jsdom`'da `WebSocket` var | Doğru | Aynı tarball'da 62 eşleşme |
| `jsdom` bağımlılık ağacında install-script yok | Kısmen doğrulandı — üst seviye bağımlılıklar (undici@^8, tough-cookie@^6, parse5@^8, css-tree, saxes, @exodus/bytes vb.) listelendi, hiçbiri bilinen native paket değil; ağaç tam gezilmedi | Sözleşmenin "kesin doğrulama `npm install` sonrası `deps.test.ts` ile" planı kabul edilebilir |
| **Sözleşmede hiç geçmeyen kritik gerçek** | Eksik | `jsdom@30.0.1` `engines`: `^22.22.2 || ^24.15.0 || >=26.0.0`, proje `engines.node: ">=20.11"` ile çelişiyor → Bulgu 14 |

### Kod turuna başlamak için

14 bulgunun 5'i BLOKLAYICI. Sözleşme bunlar kapatılmadan kod turuna geçmemeli. İkinci tur
yalnızca bu 14 bulguya bakacak; onaylanmış bölümler yeniden açılmayacak.

---

## Developer düzeltme yanıtı — tur 2 (2026-09-05)

Kapsam: yalnızca bu dosya düzenlendi (`git status` bunu doğrular). `src/`, `tests/`, `scripts/`,
`.claude/`, `package.json`, `.github/workflows/ci.yml`'de hiçbir değişiklik yok. Bu turda yeni
gerçek veri toplandı: `nodejs.org/dist/index.json` (Node sürüm listesi), `npm view`/`npm pack`
ile 10+ jsdom sürümünün `engines` alanı ve tarball içerikleri (27.0.0, 27.0.1, 27.1-27.4, 28.x,
29.x, 30.x). CEO kararları D1-D7'ye itiraz edilmedi, hepsi uygulandı.

### CEO kararları D1-D7

- **D1 (Yeniden bağlanıyor durumu geri geldi):** §3 madde 6 tamamen yeniden yazıldı — 3 durum
  (`connected`/`reconnecting`/`disconnected`), `EventSource`'un `open`/`error` olayları +
  `readyState` (`CONNECTING`/`CLOSED`) ayrımından türetiliyor, özel retry/backoff kodu yok. §4'ün
  "403 sonsuz döngüsü" cümlesi de düzeltildi (aynı yanlış öncülün ikinci belirtisiydi) — bkz.
  Bulgu 13.
- **D2 (E2E CI'da koşacak):** §2.2'ye yeni satırlar: `.github/workflows/ci.yml` (bağımsız `e2e`
  job'ı, windows-latest, `npm run e2e`), `tests/ci-workflow.test.ts` (yeni job'u ve `verify`'a
  sızmadığını assert eden testler). `verify` değişmedi, hâlâ E2E'siz/hızlı.
- **D3 (Tel protokolü kayıpsız):** `hello`'dan `id:` kaldırıldı (§3 madde 9, §4 — Bulgu 2);
  `L > ring.to` ve bozuk `Last-Event-ID` ikisi de `resync`'e bağlandı (§4 — Bulgu 3/7); §4'e
  "kendiliğinden toparlanma" akış örneği eklendi.
- **D4 (Kaydırma jsdom'da ölçülmeyecek):** §3 madde 5 (`pausedByUser`/`scrolledAway` ayrımı) ve
  AC6 test satırı (§5) yeniden yazıldı — jsdom testi yalnızca state-only iddiaya daraltıldı,
  kaydırma/oto-dondurma/"N yeni olay ↑" `timeline.spec.ts`'e taşındı (Bulgu 11).
- **D5 (`shell.spec.ts` dosya sahipliğinde):** §2.2'ye eklendi; QA'nın Bulgu 4 düzeltmesiyle
  birlikte tasarım da değişti (aşağıya bakınız).
- **D6 (AC5 E2E kendi sunucusunu spawn eder):** §5'e "AC5 E2E tasarımı" tam olarak yazıldı —
  izole `MC_DATA_DIR` + sabit alt port 7334, `tsx` doğrudan spawn (npm wrapper atlanarak),
  polling health-check, gerçek `child.kill()`/yeniden spawn (Bulgu 5).
- **D7 (jsdom engines veriyle karara bağlandı):** §6 tamamen yeniden yazıldı — `jsdom` tam
  sabitlenmiş `27.0.1`'e düşürüldü (`engines:{node:'>=20'}`, projenin `>=20.11` tabanıyla
  çelişmiyor), `package.json`/`isSupportedNodeVersion`/`ci.yml`'e dokunulmadı (Bulgu 14).

### Bulgu bazlı yanıt

| # | Ne değiştirdim | Bölüm/satır |
|---|---|---|
| 1 (BLOKLAYICI) | `hub.closeAll()` artık `server.on('close', ...)`'a bağlanmıyor — hub-seviyesi bağımsız bir ilkel kaldı (yalnızca kendi biriminde, sahte `res`'lerle test ediliyor). Gerçek soket kapatma `tests/integration/events-api.test.ts`'in `stopServer`'ına taşındı: `server.closeAllConnections()` (Node ≥18.2 native) + `server.close()`. Yeni test: açık SSE'yle 2 sn içinde teardown. | §2.2 `src/server/index.ts` ve `tests/integration/events-api.test.ts` satırları; §3 madde 2 başlığı ve gövdesi. |
| 2 (BLOKLAYICI) | `hello` çerçevesinden `id:` kaldırıldı — yalnızca `event:`/`data:`. Tüm örnek akışlar (§4) ve `hello` açıklaması (§3 madde 9) güncellendi. Mutasyon 7 eklendi (id: geri eklenirse KIRMIZI). | §4 "Bağlantı açılışı" bloğu ve örnek akışlar; §3 madde 9; §8 mutasyon 7. |
| 3 (BLOKLAYICI) | `computeResyncDecision` tablosuna `lastEventId > ringBounds.to → resync` dalı eklendi. §4'e "kendiliğinden toparlanma" akış örneği eklendi. Mutasyon 8 eklendi. | §4 "Last-Event-ID çözümü" tablosu; §8 mutasyon 8. |
| 4 (BLOKLAYICI) | QA'nın önerdiği yönü **birebir** uyguladım: Kanban/Ayarlar hiç `<button>`'a çevrilmiyor, yalnızca Zaman Çizelgesi gerçek `<button role="tab">` oluyor. Bunun doğal sonucu: "aktif sekme" state'i/sekmeler arası geçiş kavramı tamamen kalktı (F-003 zaten tek gerçek ekran getiriyor) — bu aynı zamanda Bulgu 12'yi de basitleştirdi (aşağıya bakınız). `tests/e2e/shell.spec.ts` §2.2'ye eklendi: yeni assert'ler (1 buton, `aria-selected`, Kanban/Ayarlar hâlâ `<span>`) + üçüncü renk ölçüm noktası (`data-testid="timeline-screen"`). | §2.2 `src/web/App.tsx`, `tests/web/App.test.tsx`, `tests/e2e/shell.spec.ts` satırları; §1 madde 5; §3 madde 12. |
| 5 (BLOKLAYICI) | AC5 E2E'si Playwright `webServer`'ından tamamen ayrıldı — kendi `MC_DATA_DIR` + sabit port 7334, doğrudan `tsx` spawn (npm wrapper atlanmadan `child.kill()` yalnızca wrapper'ı öldürebileceği için), polling health-check (sabit sleep yok), gerçek kill + yeniden spawn + Last-Event-ID telafi doğrulaması. | §5 "AC5 E2E tasarımı" (yeni bölüm); §2.1 `tests/e2e/timeline.spec.ts` satırı. |
| 6 (ÖNEMLİ) | Tam yer belirtildi: `ring.push` mevcut satır 195-196'dan, `queue`'nun başarı geri çağrımının içine (satır 214-216) taşınıyor — promise `.then()` kayıt sırası garantisiyle çağırana dönüş öncesi ring güncel oluyor. `ingest.ts`'in 503 dalında yayın yapmadığı zaten doğruydu; negatif test artık pozitif teslimle eşleştiriliyor (§7 test 3) ve §8'e mutasyon 10/11 eklendi. | §2.2 `src/server/store/jsonl-store.ts` satırı; §7 "Hedef" paragrafı ve test 3; §8 mutasyon 10-11. |
| 7 (ÖNEMLİ) | `Last-Event-ID` ayrıştırma kuralı `/^[0-9]+$/` olarak sıkılaştırıldı (`Number()`'ın gevşek semantiği atıldı); bozuk/boş/negatif/üstel/aşırı büyük değerler artık **`resync`** üretiyor (sessizce düşürülmüyor). Test vakaları §2.1 `stream.test.ts`/`sse-stream.test.ts` satırlarına ve §8 mutasyon 9'a eklendi. | §4 "Last-Event-ID ayrıştırma kuralı" (yeni paragraf) ve çözüm tablosu; §8 mutasyon 9. |
| 8 (ÖNEMLİ) | `frozen` tek bayrağı `pausedByUser`+`scrolledAway` olarak ikiye ayrıldı, `frozen = pausedByUser \|\| scrolledAway`; "Duraklat+kaydır" ve "kaydırılmışken Devam et" davranışları ayrı ayrı tanımlandı. Mutasyon 4 güncellendi. | §3 madde 5 (tamamen yeniden yazıldı); §8 mutasyon 4. |
| 9 (ÖNEMLİ) | 1000 tavanının **filtresiz** listeye uygulandığı, "Devam et"in "1000'i aşmayan tüm olaylar" anlamına geldiği netleştirildi; ek bir "N olay düştü" uyarısı eklenmediği ve gerekçesi yazıldı (mevcut "N yeni olay ↑" yeterli). | §3 madde 4 (genişletildi). |
| 10 (ÖNEMLİ) | AC1'e somut sayısal tavan kondu: entegrasyonda `waitForFrame` 2000 ms timeout, E2E'de `expect(...).toBeVisible({timeout:2000})` (Playwright'ın varsayılan 5 sn'si yerine). | §5 AC1 satırı. |
| 11 (ÖNEMLİ) | AC6 jsdom testi "duraklatılmışken render sayısı sabit kalır"a daraltıldı; kaydırma/oto-dondurma/"N yeni olay ↑"/liste sıçramaması `timeline.spec.ts`'e taşındı. | §5 AC6 satırı; §2.1 `TimelineScreen.test.tsx` satırı. |
| 12 (ÖNEMLİ) | Eksik durumların (boş/yükleniyor/hata/veri okunamadı), sekme bazlı hata sınırının (`ScreenErrorBoundary`, yeni dosya) ve olay hızı göstergesinin hepsi §1/§2.1/§3'e eklendi. Filtre hafızası, Bulgu 4'ün sonucu olan "sekmeler arası geçiş yok" tasarımıyla **ek kod olmadan** çözüldü (TimelineScreen hiç unmount olmuyor) — CEO onayına sunulacak bir kapsam daraltması değil, davranış aynen G3'e uyuyor. | §3 madde 11 (yeni), §3 madde 12 (yeniden yazıldı); §2.1 `ScreenErrorBoundary.tsx`/`.test.tsx` satırları. |
| 13 (ÖNEMLİ) | D1 uygulandı: 3 durumlu rozet, `readyState`/`error`/`open` tabanlı doğru ayrım. §4'ün "403 sonsuz döngüsü" cümlesi WHATWG "fail the connection" davranışıyla düzeltildi. | §3 madde 6 (tamamen yeniden yazıldı); §4 "Hata/kalıcı başarısızlık davranışı". |
| 14 (ÖNEMLİ) | D7 uygulandı: `jsdom` tam sabit `27.0.1`'e düşürüldü, gerçek veriyle (Node sürüm listesi + jsdom sürüm geçmişi) doğrulandı, `engines`/`isSupportedNodeVersion`/`ci.yml`'e dokunulmadı. | §6 (baştan yeniden yazıldı: yeni "Sürümler" bölümü + tablo). |

### Kalan bulgular (görev metninde ayrıca vurgulanan)

- **B1 (`hub.closeAll()`/`stopServer` kilitlenmesi):** Bulgu 1 ile aynı madde, yukarıda kapatıldı.
- **N-1'in tam yeri:** Bulgu 6 ile aynı madde, yukarıda kapatıldı — `queue`'nun başarı geri
  çağrımı, satır 214-216.

### Yeni açık sorular

Yok. D1-D7 tüm önceki açık soruları (tur 1 §9 madde 2 ve 5) kapattı. §9 şimdi yalnızca gerçekten
düşük etkili/bilgilendirici notlar içeriyor (Lucide, jsdom pin'in gelecekte gözden geçirilmesi,
"Yeniden bağlanıyor" E2E'de best-effort gözlemi, Windows `child.kill()` varsayımı).

### Riskler (özet, ayrıntı §9)

En büyük risk hâlâ AC5'in E2E'si — artık kendi sunucusunu spawn ettiği için bir hareketli parça
daha eklendi (health-check polling, doğrudan `tsx` spawn). İkincil risk: Bulgu 4 sonrası App.tsx
tasarımının basitleşmesi (aktif-sekme state'i kalktı) — bu, F-005/F-007 gerçek sekmeler
eklediğinde yeniden ele alınacak bir "gelecekteki iş", bu turun riski değil.

---

## QA doğrulama — tur 2 (qa-evaluator, 2026-09-05)

**KARAR: DÜZELTME**
**ESKALE: false**

Kapsam: dar doğrulama turu. Yalnızca tur 1'in 14 bulgusunun kapanışı, CEO kararları D1-D7'nin
uygulanması ve düzeltmenin **kendi ürettiği** kusurlar incelendi. Onaylanmış bölümler (CEO
kararları A-G, ADR-010'un jsdom+RTL seçimi, N-1 yaklaşımı, biçim) yeniden açılmadı. Hiçbir
kaynak kodu/config/`.claude/`/`.github/` dosyası değiştirilmedi; yalnızca bu bölüm eklendi.
Ölçümler depo dışında (scratchpad) yapıldı, `npm install` çalıştırılmadı.

Genel: tur 2 ciddi bir düzeltme turu — 14 bulgunun **14'ü de kapandı**, D1-D7'nin yedisi de
uygulandı ve jsdom `engines` kararı gerçek registry verisiyle desteklendi (bağımsız doğrulandı).
Ancak Bulgu 4'ün "yalnızca Zaman Çizelgesi butona dönüşür" sadeleştirmesi bir a11y/tutarlılık
regresyonu üretti, AC5 E2E'sinin sabit portu projenin kendi `MC_WEB_PORT` varsayılanıyla
çakışıyor ve paylaşılan E2E sunucusu izole edilmemiş gerçek `data/` dizinini okuyor. Üçü de
sözleşme metninde birer paragrafla kapanır.

### Tur 1 bulguları — kapanış tablosu

| # | Şiddet | Durum | Kanıt |
|---|---|---|---|
| 1 | BLOKLAYICI | **KAPANDI** | §2.2 `src/server/index.ts` satırı: `hub.closeAll()` artık `server.on('close')`'a bağlanmıyor; `tests/integration/events-api.test.ts` satırı `stopServer`'a `closeAllConnections()` + `close()` sırasını yazıyor; §3 madde 2 tuzağı doğru tarif ediyor. Node tabanı `>=20.11` olduğu için `closeAllConnections` (>=18.2) her ortamda var. Üretimde sızıntı yok — ayrıntı aşağıda. |
| 2 | BLOKLAYICI | **KAPANDI** | §4 "Bağlantı açılışı" bloğunda `id:` satırı yok, §3 madde 9 gerekçeyi yazıyor, üç örnek akışın hiçbirinde `hello` `id:` taşımıyor; §2.1 `sse-stream.test.ts` "hello çerçevesinde `id:` YOK" assert'i; §8 mutasyon 7. |
| 3 | BLOKLAYICI | **KAPANDI** | §4 çözüm tablosunda `lastEventId > ringBounds.to → resync {reason:"gap"}` dalı var; §4'e "kendiliğinden toparlanma" akış örneği eklendi; §2.1 `stream.test.ts` `L=to`/`L=to+1` sınır vakaları; §8 mutasyon 8. |
| 4 | BLOKLAYICI | **KAPANDI** (istenen üç maddenin üçü de) | (a) §2.2 `tests/e2e/shell.spec.ts` satırı: satır 39-40 assert'i kaldırılıp `header button[role="tab"]` sayısı = 1 + `aria-selected` ile değiştiriliyor; (b) üçüncü renk ölçüm noktası `data-testid="timeline-screen"` (shell.spec.ts:58-61 yorumundaki F-002 borcu) karşılanıyor; (c) Kanban/Ayarlar `<span>` kalıyor. **Ancak** bu düzeltmenin ürettiği yeni kusur için bkz. YENİ-1. |
| 5 | BLOKLAYICI | **KAPANDI** (mekanizma yazıldı) | §5 "AC5 E2E tasarımı" 6 adımlı somut plan: izole `MC_DATA_DIR`, ayrı port, doğrudan `tsx` spawn, polling health-check (`/api/health` gerçekten var, `index.ts:237`), gerçek kill + yeniden spawn; §2.1 `timeline.spec.ts` satırına yansıdı. Planın port seçimi ve süreç ağacı varsayımı hakkında bkz. YENİ-2 ve "AC5 E2E süreç ağacı". |
| 6 | ÖNEMLİ | **KAPANDI** | §7 "Hedef": `ring.push` satır 195-196'dan `queue = writeResult.then(...)` **başarı** geri çağrımına (satır 214-216, `lineCounts.set` ile aynı blok) taşınıyor; kayıt sırası argümanı doğru — kod okundu (`jsonl-store.ts:212` `writeResult`, `:213` `queue = writeResult.then(...)`, `:226` çağırana dönen `.then`) ✓ VERIFIED. §7 test 3 negatif+pozitif eşleştirmesi ve §8 mutasyon 10/11 var. |
| 7 | ÖNEMLİ | **KAPANDI** | §4 "Last-Event-ID ayrıştırma kuralı": `/^[0-9]+$/`, `MAX_SAFE_INTEGER` üstü geçersiz, geçersiz değer **`resync`** üretir (kayıpsız taraf); §2.1 `stream.test.ts` vaka listesi (boş dizge, `"1e3"`, `" 12 "`, `"abc"`, `"-1"`, çok büyük); §8 mutasyon 9. |
| 8 | ÖNEMLİ | **KAPANDI** | §3 madde 5 iki bağımsız bayrak + `frozen = pausedByUser veya scrolledAway`; iki davranış (Duraklat+kaydır, kaydırılmışken Devam et) ayrı ayrı yazılmış; §8 mutasyon 4. |
| 9 | ÖNEMLİ | **KAPANDI** | §3 madde 4: tavan **filtresiz** listeye uygulanır, aşımda en eski düşer, "Devam et" ifadesi "1000'i aşmayan tüm olaylar" olarak düzeltilmiş, kullanıcı bilgilendirilmeyecek kararı gerekçesiyle yazılmış. |
| 10 | ÖNEMLİ | **KAPANDI** | §5 AC1: entegrasyonda `waitForFrame` 2000 ms tavanı, E2E'de `toBeVisible({timeout: 2000})` (Playwright varsayılan 5 sn'si açıkça düşürülüyor). |
| 11 | ÖNEMLİ | **KAPANDI** | §5 AC6 + §2.1 `TimelineScreen.test.tsx`: jsdom iddiası "render edilen satır sayısı sabit, `pendingCount` artar"a daraltıldı; kaydırma/oto-dondurma/"N yeni olay" `timeline.spec.ts`'e taşındı. |
| 12 | ÖNEMLİ | **KAPANDI** | §3 madde 11 (boş/yükleniyor/hata/veri okunamadı/hata sınırı/olay hızı — UX doc satır 283 ve 287 ile karşılaştırıldı, metinler birebir), §2.1 `ScreenErrorBoundary.tsx`/`.test.tsx`, §3 madde 12 filtre hafızası. UX'in "hiç proje yoksa Ayarlar'a git" varyantının kapsam dışı bırakılması gerekçelendirilmiş — kabul (F-005 olmadan "izlenen proje" kavramı yok). |
| 13 | ÖNEMLİ | **KAPANDI** | §3 madde 6: 3 durum, `open`/`error` + `readyState` ayrımı, özel retry yok; §4 "Hata/kalıcı başarısızlık" paragrafı 403 sonsuz döngü iddiasını WHATWG "fail the connection" ile düzeltiyor (spec okuması doğru); §8 mutasyon 14. |
| 14 | ÖNEMLİ | **KAPANDI** | §6 sürüm bölümü; iddialar bağımsız doğrulandı (`npm view`, 2026-09-05): `jsdom@27.0.0`/`27.0.1` → `{"node":">=20"}`, `27.1.0` → `^20.19.0 || ^22.12.0 || >=24.0.0`, `30.0.1` → `^22.22.2 || ^24.15.0 || >=26.0.0`. Tam sabit `27.0.1` projenin `>=20.11` tabanıyla çelişmiyor. `npm view jsdom@27.0.1 hasInstallScript` → alan yok; `peerDependenciesMeta` → `{canvas:{optional:true}}` ✓ VERIFIED. |

Kapanmayan tur 1 bulgusu **yok**. Karar aşağıdaki üç YENİ (regresyon) bulgusundan geliyor.

### D1-D7 uyum kontrolü

| Karar | Durum | Kanıt |
|---|---|---|
| **D1** — üç bağlantı durumu, yanlış öncüller düzeltilsin | Uygulanmış | §3 madde 6 üç durumu UX doc satır 58'in kelimeleriyle (`Bağlı` / `Yeniden bağlanıyor` / `Bağlantı koptu`) tanımlıyor; `readyState` öncülü doğru (`CONNECTING` reconnect, `CLOSED` kalıcı); "403 sonsuz döngüsü" cümlesi §4'te düzeltildi. İlk bağlanmanın 4. durum yapılmayıp "Yeniden bağlanıyor" görselini alması UX'in 3 durumuyla tutarlı. |
| **D2** — ayrı E2E job + `ci-workflow.test.ts` assert'i | Uygulanmış | §2.2'ye `.github/workflows/ci.yml` (bağımsız `e2e` job, windows-latest, `playwright install chromium`, `npm run e2e`) ve `tests/ci-workflow.test.ts` (yeni assert'ler + `verify` bloğuna sızmadığı kontrolü) satırları eklendi. Mevcut dosyalar okundu: bugün ci.yml'de tek `verify` job'ı var, `ci-workflow.test.ts` `ciContent` tamamını tarıyor → planlanan negatif assert'ler (matris yok) genişlemeyle bozulmuyor. NOT-1'e bakınız (assert gücü). |
| **D3** — `hello`'dan `id:`, `L > ring.to`, bozuk `Last-Event-ID` | Uygulanmış | Bulgu 2/3/7 satırları. |
| **D4** — kaydırma jsdom'dan E2E'ye | Uygulanmış | Bulgu 11 satırı. |
| **D5** — `shell.spec.ts` sahiplikte + üçüncü renk ölçüm noktası | Uygulanmış | §2.2 `tests/e2e/shell.spec.ts` satırı; `shell.spec.ts:58-61`'deki F-002 borcu (`#root > div`'e ek üçüncü nokta) `data-testid="timeline-screen"` ile karşılanıyor. |
| **D6** — AC5 E2E kendi sunucusunu kurar | Uygulanmış, iki kusurla | §5 "AC5 E2E tasarımı". Port seçimi → YENİ-2; süreç ağacı varsayımı → NOT-2. |
| **D7** — `jsdom` engines kararı veriyle | Uygulanmış | §6 tablosu; yukarıda registry'den bağımsız doğrulandı. |

### Sekme sadeleştirmesi değerlendirmesi (G3 ve a11y)

Okunan kaynak: `docs/03-ux.md` satır 15-21 (gezinme kararı), 19 (faz bazlı ekleme kuralı),
21 (Ayarlar'ın özel konumu), 41/51 (wireframe), 419/435 (bileşen envanteri), 441-445
(erişilebilirlik). Mevcut kabuk: `src/web/App.tsx:13-19` — `<nav>` içinde üç düz `<span>`.

**1) G3 açısından: kısmi sapma, ama asıl sapma devralınmış.** UX satır 19 net: "yarım
bırakılmış, tıklanamayan sekmeler kullanıcıya 'ürün eksik' hissi verir" — bu yüzden Faz 2
sekmeleri "gri/kilitli/yakında" tutucu olarak bile gösterilmez. Kanban Faz 1 ekranıdır (satır
65) ve F-007'ye kadar zaten yoktur; Ayarlar ise UX'e göre **sekme bile değildir**, sağda sabit
bir dişli ikonudur (satır 21). Yani "Kanban ve Ayarlar sekme çubuğunda tıklanamaz metin olarak
duruyor" durumu F-001/F-002'den devralınan bir borç; F-003 onu **yaratmıyor**. Sözleşmenin
seçimi (dokunmamak) bu açıdan savunulabilir ve Karpathy §3'e uygun. **Ama** tam bir tanesini
"seçili" görünümlü gerçek bir kontrole çevirmek, yanındaki iki ölü metni ilk kez "devre dışı
sekme" gibi okutur — kullanıcıya "bozuk/pasif" sinyali verir. Bu tek başına KALDI sebebi değil;
kabul edilebilir bir geçiş durumu sayıyorum, ancak sözleşmede **açıkça** "Kanban/Ayarlar Faz 1
sonunda UX satır 19/21'e göre yeniden düzenlenecek (Ayarlar dişli ikonuna taşınacak)" notu
bulunmalı ki borç kaybolmasın (NOT-4).

**2) A11y açısından: gerçek bir regresyon — YENİ-1.** Sözleşmede `role="tablist"`,
`role="tabpanel"`, `aria-controls` **hiç geçmiyor** (grep ile doğrulandı; yalnızca satır 60, 139,
140, 142'de `role="tab"` + `aria-selected`). WAI-ARIA'da `tab` rolünün zorunlu bağlam rolü
`tablist`'tir ve bir `tab` bir `tabpanel`'i kontrol etmelidir; `tablist` ebeveyni olmayan bir
`tab` geçersizdir (axe-core `aria-required-parent` ihlali) ve ekran okuyucular bunu "sekme, 1/1,
seçili" olarak güvenilir biçimde duyurmaz. Klavye tarafı da eksik: sekme deseni ok tuşu
gezinmesi + roving `tabindex` bekler; tek sekmede bunların hiçbiri anlamlı değildir. Üstelik
sözleşme butonun tıklamasını **açıkça no-op** olarak tanımlıyor (§2.2 App.tsx satırı: "tıklaması
no-op — zaten tek/seçili ekran") — bu, Kanban/Ayarlar'ı buton yapmamak için gerekçe gösterilen
F-001 "iş yapmayan buton" yasağının tam olarak kendisidir; kural kendi içinde tutarsız
uygulanmış oluyor.

**Görüşüm:** Sadeleştirmenin *state* tarafı (aktif-sekme `useState`'inin kalkması, filtre
hafızasının bedavaya çözülmesi) zekice ve doğru — G3'e aykırı değil. ARIA `tab` rolü tarafı ise
a11y regresyonudur ve ücretsiz kaçınılabilir: F-003 bir sekme deseni **kurmamalı**. En basit
doğru biçim hiç `role` kullanmamaktır — Zaman Çizelgesi etiketi görsel olarak vurgulanmış statik
bir öğe (`aria-current="page"` yeterli) kalsın; gerçek `tablist`/`tabpanel`/ok tuşu deseni ilk
gerçek sekme geçişini getiren feature'ın (F-005/F-007) işi olsun. Bu yolda "gerçek panel yüzeyi"
kanıtı zaten `data-testid="timeline-screen"` üzerinden (D5'in üçüncü renk ölçüm noktası + gerçek
olay satırları) sağlanıyor; butona ihtiyaç yok.

### Port çakışması analizi (ölçülen gerçek değerler)

Okunan dosyalar: `vite.config.ts:5-6`, `playwright.config.ts:6-13`, `playwright.dev.config.ts:6-14`,
`scripts/check-ports.mjs:30-45`, `src/server/index.ts:53-66, 262-272`, `package.json` scripts.

| Kaynak | Port | Not |
|---|---|---|
| `MC_PORT` varsayılanı (API) | **7333** | `resolvePort`, `index.ts:54` |
| `MC_WEB_PORT` varsayılanı (Vite dev sunucusu) | **7334** | `vite.config.ts:6`, `strictPort: true` |
| `playwright.config.ts` `webServer` + `baseURL` | **7333** | `reuseExistingServer: false` |
| `playwright.dev.config.ts` | **7433** (API) / **7434** (web) | dev E2E bilinçli olarak ayrı aralıkta |
| `scripts/check-ports.mjs` (`predev`) | 7333 **ve 7334** dolu mu diye bakar | doluysa `npm run dev` hiç başlamaz |
| **Sözleşmenin AC5 alt sunucusu** | **7334 (sabit)** | §5 "AC5 E2E tasarımı" madde 1 |

Çakışma **iki yönlü ve gerçek**:

1. `npm run dev` çalışırken `npm run e2e` koşulursa Vite 7334'ü tutar → AC5 alt sunucusu
   `listen(7334)` yapamaz → `index.ts:263-265` `EADDRINUSE` → `process.exit(1)` → health-check
   polling 10 sn tavanına dayanır → AC5 E2E **KIRMIZI** (üstelik hata "port dolu" değil,
   "sunucu 10 sn'de hazır olmadı" gibi yanıltıcı bir zaman aşımı olur).
2. Tersi: AC5 bloğu koşarken (alt sunucu 7334'te) `npm run dev` denenirse `predev`
   `check-ports.mjs` "7334 portu zaten kullanımda" deyip `exit(1)` verir.

Not: `npm run dev` sırasında `npm run e2e` zaten 7333'te de çakışıyor (paylaşılan `webServer`,
`reuseExistingServer:false`) — bu devralınan bir durum, F-003'ün kusuru değil; ama F-003
sözleşmesi **projenin belgelenmiş ikinci portunu** kendi test sunucusuna atayarak durumu
kötüleştiriyor ve `7334`'ü iki farklı anlamda (Vite web / F-003 test API'si) kullanır hâle
getiriyor.

**İstenen düzeltme (YENİ-2):** AC5 alt sunucusu, belgelenmiş port kümesinin
(`7333`/`7334`/`7433`/`7434`) **dışında** bir port kullansın (ör. `7335`) ve sözleşme, spawn
öncesi + kill sonrası "port gerçekten boş" kontrolünü (kısa polling, `check-ports.mjs`'in
`isPortFree` deseniyle aynı) açıkça yazsın. `MC_PORT=0` (efemeral) bu projede işe **yaramaz**:
`index.ts:281-287` yalnızca çözülen `port` değişkenini (`0`) basıyor, gerçek dinlenen portu
stdout'a yazmıyor — "boş port seç + stdout ayrıştır" yolu ek üretim kodu ister; sabit ama
çakışmayan port + boşluk kontrolü daha ucuzdur.

### AC5 E2E süreç ağacı — ölçüm (yetim süreç riski)

Sözleşmenin gerekçesi (§5 madde 1): "`npm start` üzerinden spawn edilseydi `child.kill()`
yalnızca `npm.cmd` sarmalayıcısını öldürürdü; doğrudan `tsx` spawn'ı testin öldürdüğü sürecin
**gerçekten** sunucu süreci olmasını garanti eder." **Bu öncül yanlış:** `tsx`'in kendisi de bir
sarmalayıcıdır. Ölçüm (bu makine, depo dışında, kurulu `tsx@4.23.13`):

```
spawn(node, [tsx/dist/cli.mjs, srv.ts])  -> sarmalayıcı pid 8216
tsx bir torun node süreci doğurdu        -> gerçek sunucu pid 6356
   (cli.mjs içinde child_process/spawn/execPath dizgeleri mevcut)
kill öncesi: tasklist 8216 alive, 6356 alive, port dolu
child.kill()  (yalnızca 8216'ya gönderildi)
kill sonrası (2 sn): 8216 yok, 6356 YOK, port boş
```

Sonuç bugün **iyi**: `tsx@4.23.13` ebeveyn ölünce torunu da düşürüyor, yetim kalmıyor (iki
bağımsız koşuda doğrulandı — `tasklist` ve port doluluk kontrolüyle). Ama bu, sözleşmenin iddia
ettiği yapısal garanti değil; `tsx`'in belgelenmemiş ve **sürüme bağlı** bir davranışı
(`package.json` `tsx: "^4"`, sabitlenmemiş). Bu yüzden bloklayıcı saymıyorum; somut azaltım
NOT-2'de. CLAUDE.md'nin "yetim süreç ağaçları" dersi bu projede zaten bir kez gerçekleşti.

### `hub.closeAll()` yeniden tasarımı — üretimde sızıntı var mı?

Kilitlenme **gerçekten** çözülüyor: `server.closeAllConnections()` açık SSE soketlerini yok eder,
bu da `server.close()`'un tamamlanmasını ve `'close'` olayının ateşlenmesini sağlar; mevcut
`stopServer` (`tests/integration/events-api.test.ts:26-29`) böylece askıda kalmaz. Sorun
üretimden test koduna "taşınmış" değil, çünkü üretimde **hiç** kapanış yolu yok:
`src/server/index.ts` içinde `SIGINT`/`SIGTERM` işleyicisi veya `server.close()` çağrısı yok
(grep ✓ VERIFIED); tek `server.on('close')` kaydı `stopRetention()` (`index.ts:269-271`) ve o da
yalnızca testlerin `close()` çağrısıyla tetikleniyor. Süreç dışarıdan öldürüldüğünde soketleri
işletim sistemi geri alır → **üretimde sızıntı yok**. Bağlantı başına sızıntı (abone listesi +
keepalive `setInterval`) `req.on('close')` temizliğiyle kapatılıyor ve §8 mutasyon 6 bunu hem
sunucu (abone sayısı) hem istemci (`sse-client.closed`) tarafından ölçüyor — doğru kurgulanmış.
Kalan tek kusur ölü kod: `closeAll()` üretim yolunda hiç çağrılmıyor, yalnızca kendi birim testi
onu çalıştırıyor (hiçbir üretim davranışını korumayan bir test) — Karpathy §3 "kendi bıraktığın
ölü kodu temizle" ile gerilimde. Bkz. NOT-3.

### YENİ (regresyon) bulgular

| # | Şiddet | Bölüm / satır | Bulgu | İstenen düzeltme |
|---|---|---|---|---|
| YENİ-1 | ÖNEMLİ | §1 madde 5 (satır 60), §2.2 `src/web/App.tsx` / `tests/web/App.test.tsx` / `tests/e2e/shell.spec.ts` satırları, §8 mutasyon 12 | Bulgu 4 düzeltmesi, `tablist`/`tabpanel` bağlamı olmayan tek bir `role="tab"` + `aria-selected="true"` üretiyor (sözleşmede `tablist`/`tabpanel`/`aria-controls` hiç geçmiyor). ARIA'da `tab` rolünün zorunlu ebeveyni `tablist`'tir → geçersiz ARIA (axe `aria-required-parent`), ekran okuyucu duyurusu güvenilmez, ok tuşu/roving tabindex deseni yok. Üstelik butonun tıklaması sözleşmenin kendi ifadesiyle **no-op** — bu, Kanban/Ayarlar'ı buton yapmamak için gerekçe gösterilen F-001 "iş yapmayan buton" yasağının aynısı. Üç ayrı assert (`App.test.tsx`, `shell.spec.ts`, mutasyon 12) bu geçersiz yapıyı kalıcı sözleşme hâline getiriyor. | ARIA sekme deseni F-003'te kurulmasın: Zaman Çizelgesi etiketi `<button role="tab">` yerine görsel olarak vurgulanmış statik bir öğe (`aria-current="page"` yeterli) kalsın; `App.test.tsx` / `shell.spec.ts` assert'leri "üst çubukta hâlâ tıklanabilir öğe yok + panel yüzeyi `data-testid="timeline-screen"` ile var" biçiminde yazılsın; mutasyon 12 "koşulsuz mount" iddiasını tıklamasız doğrulasın. Gerçek `tablist` deseni (ok tuşları, `tabpanel`, `aria-controls`) ilk gerçek sekme geçişiyle (F-005/F-007) gelsin. Kabul edilebilir alternatif: butonu koru ama `role="tablist"` kapsayıcısı + `role="tabpanel"` + `aria-controls`/`id` + klavye desenini sözleşmeye yaz (Karpathy §2 açısından daha pahalı seçenek). |
| YENİ-2 | ÖNEMLİ | §5 "AC5 E2E tasarımı" madde 1 | AC5 alt sunucusunun sabit portu **7334**, projenin `MC_WEB_PORT` varsayılanıyla (Vite dev sunucusu, `vite.config.ts:6`, `strictPort:true`) ve `scripts/check-ports.mjs`'in `predev` kontrolüyle birebir çakışıyor (tablo yukarıda). `npm run dev` açıkken `npm run e2e` → alt sunucu `EADDRINUSE` → `process.exit(1)` → yalnızca yanıltıcı bir 10 sn health-check zaman aşımı; ters yönde `predev` `npm run dev`'i bloklar. Sözleşmenin gerekçesi ("7333 kullanıldığı için 7334 çakışmaz") yalnızca Playwright'ın kendi sunucusunu hesaba katmış, projenin ikinci belgelenmiş portunu atlamış. | Belgelenmiş küme (`7333`/`7334`/`7433`/`7434`) dışında bir port seçilsin (ör. `7335`); sözleşme, spawn öncesi ve kill sonrası "port boş" kontrolünü (kısa polling, `check-ports.mjs`'teki `isPortFree` deseni) ve zaman aşımında portu tutan durumu ayırt eden bir hata mesajını açıkça yazsın. `MC_PORT=0` yolu bu projede işlemez (gerçek port stdout'a basılmıyor, `index.ts:281-287`). |
| YENİ-3 | ÖNEMLİ | §2.2 `playwright.config.ts` satırı · §5 AC1-AC4/AC6 (paylaşılan `webServer`) · `tests/e2e/shell.spec.ts:91-94` | Paylaşılan Playwright `webServer`'ına `MC_DATA_DIR` **verilmiyor** (`playwright.config.ts:9-14`'te env yok) → sunucu `process.cwd()/data`'yı okur (`index.ts:205`). O dizin bu makinede gerçek olaylarla dolu (`data/events/2026-09-04.jsonl`, `2026-09-05.jsonl`) ve F-004'ün kurulu hook'u (`.claude/settings.json` → `.claude/hooks/send-event.cjs`, varsayılan hedef port **7333**) test koşarken canlı olay POST etmeye devam eder — yani E2E sunucusuna test sırasında dışarıdan olay akar. Tur 2'ye kadar bu görünmezdi (kabuk boş bir `<main>` render ediyordu); artık `TimelineScreen` koşulsuz mount olduğu için bu veri `body`ye giriyor ve `shell.spec.ts:92-94`'ün `expect(bodyText).not.toContain('Kapılar'/'Thread'/'Token')` negatif assert'leri ile AC1'in "2 sn içinde yeni satır" ölçümü makineye/zamana bağımlı hâle geliyor. (Bugünkü veride bu üç dizge yok — grep ile kontrol edildi — ama veri sürekli büyüyor ve içeriği rastgele: araç adları, dosya yolları, özetler.) | §2.2'ye `playwright.config.ts` değişikliği olarak `webServer.env = { MC_DATA_DIR: <koşuya özel geçici dizin> }` eklensin (mevcut `tests/helpers/temp-data-dir.ts` deseni), böylece hem `shell.spec.ts` hem `timeline.spec.ts` deterministik boş durumdan başlayıp kendi olaylarını `POST /api/events` ile üretsin; sözleşme "E2E hiçbir koşulda gerçek `data/` dizinini okumaz/yazmaz" cümlesini içersin. |

### NOT'lar (düzeltme şart değil, kod turunda dikkat)

- **NOT-1 — D2 assert'inin gücü:** `expect(ciContent).toContain('e2e:')` bir yorum satırında bile
  geçebilir; asıl kanıt `'npm run e2e'` + `'playwright install'` + "`verify` bloğunda `npm run e2e`
  yok" üçlüsüdür. Mutasyon listesine "yeni `e2e` job'ı silinir → `ci-workflow.test.ts` KIRMIZI"
  eklemek bu turda bedavaydı.
- **NOT-2 — `tsx` sarmalayıcısı:** ölçüme göre bugün yetim süreç kalmıyor, ama garanti `tsx`'in
  sürüme bağlı davranışı. Ucuz azaltım: `child.kill()` sonrası hem `'exit'` olayını hem portun
  boşalmasını bekle; `afterAll`'u `try/finally` içine al; süreç düzeyinde güvenlik ağı bırak
  (`process.on('exit')` → `kill`). Windows'ta gerekirse `taskkill /F /T /PID` — §9 `taskkill`'i
  biliyor ama ağaç öldüren `/T` bayrağı eksik.
- **NOT-3 — `closeAll()` ölü kod:** üretim yolunda hiç çağrılmıyor. Ya silinsin (gerçek soket
  kapatma zaten `closeAllConnections()` ile yapılıyor), ya da onu kullanacak feature (graceful
  shutdown) sözleşmede adlandırılsın.
- **NOT-4 — devralınan sekme borcu:** UX doc satır 19 tıklanamaz sekmeleri, satır 21 Ayarlar'ın
  sekme çubuğunda durmasını dışlıyor. F-003 bunu yaratmıyor ama sözleşme, borcun F-005/F-007'de
  kapanacağını tek cümleyle kayda geçirmeli — aksi hâlde `shell.spec.ts`'in yeni "Kanban/Ayarlar
  hâlâ `<span>`" assert'i borcu kalıcılaştırır.
- **NOT-5 — `shell.spec.ts` test başlığı:** satır 9'daki "tıklanabilir öğe yok" başlığı seçilen
  yola göre güncellenmeli (YENİ-1'in önerdiği yolda başlık olduğu gibi kalabilir).

### Kod turuna başlamak için

Tur 1'in 14 bulgusu kapandı, D1-D7 uygulandı. Kod turuna geçmeden önce yalnızca üç YENİ bulgu
(YENİ-1 ARIA sekme deseni, YENİ-2 port 7334, YENİ-3 E2E veri dizini izolasyonu) sözleşme
metninde kapatılmalı; üçü de paragraf/satır düzeyinde düzeltmedir, yeni bir tasarım turu
gerektirmez. Üçüncü tur yalnızca bu üç maddeye bakacak.

---

## Developer düzeltme yanıtı — tur 3 (2026-09-05)

Kapsam: bu turda yalnızca bu dosya düzenlendi. `src/`, `tests/`, `scripts/`, `.claude/`,
`.github/`, `docs/03-ux.md`, `docs/02-architecture.md`, `docs/features/**`, `package.json`
altında hiçbir değişiklik yok (`git status` bunu doğrular). Hiçbir kod yazılmadı, `npm install`
çalıştırılmadı. CEO kararları D8-D10'a itiraz edilmedi, üçü de uygulandı; QA tur 2'nin KAPANDI
dediği 14 bulgu ve D1-D7 yeniden açılmadı.

### YENİ-1 — ARIA sekme deseni kurulmayacak (CEO kararı D8)

Ne değiştirdim: Zaman Çizelgesi etiketinin `<button role="tab" aria-selected="true">` olma planı
tamamen kaldırıldı; yerine `role`/`onClick` taşımayan, yalnızca `aria-current="page"` işaretli
statik bir öğe (Kanban/Ayarlar'la aynı `<span>` ailesinden, yalnızca görsel vurgusu farklı) geldi.
Gerçek `tablist`/`tab`/`tabpanel`/`aria-controls`/ok tuşu deseni bu turda hiç kurulmuyor.

| Bölüm/satır | Ne değişti |
|---|---|
| §1 madde 5 | `role="tab" aria-selected="true"` ifadesi kaldırıldı; `aria-current="page"` + "gerçek `tablist` deseni kurulmuyor, F-005/F-007'nin işi" cümlesi eklendi. |
| §2.2 `src/web/App.tsx` satırı | Aynı değişiklik; "aynı gerekçeyle (F-001 no-op buton yasağı) Zaman Çizelgesi de `<button>` olmuyor" notu eklendi. |
| §2.2 `tests/web/App.test.tsx` satırı | "üst çubukta gerçek buton yok" iddiası artık **korunuyor** (kaldırılmıyor); eklenen tek iddia `aria-current`/`role="tab"` yokluğu. |
| §2.2 `tests/e2e/shell.spec.ts` satırı | Satır 39-40'taki "tıklanabilir öğe sayısı = 0" iddiası **korunuyor**; eklenen tek assert `aria-current`. NOT-5 gereği test başlığı da değişmeden kalabilir. |
| §2.1 `tests/web/App.interaction.test.tsx` satırı | Tıklama senaryosu tamamen çıkarıldı; yerine "hiçbir etkileşim olmadan koşulsuz mount" + "App-seviyesi re-render'da (bağlantı durumu değişimi) `TimelineScreen` unmount olmaz/filtre state'i korunur" senaryosu yazıldı. |
| §3 madde 12 sonu | D8 eklentisi + **NOT-4** (devralınan sekme borcu, UX satır 19/21, F-005/F-007'nin işi) paragrafı eklendi. |
| §8 mutasyon 12 | Tıklama yerine "immediate-render" ve "App-tetikli re-render'da unmount olmaz" testlerine bağlandı (tetikleyecek tıklanabilir öğe kalmadığı için). |

### YENİ-2 — AC5 alt sunucusunun portu (CEO kararı D9)

Ne değiştirdim: §5 "AC5 E2E tasarımı" madde 1-6. Port **7334 → 7335**. Çakışmadığını dosyaları
okuyarak doğruladım: `vite.config.ts:6` (`MC_WEB_PORT` varsayılanı 7334), `playwright.config.ts:7`
(7333), `playwright.dev.config.ts:7,11` (7433/7434), `scripts/check-ports.mjs:30-31` (7333/7334
kontrolü) — dördü de ✓ VERIFIED okundu, hiçbiri 7335 kullanmıyor; `docs/02-architecture.md:156`
kaçınılması istenen portları da (4000, 3000/5173/8080/4318) listeliyor, 7335 bunlarla da
örtüşmüyor. `MC_PORT=0` yolu reddedildi (gerekçe aynı kaldı: gerçek port stdout'a basılmıyor).
Ayrıca madde 1/4/6'ya spawn öncesi + kill sonrası `isPortFree` polling'i (check-ports.mjs'in
deseniyle aynı, yeni bağımlılık yok) ve zaman aşımı mesajlarının "port doluydu" ile "sunucu
kalkmadı" ayrımını yapması eklendi.

### YENİ-3 — E2E veri dizini izole edilecek (CEO kararı D10)

Ne değiştirdim: §2.2 `playwright.config.ts` satırı. Paylaşılan `webServer`'a (port 7333,
`shell.spec.ts` + `timeline.spec.ts`'in AC5-dışı kısmı) modül üst seviyesinde bir kez
`createTempDataDir()` (mevcut `tests/helpers/temp-data-dir.ts`, değişmiyor) ile üretilen geçici
`MC_DATA_DIR` veriliyor; `process.on('exit', ...)` ile `removeTempDataDir` çağrılıyor. AC5'in
kendi `test.describe` bloğu zaten ayrı bir `MC_DATA_DIR` kullanıyordu (§5 madde 1, değişmedi) —
ikisi birbirine karışmıyor. `tests/e2e/shell.spec.ts` satırına, satır 91-94'ün artık gerçek
`./data`'daki tarihsel olaylarla (bu makinede `data/events/2026-09-0{4,5}.jsonl`) çakışmadığı
notu eklendi.

### NOT-2 — `tsx` yetim süreç savunması

Gerekçeyi düzelttim: "doğrudan `tsx` spawn'ı `npm` sarmalayıcısını atlar" cümlesi kaldırılmadı
(hâlâ doğru, `npm.cmd` katmanı gerçekten atlanıyor) ama "tsx sarmalayıcı değildir" örtük iddiası
düzeltildi — `tsx`'in kendisinin de bir torun `node` süreci doğurduğu ve bugünkü `tsx@4.23.13`
sürümünün ebeveyn öldüğünde torunu düşürdüğü (QA'nın ölçümü), ama bunun sabitlenmemiş (`"tsx":
"^4"`) ve belgelenmemiş bir davranış olduğu §5 madde 1'e yazıldı. Savunma: `exit` olayını bekleme
+ kill/respawn arasında `isPortFree` polling'i + tavan aşılırsa `taskkill /F /T /PID` (§5 madde
1/4/6), hepsi `try/finally` disiplinine bağlandı. §9'un ilgili paragrafı da "yanlış çıkarsa"
koşullu diliden "baştan yazılmış üç katmanlı savunma var"a güncellendi.

### NOT-3 — `closeAll()` ölü kod

**Kararım: `closeAll()`'ı gerçek bir kapanış yoluna bağladım, silmedim.** Gerekçe: bu proje daha
önce (F-002/F-004) yetim süreç sorunları yaşadı (CLAUDE.md "Öğrenilen kurallar"); `npm start`
çalışırken bir geliştiricinin Ctrl+C basması gerçek, sık karşılaşılan bir senaryo ve Windows'ta
konsola bağlı ön-plan sürecine `CTRL_C_EVENT`/`SIGINT` **güvenilir şekilde** iletiliyor (bu, NOT-2/
§5 madde 4'ün bahsettiği "başka bir süreçten programatik `child.kill()`" kısıtından **farklı** bir
durum — Node.js'in kendi dokümantasyonu foreground-konsol Ctrl+C senaryosunu ayrı tutar). Bu
yüzden `closeAll()`'ı `SIGINT`/`SIGTERM`'e bağlamak gerçek bir üretim faydası sağlıyor (açık SSE
soketleri düzgün `res.end()` ile kapanıyor) ve mevcut kodu (hub'ın kendi biriminde zaten test
edilen bir metot) çöpe atmak yerine kullanıyor — Karpathy §3 "ölü kod bırakma" ile daha uyumlu.

Uygulama planı: `src/server/index.ts`'in `main()`'ine (yalnızca `isMainModule` dalı, mevcut
testler `createServer()`'ı doğrudan çağırdığı için etkilenmez), sırası garanti eden küçük bir
`export function shutdown(server, hub, exit = process.exit)` eklenir: `hub.closeAll()` →
`server.close(() => exit(0))`. `process.on('SIGINT'/'SIGTERM', () => shutdown(server, hub))`
kaydı yalnızca gerçek süreç girişinde olur.

Doğrulama: Playwright'ın `webServer`'ı süreci sonlandırırken davranışın bozulmadığını **iki**
şekilde doğruluyorum: (1) `tests/server/graceful-shutdown.test.ts` (§2.1, yeni) `shutdown()`'ı
sahte `server`/`hub`/`exit` ile **doğrudan çağırarak** çağrı sırasını (`closeAll` önce, `exit`
sonra) birim seviyesinde kanıtlar — gerçek sinyal göndermeden. (2) Playwright'ın kendisi zaten
webServer'ı `SIGTERM`'le DEĞİL, doğrudan süreç sonlandırmayla (Windows'ta `child.kill()`/
`taskkill`, NOT-2 ile aynı kısıt) kapatıyor — yani Playwright'ın webServer teardown'ı bu yeni
`SIGINT`/`SIGTERM` handler'ını Windows'ta muhtemelen hiç TETİKLEMEYECEK (aynı platform kısıtı);
bu, mevcut `npm run e2e` akışını bozmaz (zaten bugün de bu handler yok) ama yeni kodun E2E'de
"test edildiği" yanılsamasına da girmiyorum — **gerçek `SIGINT`/`SIGTERM` gönderimi otomatik
testte doğrulanmaz**, yalnızca manuel bir duman testi olarak kalır: kod turunda `npm start`
çalıştırılıp gerçek terminalde Ctrl+C basılarak "sunucu 127.0.0.1:PORT'ta kapatılıyor" tarzı bir
log + temiz `exit 0` gözlemlenir, sonucu `docs/progress.md`'ye yazılır (F-001'in CI E2E'siz kararı
gibi, elle doğrulanıp kayda geçirilen bir kanıt sınıfı).

### Gövde tutarlılığı kontrolü

- Port numaraları: AC5 alt sunucusu artık her yerde **7335** (§5 madde 1/2/3/5, önceki "7334"
  referanslarının hepsi bu bölümde değiştirildi). §5 dışındaki iki tarihi bahis (§7'nin
  "Developer düzeltme yanıtı — tur 2" ve QA tur 2'nin kendi bulgu tablosu) **kasıtlı olarak
  değiştirilmedi** — onlar o turda gözlemlenen gerçek durumun kaydı, geçmişi yeniden yazmıyorum.
- `closeAll()`: §3 madde 2 başlığı ve gövdesi ile §2.2 `src/server/index.ts` satırı artık aynı
  şeyi söylüyor (test teardown'ında `closeAllConnections()` + üretimde `SIGINT`/`SIGTERM`'de
  `shutdown()`) — iki yerde farklı bir iddia kalmadı.
- ARIA: §1 madde 5, §2.2 (App.tsx/App.test.tsx/shell.spec.ts), §3 madde 12, §8 mutasyon 12 hepsi
  "statik + `aria-current`, `role`/`onClick` yok" iddiasında hizalı.
- `MC_DATA_DIR`: paylaşılan sunucu (§2.2 `playwright.config.ts`) ve AC5'in izole alt sunucusu
  (§5 madde 1) artık **iki ayrı** temp dizin kullandığı açıkça yazılı; birbirine karıştırılmadı.

### Kalan riskler (bu tur için)

- `shutdown()`'ın gerçek `SIGINT`/`SIGTERM` yolu yalnızca manuel duman testiyle doğrulanabiliyor
  (Windows kısıtı) — kod turunda bu adım atlanırsa NOT-3'ün üretim faydası kanıtlanmamış kalır.
- AC5'in 7335 üzerindeki `isPortFree` savunması, `check-ports.mjs`'in deseninin test dosyasına
  yerel bir kopyası olacak (küçük kod tekrarı, kabul edilebilir — iki farklı çalışma zamanı
  bağlamı, `scripts/check-ports.mjs` `.mjs`/TS-import edemiyor, aynı gerekçe zaten dosyanın kendi
  yorumunda var).

Kod turuna geçmeden önce kapatılması istenen madde kalmadı; dördüncü bir QA turu yalnızca bu
üç YENİ + üç NOT maddesinin uygulanışını (kod, bu kez) doğrulayacak.

---

## CEO onayı — sözleşme KAPANDI (2026-09-05)

QA tur 2, tur 1'in 14 bulgusunun tamamını KAPANDI ve D1-D7'nin yedisini de uygulanmış saydı;
açık kalan üç madde düzeltmenin kendi ürettiği regresyonlardı. Tur 3'te kapatıldılar.
Dördüncü bir tam QA turu açmak yerine CEO doğruladı — üçü de dar ve doğrudan denetlenebilirdi:

- **YENİ-1 (a11y):** `role="tab"`/`aria-selected` tümüyle çıkarılmış; Zaman Çizelgesi de `<button>`
  olmuyor (tıklaması no-op olurdu). Sonuç zarif: `shell.spec.ts:39-40`'ın "üst çubukta tıklanabilir
  öğe yok" assert'i **değişmeden doğru kalıyor** ve geçersiz ARIA riskine hiç girilmiyor.
  Gerçek `tablist` deseni ikinci ekranla (F-005/F-007) gelecek — bugün olmayan bir şey için desen
  kurmuyoruz (Karpathy §2).
- **YENİ-2 (port):** 7335'e alınmış; 7333/7334/7433/7434 ile çakışmadığı dört dosya okunarak
  doğrulanmış. Spawn öncesi ve kill sonrası `isPortFree` polling'i eklenmiş.
- **YENİ-3 (veri izolasyonu):** paylaşılan `webServer`'a geçici `MC_DATA_DIR` veriliyor; AC5 kendi
  ayrı dizinini koruyor. Bu, panelin kendini izlemeye başlamasının yan etkisiydi — F-004'ün kurulu
  hook'u testler koşarken canlı olay üretiyor ve gerçek `./data`'yı okuyan E2E'yi zamana bağımlı
  hâle getiriyordu.
- **NOT-3 (`closeAll` ölü kod):** silinmek yerine gerçek bir kapanış yoluna bağlanmış.
  `shutdown()` `hub.closeAll()`'ı `server.close()`'dan **önce** çağırıyor — ters sıra açık SSE
  soketleri yüzünden kapanışı süresiz bekletirdi; sıra birim testiyle çitlenmiş. Sinyal
  işleyicileri yalnızca `isMainModule` dalında kaydediliyor, dolayısıyla `createServer()`'ı
  doğrudan çağıran testler etkilenmiyor.

**KARAR: ONAY.** Kod turu başlayabilir.

Bağlayıcı olanlar, çelişkide bu sırayla: bu bölüm → CEO kararları **D1-D10** → sözleşme gövdesi
(§1-§9) → `## QA doğrulama — tur 2`'nin NOT'ları → feature notundaki 6 AC.

**Sözleşme aşaması bilançosu:** 3 developer + 2 QA turu, 14 bulgu + 3 regresyon, **tek satır kod
yazılmadan** kapandı. En pahalı üç yakalama:
1. `hello` çerçevesinin `id:` taşıması — tarayıcının `Last-Event-ID`'si telafi çerçeveleri gelmeden
   ring'in sonuna sıçrıyordu; arada kopma olsa o aralık **kalıcı kaybolurdu**, üstelik panel
   "bağlandım" derken.
2. `hub.closeAll()`'ın `server.on('close')`'a bağlanması — açık SSE soketiyle o olay hiç ateşlenmez;
   test teardown'ı süresiz asılırdı. Sözleşme tuzağı bir bölümde doğru tarif edip başka bölümde
   tam ona düşmüştü.
3. AC6'nın "duraklatılmışken liste kaymaz" iddiasının jsdom'da ölçülmesi — jsdom layout yapmaz,
   `scrollTop` hep 0; uygulama gerçekten zıplasa bile test yeşil kalırdı.

---

## CEO düzeltmesi — ilk yükleme URL'i (2026-09-05, kod turu sırasında bulundu)

**Sözleşme hatalı:** §3/§4'te üç yerde (satır ~347, ~517, ~532) ilk yükleme ve `resync` için
`GET /api/events?since_seq=-1&limit=200` yazıyor. Bu çağrı gerçek sunucudan **400 `invalid_body`**
alır ve zaman çizelgesi **hiç yüklenmez**.

**Kanıt:** `src/features/events/server/query.ts:9-14` —
```
export function parseSinceSeq(raw: string | null): number | 'invalid' {
  if (raw === null) return -1
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return 'invalid'
  return n
}
```
`-1` yalnızca **parametre yokken** kullanılan iç varsayılandır; telde açıkça gönderilince
`n < 0` dalına düşer ve `'invalid'` olur (`query.ts:42-47` 400 döndürür).

**Karar:** İlk yükleme ve `resync` sonrası tam yeniden yükleme **`since_seq` parametresini hiç
göndermez**: `GET /api/events?limit=200`. Sunucu parametre yokken zaten tüm ring'i kapsıyor —
istenen davranış bu. `since_seq=0` **kullanma**: o "seq 0'dan sonrası" demektir ve ilk olayı atlar.

**Bu hata neden 3 developer + 2 QA turundan sağ çıktı:** iki taraf da `-1`'i "iç varsayılan"
olarak doğru okudu ama "tel değeri" olarak yazdı. Birim testi `fetch`'i mock'ladığı için gerçek
sunucuya hiç sormadı; gerçek çağrıyı yapan tek test katmanı (E2E) ise henüz koşmamıştı.
Ders: **mock'lanmış bir istemci testi, sunucunun o URL'i kabul ettiğini kanıtlamaz.**

**Zorunlu ek çit:** ilk yükleme URL'inin gerçek sunucu tarafından kabul edildiğini kanıtlayan bir
**entegrasyon** testi yaz (mock yok, gerçek `createServer` + gerçek istek → 200 bekle).
Mutasyon: URL'e `since_seq=-1` geri koy → bu test **KIRMIZI** vermeli.

---

## Mutasyon kanıtı (kod turu, 2026-09-05)

Üçüncü developer turu, §8'deki 14 mutasyonun tamamını kod turunda gerçekten uyguladı,
KIRMIZI'yı gözlemledi, birebir geri aldı. Her mutasyondan sonra ilgili test dosyası izole
çalıştırıldı; tablo altındaki komut `npm run verify`/`npm run e2e`/`npm run e2e:dev` = 0 ve
`git diff HEAD` boş ile kapatıldı (bkz. `docs/progress.md` F-003 girişi).

| # | Mutasyon | Uygulandığı dosya | KIRMIZI veren test | Hata mesajının ilk satırı |
|---|---|---|---|---|
| 1 | N-1 düzeltmesi geri alındı: `ring.push` yazma denemesinden ÖNCEye taşındı | `src/server/store/jsonl-store.ts` | `tests/server/store/jsonl-store.test.ts` (7 test) | `expected store.read(-1, 10).events to have a length of 0 but got 1` |
| 2 | `computeResyncDecision`'da `lastEventId < ringBounds.from → resync` dalı silindi | `src/server/sse/stream.ts` | `tests/server/sse/stream.test.ts` + `tests/integration/sse-stream.test.ts` (3 test) | `expected { type: 'replay' } to deeply equal { type: 'resync' }` |
| 3 | `useEventStream`'in seq bazlı de-dup'ı kaldırıldı (Map anahtarı `seq` yerine benzersiz sayaç yapıldı — düz `if (!byId.has(...))` kaldırmak Map semantiği yüzünden yetersizdi, kanıtlanabilir gerçek bir kırılma için anahtarlama değiştirildi) | `src/web/lib/useEventStream.ts` | `tests/web/lib/useEventStream.test.ts` | `expected [ {...}, …(1) ] to have a length of 1 but got 2` |
| 4 | `frozen` anlık görüntüsü (`visibleSnapshot`) bypass edildi, `events` her zaman `liveEvents` oldu | `src/web/lib/useEventStream.ts` | `tests/web/lib/useEventStream.test.ts` | `expected [ {...}, …(1) ] to have a length of 1 but got 2` |
| 5 | İstemci tarafı filtre koşulları (proje/agent/tip) kaldırıldı, tüm satırlar her zaman render edildi | `src/features/events/web/TimelineScreen.tsx` | `tests/features/events/web/TimelineScreen.test.tsx` (2 test) | `expected [ <div…>, …(2) ] to have a length of 1 but got 2` |
| 6 | `stream.ts`'te `req.on('close')` temizliği (unsubscribe + `clearInterval`) kaldırıldı | `src/server/sse/stream.ts` | `tests/integration/sse-stream.test.ts` | `expected 1 to be +0` (abone sayısı düşmedi) |
| 7 | `hello` çerçevesine `id: ringBounds.to` tekrar eklendi | `src/server/sse/stream.ts` | `tests/integration/sse-stream.test.ts` (**yeni eklenen** dolu-ring vakası, aşağıya bakınız) | `expected '0' to be undefined` |
| 8 | `computeResyncDecision`'dan `lastEventId > ringBounds.to → resync` dalı silindi | `src/server/sse/stream.ts` | `tests/server/sse/stream.test.ts` | `expected { type: 'replay' } to deeply equal { type: 'resync' }` |
| 9 | `parseLastEventId` sıkı `/^[0-9]+$/` kuralı eski gevşek `Number(raw)` semantiğine döndürüldü | `src/server/sse/stream.ts` | `tests/server/sse/stream.test.ts` (10 test) | `expected false to be true` (`Number.isNaN(parsed)` artık `false`) |
| 10 | `ingest.ts`'in 503 dalına da `hub.broadcast(...)` çağrısı eklendi | `src/features/events/server/ingest.ts` | `tests/integration/sse-stream.test.ts` (N-1 negatif test) | `expected [ { event: 'event', …(2) } ] to have a length of +0 but got 1` |
| 11 | `ring.push` başarı dalından **hata** dalına taşındı (başarılı yazımda ring hiç güncellenmiyor) | `src/server/store/jsonl-store.ts` | `tests/server/store/jsonl-store.test.ts` (8 test) + `tests/integration/events-api.test.ts` (**yeni eklenen** race testi, aşağıya bakınız) | `expected null to deeply equal { from: 2, to: 4 }` / `expected [] to deeply equal [ 0 ]` |
| 12 | `App.tsx`'e yeniden bir "aktif sekme" `useState(false)`'i eklenip `TimelineScreen`'in mount'u buna bağlandı | `src/web/App.tsx` | `tests/web/App.interaction.test.tsx` (2 test) | `Unable to find an element by: [data-testid="timeline-screen"]` |
| 13 | `ScreenErrorBoundary` kaldırılıp `TimelineScreen` doğrudan mount edildi | `src/web/App.tsx` | `tests/web/App.interaction.test.tsx` (**davranışsal olarak yeniden yazılan** üçüncü test, aşağıya bakınız) | `Error: boom (mutasyon 13 testi)` (yakalanmadan fırladı) |
| 14 | `useEventStream`'de `error`/`readyState` ayrımı kaldırılıp her hata `disconnected`'a eşlendi | `src/web/lib/useEventStream.ts` | `tests/web/lib/useEventStream.test.ts` | `expected 'disconnected' to be 'reconnecting'` |

**Yeşil kalan / test düzeltmesi gerektiren üç durum (mutasyon değil, test düzeltildi):**

1. **Mutasyon 7** — orijinal "hello çerçevesi id: taşımaz" testi bağlantıyı ring tamamen BOŞKEN
   açıyordu (`ringBounds?.to === undefined`), bu yüzden `id: ringBounds?.to` eklense bile `id`
   yine `undefined` kalıyor ve test YEŞİL kalıyordu — mutasyon gerçek bir regresyon olduğu hâlde
   yakalanmıyordu. Düzeltme: `tests/integration/sse-stream.test.ts`'e önce bir olay POST edip
   ring'i doldurarak bağlanan yeni bir test eklendi (ring dolu, `ringBounds.to = 0`) — bu kez
   mutasyon gerçekten `KIRMIZI` verdi. Ürün kodu değişmedi.
2. **Mutasyon 11** — sözleşme §2.1 dosya listesi `tests/integration/events-api.test.ts`'e "POST
   202 sonrası hemen GET" yarış testi eklemeyi taahhüt ediyordu ama bu test önceki turlarda hiç
   yazılmamıştı (yalnızca dosya-yükleme sonrası eski/N-1 testleri vardı). Eksik test eklendi;
   mutasyonla birlikte hem bu yeni test hem de zaten var olan `getRingBounds` testleri KIRMIZI
   verdi. Ürün kodu değişmedi.
3. **Mutasyon 13** — orijinal test `App.tsx`'in kaynak metnini okuyup `'ScreenErrorBoundary'`
   ve `'TimelineScreen'` dizgelerinin geçtiğini kontrol ediyordu; sınırı JSX'ten kaldırıp yalnızca
   artık kullanılmayan `import` satırını bıraktığımda test **YEŞİL kaldı** (import satırı dize
   aramasını hâlâ karşılıyordu) — davranışı değil, kaynak metnini ölçüyordu. Düzeltme:
   `tests/web/App.interaction.test.tsx`'teki üçüncü test `vi.doMock` ile `TimelineScreen`'i
   fırlatacak şekilde mock'layıp gerçek `App`'i dinamik `import()` ile yükleyen davranışsal bir
   teste dönüştürüldü; mutasyonla birlikte hata yakalanmadan fırladı (KIRMIZI), düzeltmeyle
   birlikte "Bu ekran yüklenemedi." göründü (YEŞİL). Ürün kodu değişmedi.

**Doğrulama:** her mutasyon uygulandıktan hemen sonra geri alındı; iş sonunda `git diff HEAD`
boştu (yalnızca yukarıdaki iki test dosyasındaki kalıcı iyileştirmeler commit edildi, ürün kodunda
hiçbir kalıcı değişiklik yok). Tüm 14 mutasyon sonrası `npm run verify` = 0 (26 dosya / 314 test,
+2 yeni test), `npm run e2e` = 0 (7/7), `npm run e2e:dev` = 0 (1/1).
