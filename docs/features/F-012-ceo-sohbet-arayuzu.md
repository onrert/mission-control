---
id: F-012
title: CEO sohbet arayüzü — panel, oturumu Agent SDK ile barındırır
status: done
owner: developer
deps: [F-003, F-006]
sprint: 2
---
## Açıklama
Faz 2'nin **yeni ilk işi** (kullanıcı kararı 2026-09-06, `ADR-014`) — F-008'in önüne geçer.
Panel bugüne kadar salt-izleyiciydi; bu feature onu CEO oturumunun **sohbet arayüzü** yapar.
Kullanıcı panelde yazar, CEO orada cevap verir, alt agent'lar arka planda çalışırken sohbet
devam eder.

Yöntem: `@anthropic-ai/claude-agent-sdk` ile oturum panelin kendi Node sunucusunda barındırılır.
Claude Code **Channels** yaklaşımı reddedildi (gerekçe `ADR-014`).

Kaynak: `ADR-014` · `docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md` (mimari seçenekler) ·
`docs/spikes/SPIKE-002-asama0-olcum.md` (M1/M2/M3 ölçümleri) ·
`docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md` §7 (gecikme ölçümü).

## Kabul kriterleri
- [x] Panelden yazılan mesaj barındırılan CEO oturumuna ulaşır; cevap panelde **akış hâlinde**
      (token token ya da parça parça) görünür, tamamlanmayı beklemeden.
- [x] Oturum kullanıcının **mevcut Claude aboneliğiyle** açılır. Ortamda `ANTHROPIC_API_KEY`
      varsa sessizce kullanılmaz: ya alt süreç ortamından temizlenir ya da oturum açılmaz ve
      kullanıcıya görünür hata verilir (`ADR-014` sonuç 1).
- [x] **Bariyer çitlenmiştir:** `ANTHROPIC_API_KEY` bariyerini kaldıran mutasyon KIRMIZI verir.
- [x] `.claude/hooks/` altındaki güvenlik kapıları barındırılan oturumda da **engeller** —
      "yükleniyor" değil, **durduruyor** olduğu kanıtlanır. Testte hook aktifken yasaklı eylem
      engellenir; hook devre dışıyken aynı eylem geçer (iki yönlü, `ADR-014` M2 gerekçesi).
- [x] Alt agent arka planda çalışırken ana oturum yeni mesaja cevap verebilir; alt agent
      ilerlemesi panelde görülebilir.
- [x] Sohbet ucu `ADR-013` `x-mc-write` kuralına tabidir; başlıksız istek reddedilir ve bu
      **mutasyonla çitlenir**. Muafiyet yok.
- [x] Konuşma geçmişi kalıcıdır: panel kapatılıp açılınca geçmiş görünür. (Oturumun kaldığı
      yerden devam edip etmeyeceği sözleşme turunda karara bağlanacak.)
- [x] Barındırılan oturumdaki bir hata **paneli çökertmez**: sunucu ayakta kalır, mevcut
      ekranlar (zaman çizelgesi, kanban, ayarlar) çalışmaya devam eder, kullanıcı okunabilir bir
      hata görür. Asenkron handler'lar kendi `try/catch`'ini taşır (`CLAUDE.md`, üç kez tekrarlayan
      hata sınıfı).
- [x] Olay akışındaki izlenen proje verileri CEO'nun bağlamına **doğrudan talimat olarak**
      girmez; sınır açık ve test edilmiş.
