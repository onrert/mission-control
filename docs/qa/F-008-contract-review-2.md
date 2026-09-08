---
feature: F-008
title: Sözleşme kapanış denetimi — Kapılar paneli (tur 2)
author: qa-evaluator
type: contract-review
date: 2026-09-09
---

# F-008 sözleşme denetimi — tur 2 (kapanış, dar kapsam)

**KARAR: KALDI** · **ESKALE: false**

Kod yok; belge denetimi. `git status --porcelain` boş — `src/`, `tests/`, `package.json` altında
hiçbir dosya değişmedi. Denetlenen belge: `docs/qa/F-008-contract.md` (691 satır, commit `801b834`).

Kapsam (CEO brief'i uyarınca dar): tur 1'in 6 bloklayıcı + 11 önemli bulgusunun kapanışı, N1/N2/N4/N5
kararlarının gövdeye yayılması, mutasyon listesinin totolojisizliği, belge içi çelişki. Tur 1'de
onaylanan bölümler (L4 cevabı, statik çit kapsamı, `x-mc-write`, hata sınırı deseni, `@source` çiti)
yeniden açılmadı.

**Sözleşme tur 1'e göre belirgin biçimde daha iyi.** Altı bloklayıcının **dördü tam kapandı** (B1,
B2, B3, B4, B6), on bir önemli bulgunun dokuzu kapandı, ikisi gerekçeli red/kısmi. Karar KALDI'da
kalıyor çünkü **B5 hâlâ açık** (ölçtüm: planda olmayan dört kırık iddia, biri hiç anılmayan bir
dosyada) ve yeni eklenen **M6 mutasyonunun iddiası ters yazılmış** — doğru uygulamada KIRMIZI,
mutantta YEŞİL verir, üstelik §6'nın yarı-başarı semantiğiyle çelişir.

**Açık bulgu sayısı: 2 bloklayıcı (B5 devam, Y2 yeni) · 1 önemli (Ö4 kısmi) · 4 not**

---

## 1. Tur 1 bulgularının kapanış tablosu

### Bloklayıcılar

