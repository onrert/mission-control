# BUG-001 — `summary` 200 karakter sınırını aşıyor

- **Bulundu:** 2026-09-05, F-004 AC5 doğrulaması sırasında (gerçek oturum verisiyle)
- **Bulan:** CEO
- **Şiddet:** ÖNEMLİ (bloklayıcı değil; veri kaybı yok)
- **Sahibi:** F-002 kodu (`src/features/events/server/normalize.ts`, `deriveSummary`)
- **Durum:** KAPANDI (CEO doğrulaması, 2026-09-05)

## Belirti

Mimari §5.1 (satır 254) `summary` alanını **"≤ 200 karakter"** diye tanımlıyor.
Gerçek hook olaylarında sınır aşılıyor:

```
seq 0-3  | 0 karakter        (benim demo olaylarım — tool_input yoktu)
seq 4,5  | 234 karakter      <-- aşıyor
seq 6,7  | 487 karakter      <-- aşıyor
seq 8,9  | 732 karakter      <-- aşıyor
seq 10   | 567 karakter      <-- aşıyor
```

11 olayın 7'si sınırı aşıyor. Aşan olayların **hepsi** gerçek `PreToolUse`/`PostToolUse`
olayları; `tool_input.command` uzun bir Bash komutu olduğunda `deriveSummary` onu **kırpmadan**
`summary`'ye yazıyor.

## Neden şimdiye kadar görülmedi

F-002'nin bütün testleri ve benim el yordamıyla attığım demo olaylar `tool_input` içermiyordu;
`deriveSummary` bu durumda `""` döndürüyor ve uzunluk 0 oluyor. Sınır ihlali **yalnızca gerçek
hook payload'ıyla** ortaya çıkıyor. F-002'nin QA turu (GEÇTİ) bunu göremedi çünkü elinde gerçek
olay yoktu — gerçek olay üreten hat F-004'te geldi.

Bu, AC5'in ("gerçek bir Claude Code oturumunda elle doğrulanır") neden otomatik testlerin yerine
geçemediğinin somut kanıtıdır.

## Neden önemli

- **F-003 (SSE zaman çizelgesi) doğrudan etkilenir:** zaman çizelgesi her olayı bir satırda
  gösterecek. 732 karakterlik bir özet satır düzenini bozar; UX dokümanının satır tasarımı
  200 karakter varsayımıyla yapıldı.
- Depo şişer: `summary` zaten `raw` içinde var olan verinin kopyası; kırpılmaması her olayda
  gereksiz bayt demek (retention tavanı olay sayısına göre, bayta göre değil).
- Sözleşme ile kod çelişiyor: mimari bir sayı veriyor, kod uygulamıyor, hiçbir test ölçmüyor.

## İstenen düzeltme

1. `deriveSummary` çıktısını **200 karaktere kırp** (kırpıldığını belli eden bir son ek uygun olabilir).
2. **Testle çitle:** rastgele/uzun `tool_input.command` içeren bir olay için `summary.length <= 200`
   assert'i. Bu assert, kırpmayı kaldıran bir mutasyon altında KIRMIZI vermeli.
3. Kırpmanın `q` (summary alt dizge araması, mimari §6.1) davranışını nasıl etkilediğini bir
   cümleyle not et — kırpılan kısım aranamaz hâle gelir, bu kabul edilebilir mi?

## Kanıt

Gerçek olay örneği (seq 8): `hook_event_name: PreToolUse`, `tool_name: Bash`,
`session_id: b13e8d3f-6bd6-42d4-bf89-f239841462ba`, `summary` uzunluğu **732**.
Ölçüm komutu `data/events/2026-09-04.jsonl` üzerinde her satırın `summary.length` değerini yazdırır.

## Düzeltme (developer, 2026-09-05)