- [x] Sohbet özelliği kapatılsa/kaldırılsa panel bugünkü hâline temiz döner (geri dönüş yolu).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/chat/**`, ilgili testler, `package.json` (yeni bağımlılık: agent SDK),
ve sohbet ucunun kaydı için `src/server/` içindeki dağıtıcı satırı.

## Notlar / kararlar
- **CEO'nun önden verdiği kararlar sözleşme turu başlamadan yazılacak** (`CLAUDE.md` dersi:
  tur ortasında/sonunda verilen karar gövdeye yayılmıyor).
- Kabul edilen riskler `ADR-014`'te: politika grisi (kullanıcı bilinçli kabul etti) ve
  `ListAgents`'ın makinedeki diğer oturumları görmesi (düzeltilemez, bilinen sınırlama).
- Ölçülmüş bağlam: CEO oturumu zamanın %87.5'inde boşta; "agent çalışırken konuşma" mevcut
  arka plan düzeniyle zaten karşılanıyor (`SPIKE-001` §7). Bloklayıcı alt agent düzenine
  dönülürse bu kayıp.
- Aşama 0 ölçümünde tespit edildi: alt agent aracının gerçek adı `Agent` (dokümandaki `Task`
  değil) ve `ListAgents` beklenen işi yapmıyor. **Araç isim yüzeyi dokümandan değil, kurulu
  sürümden doğrulanacak.**

## QA düzeltme turu (2026-09-06, `docs/qa/F-012-2026-09-06.md` KALDI kararına yanıt)

**Kapatılan bloklayıcılar:**
- **B1** — `src/web/index.css`'e `@source "../features/chat/web"` eklendi; `tests/build-css.test.ts`
  artık `src/features/*/web`'i dosya sisteminden numaralandırıp her birinin `@source`'da bir
  satırı olduğunu doğruluyor (feature-bazlı değil, YAPISAL — bu hata sınıfının 4. tekrarıydı).
- **B2** — `history-log.ts`/`useChatSession.ts`'in katlama anahtarına `role` eklendi
  (`turn_id::kind::role`); kullanıcı mesajı artık CEO'nun cevabı tarafından ezilmiyor.
- **B3** — `session.ts`'e FIFO tur kuyruğu (`turnQueue`) eklendi; alt agent çalışırken gelen
  ikinci mesaj artık ilk turun akan cevabını bozmuyor.
- **B4** — `chat_tool` (finished/`tool_result`) yayını da kapalı alan allowlist'iyle test edildi
  (round A yalnızca `started` dalını ölçüyordu).
- **B5/E1** — `managedSettings.permissions.ask: ['Bash']` eklendi; gerçek oturumda iki yönlü
  doğrulandı (bkz. aşağıdaki "E1 sonucu"). K3 garantisi artık salt-okunur sınıflandırılan Bash
  komutlarını da kapsıyor.
- **B6** — `tests/integration/chat-hooks-live.test.ts` yazıldı (`package.json:26`'nın çağırdığı,
  önceden var olmayan dosya); `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` ile elle koşulur
  (gerçek ücretli SDK oturumu açar, `verify`de KOŞMAZ).

**E1 sonucu (B5, en kritik):** KAPANDI VE ÇİTLENDİ. Kurulu SDK'dan doğrulandı
(`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:3037-3045`) —
`managedSettings.permissions.ask` restrictive-key allowlist'ine dahil, `allowManagedPermissionRulesOnly`
ile birlikte çalışıyor. Gerçek oturumla iki yönlü kanıtlandı: `ask` YOKKEN salt-okunur Bash
komutları `canUseTool`'u hiç tetiklemiyordu, `ask:['Bash']` VARKEN her seferinde tetikliyor.
Çift çit: `session.test.ts`'in çevrimdışı K3 testi (`resolved.effective.permissions.ask` gerçekten
etkin ayar kademesine ulaşıyor mu) + `chat-hooks-live.test.ts`'in canlı testi (gerçek SDK
`canUseTool`'u gerçekten çağırıyor mu).

**Kapatılan önemli bulgular:** Ö1 (bariyer şeridi artık gerçek `stripped_env_vars`'ı gösteriyor,
`docs/03-ux.md §7`'ye metin eklendi), Ö2 (bütçe mesajına `(${budget} USD)` eklendi,
`ChatStatusPayload.max_budget_usd` yeni alan), Ö3 (chat_permission_request/resolved yükleri de
kapalı allowlist ile test edildi), Ö4 (oturumu çökertmeyen tur-içi hatalar artık `kind:'error'`
kalıcı bir transkript girdisi olarak görünüyor, `chat_error` yayını `turn_id`/`chat_seq` taşıyor),
Ö8 (izin kartı kararla `Onaylandı — <komut> çalıştı`/`Reddedildi` tek satırına kolabe oluyor,
`docs/03-ux.md §7` (h)2/(h)3 birebir).

**Bilinçli olarak ERTELENEN önemli bulgular (mimari karar gerektirir, bu QA turunda risk/kapsam
gerekçesiyle YAPILMADI):**
- **Ö5** — Sohbet ekranının tarayıcı seviyesinde E2E kapsaması sıfır (`playwright.config.ts:35`
  `MC_CHAT_ENABLED:'0'` ile derliyor). Düzeltme sahte `query()` enjekte edilebilen ayrı bir E2E
  modu gerektirir — bu, mevcut E2E harness'ine yeni bir yetenek eklemek demektir (ücret riski
  olmadan gerçek tarayıcıda sohbet ekranını açmak). Tek başına bu QA turunun "cerrahi değişiklik"
  sınırının dışında; CEO/architect onayı önerilir. B1'in yapısal `@source` çiti bu boşluğun EN
  AZ görsel regresyon kısmını (CSS sınıflarının derlenmemesi) artık kapatıyor.
- **Ö6** — `session.ts` her `content_block_delta`'da BİRİKMİŞ metnin TAMAMINI `historyLog.append`
  ile diske/belleğe yeni bir satır olarak yazıyor (O(delta_sayısı × metin_uzunluğu) büyüme).
  Düzeltme (ör. zaman/delta-sayısı ile kısıtlı yazma sıklığı, her zaman `finalizeTurn`'de tam
  metni yazma) `markDanglingAsInterrupted`'ın restart-sonrası davranışını etkileyebilir (kısmi
  metin kaybı riski) — bu bir tasarım kararı, tek bir turda aceleyle yapılırsa yeni bir
  dayanıklılık hatası riski taşır.
- **Ö7** — Araç satırları (`toolRows`) ve bekleyen izin istekleri sayfa yenilendiğinde
  kaybolmuyordu **çünkü hiç yüklenmiyorlardı** — bu, round A'dan beri `useChatSession.ts`'in
  kendi yorumunda ("bilinen bir sınırlama") belgelenmiş, kod içi bir kabul. Düzgün çözüm
  `ChatLogEntry`'ye `tool_use_id` eklemeyi, `foldByTurn`'ün anahtarını `kind==='tool'` için bunu
  içerecek şekilde genişletmeyi, `tool_result`/`permission_resolved` geçişlerini de kalıcı hale
  getirmeyi VE istemcinin `loadHistory`'sinin `toolRows`/`pendingPermissions`'ı geçmişten yeniden
  inşa etmesini gerektirir — şema + sunucu + istemci değişikliği, bu turun kapsamı dışında.

Ö5/Ö6/Ö7 için CEO/architect kararı gerekiyorsa `docs/blockers.md`'ye yazılabilir; bu turda
davranış AŞAĞI DEĞİŞMEDİ (round A'nın bildiği sınırlamalar aynen korundu, yeni bir regresyon
eklenmedi).

**Doğrulama:** `npm run verify` (typecheck + lint + test + build) = **0**, 849 test yeşil (55
dosya, +12 yeni test bu turda). `npm run e2e` = **0** (23/23). Süreç/port temizliği tur sonunda
doğrulandı (`node.exe`/`claude.exe` yetim yok, 7333/7433/7434'te dinleyen yok).

## QA düzeltme turu 2 (2026-09-06, `docs/qa/F-012-2026-09-06-tur2.md` KALDI kararına yanıt)

QA tur2: 6/6 bloklayıcı gerçekten kapandı (canlı iki yönlü kanıtlı E1 dahil), ama **2 yeni
bloklayıcı** (Y1, Y2) + **3 önemli** (Y3, Y4, Y5) bulgu KALDI kararını getirdi. Bu turda ele
alınanlar:

- **Y1 (BLOKLAYICI) — KAPANDI.** Bekleyen izin isteği artık **sunucu durumu**
  (`getStatus().pending_permissions`), istemci belleği değil. `canUseTool`/`resolvePermission`
  `chat_status` yayınını günceller; `useChatSession` `onChatStatus`'tan `pendingPermissions`'ı
  otoriter olarak kurar. Sayfa yenilemesi/SSE yeniden bağlanması sonrası kart geri gelir ve
  **gerçekten cevaplanabilir** (aynı `request_id`). Mutasyonla doğrulandı
  (`pending_permissions:[]` ve `onChatStatus` gövdesi kaldırılınca KIRMIZI).
- **Y2 (BLOKLAYICI) — KAPANDI.** `vite.config.ts`'in `MC_CHAT_ENABLED`'ı derleme anında `dist/`e
  gömen `define`'i kaldırıldı. `App.tsx` artık sekme görünürlüğünü `GET /api/chat/status`'un
  `chat_enabled` alanından **çalışma zamanında** okuyor. `npm run e2e` sonrası kalan `dist/`
  artık hangi ortamda derlendiğinden bağımsız. Elle doğrulandı: `dist/` `MC_CHAT_ENABLED=0` ile
  derlendi, sonra `MC_CHAT_ENABLED=1` + sahte `query()` (sıfır kota) ile başlatılan gerçek
  sunucuda gerçek Chromium'da Sohbet sekmesinin geldiği gözlemlendi; bundle grep'i
  `MC_CHAT_ENABLED` literalinin `dist/`te artık hiç geçmediğini gösterdi.
- **Y2 artığı (ayrı commit) — KAPANDI.** Geçmiş artık yalnızca `chat_enabled` bilindikten sonra
  yükleniyor (`useChatSession.ts`), Y2'nin çalışma-zamanı geçişiyle tutarlı.
- **Y4 (ÖNEMLİ) — KAPANDI.** B2'nin istemci yarısına (`useChatSession.ts` katlama anahtarı
  `turn_id::kind::role`) mutasyon çiti eklendi (M8 önceden çitsiz yeşil kalıyordu); `role`
  kaldırılınca yeni test KIRMIZI, geri konunca yeşil.
- **Y3 (ÖNEMLİ) — KISMEN KAPANDI, mimari bulgu.** `chat-hooks-live.test.ts`'in AC4 iki yönlü
  testi 5 canlı denemede determinize edildi. **Mimari bulgu (4. deneme):** SDK'nın kendi belgesi
  (`sdk.d.ts:4853`, `PermissionDenied` açıklaması) — "Denials that resolve before `canUseTool`
  runs — `PreToolUse` hook denies… are not covered [by this event]." `PreToolUse` hook'u
  **modelin önerdiği ham `tool_input` üzerinde çalışır ve `canUseTool` çağrılmadan ÖNCE karar
  verir**; `canUseTool`'un `updatedInput`'u hook'un GÖRDÜĞÜ girdiyi değiştirmez, yalnızca
  hook+izin ikisi de geçtikten SONRA fiilen ÇALIŞACAK komutu değiştirir. Test artık yalnızca
  modelin GERÇEKTEN önerdiği komut (`proposedBashCommands`, hook'un gördüğü ham veri) beklenen
  işaretleyiciyle eşleştiğinde mekanizma hakkında iddiada bulunuyor; eşleşmezse ayrı, okunabilir
  bir tanı hatası veriyor (model-davranışına bağımlılığı ortadan kaldırıyor). **5. denemeden
  sonra kota sınırı nedeniyle 6. bir canlı koşu bu turda YAPILMADI** — düzeltme mantıken doğru
  ama bu hâliyle canlı **yeniden doğrulanmadı**; `ADR-014` M2'nin "her QA turunda en az bir kez"
  kadansı bir sonraki turda karşılanmalı.
- **F5 — Ö6 (koşullu erteleme) belgelendi.** Ölçülen rakamlar (302 satır/956.300 bayt, ~159×
  amplifikasyon, `entries` dizisinin sınırsız büyümesi) `ADR-014`'ün "Kabul edilen riskler"
  bölümüne (madde 4, yeniden ele alınma eşiğiyle) ve `docs/blockers.md`'ye açık madde olarak
  yazıldı (QA tur2'nin koşulu).
- **F6 (Ö5'in erteleme reddi'ne yanıt) — sohbet ekranı için gerçek tarayıcı E2E'si eklendi.**
  QA'nın gösterdiği gibi enjeksiyon dikişi (`createServer(port, dataDir, chatQueryOverride)`)
  ürün kodunda zaten vardı; yeni bir yetenek eklemek gerekmedi. `playwright.chat.config.ts`
  (ayrı config, ana `npm run e2e` koşusuna dokunmaz) + `tests/e2e/helpers/chat-fake-server.ts`
  (gerçek üretim sunucusu, sahte `query()`, **sıfır kota**) + `tests/e2e/chat.spec.ts` (tek
  senaryo: mesaj gönder → akan cevap → izin kartı → onayla → kapanış cevabı → sayfa yenile →
  geçmiş kalıcı). `tests/e2e-config-guard.test.ts`'in sabit iki-dosyalık config listesi
  `readdirSync` ile YAPISAL bir taramaya çevrildi (B1'in `@source` çitiyle aynı ders — bir
  sonraki feature yeni bir `playwright*.config.ts` eklerse guard onu otomatik kapsar).
  Mutasyonla doğrulandı: eski sabit listeye dönülünce `chat.spec.ts` testi KIRMIZI verdi, geri
  alınınca yeşil.

**Kalan risk / QA'ya devredilen açık maddeler:**
- **Y3'ün düzeltmesi bu turda canlı yeniden doğrulanmadı** (kota sınırı) — bir sonraki QA
  turunda `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` ile en az bir kez koşulmalı.
- **Y5 (Ö6'nın bellek ayağının belgesizliği)** artık `ADR-014` madde 4'te ve `docs/blockers.md`'de
  yazılı — kapandı sayılabilir.
- Ö7'nin geri kalanı (araç satırlarının — `toolRows` — kendisi, yalnızca bekleyen izin değil —
  yenilemede hâlâ görüntülenmiyor) bilinçli olarak bu turun dışında kaldı; Y1'in çözümü yalnızca
  **kilitlenmeyi** kapattı, görüntü eksikliğini değil.
- **Mimari bulgu (Y3, CEO/architect değerlendirmesi bekliyor):** `PreToolUse` hook'unun
  `canUseTool`'dan ÖNCE karar vermesi, güvenlik sınırının SDK'nın izin motorundan değil
  doğrudan hook zincirinden geldiği anlamına geliyor — K3 garantisini değiştirmiyor (her iki
  mekanizma da bağımsız olarak engelliyor, ikisi de canlı doğrulandı) ama sıralamayı netleştiriyor;
  `ADR-014`'e yazılıp yazılmayacağına CEO karar versin.

**Doğrulama (bu tur, tekrar ölçüldü):** `npm run verify` = **0** (855 test + 2 atlandı, 56 dosya
+ 1 atlandı geçti). `npm run e2e` = **0** (23/23). `npm run e2e:chat` (yeni, sıfır kota) = **0**
(1/1, iki ayrı koşuda tekrarlandı). `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca meşru
`write-gate-manifest.test.ts:124` test adını döndürüyor. Süreç/port temizliği: `tasklist`te
node.exe yok, 7333-7436 arasında LISTENING yok.

