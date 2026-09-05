# BUG-001 — Sözleşme

## Ne yapacağım

`src/features/events/server/normalize.ts` içinde `deriveSummary`'nin döndürdüğü değeri
200 karaktere (kırpma işareti dahil) sınırlayan bir `truncateSummary` yardımcı fonksiyonu
ekleyeceğim ve bunu yalnızca `normalizeEvent` içindeki tek çağrı noktasında
(`summary: deriveSummary(...)` satırı) uygulayacağım. `deriveSummary`'nin kendi switch
mantığına dokunmayacağım — kırpma, türetmeden sonra tek bir yerde yapılacak.

- Sınır: `SUMMARY_MAX_LENGTH = 200`.
- Kırpma işareti: `…` (tek karakter, U+2026). İşaret dahil toplam uzunluk `<= 200`.
- Kırpma yalnızca `value.length > 200` olduğunda uygulanır; kısa/eşit uzunluktaki değerler
  aynen korunur (ekstra karakter eklenmez, kesilmez).
- `raw` alanına dokunulmaz (zaten ham payload'ı tutuyor).
- `docs/02-architecture.md` §6.1 `q` satırının yanına (satır ~385), kırpılan kuyruğun
  `q` alt dizge aramasıyla bulunamayacağına dair tek cümlelik bir not eklenecek. Tasarım
  değişmeyecek, yalnızca davranış belgelenecek.

## Kapsam dışı

- `send-event.cjs`, `install-hook.mjs`, F-004'ün diğer dosyaları.
- Geriye dönük veri düzeltmesi (`data/` altındaki mevcut olaylar).
- `deriveSummary`'nin türetme tablosu mantığı (hangi alanın hangi olaydan alındığı).

## Davranışlar nasıl doğrulanacak

1. **Test — uzun girdi kırpılır:** `tool_input.command` 800 karakterlik bir Bash komutu
   olan bir `PreToolUse` olayı için `normalizeEvent(...).summary.length` `<= 200` olmalı
   ve son karakter(ler) kırpma işaretini içermeli.
2. **Test — kısa girdi korunur:** `npm test` gibi kısa bir `tool_input.command` için
   `summary` tam olarak girdiyle aynı kalmalı (kırpılmamalı, işaret eklenmemeli). Bu,
   "her şeyi kes" gibi hatalı bir uygulamanın da testi geçmesini engeller.
3. **Mutasyon kanıtı:** `truncateSummary` çağrısını geçici olarak kaldırıp (`deriveSummary`
   sonucunu doğrudan döndürerek) test 1'in KIRMIZI verdiğini göstereceğim, hata mesajının
   ilk satırını rapora ekleyeceğim, sonra kırpmayı geri koyacağım.
4. **Gerçek veri doğrulaması:** `data/events/*.jsonl` içinden gerçek bir uzun
   `raw.tool_input.command` değerini okuyup (dosyayı değiştirmeden) `deriveSummary` +
   `truncateSummary` zincirinden geçireceğim, çıktının `<= 200` olduğunu göstereceğim.
5. `npm run verify`, `npm run e2e`, `npm run e2e:dev` çıkış kodu 0 olmalı.

## Dosya sahipliği

Yalnızca şu dosyalara dokunulacak:
- `src/features/events/server/normalize.ts`
- `tests/features/events/server/normalize.test.ts`
- `docs/02-architecture.md` (tek satır not, §6.1 civarı)
- `docs/qa/BUG-001-summary-200-karakter.md` (düzeltme bölümü eklenecek)
- `docs/progress.md`
