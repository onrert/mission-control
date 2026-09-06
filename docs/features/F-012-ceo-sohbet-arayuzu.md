---
id: F-012
title: CEO sohbet arayüzü — panel, oturumu Agent SDK ile barındırır
status: qa
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
