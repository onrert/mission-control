# HANDOFF — oturum kesilirse buradan devam et

> Bu dosya **her zaman güncel "nerede kaldık"** notudur. `docs/progress.md` tarihsel kayıttır;
> burası ise yalnızca **şu anki durumu** anlatır. Yeni oturumda önce bunu oku.

**Son güncelleme:** 2026-09-05 · CEO

---

## Tek cümle
**F-001, F-002, F-004 bitti** (üçü de QA GEÇTİ). Panel kendini izliyor. Sırada **BUG-001 düzeltmesi**,
sonra **F-003** (SSE zaman çizelgesi).

## Güvende olan
- Depo: `onrert/mission-control` (private). **Son commit `a1d7917` — push EDİLMEDİ** (kullanıcı onayı bekliyor).
- F-001 iskelet · F-002 olay alma + JSONL depo + retention · F-004 send-event hook + kurulum — hepsi `done`.
- `npm run verify` = 0 (**185 test / 14 dosya**), `e2e` + `e2e:dev` = 0. CI Windows'ta yeşil (son yeşil koşu `d1bc0bd`).
- Kapılar G0-G3 onaylı. G4-1 kilometre taşı **Faz 1 sonunda**.
- Panel kendini izliyor: `.claude/settings.json`'da `send-event.cjs` kurulu, 6 güvenlik hook'u sağlam.

## AÇIK İŞ 1 (öncelikli): BUG-001
`docs/qa/BUG-001-summary-200-karakter.md` — `summary` mimari §5.1'in **200 karakter** sınırını aşıyor
(gerçek olaylarda 234-732). Kaynak: `src/features/events/server/normalize.ts` `deriveSummary`
kırpma yapmıyor. **F-002 kodu**, F-004'ün kusuru değil.
**F-003'ten ÖNCE kapatılmalı** — zaman çizelgesi her olayı bir satırda gösterecek, 732 karakterlik
özet satır düzenini bozar.
Düzeltme: çıktıyı 200 karaktere kırp + uzun `tool_input.command` içeren olayla `summary.length <= 200`
assert'i (kırpmayı kaldıran mutasyon KIRMIZI vermeli) + `q` alt dizge aramasına etkisini bir cümleyle not et.

## AÇIK İŞ 2: F-003 (SSE zaman çizelgesi)
Sözleşme **iki taahhütle** açılmak zorunda:
1. **Gerçek DOM test altyapısı ADR'si** (jsdom + @testing-library/react). F-001/F-002/F-004 yalnızca
   `renderToStaticMarkup` kullanıyor; ilk etkileşimli ekran F-003'te geliyor.
2. **N-1 hayalet olay:** depolama arızasında `503` dönen olay ring buffer'da kalıp `GET /api/events`'te
   görünüyor, diskte karşılığı yokken. SSE onu yayımlarsa zaman çizelgesinde **kalıcı hayalet satır** olur.
   F-003 ring'e yazma ile diske yazmanın başarı koşulunu hizalamalı.

## F-004'ten devralınan küçük notlar (bloklamıyor)
- **N3:** damla/sessiz ayrımındaki 145 ms eşiğinin alt sınıra payı 2-3 ms. QA 70+ örnekle ölçtü,
  yük altında dahi kırılmadı (kayma yönü yukarı) — ama 140'a çekmek veya zamanlayıcı sabitlerinden
  türetmek daha sağlam.
- **N4:** `tests/integration/send-event-hook.test.ts`'te `await socketLifetimeMs` sınırsız; ağır
  doygunlukta soket `'close'` gelmeyip test asılabilir. `Promise.race` + açık zaman aşımı mesajı.
- **CEO'nun sert kapısı kırılgan çıktı:** QA'nın yük testinde kırılan tek şey `elapsedMs < 1000`
  kapısı oldu (1042-1552 ms). Koruduğu şeyden daha kırılgan; F-003'te benzer bir kapı koyarken dikkat.

