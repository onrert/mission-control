---
feature: F-010
title: Feature thread görünümü (docs/qa birincil, transkript best-effort)
author: developer
status: approved
date: 2026-09-09
---

# F-010 Sözleşmesi — Feature thread görünümü

Kod yazılmadan önceki "ne yapılacağı + nasıl doğrulanacağı" sözleşmesi (`CLAUDE.md` §"Sözleşme").

Kaynaklar: `docs/features/F-010-thread-gorunumu.md` (5 AC), `docs/03-ux.md` ekran 5 + akış (g),
`docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md` (karar 2), `docs/02-architecture.md`
§6.5/§9, `docs/blockers.md` (F-009'dan taşınan 5 borç, madde 5 = W2), `CLAUDE.md` "Öğrenilen
kurallar" (tamamı).

Kod okunarak doğrulandı (✓ VERIFIED): `src/features/thread/server/transcript-reader.ts`,
`src/features/kanban/server/{feature-detail,read-guard,parse-feature,handlers}.ts`,
`src/server/index.ts` (dağıtıcı/route sırası, `/api/health` sayaçları), `src/web/App.tsx`
(sekme çubuğu, `TabScreen` union), `src/features/gates/web/{GatesScreen,ProjectSelect,useGates}.ts`
(tek-proje seçim deseni), `src/features/kanban/web/{FeatureDetailModal,useFeatureDetail}.ts`
(katlanabilir `<details>` + tek kaydırma bağlamı deseni), `tests/helpers/manifest.ts`,
`tests/features/kanban/server/feature-detail.test.ts` (manifest testi deseni, ÖNCE fotoğraf),
`tests/integration/features-api.test.ts` (server test harness).

---

## 1. Kapsam

**İçinde:**
1. Yeni salt-okunur uç: `GET /api/thread/detail?project_id=…&file=…` (mimari §6.5'in önerdiği
   `feature_id` parametresi yerine `file` kullanılır — F-013'ün `/api/features/detail` deseniyle
   tutarlı, çünkü `id` frontmatter'dan türetiliyor ve dosya adıyla birebir eşleşmeyebilir; sapma
   raporda gerekçelendirilecek).
2. `src/features/thread/server/thread-detail.ts` — `buildThreadDetail()`: **W1 — ikinci bir okuma
   yolu KURULMAZ.** `buildFeatureDetail()` (F-013) doğrudan çağrılır (body/contract/qa_reports);
   bu üçü sırasıyla "CEO brief" / "Developer raporu" / "QA kararı" bölümlerine dönüştürülür.
   `docs/qa/latest.md` ESKALE kontrolü için `resolveInsideRootForRead` (F-013) doğrudan
   kullanılır. Transkript zenginleştirmesi için `transcript-reader.ts`'in (F-009, bu feature'ın
   sahipliğinde) `findAllowedTranscriptDirectories`/`readAllowedTranscript` fonksiyonları
   kullanılır.
3. **W2 — `createTranscriptReaderStatsTracker().record()` bağlanır.** `src/server/index.ts`
   zaten oluşturduğu `transcriptReaderStats` örneğini yeni handler'a da geçirir (aynı örnek,
   `/api/health` ile PAYLAŞILIR). Her gerçek transkript okumasından sonra `.record()` çağrılır.
4. `src/features/thread/web/{ThreadScreen,useThreadDetail,useProjectFeatureList}.tsx|ts` —
   proje + feature seçici, kronolojik bölüm listesi, ESKALE rozeti, "Bu bölüm okunamadı." kartı.
5. **W9 — sekme bağlantısı:** `src/web/App.tsx`'e asgari dokunuş — `TabScreen` union'ına
   `'thread'` eklenir, `buildTabs()` Kapılar'dan sonra koşulsuz "Thread" ekler (Kapılar emsali —
   Sohbet'in aksine bir sunucu bayrağına bağlı değil), yeni `tabpanel` eklenir. Kapalı küme çiti
   (`tests/web/App.test.tsx`, `tests/web/App.chat-tab.test.tsx`) yeni sayıya güncellenir.
