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

## 4. Riskler / açık kararlar

- Gün türetmenin dosya `mtime`'ına dayanması (yukarıda §1 madde 3) — gece yarısını aşan oturumlar
  tek güne yazılır. Kabul edilebilir sapma, wiki'ye not düşülecek.
- `agentType` dağılımı bu makinede yalnızca 5 değer gösterdi (`developer/qa-evaluator/explorer/
  ux/architect`) — başka bir makinede farklı persona adları (`spark`, `kraken`, …) çıkabilir; kod
  bunu SABİT bir listeyle KISITLAMAZ (herhangi bir string kabul edilir), bu yüzden risk yok.
