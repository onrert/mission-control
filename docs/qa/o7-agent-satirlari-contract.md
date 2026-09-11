---
feature: Ö7 — sayfa yenilendikten sonra araç satırları kaybolmasın
status: qa
owner: developer
date: 2026-09-11
---

## Tek cümlelik var olma sebebi

Sohbet panelinin var olma sebebi "alt agent'lar çalışırken ne yaptıklarını görmek"tir
(`docs/00-idea.md` kapsam değişikliği notu, `ADR-014`); bu görüntü sayfa yenilemesinde
kaybolursa panel kendi ana vaadini bozar.

## Mevcut durumun kanıtı (kod okunarak ✓ DOĞRULANDI)

- `src/features/chat/server/session.ts:301-339` (`handleContentBlock`) — `tool_use` bloğu
  `historyLog.append({ kind:'tool', text: description, ... })` ile kalıcı yazılıyor (satır
  307-314) AMA `tool_use_id`/`tool_name`/durum (started/finished/error)/`elapsed_ms` **hiçbiri
  diske yazılmıyor** — yalnızca SSE yayınına gidiyor (315-325). `tool_result` bloğu (328-338)
  historyLog'a **hiç** yazmıyor, yalnızca SSE.
- `src/features/chat/server/history-log.ts:19-25` (`foldByTurn`) — anahtar
  `${turn_id}::${kind}::${role}`. Aynı turda birden fazla araç çağrısı olursa (yaygın durum,
  ör. bir alt agent + takip eden bir Bash çağrısı) TÜMÜ aynı anahtara düşer, yalnızca en yüksek
  `seq`'li **hayatta kalır** — bu, tool_use_id eklenmeden düzeltilse bile kendi başına ikinci bir
  veri kaybı kaynağıdır.
- `src/features/chat/web/useChatSession.ts:605` — `messages = ... .filter(e => e.kind === 'text'
  || e.kind === 'error')` — `kind:'tool'` geçmişten hiç okunmuyor.
- `src/features/chat/web/useChatSession.ts:310,467-487` — canlı `toolRows` AYRI bir
  `useState` + yalnızca `onChatToolEvent` (SSE) tarafından güncelleniyor; `loadHistory`
  bu state'e hiç dokunmuyor. Reload sonrası bu state boş `[]` başlar ve hiç doldurulmuyor.
- Sonuç: veri diskte (`history.jsonl`, `kind:'tool'` satırları olarak) duruyor ama hem eksik
  (metadata yok) hem de istemci onu okuyup göstermiyor. `ADR-014` "Kabul edilen riskler" madde 5
  bunu 2026-09-06'da "koşullu kabul, bloklayıcı değil" olarak kaydetmişti; bu turda kullanıcı
  kararıyla düzeltiliyor.

## Ne yapacağım