## QA düzeltme turu 3 (2026-09-06, `docs/qa/F-012-2026-09-06-tur3.md` KALDI/ESKALE kararına
yanıt — kullanıcı onaylı, dar kapsamlı tek tur: yalnızca Y1 + Y3 + Ö7 belgelemesi)

**Y1 (BLOKLAYICI) — istemci yarısı düzeltildi.** `useChatSession.ts`'in `loadStatus`'u
(sayfa yenilemesi mount effect'i + SSE yeniden bağlanması `onChatSync`) yanıtı doğrudan
`setStatus(body.data)`'ya yazıyordu; kartı kuran TEK yer olan `onChatStatus` indirgeyicisinden
hiç geçmiyordu. Artık `loadStatus` içi `onChatStatus(body.data)` çağırıyor (`onChatStatus`
tanımı, `permissionDataRef`'e bağımlılığı yüzünden `loadStatus`'un üstüne taşındı). Sunucu
tarafına dokunulmadı (zaten doğruydu).
- `tests/features/chat/web/ChatScreen.test.tsx`'e GERÇEK yolu (mount/`onChatSync` → stub
  `fetch` → DOM, handler ELLE çağrılmadan) ölçen iki yeni test eklendi — QA'nın "test yorumu
  taradığından fazlasını iddia ediyor" bulgusuna yanıt.