**Ne değiştirildi:** `src/features/events/server/normalize.ts` içine `SUMMARY_MAX_LENGTH = 200`
ve `SUMMARY_TRUNCATION_MARK = '…'` sabitleri ile `truncateSummary()` yardımcı fonksiyonu
eklendi. `deriveSummary`'nin türetme mantığına dokunulmadı; `normalizeEvent` içindeki tek
çağrı noktası `summary: truncateSummary(deriveSummary(payload, hookEventName))` olarak
güncellendi. 200 karakteri aşan değerler `199` karaktere kesilip `…` eklenir (toplam tam 200,
işaret dahil); 200 karakter veya altındaki değerler aynen korunur.

**Çitleyen test:** `tests/features/events/server/normalize.test.ts` →
"BUG-001: 200 karakteri aşan tool_input.command kırpma işaretiyle 200 karaktere kısaltılır"
(`summary.length <= 200` ve `…` ile bitiyor) + "BUG-001: 200 karakter veya altındaki
tool_input.command aynen korunur, kırpılmaz" (kısa girdide değişiklik olmadığını doğrular,
"her şeyi kes" gibi hatalı bir uygulamayı da yakalar).

**Mutasyon kanıtı:** `truncateSummary` gövdesi geçici olarak `return value` (kırpma devre
dışı) yapıldı → test KIRMIZI verdi:
```
AssertionError: expected 800 to be less than or equal to 200
 ❯ tests/features/events/server/normalize.test.ts:197:37
```
Ardından orijinal kırpma mantığı geri konuldu, 19/19 test tekrar YEŞİL.

**Gerçek veriyle doğrulama:** `data/events/2026-09-04.jsonl` içindeki 200 karakteri aşan
9 gerçek `tool_input.command` değeri (234–732 karakter) `normalizeEvent`'ten geçirildi
(dosya değiştirilmedi, yalnızca okundu). Hepsi için düzeltilmiş `summary` uzunluğu tam
**200** ve `…` ile bitiyor.

**`q` etkisi:** `docs/02-architecture.md` §6.1 `GET /api/events` `q` parametresi satırına
tek cümlelik not eklendi — kırpılan kuyruk `q` alt dizge aramasıyla bulunamaz, ancak
veri kaybı yok çünkü `raw` tam metni tutmaya devam ediyor.

**Kapsam dışı bırakılan (bilinçli):** `data/` altındaki mevcut olaylardaki uzun `summary`
değerleri geriye dönük düzeltilmedi (CEO kararı); retention zamanla düşürecek.

## CEO doğrulaması ve kapanış (2026-09-05)

Bağımsız bir `qa-evaluator` turu **açılmadı** — bu bir feature değil, 17 satırlık tek fonksiyonluk
bir düzeltme. CEO diff'i satır satır okuyarak doğruladı:

- `truncateSummary` **tek çağrı noktasında** (`normalizeEvent`) uygulanmış; `deriveSummary`'nin
  türetme mantığına dokunulmamış → cerrahi (Karpathy §3).
- Aritmetik doğru: `slice(0, 200 - 1)` + 1 karakterlik `…` (U+2026, BMP, `.length === 1`) = **tam 200**.
  Rapor metnindeki "197" yazımı hatalıydı (muhtemelen 3 karakterlik `...` düşünülen bir önceki
  taslaktan kalmış), düzeltildi.
- **Her iki yönde assert var:** sınırı aşan girdi kırpılıyor **ve** kısa girdi aynen korunuyor.
  İkincisi olmasaydı "her şeyi 200'e kes" gibi hatalı bir uygulama da testi geçerdi.
- Mutasyon kanıtı somut: kırpma devre dışı → `expected 800 to be less than or equal to 200`.
- Gerçek veriyle doğrulanmış: diskteki 9 gerçek uzun komut (234-732 karakter) → hepsi 200.

**Kabul edilen bilinen sınırlama:** kırpma sınırı bir vekil çifti (surrogate pair — ör. emoji)
ortasına denk gelirse yalnız kalan bir yarım karakter üretebilir. `JSON.stringify` bunu kaçışlayarak
yazar, çökme veya veri bozulması olmaz; yalnızca görüntüde tek bir bozuk karakter görünebilir.
Kod karmaşıklığına değmediği için düzeltilmedi (Karpathy §2). F-003 zaman çizelgesinde gözle
görülür bir soruna yol açarsa yeniden değerlendirilir.
