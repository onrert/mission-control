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

## 2026-09-05 — KAPANDI (devralan developer, kod turu)

CEO onayı feature notuna ("İkinci genişletme") yazıldı; üç dosya mekanik olarak düzeltildi
(yalnızca `x-mc-write: '1'` header'ı eklendi, gerçekte ~15 çağrı sitesi çıktı — tahmin edilenden
fazla ama hepsi aynı sınıf). `npm run verify` = 0 (538/538), `npm run e2e` = 0 (15/15), `npm run
e2e:dev` = 0 (1/1). Detay: `docs/progress.md` "2026-09-05 — F-006 kod turu tamamlandı" bölümü.