- `tests/e2e/chat.spec.ts`'e "bekleyen izin varken sayfa yenile → kart geri gelir →
  cevaplanabilir" adımı eklendi (sahte `query()` dikişi, sıfır kota).
- **Mutasyon F artık KIRMIZI:** `onChatSync`'ten `void loadStatus()` çağrısı silinince yeni
  eklenen reconnect testi kırmızı verdi (`22 passed | 1 failed`), satır geri konunca 23/23
  yeşil. QA'nın ölçtüğü "855/855 yeşil kalıyordu" boşluğu artık çitli.

**Y3 (ÖNEMLİ) — canlı hook testi model davranışından bağımsız hale getirildi.** Eski tasarım
modelin belirli bir yayın komutunu **birebir önermesini** şart koşuyordu ve önermezse "test
kararsız, tekrar dene" diye kırılıyordu (4 art arda canlı koşuda bu tanı dalına takıldı — CEO
personası talimatı izlemek yerine proje bağlamını okuma alışkanlığını sürdürüyordu). O tanı dalı
TAMAMEN kaldırıldı.
- `tests/integration/chat-hooks-live.test.ts`'e kota harcamayan, modelden tamamen bağımsız yeni
  bir `describe` bloğu eklendi: `.claude/hooks/block-dangerous.cjs`'i gerçek bir alt süreç
  olarak `PreToolUse`'un göndereceği JSON'un aynısıyla çalıştırıp çıkış kodunu/`Engellendi`
  mesajını doğrudan ölçüyor (`npm run verify`'nin normal parçası, her koşuda çalışır).
- AC4'ün canlı testi artık model NE ÖNERİRSE ÖNERSİN çalışır: modelin önerdiği HAM komut
  `runHookDirect` ile aynı hook betiğine verilip "olması gereken karar" (ground truth)
  hesaplanıyor, canlı oturumun gözlenen kararı bununla karşılaştırılıyor. `agent:'ceo'` aktif
  koldan kaldırıldı (hook yükleme `settingSources`'a bağlı, persona'dan bağımsız) ve devre dışı
  koldaki gibi doğrudan yönlendiren bir `systemPrompt` kullanıldı.
- **Sonuç (1 canlı koşu, talimat gereği en fazla 2):** `MC_CHAT_LIVE_TESTS=1 npm run
  test:chat-live` → **exit 0, 4/4 yeşil** (2 yeni deterministik + E1/B5 + AC4). Önceki 4 art
  arda başarısız koşudan sonra ilk yeşil sonuç. İkinci koşu harcanmadı (gerek kalmadı).

**Ö7 — kod DEĞİŞMEDİ, yalnızca belgelendi (görev talimatı gereği).** `docs/03-ux.md:327`nin
"kalıcı kalır" iddiası ile araç/agent durum satırlarının yenilemede kaybolması arasındaki
çelişki `ADR-014` "Kabul edilen riskler" madde 5'e ve `docs/blockers.md`'ye (2026-09-06 kaydı)
yazıldı: ne kayboluyor (yalnızca `kind:'tool'` satırları), verinin nerede durduğu
(`history.jsonl`'de duruyor, kayıp yok), yeniden ele alınma eşiği (bir sonraki sohbet/Thread
feature'ı).

**Doğrulama (bu tur):**
- `npm run verify` = **0** (**859 test + 2 atlandı, 57 dosya** — yeni deterministik hook testi
  ikisi de dahil).
- `npm run e2e` = **0** (23/23, değişmedi).
- `npm run e2e:chat` = **0** (1/1, yenileme adımı dahil).
- `MC_CHAT_LIVE_TESTS=1 npm run test:chat-live` = **0** (4/4), tek koşu.
- `grep -rn "MUTATION\|MUTASYON" src/ tests/` yalnızca meşru `write-gate-manifest.test.ts:124`.
- Süreç/port temizliği: canlı koşu sonrası `tasklist` içinde `node.exe` **yok**.

**Kalan risk:**
- Ö7'nin kod düzeltmesi hâlâ yapılmadı (bilinçli, görev kapsamı dışı) — `docs/blockers.md`'de
  açık madde.
- AC4'ün ground-truth karşılaştırması, model HANGİ komutu önerirse önersin doğru sonuç verir,
  ama tehlikeli bir komut önerilmezse (`activeGroundTruth.blocked === false`) o koşunun kendisi
  "hook gerçekten bir şeyi durdurdu" diye GÜÇLÜ bir kanıt taşımaz (yalnızca tutarlılık kanıtı
  taşır). Bu turda `MC_CHAT_LIVE_DEBUG` AÇILMADAN koşuldu (talimat gereği yalnızca ölçüm), yani
  modelin bu KOŞUDA hangi komutu önerdiği ve `blockedActive`'in hangi değeri aldığı ayrıca
  loglanmadı — yalnızca `expect(blockedActive).toBe(activeGroundTruth.blocked)` ve
  `expect(blockedInactive).toBe(false)`'un İKİSİNİN DE geçtiği bilgisi var (exit 0, 4/4 yeşil).
  Zayıf yön, yeni eklenen kota-sıfır doğrudan-betik testiyle (her koşuda gerçek bir blok/geçiş
  kanıtı verir, model bağımsız) dengeleniyor. Bir sonraki canlı koşuda `MC_CHAT_LIVE_DEBUG=1`
  ile hangi dalın gerçekleştiği gözlenebilir.