1. **Şema:** `ChatLogEntry`'ye (`src/shared/types.ts`) dört opsiyonel alan eklenir:
   `tool_use_id?`, `tool_name?`, `tool_status?: 'started'|'finished'|'error'`, `elapsed_ms?`.
   `parent_tool_use_id` **eklenmez** — hiçbir render yolu onu okumuyor (`ChatScreen.tsx`,
   `ToolStatusRow`, `toolStatusText` grep'le doğrulandı); eklemek kullanılmayan bir alanı
   kalıcı hale getirir (Karpathy §2). **Eşik:** ileride araç çağrılarını üst-agent'a göre
   gruplayan/girintileyen bir görünüm eklenirse, o zaman `parent_tool_use_id` da persist
   edilmeli — bugün değil.
2. **Sunucu (`session.ts`):** `handleContentBlock`'un her iki dalı da (`tool_use` VE
   `tool_result`) artık `historyLog.append` ile TAM metadata yazar (`tool_use_id`, `tool_name`,
   `tool_status`, `elapsed_ms`, `text=description`). Açıklama (`description`) bir
   `toolDescriptionByUseId` haritasında saklanır ki `tool_result` anındaki terminal kayıt da
   onu taşısın (fold sonrası yalnızca bu terminal kayıt hayatta kalacağı için açıklamanın
   kaybolmaması KRİTİK). `chat_tool` SSE yayınına iki alan eklenir: `chat_seq` (bu
   `historyLog.append`'in döndürdüğü GERÇEK `seq`, `chat_message`/`chat_user_echo`'nun zaten
   yaptığı desenin birebir aynısı) ve `description` finished/error dalına da eklenir (zaten
   allowlist'te izinli bir alan, yalnızca doldurulmuyordu).
3. **`foldByTurn` (`history-log.ts`) ve istemcinin eşleniği (`entryKey`,
   `useChatSession.ts`):** `kind==='tool' && tool_use_id` iken anahtar `tool::${tool_use_id}`
   olur (turn_id/role'den bağımsız — `tool_use_id` zaten global tekil, `session.sendMessage`'ın
   `crypto.randomUUID()`'siyle aynı garantiyi SDK'nın kendi `tool_use.id`'si taşır). Diğer
   `kind`'ler için mevcut `${turn_id}::${kind}::${role}` DEĞİŞMEDEN kalır (B2 düzeltmesini
   bozmaz).
4. **Dangling koruması (`markDanglingAsInterrupted`):** metin girdilerinin yanı sıra, restart
   anında hâlâ `tool_status==='started'` olan (yani sunucu çökerken yarım kalmış) araç kayıtları
   da `tool_status:'error'` ile kapatılır — metin girdileri için zaten var olan güvenlik ağının
   birebir aynısı, `ToolRow.status` tipi zaten `'error'`yi tanıyor.
5. **İstemci (`useChatSession.ts`):** ayrı `toolRows` `useState`'i KALDIRILIR. `toolRows` artık
   `entriesMap`'ten (`messages` ile AYNI kaynak) türetilen bir `useMemo`: `kind==='tool'` olan
   girdiler `ToolRow` şekline eşlenir. Böylece canlı SSE ve geçmişten yüklenen kayıtlar **aynı
   reconciliation mekanizmasını** (`upsertEntry`, seq bazlı "en yüksek kazanır") ve **aynı render
   bileşenini** (`ToolStatusRow`, değişmedi) kullanır — CLAUDE.md dersi "iki yol varsa biri
   sessizce bozulur" burada yapısal olarak imkânsız hale getiriliyor (tek yol).
   `onChatToolEvent`, gelen SSE yükünü `entriesMap`'e `tool::${tool_use_id}` anahtarıyla upsert
   eder; `description` payload'da yoksa (ör. eski/test verisi) haritadaki ÖNCEKİ kaydın
   `text`'i korunur (mevcut davranışla birebir, `tests/features/chat/web/ChatScreen.test.tsx`
   "S1 sabit şablon" testinin zaten varsaydığı davranış).
