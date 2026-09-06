---
feature: F-012
title: F-012 sözleşme denetimi — tur 2 (düzeltme turu denetimi, dar kapsam, kod yok)
author: qa-evaluator
date: 2026-09-06
verdict: KALDI
---

# KARAR: KALDI
# ESKALE: false

Denetlenen belge: `docs/qa/F-012-contract.md` (848 satır, `status: draft`, `revision: 2`).
Bu tur **dar kapsamlıdır**: yalnızca 1. turun 7 BLOKLAYICI + 13 ÖNEMLİ bulgusunun kapanışı ve
CEO'nun bu turda yeni cevapladığı D10/D11 kararlarının sözleşmeye yansıyıp yansımadığı denetlendi.
1. turda onaylanan bölümler yeniden açılmadı. `npm install` yapılmadı, oturum açılmadı, `src/`/
`tests/` altında hiçbir dosyaya dokunulmadı — yalnızca bu rapor dosyası yazıldı.

**Özet:** developer'ın "4 bulgu öncül hatasıydı" iddiası **doğrulandı** (B1, B4, B5, B6 gerçekten
kapandı, uydurma değil). Kalan bloklayıcılardan B2/B3/B7 de gerçek çitleme/tasarım değişikliğiyle
kapandı. 13 önemli bulgunun 11'i tam kapandı, 2'si (Ö5, Ö6) kısmen kapandı ama bloklayıcı seviyede
değil. **Ancak** bu turda üç yeni bloklayıcı bulundu: (1) K3'ün delinme sorununu çözmek için
kullanılan `managedSettings` mekanizmasının "policy katmanı en yüksek önceliklidir" iddiasının
kanıtı olarak verilen `sdk.d.ts:6391` satırı **ilgisiz bir alanı** (`enabledPlugins`) belgeliyor,
`permissions` alanıyla ilgisi yok — referans iddiayı desteklemiyor; (2) CEO'nun bu turda verdiği
**D10** kararı ("§8a canlı testi başarısız olursa doğrudan Yol B'ye geç, yalnızca Yol B de
başarısız olursa CEO'ya eskale et, K3/UX§7.3'ü gevşetme seçeneği tamamen kapalı") sözleşmeye
**yansıtılmamış** — sözleşme hâlâ "başarısız olursa DUR, CEO'ya eskale et" diyor ve §13 soru 1'i
hâlâ açık bırakıyor; (3) **D11** kararı ("bütçe tavanı görünür olacak, sessizce durmayacak, ayarı
sabit gömülmeyecek") için sözleşmede ne bir mutasyon/çit ne de somut bir yapılandırma mekanizması
var — yalnızca "$20 öneriliyor" ve "crashed olur, restart ile devam edilir" yazıyor, "kullanıcı
mesajı görür mü" hiç çitlenmemiş.

---

## Bölüm 1 — 1. turun bulgularının durumu

### BLOKLAYICI

| # | Konu | Durum | Kanıt |
|---|---|---|---|
| B1 | `hello`'ya dayanan var olmayan telafi kancası | **KAPANDI** | `src/web/lib/useEventStream.ts:169` gerçekten `const handleOpen = (): void => setConnectionStatus('connected')` ve `:203`'te `es.addEventListener('open', handleOpen)` ile her (yeniden) bağlanmada tetikleniyor (native `EventSource` `'open'` olayı). Sözleşme artık `hello` kanalına değil bu gerçek kancaya dayanıyor (§5 "D7/B1 düzeltmesi") ve `chat_seq` ile canlı boşluk tespitini ekliyor. `hello`/SSE seviyesi ile native `'open'` olayı arasındaki farkı da açıkça yazmış (§2.4 satırı). |
| B2 | Bariyer yalnızca `ANTHROPIC_API_KEY`, D2 ile çelişki | **KAPANDI** | §7 artık dört önekli (`ANTHROPIC_`, `CLAUDE_`, `AWS_`, `GOOGLE_`) allowlist tanımlıyor, `ANTHROPIC_AUTH_TOKEN` ve bulut sağlayıcı bayrakları da kapsanıyor; `ALLOWED_ENV_EXCEPTIONS` üç isim `.claude/settings.json`'ın gerçek `env` bloğuyla eşleşiyor (dosya okunarak doğrulandı, aşağıya bkz). |
| B3 | K3 fiilen deliniyor, çitlenmemiş | **KISMEN KAPANDI — bkz. Bölüm 2 Y-B1** | §8a mekanizmayı (`managedSettings.permissions.ask`) buluyor, [T] işaretliyor, canlı test + escalation planı koyuyor — bu iyi. Ama kanıt referansı hatalı (Bölüm 2). |
| B4 | ADR-005 eki "yazılmadı" sayılmış | **KAPANDI** | `docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md:59-100` ek gerçekten mevcut (dosya bu turda tekrar okundu, satır numaraları doğrulandı — sözleşmenin "59-101" ifadesi ±1 satır farkla doğru). Üç kural (statik test 2. seviyeyi kapsamamalı, 2. seviyenin çiti hook engellemesi olmalı, F-012 kategori (1)'e giriyor) sözleşmenin §1/§8/§12'sine doğru yansıtılmış. |
| B5 | `history-log.ts` `no-write-gate-bypass`'ı KIRMIZI yapar, plan yok | **KAPANDI** | `tests/no-write-gate-bypass.test.ts:141-165` gerçek `STORE_FILES` haritası dört dosya için `path.join(ROOT,...)` anahtarı + tam çağrı-metni dizisi biçiminde (doğrulandı, dosya okundu). Sözleşmenin §2.1'de önerdiği beşinci/altıncı girdi **birebir aynı desende** yazılmış (`fs.mkdirSync(chatDir, {recursive:true})`, `fs.promises.appendFile(historyFile, line)`, `fs.writeFileSync(sessionIdFile, sessionId)`). Mutasyon 11 bu genişlemenin dışına çıkan bir yazmayı test ediyor. |
| B6 | "Minimal geçici ekran" varsayımı, UX yokmuş gibi yazılmış | **KAPANDI** | `docs/03-ux.md §7` bu turda da mevcut (1. turda doğrulanmıştı, bu tur tekrar okumadı ama sözleşme metni artık ona birebir atıf yapıyor). Sözleşmede "minimal" geçen tüm yerler artık yalnızca **terk edildiğini** anlatan geçmiş referanslar (`grep -n -i minimal` → 4 sonuç, hepsi "reddedildi/TERK EDİLDİ" bağlamında). `ChatScreen.minimal.tsx` adı tamamen kaldırılmış, `ChatScreen.tsx` kalıcı bileşen olarak tanımlı. |
| B7 | S2'nin zorunlu kıldığı çit mutasyon listesinde yok | **KAPANDI** | §5 `ChatToolEvent` kapalı şeması + mutasyon 12 (`chat_tool` yayınına ham `tool_result`/`content` eklenirse KIRMIZI, "yalnızca şu alanlar var" biçiminde) eklenmiş. |

### ÖNEMLİ

| # | Konu | Durum |
|---|---|---|
| Ö1 | Üçüncü sekme 3 çiti kırıyor, dosya planında yok | **KAPANDI** — `tests/web/App.test.tsx`, `tests/e2e/shell.spec.ts`, `tests/web/App.interaction.test.tsx` §2.3'e eklenmiş, yeni sayılar (3, 4/3) yazılmış, AC10'a kapalı-mod assert'i eklenmiş. |
| Ö2 | `includePartialMessages` hiç geçmiyor | **KAPANDI** — §0.3'te SDK'dan `sdk.d.ts:1721-1725` + `SDKPartialAssistantMessage` (`:4826-4844`) olarak doğrulanmış, §5'te kullanım tanımlanmış, kalan `thinking_delta` belirsizliği açıkça [T]/v1-kapsam-dışı olarak işaretlenmiş. |
| Ö3 | Ekleme-only log ile durum geçişi bağdaşmıyor | **KAPANDI** — yöntem seçilmiş (düzeltme-satırı, `foldByTurn`), atomiklik riski olmadığı gerekçelendirilmiş. |
| Ö4 | Sayfalama yok | **KAPANDI** — `limit`/`before_seq`/`has_more` eklendi. |
| Ö5 | Yeniden bağlanma politikası koddan okunmamış | **KISMEN KAPANDI** — B1 düzeltmesi native `EventSource` `'open'` davranışını doğru tarif ediyor, ama round 1'in istediği üç cümle (özel retry yok / backoff-eşik yok / "Yeniden bağlan" butonunun hangi uca bağlı olduğu) **hâlâ açıkça yazılmamış** — §10 tablosu yalnızca "Sistem mesajı satırı + Yeniden bağlan" diyor, butonun `POST /api/chat/restart`'ı mı çağırdığını yoksa SSE'yi mi yeniden kurduğunu belirtmiyor. **Bloklayıcı değil** (dar kapsam eşiğinin altında, kod turunda kolayca netleşir) ama not ediliyor. |
| Ö6 | İzin/soru/alt-agent tel şekilleri tanımsız | **KISMEN KAPANDI** — `chat_tool` (B7 ile) ve `ChatLogEntry.kind` (`'question'` eklendi) kapandı; ama `chat_permission_request`/`chat_permission_resolved` SSE yüklerinin **alan şeması hâlâ tanımlı değil** (yalnızca `/api/chat/permission` POST gövdesi için "sunucu doğrulamadan iletir" deniyor). **Bloklayıcı değil** (S2'nin özel olarak talep ettiği `chat_tool` çiti zaten var), ama kod turunda bu iki kanal için de kapalı şema tanımlanmalı — yoksa `canUseTool`'un ham girdisi (büyük `tool_input`) bu kanaldan sızabilir, mutasyon 12 bunu göremez. |
| Ö7 | K4 statik çiti `deps` enjeksiyonunu kaçırıyor | **KAPANDI** — `deps` kapalı küme (`query, dataDir, hub, now, env`) + mutasyon 8b (çağrı-yeri assert'i). |
| Ö8 | "Ebeveynle ölür" ✓ DOĞRULANDI yanlış yazılmış | **KAPANDI** — [T] TAHMİN'e indirilmiş, `stopAll()`'un açıkça sonlandırma yapması gerektiği ve QA'nın elle yetim-süreç kontrolü yapması gerektiği yazılmış. |
| Ö9 | Alt süreç stdio `'error'` olayları kapsanmıyor | **KAPANDI** — §9'a üçüncü madde + mutasyon 7b eklendi. |
| Ö10 | Canlı hook testi 3 eksik (yanlış-negatif tuzağı, `cwd` üretim ölçümü, dar çevrimdışı çit) | **KAPANDI** — §8'de üç madde de tek tek ele alınmış (deny-listesiyle örtüşmeyen komut, repo kökü `cwd`'den hook dosyası çözümü, `_selftest.cjs` deseninin tekrarı). |
| Ö11 | Dosya sahipliği sessizce genişliyor | **KAPANDI** — §2.3/§2.4 sonunda açık liste + "CEO'nun feature notunu güncellemesi isteniyor" notu. |
| Ö12 | `resolveEnvInt` döngüsü + kill-switch tipo güvensizliği | **KAPANDI** — kendi 3 satırlık `isChatEnabled` çözücüsü, tanınmayan değerde güvenli tarafa (kapalı) düşüyor + stderr uyarısı. |
| Ö13 | `settingSources`'ın CLAUDE.md/persona yüklediği doğrulanmamış | **KISMEN KAPANDI** — CLAUDE.md yüklemesi artık SDK'nın kendi tip dokümantasyonundan doğrulandı (`sdk.d.ts:2083`, bu turda **ben de** aynı satırı okuyup teyit ettim, aşağıya bkz). Persona (`"agent"` alanı) hâlâ [T] TAHMİN — ama artık "✓ DOĞRULANDI" diye YANLIŞ yazılmıyor, açıkça kod turunun ilk işi olarak elle doğrulama planı var (§13 soru 3). Kabul edilebilir — B3/D6'daki "dur, doğrulanana kadar ilerleme" desenine benzer bir hedge. |

Sessizce atlanmış bir bulgu **yok**: N1-N6 (round 1 NOT'ları) de tek tek grep ile kontrol edildi,
hepsi ilgili bölümlerde ("N2 düzeltmesi", "N5 — aşağıda not", "N6 düzeltmesi" vb.) açıkça
işlenmiş görünüyor.

---

## Bölüm 2 — Yeni bulgular (bu tur)

### Y-B1 (BLOKLAYICI) — D6/§8a'nın kanıt referansı (`sdk.d.ts:6391`) iddiayı desteklemiyor

- **Nerede:** §8a "Bulunan mekanizma" (satır 596-605), özellikle *"'politika katmanı'na (`user <
  project < local < flag < policy` sıralamasında en yüksek, `sdk.d.ts:6391`) beslenir"* cümlesi.
- **Doğrulama (bu turda, kurulu pakette):**
  `sdk.d.ts:6391` şu cümleyi taşıyor: *"Enabled plugins using plugin-id@marketplace-id format...
  **Settings precedence is user < project < local < flag < policy**, so to disable a plugin that
  project settings enable, set it to false in .claude/settings.local.json..."* — bu cümle
  `enabledPlugins` alanına özgü bir JSDoc yorumu, `permissions`/`managedSettings` ile **hiçbir
  ilgisi yok**. `sdk.d.ts` içinde bu tam cümle (`user < project < local < flag < policy`) yalnızca
  **bir kez** geçiyor (grep doğrulandı) ve o da `enabledPlugins` içinde.
- **Neden sorun:** sözleşmenin K3-delinme çözümünün (D6/Yol A) temel iddiası, `managedSettings`'in
  proje `permissions.allow`'unun **üzerine** geçtiğidir. Bu iddia için doğru destek gerçekten var
  — ama başka satırlarda: `ResolveSettingsOptions.managedSettings` dokümantasyonu (`sdk.d.ts:3037-
  3043`, bu turda ayrıca doğrulandı) `managedSettings`'i *"lowest-precedence policy sub-source"*
  olarak tanımlıyor ve `'managed'`ın genel olarak ayrı bir üst katman (`ResolvedSettingSource`,
  `sdk.d.ts:2989-2993`) olduğu görülüyor — yani teknik iddianın kendisi muhtemelen **doğru
  yönde**, ama sözleşmenin verdiği **kanıt yanlış**: ilgisiz bir alanın (plugin listesi) belgesini
  genel bir "policy her zaman en yüksek önceliklidir" kuralı gibi sunmak, tam olarak bu sözleşme
  turunun kaçınmaya çalıştığı "kanıt seviyesini yükseltme" hatasıdır (bkz. Ö8'in kendi düzeltmesi
  — orada kaynağı doğru okumak esastı, burada kaynak yanlış okunmuş).
  Ayrıca **daha kritik, sözleşmenin hiç bahsetmediği bir koşul var:** aynı `managedSettings`
  JSDoc'unun kendisi (`sdk.d.ts:2050-2061`) şunu söylüyor: *"When an IT-controlled managed-settings
  tier (server / MDM / managed-settings.json) exists on the user's machine, these are **dropped
  by default** — they only layer in if that admin opts in via `parentSettingsBehavior: 'merge'`."*
  Yani bu makinede (kurumsal/MDM) bir yönetici katmanı **varsa**, geliştiricinin verdiği
  `managedSettings.permissions.ask` sessizce **düşürülür** — sözleşme bu ön koşulu hiç kontrol
  etmiyor/yazmıyor.
- **Hafifletici:** §8a'nın 3 adımlı canlı test planı (adım 1-3) bu riski **pratikte yakalıyor** —
  eğer mekanizma (herhangi bir nedenle, precedence ya da admin-tier drop) işe yaramazsa adım 1
  `chat_permission_request` görmez ve mevcut kural zaten "DUR, eskale et" diyor. Yani davranışsal
  sonuç güvenli ama **belgenin kendi kanıt disiplini** (bu sözleşmenin övünç kaynağı: "✓/[T]
  işaretleri, uydurma yok") burada ihlal ediliyor — talimatta özellikle istenen kontrol bu.
- **Önerilen düzeltme:** `sdk.d.ts:6391` atıfını sil; yerine `sdk.d.ts:2989-2993`
  (`ResolvedSettingSource`, `'managed'` tanımı) ve `sdk.d.ts:3037-3043` (`ResolveSettingsOptions.
  managedSettings`, restrictive-key allowlist) atıflarını koy; admin-tier/`parentSettingsBehavior`
  koşulunu **açıkça** [T] olarak yaz ve canlı testin bunu da (dolaylı olarak) kapsadığını belirt.

### Y-B2 (BLOKLAYICI) — D10 sözleşmeye yansıtılmamış: "başarısız olursa CEO'ya eskale et" hâlâ yazılı, doğrudan Yol B'ye geçiş yok

- **Nerede:** §8a "D6 sonucu — özet" (satır 664-670) ve §13 açık soru 1 (satır 831-835).
- **Sorun:** Sözleşme hâlâ şunu söylüyor: *"Test başarısız olursa **DUR, CEO'ya eskale et** — Yol
  B'nin maliyeti ve 'bilinçli risk kabulü' (K3'ün UX §7.3 metninin gözden geçirilmesi) seçenekleri
  CEO'nun kararı"* ve §13 soru 1'i açık bırakıyor: *"CEO'nun bunu ŞİMDİDEN bir tercihle ('Yol B'ye
  otomatik geç' ya da 'K3'ü gözden geçir, UX §7.3'ü yumuşat') önceden cevaplamak isteyip
  istemediği soruluyor."*
- **CEO bu soruyu bu turda kapattı (D10, görev talimatında verildi):** §8a'nın canlı izin testi
  (adım 1-3) başarısız olursa **doğrudan Yol B'ye geçilir** (programatik hook'lar +
  `settingSources: []` + gerekli bağlamın (`CLAUDE.md`/persona) açıkça `systemPrompt`'a enjekte
  edilmesi). K3'ü veya UX §7.3'ü gevşetme seçeneği **kesin REDDEDİLDİ**, artık bir seçenek değil.
  Eskalasyon yalnızca **Yol B de** başarısız olursa yapılır.
- **Neden bloklayıcı:** sözleşme şu anki hâliyle kod turuna "Yol A başarısız → dur, CEO'ya sor"
  talimatıyla girer; bu, D10'un mandasına **doğrudan aykırı** bir akış üretir (gereksiz bir
  CEO-bekleme turu + K3'ü gevşetme seçeneğinin hâlâ "masada" gibi görünmesi — §8a'nın kendi metni
  bunu hâlâ bir seçenek olarak listeliyor). `CLAUDE.md`'nin dersi burada da geçerli: bir CEO kararı
  gövdeye yayılmadan tur başlarsa uygulanmaz.
- **Önerilen düzeltme:** §8a "D6 sonucu" ve §13 soru 1'i D10'a göre yeniden yaz: "Yol A canlı testi
  başarısız olursa **otomatik olarak Yol B'ye geçilir** (kod turu durmaz, Yol B'nin dosya
  sahipliği/kapsam genişlemesi bu kararla **önceden kabul edilmiştir**); yalnızca Yol B'nin **kendi**
  canlı testi de başarısız olursa CEO'ya eskale edilir. K3/UX§7.3'ü gevşetme seçeneği sözleşmeden
  tamamen çıkarılır." Yol B bölümü (§8a alt başlığı) da buna göre "kapsama alınmadı" değil
  "koşullu olarak plana dahil" olarak yeniden çerçevelenmeli; Yol B'nin ek dosya sahipliği
  (`hook-bridge.ts`) §2.4'e şart bağlı olarak eklenmelidir.

### Y-B3 (BLOKLAYICI) — D11 sözleşmeye yansıtılmamış: bütçe tavanı ne çitlenmiş ne de ayarlanabilir olarak tanımlanmış

- **Nerede:** §13 açık soru 2 (satır 836-841), §3 "Çöker ne olur" (satır 285-287), §11 (mutasyon
  listesi ve AC eşlemesi).
- **Sorun:** Sözleşme `maxBudgetUsd` için `$20/oturum` öneriyor ve *"aşılırsa oturum `crashed` +
  `error_max_budget_usd`, kullanıcı `restart` ile yeni bütçeyle devam eder"* diyor. Bu, D11'in iki
  şartından **hiçbirini** açıkça karşılamıyor:
  1. **"Ayarı sabit gömülmesin, büyüklük ayarlanabilir olsun":** sözleşme `$20`'nin nasıl
     ayarlanacağını (env değişkeni mi, `.claude/settings.json`'da mı, yoksa `session.ts` içinde
     literal bir sabit mi) hiç söylemiyor. §2.1 tablosunda `maxBudgetUsd` yalnızca "sabitler"
     listesinde geçiyor — kodda değiştirmek için dosya düzenlemesi gerekip gerekmeyeceği belirsiz.
  2. **"Tavana çarpıldığında sessizce durmasın, kullanıcı panelde açık bir mesaj görsün, devam
     etmeyi seçebilsin" + "çitlenmeli: mesaj gösterilmediğini ortaya çıkaran bir test olmalı":**
     `crashed` durumu genel `last_error` mekanizmasına (§10 tablosu, "last_error → Sistem mesajı
     satırı + Yeniden bağlan") düşüyor olabilir ama bu **açıkça yazılmamış** (bütçe aşımı özel
     olarak bu tabloda yok) ve — daha önemlisi — **mutasyon listesinde (§11.2, 12 madde) bütçe
     tavanına dair TEK BİR mutasyon yok**. AC eşleme tablosunda (§11.1) da `maxBudgetUsd`/bütçe
     aşımı hiçbir AC'ye bağlanmamış. Yani D11'in özellikle istediği "sessiz durmadığını kanıtlayan
     test" **hiç yok**.
- **Neden bloklayıcı:** D11 açıkça *"Çitlenmeli"* diyor — bu bir öneri değil, CEO'nun bu turda
  koyduğu bir kabul kriteri. `CLAUDE.md`'nin en pahalı hata sınıfı tam bu: *"iş yapıldı, kimse
  bilmiyor"* (sessiz durma). Sözleşme bu sınıfı başka yerlerde (B1, Ö9) doğru tanıyıp çitlerken,
  D11'in aynı sınıftan istediği çit burada eksik kalmış.
- **Önerilen düzeltme:** (a) `maxBudgetUsd`'yi bir env değişkenine (ör. `MC_CHAT_MAX_BUDGET_USD`,
  varsayılan 20) bağla, geçersiz/negatif değerde güvenli varsayılana düş (Ö12'deki
  `isChatEnabled` deseniyle tutarlı); (b) `chat_status`/`GET /api/chat/status`'a `last_error:
  'error_max_budget_usd'` düştüğünde UX'in bunu **özel olarak** (yalnızca genel "last_error"
  değil, en azından ayrı bir kullanıcı dostu metinle) gösterdiğini §10 tablosuna ekle; (c) yeni bir
  mutasyon ekle: bütçe aşımı algılandığında `chat_status`/`chat_error` yayını **kaldırılırsa**
  (yalnızca sunucu içi durumu `crashed` yapıp SSE'ye hiçbir şey basmazsa) `chat-api.test.ts` veya
  `session.test.ts` KIRMIZI vermeli — bu, D11'in "sessizce durmadığını ortaya çıkaran test" şartının
  birebir karşılığı.

---

## Bölüm 3 — D10/D11'in durumu

- **D10 (§8a canlı test başarısız olursa Yol B'ye geç, K3 pazarlığa kapalı):** **SÖZLEŞMEYE
  YANSITILMAMIŞ.** Bkz. Y-B2. Sözleşme hâlâ eski "dur, CEO'ya sor + K3'ü gözden geçirme seçeneği"
  akışını taşıyor.
- **D11 (bütçe tavanı görünür olacak, sessiz durmayacak, ayarlanabilir olacak):** **SÖZLEŞMEYE
  YANSITILMAMIŞ.** Bkz. Y-B3. Ne bir yapılandırma mekanizması ne de "sessiz durmadı" çiti var.

Bu ikisi de CEO'nun **bu tur için** özel olarak verdiği talimatlar olduğundan ve sözleşme onları
hiç işlememiş (ne kapatmış ne de gerekçeli reddetmiş, yalnızca eski hâliyle kalmış), bunlar tek
başına **KALDI** kararı için yeterli — dar kapsam kuralına rağmen, görev tanımının kendisi bu
ikisinin §13'te açık kalmasını "bulgudur" olarak nitelendiriyor.

---

## Karar

**KARAR: KALDI.** Gerekçe: 1. turun 7 bloklayıcısının 7'si de gerçek düzeltmeyle kapandı (B1, B4,
B5, B6 gerçekten öncül hatasıydı ve düzeltildi — bu iddia bu turda dosya:satır bazında doğrulandı;
B2, B3, B7 gerçek tasarım/çitleme eklemeleriyle kapandı) ve 13 önemli bulgunun 11'i tam, 2'si
(Ö5, Ö6) kısmen ama bloklayıcı olmayan bir düzeyde kapandı — **developer'ın bu turdaki işi gerçek
ve titiz**. Ancak: (1) D6/§8a'nın en kritik teknik iddiasının kanıt referansı yanlış alana işaret
ediyor (Y-B1); (2) CEO'nun bu tur için verdiği D10 kararı sözleşmeye hiç işlenmemiş, sözleşme hâlâ
eski (ve artık geçersiz) "dur, CEO'ya sor + K3'ü gevşetmeyi düşün" akışını taşıyor (Y-B2); (3)
D11'in açıkça istediği "sessiz durmadı" çiti ve ayarlanabilir bütçe mekanizması hiç yok (Y-B3).
Üçü de bu görevin özel olarak "bloklayıcı" olarak işaretlenmesini istediği türden bulgular
(yanlış referans, kapanmamış CEO kararı) — dar kapsam kuralı bunları küçültmeyi değil, tam
tersine bunlara özellikle bakmayı istiyordu.

Kod turu bu üç düzeltme yapılmadan başlarsa: Y-B1 nedeniyle geliştirici D6/Yol A'nın gerçekten
neden işe yarayacağını (ya da yaramayacağını) yanlış bir referansla açıklamaya devam eder; Y-B2
nedeniyle canlı test başarısız olduğunda geliştirici sözleşmenin (artık geçersiz) talimatına
uyup gereksiz yere CEO'yu bekler ya da K3'ü gevşetmeyi bir seçenek sanır; Y-B3 nedeniyle bütçe
aşımı sessizce olabilir ve hiçbir test bunu yakalamaz.

---

## Doğruladıklarım (bu turda, dosya/kodu okuyarak)

| İddia | Sonuç | Kanıt |
|---|---|---|
| `useEventStream.ts:169` `handleOpen`, her `'open'` olayında tetikleniyor | ✓ doğrulandı (B1) | `src/web/lib/useEventStream.ts:169,203` |
| `tests/no-write-gate-bypass.test.ts`'in `STORE_FILES` haritası tam-çağrı-metni deseninde | ✓ doğrulandı (B5) | `tests/no-write-gate-bypass.test.ts:141-165,303-320` |
| ADR-005 eki gerçekten yazılmış, satır aralığı ~59-100 | ✓ doğrulandı (B4) | `docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md:59-100` |
| Sözleşmede "minimal ekran" kavramına kalan bağımlılık yok | ✓ doğrulandı (B6) | `docs/qa/F-012-contract.md` içinde 4 "minimal" geçişi, hepsi terk-edildi bağlamında |
| `sdk.d.ts:2083` "Must include 'project' to load CLAUDE.md files" | ✓ doğrulandı (§8, Ö13 CLAUDE.md kısmı) | kurulu paket `sdk.d.ts:2083` |
| `sdk.d.ts:6391`'in `enabledPlugins`'e özgü olduğu, `managedSettings`/`permissions` ile ilgisi olmadığı | ✓ doğrulandı (Y-B1) | kurulu paket `sdk.d.ts:6377-6391` |
| `managedSettings`'in gerçek precedence/filtre davranışı (`sdk.d.ts:2050-2074`, `:3037-3043`, `:2989-2993`) | ✓ doğrulandı (Y-B1) | aynı dosya |
| §13 soru 1 hâlâ açık, D10'un mandasını içermiyor | ✓ doğrulandı (Y-B2) | `docs/qa/F-012-contract.md:664-670,831-835` |
| Mutasyon listesinde (12 madde) bütçe tavanına dair madde yok | ✓ doğrulandı (Y-B3) | `docs/qa/F-012-contract.md:747-793` (tam liste tarandı) |
| N1-N6'nın hepsi ilgili bölümlerde işlenmiş | ✓ doğrulandı | grep + ilgili bölüm okumaları |

## Doğrulayamadıklarım

1. **`managedSettings`'in gerçek çalışma zamanı davranışı** (precedence'ın fiilen `permissions.
   allow`'u ezip ezmediği, admin-tier/`parentSettingsBehavior` koşulunun bu makinede geçerli olup
   olmadığı) — yalnızca tip tanımları okundu, hiçbir SDK oturumu açılmadı (görev kısıtı).
2. **D6/Yol A'nın canlı test sonucu** — kod turunun ilk işi, bu turda ölçülmedi.
3. **`.claude/settings.json`'ın `env` bloğunun spawn zamanında `process.env`'i gerçekten ezip
   ezmediği** — sözleşme bunu da doğru şekilde [T] işaretlemiş, ben de doğrulayamadım (minify
   edilmiş SDK kaynağı, statik okumayla teyit edilemez).
4. **Windows'ta ebeveyn ölünce `claude.exe`'nin akıbeti** — ölçüm gerektirir, yapılamadı.
5. **`"agent": "ceo"` persona alanının gerçekten yüklenip yüklenmediği** — sözleşme de
   doğrulayamamış, [T] olarak bırakılmış; ben de doğrulayamadım.
6. **Uygulamanın çalışan hâli / davranışsal iddialar** — bu tur da belge denetimidir, hiçbir
   sunucu başlatılmadı, Playwright koşulmadı.
