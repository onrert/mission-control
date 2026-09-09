---
type: desen
updated: 2026-09-09
sources: [docs/features/F-009-transkript-spike.md, docs/02-architecture.md §9, docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md, docs/qa/F-009-contract.md, src/features/thread/server/transcript-reader.ts]
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

  ✓ DOĞRULANDI (219 dosyanın TAMAMI tarandı, içerik hiçbir yere kopyalanmadı — yalnızca alan
  sayıları). **Baskın değer `2.1.260`** — önceki turun tek iddia ettiği `2.1.261` aslında
  AZINLIKTA (%4). Ayrıca `2.1.205` — **kurulu CLI sürümünün kendisi** (`claude --version` →
  `2.1.205 (Claude Code)`, aynı gün ✓ DOĞRULANDI) — transkript içinde de 8 satırda geçiyor. Bu,
  önceki turun "transkript sürümü CLI'dan her zaman ayrı bir SDK/harness sürümüdür" ⊢ ÇIKARIM'ını
  ÇÜRÜTÜYOR: en azından bazı oturumlarda ikisi AYNI. ⊢ DÜZELTİLMİŞ ÇIKARIM: transkriptin `version`
  alanı, o satırı üreten Claude Code SÜRECİNİN o anki kendi sürümüdür (CLI güncellemesi sırasında
  eski süreçler eski sürüm yazmaya devam eder) — sabit bir "SDK sürümü ≠ CLI sürümü" kuralı YOK,
  gözlemlenen çoklu değer büyük olasılıkla art arda gelen CLI güncellemelerinin izidir. **Bir
  sonraki doğrulamada yine TAM tarama yap** (tek dosya örneklemesi YETMEZ — bu turun asıl hatası
  buydu), üç değeri de güncelle.
- **İncelenen kaynak:** `C:\Users\pc\.claude\projects\C--dev-apps-mission-control\` altındaki
  **217 gerçek `.jsonl` dosyası** (ana oturum + `*/subagents/*.jsonl`), yalnızca `type` alanı
  sayıları ve `message.usage` alan adları toplandı (satır içerikleri bu sayfaya veya herhangi bir
  fixture'a **kopyalanmadı** — bkz. `tests/features/thread/transcripts-privacy-guard.test.ts`).
  ✓ DOĞRULANDI.

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

## İlgili

`docs/decisions/ADR-007-transkript-ve-token-veri-kaynagi.md`, `docs/qa/F-009-contract.md`,
`src/features/thread/server/transcript-reader.ts`. İlgili: [[desen/app-factory-hatti]]
