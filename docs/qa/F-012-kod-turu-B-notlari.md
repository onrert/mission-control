---
feature: F-012
title: Kod turu B (istemci tarafı) — sohbet sekmesi, mutasyon kanıtı, dar genişlik ölçümü
author: developer
date: 2026-09-06
---

# F-012 kod turu B — istemci tarafı kablo işi + kanıtlar

Kod turu A (`docs/qa/F-012-kod-turu-A-notlari.md`) sunucu tarafını (K3 canlı test kanıtı) kapattı.
Bu tur sözleşmenin genişletilmiş dosya sahipliği listesine (`docs/qa/F-012-contract.md` §2.4
"Ö11") giren **istemci** tarafını kapatıyor: `src/features/chat/web/**` (`ChatScreen.tsx`,
`useChatSession.ts`, `icons.tsx`), `src/web/App.tsx` (D5 — üçüncü "Sohbet" sekmesi),
`src/web/lib/useEventStream.ts` (altı yeni `chat_*` kanalı + `onChatSync`), ve `vite.config.ts`
(`MC_CHAT_ENABLED` derleme-zamanı `define`'ı).

## 1. Test sonucu

- `npm run verify` (typecheck + lint + **837 test / 55 dosya** + build) = **0**.
- `npm run e2e` (prod, `npm run build && npm start` webServer'ı) = **0** (23/23 geçti).
- `npm run e2e:dev` — bkz. **§4 (bloklayıcı olmayan ama önemli bulgu)**, bu turun ürün kodunu
  DEĞİL, yerel geliştirme akışının kendisini etkiliyor.

## 2. Mutasyon kanıtı (uygula → KIRMIZI gözle → Edit ile birebir geri al)

Round A'nın 17 maddelik listesi (`F-012-contract.md` §11.2) sunucu tarafını kapsıyordu. Bu turda
**istemci tarafının** üç kritik noktası ayrıca mutasyonla doğrulandı (round A'nın listesinde
maddeler olarak yoktu çünkü o listenin yazıldığı anda istemci kodu henüz yoktu):

1. **S2 çiti — ham araç çıktısı akışa basılmaz** (`docs/03-ux.md` §7 CEO notu S2). İki katmanlı
   savunma birlikte mutasyona uğratıldı: (a) `useChatSession.ts`'in `onChatToolEvent`
   handler'ında `nextRow`'a `...payload` yayılarak şemanın dışındaki alanların (`tool_result`)
   geçmesine izin verildi, (b) `ChatScreen.tsx`'in `toolStatusText`'i o alanı okuyup ekrana
   basacak şekilde değiştirildi. `tests/features/chat/web/ChatScreen.test.tsx`'in ilgili S2
   testi **KIRMIZI** verdi: `expected <span></span> to be null` → gerçek render
   `"Bash tamamlandı (1 sn) — gizli komut [CIZLI-VERI-SIZMAMALI]"` içeriyordu. Her iki değişiklik
   Edit ile birebir geri alındı, `git diff` bu turun sonunda temiz (`tests/features/chat/web/
   ChatScreen.test.tsx` DIŞINDA hiçbir iz yok).
2. **AC10 çiti — `MC_CHAT_ENABLED` build-time bayrağı sekmeyi gerçekten gizler.**
   `src/web/App.tsx`'teki `isChatUiEnabled()` her zaman `true` dönecek şekilde mutasyona
   uğratıldı. `tests/web/App.test.tsx`'in AC10 describe bloğundaki 2 test **KIRMIZI** verdi
   (`expected 3 to have a length of 2` — "Sohbet" sekmesi `MC_CHAT_ENABLED=0`/geçersiz değerde de
   DOM'a giriyordu). Geri alındı, tekrar yeşil.
3. **B1/D7 çiti — `onChatSync` (native `EventSource` `'open'` olayı) yeniden bağlanmada geçmiş/
   durumu tazeler.** Bu davranış kabloluydu (`App.tsx` → `useEventStream` → `useChatSession`) ama
   HİÇBİR testte doğrudan tetiklenmiyordu (`grep -rl onChatSync tests/` boş döndü) — sessiz bir
   test boşluğuydu. Bu turda `tests/features/chat/web/ChatScreen.test.tsx`'e yeni bir test
   eklendi (`handlers.onChatSync()` çağrılınca `/api/chat/history`+`/api/chat/status` GET
   sayısının arttığını ölçüyor). Sonra `useChatSession.ts`'teki `onChatSync`'in gövdesi boşaltıldı
   → test **KIRMIZI** verdi (`expected 2 to be greater than 2`). Geri alındı, tekrar yeşil. Bu
   test artık kalıcı (commit `8af9d85`), round A'nın listesine eklenen 18. madde olarak
   düşünülebilir.

Round A'nın kendi 17 maddesi bu turda **yeniden koşulmadı** (sunucu kodu bu turda değişmedi,
`git diff` sunucu dosyalarında sıfır — yalnızca istemci dosyaları ve `vite.config.ts` değişti).

## 3. Dar genişlik ölçümü — KIRPILMIŞ GÖRÜNÜR genişlik yöntemiyle (`toBeVisible()` DEĞİL)

`CLAUDE.md`'nin kayıtlı dersi: F-007'de 375px'te iki sekmenin görünür genişliği 0 pikseldi ama
`toBeVisible()` yine de `true` dönüyordu (kaydırma kabındaki öğe için her zaman görünür sayılıyor).
Bu turda **aynı ölçüm tekniği** (`tests/e2e/kanban.spec.ts`'in `clippedVisibleWidth()` — DOM
`getBoundingClientRect()` + her `overflow-x` ata kapsayıcıyla kesişim) geçici bir betikle (kalıcı
test dosyası DEĞİL — `tests/e2e/**` bu feature'ın dosya sahipliğinde değil, bkz. §2.4 not) 320/375/
480px genişliklerde `#tab-timeline`/`#tab-kanban`/`#tab-chat` için çalıştırıldı:

| Genişlik | `tab-timeline` | `tab-kanban` | `tab-chat` | Ayarlar sağ kenarı |
|---|---|---|---|---|
| 320px | 126px | 50.4px | **50.4px** | 304px (< 320 ✓) |
| 375px | 126px | 50.4px | **50.4px** | 359px (< 375 ✓) |
| 480px | 126px | 50.4px | **50.4px** | 464px (< 480 ✓) |

Üç sekmenin de kırpılmış görünür genişliği her üç viewport'ta **> 0** (F-007'nin kırılma deseni
tekrarlanmıyor); Ayarlar dişlisinin sağ kenarı her seferinde viewport genişliğinin içinde kalıyor
(yatay taşma yok). Ekran görüntüleriyle de gözle doğrulandı: `docs/qa/screens/
F-012-B-chat-320px.png`, `F-012-B-chat-375px.png`, `F-012-B-chat-480px.png` — sohbet ekranının
kendisi (mesaj balonları, izin kartı, giriş kutusu) hiçbir genişlikte kırpılmıyor, "İzin isteği"
kartı ve "Onayla"/"Reddet" butonları 320px'te bile tam görünür ve tıklanabilir konumda.

Ölçüm, `npm run build && npx tsx src/server/index.ts` (production sunucusu, `tsx watch` YOK,
`concurrently` YOK — bkz. §4) üzerinde, ayrı bir Playwright script'iyle yapıldı; script kalıcı
değil, bu notta sonucu kayıtlı.

## 4. Bloklayıcı OLMAYAN ama önemli bulgu — `npm run dev` (`concurrently` + `tsx watch`) bu ortamda
donuyor, ürün kodu etkilenmiyor

**Belirti:** `npm run e2e:dev` (`playwright.dev.config.ts`, `npm run dev` webServer'ı) 3 kez art
arda **aynı şekilde** KIRMIZI verdi: `/api/health` proxy'si üzerinden `500` (gerçekte
`ECONNREFUSED` — arka uç hiç ayağa kalkmıyor). Bu, F-004'ün dokümante ettiği "vitest worker fork
kararsızlığı" (rastgele, tekrar denemede düzelen) türünden **DEĞİL** — 5 farklı izole tekrar
DENEYİMİNDE de birebir aynı, kalıcı sonuç verdi.

**Kök neden izole edildi (bisect):**
1. `npx tsx watch src/server/index.ts` **tek başına** (concurrently'siz) → çalışıyor (~0.5-2sn'de
   `/api/health` 200).
2. Aynı komut + `npx vite` **iki ayrı arka plan işi olarak** (concurrently'siz, düz `&`) →
   ikisi de çalışıyor (~2sn'de ikisi de 200).
3. **`npx concurrently "npm:dev:server" "npm:dev:web"`** (`npm run dev`'in birebir kendisi) →
   arka uç **hiçbir zaman** `7433`'e bağlanmıyor (**90+ saniye** beklendi, `curl` hep
   `000`/bağlantı reddi). Süreç ölçüldü: bellek sabit (~215MB, büyümüyor), CPU **%0** — donmuş,
   yavaş değil.
4. `concurrently` sadece `"npm:dev:server"` **TEK BAŞINA** (vite hiç yok) → **yine donuyor** —
   demek ki vite ile kaynak çekişmesi değil, doğrudan `concurrently`'nin kendi çocuk süreç
   sarmalama şekli.
5. Aynı donma **`concurrently` olmadan, sadece bir `cmd.exe /d /s /c "..."` katmanıyla** da
   üretildi — yani ekstra bir shell/konsol katmanı yeterli.
6. **Trivial bir `http.createServer` script'i** aynı `concurrently`/`cmd.exe` sarmalamasıyla
   **çalışıyor** (donmuyor) — nesting/shell-katmanı tek başına yeterli sebep değil.
7. **`import { query } from '@anthropic-ai/claude-agent-sdk'` TEK BAŞINA** (hiçbir uygulama kodu
   olmadan, boş bir script'in ilk satırı) aynı `concurrently`/`cmd.exe` sarmalamasıyla **donuyor**
   — import satırından sonraki hiçbir `console.log` bile basılmıyor (ESM `import` hoisting'i
   nedeniyle import satırından ÖNCE yazılan bir `console.log` bile onun TAMAMLANMASINI bekliyor).
   Standalone (sarmalamasız) aynı import **2.2 saniyede** tamamlanıyor.

**Sonuç:** `@anthropic-ai/claude-agent-sdk`'nin import-zamanı davranışı (muhtemelen konsol/TTY
tespiti veya bir alt süreç/soket kurulumu — kaynağı minified `sdk.mjs` içinde kesin olarak teşhis
edilemedi, bu turun bütçesi bunu aşıyordu) bu makinede **ekstra bir shell/konsol katmanı**
(`concurrently`'nin Windows'ta her komutu `cmd.exe /d /s /c` ile sarması) altında donuyor.
`npm start` (`tsx` — **watch modu yok**, `concurrently` yok) ve `npm run e2e` (aynı `npm start`
yolu) sorunsuz çalışıyor — yani **üretim kod yolu etkilenmiyor**, yalnızca `npm run dev`'in
`concurrently`+`tsx watch` orkestrasyonu etkileniyor.

**Bu bir F-012 ürün hatası DEĞİL** (SDK importu doğru, zorunlu, ve `MC_CHAT_ENABLED` durumundan
bağımsız çünkü `src/server/index.ts`'in üst seviyesinde — bu tasarım gereği, sözleşme buna zaten
izin veriyor). Ama **F-012'nin eklediği bağımlılık bu ortamda `npm run dev`'i kullanılamaz hâle
getiriyor** ve bu, `tests/e2e/dev-shell.spec.ts`'in (F-012'nin dosya sahipliği DIŞINDA,
`F-012-contract.md` §2.4 Ö11 listesinde YOK) 3/3 tekrarda kırmızı vermesiyle sonuçlanıyor.

**Bu turda dokunulmadı çünkü:**
- `tests/e2e/dev-shell.spec.ts` feature notunun ve sözleşmenin dosya sahipliği listesinde yok.
- Kök neden `node_modules/@anthropic-ai/claude-agent-sdk` içinde (üçüncü taraf, minified,
  değiştirilemez) ve/veya bu spesifik Windows/Git-Bash/`concurrently` etkileşiminde — düzeltme
  (ör. `dev:server`'ı `concurrently` yerine başka bir orkestrasyon aracıyla değiştirmek,
  `tsx watch` yerine düz `tsx` + harici bir dosya izleyici kullanmak) `package.json`'ın `dev`
  script'ini değiştirmeyi gerektirir — bu, "gereksiz soyutlama ekleme"/"cerrahi değişiklik"
  sınırının ötesinde bir mimari karar, CEO/architect onayı gerektirir.
- Gerçek kullanıcı ortamında (bu sandbox'ın Git-Bash/nested-shell özgü olmayan, normal bir
  PowerShell/CMD penceresi) aynı donmanın oluşup oluşmayacağı bu ortamdan **doğrulanamıyor** —
  `concurrently`'nin `cmd.exe` sarmalaması platforma özgü ve dış kabuktan bağımsız çalışıyor
  olsa da, bu iddia kod okunarak değil yalnızca bu sandbox'ta gözlemle kuruldu.

**QA'ya devredilen açık madde:** `npm run dev` gerçek bir Windows Terminal/PowerShell'de (bu
sandbox DIŞINDA) elle denenmeli. Eğer orada da donarsa, bu bir **P1 mimari karar** gerektirir
(`dev` script'inin `concurrently`'siz yeniden tasarımı — ör. `tsx watch` + Vite'ı ayrı iki
terminal sekmesinde çalıştırma talimatı, ya da `concurrently` yerine `npm-run-all`/özel bir
Node orkestratörü). Eğer orada donmuyorsa, bu not yalnızca "bu geliştirme sandbox'ının bilinen
sınırlaması" olarak kapatılabilir (CLAUDE.md'ye kısa bir dipnot düşülebilir).

## 5. Süreç/port temizliği

Tur boyunca `concurrently`/`cmd.exe`/`tsx watch` kombinasyonunu izole etmek için çok sayıda geçici
süreç başlatıldı (bazıları `taskkill` ile kapatıldı, bazı orphan `conhost.exe`/`cmd.exe` birikmesi
gözlemlenip temizlendi — bu, `CLAUDE.md`'nin "yetim süreç" dersine yeni bir örnek: `cmd.exe /d /s
/c` ile başlatılan her alt süreç kendi `conhost.exe`'sini bırakabiliyor, `taskkill //F //IM
node.exe` bunları YAKALAMAZ). Tur sonunda:
- `tasklist | grep node.exe` → **boş**.
- `netstat` üzerinde 7333/7334/7433/7434'te dinleyen **hiçbir** süreç yok (yalnızca ilgisiz
  `SteelSeriesPrism`/`SteelSeriesSonar` başka portlarda dinliyor, bu makinenin kendi donanım
  yazılımı, bizim sürecimiz değil).
- Geçici script dosyaları (`_scratch_*.ts`, `_scratch_measure.mjs`) silindi, `git status` bunları
  göstermiyor.

## 6. Sözleşmeden sapma

Yok. `vite.config.ts`'in `define` bloğu ve `App.tsx`'in D5/Ö1/N5 satırı sözleşme §2.4'ün birebir
tarif ettiği şekilde yazıldı. Tek ek: §2'deki 18. mutasyon maddesi (onChatSync) sözleşme metninde
YOKTU (round A'nın 17 maddesi yazıldığında istemci kodu henüz yoktu) — bu, sözleşmeyi ihlal etmek
değil, sözleşmenin kendi "kaynaktan türetilmiş yeni bulgu" ruhuna uygun bir **ekleme**.

## 7. Sonraki adım

- qa-evaluator bu turu (round B: istemci tarafı + round A: sunucu tarafı, birlikte) değerlendirsin.
  Feature notu `status: qa`.
- §4'teki `npm run dev` bulgusu gerçek bir terminalde doğrulanmalı; sonucuna göre ya kapatılır ya
  da P1 mimari karara yükseltilir.