6. **Sıralama (kronoloji):** `ToolRow.started_at_ms`, kaydın kendi `ts`'inden DEĞİL, geri
   hesaplanarak türetilir: `entry.elapsed_ms` doluysa `Date.parse(entry.ts) - entry.elapsed_ms`
   (gerçek başlangıç anı), yoksa (`started` durumu, henüz bitmemiş) `Date.parse(entry.ts)`
   (kaydın kendisi zaten başlangıç anı). Bunun nedeni: `foldByTurn`/`upsertEntry` yalnızca EN
   SON kaydı (genelde `finished`) hayatta bırakır ve o kaydın `ts`'i BİTİŞ anıdır — bitiş anını
   sıralama anahtarı olarak kullanmak, uzun süren bir aracı olduğundan çok daha GEÇ bir noktaya
   sıçratır (F-010'un kronoloji dersiyle aynı hata sınıfı). Bu hesap hem geçmişten yüklenen hem
   canlı SSE'den gelen kayıtlar için AYNI fonksiyondan geçer (adım 5).
7. **Gizlilik (ADR-015) — ÖLÇÜLDÜ, redaksiyon UYGULANMIYOR, gerekçeli:**
   `node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts` grep'lendi — yerleşik araçların
   input şemaları arasında yalnızca `AgentInput` ("A short (3-5 word) description of the task")
   ve `BashInput` ("Clear, concise description of what this command does") bir `description`
   alanı taşıyor; `FileEditInput`/`FileWriteInput`/`FileReadInput`/`GlobInput`/`GrepInput` gibi
   yol/komut/içerik taşıyabilecek araçların input şemasında `description` alanı YOK. Yani bu
   turda persist edilen TEK serbest-metin alanı (`text`/`description`) yapısal olarak kısa bir
   görev özetiyle sınırlı — ham komut, dosya yolu veya dosya içeriği bu alandan GEÇEMEZ (şema
   onu zaten dışlıyor). Bu, ADR-015'in savunduğu tehdit modelinden (izlenen/güvenilmeyen
   PROJELERDEN gelen ham hook payload'ı, `normalize.ts`) FARKLI: buradaki içerik CEO'nun KENDİ
   modelinin ürettiği, zaten redaksiyonsuz gösterilen sohbet metniyle (`MessageBubble`) AYNI
   güven sınırında. Sohbetin ana metni redakte edilmiyorsa, aynı modelin ürettiği 3-5 kelimelik
   bir araç özetini ayrıca redakte etmek tutarsız bir güvenlik sınırı çizer ve gerçek bir sızıntı
   yolu KAPATMAZ (model isterse tam metninde de aynı bilgiyi yazabilir). **Ayrıca değişmeyen,
   önceden var olan bir gerçek:** izin kartının `input_preview`'ı (`buildInputPreview`,
   `canUseTool` içinde) HÂLÂ tam komutu/JSON'u redaksiyonsuz taşıyor — ama bu G5 Tur4'ün BİLİNÇLİ
   kararı (kullanıcı onaylamadan önce TAM komutu görmeli, `ADR-016`) ve Ö7'nin kapsamı DIŞINDA
   (o alan zaten sayfa yenilemesinde gösterilmiyor, yalnızca canlı bekleyen kart için var).
   **Yeniden ele alınma eşiği:** ileride bir araç şemasına serbest-metin, potansiyel olarak
   hassas bir `description`/benzeri alan eklenirse (ör. üçüncü parti bir MCP aracı) veya
   `input_preview`'ın kalıcı geçmişe (bugün olduğu gibi `permission_request` kind'i zaten
   yazılıyor ama okunmuyor) render edilmesi gündeme gelirse, o noktada `redactDeep` bu yola da
   taşınmalı.
8. **Hacim — kapsam dışı bırakılan öneri, eşikli:** Ö7 render edilen satır sayısını ARTIRMAZ:
   `foldByTurn`/`upsertEntry` her `tool_use_id` için TEK satır tutar (started→finished/error
   geçişi mevcut canlı davranışte olduğu gibi YERİNDE güncellenir, YENİ bir satır eklemez).
   Yani reload sonrası görünen satır sayısı = canlı sırada zaten görünen satır sayısı (bire bir
   PARİTE, artış yok). Çok sayıda araç çağrısı yapan uzun bir oturumda ekranın kullanılabilirliği
   (gruplama/daraltma) bu turun kapsamı DIŞINDA bırakılıyor. **Eşik:** gerçek kullanımda tek bir
   turda >50 araç satırı görülüp kaydırma kullanışsız hâle gelirse, bir sonraki turda "N araç
   çağrısı" özet grubu (varsayılan kapalı, tıklanınca açılır) değerlendirilmeli.

## Dosya sahipliği

`src/features/chat/**` (session.ts, history-log.ts, useChatSession.ts, ChatScreen.tsx),
`src/shared/types.ts` (yalnızca `ChatLogEntry` alan eklemesi), ilgili testler
(`tests/features/chat/**`, `tests/integration/chat-api.test.ts`, `tests/e2e/chat.spec.ts`),
`docs/decisions/ADR-014-*.md` madde 5 (istisna olarak serbest).

