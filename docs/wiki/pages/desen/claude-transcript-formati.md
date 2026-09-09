---
type: desen
updated: 2026-09-09
sources: [docs/features/F-009-transkript-spike.md, docs/02-architecture.md §9, docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md, docs/qa/F-009-contract.md, src/features/thread/server/transcript-reader.ts, docs/qa/F-011-contract.md, src/features/usage/server/usage-aggregator.ts]
---
# Claude Code transkript formatı (`~/.claude/projects/**/*.jsonl`) — gözlem + tekrarlanacak kontrol listesi

Bu format **belgesiz ve sürümle değişebilir** (`docs/00-idea-validation.md` risk (b), ADR-007).
Bu sayfa "format şudur" demez — **bu makinede, bu sürümde gözlemlenen** durumu kaydeder ve her
Claude Code güncellemesinden sonra **tekrarlanacak** bir doğrulama adımı tarif eder. Aşağıdaki
her iddia ✓ DOĞRULANDI (dosya okunarak), ⊢ ÇIKARIM veya [T] TAHMİN olarak işaretlenmiştir.

## Gözlem anı ve sürüm

- **Tarih:** 2026-09-09.
- **Kurulu CLI sürümü** (`claude --version`): **2.1.205 (Claude Code)**. ✓ DOĞRULANDI (komut
  doğrudan çalıştırıldı).
- **Transkriptlerin kendi `version` alanı ÜÇ farklı değer taşıyor, TEK bir değer DEĞİL.**
  QA düzeltme turu (U5, BLOKLAYICI) — önceki `✓ DOĞRULANDI (217 dosyanın tamamında aynı değer)`
  iddiası **YANLIŞTI**: o ölçüm tek bir dosyanın ilk satırından okunmuştu, `version` alanı hiç
  toplu sayılmamıştı. Bu turda (2026-09-09, aynı gün) **tam tarama** tekrarlandı:
  `find ~/.claude/projects/C--dev-apps-mission-control -name '*.jsonl' -print0 | xargs -0 grep
  -oh '"version":"[^"]*"' | sort | uniq -c` → **219 dosya, 47.396 satırda `version` alanı**:

  | `version` | satır sayısı |
  |---|---:|
  | `2.1.260` | 45.494 (baskın, ~%96) |
  | `2.1.261` | 1.894 |
  | `2.1.205` | 8 |

  ✓ DOĞRULANDI (219 dosyanın TAMAMI tarandı — round-2'nin bu turdaki anı, içerik hiçbir yere
  kopyalanmadı, yalnızca alan sayıları). **Baskın değer `2.1.260`** — önceki turun tek iddia ettiği
  `2.1.261` aslında
  AZINLIKTA (%4). Ayrıca `2.1.205` — **kurulu CLI sürümünün kendisi** (`claude --version` →
  `2.1.205 (Claude Code)`, aynı gün ✓ DOĞRULANDI) — transkript içinde de 8 satırda geçiyor. Bu,
  önceki turun "transkript sürümü CLI'dan her zaman ayrı bir SDK/harness sürümüdür" ⊢ ÇIKARIM'ını
  ÇÜRÜTÜYOR: en azından bazı oturumlarda ikisi AYNI. ⊢ DÜZELTİLMİŞ ÇIKARIM: transkriptin `version`
  alanı, o satırı üreten Claude Code SÜRECİNİN o anki kendi sürümüdür (CLI güncellemesi sırasında
  eski süreçler eski sürüm yazmaya devam eder) — sabit bir "SDK sürümü ≠ CLI sürümü" kuralı YOK,
  gözlemlenen çoklu değer büyük olasılıkla art arda gelen CLI güncellemelerinin izidir. **Bir
  sonraki doğrulamada yine TAM tarama yap** (tek dosya örneklemesi YETMEZ — bu turun asıl hatası
  buydu), üç değeri de güncelle.

  **Round 3 notu (QA'nın bağımsız kontrolü, ~1 saat sonra):** aynı üç değer kümesi (2.1.260/
  2.1.261/2.1.205), farklı sayılar — 220 dosya, `2.1.260` 45.887 satır (+393), toplam 47.789
  (+393). Fark oturumun bu ölçümler arasında da büyümeye devam etmesinden; DEĞER KÜMESİ birebir
  aynı kaldı. Yukarıdaki "İncelenen kaynak" bölümündeki 217 ile birlikte üç farklı an: 217 (round-1)
  < 219 (round-2, bu tablo) < 220 (QA, round-2 kontrolü) — tutarlı, çelişkisiz büyüme.
