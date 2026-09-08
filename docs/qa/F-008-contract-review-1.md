---
feature: F-008
title: Sözleşme denetimi — Kapılar paneli (tur 1)
author: qa-evaluator
type: contract-review
date: 2026-09-09
---

# F-008 sözleşme denetimi — tur 1

**KARAR: KALDI** · **ESKALE: false**

Kod yok; bu bir belge denetimidir. `src/`, `tests/`, `package.json` altında hiçbir dosya
değiştirilmedi. Denetlenen belge: `docs/qa/F-008-contract.md` (474 satır, `status: draft`).

Sözleşme **ciddi bir belge**: L4'ün cevabı doğru, statik çit kapsamı doğru ölçülmüş, `x-mc-write`
ve `withDispatchErrorBoundary` satır referansları birebir tutuyor, `@source` çiti doğru
planlanmış, PRD AC4'ün "değiştirilme zamanı" ifadesine sadık kalınmış. Aşağıdaki bulgular bunu
değiştirmiyor — ama **6 bloklayıcı** var ve üçü CEO'nun bu tur öncesi verdiği kararlarla doğrudan
çelişiyor.

**Bloklayıcı sayısı: 6 · Önemli: 11 · Not: 4**

---

## BLOKLAYICILAR

### B1 · BLOKLAYICI · L5'in kapsamı yanlış: en kısa self-approval yolu `Write`, `Bash` değil
**Nerede:** sözleşme §8 tamamı, özellikle "Yol neden açık — ✓ VERIFIED" madde 1 ve "Yol neden tam
olarak sessiz/otomatik değil — ✓ VERIFIED".

**Sorun:** §8, "barındırılan CEO oturumu kendi kapılarını onaylayabilir mi?" sorusunu **yalnızca
HTTP yolu** üzerinden yanıtlıyor ve şu iki cümleyi ✓ VERIFIED olarak işaretliyor:
- "ağa çıkabilecek tek araç `Bash` … hosted oturumun panele istek atmasının **tek yolu** bir kabuk
  komutu çalıştırmak"
- "**otomatik/sessiz self-approval YOK**"

İkinci cümle yanlış kapsamda kuruldu. Kapı onaylamanın panelden geçmesi **gerekmiyor** — dosyayı
doğrudan yazmak yeter. Ölçtüklerim:

| # | Kanıt | Sonuç |
|---|---|---|
| 1 | `.claude/agents/ceo.md:7` — `tools: … Read, Grep, Glob, Bash, **Write, Edit**, …` | Hosted oturumun `Write` aracı var. |
| 2 | `.claude/hooks/gate-check.cjs:9` — `const free = [/^docs\//, …]` ve satır 10 `if (free.some(...)) process.exit(0)` | `docs/approvals/G5.ok` yazımı kapı hook'undan **muaf**. Hook kod dizinini korur, onay dosyalarını **değil**. |
| 3 | `.claude/hooks/block-dangerous.cjs` (tam dosya) — yalnızca yayın/`git push`/yıkıcı desenler | `Write` aracını hiç görmez (matcher `Bash`). |
| 4 | `.claude/settings.json` `permissions.allow` → `"Write(docs/**)"`, `"Edit(docs/**)"` | Proje izin listesi bu yazımı **allow** ediyor. |
| 5 | `src/features/chat/server/session.ts:480` → `settingSources: ['project']` | O izin listesi hosted oturuma **yükleniyor**. |
| 6 | `session.ts:498-501` → `managedSettings.permissions.ask: ['Bash']` ve satır 495-497'deki kendi yorumu: "`Bash` dışındaki araçlar bu listeye eklenmedi … `Read`/`Grep`/`Glob`/`WebSearch` zaten `.claude/settings.json`'ın kendi allow listesinde … bu yüzden `ask`'a alınmadı" | `Write` `ask` listesinde **değil**; kodun kendi yorumu proje allow kurallarının geçerli olduğunu varsayıyor. |

Yani: `Write(docs/approvals/G5.ok)` → hook muaf (kanıt 2) → izin motoru allow (kanıt 4+5+6) →
**izin kartı çıkmadan** kapı onaylanır. §8'in tüm "kalan risk" analizi (izin kartının 500 karakterlik
önizlemesinin okunabilirliği) bu yol için **hiç geçerli değil**, çünkü kart hiç çıkmıyor.

Bu boşluğun kaynağı sözleşme değil — ADR'lerin kendisi. `ADR-005` F-012 eki ("Hook kapıları …
Yıkıcı komut, uzak depoya gönderme ve **kapı onayı korumaları** bu yolda da ayakta") ve `ADR-014`
eki madde 1 aynı cümleyi tekrarlıyor. Ama "kapı onayı koruması" = `gate-check.cjs` = *"G2 yoksa
**koda** yazamazsın"*; onay dosyasını korumuyor. Sözleşme bu öncülü **doğrulamadan** devraldı
(`CLAUDE.md`: "var olmayan mekanizmaya dayanma"; F-005 bloklayıcısının aynısı).