6. `docs/03-ux.md` ekran 5 mockup'ındaki ESKALE banner metni netleştirilir: mockup'taki
   "3 QA turu aşıldı … (2026-09-10)" örnek/illüstratif veridir (dosyada elimizde yalnızca
   `ESKALE: true/false` booleanı var, tur sayısı/tarih PARSE EDİLMEZ) — sabit, veriyle tutarlı
   bir rozet metni yazılıp koda BİREBİR aynen uygulanır (W8).

**Dışında:**
- Token Kullanımı ekranı (F-011).
- `record()`'un `/api/usage` tarafından tüketilmesi (F-011'in konusu).
- Canlı (SSE) güncelleme — Durum tasarımı tablosu Thread için "Uygulanmaz (salt okunur, istek
  bazlı)" diyor; yalnızca proje/feature değişince veya "Tekrar dene"ye basılınca yeniden çekilir.
- `docs/qa/latest.md`'nin QA turu sayısını/tarihini metinden ayrıştırmak (serbest metin, kırılgan
  — kapsam dışı, yalnızca boolean ESKALE kullanılır).

## 2. Dosya sahipliği

Feature notundaki liste: `src/features/thread/**`, ilgili testler, `docs/03-ux.md`.
Ek (CEO brief'inde açıkça yetkilendirilmiş, gerekçeli):
- `src/server/index.ts` — yeni route + `transcriptReaderStats`'i yeni handler'a geçirme (F-013'ün
  `/api/features/detail`'i eklerken aynı dosyaya dokunduğu emsal; başka hiçbir satır değişmez).
- `src/web/App.tsx` — brief'in kendisi "asgari dokunuş" olarak yetkilendiriyor (sekme + panel).
- `src/shared/types.ts` — `ThreadSection`/`ThreadDetail` (her geçmiş feature'ın eklediği ortak
  sözleşme dosyası, F-002'den beri süregelen emsal).
- `tests/web/App.test.tsx`, `tests/web/App.chat-tab.test.tsx` — App.tsx değişikliğinin doğrudan
  sonucu (kapalı küme sayısı 3→4, 4→5).

**Dokunulmayacaklar:** `src/features/kanban/server/{feature-detail,read-guard,parse-feature}.ts`
(yalnızca import edilir), `src/features/thread/server/transcript-reader.ts` (F-009'un kodu
DEĞİŞTİRİLMEZ, yalnızca tüketilir).

## 3. Veri modeli ve mimari kararlar

### 3.1 Bölüm eşlemesi (kaynak sınırlılığı nedeniyle)

Elimizdeki TEK iki dosya kaynağı `docs/qa/<id>-contract.md` (developer'ın kod öncesi yazdığı
sözleşme) ve `docs/qa/<id>-*.md` (qa-evaluator'ın raporları). Ayrı bir "developer raporu" dosyası
YOK (developer'ın asıl raporu `docs/progress.md`'dedir, feature notu dosya sahipliği dışında ve
tek bir feature'a temiz şekilde bölünemez). Bu yüzden:
- **CEO brief** ← `docs/features/<file>.md` gövdesi (zaten CEO tarafından yazılır, mockup'ın
  rolüyle birebir örtüşür).
- **Developer raporu** ← `docs/qa/<id>-contract.md` (sözleşme, "ne yapacağım" — developer
  yazarı, mockup'ın rolüne en yakın gerçek dosya).
- **QA kararı** ← her `docs/qa/<id>-*.md` (contract HARİÇ), mtime artan sırayla — birden fazla
  tur varsa hepsi ayrı bölüm olarak listelenir (mockup'ın "düzeltme turu tekrarları aynı sırayla"
  ifadesiyle örtüşür).

Bu, ADR-007 karar 2'nin "birincil kaynak `docs/qa/*`" ifadesinin TEK mantıklı, yeni dosya
icat etmeyen okunuşudur.

### 3.2 Transkript zenginleştirmesi (best-effort, tek bölüm)

Belirli bir QA turunu belirli bir transkript dosyasına eşleyecek güvenilir bir bağ YOK (hiçbir
docs/qa dosyası `transcript_path`/`session_id` taşımıyor, grep ile doğrulandı). Karpathy §2
(gereksiz karmaşıklık yok) gereği, mtime/agentType eşleştirmesi gibi kırılgan bir sezgisel kurmak
yerine: seçili projenin `~/.claude/projects/<kodlanmış>/` dizinindeki EN SON değiştirilen üst
düzey (`subagents/` içinde OLMAYAN) `.jsonl` dosyası okunur, toplam giriş/çıkış token sayısı tek
bir "Transkript" bölümü olarak (her zaman EN SONDA) gösterilir. Dizin/dosya yoksa, okuma
başarısızsa veya hiç geçerli satır yoksa (`lines_ok === 0`) bölüm `readable:false` ("Bu bölüm
okunamadı.") olur — AC2/AC3'ün istediği tam olarak budur, W4'ün istediği gibi diğer bölümler
etkilenmez.

### 3.3 ESKALE (AC4)

`docs/qa/latest.md` okunur (`resolveInsideRootForRead`, F-013 deseni). İçerik bu feature'a mı ait
kontrol edilir (frontmatter `feature: <id>` VEYA ilk `# ` başlığında `<id>` geçmesi) — aksi halde
başka bir feature'ın ESKALE'si yanlışlıkla gösterilebilir. Eşleşme + `ESKALE: true` satırı varsa
`eskale:true`.

### 3.4 `/api/thread/detail` hata durumları

`buildFeatureDetail` ile birebir aynı: `not_found` (dosya yok), `invalid_path` (kök dışı/symlink).
`project_id` bulunamazsa 404 `not_found` (F-013 handler deseni).

## 4. UI

- `ThreadScreen.tsx`: üstte Proje + Feature `<select>` (Gates'in `ProjectSelect` desenini
  TEKRARLAR, import ETMEZ — tek tüketicili bileşen, Karpathy §2, `read-guard.ts`/`write-gate.ts`
  emsali). Feature listesi `GET /api/features?project_id=` (F-007, mevcut) ile doldurulur.
- Bölümler kronolojik sırayla, sol kenarlık rengiyle ayrılır (mockup: CEO brief `sky`, Developer
  raporu `amber`, QA kararı `cyan`, Transkript `zinc`). Her bölüm `<details>` (F-013/K5 deseni,
  gövde varsayılan açık, geri kalanı kapalı) — **W7: iç içe kaydırma kutusu YOK**, TEK kaydırma
  bağlamı ekranın dış kabı (`tabIndex={0}`, F-013/K5-K6 dersi).
- ESKALE rozeti `eskale:true` iken üstte sabit banner.
- Durum tasarımı tablosuna birebir uyum: boş/yükleniyor/hata/okunamadı durumları `docs/03-ux.md`
  satırındaki metinlerle AYNI.

## 5. Doğrulama planı

- **Birim:** `tests/features/thread/server/thread-detail.test.ts` — bölüm eşlemesi, ESKALE
  eşleştirme (doğru/yanlış feature id), transkript enrichment (dizin yok / dosya yok / bozuk
  format / geçerli), `record()`'un GERÇEKTEN çağrıldığının ölçümü (sahte tracker enjekte edilir).
- **Salt okunurluk (W3):** `tests/features/thread/server/thread-read-only-manifest.test.ts` —
  `snapshotDir` ÖNCE alınır (F-013/Ö1 dersi), `buildThreadDetail` çağrılır, `after` ile TAM
  eşitlik.
- **Entegrasyon:** `tests/integration/thread-api.test.ts` — gerçek HTTP, `MC_CLAUDE_PROJECTS_ROOT`
  env override ile sahte `.claude/projects` kökü enjekte edilir; 200/404/400 yolları, ESKALE,
  transkript enrichment, `/api/health.transcript_reader` sayaçlarının GERÇEKTEN arttığı.
- **Web birim:** `tests/features/thread/web/ThreadScreen.test.tsx` — bölüm render'ı, okunamadı
  kartı, ESKALE rozeti, proje/feature seçimi.
- **App.tsx:** `tests/web/App.test.tsx`/`App.chat-tab.test.tsx` kapalı küme sayıları güncellenir.
- **E2E:** `tests/e2e/thread.spec.ts` — gerçek proje ekleme, sekme açma, bölüm görünürlüğü, dar
  genişlik (320/375/480, `clippedVisibleWidth`, F-007/F-013 dersi — `toBeVisible()` KULLANILMAZ),
  tek kaydırma bağlamı (iç içe `overflow` kabı sayısı ölçülür).
- **Mutasyon (en az 5, brief'in zorunlu kıldığı 5 dahil):**
  1. W2 — `.record()` çağrısı kaldırılır → sayaç testi KIRMIZI.
  2. W3 — `buildThreadDetail` içine geçici bir `fs.writeFileSync` eklenir → manifest testi KIRMIZI.
  3. W4 — transkript bulma/okuma tamamen devre dışı bırakılır (`findAllowedTranscriptDirectories`
     sahte olarak `[]` döndürülür) → CEO brief/contract/QA bölümleri HÂLÂ yeşil/dolu kalmalı.
  4. W5 — transkript okumasında fırlayan bir hata (`readAllowedTranscript` sahte throw) UI'a ham
     mesaj sızdırırsa → "ham hata sızmaz" testi KIRMIZI.
  5. W6 — ESKALE eşleştirmesi (feature id kontrolü) kaldırılır → yanlış feature'a rozet sızma
     testi KIRMIZI.
  Her biri uygula → KIRMIZI gözlemle → geri al.

## 6. Riskler / bilinçli kapsam dışı

- Transkript enrichment yalnızca "en son değiştirilen tek dosya" — belirli bir QA turuna özel
  değil (§3.2 gerekçesi). Kullanıcı yanlış izlenimle "bu QA turunun transkripti bu" diye
  düşünmesin diye UI metni GENEL tutulur ("Bu proje için en son görülen oturum…"), belirli bir
  bölüme bağlanmaz.
- ESKALE badge metni mockup'taki illüstratif "3 QA turu aşıldı (tarih)" yerine sabit, veriyle
  tutarlı bir cümle kullanır (§1 madde 6).

---

## Düzeltme turu 1 (2026-09-10) — QA KALDI kararına (`docs/qa/F-010-2026-09-10.md`) yanıt

CEO'nun bağlayıcı kararları (X1-X6) doğrudan uygulanır; her biri için "ne yapılacak + nasıl
doğrulanacak" aşağıda. Dosya sahipliği DEĞİŞMEDİ (`src/features/thread/**`, ilgili testler,
`docs/03-ux.md`; X3 için `src/web/App.tsx`'e asgari CSS dokunuşu, sözleşmenin §1 madde 5/W9'unun
zaten yetkilendirdiği aynı dosya).

1. **X1/B1 — `readAllowedTranscript` + `statsTracker.record` çağrısı `buildTranscriptSection`
   içinde TEK bir `try/catch` ile sarılır**, `catch → unreadableTranscriptSection()`.
   **Doğrulama:** (a) birim test — `fs.realpathSync.native`'i `vi.spyOn` ile EPERM fırlatacak
   şekilde sahteleştirip diğer üç bölümün (`ceo_brief`/`developer_report`) dolu kaldığını,
   transkriptin `readable:false` olduğunu ölçmek; (b) aynı senaryo `tests/integration/
   thread-api.test.ts`'te gerçek HTTP üzerinden — yanıt **200** olmalı (500 DEĞİL), transkript
   bölümü okunamadı. (c) mutasyon: sarmalayıcı kaldırılınca bu iki test KIRMIZI vermeli; ayrıca
   düzeltmeyi birebir geri saran ikinci mutasyon (`catch` → `throw err`) de elle uygulanıp
   KIRMIZI görülüp geri alınacak (kalıcı test değil, elle doğrulama — CLAUDE.md deseni).

2. **X6/Ö1 — `degraded`/`lines_bad` arayüze taşınır.** `access.result.degraded` true iken
   transkript içeriğinin sonuna sabit bir uyarı cümlesi eklenir (metin önce `docs/03-ux.md`
   ekran 5'e, sonra `buildTranscriptSection`'a yazılır) — bölüm yine `readable:true` kalır
   (ADR-007'nin "oran düşerse UI 'veri eksik olabilir' uyarısı gösterir" azaltımı). Ayrı bir
   `ThreadSection` alanı EKLENMEZ (Karpathy §2 — metne gömmek yeterli, mevcut sözleşmeyi
   bozmuyor). `lines_ok === 0` dalı (bölüm tamamen okunamaz) DEĞİŞMEZ. **Doğrulama:** (a) 1
   geçerli + 1 bozuk satırlı fixture'da içerik uyarı cümlesini içeriyor mu; (b) YALNIZCA bozuk
   satır içeren (lines_ok=0) yeni bir fixture'da bölüm `readable:false` — bu, M10 mutasyonunun
   (dalın silinmesi) artık KIRMIZI vermesini sağlayan eksik testi kapatır.

3. **X2/Ö4 — ESKALE deseni yalnızca "başlık bloğu"nu tarar** (ilk frontmatter sınırlayıcısından
   (`---`) önceki satırlar; yoksa ilk 5 satır) — gövdedeki alıntılanmış kod bloğu artık asla
   eşleşmez. Anchor'lar (`^…$`/`m`) KORUNUR (ikinci savunma katmanı — başlık bloğu içinde bile
   "ESKALE: true" bir cümlenin PARÇASI olarak geçerse anchor'sız desen yanlış eşleşir).
   **Doğrulama:** (a) Ö4'ün kendi reprosu (gerçek `ESKALE: false` başlığı + gövdede alıntılanmış
   `ESKALE: true` kod bloğu) → `eskale:false`; (b) başlık bloğu İÇİNDE "ESKALE: true" ifadesi bir
   cümlenin parçası olarak geçen (ör. "önceki turda ESKALE: true idi") ama gerçek satırı
   `ESKALE: false` olan bir fixture → anchor'lar KALDIRILINCA (M11) KIRMIZI verir, anchor'lı
   haliyle YEŞİL.

4. **X3/Ö2+Ö3 — dar genişlik.** (a) `ThreadScreen.tsx`'teki Proje/Feature `<select>`'lerine
   sınırlı genişlik + `truncate` (`min-w-0 max-w-full`, sabit `w-*`) eklenir — 320/375/480px'te
   `thread-screen.scrollWidth === clientWidth` olur (yatay hayalet kaydırma biter, Ö3).
   (b) `App.tsx`'in sekme çubuğunda YALNIZCA dar genişlikte (`sm:` altı) geçerli responsive
   CSS (küçültülmüş `gap`/`text-xs`) ile 320/375/480px'te 5 sekmenin TAMAMI (üretim varsayılanı,
   sohbet açık) kırpılmadan (>0px) erişilebilir olur (Ö2) — metin/etiket/yapı DEĞİŞMEZ, yalnızca
   boyut/boşluk. **Doğrulama:** `tests/e2e/thread.spec.ts`'e YENİ bir dar-genişlik bloğu eklenir;
   bu blok `GET /api/chat/status`'u `page.route` ile `chat_enabled:true` döndürecek şekilde
   sahteleştirir (gerçek, ücretli bir model çağrısı YOK — sözleşme §I2/`session.ts` "uygulama
   açılışı sıfır model çağrısı yapar" garantisi; yalnızca durum yanıtı sahteleştiriliyor, hiçbir
   mesaj gönderilmiyor) — böylece paylaşılan `playwright.config.ts` `MC_CHAT_ENABLED:'0'`
   webServer'ına DOKUNMADAN (dosya sahipliği dışı, `shell.spec.ts`'in sabit "4 sekme" sayımını
   kırar) üretim sekme kümesi (5 sekme) gerçek tarayıcıda ölçülür. 320/375/480'de 5 sekmenin
   tamamı `clippedVisibleWidth > 0`.

5. **X5/Ö5+Ö6 — gerçek kronoloji + ayırt edici etiket.** `buildThreadDetail` artık
   `developer_report` + tüm `qa_verdict` bölümlerini (transkript HARİÇ, o her zaman sonda) tek
   bir dizide TOPLAYIP gerçek `mtime`'a göre artan sırada birleştirir (rol-sabit "önce sözleşme,
   sonra QA" varsayımı KALDIRILDI — AC1'in "kronolojik" sözü artık gerçek zaman damgasına
   dayanıyor, F-012'nin gözlemlenen geriye-gidiş vakası bir daha olmaz). `ceo_brief` her zaman
   ilk sırada kalır (kaynak belge farklı bir kategori — PRD F5/mockup'ın "CEO→dev→QA zinciri"
   anlatısı hâlâ CEO brief'in kökeni temsil ettiğini varsayar; sözleşmenin kapsam dışı bıraktığı
   bir CEO kararı olmadıkça bu değişmez). Her `qa_verdict` başlığına dosya adı eklenir (Ö6) —
   `QA kararı: KALDI (F-012-2026-09-06-tur3.md)` gibi — aynı görünen bölümler artık ayırt
   edilebilir. **Doğrulama:** contract mtime'ı QA raporlarından SONRA olacak şekilde kurulmuş bir
   fixture'da (F-012'nin gerçek deseni) `developer_report`'un ilgili `qa_verdict`'lerden SONRA
   geldiğini ölçen yeni bir test; sıralamayı bozan (mtime karşılaştırmasını kaldıran) mutasyon bu
   testte KIRMIZI. Başlık testi: iki `qa_verdict` bölümünün başlıklarının dosya adlarıyla
   birbirinden ayrıldığını ölçer.

6. **X4 — M7/M8/M10 çitleri.** `tabIndex={0}` (M7) ve `title` ipucu (M8) için gerçek klavye
   odağı ölçen E2E assert'i (`page.keyboard.press('Tab')` + `document.activeElement`, CLAUDE.md
   dersi — `.focus()` KULLANILMAZ); M10 çiti madde 2'de kapanıyor. Kapanınca `docs/blockers.md`
   N6 maddesi (2026-09-08) güncellenip kapatılır — teknik NOT, Kanban'daki (`kanban.spec.ts`)
   AYNI SINIFTAN ayrı örnek bu turda değiştirilmedi (dosya sahipliği dışı), yalnızca aynı doğru
   ölçüm tekniğinin artık bu depoda ikinci kez KANITLANDIĞI not düşülür.

**Kapsam dışı (bu turda DEĞİŞMEZ):** Ö7 (feature listesi hata durumu — QA raporunda "ÖNEMLİ"
ama CEO'nun X1-X6 listesinde YOK, brief'in dosya sahipliği/görev listesi bunu içermiyor; varsayım
yapmadan atlanıyor, gerekirse ayrı madde olarak sorulur), D3 (transcript-reader.ts bayat yorumu —
o dosya F-010'un sahipliği dışında, "DEĞİŞTİRİLMEZ" kararı hâlâ geçerli), D5 (çift okuma
optimizasyonu — kozmetik, brief'te yok).