## Çalışma düzeni (kullanıcı kararları)
- **Push:** her seferinde kullanıcıya sorulur; onaylarsa CEO `docs/approvals/PUSH.ok` yazar,
  hook kullanınca siler. Kapı kalıcı açılmayacak.
- **Platform:** yalnızca Windows (ADR-009). CI tek `windows-latest`.
- Her feature: sözleşme turu → kod turu → QA → düzeltme. Sözleşme turu pahalı ama işe yarıyor
  (F-002'de 13, F-004'te 12 bulgu kod yazılmadan kapandı).

## Sıradaki adım: F-004 düzeltme turu 1
Developer'a B1 + Ö1 + Ö2'yi ver. **Onaylanmış bölümleri yeniden açtırma:** AC1-AC4, AC6,
CEO kararları A/B/C/D, `install-hook` güvenliği, kapsam denetimi, güvenlik taraması.
Sonra dar bir QA doğrulaması. Tur sayacı: düzeltme 1/3.

### F-004'te unutulmaması gereken 5 şey
- Uzantı **`.cjs`** — düz `.js` yasak (izlenen projede `type: module` varsa script sessizce ölür).
- **Tek kademeli `elapsedMs < 400` assert'i YAZMA.** Kanıt üç kademeli: dış duvar saati
  **> 1000 ms → KIRILIR** · zamanlayıcı sabitlerinin **saat kullanmayan** birim testi
  (stdin 120 · idle 100 · toplam 150) · her bekçi için ayrı mutasyon. `MC_TIMING_FILE` gibi
  test-amaçlı yan kanal **ekleme**.
- Damla test sunucusu **istemci kapatana kadar** damlatır (sonlu sınır mutasyonu yeşile düşürür).
- Parse hatası `raw_text` = stdin'in ilk **2000 karakteri** (sabit, `MC_MAX_PAYLOAD` değil).
- `install-hook` **yalnızca geçici sahte dizinlere** çalıştırılır. Bu deponun kendi
  `.claude/settings.json`'ına veya depo dışına **onaysız asla**.

## Kullanıcıda bekleyen (CEO soracak)
- ~~**AC5**~~ **TAMAMLANDI (2026-09-05).** Kullanıcı `npm run install-hook -- .` çalıştırdı,
  CEO doğruladı: uçtan uca hat çalışıyor (hook → `send-event.cjs` → `POST /api/events` → JSONL),
  6 güvenlik hook'u bozulmadı, `transcript_path` dolu geliyor. Kanıt: feature notu "AC5 doğrulama
  kanıtı". **Bu doğrulama BUG-001'i ortaya çıkardı** (aşağıda).
- **Push:** her push öncesi kullanıcıya sorulur; onay verirse CEO `docs/approvals/PUSH.ok` yazar
  (hook kullanınca siler). Kullanıcı kararı: kapı kalıcı açılmayacak.

## Oturum nerede bitti (2026-09-05)
F-004 QA turu koşturuldu ve **KALDI** verdi; kullanıcı "sadece QA yap sonra dur" dediği için
düzeltme turu **açılmadı**. QA agent'ı raporu diske yazdıktan sonra oturum limitine takıldı
(limit 04:00 Europe/Istanbul'da sıfırlanıyor). Ürün kodu temiz, hiçbir agent çalışmıyor.
Yeni oturumda ilk iş: **F-004 düzeltme turu 1** (yukarıdaki "Sıradaki adım").

## Sıradaki
BUG-001 → **F-003** (SSE zaman çizelgesi) (SSE zaman çizelgesi) → F-005 → F-006 → F-007.
F-003 sözleşmesi açılırken iki taahhüt hazır: gerçek DOM test altyapısı ADR'si (jsdom +
@testing-library/react) ve **N-1 hayalet olay** (503 dönen olay ring'de kalıp `GET /api/events`'te
görünüyor; SSE yayımlarsa kalıcı hayalet satır olur).
F-006 ise **ADR-008 ekindeki artık riski** yeniden değerlendirmek zorunda.