## Ölçülebilir kabul kriterleri

1. **Tekrar üretme (KIRMIZI önce):** `tests/e2e/chat.spec.ts`'in mevcut "sayfa yenilemesi:
   geçmiş kalıcı" adımına `Bash tamamlandı` metninin de göründüğünü doğrulayan bir `expect`
   eklenir; düzeltmeden ÖNCE bu KIRMIZI verir (kanıt turda kaydedilecek).
2. **Birim/entegrasyon seviyesi:**
   - `history-log.test.ts`: aynı turda iki farklı `tool_use_id`'nin `foldByTurn` sonrası İKİSİNİN
     DE hayatta kaldığını (ne turn_id ne kind bazlı ezilme) doğrulayan yeni test.
   - `history-log.test.ts`: restart sırasında `tool_status:'started'` dangling kaydın
     `tool_status:'error'`ye çevrildiğini doğrulayan yeni test.
   - `session.test.ts`: `tool_result` sonrası `getHistoryPage()`'in `tool_use_id`, `tool_name`,
     `tool_status:'finished'`, `elapsed_ms`, `text` (description) dolu bir `kind:'tool'` kaydı
     döndürdüğünü doğrulayan yeni test.
   - `chat-api.test.ts`: `ALLOWED_CHAT_TOOL_KEYS`'e `chat_seq` eklenir (yeni alan, sızıntı DEĞİL
     — kapalı allowlist bilinçli genişletiliyor); yeni bir test `/api/chat/history`'nin
     `tool_result` sonrası `kind:'tool'` kaydı döndürdüğünü doğrular (AC7'nin metin testinin
     tool eşleniği).
   - `ChatScreen.test.tsx`: geçmişten (`stubFetch`/`onChatSync` GERÇEK yolu, ELLE handler
     çağrılmadan) yüklenen `kind:'tool'` kaydının `ToolStatusRow` ile render edildiğini
     doğrulayan yeni test; aynı turda iki farklı `tool_use_id`'nin İKİSİNİN DE göründüğünü
     doğrulayan test; sıralama testi (bir aracın `ts`si geç ama `elapsed_ms` ile geri hesaplanan
     başlangıcı erken olduğunda, aradaki bir metin mesajından ÖNCE render edildiğini DOM sırasıyla
     doğrulayan test).
3. **Mutasyon (KIRMIZI kanıtı, sonra elle geri alma — `git checkout` KULLANILMAYACAK):**
   - Mutasyon A: `entryKey`/`foldByTurn`'deki `tool::${tool_use_id}` özel durumunu kaldır →
     yukarıdaki "iki farklı tool_use_id hayatta kalır" testi KIRMIZI vermeli.
   - Mutasyon B: `handleContentBlock`'un `tool_result` dalındaki `historyLog.append` çağrısını
     kaldır → yeni `session.test.ts`/`chat-api.test.ts` testleri KIRMIZI vermeli.
   - Mutasyon C: `started_at_ms` hesabını `Date.parse(entry.ts) - elapsed_ms` yerine düz
     `Date.parse(entry.ts)`'e döndür → sıralama testi KIRMIZI vermeli.
   Her mutasyon sonrası `git diff` ile hiçbir iz kalmadığı doğrulanacak.
4. **E2E (izole koşu):** `npm run e2e:chat` genişletilmiş senaryo + yeni 320px dar genişlik testi
   (`clippedVisibleWidth` — `tests/e2e/usage.spec.ts`'in tekniğinin BİREBİR kopyası, `toBeVisible`
   kaydırma kabında yalan söylediği için) yeşil.
5. **Regresyon:** `npm run test` assert kırmızısı sıfır (worker-fork ortam çökmesi görülürse bir
   kez daha koşulup ikisi de kırmızıysa gerçek kabul edilecek), `npm run e2e` 55/55 (izole),
   `tsc`=0, `eslint`=0, `_selftest.cjs` 206/206 (dokunulmadı, yalnızca doğrulama).
