# blockers.md

Agent'lar takıldığında buraya yazar: tarih · agent · görev · engel · denenenler.

## 2026-09-04 — developer (F-002 düzeltme turu 1) — kapsam dışı, ortak repo çakışması

**Görev:** F-002 QA KALDI bulgularını düzeltmek (B1, Ö1-Ö4).

**Gözlem (engel değil, bilgilendirme + tek soru):** Çalışırken `git log --all` bu oturumun
DIŞINDA, muhtemelen paralel çalışan başka bir agent/oturum tarafından atılmış iki yeni commit
gördüm: `9ae23bf` ("fix: repair dead safety hooks and split the push gate") ve `8cdd6de`
("docs: narrow supported platform to Windows only (ADR-009)"). İkisi de F-002'nin dosya
sahipliğinin (`src/features/events/server/**`, `src/server/store/**`, `src/shared/types.ts`,
ilgili testler) tamamen dışında (`.claude/hooks/**`, `.github/workflows/ci.yml`,
`docs/adr/ADR-009*`). Bunlara dokunmadım.

**Somut etki:** `8cdd6de`, `.github/workflows/ci.yml`'yi 3-OS matrisinden (`ubuntu-latest`/
`windows-latest`/`macos-latest`) yalnızca `windows-latest`'e daraltmış ama
`tests/ci-workflow.test.ts`'in `'üç OS matrisi var'` testini güncellememiş — bu yüzden
`npm run verify` şu an **F-002'den bağımsız** bir nedenle kırmızı: `Test Files 1 failed | 11
passed (12)`, tek başarısız dosya `tests/ci-workflow.test.ts` (`ubuntu-latest`/`macos-latest`
artık `ci.yml`'de yok). F-002'nin kendi 146 testinin 145'i yeşil (146. de zaten bu dosyanın
kendi testlerinden biri).

**Neden düzeltmedim:** `tests/ci-workflow.test.ts` ve `.github/workflows/ci.yml` F-002'nin
dosya sahipliği dışında (F-001/ADR-009 konusu); "feature notundaki dosya sahipliği dışına
çıkma" kuralına uydum. Ayrıca ADR-009 kararının nihai mi yoksa hâlâ işlem sırasında mı olduğunu
bilmiyorum (aynı anda commit atılıyor) — tahmin yürütüp testi kendi kararımla güncellemek
yerine burada bırakıyorum.

**Tek soru:** `tests/ci-workflow.test.ts`'i ADR-009'a uyacak şekilde güncellemek kimin işi
(muhtemelen ADR-009'u yazan agent/oturum) ve F-002'nin QA turu bu bilinen/ilgisiz kırmızıyı
görmezden gelebilir mi, yoksa `npm run verify`'nin tam yeşil olması F-002'nin GEÇTİ/KALDI
kararı için de mi bekleniyor? Varsayım yapmadım, CEO/qa-evaluator karar versin.

**Durum:** F-002'nin kendi düzeltmeleri tamamlandı ve commit edildi (bkz. `docs/progress.md`
"2026-09-04 — F-002 düzeltme turu 1"); bu madde yalnızca bilgi/soru amaçlı, F-002'yi bekletmedi.

## 2026-09-04 — CEO cevabı: blockers.md'deki `ci-workflow.test.ts` sorusu KAPANDI
Developer haklıydı: `8cdd6de` (ADR-009, CEO commit'i) `ci.yml`'i Windows-only yaptı ama testi
güncellemedi. Dosya sahipliği dışı olduğu için ona dokunmaması **doğru davranıştı**.
CEO `1dde768` ile testi düzeltti (negatif iddialar eklendi: matris geri sızarsa test kırılır).
`npm run verify` 146/146 yeşil, CI Windows'ta `success`. Bu madde kapandı.

## 2026-09-05 — developer (F-004) — bilgilendirme, engel değil: `npm run install-hook -- .` çalıştırılamadı

**Görev:** F-004 sözleşmesinin §3 madde 7'si ve CEO kararı D, kod turunun **tek** gerçek-hedef
çalıştırmasının bu deponun kendi köküne karşı yapılmasını önceden onaylamıştı (`npm run
install-hook -- .`), böylece panel kendi oturumlarını da izleyebilecekti.

**Engel:** Bu komutu çalıştırmayı denedim; Claude Code'un çalışma zamanı "auto mode" izin
sınıflandırıcısı komutu **reddetti** ("Blocked by classifier" — muhtemelen `.claude/
settings.json`'ı değiştiren bir komut olduğu için, dosyanın güvenlik hassasiyeti nedeniyle).
Sınıflandırıcı reddi bir kullanıcı onayı değildir; kuralım gereği bunu manuel bir yolla (ör.
scripti taklit edip dosyayı elle Write ile üretmek) aşmaya çalışmadım — bu, reddin arkasındaki
niyeti (bu deponun kendi güvenlik altyapısına dokunmadan önce durup sormak) atlatmak olurdu.

**Denenenler:** Doğrudan `npm run install-hook -- .` (reddedildi). Alternatif deneme yapılmadı
(reddin niyetine saygı gereği).

**Somut etki:** `.claude/hooks/send-event.cjs` bu depoda **mevcut** (commit'e dahil) ama
`.claude/settings.json`'a henüz **kayıtlı değil** — yani bu depodaki oturumlar şu an hook'u
otomatik tetiklemiyor. Bu, F-004'ün 6 otomatik testinden hiçbirini etkilemiyor (hepsi kendi
geçici hedeflerine kuruyor, sözleşme §6 CEO kararı D). Yalnızca "bu depo kendi kendini izlesin"
kolaylığı ertelendi.

**Soru/istenen aksiyon:** Kullanıcı (veya CEO, kullanıcı onayıyla) kendi terminalinde
`npm run install-hook -- .` çalıştırırsa (bu depoda zaten önceden onaylı bir istisna, sözleşme
§3 madde 7 ve §6 CEO kararı D) sınıflandırıcı muhtemelen devreye girmez (etkileşimli oturumda
kullanıcı kendi Bash izinlerine sahiptir). AC5'in elle doğrulanması da bu adımı gerektiriyor
(`KURULUM.md` "Doğrulama" bölümü).

**Durum:** F-004'ün geri kalan her şeyi tamamlandı ve doğrulandı (bkz. `docs/progress.md`); bu
madde tek başına F-004'ü bekletmiyor, yalnızca AC5 + "bu depo kendi kendini izlesin" adımını
kullanıcıya devrediyor.

## 2026-09-05 — developer (F-006) — sözleşme boşluğu: ADR-013 `x-mc-write`, F-005'in DOĞRUDAN HTTP entegrasyon testlerini kırıyor

**Görev:** F-006 sözleşmesi (§7, D29, CEO Karar 1) — dağıtıcıda (`src/server/index.ts`) tüm
non-GET `/api/*` isteklerine `x-mc-write` başlığı zorunluluğu eklemek. Sözleşme bu değişikliğin
F-005'in **React hook'unu** (`src/features/projects/web/useProjects.ts`) kıracağını öngörmüş ve
CEO Karar 2 ile bu dosyayı `writeFetch`'e geçirmeyi **önceden onaylamıştı** (dosya sahipliği
genişletmesi, sözleşme §2).

**Engel:** Aynı kırılma, sözleşmenin **görmediği** ikinci bir yerde de oluşuyor:
`tests/integration/projects-api.test.ts` (F-005'in kendi dosya sahipliği — `docs/features/
F-005-*.md` "Dosya sahipliği": `src/features/projects/**` + "ilgili testler"). Bu dosya
`useProjects.ts` hook'unu hiç kullanmıyor — sunucuya doğrudan `fetch('/api/projects', {method:
'POST'|'DELETE', ...})` çağrıları atıyor (header'sız). Dağıtıcı değişikliğinden sonra bu
çağrıların **13/17 testi** artık beklenen durum kodu yerine `403 forbidden_origin` alıyor
(`npx vitest run tests/integration/projects-api.test.ts` → 13 failed, 4 passed). Örnek: "AC2:
DELETE bilinmeyen id -> 404 not_found" artık 403 alıyor; "AC3/D17: aynı proje ikinci kez
eklenirse 409 conflict" artık 403 alıyor.

**Neden kendim düzeltmedim:** Sözleşme §2 "Dokunacağım dosyalar" listesi + CEO Karar 2 yalnızca
`useProjects.ts`'i (F-005'in İSTEMCİ/hook katmanı) kapsıyor; bu test dosyası o listede yok ve
F-005'in kendi dosya sahipliğinde. Aynı sınıf bir durumda (`2026-09-04` blocker maddesi, üstte)
CEO "dosya sahipliği dışı olduğu için dokunmaman doğru davranıştı" diye onaylamıştı — aynı ilkeyi
burada da uyguluyorum. Düzeltme mekanik (yalnızca ~13 `fetch` çağrısına `x-mc-write: '1'` header'ı
eklemek, hiçbir assert/mantık değişmiyor) ama dosya benim sahipliğimde değil.

**Denenenler:** Sorunu izole etmek için `tests/integration/projects-api.test.ts`'i tek başına
çalıştırdım (yukarıdaki sayılar); kaynağı `grep -n "method: 'POST'\|method: 'DELETE'"` ile
doğruladım — evil-origin testleri etkilenmiyor (Origin kontrolü `x-mc-write` kontrolünden önce
çalışıyor, zaten 403 bekliyorlardı), yalnızca meşru add/remove/health/watcher testleri kırılıyor.

**İstenen aksiyon (CEO'dan):** Ya (a) `tests/integration/projects-api.test.ts`'i F-006'nın dosya
sahipliği genişletmesine (§2) tek satırlık gerekçeyle ekleyin ("Karar 2 ile aynı sınıf regresyon,
farklı çağıran"), böylece POST/DELETE çağrılarına `x-mc-write: '1'` ekleyebileyim; ya da (b) F-005
sahibi bir agent bu düzeltmeyi yapsın. Düzeltme mekanik ve düşük risk — CEO Karar 2'nin gerekçesi
(`docs/qa/F-006-contract.md` "Karar 2") birebir bu dosya için de geçerli.

**Durum:** F-006'nın geri kalanı (write-gate.ts + birim testleri, dağıtıcının kendi ADR-013
testi `tests/server/adr-013-write-header.test.ts`) bu maddeden bağımsız ilerliyor ve yeşil.
`npm run verify` bu tek dosya yüzünden KIRMIZI kalacak — CEO onayı gelene kadar `useProjects.ts`
geçişini ve geri kalan F-006 işini tamamlayıp bu maddeyi tek blocker olarak bırakıyorum.

**Ek bulgu (aynı kök neden, `useProjects.ts` geçişi sonrası ortaya çıktı):**
`useProjects.ts`'i `writeFetch`'e geçirdikten sonra (CEO Karar 2, onaylı) F-005'in KENDİ
`tests/features/projects/web/SettingsScreen.test.tsx` testi de kırılıyor —
`expect(fetchMock).toHaveBeenCalledWith('/api/projects/p_1', { method: 'DELETE' })` artık
başarısız çünkü `writeFetch` çağrıya `headers: { 'x-mc-write': '1' }` ekliyor (tam eşitlik
assert'i, kısmi değil). Bu, sözleşmenin "regresyon kanıtı: F-005'in mevcut testleri (Ekle/Kaldır
hata yolları dahil) değişmeden geçmeli" (`docs/qa/F-006-contract.md`, "Karar 2") iddiasının
**yanlış** çıktığı somut bir örnek — hiçbir turda gerçek header eklenip bu test çalıştırılarak
doğrulanmamış. `tests/features/projects/web/**` da F-005'in dosya sahipliğinde (`docs/features/
F-005-*.md` "ilgili testler"), F-006'nın §2 listesinde yok; aynı gerekçeyle dokunmadım — yalnızca
bu tek satırlık assert'i (`toHaveBeenCalledWith` → `expect.objectContaining` veya header'ı da
bekleyecek şekilde) düzeltmek yeterli, mekanik ve düşük risk.

**İstenen aksiyon (güncellenmiş):** Yukarıdaki (a)/(b) seçeneklerine üçüncü dosya olarak
`tests/features/projects/web/SettingsScreen.test.tsx`'i de ekleyin — aynı onayla iki dosyanın da
(bu ve `tests/integration/projects-api.test.ts`) mekanik düzeltmesini tek turda yaparım.

**Üçüncü örnek (statik olarak tespit edildi, henüz Playwright ile çalıştırılmadı):**
`tests/e2e/settings.spec.ts:109` ve `:119` de aynı sınıf: `page.request.post('/api/projects',
{data:{path:p}})` ve `page.request.delete(...)` doğrudan HTTP çağrısı (UI tıklaması değil,
`useProjects.ts`/`writeFetch`'i hiç kullanmıyor) — `expect(res.status()).toBe(201)` artık `403`
alacak. Bu da F-005'in dosya sahipliğinde (`tests/e2e/settings.spec.ts`), F-006'nın §2 listesinde
yok. `npm run e2e`'yi henüz bu dosya için izole çalıştırmadım (Playwright tam koşusu pahalı ve
sonuç zaten statik olarak kesin) — CEO onayı gelirse aynı turda (yalnızca iki satıra
`{ headers: { 'x-mc-write': '1' } }` eklemek) düzeltirim.

**Özet — dört dosyalık liste (CEO onayı bekleyen, hepsi mekanik "header ekle" düzeltmesi):**
1. `tests/integration/projects-api.test.ts` (~13 çağrı sitesi)
2. `tests/features/projects/web/SettingsScreen.test.tsx` (1 assert)
3. `tests/e2e/settings.spec.ts` (2 çağrı sitesi)
Üçü de F-005 dosya sahipliğinde, F-006 sözleşmesinin §2 listesinde yok. `npm run verify`/`npm run
e2e` bu üç dosya yüzünden KIRMIZI kalacak; F-006'nın kendi dosyalarının hepsi (write-gate.ts,
dağıtıcı, writeFetch, statik tarama, manifest testi) yeşil ve bağımsız doğrulanabilir durumda.

## 2026-09-05 — bilgilendirme (devralan developer, F-007 kod turu tur 2) — `tests/e2e/shell.spec.ts` sözleşme dışı ama beklenen güncelleme

**Görev:** CEO'nun devraldığı beş E2E hatasından biri `shell.spec.ts:9` idi — F-007 App.tsx'i
gerçek `tablist` desenine çevirince (Karar 1, §6 madde 1: `aria-current` kaldırıldı, yerine
`aria-selected` geldi; iki gerçek `role="tab"` span'i eklendi) bu dosyanın F-005 döneminden
kalan "tek tıklanabilir öğe" / "tam olarak bir `aria-current`" iddiaları eskidi.

**Kontrol:** `docs/qa/F-007-contract.md` §2.1/§2.2 dosya listesinde `tests/e2e/shell.spec.ts`
**yok** — dosya sahipliği F-001/F-005'te. CEO'nun görev talimatı bu durumu zaten öngörmüştü
("5 numaralı hata shell.spec.ts'i gerektiriyor — sözleşmede var mı kontrol et; yoksa
blockers.md'ye yazıp devam et, bu beklenen bir güncelleme").

**Yapılan:** Durdurulmadı (CEO'nun kendi talimatı "devam et" diyordu). Assert'ler yeni gerçeğe
göre güncellendi, ölçme niteliği korundu (`CLAUDE.md` "hâlâ ölçen bir iddia" kuralı):
- `clickableCount` artık 1 değil **3** bekliyor (`header [role=tab]` seçiciye eklendi) — iki
  sekme + Ayarlar düğmesi.
- `ariaCurrentCount` artık **0** (App.tsx `aria-current` hiç yazmıyor).
- Yeni assert: tam olarak bir `[role="tab"][aria-selected="true"]` var ve metni "Zaman
  Çizelgesi" (varsayılan seçili sekme).
- `tabRoleCount` artık 0 değil **2**.

**Durum:** `npx playwright test tests/e2e/shell.spec.ts` = 0 (2/2). Ürün kodu
(`src/web/App.tsx`) bu turda **değiştirilmedi** — yalnızca test dosyası F-007'nin zaten
sözleşmede onaylı `App.tsx` değişikliğine (§2.2) uyacak şekilde güncellendi. Bloklayıcı değil,
bilgilendirme amaçlı kayıt.

## 2026-09-05 — KAPANDI (devralan developer, kod turu)

CEO onayı feature notuna ("İkinci genişletme") yazıldı; üç dosya mekanik olarak düzeltildi
(yalnızca `x-mc-write: '1'` header'ı eklendi, gerçekte ~15 çağrı sitesi çıktı — tahmin edilenden
fazla ama hepsi aynı sınıf). `npm run verify` = 0 (538/538), `npm run e2e` = 0 (15/15), `npm run
e2e:dev` = 0 (1/1). Detay: `docs/progress.md` "2026-09-05 — F-006 kod turu tamamlandı" bölümü.

## 2026-09-06 — bilgilendirme + açık madde (developer, F-012 QA tur2 düzeltme turu) — Ö6 geçmiş yazma amplifikasyonu, bir sonraki feature'a devrediliyor

**Görev:** `docs/qa/F-012-2026-09-06-tur2.md` Ö6'yı "kabul edilebilir sapma (koşullu)" olarak
kapatıyor; koşul (a) ölçülen rakamların `ADR-014`'e yazılması (yapıldı, "Kabul edilen riskler"
madde 4), (b) bu maddenin `docs/blockers.md`'ye açık madde olarak girmesiydi (bu kayıt).

**Durum (davranış DEĞİŞMEDİ, yalnızca ölçüldü ve belgelendi):** `session.ts` her
`content_block_delta`'da BİRİKMİŞ metnin TAMAMINI yeni bir `history.jsonl` satırı olarak
yazıyor. Ölçülen: 6.000 karakterlik tek bir CEO cevabı → 302 satır / 956.300 bayt (~159×
amplifikasyon). Ayrıca `history-log.ts`'in `entries` dizisi bellekte **sınırsız** birikiyor,
`init()` tüm dosyayı `readFileSync` ile okuyor, `readPage()` her çağrıda tüm diziyi katlıyor.

**Neden bu turda düzeltilmedi:** Yazma sıklığını kısıtlamak (ör. zaman/delta-sayısı ile
sınırlama, yalnızca `finalizeTurn`'de tam metni yazma) `markDanglingAsInterrupted`'ın
restart-sonrası davranışını etkileyebilir (kısmi metin kaybı riski) — bu bir dayanıklılık
tasarım kararı, aceleyle yapılırsa yeni bir hata sınıfı riski taşır. F-012'nin dosya sahipliği
(`src/features/chat/**`) bu turun kapsamı (Y1/Y2/Y3/Y4) için zaten yeterince genişti.

**İstenen aksiyon:** Bir sonraki feature (veya ayrı bir teknik borç feature'ı) `history-log.ts`
için (1) yazma sıklığı sınırlaması + restart-sonrası dayanıklılık tasarımı, (2) `entries` için
ring buffer (jsonl-store.ts emsali) tasarlasın. **Yeniden ele alınma eşiği** (`ADR-014` madde 4):
gerçek kullanımda tek bir günlük `history.jsonl` 10 MB'ı aşarsa veya sunucu açılış gecikmesi
gözle görülür hâle gelirse.

**Durum:** F-012'yi bekletmiyor (QA'nın kendi kararıyla koşullu kabul edildi); yalnızca bir
sonraki feature'ın planlamasına bilgi taşıyor.

## 2026-09-06 — bilgilendirme + açık madde (developer, F-012 QA tur3 dar kapsamlı düzeltme turu) — Ö7 araç/agent satırları yenilemede kaybolur, `docs/03-ux.md:327` ile çelişir

**Görev:** `docs/qa/F-012-2026-09-06-tur3.md` §6 Ö7'nin kalanını "kabul edilebilir sapma
(bloklayıcı değil)" olarak kapatıyor; QA'nın kararı `ADR-014`'ün "Kabul edilen riskler"
bölümüne (yapıldı, madde 5) ve bu dosyaya açık madde olarak girmesini şart koşuyordu.

**Durum (davranış DEĞİŞMEDİ, yalnızca ölçüldü ve belgelendi, kod değişmedi):**
`docs/03-ux.md:327` alt agent durum satırı için "kalıcı kalır (silinmez) — kullanıcı geçmişe
döndüğünde hangi agent'ın ne zaman çalıştığını görebilir" diyor. Gerçek davranış: sayfa
yenilenince yalnızca `kind:'text'`/`'error'` transkript girdileri (`GET /api/chat/history`
üzerinden) geri geliyor; `kind:'tool'` araç/agent özet satırları (`✓ Bash tamamlandı (…)` gibi)
istemci tarafında yeniden çizilmiyor.

**Ne kayboluyor:** yalnızca araç/agent durum satırlarının EKRANDAKİ görünümü. Kullanıcı
balonları, CEO'nun nihai cevabı ve tur-içi hata satırları yenilemeden sonra da eksiksiz kalıyor
(QA canlı ölçtü, `docs/qa/F-012-2026-09-06-tur3.md` §6).

**Verinin nerede durduğu:** kaybolmuyor — `history.jsonl`'e `kind:'tool'` olarak yazılıyor ve
diskte duruyor (bkz. `session.ts`/`history-log.ts`). Yalnızca istemcinin `useChatSession.ts`
geçmiş-yükleme/render yolu bu girdi tipini şu an atlıyor.

**Neden bu turda düzeltilmedi:** Bu tur kullanıcı tarafından yalnızca Y1 (bekleyen izin
yenilemede kaybolması) + Y3 (canlı hook testi) için dar kapsamlı onaylandı; Ö7 QA'nın kendi
kararıyla zaten "bloklayıcı değil" sayılmıştı ve görev tanımı açıkça "kod değiştirme, yalnızca
belgele" diyordu.

**Yeniden ele alınma eşiği:** bir sonraki sohbet ekranı feature'ında (ör. Thread/derin detay
ekranı F-010, ya da `history-log.ts`'in `kind:'tool'` girdilerini de fold edip render etmesi)
ele alınmalı. O zamana kadar `docs/03-ux.md:327` ile gerçek davranış arasında bilinen, kabul
edilmiş bir sapma vardır.

**Durum:** F-012'yi bekletmiyor (QA zaten "bloklayıcı değil" kararı vermişti); yalnızca bir
sonraki feature'ın planlamasına bilgi taşıyor.

## 2026-09-08 — F-013 devreden açık madde (NOT, bloklayıcı değil)

**N6 — klavye odağı çiti gerçekte ölçmüyor.** `tests/e2e/kanban.spec.ts`'teki K6 assert'i
`scrollBox.focus()` kullanıyor; Playwright odağı CDP ile **zorla** verdiği için "klavyeyle
odaklanabilir" iddiası doğrulanmıyor. QA ölçtü: `tabIndex={0}` silinse bile test **yeşil kalıyor**
(mutasyon M6).

**Neden bloklayıcı değil:** ürün davranışı bozulmuyor — `<summary>` öğeleri doğal olarak
odaklanabilir, kullanıcı içeriğe klavyeyle ulaşabiliyor (QA 14 odaklanabilir öğe ölçtü,
`PageDown` 399px kaydırdı).

**Neden yine de kapatılmalı:** bu, deponun tekrar eden hata sınıfı — çit duruyor, yeşil görünüyor,
hiçbir şey ölçmüyor. Bir regresyon fark edilmeden geçebilir.

**Kapatma yolu:** `page.keyboard.press('Tab')` + `document.activeElement` assert'i.
**Eşik:** Kanban ekranına dokunan bir sonraki feature.

**2026-09-10 güncelleme (developer, F-010 düzeltme turu, X4) — AYNI SINIF Thread ekranında da
tekrarladı ve ORADA kapatıldı; bu maddenin kendisi (Kanban/`kanban.spec.ts`) AÇIK kalıyor.**
QA'nın F-010 kod turu raporu (`docs/qa/F-010-2026-09-10.md` M7) tam bu deseni Thread ekranında
(`ThreadScreen.tsx` `tabIndex={0}`) da buldu: `tabIndex` kaldırılınca 1210/1210 yeşil kalıyordu.
`tests/e2e/thread.spec.ts`'e `page.keyboard.press('Tab')` + `document.activeElement` ile GERÇEK
klavye odağını ölçen bir test eklendi (`.focus()` KULLANILMADI); mutasyon (tabIndex kaldırma)
elle uygulanıp KIRMIZI görüldü, geri alındı. **Bu, N6'nın kapatma yolunun artık bu depoda
kanıtlanmış bir örneği var demek — ama `kanban.spec.ts`'in kendisi F-010'un dosya sahipliği
DIŞINDA (`src/features/thread/**` + ilgili testler) olduğu için DOKUNULMADI.** N6'nın orijinal
eşiği ("Kanban ekranına dokunan bir sonraki feature") hâlâ geçerli ve karşılanmadı — bu madde
tam olarak kapanmadı, yalnızca aynı sınıfın bir başka örneği (Thread) kapandı.

## 2026-09-09 — Kanban'da yakalanmamış asenkron çağrı (F-008 tur A'da bulundu)

**Bulgu:** `handlePatchFeatureStatus`, `projectsService.list()` çağrısını kendi asenkron
`try/catch`'inin **dışında** yapıyor. Bu, `CLAUDE.md`'de kayıtlı ve sunucuyu **üç kez** öldüren
hata sınıfı: dağıtıcının senkron hata sınırı asenkron handler gövdesini yakalamıyor; fırlarsa
istemci yanıt almaz ve süreç düşer. Tetikleyici egzotik değil — Windows'ta antivirüs kilidi,
salt-okunur disk, ağ sürücüsü.

**Nasıl bulundu:** F-008 sunucu turu aynı sınıfı kendi kodunda (Q6 kararı gereği) önlerken
kanban'daki emsalini fark etti. **Dosya sahipliği dışı olduğu için dokunulmadı** — doğru davranış.

**Durum:** F-008'i bekletmiyor. **Eşik:** F-008 kod turu B ile birlikte kapatılacak
(CEO açıkça yetkilendirdi); orada da kapanmazsa kanban'a dokunan bir sonraki feature.

**Çit:** düzeltme mutasyonla kanıtlanmalı — `list()` fırlatıldığında istemci **500 almalı** ve
süreç **ayakta kalmalı**; korumayı kaldıran mutasyon KIRMIZI vermeli.

## 2026-09-09 — KAPANDI (developer, F-008 kod turu B, CEO'nun EK YETKİSİ R5 ile)

`src/features/kanban/server/handlers.ts` `handlePatchFeatureStatus` — `projectsService.list()`
çağrısı ve proje arama, `void (async () => {try{...}})()` sarmalayıcısının **içine** taşındı
(gates handler'larının Q6 desenindeki AYNI çözüm). Yeni regresyon testi
`tests/integration/features-api.test.ts` "MUTASYON hedefi (R5)" — `projectsService.list()`'i
fırlatacak şekilde mock'layıp `PATCH /api/features/...` çağırıyor, 500 `write_failed` + süreç
ayakta kalıyor mu ölçüyor.

**Mutasyon kanıtı:** düzeltme geçici olarak geri alınıp (`list()` tekrar IIFE dışına taşındı) yalnız
bu test izole çalıştırıldı → **KIRMIZI**: `Test timed out in 5000ms` + `Uncaught Exception: ÇOK
GİZLİ İÇ HATA, İSTEMCİYE SIZMAMALI` (tam da bloklayıcının tarif ettiği "istek asla yanıtlanmaz"
davranışı, gerçek bir yakalanmamış istisna olarak gözlendi). Düzeltme geri konunca aynı test
**YEŞİL** (500 `write_failed`, ham mesaj sızmıyor, ardından `/api/health` 200 dönüyor — süreç
yaşıyor). `grep -n "MUTASYON PROBU" src/` boş, `git diff` üzerinde mutasyon izi yok.

## 2026-09-09 — `npm run e2e:dev` kırmızı (proje borcu, F-008'e ait DEĞİL)

**Bulgu (kaynak: `docs/qa/F-008-2026-09-09.md` §4 Bulgu 3):** `npx playwright test -c
playwright.dev.config.ts` **2/2 koşuda başarısız** — `dev-shell.spec.ts:22`, Vite `/api` proxy'si
**500** dönüyor çünkü `npm run dev`'in başlattığı `dev:server` (`concurrently` + `tsx watch`)
**hiç dinlemeye başlamıyor** (`ECONNREFUSED 127.0.0.1:7433`).

**F-008'e ait olmadığının kanıtı (QA'nın dört ayrı ölçümü):**
1. `npm run dev:server` **tek başına** çalıştırıldığında sorunsuz dinliyor
   (`Mission Control API 127.0.0.1:7433 adresinde dinliyor.`).
2. `npx tsx watch src/server/index.ts` **tek başına** de sorunsuz çalışıyor.
3. F-008'in kendi gates izleyicisi devre dışı bırakıldığında (`service.ts:128`
   `startWatchingGatesIfPossible(record)` mutasyonu) **yine dinlemiyor** — F-008 kodu sebep değil.
4. Boş bir `MC_DATA_DIR` ile (hiç proje kaydı yok, dolayısıyla F-008'in hiçbir kodu tetiklenmeden)
   **yine dinlemiyor**.

Süreç tablosunda `tsx watch` çocuğu **yaşıyor** ama hiçbir portu dinlemiyor — `concurrently` +
`tsx watch` bileşiminin bu makinede takıldığı bir altyapı sorunu, F-008 öncesine ait.

**Durum:** F-008'i bekletmiyor (QA kararı: KARAR GEÇTİ, bu bulgu F-008'in kararını etkilemiyor).
`npm run e2e` (prod build, `playwright.config.ts`) **etkilenmiyor** — yalnızca `e2e:dev`
yapılandırması (dört E2E yapılandırmasından biri) kırmızı.

**Kapatma yolu:** `concurrently`/`tsx watch` sürüm veya yapılandırma incelemesi (ör.
`tsx watch`'ın Windows'ta dosya izleyici başlatma sırasını `concurrently`'nin `--kill-others`
davranışıyla çakışması ihtimali) — bu turda araştırılmadı, kapsam dışı.
**Eşik:** `npm run dev`/`dev:server` betiklerine dokunan bir sonraki feature ya da devops görevi.

## 2026-09-09 — F-008 kapanışından taşınan iki borç

### 1. Kanonik olmayan harfli kapı dosyası yazmayı KALICI 500'e düşürüyor (ÖNEMLİ)

**Bulgu:** `docs/approvals/` içinde `g2.ok` gibi kanonik olmayan harfli bir dosya varsa, yazma
kapısı kalıcı olarak **500** veriyor (`src/server/write-gate.ts:95-120` — `realpathSync.native`
kanonik adı döndürüyor ama `OPERATION_PATTERNS` **harfe duyarlı**, eşleşme kopuyor).

**Bu turun ürünü değil:** `git log` son dokunuşu `dc0a02b` (F-007) gösteriyor. **Ama F-008'in S2
düzeltmesi tek ipucunu kaldırdı** — panel artık `g2.ok`'u "tanınmayan dosya" olarak göstermiyor,
kanonik `G2` olarak normalize ediyor. Yani kullanıcı neden 500 aldığını anlayamaz.

**Kullanıcıyı nasıl etkiler:** elle (ya da başka bir araçla) küçük harfli bir onay dosyası
oluşturulmuşsa, o projede **hiçbir kapı yazılamaz** ve sebebi görünmez.

**Eşik:** `write-gate.ts`'e dokunan bir sonraki feature; ya da kullanıcı bu 500'ü yaşarsa **hemen**.
**Çit:** kanonik olmayan harfli dosya varken yazmanın **başarılı** olduğunu (ya da **anlaşılır**
bir hata verdiğini) ölçen test + korumayı kaldıran mutasyonun KIRMIZI vermesi.

### 2. `.toUpperCase()` normalizasyon katmanı çitsiz (ÖNEMLİ)

**Bulgu:** QA'nın M4 mutasyonu (`gate-id.ts`'te `.toUpperCase()` kaldırılır) **1077/1077 yeşil**
kaldı. Mutantta panel aynı kapıyı **iki satırda** gösteriyor (`G2` + `g2`) ama hiçbir test bunu
yakalamıyor — S2 testleri tam küme eşitliği istemiyor.

**Sınıf:** bu deponun tekrar eden hatası — çit duruyor, yeşil görünüyor, hiçbir şey ölçmüyor.
S2'nin **iki katmanı** var (desen `i` bayrağı + kimlik normalizasyonu); yalnızca birincisi çitli.

**Eşik:** kapılar ekranına dokunan bir sonraki feature.
**Çit:** kapı listesinin **tam küme** eşitliğini doğrulayan test (bunlar ve başkası değil).

## 2026-09-09 — F-009 kapanışından taşınan beş borç (hiçbiri bloklayıcı değil)

QA üç turda çiti iki kez yendi; üçüncüde **pratik sızıntı sıfır**a indi (kontrol sondaları —
Türkçe düz metin, İngilizce prompt, aksanlı Latin — her seferinde reddedildi). Geçen vektörler
yalnızca **teorik bit taşıyor**, okunabilir metin taşımıyor. Kalanlar:

1. **Tokenizer charset'i dışındaki baytlar hiç denetlenmiyor.** Kiril/CJK karakterler token
   üretmiyor → beyaz listeye hiç uğramıyor. Bu depoda içerik Türkçe/İngilizce olduğu için pratik
   risk düşük. **Eşik:** fixture setine Latin dışı içerik girerse **hemen**.
2. **`.gitattributes` muafiyeti ADA bağlı, YOLA değil.** Alt dizindeki aynı adlı dosya taranmıyor.
3. **Yedi desenden dördü çitsiz** (semver, sürücü harfi, msg-id, iki nokta): tek tek gevşetildiğinde
   54/54 yeşil kalıyor. Çıplak sayı / ISO / UUID çitli.
4. **Sözleşme §7.1'in "4+ haneli her sayı reddedilir" cümlesi sınıf düzeyinde yanlış** —
   ISO 15 hane, semver 9, msg-id 4 hane geçiyor. Belge düzeltilmeli.
5. ~~**`record()` hâlâ tüketicisiz**~~ — **KAPANDI (2026-09-09, F-010).** `handleThreadDetail`
   şimdi `transcriptReaderStats`'ı (`/api/health` ile PAYLAŞILAN örnek) her gerçek transkript
   okumasından sonra `.record()` ile besliyor. Kanıt: `tests/integration/thread-api.test.ts`
   "W2" bloğu + mutasyon (satır yorumlanınca sayaç testi TEK BAŞINA KIRMIZI, geri alındı).

**Ortak eşik:** F-010 transkript okuyucusunu üretimde kullanmaya başladı (5 kapandı); 1 ve 3 hâlâ
açık, bir sonraki transkript-okuyucuya dokunan feature'da birlikte ele alınmalı. 2 ve 4 belge/
yapılandırma düzeltmesi, bağımsız kapatılabilir.

## 2026-09-10 — F-010 kapanışından taşınan borçlar (hiçbiri bloklayıcı değil)

### D8/D9 — Eskalasyon rozeti: başlık bloğunun iki kenar durumu
Rozet artık yalnızca **başlık bloğunu** tarıyor (ilk `---` öncesi ya da ilk 5 satır). QA iki kenar
buldu, **bugün hiçbir gerçek dosyada tetiklenmiyor**:
- Frontmatter'sız ve ilk `---` çok aşağıdaysa (bu depoda başlık blokları **0-45 satır** arasında
  ölçüldü) blok şişiyor ve **alıntı yine sızabiliyor**.
- Frontmatter **ilk satırdaysa** gerçek `ESKALE: true` **kaçırılabiliyor**.
**Eşik:** QA rapor şablonu değişirse ya da rozet yanlış çıkarsa **hemen**.
**Çit:** her iki kenar için sonda + deseni gevşeten mutasyonun KIRMIZI vermesi.

### D10 — 640-767px ve 280px'te sıfır genişlikli sekme — **KAPANDI (2026-09-09, F-011)**
Eşik gerçekleşti: F-011 altıncı sekmeyi (Token) ekledi. Kırılma noktası `sm:` (640px)'ten
`lg:` (1024px)'e taşındı — dar/orta genişlikte (<1024px) sekme çubuğu artık başlık/Ayarlar ile
aynı satırı PAYLAŞMIYOR, kendi tam-genişlik satırında (`order-3 w-full`, `src/web/App.tsx`).
**Ölçüldü** (`tests/e2e/usage.spec.ts`, gerçek Chromium, üretim 6-sekme kümesi — Sohbet dahil):
320/375/480/640/700/767px'in HEPSİNDE 6 sekmenin (Zaman Çizelgesi/Kanban/Sohbet/Kapılar/Thread/
Token) kırpılmış görünür genişliği **0px değil**. `tests/e2e/thread.spec.ts`'in eski "5 sekme,
320-480px" bloğu da 6 sekmeye güncellendi (mekanik). 280px AYRICA test edilmedi (contract'ın
kapsadığı aralık 320-767px, PRD'nin birincil senaryosu ≈320-480px) — 280px'in hâlâ 0px verip
vermediği bilinmiyor, dürüstçe açık bırakılıyor.
**Çit:** `tests/e2e/usage.spec.ts` "D10 kapatma (Y6)" bloğu — dar-genişlik CSS override'ı
(`lg:` sınıfları `sm:`'ye geri alınması) mutasyonuyla 640/700/767px'te KIRMIZI verdiği
doğrulandı (developer turu, F-011 sözleşmesi §3 B7).

### Ö7 — Ölü `retry` API'si
`src/features/thread/web/useProjectFeatureList.ts:41-43` — kullanılmayan `retry`; ayrıca D3'te
bayat bir yorum duruyor. **Eşik:** `src/features/thread/**` dosyasına dokunan bir sonraki feature.

## 2026-09-10 — ⚠ YÜKSEK ÖNCELİK: test takımı sessizce test atlıyor (proje geneli)

**Bulgu (F-011 QA turu):** Üç `vitest` koşusunun **ikisinde** "Worker forks emitted error"
nedeniyle **10-16 test hiç koşmadan** kaldı — ve süreç yine **çıkış kodu 0** döndü.

**Neden bu kadar ciddi:** Bu, deponun en pahalı hata sınıfının **altyapı seviyesindeki** hâli.
Bugüne kadar verilen her "`verify` = 0, N test yeşil" raporu, aslında **koşmamış testler**
içeriyor olabilir. Yeşil bir koşu artık tek başına kanıt sayılamaz.

**Bilinen ve ayrı olan:** `exit code 3221226505` ile **kırmızı** veren worker-fork kararsızlığı
(`CLAUDE.md`'de kayıtlı, beş kez görüldü). Bu **farklı**: orada koşu kırmızı veriyor ve fark
ediliyor; burada koşu **yeşil** veriyor ve testler sessizce düşüyor.

**Kapatma yolu (öneri):** koşulan test sayısını **beklenen sayıyla** karşılaştıran bir kontrol —
`vitest` çıktısındaki toplam, bilinen alt sınırın altındaysa `verify` **kırmızı** versin.
Alternatif: worker havuzu yapılandırmasını değiştirip hatayı kırmızıya çevirmek.

**Eşik:** F-011 kapandıktan **hemen sonra**, ayrı bir devops/altyapı turu olarak.
Bu kapanana kadar "testler yeşil" ifadesi **koşulan test sayısıyla birlikte** raporlanmalı.

## 2026-09-09 — F-011 tur 5 kapanışından taşınan borçlar (bloklayıcı DEĞİL, karar: bu turda düzeltilmedi)

Kaynak: `docs/qa/F-011-2026-09-10-tur5.md` §4/§7. BB1/BB2 (sentinel öz-testi, `process.binding`
kuşatması) bu turda kapatıldı; aşağıdaki ikisi kasıtlı olarak **dokunulmadan** bırakıldı çünkü
brief kapsamı "iki madde, ~11 satır" ile sınırlıydı ve ikisi de bloklayıcı değil, fail-closed
yönde.

- **Yanlış pozitif (4/4) — `network-capability-guard.test.ts`'in metinsel katmanı:** ürün
  koduna yalnızca bir **yorum satırı** eklemek (`// Bu dosya fetch() cagrisi yapmaz.`,
  `require()`, `Function()`, dizgede `import(`) çiti KIRMIZI yapıyor — 4 ayrı biçimde ölçüldü.
  Güvenlik riski değil (fail-closed), ama tekrarlarsa "güvenlik ihlali" mesajıyla CI kıran bir
  yanlış alarm; `stop-check` gürültüsüyle aynı sınıf. **Eşik:** bu dosyaya (`FORBIDDEN_CALL_
  PATTERNS`/`FETCH_CALL_RE`/`DYNAMIC_IMPORT_RE`) dokunan bir sonraki tur, ya da yanlış alarm
  3. kez gerçek bir geliştiriciyi durdurduğunda. **Düzeltme yönü:** AST zaten elde var
  (`extractModuleSpecifierRefs`) — desenleri yorum/dizge trivia'sı çıkarılmış metne uygula.
- **M5 — giriş uzantı listesi kapsaması test edilmiyor:** `SOURCE_ENTRY_EXTENSIONS`'ı `['.ts']`'e
  indiren mutasyon `network-capability-guard.test.ts`'te **52/52 YEŞİL** kalıyor; `.mts`/`.cts`
  bir **giriş** dosyası olarak eklenirse sessizce taramadan düşer (bugün `usage/server` yalnızca
  düz `.ts` içerdiği için gerçek risk yok). **Eşik:** `usage/server`'a ilk `.mts`/`.cts` giriş
  dosyası eklendiğinde. **Düzeltme yönü:** fixture dizininde `.mts` giriş dosyası kurup
  `listSourceEntriesRecursively`'ye doğrudan assert eden ucuz bir kalıcı test.