**Neden bloklayıcı:** F-008 tam olarak bu güvenlik sınırını değiştirdiği için sözleşme turu
zorunlu kılındı. Sözleşmenin bu sorudaki merkezi cevabı kapsam olarak yanlış, ve M1'de onaylanan
çözüm (`curl`+kapı yolu arayan Bash hook'u) bu yolu **hiç kapatmıyor**.

**Önerilen düzeltme:**
1. §8'i "HTTP yolu" değil "**hosted oturum bir kapıyı onaylatabilir mi**" sorusu etrafında yeniden
   kur; en az iki yolu ayrı ayrı işle: (a) `Write`/`Edit` ile doğrudan dosya, (b) `Bash` + HTTP.
2. (a) için ölçüm iste: `chat-hooks-live.test.ts`'in model-bağımsız desenini kullanarak
   `gate-check.cjs`'i alt süreç olarak `{"tool_name":"Write","tool_input":{"file_path":"docs/approvals/G5.ok"}}`
   ile çalıştır, çıkış kodunu assert et (kota harcamaz, `verify`'de koşar). İzin motoru tarafı için
   `.probe/live-test-e1.mjs` deseninde **iki yönlü** canlı ölçüm — ama bu QA'nın değil kod turunun işi.
3. M1'in hook kuralı (a) yolunu kapatmıyorsa bunu §8'de **açıkça** yaz; kapatacaksa
   `gate-check.cjs`'in `free` listesinden `docs/approvals/*.ok|*.deny.md`'yi çıkarmak gerekir ve bu
   CEO'nun kendi onay yazma akışını da etkiler (ayrı karar).
4. `ADR-005` eki ile `ADR-014` ekindeki "kapı onayı koruması ayakta" cümleleri düzeltilmeli;
   sözleşme bunu bir ADR ödevi olarak §11'e taşımalı.

**Kalibrasyon notu (dürüstlük payı):** bu yol F-008'in **açtığı** bir yol değil, bugün de var.
Bulgu "F-008 bir delik açıyor" değil, "**sözleşme var olmayan bir korumaya dayanarak riski
küçümsüyor**" — ve kod turunun ilk işi olarak M1'i uygularken yanlış yeri kapatacak.

---

### B2 · BLOKLAYICI · M1 (daraltılmış hook kararı) gövdeye yayılmamış
**Nerede:** §1 "Kapsam DIŞI" son madde, §8 "Önerilen mekanizma", §9.2 son paragraf, §10 mutasyon 7,
§11 açık soru 1.

**Sorun:** CEO M1 ile L5'in çözümünü **kabul etti ve daralttı**. Sözleşme hâlâ tur öncesi hâlinde:
- §8 "`docs/approvals` yolunu VEYA `/api/gates` yolunu hedefleyen bir Bash komutunu **koşulsuz**
  engelleyen bir kural" öneriyor. Koşulsuz metin eşleşmesi **reddedildi**.
- İki yönlü self-test şartı yok (§10 mutasyon 7 yalnızca "hook aktif/no-op" diyor — bu M1'in
  istediği **ikinci** vaka değil).
- §1 hâlâ "kapsam DIŞI", §11.1 hâlâ "CEO onaylamalı" diye soruyor; §9.2 `.claude/hooks/**`'ı
  "dokunulmayacak" listesinde tutuyor.

**Neden sorun:** bu depoda koşulsuz metin eşleşmesi **iki kez** ısırdı (`CLAUDE.md`: bir commit
mesajı ve bir ADR metni korunan komut adını *andığı* için komutun tamamı engellendi; ikincisinde
`cat >> dosya <<EOF … && git commit` zincirinde **dosya yazımı bile** gerçekleşmedi). Sözleşme bu
dersi hiç anmıyor. Ayrıca `CLAUDE.md`'nin F-005 dersi birebir tekrar ediyor: karar tur sonunda
eklenirse gövdeye yayılmaz.

**Önerilen düzeltme:** §8'i M1'e göre yeniden yaz — kural **iki koşulun kesişimi** olmalı
(bir HTTP istemcisi: `curl`/`wget`/`Invoke-WebRequest`/`Invoke-RestMethod`/`fetch(` **VE** kapı ucu
yolu). §10 mutasyon 7 iki vaka içermeli: (a) gerçek istek komutu **engellenir**, (b) yolu yalnızca
metin olarak anan bir komut/commit **geçer** — ikisi de `.claude/hooks/_selftest.cjs`'e eklenmeli.
§8 dürüstçe "kabuk erişimi olan yerel bir agent'a karşı savunmanın **tavanı** vardır; bu hook
derinlik katar, mutlak engel değildir, asıl koruma izin kartıdır" cümlesini taşımalı. §1/§9.2/§11.1
buna göre güncellenmeli (artık kapsam İÇİ).

---

### B3 · BLOKLAYICI · M2 (Türkçe metinler önce `docs/03-ux.md`'ye) uygulanmamış — üstelik öncülü de yanlış
**Nerede:** §2 haritası "L8" satırı, §11 açık soru 2 ve 3.

**Sorun (iki katmanlı):**
1. §2'nin haritası `L8 (Türkçe metin önce UX'e) → **§8 "Türkçe metinler"**` diyor. **Böyle bir
   bölüm yok.** §8 L5 bölümü; belgede "Türkçe metinler" başlıklı hiçbir bölüm bulunmuyor
   (`grep` ile doğrulandı). Karar tabloya yazılmış, gövdeye hiç inmemiş.
2. §11.3 hâlâ "kod turundan önce mi eklensin yoksa geliştirici mi eklesin — **CEO karar versin**"
   diye soruyor. CEO M2 ile karar verdi: **önce belge, sonra kod, birebir aynı.**
3. §11.2 "Proje seçilmemiş/hiç proje yokken Kapılar ekranı ne gösterir?" diye soruyor. **Bu soru
   zaten cevaplanmış:** `docs/03-ux.md:516` Kapılar satırı dört durumu metniyle veriyor —
   boş: `"Önce bir proje seçin."`, yükleme: `8 satır iskelet`, hata:
   `"Kapı durumları okunamadı. [Tekrar dene]", satırlar gri "bilinmiyor"`, kısmi bozukluk:
   `Bozuk tek dosyada yalnız o satır "Durum belirlenemedi" gri, diğer satırlar normal`.
   Sözleşme bu satırı hiç anmıyor ve §3'ün tasarımı (tüm ekran `process_doc_readable:false`'a
   düşer) UX'in **satır bazlı** izolasyon şartını karşılamıyor.

**Neden sorun:** `CLAUDE.md`'nin "belgenin öncüllerini repo durumuyla doğrula" dersi (F-012'de 2
bloklayıcı) birebir tekrar ediyor. Ayrıca M2 gereği kod turu başlamadan önce UX'e yazılması gereken
metin listesi belirsiz kalıyor.

**Önerilen düzeltme:** §11.2 ve §11.3'ü kapat. Yeni bir "§ Türkçe metinler" bölümü aç ve kod
turundan önce `docs/03-ux.md`'ye eklenecek metinleri **birebir dizge** olarak listele: tanınmayan
dosya notu, `process_doc_readable:false` notu, yarı-başarı hata metni, onay/red toast metinleri
(bkz. Ö11), modal başlık/buton etiketleri. Mevcut `03-ux.md:516` metinlerini **kaynak** kabul et,
yeniden icat etme. Ayrıca §3'e "tek dosyanın `stat`'i başarısız olursa yalnız o satır
`Durum belirlenemedi` olur, ekran geri kalanı normal çalışır" davranışını ekle.

---

### B4 · BLOKLAYICI · `tests/e2e/gates.spec.ts` hiçbir Playwright koşusunda ÇALIŞMAZ
**Nerede:** §9.1 son satır (`tests/e2e/gates.spec.ts`), §10 AC tablosunun beş satırı, §9.2
(değiştirilecek dosyalar listesi).

**Sorun:** dört config'in **hepsi** kapalı `testMatch` listesi tutuyor:
- `playwright.config.ts:14` → `['shell.spec.ts','timeline.spec.ts','settings.spec.ts','kanban.spec.ts']`
- `playwright.chat.config.ts:20` → `['chat.spec.ts']`
- `playwright.dev.config.ts:5` → `'dev-shell.spec.ts'`
- `playwright.electron.config.ts:14` → `['electron-smoke.spec.ts','electron-autostart-smoke.spec.ts']`

`gates.spec.ts` hiçbirinde yok ve §9.2'de **hiçbir config dosyası** yer almıyor. İki sonuç:
1. E2E'ye atanan AC'ler (AC7 gerçek fs, AC8, çelişkili durum görüntüsü, canlı güncelleme) hiç
   koşmaz — sessizce ölen bir test katmanı.
2. `tests/e2e-config-guard.test.ts:32,37,59` spec dosyalarını `readdirSync` ile diskten sayıyor ve
   her birinin bir config metninde geçmesini şart koşuyor → dosya eklendiği anda `verify` **KIRMIZI**.

**Neden bloklayıcı:** F-007 sözleşmesinde aynı bulgu çıkmıştı; kod turu ilk `verify`de duruyor ve
"testi geçirmek için çiti gevşetme" baskısı doğuyor.

**Önerilen düzeltme:** §9.2'ye `playwright.config.ts` satırını ekle (`testMatch`'e `'gates.spec.ts'`).
Ayrıca `webServer.command` = `npm run build && npm start` (üretim build'i) — E2E'de kullanılacak
hiçbir prob `import.meta.env.MODE !== 'production'` koşuluna bağlanmamalı; sözleşme bunu açıkça yazsın.

---

### B5 · BLOKLAYICI · Dördüncü sekme mevcut sayaç çitlerini kırıyor; o test dosyaları planda yok
**Nerede:** §9.2 `src/web/App.tsx` satırı ("`buildTabs` … 'Kapılar' ekler") ve §9.1/§9.2'nin
tamamı.

**Sorun:** ölçülen sabit sayılar:

| Dosya:satır | Şu anki iddia | Kapılar eklenince |
|---|---|---|
| `tests/web/App.interaction.test.tsx:266` | `expect(screen.getAllByRole('tab')).toHaveLength(3)` | 4 → **KIRMIZI** |
| `tests/web/App.interaction.test.tsx:251` | test adı: "`End` tuşu artık **son sekme olan Sohbet'i** seçer" | son sekme artık Kapılar → **anlamsal olarak da** KIRMIZI |
| `tests/e2e/shell.spec.ts:46` | `expect(clickableCount).toBe(3)` | 4 → KIRMIZI |
| `tests/e2e/shell.spec.ts:60` | `expect(tabRoleCount).toBe(2)` | 3 → KIRMIZI |
| `tests/web/App.test.tsx:48` | `expect(headerHtml.match(/role="tab"/g)).toHaveLength(2)` | render koşuluna göre KIRMIZI riski |

Hiçbiri §9.2'de yok. Sözleşme yalnızca `src/web/App.tsx`'e dokunacağını söylüyor.

**Neden bloklayıcı:** `CLAUDE.md` + agent hafızasındaki sabit kural: "yeni ekran/sekme = mevcut
çitler kırılır, dosya planında olmalı". Planda olmayınca kod turu ya durur ya da çiti gevşetir.

**Önerilen düzeltme:** üç test dosyasını §9.2'ye ekle ve **yeni beklenen değerleri şimdiden yaz**
(4/4/3). `App.interaction.test.tsx:251`'in `End` testi yalnızca sayı değil **hedef sekme** değişimi
gerektiriyor — bunu ayrı bir madde olarak belirt. Ayrıca `docs/03-ux.md:735`'in "altı sekme"
numaralandırması ile tutarlılığı not düş.

---

### B6 · BLOKLAYICI · Aksiyon sütunu durum makinesi yok; "onaylı kapıyı reddet" kararı UX/ADR/PRD ile çelişiyor
**Nerede:** §4 `POST …/deny` ikinci madde ("Zaten bir `.ok` varsa **engellenmez**"); §3 durum
tablosu; §9.1 `GateRow.tsx` satırı.

**Sorun 1 — davranış çelişkisi.** `docs/03-ux.md:196-206` mockup'ı aksiyon sütununu **durum
makinesi** olarak tanımlıyor:
- `✔ Onaylandı` → `(kilitli)` — **hiç buton yok**
- `✘ Reddedildi` → yalnızca `[Onayla]`
- `⚠ Çelişkili durum` → yalnızca `[Detay]`
- `⏳ Bekliyor` → `[Onayla] [Reddet]`

Sözleşme bu tabloyu hiç anmıyor ve tam tersini kural yapıyor: onaylı bir kapı reddedilebilir,
sonucun `conflict` olması "bilerek, bug değil". Bu üç belgeyle çelişiyor:
- `docs/03-ux.md:200` — onaylı satır `(kilitli)`, `Reddet` butonu yok.
- `docs/decisions/ADR-001…:karar 7` — "…**ayrıca PRD'deki 'aynı anda hem .ok hem .deny' çelişki
  durumu bu sayede oluşmaz**."
- `docs/01-prd.md:78` (AC9) — "Böylece AC4'teki 'çelişkili durum' **kendiliğinden oluşmaz**."

Sözleşmenin gerekçesi `ADR-005` madde 9'a dayanıyor ama o madde "panel bir `.ok`'u **silmez/üzerine
yazmaz**" diyor — "onaylı kapı reddedilebilir" demiyor. Yanlış dayanak.

**Sorun 2 — kapsam boşluğu.** `[Detay]` (çelişkili satır) ve `(kilitli)` durumları için sözleşmede
hiçbir tasarım, uç, test veya bileşen yok. `GateRow.tsx` satırı yalnızca "rozet, tarih, aksiyon
butonları" diyor. AC4'ün "hangisi daha yeni gösterilir" kısmı `[Detay]` içinde mi, satırda mı?

**Sorun 3 — yeniden onay.** `ADR-005` madde 9 mevcut bir `.ok` üzerine yeniden onay yazmayı
**açık kullanıcı eylemi olarak meşru** sayıyor; `atomicWrite`'ın `renameSync`'i (write-gate.ts:162)
Windows'ta üzerine yazıyor. UX ise onaylı satırı kilitliyor. Sözleşme ikisini de anmıyor.

**Neden bloklayıcı:** onaylanmış UX + ADR + PRD'nin birlikte yasakladığı bir davranışı sözleşme tek
başına kural yapıyor; kod turu bunu uygularsa panel doktrini deler.

**Önerilen düzeltme:** §4'e "Aksiyon sütunu durum makinesi" alt bölümü ekle; dört durumun her biri
için hangi butonların çizildiğini `03-ux.md:196-206`'dan **birebir** al. Sunucu tarafında da aynı
kuralı çit yap (`.ok` varken `deny` → 409/`conflict`), veya bu kısıtı gevşetmek gerekiyorsa **CEO
kararı** olarak §11'e taşı ve ADR-001 karar 7'ye ek yazılmasını iste. `[Detay]` görünümünü tanımla.
`(kilitli)` ile ADR-005 madde 9'un "yeniden onay" hakkı arasındaki gerilimi açıkça karara bağla.

---

## ÖNEMLİ

### Ö1 · Katalog türetmesi gerçek `PROCESS.md` üzerinde çalışmıyor (ASSETS düşüyor) + sıralama tanımsız
**Nerede:** §3 "Her zaman gösterilen temel katalog" ve etiket türetme paragrafı.

- Sözleşme etiketleri `^(\S+)\s+(.+)$` ile ayırıyor. Gerçek `docs/PROCESS.md:26` satırının ilk
  hücresi tam olarak `ASSETS` — **boşluk + etiket yok**. Regex eşleşmez → ASSETS satırı atlanır ve
  etiketi kaybolur. AC1 ASSETS'i zorunlu kılıyor. Tek satır ayrıştırılamadığında ne olacağı da
  tanımsız (yalnızca "tablo bulunamazsa" dalı var).
- "gömülü yedek etiket tablosu (**7 satır, PROCESS.md'nin şu anki metniyle birebir**)" iddiası
  kendi içinde tutarsız: `PROCESS.md` §2 tablosu **8 satır** (G4 dahil); sözleşme G4'ü bilerek
  dışarıda bırakıyor. "Birebir" olamaz.
- **Sıralama hiç tanımlanmamış.** `docs/03-ux.md:192` sırayı veriyor: `G0, G1, G2, G3, ASSETS,
  G4-N (varsa birden çok), G5, G6`. Sözleşmenin `BASE_CATALOG`'u `G0,G1,G2,G3,ASSETS,G5,G6`;
  diskten keşfedilen `G4-1`'in nereye yerleşeceği yazmıyor. Çoklu kilometre taşında (`G4-1`,
  `G4-2`, `G4-10`) doğal sıralama gerekiyor (`G4-10` > `G4-2`).
- `docs/03-ux.md:516` yükleme durumunu "**8 satır iskelet**" diye veriyor — 7 satırlık katalogla
  görsel olarak tutarsız.

**Düzeltme:** etiket ayrıştırmasını `ASSETS` gibi tek-hücreli satırları kapsayacak şekilde yaz
(`^(\S+)(?:\s+(.+))?$`, etiket yoksa id). Sıralamayı `03-ux.md:192`'ye göre sabitle ve `G4-<n>`
sayısal sıralamasını açıkça belirt. "7 satır birebir" cümlesini düzelt. İskelet satır sayısını
UX ile uyumla.

### Ö2 · `unrecognized` listesi kalıcı çöp gösterecek — ve panelin kendi `.tmp` dosyaları oraya sızacak
**Nerede:** §3 "Dosya taraması" ikinci madde, §7 "gates izleyicisi bu yüzden **filtresiz**".

Gerçek `docs/approvals/` içeriği (ölçüldü): `G0.ok G1.ok G2.ok G3.ok G4-1.ok **README.md**`.
Buna ek olarak `docs/approvals/README.md` kendisi şunları belgeliyor: `DANGER.ok (tek kullanımlık)`;
`block-dangerous.cjs:43-46` ayrıca `PUSH.ok` (tek kullanımlık) yazıp tüketiyor. Ve
`archiveDenial` başarıyla çalıştığında `docs/approvals/archive/` **dizini** de üst düzey listede
bir girdi olur.

Sonuç: panel kalıcı olarak `Tanınmayan dosyalar: README.md, archive` gösterecek; `PUSH.ok`/
`DANGER.ok` yazıldığı anlarda da titreyecek.

Daha kötüsü: `write-gate.ts:145-148` atomik yazmanın geçici dosyasını **aynı dizinde** açıyor —
`docs/approvals/.G2.ok.<pid>-<hex>.tmp`. §7'nin "filtresiz izleyici" kararı bu tmp dosyasının
oluşumunu/silinmesini SSE olayına çeviriyor ve `list-gates` yarışırsa tmp adı doğrudan
`unrecognized` listesine düşüyor. `project-watcher.ts`'in `.md` filtresi bu sorunu tesadüfen
önlüyordu; sözleşme filtreyi kaldırırken bunu hesaba katmamış.

**Düzeltme:** tanıma dışı listeye **açık bir hariç tutma kümesi** ekle: `README.md`, `archive`
(dizin), `DANGER.ok`, `PUSH.ok`, `.gitkeep`, ve `^\.` ile başlayan/`.tmp` ile biten her şey.
Dizin girdilerini hiç listeye alma. İzleyicide de aynı hariç tutmayı uygula (aksi hâlde her onay
kendi tmp'si yüzünden 2-3 kez yayın yapar).

### Ö3 · `gates-watcher` yaşam döngüsü tanımsız; planda olmayan bir dosyayı değiştirmeyi gerektiriyor
**Nerede:** §7 ikinci madde, §9.1 `gates-watcher.ts`, §9.2.

`src/features/projects/server/service.ts:93-103` (`startWatchingIfPossible`) izleyicileri
**proje kaydı** yaşam döngüsüne bağlıyor: açılışta kayıtlılar için başlat, ekleme/silmede yönet,
`getActiveWatcherCount()` sağlığa raporla (`src/server/index.ts:373`). Sözleşme yeni izleyiciyi
kimin oluşturacağını, hangi projeler için, ne zaman kapatacağını **hiç yazmıyor**; `service.ts`
de "dokunulmayacak" listesinde değil ama §9.2'de de yok.

**Düzeltme:** izleyicinin nerede örneklendiğini (muhtemelen `service.ts` içinde, `docs/approvals`
var/yoksa dalıyla), proje silinince nasıl kapandığını ve `/api/health`'in sayacına dahil olup
olmayacağını yaz; gerekiyorsa `service.ts`'i §9.2'ye ekle. `docs/approvals` yoksa (yeni proje)
davranışı da belirt.

### Ö4 · Manifest çiti `mtime`'a kör — ama F-008'in tüm semantiği `mtime` üzerine kurulu
**Nerede:** §10 mutasyon 4 ("before/after `docs/approvals/` snapshot'ı eşit"), §9.1
`gates-manifest.test.ts`.

`tests/helpers/manifest.ts` bilinçli olarak `mtimeMs` **taşımıyor**; bu `docs/qa/F-013-2026-09-08-tur2.md:126`
ile ölçülmüş bir sınır (M3d mutasyonu — içerik-nötr `appendFileSync` manifest testinde **YEŞİL**
geçti, yalnızca statik tarama yakaladı). Oysa `ADR-005` madde 10 manifest için
`(yol, boyut, **mtime**, sha256)` şart koşuyor, ve F-008'in `status`/`Tarih`/`newer_side`
kararlarının **tamamı** `mtime`'dan geliyor (§3). Yani: `list-gates`'in bir dosyaya `mtime`-only
dokunması, hem çelişki tarafını ters çevirebilir hem de her iki çitten de sızabilir.

Ayrıca sözleşme `gates-manifest.test.ts` için anlık görüntünün **işlemden önce** alınacağını
söylemiyor. F-013'te bu test tam olarak bu yüzden sahte çıkmıştı.

**Düzeltme:** `gates-manifest.test.ts` için (a) `before` anlık görüntüsünün **tüm** çağrılardan
önce alınacağını, (b) gates fixture'ında `mtimeMs`'in de karşılaştırılacağını (ADR-005 madde 10'un
harfi) açıkça yaz. Mutasyon listesine "`list-gates` okuduğu `.ok`'a `mtime`-only dokunur" vakasını
ekle ve hangi testin kırmızı vereceğini belirt.

### Ö5 · Mutasyon listesi şişirilmiş: 7 maddenin 3'ü aynı mekanizmayı ölçüyor, 1'i yer tutucu
**Nerede:** §10 mutasyon listesi.

| # | Kırılacak çit | Bağımsız mı |
|---|---|---|
| 1 | `handlers.test.ts` (gövde doğrulama) | evet |
| 2 | `gates-api.test.ts` 403 (ADR-013 regresyonu) | evet — iyi mutasyon |
| 3 | statik tarama + manifest | evet |
| 4 | **statik tarama** + manifest | 3 ile aynı mekanizma |
| 5 | `handlers.test.ts` + manifest | evet |
| 6 | **statik tarama** | 3/4 ile aynı mekanizma |
| 7 | — | **yer tutucu** |

Statik tarama zaten §9.1'de ✓ VERIFIED (`tests/no-write-gate-bypass.test.ts:129`
`walk(path.join(ROOT,'src'), ['.ts','.tsx'])` özyinelemeli — doğruladım). Onu üç kez kanıtlamak
sayı şişirir. Yer tutucu ise M1 sonrası **kabul edilemez**: mekanizma artık kararlaştırıldı,
mutasyon somut yazılabilir.

**Hiç mutasyonu olmayan katmanlar** (asıl eksik):
- **AC9'un sırası:** "arşiv → onay" sırasının ters çevrilmesi (`writeGateApproval` önce, `archiveDenial`
  sonra). §6 bu sıranın neden kritik olduğunu uzun uzun yazıyor ama hiçbir mutasyon onu ölçmüyor.
  Mevcut mutasyon 3 yalnızca "arşiv yerine silme"yi kapsıyor — komşu bir yol.
- **AC2/AC8 içerik formatı:** `buildApprovalBody`/`buildDenialBody`'de kullanıcı metnini kırpan/
  kaçıran bir mutasyon (AC8 "olduğu gibi geçer") — hiç yok.
- **Yarı-başarı yolu:** `data:<taze GateStatusItem>` alanının düşürülmesi (istemci yanlış durum
  çizer) — hiç yok.
- **İzleyici/SSE:** `broadcast('gates', …)` çağrısının silinmesi — hiç yok.

**Düzeltme:** 4 ve 6'yı tek maddeye indir; 7'yi M1'e göre somutlaştır (iki yönlü); yukarıdaki dört
eksik mutasyonu ekle. Her madde için "hangi dosyadaki hangi test" satırını koru — bu iyi yapılmış.

### Ö6 · Belge içi çapraz referansların çoğu yanlış bölümü gösteriyor
**Nerede:** §1, §2 haritası, §3, §4, §8, §9.2, §10.

Ölçülen bölüm numaraları: 1 Kapsam · 2 Harita · 3 Durum türetme · 4 Uçlar · 5 Format/L4 ·
6 Arşiv+hata · 7 Canlı güncelleme · 8 L5 · 9 Dosyalar · 10 Test/mutasyon · 11 Açık sorular.

| Yer | Yazan | Olması gereken |
|---|---|---|
| §2 L2/L6/L7 satırları | "§7 test planı mutasyon …" | §10 |
| §2 L3 satırı | "§2.1/§2.2 dosya listesi" | §9.1/§9.2 (§2.1 diye bir bölüm yok) |
| §2 L5 satırı | "§6" | §8 |
| §2 L8 satırı | "§8 'Türkçe metinler'" | **yok** (bkz. B3) |
| §1 son madde | "bkz. §6" | §8 |
| §3 son cümle | "…çitlenir, §7" | §10 |
| §4 adım 5 | "yarı-başarı (bkz. §5)" | §6 |
| §8 son satır | "Açık soru §10'a taşındı" | §11 |
| §9.1 `gates-api.test.ts` | "(§7 test planı)" | §10 |
| §9.2 son paragraf | "(§6/§10)" | §8/§11 |

**Neden sorun:** tek başına kozmetik değil — bu, kararların belge yazıldıktan **sonra** araya
sıkıştırıldığının işareti (B2/B3 ile aynı kök neden) ve kod turunda geliştirici yanlış bölümü
okur. **Düzeltme:** referansları düzelt; harita tablosunu gövdeyi yazdıktan **sonra** üret.

### Ö7 · AC6'nın kanıtı "kod incelemesi notu" olarak bırakılmış
**Nerede:** §10 AC tablosu, AC6 satırı: "statik guard (mevcut, otomatik) + **kod incelemesi notu**".

`docs/01-prd.md:75` (AC6) açıkça "…bu, izlenen **tüm** projelerde **otomatik testle** (ör. dosya
sistemi diff'i) doğrulanabilir" diyor. Kod incelemesi notu otomatik test değil. Sözleşmenin kendi
`gates-manifest.test.ts`'i bu işi yapıyor ama AC tablosu ona işaret etmiyor.

**Düzeltme:** AC6 satırını `gates-manifest.test.ts` + statik guard olarak yaz; "kod incelemesi
notu"nu kanıt sayma.

### Ö8 · Dar genişlik (320–480px) hiç geçmiyor — dördüncü sekme tam da o çubuğa ekleniyor
**Nerede:** §9.1 test listesi ve §10'un tamamı.

`docs/03-ux.md:800-805` dar genişliği ölçülmüş bir kısıt olarak kaydediyor: "640px altında sekme
çubuğu başlığın altında kendi satırına iner… **Ölçüldü: 320px ve 375px'te iki sekme de tam
görünür**". O ölçüm **iki** sekme içindi; F-008 dördüncüyü ekliyor. `CLAUDE.md`'nin iki ayrı dersi
burada birleşiyor: (a) "dar genişliği test et — F-005'te Ayarlar dişlisi 375px'te başlığın dışına
kaydı", (b) "`toBeVisible()` kaydırma kabında **yalan söyler** — F-007'de iki sekmenin görünür
genişliği 0 pikseldi ve test yeşildi".

Sözleşmede ne 320/375px'lik bir E2E vakası var, ne de kapı tablosunun (4 sütun: kapı/durum/tarih/
aksiyon) dar genişlikte nasıl davranacağı.

**Düzeltme:** §10'a 320px ve 375px vakaları ekle; sekme çubuğu iddiasını **kırpılmış görünür
genişlikle** (boundingBox kesişimi) ölç, `toBeVisible()` ile değil. Kapı tablosunun dar genişlikteki
düzenini (yatay kaydırma mı, satır sarması mı) `03-ux.md`'ye yaz (M2).

### Ö9 · Yarı-başarı mesajı arşiv yolunu düşürüyor — kullanıcının tek kalıcı izi o
**Nerede:** §6 "Yarı-başarı" paragrafı.

Önerilen metin: *"Red kaydı arşivlendi ama onay yazılamadı; kapı şu an 'Bekliyor' durumunda.
Tekrar deneyin."* Dürüstlük yönünde iyi bir adım, ama iki eksik var:
1. **Nereye arşivlendiği yazmıyor.** `archiveDenial` başarı hâlinde tam hedef yolu döndürüyor
   (`write-gate.ts:371` → `{ok:true, path: archiveResolved.targetPath}`) ve sözleşme bu değeri
   kullanmıyor. Panel `docs/approvals/archive/`'i **hiç okumadığı** için (§3: "archive/ alt dizini
   okunmaz") bu yol, kullanıcının kaybolan reddi bulabileceği tek işaret — ve tek seferlik bir
   hata mesajında kaybolup gidiyor.
2. Kullanıcı "reddim arşive gitti ama onay yazılmadı" durumunu **panelde** göremiyor: satır
   `Bekliyor` görünür, arşivlenmiş red hiçbir yerde işaretlenmez. F-007'nin dersi ("iş yapıldı ama
   istemci bilmiyor") kısmen tekrarlıyor — istemci **o an** biliyor, sonrasında bilmiyor.

**Düzeltme:** hata metnine gerçek arşiv yolunu göm (`… docs/approvals/archive/G2-2026-…deny.md
altına taşındı`). Yeniden denemenin güvenli/idempotent olduğunu (§4 adım 1'deki taze kontrol artık
`.deny.md` bulamaz, `archiveDenial` zaten `{ok:true, path:''}` no-op'u destekliyor —
`write-gate.ts:351-353`) sözleşmede **açıkça** yaz. İsteğe bağlı ama önerilir: satırda
"arşivlenmiş red var" rozeti.

### Ö10 · `gates` SSE kanalının yükü ADR-004 madde 5 ile çelişiyor; sapma kaydedilmemiş
**Nerede:** §7 birinci madde (`hub.broadcast('gates', { project_id })`).

`docs/decisions/ADR-004…:27` (madde 5): "`features`/`gates`/`projects` kanalları **durum anlık
görüntüsüdür** (delta değil): **her mesaj ilgili projenin kartlarının tam listesini taşır**."
Sözleşme yalnızca `{project_id}` gönderiyor. F-007 `features` için aynı sapmayı yapmış ve
`src/web/lib/useEventStream.ts:88-93` bunu "mimari §6.1'den bilinçli sapma" olarak not düşmüş —
ama ADR-004 güncellenmemiş. Sözleşme sapmayı hiç anmıyor.

**Düzeltme:** sapmayı §7'de açıkça yaz ve gerekçelendir (debounce + tek `GET` ile taze veri),
ADR-004 madde 5'e küçük bir ek yazılmasını §11'e ödev olarak koy.

### Ö11 · UX akış (d)(e)'nin toast ve buton-devre-dışı şartları planda yok
**Nerede:** §9.1 bileşen listesi, §4/§6.

`docs/03-ux.md:457-467`:
- (d) adım 4: "modal kapanır, satır güncellenir, **yeşil toast: `docs/approvals/G2.ok yazıldı`**"
- (d) adım 3: "Karar alanı boşken **Onayı Yaz →** devre dışıdır"
- (e) adım 3: "**toast: `docs/approvals/G2.deny.md yazıldı`**"
- (e) adım 2: "**Reddet - Kaydet** butonu gerekçe boşken devre dışıdır"

Sözleşmede toast kelimesi hiç geçmiyor; §9.1'de toast bileşeni yok. Bugün toast yalnızca
`src/features/kanban/web/KanbanScreen.tsx:92,382-397` içinde **yerel** olarak var (paylaşılan bir
bileşen değil) — yani gates ekranı ya kendi toast'ını yazacak ya da kanban'ınkini paylaşılan hâle
getirecek (ikincisi kanban dosyalarına dokunmak demek, dosya sahipliği sınırı).

**Düzeltme:** toast kararını (yeni yerel bileşen mi, ortaklaştırma mı) ve iki butonun
devre-dışı/aktifleşme kuralını §4/§9.1'e ekle; toast metinlerini M2 gereği önce `03-ux.md`'ye yaz
(zaten orada, birebir kopyala). `useGates.test.ts`/`GatesScreen.test.tsx` planına buton
devre-dışı assert'i ekle.

---

## NOTLAR

- **N1 · Sözleşme haklı, brief yanlış:** görev brief'i F-006 niyet fonksiyonları için
  `src/features/projects/server/write-gate.ts` yolunu veriyor; böyle bir dosya **yok**. Gerçek yol
  `src/server/write-gate.ts` ve sözleşme baştan sona doğru yolu kullanıyor.
- **N2 · `mtime` seçimi PRD tarafından zorunlu:** `docs/01-prd.md:73` (AC4) "hangi dosyanın daha
  yeni (**değiştirilme zamanı**) olduğunu gösterir" diyor. Sözleşmenin "içerikteki `Tarih:` satırı
  ayrıştırılmaz" kararı doğru ve gerekçesi sağlam. Yalnızca bir kenar durum belgeye not düşülmeli:
  `git clone`/`checkout` sonrası `mtime` içerikteki tarihten farklı olur (ör. `G0.ok` içeriği
  `2026-09-04` der ama `mtime` klonlama anıdır); "Tarih" sütunu bu yüzden içerikteki tarihle
  çelişebilir. UX'te bir cümlelik açıklama yeterli.
- **N3 · `1`-`6` sekme kısayolu bugün hiç yok:** `docs/03-ux.md:730` sayı kısayollarını şart
  koşuyor; `src/web/App.tsx:81-96` yalnızca `ArrowLeft/Right`, `Home`, `End` uyguluyor. F-008'in
  borcu değil (önceden var olan boşluk) ama dördüncü sekme farkı büyütüyor — §11'e bir satır not
  düşülmesi yeterli.
- **N4 · İyi yapılmış üç şey (kayda geçsin):** (a) `@source` + `tests/build-css.test.ts` çifti
  doğru planlanmış ve `build-css.test.ts:170`'teki yapısal çit yeni dizini otomatik yakalayacak;
  (b) `x-mc-write`'ın yeni uçlar için ek kod gerektirmediği iddiası doğru
  (`src/server/index.ts:363`); (c) kanban'ın `void (async () => { try … catch })()` deseninin
  birebir taklidi doğru kaynaktan alınmış (`src/features/kanban/server/handlers.ts:129-211`) ve
  `conflict` dalının `data` ile birlikte dönmesi gerçekten oradaki desen (satır 162-171).

---

## KARAR

**KALDI.** Gerekçe: altı bloklayıcının üçü (B1, B2, B3) **CEO'nun bu tur öncesi verdiği
kararların gövdeye yayılmamış olmasından** kaynaklanıyor — `CLAUDE.md`'nin F-005 dersinin birebir
tekrarı. B1 ayrıca sözleşmenin en kritik iddiasının (self-approval yok) yanlış kapsamda
kurulduğunu gösteriyor ve M1'in şu anki hâli yanlış yolu kapatıyor; F-008 güvenlik sınırını
değiştiren bir feature olduğu için bu tek başına yeterli. B4 ve B5 kod turunun ilk `verify`'ında
kesin duruş üretecek mekanik boşluklar. B6 ise onaylanmış UX + ADR-001 + PRD AC9'un birlikte
yasakladığı bir davranışı sözleşmenin tek başına kural yapması.

Sözleşme yeniden yazılıp ikinci tura girmeli. İkinci turda kapsamım **yalnızca** bu 21 bulgu +
düzeltmelerin ürettiği regresyon olacak; onaylanmış bölümleri (L4, statik çit kapsamı, `x-mc-write`,
hata sınırı deseni, `@source` çiti, AC1-AC9 haritası) yeniden açmayacağım.

---

## Doğruladıklarım (dosya:satır)

| İddia | Kaynak | Sonuç |
|---|---|---|
| **L4:** `archiveDenial` senkron, `Promise` değil, bekleme yok | `src/server/write-gate.ts:342-372` — `export function archiveDenial(root, gate): WriteResult`; gövdede yalnızca `existsSync`/`mkdirSync`/`renameSync`; `delay()`/`Atomics.wait`/`atomicWrite` yok | **✓ DOĞRU** — sözleşmenin cevabı birebir tutuyor, satır aralığı bile doğru |
| `GATE_PATTERN` sözleşmedeki ön-doğrulama deseniyle aynı metin | `write-gate.ts:38` `/^(G[0-6](-\d{1,3})?|ASSETS)$/` | ✓ aynı |
| `archiveDenial` hedef yoksa idempotent no-op | `write-gate.ts:351-353` → `{ok:true, path:''}` | ✓ (sözleşme kullanmıyor, bkz. Ö9) |
| `x-mc-write` tüm non-GET `/api/*` için dağıtıcıda zorunlu | `src/server/index.ts:363` | ✓ satır birebir |
| Hata sınırı yalnızca **senkron** dağıtımı sarar | `src/server/index.ts:161-188` + 149-160 yorumu | ✓ |
| `isAllowedOrigin` `Origin` yokken `true` | `src/server/index.ts:133-142` | ✓ |
| Mevcut `ErrorCode`'lar yeterli | `src/shared/types.ts:37-51` | ✓ |
| `WRITE_HEADER_VALUE` düz metin `'1'` | `src/shared/types.ts:96` | ✓ |
| Statik tarama `src/**`'ı özyinelemeli tarıyor, yeni `src/features/gates/**` otomatik kapsanır | `tests/no-write-gate-bypass.test.ts:129` `walk(path.join(ROOT,'src'), ['.ts','.tsx'])` | ✓ — mutasyon 3/6 tautoloji değil |
| Okuma çağrıları (`readdirSync`/`statSync`/`readFileSync`) yasak listede değil | `no-write-gate-bypass.test.ts:35-62, 68` | ✓ `list-gates` serbest |
| `docs/approvals/` bugün izlenmiyor | `src/features/projects/server/service.ts:93-103` yalnızca `docs/features` | ✓ |
| `onFeatures` deseni | `src/web/lib/useEventStream.ts:94` | ✓ |
| kanban async IIFE + `conflict` dalında `data` ile dönüş | `src/features/kanban/server/handlers.ts:129,136,162-171,211` | ✓ |
| `ceo.md` `tools:` alanında `WebFetch` yok | `.claude/agents/ceo.md:7` | ✓ **ama** `Write`/`Edit` var (B1) |
| `block-dangerous.cjs` `/api/gates`'i yakalamıyor | `.claude/hooks/block-dangerous.cjs:19-30` | ✓ |
| `managedSettings.permissions.ask:['Bash']` | `session.ts:498-501` | ✓ **ama** yalnızca `Bash` (B1) |
| `buildInputPreview` 500 karakter, tek satır | `session.ts:137-142` | ✓ |
| E2E `testMatch` kapalı liste | `playwright.config.ts:14` + 3 config | ✓ (B4) |
| Sekme sayacı çitleri | `App.interaction.test.tsx:251,266`; `shell.spec.ts:46,60`; `App.test.tsx:48` | ✓ (B5) |
| `gate-check.cjs` `docs/`'u muaf tutuyor | `.claude/hooks/gate-check.cjs:9-10` | ✓ (B1) |
| Manifest yardımcısı `mtime` taşımıyor | `docs/qa/F-013-2026-09-08-tur2.md:126` (M3d ölçümü) | ✓ (Ö4) |
| UX aksiyon sütunu durum makinesi | `docs/03-ux.md:196-206` | ✓ (B6) |
| UX Kapılar durum metinleri zaten yazılmış | `docs/03-ux.md:516` | ✓ (B3) |
| PRD AC4 `mtime` diyor | `docs/01-prd.md:73` | ✓ (N2) |
| ADR-001 karar 7 "çelişki oluşmaz" gerekçesi | `docs/decisions/ADR-001…` karar 7 | ✓ (B6) |
| ADR-004 `gates` kanalı tam liste taşır | `docs/decisions/ADR-004…:27` | ✓ (Ö10) |
| `PROCESS.md` §2 `ASSETS` satırı etiketsiz | `docs/PROCESS.md:26` | ✓ (Ö1) |
| `docs/approvals/` gerçek içeriği + `README.md` + `DANGER.ok`/`PUSH.ok` | dizin listesi + `docs/approvals/README.md` + `block-dangerous.cjs:43-46` | ✓ (Ö2) |
| `atomicWrite` tmp'si hedefle aynı dizinde | `write-gate.ts:144-148` | ✓ (Ö2) |

## Doğrulayamadıklarım

1. **`Write(docs/**)`'ın hosted oturumda gerçekten izin kartı çıkarmadan geçtiği** — ⊢ ÇIKARIM,
   ✓ DOĞRULANDI değil. Beş dolaylı kanıt zinciri güçlü (B1 tablosu) ve `session.ts:495-497`'nin
   kendi yorumu proje allow kurallarının geçerli olduğunu söylüyor, ama
   `allowManagedPermissionRulesOnly: true`'nun `Write` üzerindeki net etkisi ancak **canlı** bir
   oturumla ölçülür. Görev kısıtı gereği (kota: `claude` oturumu açma yok) ölçmedim. Kod turunun
   ilk işi bu ölçüm olmalı — `.probe/live-test-e1.mjs` deseni, iki yönlü. **Bu belirsizlik B1'i
   zayıflatmıyor:** sonuç hangi yöne çıkarsa çıksın sözleşmenin "tek yol `Bash`" cümlesi yanlış.
2. **M1 hook regex'inin gerçek dünyadaki yanlış-pozitif oranı** — sözleşmenin kendi
   "Doğrulayamadıklarım" notu burada haklı; ancak M1 iki yönlü self-test şart koştuğu için bu artık
   ölçülebilir bir ödev, açık uçlu bir risk değil.
3. **`npm run verify` / `npm run e2e` çıktısı** — sözleşme turu; kod yok, koşturmadım.
4. **Gerçek tarayıcıda dar genişlik ölçümü (Ö8)** — kod olmadığı için ölçülemez; kod turunda
   zorunlu.