- **İncelenen kaynak:** `C:\Users\pc\.claude\projects\C--dev-apps-mission-control\` altındaki
  **217 gerçek `.jsonl` dosyası** (ana oturum + `*/subagents/*.jsonl`), yalnızca `type` alanı
  sayıları ve `message.usage` alan adları toplandı (satır içerikleri bu sayfaya veya herhangi bir
  fixture'a **kopyalanmadı** — bkz. `tests/features/thread/transcripts-privacy-guard.test.ts`).
  ✓ DOĞRULANDI.
  **Sayım anı notu (round 3, QA Y2 bulgusu — "219/217 tutarsızlığı"):** bu 217 sayısı round-1'in
  (2026-09-09, kod turu) DAHA ERKEN taramasına ait. Aynı gün DAHA SONRA (round-2 düzeltme turu)
  `version` alanı taraması **219 dosya** buldu (aşağıya bakınız) — dizin canlı bir oturumun
  transkriptlerini içerdiği için dosya sayısı iki tarama arasında büyüdü. QA'nın kendi bağımsız
  ölçümü (round-2 raporu, ~1 saat sonra) **220 dosya** buldu. Üçü de ÇELİŞKİ değil — aynı büyüyen
  dizinin farklı anlardaki dürüst enstantaneleri (217 < 219 < 220, sıralı, tutarlı büyüme).
  Bir sonraki doğrulamada TEK bir taramayla üretilen sayı kullanılmalı, önceki turların sayısı
  "yanlış" değil "eski an" olarak okunmalı.

## Dosya yolu ve kodlama

- Ana oturum: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>.jsonl`. ✓ DOĞRULANDI (mimari
  §9.1'de daha önce doğrulanmıştı, bu turda tekrar gözlendi).
- Subagent: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>/subagents/agent-<id>.jsonl`
  (+ `agent-<id>.meta.json`). ✓ DOĞRULANDI.
- `<cwd>` kodlaması: sürücü iki noktası ve yol ayraçları (`\` veya `/`) `-` olur
  (`C:\dev\apps\mission-control` → `C--dev-apps-mission-control`). ✓ DOĞRULANDI.
- **Harf tutarsızlığı gerçek ve devam ediyor:** aynı `~/.claude/projects/` dizininde hem
  `C--dev-apps-mission-control` hem `c--Users-pc-Desktop-TrendPulseAI` (küçük sürücü harfi)
  bir arada gözlendi. ✓ DOĞRULANDI — **her eşleştirme harf duyarsız olmalı** (T3/T4 çitleri bunu
  uygular).

## Gözlemlenen üst seviye `type` değerleri (217 dosya, toplam sayı)

| `type` | Sayı | Not |
|---|---:|---|
| `assistant` | 20687 | `message.usage` burada |
| `user` | 12168 | `message.content` string VEYA `tool_result` dizisi olabilir |
| `attachment` | 13445 | |
| `queue-operation` | 1074 | `enqueue`/`dequeue` |
| `agent-setting` | 649 | oturum başına bir kez |
| `last-prompt` | 635 | |
| `atis-latch` | 633 | |
| `system` | 361 | `subtype:"stop_hook_summary"` gözlendi |
| `mode` | 334 | `mode:"normal"` |
| `custom-title` | 343 | |
| `bridge-session` | 448 | |
| `permission-mode` | 2 | `permissionMode:"auto"` |
| `file-history-snapshot` | 2 | |

✓ DOĞRULANDI (tamamı gerçek dosyalardan sayıldı). **`summary` tipi bu turda HİÇ gözlenmedi** —
mimari §9.3'ün örnek listesi (`"user, assistant, system, summary, …"`) bunu bir olasılık olarak
anıyordu; okuyucu yine de `summary`'yi tanınan tip kümesine dahil eder (zararsız, gelecekte
görülürse hazır olsun diye) — [T] TAHMİN, doğrulanmadı.

**Sonuç (okuyucunun tasarım kararı):** `transcript-reader.ts` yalnızca `user`/`assistant`/
`system`/`summary`'yi "tanınan" sayar; yukarıdaki tablodaki geri kalan **9 tip** (ve gelecekte
çıkabilecek herhangi bir yeni tip) **atlanır ve sayılır** (`unknown_type_lines`) — throw etmez.

## `message.usage` alan adları (yalnızca `type:"assistant"`)

Gözlenen alanlar: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
`cache_read_input_tokens`, `cache_creation` (iç içe nesne: `ephemeral_1h_input_tokens`,
`ephemeral_5m_input_tokens`), `output_tokens_details.thinking_tokens`, `server_tool_use`,
`service_tier`, `inference_geo`, `iterations` (dizi, her eleman kendi `input_tokens`/
`output_tokens`/`cache_*` alanlarını tekrarlıyor), `speed`. ✓ DOĞRULANDI.

Okuyucu (`readTranscript`) yalnızca ADR-007 §9.4'ün belirttiği **dört** alanı toplar:
`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
Diğerleri (`iterations`, `cache_creation` iç nesnesi, `service_tier`, …) bu turda **kasıtlı
olarak toplanmıyor** — hiçbir AC/PRD kabul kriteri bunu istemiyor (Karpathy §2). F-011 (Token
ekranı) daha ayrıntılı kırılım isterse bu alanlar zaten satırda mevcut, yeni bir alan eklemek
yeterli olur.

## Örnek `user`/`assistant` gövde şekli (anonim, gerçek metin değil)

```json
{"type":"user","message":{"role":"user","content":"..."}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"...","is_error":true,"tool_use_id":"toolu_..."}]}}
{"type":"assistant","message":{"model":"...","usage":{"input_tokens":8,"output_tokens":60,"cache_creation_input_tokens":759,"cache_read_input_tokens":10629}}}
```
`user.message.content` **string YA DA dizi** olabilir (araç sonucu döndürülürken) — ✓ DOĞRULANDI.
Okuyucu şu an `user` tipini yalnızca "tanınan" sayar, içeriğini ayrıştırmaz (F-010'un işi).

## Tek bir yanıt BİRDEN FAZLA `assistant` satırına yazılır, `usage` TEKRARLANIR (F-011 QA düzeltme turu, 2026-09-10)

**BLOKLAYICI bulgu (QA, `docs/qa/F-011-2026-09-10.md` B1):** Claude Code tek bir asistan yanıtını
(tek bir API çağrısı) **birden çok** `type:"assistant"` satırı olarak yazar — yanıtın her içerik
bloğu (`text`, `thinking`, `tool_use`) kendi satırını alır — ve **her satır aynı, TAM
`message.usage` nesnesini taşır**. Aynı yanıta ait satırlar aynı `message.id` (satırın
`message.id` alanı) VE aynı üst-seviye `requestId` alanını (satırın kendisinde, `message` nesnesi
DIŞINDA) paylaşır. ✓ DOĞRULANDI — gerçek bir dosyada (`0510715b-…jsonl`) ardışık iki satırın
`topKeys`'i: `apiBlockIndex, cwd, entrypoint, gitBranch, isSidechain, message, parentUuid,
requestId, sessionId, timestamp, type, userType, uuid, version` — `requestId` KÖK seviyede,
`message.id` `message` nesnesinin içinde. `apiBlockIndex` alanı da gözlendi (blok sırasını
işaretliyor olabilir, F-011 bunu KULLANMADI — `message.id`+`requestId` çifti yeterli).

**Etki:** Okuyucu (`readTranscript`) her satırın `usage`'ını koşulsuz topladığı için tek bir API
çağrısı 2-3 kez sayılıyordu. QA'nın tam taramasında: 23.178 `assistant` satırı yalnızca 11.935
gerçek API çağrısına karşılık geliyordu (11.243 satır mükerrer, toplamın %50,32'si mükerrerlerden
geliyordu) → panelin token toplamı gerçek değerin **+%101,3** fazlasıydı (bağımsız üçüncü parti
araç `ccusage session`'ın verdiği toplamla karşılaştırıldı, %0,19 fark — `ccusage` panelin ÖNCEKİ
hatalı toplamını değil, DÜZELTİLMİŞ toplamı doğruladı).

**Düzeltme (Z1):** `readTranscript` artık aynı `message.id`+`requestId` çiftini taşıyan
satırlardan yalnızca İLKİNİN `usage`'ını sayar (`transcript-reader.ts`, dondurulmuş fixture
`tests/fixtures/transcripts/duplicate-usage.jsonl`). İkisinden biri eksik/boş olan (eski/bilinmeyen
biçim) satırlar ASLA başka bir satırla tekilleştirilmez — güvenli varsayılan her zaman saymaktır,
yalnızca KESİN bir eşleşme bulununca ikinci ve sonraki satırlar atlanır.

**Bir sonraki doğrulamada:** yeni bir gerçek dosyada bu grup büyüklüğü dağılımını (`1 satır`,
`2 satır`, `3 satır`, …) tekrar ölç, `apiBlockIndex`'in gerçekten blok sırasıyla birebir örtüştüğünü
doğrula (bu turda ÇIKARIM, tam doğrulanmadı).

## Dayanıklılık gözlemleri

- Gerçek dosya boyutları 97 bayt ile **9.3 MB** arasında değişiyor (bu oturumun kendi
  transkripti). ✓ DOĞRULANDI. 64 MB eşiği bu makinede hiç aşılmadı — okuyucunun kuyruk-kırpma
  davranışı sentetik (küçük eşikli) testlerle doğrulandı, gerçek 64 MB+ bir dosyayla **henüz**
  gözlenmedi. [T] TAHMİN: gerçek dünyada bu eşiğin aşılması uzun subagent zincirleriyle mümkün.
- BOM/CRLF: bu makinedeki gerçek dosyalarda gözlenmedi (hepsi LF, BOM'suz) — `bom-crlf.jsonl`
  fixture'ı **savunma amaçlı**, gerçek bir gözlemden değil, "Windows'ta bazı araçlar CRLF/BOM
  yazabilir" varsayımından üretildi. [T] TAHMİN.
- Kesik son satır: bu makinede gözlenmedi (muhtemelen bu dosyalar hep düzgün kapatılmış oturumlara
  ait). `truncated-last-line.jsonl` fixture'ı "yazma sırasında süreç kesilirse" senaryosunu
  **savunma amaçlı** simüle eder. [T] TAHMİN.

## Tekrarlanacak kontrol listesi (HER Claude Code güncellemesinden sonra)

Bu adımlar F-009'un `docs/qa/F-009-contract.md`'sindeki araştırma yönteminin özetidir —
elle tekrarlanabilir, kod yazmadan yapılır:

1. **Sürüm farkını ölç:** `claude --version` çalıştır, bu sayfanın "Kurulu CLI sürümü" satırıyla
   karşılaştır. Değiştiyse tarihle birlikte güncelle.
2. **Yeni bir gerçek `.jsonl` oluştur** (kısa bir oturum başlat, birkaç mesaj gönder) ve dosyanın
   kendi `version` alanını oku (`grep -o '"version":"[^"]*"' <dosya> | head -1`). Bu sayfanın
   "transkriptlerin kendi version alanı" satırıyla karşılaştır.
3. **Tip taraması tekrarla:** aşağıdaki script'i `~/.claude/projects/<bu-projenin-kodlanmış-adı>/`
   üzerinde çalıştır ve "Gözlemlenen üst seviye type değerleri" tablosuyla karşılaştır — **yeni
   bir tip çıktıysa** bu tablo satırı eklenerek güncellenmeli (okuyucunun kendisi zaten güvenli —
   yeni tip otomatik olarak `unknown_type_lines`'a düşer, throw ETMEZ).
   QA düzeltme turu (U6, B7) — önceki script `if False` dalında **hiç çalışmıyordu**
   (`None` değerlendirip çıktı üretmiyordu); alttaki, **bu turda gerçekten çalıştırılıp** çıktısı
   doğrulanan biçimdir:
   ```bash
   python3 -c "
   import json, glob, os
   d = os.path.expanduser('~/.claude/projects/C--dev-apps-mission-control')
   t = {}
   for f in glob.glob(os.path.join(d, '**', '*.jsonl'), recursive=True):
       with open(f, encoding='utf-8', errors='replace') as fh:
           for line in fh:
               if not line.strip():
                   continue
               try:
                   obj = json.loads(line)
               except Exception:
                   continue
               ty = obj.get('type') if isinstance(obj, dict) else None
               t[ty] = t.get(ty, 0) + 1
   for k in sorted(t, key=lambda x: -t[x]):
       print(k, t[k])
   "
   ```
   **Bu turda gerçekten koşturuldu (2026-09-09), gerçek çıktı** (219 dosya, 0 bozuk satır):
   `assistant 21123`, `attachment 13701`, `user 12422`, `queue-operation 1078`,
   `agent-setting 651`, `last-prompt 637`, `atis-latch 635`, `bridge-session 450`, `system 363`,
   `custom-title 345`, `mode 336`, `permission-mode 2`, `file-history-snapshot 2` — aşağıdaki
   tabloyla (dev turunun 217-dosyalık ölçümü) birebir aynı tip kümesi, sayılar oturum devam
   ettiği için doğal olarak artmış. ✓ DOĞRULANDI (gerçekten çalıştırıldı, uydurulmuş çıktı değil).
4. **`message.usage` alan adlarını karşılaştır:** aynı taramada `type:"assistant"` satırlarının
   `message.usage` anahtarlarını topla, "usage alan adları" bölümüyle karşılaştır. Yeni bir alan
   çıktıysa ve Token ekranı (F-011) için önemliyse `transcript-reader.ts`'e eklenmesi ayrı bir
   feature kararı gerektirir (bu sayfanın güncellenmesi yeterli değildir).
5. **5 fixture hâlâ temsilci mi?** `npx vitest run tests/features/thread/` çalıştır — hepsi
   yeşilse ve yeni gözlemler mevcut fixture şeklini bozmuyorsa fixture'lara dokunma. Yeni bir
   gerçek bozukluk sınıfı (ör. yeni bir "kesik dosya" şekli) gözlenirse **yeni bir fixture ekle**,
   mevcutları DEĞİŞTİRME (geriye dönük regresyon kanıtı kaybolmasın).
6. **Gizlilik çitini yeniden çalıştır:** `npx vitest run tests/features/thread/
   transcripts-privacy-guard.test.ts` — yeni fixture eklendiyse bu adım zorunludur.

## `subagents/*.meta.json` formatı (F-011 spike, önceki turlarda HİÇ doğrulanmamıştı)

F-009/F-010 yalnızca `.jsonl` transkriptlerini doğruladı; `agent-<id>.meta.json` dosyalarının
gerçekten var olup olmadığı, formatının, `agentType` alanının gerçekten dolu olup olmadığı
**hiç ölçülmemişti** (ADR-007'nin kendi örneği — "gözlemlenen içerik" cümlesi — tek bir dosyaya
dayanıyordu). F-011 kod yazmadan önce bunu ölçtü:

- **130 gerçek `.meta.json` dosyası** bulundu (`~/.claude/projects/C--dev-apps-mission-control/
  **/subagents/*.meta.json`, 2026-09-09). ✓ DOĞRULANDI (glob + `JSON.parse`, tam tarama).
- **0 bozuk JSON** — 130/130 başarıyla ayrıştırıldı. ✓ DOĞRULANDI.
- **Alan kümesi:** `{model, description, toolUseId, spawnDepth, agentType}` — ADR-007'nin
  örneğindeki `stoppedByUser` bu turda gözlenmedi (muhtemelen yalnızca kullanıcı durdurduğunda
  eklenen opsiyonel bir alan, ✓ DOĞRULANDI yokluğu, [T] TAHMİN nedeni).
- **`agentType` dağılımı (130/130 dolu, hiçbiri boş/eksik değil):** `developer` 78,
  `qa-evaluator` 47, `explorer` 2, `ux` 1, `architect` 2. ✓ DOĞRULANDI.
- **Her `agent-<id>.jsonl` için TAM OLARAK bir `agent-<id>.meta.json` var** — 130/130 eşleşme
  (`.jsonl` uzantısını `.meta.json` ile değiştirmek yeterli, ayrı bir eşleştirme mantığı
  gerekmiyor), yetim (meta'sız jsonl veya jsonl'siz meta) YOK. ✓ DOĞRULANDI.
- **Ek bulgu (AC'yi DEĞİŞTİRMEZ, yalnızca çapraz-doğrulama):** subagent `.jsonl` satırlarının
  KENDİSİ de `attributionAgent` alanını taşıyor; gözlenen bir örnekte meta.json'daki `agentType`
  (`"developer"`) ile BİREBİR aynı değeri taşıyordu. Bu, meta.json okumadan agent türünü elde
  etmenin ikinci bir yolu olabilir — ama `docs/features/F-011-token-kullanimi.md` AC'si açıkça
  `subagents/*.meta.json`'u birincil kaynak sayar, bu yüzden F-011 KULLANMADI. ⊢ ÇIKARIM: iki alan
  muhtemelen aynı üretim noktasından geliyor (harness subagent'ı spawn ederken ikisine de aynı
  string'i yazıyor), ama bu tek örnekten genellenmedi. [T] TAHMİN: her zaman aynı kalacakları.
- **Ayrıca gözlendi (F-011'in `dayFromMtime` kararını destekler):** ana oturum `.jsonl` satırları
  (`type:"assistant"`) hem `timestamp` (ISO 8601) hem `sessionId` alanını %100 oranda taşıyor
  (22.663/22.663 satır, tam tarama). ✓ DOĞRULANDI. F-011 yine de dosya `mtime`'ını kullandı (satır
  bazlı zaman damgasını KULLANMADI) çünkü `readTranscript()` yalnızca dosya toplamı döner — satır
  bazlı ayrıştırma ikinci bir okuma yolu (W1 ihlali) gerektirirdi; gerekçe `docs/qa/
  F-011-contract.md` §1 madde 3'te.

## İlgili

`docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md`, `docs/qa/F-009-contract.md`,
`docs/qa/F-011-contract.md`, `src/features/thread/server/transcript-reader.ts`,
`src/features/usage/server/usage-aggregator.ts`. İlgili: [[desen/app-factory-hatti]]
