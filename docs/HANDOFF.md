# HANDOFF — oturum kesilirse buradan devam et

> Bu dosya **her zaman güncel "nerede kaldık"** notudur. `docs/progress.md` tarihsel kayıttır;
> burası ise yalnızca **şu anki durumu** anlatır. Yeni oturumda önce bunu oku.

**Son güncelleme:** 2026-09-05 · CEO

---

## Tek cümle
F-001 ve F-002 bitti ve push edildi. **F-004 kod turu BİTTİ ve commit'lendi** (`7d721bd`,
`1627839`, `3c0d5af`, `bcb48dc`) **ve push edildi** (`2253c19`). Sırada **F-004 QA turu** var.

## Güvende olan (git'te, GitHub'da)
- Depo: `onrert/mission-control` (private). Son push: `2253c19` (2026-09-05).
- **F-001 iskelet** — done. **F-002 olay alma + JSONL depo + retention** — done, QA GEÇTİ (8/8/8/8).
- CI Windows'ta yeşil. `npm run verify` = 146/146 test.
- Kapılar G0–G3 onaylı. G4-1 kilometre taşı **Faz 1 sonuna** alındı (kullanıcı itiraz etmedi).
- Bugün onarılan: bütün `.claude/hooks/*` `.cjs`'e taşındı (ESM yüzünden hepsi ölüydü);
  push kapısı tek kullanımlık `docs/approvals/PUSH.ok` ile ayrıldı.

## Devam eden iş: F-004 (`send-event.cjs` + `install-hook` + smoke testleri)
- **Sözleşme ONAYLI ve commit'li:** `docs/qa/F-004-contract.md` (3 dev + 2 QA turu, 12 bulgu + 1
  regresyon kapandı). Kod turu **yalnızca bu sözleşmeyi** uygular.
- Öncelik sırası (çelişirse): `## CEO onayı` → `## CEO kararı — DÜZELTME (zamanlama assert'i)` →
  `## CEO kararı — zamanlama testlerinin kırılganlığı` (1. ve 3. madde) →
  `docs/features/F-004-...md` sonundaki **CEO kararları A/B/C/D** → sözleşme gövdesi →
  `## QA doğrulama — tur 2` içindeki "Kod turuna devredilen notlar".

### Kod turu durumu — BİTTİ (2026-09-05)
- `npm run verify` = 0 (**185 test / 14 dosya**), `e2e` = 0, `e2e:dev` = 0.
- 7 mutasyonun hepsi KIRMIZI verdi ve geri alındı. Feature notu `status: qa`.
- **Mutasyon sırasında gerçek üretim hatası bulundu ve düzeltildi:** 120 ms'lik stdin bekçisi
  stdin kapandıktan sonra `clearTimeout` edilmiyordu. `unref()` "ateşlenmez" demek değil,
  "olay döngüsünü canlı tutmaz" demektir; yetim zamanlayıcı ağ isteği açıkken 120 ms'de
  devreye girip gerçek ağ bekçilerini (100/150 ms) atlayarak süreci **erken sonlandırabiliyordu**
  → sessiz olay kaybı. Test sunucusundaki damla da geçerli-ama-bitmemiş HTTP başlığı yazacak
  şekilde düzeltildi (ham bayt Node'un parse hatasını tetikleyip senaryoyu yanlış ölçüyordu).

### AÇIK HATA: BUG-001 (F-004 QA turunda ele alınacak)
`docs/qa/BUG-001-summary-200-karakter.md` — `summary` mimari §5.1'in 200 karakter sınırını aşıyor
(gerçek olaylarda 234-732 karakter). Sahibi F-002 kodu (`normalize.ts` `deriveSummary`), ama
yalnızca gerçek hook payload'ıyla görünüyor; F-002'nin QA'sı elinde gerçek olay olmadığı için
göremedi. **F-003 zaman çizelgesi satır düzenini bozar** — F-003'ten önce kapatılmalı.

### QA turu YAPILDI — KARAR: KALDI (2026-09-05)
Rapor: `docs/qa/latest.md` (= `docs/qa/F-004-2026-09-05.md`). Feature notu `status: fix`.
Puanlar: İşlevsellik 8 · Bütünlük 8 · Görsel/UX 8 · **Kod kalitesi 6** (<7 olduğu için de KALDI).
QA agent'ı raporu yazdıktan sonra oturum limitine takıldı; **ürün kodu temiz** (`git diff HEAD`
boş, mutasyon artığı yok, yetim süreç/port yok) — doğrulandı.

**B1 (BLOKLAYICI):** developer'ın uygulama sırasında kendi bulduğu gerçek üretim hatasının
düzeltmesi (`send-event.cjs:251` `clearTimeout(stdinGuard)`) **hiçbir test tarafından
korunmuyor** — satır silinince 185 testin tamamı yeşil kalıyor. Yani yetim zamanlayıcı gerilemesi
serbest: süreç başlangıcından 120 ms sonra uçuştaki isteği öldürüp ağ bekçilerini atlar,
yavaş stdin'de **sessiz olay kaybı** (exit 0, boş stderr).
**Ö1:** idle soket bekçisi (`send-event.cjs:172-175`) tamamen silinebiliyor, hiçbir test görmüyor —
"sessiz sunucu" senaryosunu 150 ms'lik toplam bekçi de yakaladığı için iki katman ayırt edilmiyor.
**Ö2:** AC5 doğrulama sonucu `KURULUM.md`'ye yazılmamış (kanıt feature notunda duruyor).

**Düzeltme dar ve ucuz, ürün kodu değişmiyor:** damla senaryosuna **alt sınır** assert'i
(ör. TCP bağlantısından çıkışa `>= 145 ms`) veya stdin bekçisinin `'end'` sonrası temizlendiğini
doğrudan ölçen test · idle katmanı için ayırt edici bir ölçüm · `KURULUM.md`'ye üç satır.

### Sıradaki adım: F-004 düzeltme turu 1
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
F-004 düzeltme + doğrulama → **F-003** (SSE zaman çizelgesi) → F-005 → F-006 → F-007.
F-003 sözleşmesi açılırken iki taahhüt hazır: gerçek DOM test altyapısı ADR'si (jsdom +
@testing-library/react) ve **N-1 hayalet olay** (503 dönen olay ring'de kalıp `GET /api/events`'te
görünüyor; SSE yayımlarsa kalıcı hayalet satır olur).
F-006 ise **ADR-008 ekindeki artık riski** yeniden değerlendirmek zorunda.