| # | Durum | Kanıt |
|---|---|---|
| **B1** — L5'in kapsamı (`Write` yolu) | **KAPANDI** | §8 tamamen yeniden yazıldı (`F-008-contract.md:426-482`). N1 birebir yayılmış: iki yol ayrı ayrı işleniyor (satır 453-459), ölçüme dayanıyor (`docs/qa/F-008-write-izin-olcumu.md:12-25, 43-70` — iki yönlü canlı probe, `WRITE_CARD_FIRED: true`, sandbox `docs/` boş kaldı), dürüst sınır cümlesi var (satır 461-469: "kabuk erişimli yerel bir agent'a karşı … mutlak değil … anlamı, kapı dosyasını yazan HER yolun izin kartından geçtiğidir"). `ADR-014-*.md:176` "Ek — `Write` de izin kartına uğruyor (ölçüldü, 2026-09-09)" gerçekten mevcut. Tur 1'in statik zinciri artık "mantıken tutarlıydı ama çalışma zamanı geçersiz kılıyor" diye kayda geçmiş. |
| **B2** — M1 hook kararı yayılmamıştı | **KAPANDI (N2 ile iptal)** | `:62-64` kapsam dışı, `:471-476` M1 iptal gerekçesi (koşulsuz metin eşleşmesinin bu depoda iki kez ısırması dâhil), `:572-578` "dokunulmayacak" listesinde `.claude/hooks/**`, `:649-661` eski yer tutucu M10 ile değiştirilmiş. `.claude/hooks/**` belgede başka hiçbir yerde ödev olarak geçmiyor. |
| **B3** — Türkçe metinler + yanlış öncüller | **KAPANDI** | §9 (`:485-522`) gerçekten var (tur 1'de haritada gösterilip gövdede yoktu); metinler `docs/03-ux.md:459/466/516/202`'den **kaynak alınmış**, yeniden icat edilmemiş (birebir kontrol ettim: 516'daki üç metin, 459/466'daki iki toast dizgesi aynen). ★ işaretli altı yeni metin listelenmiş ve "kod turundan önce" şartı yazılmış. Tur 1'in §11.2/§11.3 soruları §12'de kapatılmış. Satır bazlı hata izolasyonu §3'e eklenmiş (`:172-176`), UX'in satır bazlı şartını (`03-ux.md:516` "Bozuk tek dosyada yalnız o satır") karşılıyor. |
| **B4** — `gates.spec.ts` hiçbir koşuda çalışmaz | **KAPANDI** | `:567` `playwright.config.ts`'in `testMatch`'ine `'gates.spec.ts'` ekleniyor. Guard'ın nasıl çalıştığını açıp doğruladım: `tests/e2e-config-guard.test.ts:31-33` spec'leri `readdirSync` ile diskten sayıyor, `:35-45` config'leri repo kökünden `readdirSync` ile buluyor, `:59-68` her spec adının **en az bir** config **metninde** geçmesini arıyor (OR mantığı, düz `includes`). `testMatch` dizisine literal dosya adı eklemek guard'ı gerçekten yeşil bırakır. Ayrıca `playwright.config.ts:28` `command: 'npm run build && npm start'` iddiası da ✓ doğru (üretim build'i). |
| **B5** — dördüncü sekme mevcut sayaç çitlerini kırıyor | **AÇIK (kısmi)** | Aşağıda Y1. Verilen üç değer doğru, ama **dört kırık iddia daha var** ve biri hiç anılmayan bir dosyada. |
| **B6** — aksiyon durum makinesi / "onaylı kapı reddedilir" | **KAPANDI** | §4'ün tablosu (`:220-225`) `docs/03-ux.md:202-207` mockup'ıyla **birebir**: `approved` → `(kilitli)`, `denied` → `[Onayla]`, `conflict` → `[Detay]`, `pending` → `[Onayla] [Reddet]`. Sunucu çiti: onaylı kapıda `deny` → 409 `conflict`, dosya yazılmaz (`:223, :279-281`), UX+`ADR-001` karar 7+PRD AC9 üçlüsüne uygun. `[Detay]` tanımlı (`:244-250`, genişleyen salt okunur alt satır + sabit not). Yeniden onay gerilimi ADR-005 madde 9 ile karara bağlanmış (`:234-242`); ADR-005:33'ün gerçek metnini okudum, alıntı **birebir doğru** ("mevcut bir `.ok` üzerine yeniden onay yazmak açık bir kullanıcı eylemidir"). Yeni `ErrorCode` gerekmediği iddiası da doğru (`conflict` mevcut). |

### Önemliler

| # | Durum | Kanıt / not |
|---|---|---|
| Ö1 — ASSETS ayrıştırması, sıralama, "7 satır birebir" | **KAPANDI (bir kalıntı hariç)** | `docs/PROCESS.md:29` ilk hücresi gerçekten çıplak `ASSETS` (etiketsiz) — yeni desen `^(\S+)(?:\s+(.+))?$` bunu kapsıyor (`:118-127`). Sıralama `03-ux.md:192`'ye sabitlenmiş + `G4-N` sayısal sıralama (`:111-116`). "7 satır birebir" hatası açıkça düzeltilmiş (`:133-134`). Kalıntı: N3 (not) — gömülü yedek tablo ASSETS'e "Higgsfield kredi bütçesi" etiketi veriyor, canlı ayrıştırma ise `label = id = "ASSETS"`; iki yol farklı etiket üretiyor. Ayrıca UX'in "8 satır iskelet"i ile 7 satırlık katalog uyumlanmadı (belgede "iskelet" kelimesi hiç geçmiyor). İkisi de kozmetik. |
| Ö2 — `unrecognized` çöp + kendi `.tmp`'si | **KAPANDI** | `:141-154` açık hariç tutma kümesi (`README.md`, `archive/`, `DANGER.ok`, `PUSH.ok`, `.gitkeep`, `^\.`/`.tmp`), dizin girdileri `isDirectory()` ile eleniyor, **aynı küme izleyicide de** uygulanıyor. Bugünkü gerçek dizin içeriğini yeniden ölçtüm: `G0.ok G1.ok G2.ok G3.ok G4-1.ok README.md` — kümenin kapsadığı tek kalıcı girdi `README.md`, doğru. |
| Ö3 — izleyici yaşam döngüsü | **KAPANDI** | `:404-419` — ayrı `gatesWatchers` map'i, `startWatchingGatesIfPossible`, `removeProject`'te `stop()`, `getActiveWatcherCount()` toplamı; `service.ts` §10.2'ye (`:561`) eklendi. Kalan boşluk (dizin sonradan oluşursa) §12'de **açık soru** olarak dürüstçe bırakılmış. |
| Ö4 — manifest `mtime` körlüğü | **KISMİ (Y3)** | (a) `before` anlık görüntüsünün tüm çağrılardan önce alınması ✓ yazılmış (`:548`), (b) `tests/helpers/manifest.ts`'e opsiyonel `includeMtime` ✓ (`:566`; yardımcının bugünkü hâlini okudum — `manifest.ts:11-15` gerçekten `mtimeMs` taşımıyor, ek additive), **ama (c) tur 1'in açıkça istediği `mtime`-only mutasyon listeye eklenmemiş.** Ayrıntı: Y3. |
| Ö5 — mutasyon listesi şişkinliği | **KAPANDI (M6 hariç)** | 4+6 tek maddede birleşmiş (`:616-621`), yer tutucu #7 gitti, dört eksik kategori (M6 sıra, M7 içerik, M8 `data`, M9 broadcast) eklendi. M6'nın iddiası ters (Y2). |
| Ö6 — yanlış çapraz referanslar | **KAPANDI** | Tüm `§n` referanslarını taradım (`grep -n "§[0-9]"`): yeni numaralandırmayla (9 Türkçe metinler · 10 dosyalar · 11 test/mutasyon · 12 açık sorular) tutarlı; tur 1'de listelediğim on yanlış referansın hiçbiri kalmamış. `docs/03-ux.md:207` referansı da doğru satırı gösteriyor (G4-1 çelişkili satırı). |
| Ö7 — AC6 "kod incelemesi notu" | **KAPANDI** | `:591` artık statik guard + `gates-manifest.test.ts`; "kod incelemesi notu" ifadesi belgeden çıkmış. |
| Ö8 — dar genişlik | **KAPANDI** | `:596` 320px/375px vakaları + **kırpılmış görünür genişlik** (`boundingBox` kesişimi), `toBeVisible()` açıkça reddedilmiş (F-007 dersi anılmış). `:553` `gates.spec.ts` planına da girmiş. |
| Ö9 — yarı-başarı arşiv yolu | **KAPANDI** | `:345-362` gerçek arşiv yolu mesaja gömülüyor (`archiveDenial`'ın `path` dönüşü kullanılıyor), yeniden denemenin idempotentliği `write-gate.ts:351-353` referansıyla açıkça yazılmış. |
| Ö10 — `gates` SSE yükü ADR-004 madde 5 sapması | **GEREKÇELİ RED (kabul)** | `:381-390` sapmayı açıkça yazıyor, emsalini (`service.ts:99` + `useEventStream.ts:88-93`) gösteriyor, ADR-004 güncellemesini "F-007'den beri var olan, F-008'e ait olmayan borç" sayıp kapsam dışına alıyor. Gerekçe savunulabilir; itiraz etmiyorum. |
| Ö11 — toast + buton devre-dışı | **KAPANDI** | `:512-522` yerel toast kararı (kanban dosyalarına dokunmadan) + iki butonun devre-dışı kuralı `03-ux.md:458/465`'ten alınmış, test planına (`:597`) girmiş. |

### Tur 1 notları
N1 (brief'in yanlış `write-gate.ts` yolu) — sözleşme doğru yolu kullanmaya devam ediyor.
N2 (`mtime` vs içerikteki tarih) — §9 metin tablosuna kenar durum açıklaması olarak girmiş (`:505`).
N3 (`1`-`6` kısayolu yok) — belgede anılmıyor; F-008'in borcu değil, ısrar etmiyorum.
N4 (iyi yapılmış üç şey) — hepsi korunmuş.

---

## 2. AÇIK BULGULAR

### Y1 · BLOKLAYICI · B5 kapanmadı: dört kırık iddia daha var, biri hiç anılmayan bir dosyada
**Nerede:** `docs/qa/F-008-contract.md:568-570` (üç satırlık N3/B5 düzeltmesi) ve `:687-688`.

Sözleşme B5'i "✓ VERIFIED ölçüm, tur 1 QA" diyerek **tur 1'in listesini devralıyor** — ama tur 1'in
listesi eksikti ve bu turda ölçtüğümde dört iddia daha çıktı. Verdiği üç değerin doğruluğunu ayrıca
teyit ettim (dosyaları açtım):

| Dosya:satır | Bugünkü değer | Sözleşmenin dediği | Doğru mu |
|---|---|---|---|
| `tests/web/App.interaction.test.tsx:266` | `toHaveLength(3)` | → 4 | ✓ |
| `tests/e2e/shell.spec.ts:46` | `expect(clickableCount).toBe(3)` | → 4 | ✓ |
| `tests/e2e/shell.spec.ts:60` | `expect(tabRoleCount).toBe(2)` | → 3 | ✓ (E2E'de `MC_CHAT_ENABLED:'0'`, `playwright.config.ts:39`) |
| `tests/web/App.test.tsx:48` | `toHaveLength(2)` | "kod turunda ölçülür, tahmin edilmez" | değer aslında **belirlenebilir**: `src/web/App.tsx:15-20` `buildTabs` Kapılar'ı koşulsuz ekler, `renderToStaticMarkup` efekt çalıştırmadığı için Sohbet yok → **3** |

**Planda hiç olmayan / anılmayan kırık iddialar (ölçüldü):**

1. **`tests/web/App.chat-tab.test.tsx:78` ve `:92`** — `expect(screen.getAllByRole('tab')).toHaveLength(2)`
   (chat kapalı) ve `toHaveLength(3)` (chat açık). Kapılar sekmesi koşulsuz olduğu için ikisi de
   **3 ve 4** olmalı. **Bu dosya sözleşmenin §10.1/§10.2 listelerinin hiçbirinde geçmiyor**
   (`grep -n "chat-tab" docs/qa/F-008-contract.md` → sıfır sonuç). Tur 1'in B5'inin tam olarak
   yasakladığı durum: yeni sekme mevcut sabit sayacı kırıyor, dosya planda yok.
   (Not: `:97` `expect(tabs[2]).toBe(chatTab)` sıra iddiası, Kapılar Sohbet'ten **sonra**
   eklendiği için ayakta kalır — `docs/03-ux.md:735` sırası doğru seçilmiş.)
2. **`tests/web/App.interaction.test.tsx:237-239`** — chat **kapalı** senaryodaki ok tuşu testi:
   `End` → `kanbanTab` seçili + odaklı bekliyor. Kapılar eklenince son sekme Kapılar olur →
   KIRMIZI. Sözleşme yalnızca `:251`'in (chat **açık**, üç sekmeli) `End` testini anıyor;
   aynı dosyadaki ikinci `End` iddiasını atlıyor.
3. **`tests/web/App.test.tsx:22-26`** — `it('Faz 2 ekranları hiç görünmez (Kapılar, Thread, Token)')`,
   `expect(html).not.toContain('Kapılar')`. Sadece sayı güncellemesi değil: testin **öncülü**
   geçersizleşiyor (Kapılar artık Faz 2'den Faz 1 kabuğuna geçiyor). Bu, mekanik değil **doktrin**
   bir değişiklik; sözleşmede tek kelime yok.
4. **`tests/e2e/shell.spec.ts:127-130`** — aynı doktrin iddiasının E2E kopyası:
   `expect(bodyText).not.toContain('Kapılar')`. Yine anılmıyor.

**Neden bloklayıcı:** B5 bir bloklayıcıydı ve kapatma iddiası ölçüme değil, tur 1'in (eksik)
listesine dayandırıldı — `CLAUDE.md`'nin "belgenin öncülünü repo durumuyla doğrula" dersinin
tekrarı. Kod turu ilk `verify`de dört ayrı kırmızıyla karşılaşacak; üçü sayı güncellemesi, ikisi
(3 ve 4) "bu çiti silmeli miyim?" kararı gerektiriyor ve o karar sözleşmede verilmemiş.

**Önerilen düzeltme:** §10.2'ye `tests/web/App.chat-tab.test.tsx` satırını ekle (2→3, 3→4);
`App.interaction.test.tsx` satırına `:237-239`'u ekle (yeni hedef: Kapılar sekmesi);
`App.test.tsx` satırına `:22-26`'yı ekle ve kararı yaz — **"Kapılar" iddiası silinir, Thread/Token
iddiaları korunur** (çiti tamamen silmek Thread/Token korumasını da kaybettirir);
`shell.spec.ts` satırına `:128`'i aynı kararla ekle. `App.test.tsx:48` için **3** değerini şimdiden
yaz (`App.tsx:15-20`'den türetilebiliyor, "kod turunda ölçülecek" demeye gerek yok).

---

### Y2 · BLOKLAYICI · M6'nın iddiası ters yazılmış — doğru kodda KIRMIZI, mutantta YEŞİL verir
**Nerede:** `docs/qa/F-008-contract.md:627-632` (M6), `:345-357` (§6 yarı-başarı) ile çelişiyor.

M6 şunu öneriyor:

> "…ya da daha basiti: `writeGateApproval`'ı geçici olarak başarısız olacak şekilde fault inject
> edip `archiveDenial`'ın **hiç çağrılmadığını** — dosyanın arşive taşınmadığını — assert etmek"

Bu iddia **doğru uygulamada yanlıştır**. Sözleşmenin kendi §4 adım 2-3 ve §6 yarı-başarı
paragrafına göre doğru sıra `archiveDenial` → `writeGateApproval`; yani `writeGateApproval`
başarısız olduğunda `.deny.md` **zaten arşive taşınmıştır** (`:346-347`: "disk durumu şudur:
`.deny.md` artık `docs/approvals/archive/`'de, `.ok` yok"). Dolayısıyla:

| | arşiv çağrıldı mı | M6'nın önerdiği assert |
|---|---|---|
| Doğru kod (arşiv → onay) | **evet**, dosya taşındı | **KIRMIZI** (istemediğimiz) |
| Mutant (onay → arşiv) | hayır (onay başarısız, arşive sıra gelmiyor) | **YEŞİL** (istemediğimiz) |

Yani mutasyon çiti **tam ters** yönde kurulmuş: mutantı yakalamak yerine sağlıklı kodu kırar.
Doğru assert'in yönü: *"onay başarısız olsa bile `.deny.md` arşive taşınmış olmalı; mutantta
taşınmamış kalır"* (ya da M6'nın ilk seçeneği: iki çağrıyı sırasıyla izleyen `vi.fn()` senaryosu —
o doğru, ama "daha basiti" diye sunulan ikinci seçenek belgede kalırsa kod turu onu uygular).

**Neden bloklayıcı:** M6, Ö5'in "AC9 sırasının hiçbir mutasyonu yok" boşluğunu kapatmak için
eklenen **yeni** maddedir; şu hâliyle uygulanırsa ya `verify` sağlıklı kodda kırmızı verir ve
geliştirici "çiti gevşetme" baskısı altında kalır, ya da assert sessizce ters çevrilip AC9 sırası
yine ölçülmemiş olur. Ayrıca belge içi çelişki üretiyor (§6 ile §11 M6 aynı senaryo için zıt disk
durumu söylüyor) — `CLAUDE.md`'nin F-005 dersi (karar gövdeye yayılmayınca çelişki bırakır).

**Önerilen düzeltme:** M6'nın ikinci ("daha basiti") seçeneğini ya sil ya da yönünü düzelt:
fault injection senaryosunda **arşivlemenin gerçekleşmiş olduğu** assert edilir; mutant (ters sıra)
bu assert'i kırar. §6 ile aynı cümleyi kullan ki iki bölüm birbirini doğrulasın.

---

### Y3 · ÖNEMLİ · `includeMtime` yeteneği ekleniyor ama hiçbir mutasyon onu ölçmüyor (Ö4'ün kalan yarısı)
**Nerede:** `:566` (`tests/helpers/manifest.ts` değişikliği), `:548` (`gates-manifest.test.ts`),
§11 mutasyon listesi.

Tur 1 Ö4 üç şey istemişti; ikisi yapılmış (before-snapshot sırası, `mtimeMs` karşılaştırması),
üçüncüsü **atlanmış**: *"Mutasyon listesine `list-gates` okuduğu `.ok`'a `mtime`-only dokunur
vakasını ekle ve hangi testin kırmızı vereceğini belirt."*

On maddenin hiçbiri içerik-nötr bir dokunuşu ölçmüyor. M3 (arşiv → `unlinkSync`) `mtimeMs` olmadan
da kırmızı verir (yol/sha zaten değişiyor), yani paylaşılan yardımcıya eklenen yeni parametrenin
**gerçekten çalıştığını kanıtlayan tek bir mutasyon yok**. Bu, `docs/qa/F-013-2026-09-08-tur2.md:126`
ile ölçülmüş somut hata sınıfının aynısı: M3d (içerik-nötr `appendFileSync`) manifest testinden
**yeşil** geçmişti. `CLAUDE.md`: "ölçmeyen çit, olmayan çitten kötüdür — yeşil güven verir."

**Önerilen düzeltme:** §11'e bir madde ekle — *"`list-gates.ts` okuduğu `.ok` dosyasına
`fs.utimesSync` ile (varsayımsal) `mtime`-only dokunur → `gates-manifest.test.ts` (`includeMtime:true`
ile alınan before/after) KIRMIZI; `sha256`/boyut aynı kaldığı için bu mutasyonu yakalayan **tek**
katman odur."* Bu aynı zamanda AC4'ün (`mtime` tabanlı "hangisi daha yeni") gerçekten korunduğunu
gösteren tek çit olur.

---

## 3. Mutasyon listesi değerlendirmesi (10 madde)

| # | Bağımsız mekanizma | Hangi test | Kaynaktan mı türüyor | Değerlendirme |
|---|---|---|---|---|
| M1 | iki adımlı onay (`confirmed`) | `handlers.test.ts` | L2/AC7 | ✓ |
| M2 | `x-mc-write` (ADR-013) | `gates-api.test.ts` 403 | ADR-013 | ✓ iyi regresyon |
| M3 | arşiv → silme | statik tarama + `gates-manifest.test.ts` | AC9/ADR-001 k7 | ✓ |
| M4 | statik tarama genelliği | `no-write-gate-bypass.test.ts` | F-006 kapısı | ✓ totoloji değil (`no-write-gate-bypass.test.ts:129` `src/`'yi özyinelemeli tarıyor; eski 4+6 tek maddeye indirildi) |
| M5 | red gerekçesi zorunluluğu | `handlers.test.ts` + manifest | AC3/AC8, L7 | ✓ |
| M6 | AC9 sırası | `gates-api.test.ts` | §6 | **✗ ters yazılmış (Y2)** |
| M7 | içerik kırpma/kaçış | `format-approval.test.ts` golden | AC8 "olduğu gibi" | ✓ |
| M8 | yarı-başarı `data` alanı | `gates-api.test.ts` fault injection | §6 | ✓ |
| M9 | `broadcast('gates')` silinmesi | "`gates-watcher.test.ts` **veya** `gates-api.test.ts`" | §7 | ~ hangi dosya olduğu belirsiz; broadcast'i ölçebilecek olan `gates-api.test.ts`'tir (izleyici testi handler'ı hiç çağırmaz). Tek kelimelik düzeltme, bloklayıcı değil. |
| M10 | L5 ölçümünün regresyonu | `gates-write-permission-live.test.ts` | §8 canlı ölçüm | ~ **gerçek bir test, ama mutasyon değil**: kendi kodumuzda bozulunca kırmızı verecek bir çit yok; ölçtüğü şey SDK'nın kendi davranışı (belge bunu dürüstçe söylüyor, `:653-655`). Ayrıca `describe.skipIf` ile `verify` dışında — pratikte yalnızca `MC_GATES_LIVE_TESTS=1` ile koşar, yani sürüm regresyonunu **kendiliğinden** yakalamaz. N7'nin istediği "ölçüm otomatikleşsin" şartını karşılıyor; "mutasyon" başlığı altında sayılması kavramsal olarak yanlış ama zararsız. Model çıktısına assert etmemesi ✓ (`CLAUDE.md` canlı test dersi uygulanmış). |

**Özet:** yer tutucu kalmadı, totoloji kalmadı, dört yeni kategori gerçek boşlukları kapatıyor.
İki kusur: M6 ters (bloklayıcı), `mtime`-only mutasyon eksik (Y3). M9/M10 not düzeyinde.

---

## 4. Çelişki taraması (N1-N7 gövdeye yayıldı mı)

- **N1** — §8'in tamamına yayılmış, §1 madde 6 ve §12'nin doğrulayamadıklarıyla tutarlı. Belgede
  "tek yol `Bash`" tarzı eski cümle **kalmamış** (grep ile kontrol ettim). ✓
- **N2** — §1, §8, §10.2 "dokunulmayacaklar", §11 M10 dördü de aynı şeyi söylüyor; hiçbir yerde
  artık hook önerisi yok. ✓
- **N4** — §1 madde 3, §4 tablosu, §4 `deny` ucu, §9 metin tablosu ("Bu kapı zaten onaylı,
  reddedilemez."), §11 test planı (`handlers.test.ts`/`gates-api.test.ts` 409) birbirini
  doğruluyor. Tur 1'in "engellenmez, bilerek conflict üretir" cümlesi belgede **kalmamış**. ✓
- **N5** — L1-L8 haritası artık var olan bölümlere işaret ediyor (Ö6 kapandı). ✓
- **Bulunan çelişkiler:** (a) **§6 ↔ §11 M6** — aynı fault injection senaryosu için zıt disk
  durumu (Y2, bloklayıcı). (b) §3'ün gömülü yedek etiket tablosu ASSETS'e "Higgsfield kredi
  bütçesi" derken canlı ayrıştırma `label = "ASSETS"` üretiyor (`:123-132`) — aynı satır,
  PROCESS.md okunup okunmamasına göre farklı etiket. Not düzeyi.

---

## 5. NOTLAR

- **N-a · ASSETS etiketi iki yolda farklı** (yukarıda). Tek cümlelik düzeltme: yedek tabloda da
  `ASSETS` → label `ASSETS` olsun, ya da canlı ayrıştırmada tek hücreli satır için ikinci sütun
  (`Ne onaylanır`) etiket olarak kullanılsın. Kod turunda karar verilebilir, sözleşmeyi bloklamaz.
- **N-b · "8 satır iskelet" uyumsuzluğu** (`docs/03-ux.md:516`) sözleşmede hiç anılmıyor
  ("iskelet" kelimesi belgede geçmiyor). `G4-1` mevcut olduğu için gerçek satır sayısı zaten 8;
  kozmetik.
- **N-c · UX'in çelişkili satırı "Tarih" sütununda `—` gösteriyor** (`docs/03-ux.md:207`), sözleşme
  ise tarihleri `[Detay]` alt satırına koyuyor (`:244-247`). Uyumlu okunabilir; kod turunda
  `GateRow`'un çelişkili satırda Tarih hücresini boş bırakması yeterli.
- **N-d · İyi yapılmış (kayda geçsin):** (a) §8'in ölçüme dayanan yeniden yazımı ve dürüst sınır
  cümlesi bu depodaki en iyi güvenlik bölümlerinden biri; (b) `[Detay]` için ayrı modal yerine
  `expanded: boolean` tercihi Karpathy §2'ye uygun ve gerekçeli; (c) `tests/helpers/manifest.ts`
  değişikliğinin **opsiyonel parametre** olarak tasarlanması mevcut çağıranları korur; (d) §12'nin
  tek açık sorusu (izleyici geç oluşan `docs/approvals`) gerçek bir sınır ve etkisiyle birlikte
  dürüstçe yazılmış.

---

## KARAR

**KALDI · ESKALE: false.** İki bloklayıcı: **Y1** (B5 kapanmadı — dört kırık iddia planda yok,
biri `tests/web/App.chat-tab.test.tsx` sözleşmede hiç geçmiyor) ve **Y2** (M6 mutasyonunun iddiası
ters; doğru kodda kırmızı, mutantta yeşil verir ve §6 ile çelişir). Bir önemli: **Y3** (paylaşılan
manifest yardımcısına eklenen `includeMtime` yeteneğini ölçen mutasyon yok — F-013'te aynı boşluk
mutasyonu yeşil geçirmişti).

Üçü de **mekanik ve dar**: §10.2'ye üç satır ekleme/düzeltme, M6'nın iki cümlesinin yönünü
çevirme, §11'e bir mutasyon maddesi. Bunlar düzeltilirse üçüncü tur kapanış turudur; kalan
bölümleri yeniden açmayacağım.

---

## Bu turda doğruladıklarım (dosya:satır)

| İddia | Kaynak | Sonuç |
|---|---|---|
| `e2e-config-guard` spec/config listesini diskten üretir, `includes` ile OR eşleşmesi yapar | `tests/e2e-config-guard.test.ts:31-45, 59-68` | ✓ `testMatch`'e literal ad eklemek guard'ı yeşil bırakır |
| `playwright.config.ts` prod build kullanıyor | `playwright.config.ts:28` (`npm run build && npm start`) | ✓ sözleşmenin iddiası doğru |
| E2E'de chat kapalı → header'da 2 `role="tab"` | `playwright.config.ts:39` `MC_CHAT_ENABLED:'0'` + `tests/e2e/shell.spec.ts:59-60` | ✓ 2→3 doğru |
| `App.interaction.test.tsx` iki ayrı `End` iddiası taşıyor | `:237-239` (chat kapalı) ve `:251,266` (chat açık) | ✓ ilki planda yok (Y1) |
| `App.chat-tab.test.tsx` sabit sekme sayaçları | `:78` (2), `:92` (3), `:97` sıra | ✓ dosya sözleşmede hiç geçmiyor (Y1) |
| "Faz 2 ekranları hiç görünmez (Kapılar…)" doktrin çitleri | `tests/web/App.test.tsx:22-26`, `tests/e2e/shell.spec.ts:127-130` | ✓ ikisi de kırılacak, ikisi de planda yok (Y1) |
| Kapılar sekmesi koşulsuz görünür (statik render dâhil) | `src/web/App.tsx:15-20` (`buildTabs`, yalnızca `chat` koşullu) | ✓ `App.test.tsx:48` yeni değeri **3**, tahmin edilebilir |
| Aksiyon durum makinesi UX ile birebir | `docs/03-ux.md:202-208` ↔ `F-008-contract.md:220-225` | ✓ dört durum, dört buton kümesi aynı |
| ADR-005 madde 9 alıntısı birebir | `docs/decisions/ADR-005-*.md:33` | ✓ |
| ADR-001 karar 7 gerekçesi | `docs/decisions/ADR-001-*.md:14` | ✓ ("çelişki durumu bu sayede oluşmaz") |
| ADR-014 eki gerçekten var | `docs/decisions/ADR-014-*.md:176` | ✓ 2026-09-09 |
| `Write` canlı ölçümü iki yönlü, dosya oluşmadı | `docs/qa/F-008-write-izin-olcumu.md:43-70` | ✓ B1 kapandı |
| `PROCESS.md` ASSETS satırı etiketsiz, yeni regex kapsıyor | `docs/PROCESS.md:29` | ✓ |
| `docs/approvals/` bugünkü içeriği | dizin listesi: `G0.ok G1.ok G2.ok G3.ok G4-1.ok README.md` | ✓ hariç tutma kümesi yeterli |
| `tests/helpers/manifest.ts` bugün `mtimeMs` taşımıyor | `tests/helpers/manifest.ts:5-15` | ✓ opsiyonel parametre additive |
| UX sekme sırası (Kapılar, Sohbet'ten sonra) | `docs/03-ux.md:735` | ✓ `App.chat-tab.test.tsx:97` sıra iddiası ayakta kalır |
| Belge içi `§n` referansları | `grep -n "§[0-9]"` tam tarama | ✓ Ö6 kapandı |

## Doğrulayamadıklarım

1. `npm run verify` / `npm run e2e` çıktısı — sözleşme turu, kod yok, koşturmadım (kısıt).
2. Gerçek tarayıcıda dar genişlik (Ö8) — kod olmadan ölçülemez, kod turunda zorunlu.
3. `gates-write-permission-live.test.ts`'in tekrar edilebilirliği — canlı oturum açmak kısıt dışı
   (kota); tek ölçüm `docs/qa/F-008-write-izin-olcumu.md`'de kayıtlı, ona güveniyorum.
4. `service.ts`'in `docs/features` için periyodik yeniden tarama yapıp yapmadığı (§12'nin açık
   sorusunun cevabı) — dosyanın tamamını okumadım; sözleşme de bunu kod turuna bırakıyor.
