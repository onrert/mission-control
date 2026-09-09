---
feature: F-011
title: Token kullanımı ekranı (proje / gün / oturum / agent grupları)
author: developer
status: draft
date: 2026-09-09
---

# F-011 Sözleşmesi — Token kullanımı ekranı

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-011-token-kullanimi.md` (7 AC), `docs/03-ux.md` ekran 6 + Durum
tasarımı tablosu, `docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md` (karar 3),
`docs/wiki/pages/desen/claude-transcript-formati.md`, `docs/blockers.md` (D10),
`src/features/thread/server/transcript-reader.ts` (F-009, doğrudan yeniden kullanılır),
`src/features/thread/server/thread-detail.ts` (F-010'un okuyucuyu yeniden kullanma deseni — W1
emsali), `CLAUDE.md` "Öğrenilen kurallar" (tamamı).

Kod okunarak doğrulandı (✓ VERIFIED): `transcript-reader.ts` (guard + `readTranscript` + stats
tracker), `thread-detail.ts`/`handlers.ts` (F-010'un dağıtıcıya bağlanma deseni), `src/server/
index.ts` (route sırası, `claudeProjectsRoot` tekil çözümleme), `src/web/App.tsx` (sekme çubuğu,
`buildTabs`, dar-genişlik CSS'i), `tests/e2e/thread.spec.ts` (`clippedVisibleWidth` yardımcı
fonksiyonu, üretim-sekme-kümesi testi deseni).

Gerçek makinede ✓ DOĞRULANDI (bu turda, kod yazılmadan önce ölçüldü — Y2):
`~/.claude/projects/C--dev-apps-mission-control/**/subagents/*.meta.json` — **130 dosya**, 0
bozuk JSON, alan kümesi `{model, description, toolUseId, spawnDepth, agentType}`, `agentType`
dağılımı: `developer` 78, `qa-evaluator` 47, `explorer` 2, `ux` 1, `architect` 2. Her
`agent-<id>.jsonl` için TAM OLARAK bir `agent-<id>.meta.json` var (130/130 eşleşme, yetim yok).
Ayrıca (bilgi amaçlı, AC'yi DEĞİŞTİRMEZ): subagent `.jsonl` satırlarının kendisi de
`attributionAgent` alanını taşıyor (gözlenen örnek: `"developer"`, meta.json'daki `agentType` ile
BİREBİR aynı) — AC15 açıkça `subagents/*.meta.json`'u birincil kaynak olarak zorunlu kıldığı için
bu alan KULLANILMAZ, yalnızca bulgunun bağımsız bir çapraz-doğrulaması olarak not düşülür.
`type:"assistant"` satırlarının TAMAMI (`22.663/22.663`) hem `timestamp` (ISO 8601) hem
`sessionId` alanlarını taşıyor.

---

## 1. Kapsam

**İçinde:**
1. Yeni salt-okunur uç: `GET /api/usage` — proje filtresi YOK, izlenen TÜM projelerin
   transkript token toplamını tek yanıtta döner (Thread/Kapılar'ın tek-proje seçicisinin AKSİNE —
   PRD F6 mockup'ı "Grupla: [Proje ▾] [Gün ▾]" bir proje FİLTRESİ değil, bir GÖRÜNTÜLEME SIRASI
   seçicisidir).
2. `src/features/usage/server/usage-aggregator.ts` — `computeUsageReport(claudeProjectsRoot,
   projects)`: **W1/Y1 — ikinci bir dosya-okuma/yol-guard yolu KURULMAZ.**
   `findAllowedTranscriptDirectories`/`readAllowedTranscript` (F-009, `transcript-reader.ts`)
   DOĞRUDAN çağrılır; dosya bulma + guard + satır ayrıştırma + `degraded` hesaplaması TAMAMEN o
   modülden gelir. Bu dosyanın kendi `fs` çağrıları yalnızca üç yerde: (a) proje dizini altındaki
   üst düzey `.jsonl` + alt dizin listesi (`fs.readdirSync`, F-010'un `buildTranscriptSection`
   emsali — okuma-guard DEĞİL, yalnızca dizin listeleme), (b) `subagents/*.jsonl`'ın kardeş
   `.meta.json`'ını okumak (`fs.readFileSync` + `JSON.parse`, guard gerektirmez — dosya zaten
   `readAllowedTranscript`'in kabul ettiği aynı dizinde, path traversal riski yok, sabit `.jsonl`
   → `.meta.json` uzantı değişimi), (c) `fs.statSync` (gün türetmek için `mtime`, F-010 emsali) ve
   kök dizinin var/okunabilir olduğunu doğrulamak için tek bir `fs.existsSync`/`fs.readdirSync`
   (AC10/Y8 — "kaynak okunamadı" sinyali). Hiçbiri `resolveAllowedTranscriptPath`'in yaptığı
   symlink/kapsam kontrolünü TEKRARLAMAZ.
3. **Gün türetme kararı (AC-yorumu, gerekçeli sapma):** ADR-007 "~60 satır, toplama işi" der;
   satır-bazlı gerçek zaman damgasıyla (her `assistant` satırının kendi `timestamp` alanı,
   yukarıda ✓ DOĞRULANDI) gün ayrımı yapmak MEVCUT `readTranscript()`'in yalnızca DOSYA
   TOPLAMI döndürmesi nedeniyle ikinci bir satır-bazlı ayrıştırıcı gerektirirdi — bu da W1/Y1'i
   ihlal ederdi (transkript ayrıştırmasının TEK sahibi `transcript-reader.ts` kalır). Bunun
   yerine **dosyanın kendi `mtime`'ının günü** kullanılır (F-010'un transkript zaman damgası için
   zaten yaptığı seçimin aynısı, `thread-detail.ts` `buildTranscriptSection`). Sınırlama: gece
   yarısını aşan bir oturumun tamamı dosyanın SON değiştirilme gününe yazılır (satır-satır
   bölünmez). Bu, `docs/wiki/pages/desen/claude-transcript-formati.md`'ye eklenecek bir not
   olarak belgelenecek (Y2 diskiplini — ne yapıldığı VE yapılmayanın nedeni yazılı).
4. Gruplama modeli (hiyerarşi, sunucu tarafında TAM kurulur): proje → gün → oturum → agent.
   - Ana oturum dosyaları (`<encoded-proje>/<uuid>.jsonl`) → `agent: "ana oturum"`,
     `session_id: <uuid>` (dosya adından, JSON içeriği ayrıştırılmaz).
   - Subagent dosyaları (`<uuid>/subagents/agent-<id>.jsonl`) → `session_id: <uuid>` (ÜST dizin
     adından — üst dosyayla AYNI oturuma bağlanır), `agent: <meta.json.agentType>` VEYA
     `"bilinmiyor"` (meta.json yok/bozuk/`agentType` alanı yok/boş — Y2, ASLA uydurma).
5. İstemci tarafı (`src/features/usage/web/**`): "Grupla: [Proje ▾] [Gün ▾]" seçici — birincil
   sıralama anahtarını değiştirir (proje→gün veya gün→proje), İKİ sütun da HER ZAMAN görünür
   (mockup'ın "Proje" + "Gün" sütunlarının ikisini birden gösterdiği tabloyla tutarlı — seçici
   veriyi FİLTRELEMEZ, yalnızca birincil grup/sıra anahtarını değiştirir). Her satır (proje×gün
   çifti) `<details>` ile genişler; içeriği **oturum × agent** kırılımıdır (`"Oturum <kısa-id> ·
   <agent>: giriş X, çıkış Y"` satırları) — AC15'in "oturum VE agent bazında gruplanabilir"
   ifadesini TEK bir genişleme seviyesinde, dürüstçe her iki boyutu da göstererek karşılar (üç
   seviyeli iç içe `<details>` yerine — Karpathy §2, gereksiz DOM derinliği yok).
6. **Y3 — ağ isteği yok.** `computeUsageReport` ve `handleUsageReport` yalnızca `node:fs`/
   `node:path` kullanır; `fetch`/`node:http`/`node:https` HİÇ import edilmez. Çit: birim testte
   `globalThis.fetch` ve `http.request`/`https.request` çağrıldığında throw eden bir sonda
   kurulur, `computeUsageReport` gerçek fixture verisiyle çağrılır, sondanın HİÇ tetiklenmediği
   (throw fırlamadığı + doğru sonuç döndüğü) doğrulanır.
7. **Y8 — kaynak okunamazsa çökmez, "bulunamadı" ile "fırlattı" AYRI test edilir.**
   `source_unreadable: true` iki farklı KOŞULDAN gelebilir: (a) `claudeProjectsRoot`
   `fs.existsSync` ile YOK (bulunamadı), (b) kök VAR ama `fs.readdirSync` FIRLATIYOR (ör. EPERM,
   mock'lanarak ölçülür). İkisi de ayrı birim testle kanıtlanır. Alt seviyede (tek bir proje
   dizini, tek bir `subagents/` alt dizini, tek bir dosya) okunamazsa o parça best-effort atlanır
   (`try/catch`, F-010 `buildTranscriptSection` deseni), TÜM raporu düşürmez.
8. **Y5 — "veri eksik olabilir" uyarısı.** Toplam `lines_ok + lines_bad > 0` VE
   `lines_ok / (lines_ok + lines_bad) < 0.99` ise `degraded: true`. Eşik (%99) muhafazakâr
   seçildi: gerçek veride (bu turda taranan 22.663 `assistant` satırının TAMAMI ayrıştırılabilir)
   bozuk satır hiç gözlenmedi; eşik yalnızca gerçek bir bozulmada tetiklenecek şekilde gevşek
   bırakıldı (ADR-007 "oran düşerse" ifadesi kesin bir sayı vermiyor — bu bir yorum kararı, rapora
   yazılır). İstemci `degraded:true` iken tabloyla BİRLİKTE (üstte) sabit bir uyarı satırı
   gösterir (metin `docs/03-ux.md`'ye eklenir, aşağıya bakınız).
9. `docs/03-ux.md` ekran 6 genişletilir: "veri eksik olabilir" uyarı metni, boş/hata/okunamadı
   durumlarının (zaten mevcut Durum tasarımı tablosunda) "hiç proje yoksa Ayarlar'a git" nüansı
   (diğer liste ekranlarıyla — Zaman Çizelgesi/Kanban/Thread — TUTARLI, ADR-001/mevcut desenin
   tekrarı, yeni bir kavram DEĞİL), oturum×agent genişleme satırının biçimi.
10. `README.md`'ye `ccusage` ile elle çapraz kontrol bölümü (AC6/Y10).
11. **D10 kapatma (Y6):** sekme çubuğunun dar/orta genişlik CSS'i, 6 sekmeyle (Zaman Çizelgesi/
    Kanban/Sohbet/Kapılar/Thread/Token) 320-767px arası HİÇBİR sekmenin kırpılmış görünür
    genişliğinin 0px olmadığı ölçülür (üretim sekme kümesiyle, `mockChatEnabled` deseni —
    `tests/e2e/thread.spec.ts`'in zaten kurduğu yardımcı fonksiyonun AYNISI, kopyalanmaz,
    `usage.spec.ts` kendi dosyasında tekrar yazılır çünkü `tests/e2e/thread.spec.ts` F-010'un
    dosya sahipliğinde — iki dosyanın aynı küçük yardımcıyı BAĞIMSIZ yazması, bir üçüncü paylaşılan
    test-yardımcı modülü İCAT ETMEKTEN daha ucuz, Karpathy §2).

**Dışında:**
- Kanan/canlı SSE güncellemesi (istek bazlı, Thread/Kapılar emsali).
- `ccusage`'ı gerçekten çalıştırmak/otomatik karşılaştırmak (README yalnızca ELLE adım anlatır).
- Belirli bir oturumun konuşma içeriğini göstermek (bu Thread'in işi).

---

## 2. Dosya sahipliği ve gerekçeli genişletme

Feature notu: `src/features/usage/**`, ilgili testler, `README.md` (çapraz kontrol bölümü).

Gerekçeli minimal genişletme (F-010 precedent'i — `docs/progress.md` "2026-09-10 — F-010 kod
turu": aynı notla `shared/types.ts`+`src/server/index.ts`+`src/web/App.tsx` dokunulmuştu):
1. `src/shared/types.ts` — `TokenUsageTotals`/`UsageReport` ve alt tipleri (tel tipi, hem sunucu
   hem istemci import eder — mevcut `ThreadDetail` emsali).
2. `src/server/index.ts` — tek `import` + tek route (`GET /api/usage`), `claudeProjectsRoot`
   DEĞİŞTİRİLMEZ (F-010'un zaten çözdüğü aynı değer yeniden kullanılır).
3. `src/web/App.tsx` — `TabScreen` union'a `'usage'` eklenir, `buildTabs()`'a Thread'den sonra
   koşulsuz eklenir (Kapılar/Thread emsali), yeni `panel-usage` `tabpanel`. **Ayrıca D10
   kapatmak için sekme çubuğunun CSS'i** (dar/orta genişlik sınıfları) güncellenir — bu feature'ın
   AÇIKÇA görevlendirildiği tek CSS değişikliği.
4. `docs/wiki/pages/desen/claude-transcript-formati.md` — Y2 bulgusu (meta.json gerçekten var,
   `attributionAgent` çapraz-doğrulaması) eklenir (CEO'nun açık izni).
5. Kapalı-sekme-kümesi genel testleri (F-010'un AYNI sınıf hareketi — `docs/progress.md`
   "Kapalı-küme çitleri güncellendi"): `tests/web/App.test.tsx`, `tests/web/App.chat-tab.test.tsx`,
   `tests/web/App.interaction.test.tsx`, `tests/e2e/shell.spec.ts` — sekme SAYISI 5→6 güncellenir,
   kapalı-küme DOĞASI korunur (Y7 — "kapalı kalacak").
6. `tests/e2e/thread.spec.ts` — **yalnızca** "Dar genişlik, üretim sekme kümesi (5 sekme…)"
   test bloğundaki sabit `5` sayısı ve `tabIds` dizisi 6. sekmeyi (`tab-usage`) yansıtacak şekilde
   güncellenir (mekanik, tek satır + bir dizi elemanı). Bu dosya F-010'un dosya sahipliğinde ama
   BOZULMASI doğrudan bu feature'ın yetkili değişikliğinin (6. sekme ekleme) kaçınılmaz sonucu —
   AYNI sınıf, F-010'un kendisinin `shell.spec.ts`'e yaptığı mekanik güncelleme (`docs/progress.md`
   "2026-09-10" notu). Thread'in KENDİ mantığına/testlerine dokunulmaz.

Bunların DIŞINDA hiçbir dosyaya dokunulmaz.

---

## 3. Davranışlar ve doğrulama planı

| # | Davranış | Doğrulama |
|---|---|---|
| B1 | AC-1: yalnızca `type:"assistant"` satırları, 4 `usage` alanı toplanır | Birim: bilinen fixture + elle hesaplanmış toplam (Y4). Mutasyon: `transcript-reader.ts`'in `type==='assistant'` kapısı GEÇİCİ kaldırılır (temiz geri alınır, commit edilmez) → test KIRMIZI. |
| B2 | AC-3/AC-15: proje/gün/oturum/agent gruplanabilir, `agentType` gerçek meta.json'dan | Birim: 130 gerçek dosya ölçümü (yukarıda) + fixture'da meta.json yok/bozuk → "bilinmiyor". |
| B3 | AC-2/AC-10: kaynak okunamazsa çökmez | Birim: kök yok (`existsSync=false`) VE kök `readdirSync` throw (EPERM mock) — İKİ AYRI test, `source_unreadable:true`. E2E: `/api/usage` 200 döner (500 değil), ekran "okunamadı" mesajı gösterir. |
V| B4 | ADR-007 azaltımı: oran düşünce uyarı | Birim: `lines_bad` fixture'da eşiği aşacak şekilde kurulur → `degraded:true`. Web: uyarı satırı DOM'da. Mutasyon: uyarı render bloğu kaldırılır → test KIRMIZI. |
| B5 | AC-4/Y3: ağ isteği yok | Birim: `fetch`/`http.request` sondası + gerçek fixture çağrısı, throw YOK. Mutasyon: `computeUsageReport`'a geçici bir `fetch(...)` satırı eklenir → sonda testi KIRMIZI. |
| B6 | AC-7: 32 MB kuyruk okuma | `transcript-reader.ts`'in KENDİ testi zaten bunu kanıtlıyor (F-009); F-011 yalnızca `readAllowedTranscript`'i çağırdığını gösteren bir entegrasyon testiyle DAVRANIŞI DEVRALDIĞINI kanıtlar (yeni bir kuyruk testi İCAT EDİLMEZ — W1). |
| B7 | D10: 6 sekmeyle 320-767px arası hiçbir sekme 0px değil | E2E: `usage.spec.ts`, `mockChatEnabled` ile üretim 6-sekme kümesi, genişlik listesi `[320,375,480,640,700,767]`. Mutasyon: dar-genişlik CSS override'ı (`sm:` sınıfları) geri alınır → en az bir genişlikte test KIRMIZI. |
| B8 | AC-6/Y10: README çapraz kontrol | Elle okunabilirlik — otomatik test yok (dokümantasyon), README'de komut örneği gerçekten çalışır şekilde yazılır (`npx ccusage@latest` gibi resmi paket adı doğrulanır). |

## 5. QA düzeltme turu (2026-09-10, KALDI → düzeltme) — sözleşme eki

Kaynak: `docs/qa/F-011-2026-09-10.md` (KALDI, 1 bloklayıcı + ağ/salt-okunurluk çiti yenildi + 3
sessiz veri kaybı). CEO kararları Z1-Z7. Bu ek yalnızca QA'nın bulgularını kapatır — onaylanmış
bölümler (§1-§4) yeniden açılmaz.

**Z1 (BLOKLAYICI) — mükerrer `usage` toplama:** `transcript-reader.ts`'in `readTranscript`'i artık
aynı `message.id`+`requestId` çiftini taşıyan `assistant` satırlarından yalnızca ilkini sayar
(dosya-içi `Set`, per-`readTranscript`-çağrısı ömürlü). Gerekçeli minimal dokunuş: F-009/F-010 bu
dosyaya bağımlı, ama hata kaynağı burada (`transcript-reader.ts:179-192` QA referansı). Çit: yeni,
dondurulmuş fixture `tests/fixtures/transcripts/duplicate-usage.jsonl` (mevcut 5 fixture
DEĞİŞMEDİ) + gerçek mutasyonla KIRMIZI görüldü (dedup kontrolü kaldırıldı → 210/110 fark tam
ölçüldü, sonra dosya `.bak` ile bit-bit aynı şekilde geri yüklendi). Bağımsız doğrulama: gerçek
makinede `npm run build && npm start` ile panel açılıp `ccusage session --json` ile proje
oturumlarının toplamı karşılaştırıldı (bkz. §6 "Manuel doğrulama" — bu bölüm koddan SONRA
dolduruldu, ölçüm sırası: kod → build → canlı karşılaştırma).

**Z2 — ağ çiti yapısal hale getirildi:** `tests/features/usage/server/network-capability-guard.test.ts`
— `src/features/usage/server/**` giriş dosyalarından (handlers.ts, usage-aggregator.ts) başlayıp
YERELİ (`./`, `../`) import zincirini takip ederek TAM modül grafiğini kurar; grafikteki HİÇBİR
dosya `net/http/https/dns/tls/child_process/dgram/worker_threads` modülünü ÇALIŞMA ZAMANINDA
import edemez (`import type` erimiş sayılır, muaf), bare/`globalThis.` `fetch(` çağıramaz, dinamik
`import()` kullanamaz. Kapsam bilinçli olarak **sunucu tarafı** (`usage/server/**`) ile sınırlı —
istemci `useUsageReport.ts`'in kendi `/api/usage` backend'ine `fetch` atması AC4/Y3'ün kastettiği
"harici ağ isteği" değildir (aynı-origin, kendi backend'i); bu ayrım burada açıkça belgelenir.
QA'nın 8 sondasının hepsi artık import-seviyesinde kapanıyor (http/net/dns/child_process importu
zaten yasak; dinamik import ve yakalanmış referans da böylece anlamsızlaşıyor). 5 kalıcı
negatif-kontrol testi guard'ın körlüğünü önler.

**Z3 — salt-okunurluk manifest testi:** `tests/features/usage/server/usage-read-only-manifest.test.ts`
— Thread emsali (`thread-read-only-manifest.test.ts`) birebir desende: `computeUsageReport`
çağrılarından ÖNCE hem proje hem `claudeRoot` dizininin `snapshotDir` anlık görüntüsü alınır,
çağrılardan SONRA tekrar alınıp TAM EŞİTLİK aranır — çağrı ADI değil SONUÇ denetlenir, bu yüzden
`fs['w'+'riteFileSync']` gibi dolaylı yazma da yakalanır. "MUTASYON emsali" testi guard'ın
gerçekten hassas olduğunu kanıtlar.

**Z4 — üç sessiz veri kaybı artık `degraded:true` + görünür uyarı:**
1. **Ö1 (format değişimi):** `TranscriptReadResult.unknown_type_lines` artık `UsageReport`'a
   taşınıyor; `degraded` eşiği "ayrıştırılabilen" değil "TANINAN" oran üzerinden hesaplanıyor
   (`(lines_ok+lines_bad-lines_bad-unknown_type_lines)/(lines_ok+lines_bad) < 0.99`, sadeleştirilmiş
   hâli: `(tanınan)/(toplam) < eşik`). Format tamamen yeniden adlandırılırsa (`lines_bad=0`,
   `unknown_type_lines=toplam`) oran 0 olur → `degraded:true`.
2. **Ö2 (okunamayan dosya):** `usage-aggregator.ts` artık `file_read_failed:true` dönen her dosyayı
   `unreadable_file_count`'a sayıyor (stat-race atlaması — Y8'in KENDİ testi — bu sayaca dahil
   DEĞİL, o hâlâ sessiz best-effort atlama, gerekçe: gerçek bir okuma hatası değil TOCTOU yarışı).
   `unreadable_file_count > 0` → `degraded:true`.
3. **Ö3 (32 MB kırpma):** `transcript-reader.ts`'e eklenen `truncated` alanı (satır sınırı
   bulunsa da) artık `usage-aggregator.ts`'te `truncated_file_count`'a toplanıyor.
   `truncated_file_count > 0` → `degraded:true`.

Metinler önce `docs/03-ux.md` ekran 6'ya yazıldı (aşağıda), sonra `UsageScreen.tsx`'e uygulandı —
uyarı kutusu (`usage-degraded-warning`) artık üç bağımsız satır render edebilir (hangi sayaç sıfırdan
büyükse o satır görünür); geri uyumluluk için eski testler (yalnızca `lines_bad` senaryosu)
DEĞİŞMEDEN geçmeye devam eder. Üç senaryo `usage-aggregator.test.ts`'te ayrı ayrı çitlendi.

**Z5 — dar genişlik:** `App.tsx`'in sekme çubuğu grid/gap'i 320px'te 21px taşmayı gidermek için
daraltıldı (gerçek Chromium ölçümüyle doğrulandı, `usage.spec.ts`/`thread.spec.ts` eşiği `>0`'dan
anlamlı bir asgari genişliğe çıkarıldı). 280px de ölçüldü ve E2E'ye eklendi. Yanlış "320px'te
hepsi sığıyor" yorumu düzeltildi.

**Z6 — sütun başlıkları:** `UsageScreen.tsx`'e `docs/03-ux.md` ekran 6 mockup'ıyla birebir
(`Proje | Gün | Giriş | Çıkış | Dağılım`) bir başlık satırı eklendi; 320px'te proje sütununun
boşalmaması için grid şablonu `1fr_1fr_auto_auto_auto` → `1fr_auto_auto_auto_auto` yapıldı (gün
sütunu içeriğine göre boyutlanır, proje kalan TÜM esnek alanı alır).

**Z7 — README AC6:** çapraz kontrol yordamı oturum-kimliği eşleştirmesine (QA'nın kullandığı,
kanıtlanmış yönteme) çevrildi; kapsam farkı (ccusage TÜM makine vs panel TEK proje) açıkça
yazıldı; "%10+ sapmada degraded uyarısına bak" yönlendirmesi kaldırıldı (degraded çift-sayım gibi
bir hesaplama hatasını YAKALAMAZ, yalnızca tanınmayan/okunamayan satır oranını yansıtır).

### Doğrulama planı (bu turun ekstra B-maddeleri)

| # | Davranış | Doğrulama |
|---|---|---|
| ZB1 | Z1 dedup | Birim: yeni fixture + mutasyon (gerçek kod mutasyonu, KIRMIZI görüldü, geri alındı) + manuel `ccusage session` çapraz kontrolü |
| ZB2 | Z2 yapısal ağ çiti | Birim: modül grafiği taraması + 5 kalıcı negatif-kontrol (import/fetch/dinamik import) |
| ZB3 | Z3 salt-okunurluk | Birim: before/after `snapshotDir` tam eşitlik + "MUTASYON emsali" testi |
| ZB4 | Z4 üç veri kaybı | Birim: format-değişimi / `file_read_failed` / `truncated` senaryoları ayrı ayrı `degraded:true` + sayaç > 0 |
| ZB5 | Z5 dar genişlik | E2E: `clippedVisibleWidth` ile 280/320/375/480/640/700/767px, anlamlı asgari eşik |
| ZB6 | Z6 başlıklar | Web birim: başlık satırı DOM'da; E2E: 320px'te proje sütunu boş DEĞİL |
| ZB7 | Z7 README | Elle okunabilirlik (dokümantasyon, otomatik test yok) |

---

## 5. Düzeltme turu 2 (`docs/qa/F-011-2026-09-10-tur2.md`, KALDI → bu turun düzeltmeleri)

CEO kararları AA1-AA4 (+ nit). Ne yapılacağı ve nasıl doğrulanacağı:

| # | Ne yapılacak | Nasıl doğrulanacak |
|---|---|---|
| AA1 | Ağ çiti KARA LİSTEDEN BEYAZ LİSTEYE geçirilir (`network-capability-guard.test.ts`): `src/features/usage/server/**` yalnızca `fs`/`path` (bare veya `node:` önekli) import edebilir; `createRequire(`/`require(`/`process.binding(`/`eval(`/`Function(` metinsel olarak (import'tan bağımsız) yasaklanır. Ayrıca `usage-aggregator.test.ts`'e GERÇEK bir yerel `http.createServer` dinleyicisi + gerçek `computeUsageReport` çağrısıyla çalışma-zamanı negatif kontrolü eklenir. | Birim: N1 (`createRequire(...)('node:http').get(...)`) ve N2 (`process.binding('tcp_wrap')`) kalıcı `it()` sondaları + beyaz listeyi gevşetme mutasyonu (5 test KIRMIZI, elle doğrulandı) + gerçek dinleyici testi. |
| AA2 | `usage-aggregator.ts`'teki guard-çağrısı `catch`'i EPERM/EACCES/EBUSY'yi (kalıcı erişim reddi) diğer tüm hatalardan (yarış durumu, ör. ENOENT) ayırır; yalnızca ilki `unreadable_file_count`'u artırır. `fs.statSync`'in KENDİ `catch`'i (Y8'in kabul ettiği TOCTOU) DEĞİŞMEDEN kalır. | Birim: `fs.realpathSync.native` EPERM mock'u (mutasyonla KIRMIZI doğrulandı) + gerçek `icacls /deny "(RA,RD,RX)"` testi (`it.skipIf(win32 değilse)`) + ENOENT-yarış-durumu regresyon testi (sayılmamalı). |
| AA3 | "Tanınan" oranı İKİ bağımsız eşiğe ayrılır: bozuk JSON oranı (`%1`, yalnızca `lines_bad`) ve "tanınan tip" oranı (yalnızca `lines_ok` içinde, gerçek verideki ~%66,2 tabanın belirgin altına — `%50` — kalibre edilmiş, `unknown_type_lines` kullanır). `docs/03-ux.md` §6 önce güncellendi. | Birim: gerçek dağılımı taşıyan fixture (`degraded:false`) + tam format-değişimi fixture'ı (`degraded:true`, zaten vardı) + eşiğin gevşek olmadığını kanıtlayan sınır testi + eşik gevşetme mutasyonu (KIRMIZI, elle doğrulandı). |
| AA4 | `UsageScreen.tsx`'te başlık ve satır grid'leri artık AYNI SABİT genişlikli (`minmax(4.5rem,1fr)_5rem_5rem_5rem_6rem`) şablonu, AYNI `overflow-x-auto` kaydırma kabı içinde paylaşır — genişlik içerikten değil şablondan geldiği için ikisi HER ZAMAN pikselce hizalı, proje sütunu asla 0px'e çökmez. | E2E: 320px'te gerçekçi bir satırla (`usage-row-project` kırpılmış görünür genişliği > 0, başlıkla `boundingBox` karşılaştırması ±2px) + eski şablona geri alma mutasyonu (KIRMIZI, elle doğrulandı, QA'nın ölçtüğü 0px aynen tekrar üretildi). |
| nit | `App.tsx`'teki bayat `gap-1` yorumu `gap-0.5` (gerçek sınıf) olarak düzeltildi. | Görsel inceleme (davranış değişmedi). |

M1b (dedup anahtarının yalnızca `requestId`'ye düşürülmesi) QA tarafından **eşdeğer mutant** ilan
edildi (23.929 satırda `message.id`↔`requestId` 1:1, 0 çakışma) — ek çit GEREKMİYOR, bu tur
kapsamında dokunulmadı.

## 6. Riskler / açık kararlar (önceki turdan devam)

- Gün türetmenin dosya `mtime`'ına dayanması (yukarıda §1 madde 3) — gece yarısını aşan oturumlar
  tek güne yazılır. Kabul edilebilir sapma, wiki'ye not düşülecek.
- `agentType` dağılımı bu makinede yalnızca 5 değer gösterdi (`developer/qa-evaluator/explorer/
  ux/architect`) — başka bir makinede farklı persona adları (`spark`, `kraken`, …) çıkabilir; kod
  bunu SABİT bir listeyle KISITLAMAZ (herhangi bir string kabul edilir), bu yüzden risk yok.

## 7. Düzeltme turu 3 (`docs/qa/F-011-2026-09-10-tur3.md`, KALDI → bu turun tek maddesi, B1/AA1)

CEO kararı: AA1'in kalıcı yenilgi nedeni desen eksikliği değil, çitin kaynak metnini **sözdizimi
biçimi olarak** taraması (kılık değiştirmiş kara liste). Çözüm: metinsel `STATIC_IMPORT_RE` /
`BARE_SIDE_EFFECT_IMPORT_RE` yerine **gerçek TypeScript AST ayrıştırması** (`typescript` paketi
zaten `devDependencies`'te — yeni bağımlılık eklenmedi).

**Ne yapılacak:** `network-capability-guard.test.ts` içinde `ts.createSourceFile` ile her taranan
dosyanın AST'si kurulacak, `ts.forEachChild` ile tüm ağaç gezilecek ve şu düğüm tipleri modül
grafiğine/beyaz listeye tabi tutulacak:

- `ImportDeclaration` (`import x from '<spec>'`, `import '<spec>'`, çok satırlı — hepsi tek düğüm)
  — `importClause?.isTypeOnly` ise muaf (mevcut davranışla birebir).
- `ExportDeclaration` ile `moduleSpecifier` (`export { x } from '<spec>'`, `export * from '<spec>'`,
  `export * as ns from '<spec>'`) — düğümün kendi `isTypeOnly` alanı true ise (`export type {x}
  from '<spec>'`) muaf.
- Yorum içindeki sahte `import`/`export` metni AST'de düğüm ÜRETMEZ — ayrıştırma bunu doğası
  gereği yanlış pozitif üretmeden dışlar (regex'in taşımadığı bir garanti).

Beyaz liste (`ALLOWED_BARE_MODULES = {'fs','path'}`) ve dolaylı edinme yollarının metinsel taraması
(`createRequire(`/`require(`/`process.binding(`/`eval(`/`Function(`) ile `DYNAMIC_IMPORT_RE`/
`FETCH_CALL_RE` (blanket yasak, hedef modülden bağımsız) **AYNEN KALIR** — QA bunları yenemedi,
ikinci katman olarak korunuyor. Yalnızca "hangi import biçimleri modül grafiğine/beyaz listeye
girer" mekanizması regex'ten AST'ye geçiyor.

**Kapsam dışı (dokunulmadı):** `usage-aggregator.ts`, `handlers.ts`, `UsageScreen.tsx`, AA2/AA3/AA4
— yalnızca test dosyasındaki çit mekanizması değişiyor, ürün kodu değişmiyor.

| # | Davranış | Nasıl doğrulanacak |
|---|---|---|
| X1 | `export { get } from 'node:http'` (+ yerel `import { qaGet } from './x'`) KIRMIZI verir | Kalıcı `it()`: geçici dosyada `export { get as qaGet } from 'node:http'` → `violations.length > 0` |
| X2 | `export * from 'node:http'` da yakalanır | Kalıcı `it()` |
| X3 | `export type { X } from 'node:http'` MUAF (yanlış pozitif değil, tip-only) | Kalıcı `it()`, `violations` boş |
| X4 | Yorum içindeki sahte `export { x } from 'node:http'` metni YAKALANMAZ (yanlış pozitif yok) | Kalıcı `it()`, `violations` boş |
| Regresyon | 2. ve 3. turun tüm ağ sondaları (P1-P8, N1-N6, Y1/Y2/Y4, `import type` muafiyeti, transitif derinlik) KIRMIZI/YEŞİL durumunu KORUR | Aynı test dosyasındaki mevcut `it()`'ler değiştirilmeden çalıştırılır |
| Mutasyon | Beyaz listeyi gevşeten mutasyon (`ALLOWED_BARE_MODULES`'e `'http'` eklenir) hâlâ KIRMIZI verir | Elle mutasyon, KIRMIZI görülür, elle geri alınır (`git checkout` KULLANILMAZ) |

**Bitti tanımı:** X1-X4 + tüm regresyon testleri yeşil, mutasyon KIRMIZI, `npm run verify` ve
`npm run e2e` exit 0 (koşulan test sayısıyla raporlanır), feature notu `status: qa`.

## 8. Düzeltme turu 4 (`docs/qa/F-011-2026-09-10-tur4.md`, KALDI → bu turun tek maddesi, B1/AA1)

CEO kararı: AA1'in çitini bir daha sözdizimi analizine (nasıl yazıldığına) dayandırmıyoruz.
Kök neden dört kez tekrarladı (kara liste → modül adı kara listesi → regex beyaz liste → AST +
fail-open çözücü) ve ortak nokta hep "kodu OKUMA"ydı. Bu turda **davranışı ÖLÇEN** bir üst katman
ekleniyor; mevcut AST taraması kalıyor ama fail-closed'a çevriliyor ve artık ikincil/erken-uyarı
sayılıyor.

**Ne yapılacak (kapsam: yalnızca iki test dosyası, `usage/server/**` ürün kodu DOKUNULMAZ):**

1. **Birincil katman (yeni, `usage-aggregator.test.ts`):** `installNetworkCapabilitySentinel()` —
   `net.connect`/`net.createConnection`/`net.Socket.prototype.connect`, `tls.connect`,
   `http.request`/`http.get`, `https.request`/`https.get`, `dgram.createSocket`, `dns.lookup`/
   `dns.resolve`/`dns.promises.lookup`/`dns.promises.resolve`, `globalThis.fetch` — GLOBAL olarak
   kuşatılır (hedef host/port önemsiz). Her çağrı önce `calls` dizisine kaydedilir, sonra senkron
   olan için fırlatılır / asenkron (`fetch`, `dns.promises.*`) için reddedilmiş promise döner —
   "unhandled rejection" ya da yutulan hata durumunda bile ihlal `calls`'ta kalıcı kalır. Bu
   sonda kurulduktan sonra GERÇEK `computeUsageReport` gerçek fixture verisiyle (mock YOK)
   çalıştırılır; `calls` boş kalmalı VE rapor doğru üretilmeli (fonksiyonellik kırılmadığının
   kanıtı). Önceki "kendi rastgele portunu dinleyen sunucu" testi bu testle DEĞİŞTİRİLİR — QA
   §2.5'in bulgusu ("iki katman pratikte tek katmandı, çünkü ikinci katman yalnızca kendi
   portunu görüyordu") artık geçersiz çünkü yeni katman port'tan bağımsız.
2. **İkincil katman (mevcut AST taraması, `network-capability-guard.test.ts`, fail-closed'a
   çevrilir):** `resolveRelativeImport` artık `.js→.ts`, `.mjs→.mts`, `.cjs→.cts` eşlemesini de
   dener; hiçbir aday bulunamazsa (eskiden sessizce atlanan durum) dosya **İHLAL** sayılır.
   Giriş numaralandırması `.mts`/`.cts`'i kapsar ve alt dizinleri özyinelemeli tarar. "Körlük
   assert'i" dosya SAYISI yerine BEKLENEN KÜMEYE (`transcript-reader.ts` taranan kümede OLMALI)
   bağlanır.

**Kapsam dışı (dokunulmadı):** `usage-aggregator.ts`, `handlers.ts`, `UsageScreen.tsx` — yalnızca
iki test dosyasındaki çit mekanizması değişiyor, ürün kodu değişmiyor. Yeni bağımlılık eklenmedi
(`typescript` zaten `devDependencies`'te; `node:net`/`node:tls`/`node:dgram`/`node:dns` yerleşik).

| # | Davranış | Nasıl doğrulanacak |
|---|---|---|
| Birincil katman | Gerçek `computeUsageReport` çalışırken hiçbir ağ bağlantı noktası çağrılmaz | Kalıcı `it()` (`usage-aggregator.test.ts`), `sentinel.calls` boş + rapor doğru |
| V5/V6/V7 | `.js`/`.mjs`/`.cjs` uzantılı, önceden çözülemeyen relative import artık taranır | Kalıcı `it()`'ler (`network-capability-guard.test.ts`) |
| Fail-closed | Hiçbir adayla çözülemeyen relative import İHLAL sayılır | Kalıcı `it()` |
| Patlama yarıçapı | Mevcut bir importa yalnızca `.js` eklenmesi taramayı düşürmez | Kalıcı `it()` (QA §2.3 regresyonu) |
| Körlük assert'i | `transcript-reader.ts` taranan kümede OLMALI (sayı değil, küme) | Mevcut `it()` güncellendi |
| Mutasyon (a) | Birincil katmanı devre dışı bırakan/atlayan bir sızıntı davranışı KIRMIZI verir | Elle: sentinel aktifken gerçek bir ağ çağrısı enjekte edilir (V5 tarzı, geçici), KIRMIZI görülür, elle geri alınır |
| Mutasyon (b) | İkincil katmanın fail-closed'u geri sarılırsa (eski fail-open) V5 kalıcı testi KIRMIZI verir | Elle mutasyon, KIRMIZI görülür, elle geri alınır |
| Mutasyon (c) | Beyaz liste gevşetilirse (`ALLOWED_BARE_MODULES`'e `'http'`) hâlâ KIRMIZI | Elle mutasyon, KIRMIZI görülür, elle geri alınır |

**Bitti tanımı:** QA'nın tüm sondaları (P1-P8, N1/N5, Y1/Y2/Y4, X1-X5, V4-V9) KIRMIZI, yanlış
pozitif yok, üç mutasyon kanıtı verildi, `npm run verify` ve `npm run e2e` exit 0 (koşulan test
sayısıyla raporlanır), feature notu `status: qa`.

---

## Ek — tur 5 → tur 6 düzeltmesi (BB1/BB2, `docs/qa/F-011-2026-09-10-tur5.md`)

**Ne yapılacak (yine yalnızca iki test dosyası, `usage/server/**` ürün kodu DOKUNULMAZ):**

1. **BB1 — `usage-aggregator.test.ts`:** `installNetworkCapabilitySentinel`'in kendi öz-testi
   yoktu (`patch()`'i no-op yapan mutasyon 52/52 YEŞİL kalıyordu). Aynı `describe` içine bir
   **pozitif kontrol** testi eklenir: sentinel kurulduktan hemen sonra `net.connect`, `http.get`,
   `new WebSocket(...)`, `process.binding('tcp_wrap')`, `globalThis.fetch(...)` KASITLI olarak
   çağrılır; her biri "AĞ ÇİTİ İHLALİ" ile fırlamalı/reddetmeli VE `sentinel.calls` bu etiketlerin
   hepsini içermeli. `patch()` yardımcı fonksiyonu `new` ile çağrılabilsin diye ok fonksiyonundan
   normal `function`'a çevrilir (davranış aynı, yalnızca constructible olur — `WebSocket` için
   gerekli). Sentinel'e `globalThis.WebSocket`, `process.binding`, `process.dlopen` de eklenir.
2. **BB2 — `network-capability-guard.test.ts`:** N2'nin yanına, gerçekten derlenen ("yazılabilir")
   `process as unknown as { binding: … }` cast biçimini kullanan kalıcı bir negatif kontrol
   eklenir; bu biçimin metinsel tarayıcı tarafından **yakalanmadığı** açıkça belgelenir (bilinen,
   kabul edilmiş sınır) — asıl savunma artık BB1'deki sentinel'in `process.binding`'i doğrudan
   kuşatmasıdır. Mevcut N2 testi (literal `process.binding(` biçimi) değişmeden kalır.

**Kapsam dışı:** `src/features/usage/server/**` — hiçbir ürün dosyası değişmez. Yeni bağımlılık yok.

| # | Davranış | Nasıl doğrulanacak |
|---|---|---|
| BB1 pozitif kontrol | Sentinel kuruluyken kasıtlı çağrılar yakalanır | Yeni `it()`, `sentinel.calls` beklenen etiketleri içerir |
| BB1 mutasyon | `patch()` no-op yapılırsa yeni test KIRMIZI | Elle mutasyon, KIRMIZI görülür, elle geri alınır (`git checkout` YOK) |
| BB2 process.binding | Sentinel `process.binding`'i kuşatır | Yeni testteki `process.binding('tcp_wrap')` çağrısı KIRMIZI/throw verir |
| BB2 mutasyon | `process.binding` kuşatması kaldırılırsa yeni test KIRMIZI | Elle mutasyon, KIRMIZI görülür, elle geri alınır |
| BB2 N2 dürüstlüğü | Yazılabilir cast biçimi statik tarayıcıda yakalanmaz (belgelenmiş sınır) | Yeni kalıcı `it()`, `violations.length === 0` |
| WebSocket sondası | `new WebSocket(...)` kasıtlı çağrısı sentinel tarafından yakalanır | Yeni testte `toThrow(/AĞ ÇİTİ İHLALİ/)` |

**Bitti tanımı:** BB1 ve BB2 kapandı (üç mutasyon kanıtı: sentinel no-op, `process.binding`
kuşatması kaldırma, QA'nın `WebSocket` sondası — üçü de KIRMIZI), `npm run verify` ve
`npm run e2e` exit 0 (koşulan test sayısıyla raporlanır), yanlış pozitif ve M5 için karar yazılı,
feature notu `status: qa`.

---

## Ek — tur 6 kapanış düzeltmesi (CC1/CC2, `docs/qa/F-011-2026-09-10-tur6.md`)

**Ne yapılacak (yine yalnızca test dosyaları, `usage/server/**` ürün kodu DOKUNULMAZ):**

1. **CC1 — BLOKLAYICI, yakalanmış-referans sızıntısı:** QA canlı kanıtladı — `process.binding`/
   `process.dlopen` referansı ürün modülü (`usage-aggregator.ts`) YÜKLENİRKEN (modül gövdesinde)
   yakalanırsa, sentinel test GÖVDESİ içinde (yani ürün import'undan SONRA) kurulduğu için o
   referansı hiç göremez; `tsc`/`eslint`/`vitest` (1305/1309) hepsi yeşil kalırken bağımsız
   dinleyiciye 111 gerçek TCP+HTTP isteği gitti. Düzeltme: yeni bir dosya
   (`tests/features/usage/server/network-precapture-sentinel.ts`) `process.binding`/
   `process.dlopen`'ı, ürün modülü değerlendirilmeden ÖNCE, kayıt eden ama fırlatmayan (orijinale
   delege eden) bir sarmalayıcıyla değiştirir; bu modül `usage-aggregator.test.ts`'in **İLK**
   import'u olur (ESM değerlendirme sırası garantisiyle ürün modülü artık yamalı referansı
   yakalar). Ana negatif testte (`AA1 tur 4` testi) `qaPreCalls`'ın boş olduğu da iddia edilir.
   `network-capability-guard.test.ts`'teki N2b yorumu, garanti cümlesini *"çağrı anında arama
   yapan biçimler için"* diye daraltacak şekilde düzeltilir (yakalanmış-referans biçimi için asıl
   savunma artık bu yeni precapture modülüdür, sentinel değil).
2. **CC2 — önemli, aynı kökten:** ana negatif testin `sentinel.calls` iddiası bugün
   `sentinel.restore()`'dan SONRA yapılıyor; `restore()` gelecekte `calls`'ı temizleyen bir
   mutasyona uğrarsa (`calls.length = 0`) bu iddia sessizce anlamsızlaşır. Düzeltme: `calls`'ın
   bir anlık görüntüsü `restore()` ÇAĞRILMADAN ÖNCE alınır ve asıl iddia o anlık görüntü
   üzerinden yapılır — assert artık `restore()`'un davranışına bağımlı değil.

**Kapsam dışı:** `src/features/usage/server/**` — hiçbir ürün dosyası değişmez. Yeni bağımlılık
yok.

| # | Davranış | Nasıl doğrulanacak |
|---|---|---|
| CC1 precapture | `process.binding`/`process.dlopen` ürün modülünden ÖNCE kuşatılır | Yeni modül `usage-aggregator.test.ts`'in ilk import'u; ana negatif test `qaPreCalls` boş iddia eder |
| CC1 mutasyon | Sarmalayıcı ürün import'undan SONRAYA alınırsa (ya da precapture modülü kaldırılırsa) QA'nın yakalanmış-referans sondası KIRMIZI | Elle mutasyon (QA'nın §1.3 kod-yolu), KIRMIZI görülür, elle geri alınır |
| CC1 yanlış pozitif yok | Sonda yokken 54/54 yeşil | `npx vitest run tests/features/usage/server` |
| CC2 mutasyon | `restore()` içine `calls.length = 0` eklenirse ana negatif test KIRMIZI | Elle mutasyon, KIRMIZI görülür, elle geri alınır |
| Regresyon | Beş `patch(...)` satırından biri kaldırılırsa pozitif kontrol KIRMIZI (tur 5'in doğruladığı 5/5) | Elle mutasyon, KIRMIZI görülür, elle geri alınır |

**Bitti tanımı:** CC1 ve CC2 kapandı (üç mutasyon kanıtı: sarmalayıcıyı ürün import'undan sonraya
alma, `restore()`'da `calls` temizleme, beş `patch()` satırından birini kaldırma — üçü de
KIRMIZI), N2b yorumu daraltıldı, `npm run verify` ve `npm run e2e` exit 0 (koşulan test
sayısıyla raporlanır), yanlış pozitif yok, feature notu `status: qa`.