6. `ADR-014` madde 5 güncellenir: karar artık "düzeltildi", eski "koşullu kabul" ifadesi
   kaldırılır, bu sözleşmeye referans verilir.

## Doğrulama (bu tur, ölçülmüş)

- **Tekrar üretme (KIRMIZI önce):** beş kaynak dosya (`session.ts`, `history-log.ts`,
  `useChatSession.ts`, `ChatScreen.tsx`, `shared/types.ts`) `git stash`'lendi (test dosyaları
  DEĞİL); `npm run e2e:chat` çalıştırıldı → yeni iki Ö7 assertion'ı (`chat-tool-row` görünürlüğü,
  `Bash tamamlandı` metni) **KIRMIZI** verdi, diğer 3 test etkilenmedi. `git stash pop` ile geri
  yüklendi, aynı koşu **5/5 YEŞİL** (iki ayrı koşuda tekrarlandı, kararlı).
- **Mutasyon (üçü de KIRMIZI verdi, sonra elle geri alındı — `git checkout`/`git restore`
  KULLANILMADI, her birinden sonra `git diff` boş doğrulandı):**
  - A: `chatEntryKey`'deki `tool::${tool_use_id}` özel durumu kaldırıldı → 3 test dosyasında
    (`history-log.test.ts`, `session.test.ts`, `chat-api.test.ts`) toplam 3 test KIRMIZI.
  - B: `tool_result` dalındaki `historyLog.append` çağrısı kaldırıldı → `session.test.ts` ve
    `chat-api.test.ts`'te 2 test KIRMIZI.
  - C: `toToolRow`'un `ts - elapsed_ms` geri hesaplaması kaldırıldı → `ChatScreen.test.tsx`'in
    sıralama testi KIRMIZI (`expected 28 to be less than 15`).
- **Birim/entegrasyon:** `npm run test` → 1. koşu `Worker forks emitted error` ile ortamsal
  çökme verdi (assert **sıfır**, CLAUDE.md'de kayıtlı bilinen kararsızlık) → 2. koşu **1851
  geçti / 4 atlandı (86 dosya)**, assert kırmızısı yok. `tsc --noEmit`=0, `eslint .`=0.
- **E2E (izole):** `npm run e2e` **55/55**. `npm run e2e:chat` **5/5**, iki ayrı koşuda tekrar
  edildi.
- **Hook self-test:** `node .claude/hooks/_selftest.cjs` **206/206** (dosyalara dokunulmadı,
  yalnızca doğrulandı).
- **Süreç temizliği:** `tasklist` içinde `node.exe`/`chrome` yok; 7333/7433/7434/7435'te yalnızca
  `TIME_WAIT` (kapanmış bağlantı), `LISTENING` yok.

## Kalan riskler

1. **`parent_tool_use_id` persist edilmiyor** (bilinçli, §"Ne yapacağım" madde 1) — bugün hiçbir
   render yolu okumuyor; ileride araç çağrılarını üst-agent'a göre gruplayan bir görünüm
   eklenirse bu alan da şemaya eklenmeli.
2. **Hacim/gruplama kapsam dışı** (§"Ne yapacağım" madde 8, eşikli) — tek turda >50 araç satırı
   pratikte görülürse ele alınmalı.
3. **Dangling 'started' araç koruması yeni** (`markDanglingAsInterrupted`, §"Ne yapacağım"
   madde 4) — yalnızca birim testte (`history-log.test.ts`) doğrulandı, gerçek bir sunucu
   çökmesi senaryosunda (e2e) canlı ölçülmedi (düşük risk: mekanizma metin girdilerinin zaten
   kanıtlı emsalinin birebir kopyası).
4. Ö5/Ö6 (`ADR-014` madde 4, E2E kapsaması ve geçmiş yazma amplifikasyonu) bu turun kapsamı
   DIŞINDA, değişmedi.
