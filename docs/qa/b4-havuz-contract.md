---
type: qa-contract
date: 2026-09-16
status: qa
karar: (qa-evaluator'ın kararı bekleniyor)
---

# Sözleşme — B-4 devam turu: vitest havuz bölme denemesi (yapısal fix aranıyor, altyapı turu)

**Kaynak:** CEO görev talimatı (2026-09-16) — B-4'ün üçüncü kez ele alınışı. Önceki iki tur
(`docs/qa/b4-test-kararsizligi-contract.md`, `docs/blockers.md` 2026-09-11 girdileri) kök nedeni
bulamadan "ölçülmüş ve yönetilen risk" kararıyla kapanmıştı. Bu tur, o zamanlar mevcut olmayan iki
YENİ sinyal (çökme yalnızca `tests/integration`'da/3 dosyada + `threads` altında tam suite'te 0
çökme ama 5 dosyada sistematik assert kırmızısı) ile aynı soruyu tekrar açtı.

**Neden var (tek cümle):** `npm run verify`'in "3 ardışık tam yeşil koşu" G6 kanıt şartını
karşılayıp karşılamadığını YAPISAL olarak (yeniden koşmaya bağlı olmadan) garantilemenin mümkün
olup olmadığını ölçmek.

**Dosya sahipliği:** `vitest.config.ts` (denendi, SONUÇTA HİÇBİR DEĞİŞİKLİK bırakılmadı — §4),
bu sözleşme dosyası, `docs/blockers.md`. `src/**` ve mevcut test dosyalarının içeriği
**değişmedi**.

## 1. Denenen yaklaşım — vitest `test.projects` ile havuzu dosyaya göre bölmek

### 1a. Hipotez
CEO'nun verdiği iki yeni sinyal tutarlıydı: `forks` (varsayılan) altında çöken 3 dosya
(`chat-api`, `features-api`, `events-api`) `threads` altında TEMİZ geçiyordu; `threads` altında
sistematik kırmızı veren 5 dosya (hepsi gerçek bir Node alt süreci başlatıyor veya paylaşılan bir
dış kaynağa — sabit port, ortak `dist/` — dokunuyor: `install-hook`, `send-event-hook`,
`check-ports`, `build-css`, `usage-aggregator`) `forks` altında TEMİZ geçiyordu. İki küme
KESİŞMİYORDU. Hipotez: alt süreç başlatan/paylaşılan-kaynak dosyalarını `forks`'ta bırakıp geri
kalanını `threads`'e taşımak, her iki havuzun kendi güvenli bölgesinde çalışmasını sağlar ve
toplam kırmızı oranını düşürür.

### 1b. Uygulama (vitest 5's `test.projects`, iki proje)
`process-isolated` projesi (`pool: 'forks'`) — 9 dosya: yukarıdaki 5 + `verify-test-run.test.ts`,
`chat-hooks-live.test.ts`, `gates-write-permission-live.test.ts` (canlı/skip-gated ama gerçek alt
süreç/SDK çağrısı taşıyor), ve keşfedilen ek bir dosya, `tests/hooks-selftest.test.ts` (yeni,
`_selftest.cjs`'i alt süreç olarak çağırıyor — ilk taramada kaçmıştı, `grep -rl
"child_process\|spawn"` ile tam liste çıkarılınca bulundu). `default` projesi (`pool: 'threads'`)
— geri kalan ~79 dosya.

**Karşılaşılan ve çözülen yapılandırma hatası (kendi kendine yakalandı, kayda değer):**
`test.projects` bildirildiğinde vitest köke "container" davranışı uygular (kendi include/exclude'u
KOLEKSİYON için kullanılmaz) — ama üst düzey `test.include`/`test.exclude` ALANLARI hâlâ mevcutsa,
canlı `npx vitest list` ile ölçüldü: her iki alt proje kendi `include`'ına üst düzey `include`'ı
**birleştiriyor (concatenate, override DEĞİL)**. Sonuç: `process-isolated` projesinin efektif
include'u genişleyip NEREDEYSE HER dosyayı kapsıyor, `default` de aynı şekilde — her test dosyası
**İKİ KEZ** çalıştırılıyordu (168 dosya/3576 test raporlandı, gerçek 88/1856 yerine). Üst düzey
`include`/`exclude` alanları tamamen kaldırılınca (`npx vitest list` ile doğrulandı: sıfır
yinelenen dosya) bu düzeldi. Bunun `scripts/verify-test-run.mjs`'in disk-sayım çitiyle çakışması
(o script bu dosyanın METNİNDEN ilk `include:`/`exclude:` dizi literalini regex'le okuyor,
`test.projects` içindeki gerçek koleksiyonu DEĞİL) `include`/`exclude`'ı yorum satırı olarak
(gerçek config'in dışında, yalnızca o regex'in okuması için) bırakarak çözüldü — bu dosyanın
kendisinde ayrıntılı yorumla belgeli.

### 1c. Ölçüm — İKİ ayrı deneme, ikisi de reddedildi

**Deneme A — iki proje PARALEL çalışıyor (vitest'in varsayılanı, `sequence.groupOrder` verilmedi):**
16 koşu (10+6, iki ayrı parti, aralarında config'e dokunulmadı):

| Sonuç | Sayı | Not |
|---|---|---|
| Tam yeşil | 8/16 (%50) | |
| Assert kırmızısı | 4/16 (%25) | **Hepsi AYNI test**: `tests/verify-test-run.test.ts`'in B1 kalıcı regresyon testi. Bu test kendi içinde GERÇEK bir `npm run test` alt süreci spawn ediyor (kasıtlı, B1'in kendi tasarımı); nested koşu bazen KENDİSİ çöküyor (özet satırı hiç basılmıyor) ve dıştaki assert (`stderr.toContain('does not match the')`) bu yüzden kırmızı veriyor — YENİ bir hata değil, B-4'ün AYNI instabilitesinin bir katman aşağıda görünmesi. |
| Çıplak süreç çökmesi (`exitCode 3221226505`, ~9-11s, SIFIR test çıktısı) | 4/16 (%25) | Tarihsel Sınıf A/D'den FARKLI: dıştaki `npm run test`/vitest süreci başlamadan hemen sonra kendisi çöküyor, vitest'in kendi "Unhandled Error" yakalayıp exit 1 vermesi bile olmuyor. |

**Deneme B — projeler SIRALI çalışıyor (`sequence.groupOrder: 0`/`1`, önce `process-isolated`
sonra `default`) — Deneme A'nın "iki havuz aynı anda ayakta, toplam süreç sayısı arttı" hipotezini
test etmek için:** 10 koşu:

| Sonuç | Sayı |
|---|---|
| Tam yeşil | 4/10 (%40) |
| Assert kırmızısı (aynı B1 testi) | 2/10 (%20) |
| Çıplak süreç çökmesi | 4/10 (%40) |

Sıralı çalıştırma çöküşü **daha kötü** yaptı (koşum süresi de ~90-98s'ye çıktı, paralelin
~60-87s'sine göre — beklenen, artık toplam süre = iki projenin ayrı ayrı süresinin toplamı).

### 1d. Kontrollü karşılaştırma — AYNI oturum, AYNI makine, DEĞİŞTİRİLMEMİŞ config

Deneme A/B'nin kötü sonucunun "bu makine o an genel olarak dengesizdi" ihtimalini elemek için,
hemen ardından `vitest.config.ts` ORİJİNAL haline (bu sözleşmenin başında olduğu hal, `git diff`
boş) döndürülüp AYNI ölçüm scripti ile 8 koşu yapıldı:

| Sonuç | Sayı |
|---|---|
| Tam yeşil | 6/8 (%75) |
| Kırmızı (`exit 1`, ne assert kırmızısı ne çıplak süreç çökmesi — vitest'in KENDİSİ crash'i yakalayıp düzgün exit 1 verdiği, tarihsel Sınıf A ile tutarlı) | 2/8 (%25) |
| **En uzun ardışık tam yeşil zincir** | **3 (koşu 1-2-3)** |

Bu, önceki turların ölçtüğü ~%20-25 taban oranıyla BİREBİR tutarlı — ve QA'nın mevcut G6 kuralının
("ardışık üç tam yeşil koşu") bu oturumda, değişiklik YAPMADAN, 8 koşu içinde zaten bir kez
karşılandığını gösteriyor.

## 2. Sonuç — YAPISAL DÜZELTME BAŞARISIZ, DAHA KÖTÜLEŞTİRDİ

**"Buldum" demiyorum.** Kök neden hâlâ bulunamadı (üçüncü turdur). Ama bu turun kendi denemesi
için kesin bir sonuç var: `test.projects` ile havuzu dosyaya göre bölmek (paralel VEYA sıralı)
kırmızı oranını düşürmedi, tam tersine **%25 taban orandan %50-60'a çıkardı** VE mevcut
"vitest kendi çöküşünü yakalar, exit 1 verir" güvencesini bozan YENİ, daha ağır bir arıza biçimi
(dıştaki sürecin kendisinin sıfır çıktıyla çökmesi) ekledi. Kontrollü karşılaştırma (§1d) bunun
"o oturumda makine zaten dengesizdi" ile açıklanamayacağını gösteriyor — aynı oturumda, hemen
ardından, değiştirilmemiş config ile taban orana geri dönüldü.

**Olası açıklama (ölçülmedi, sadece not):** `test.projects` her proje için kendi worker havuzunu
ayrı kurup ayrı bir Vite sunucusu/ortamı başlatıyor; bu, tek-havuzlu koşuya göre tepe süreç
sayısını ve/veya bellek/handle baskısını artırıyor gibi görünüyor — tam bu deponun B-4 tarihinde
zaten öne çıkan "Windows + Node + dosya sistemi kaynak baskısı" açıklamasıyla aynı ailede. Bu
turda daha fazla kovalanmadı (brief'in ölçüm bütçesi ve "kök nedeni bulamazsan dur" kuralı
gereği).

**Yan bulgu (ayrı, kayda değer, borç olarak taşınıyor — §3):** `tests/verify-test-run.test.ts`'in
B1 kalıcı regresyon testi KENDİSİ gerçek bir nested `npm run test` spawn ediyor; bu nested koşu
KENDİ başına B-4'ün aynı ~%20-25 çökme riskini taşıyor. Bu, konfigürasyondan bağımsız, ÖNCEDEN DE
var olan bir risk olmalı (nested koşu her zaman gerçek bir alt-süreç vitest çalıştırıyordu) ama bu
turda ilk kez CANLI olarak assert-kırmızısı biçiminde gözlendi ve dokümante edildi.

## 3. Karar ve geri alma

`vitest.config.ts` **DEĞİŞTİRİLMEDİ** — orijinal haliyle bırakıldı (`git diff vitest.config.ts`
bu sözleşmenin sonunda **boş**). `test.projects` denemesi (Deneme A ve B, ikisi de) ölçüldü ve
REDDEDİLDİ. Bu turun katkısı yalnızca ölçüm: bir yapısal fix denendi, ikisi de kontrollü şekilde
daha kötü çıktı.

| Seçenek | Ölçülen sonuç | Karar |
|---|---|---|
| `test.projects` (forks: alt-süreç/paylaşılan-kaynak dosyaları, threads: geri kalan), paralel | n=16, kırmızı %50 (4 assert + 4 çıplak çökme) | **REDDEDİLDİ** |
| Aynısı, `sequence.groupOrder` ile sıralı | n=10, kırmızı %60 (2 assert + 4 çıplak çökme) | **REDDEDİLDİ** |
| Değişiklik yapmamak (orijinal, tek havuz `forks`) | n=8 (kontrollü, aynı oturum), kırmızı %25, en uzun yeşil zincir 3/8 | **SEÇİLDİ (değişiklik yok)** |

## 4. G6 için önerilen kanıt kuralı — DEĞİŞMEDİ, YENİDEN DOĞRULANDI

Önceki turun (`docs/qa/b4-test-kararsizligi-contract.md`) QA kararı hâlâ geçerli ve bu turda
YENİDEN ölçülerek desteklendi:

1. `npm run test`/`npm run verify` **izole** koşulur (aynı anda başka ağır süreç yok — bu turda
   ölçüm scripti kendisi de bu kurala uydu, tek seferde bir koşu).
2. **Assert kırmızısı = gerçek hata, her zaman bloklayıcı** — TEK istisna: hata metni tam olarak
   `tests/verify-test-run.test.ts`'in B1 testinden ve mesajı "could not find a ... summary line"
   içeriyorsa, bu B-4'ün AYNI instabilitesinin nested-koşuda görünen hâlidir (§1c/§2 yan bulgu) —
   yine de bir kez daha koşturulmalı, ama "yeni bir regresyon" olarak yorumlanmamalı.
3. Worker/süreç çökmesi (assert kırmızısı **sıfır** olmak kaydıyla, `exit 3221226505` ya da vitest'in
   kendi "Unhandled Error" yakalayıp verdiği `exit 1` dahil) yeniden koşmayı gerektirir, karar
   değildir.
4. Yayın kanıtı için **ardışık üç tam yeşil koşu** istenir, kırmızıda sayaç sıfırlanır (mevcut
   QA kararı, değişmedi).

**Bu turun somut kanıtı:** kontrollü 8 koşuluk örneklemde (§1d), değiştirilmemiş config ile, bu
kural karşılanabilir bulundu (koşu 1-2-3 ardışık tam yeşil). Taban oran ~%25 iken 3 ardışık yeşil
elde etmenin beklenen deneme sayısı düşük (birkaç koşu) — pratikte uygulanabilir bir kanıt şartı.

## 5. Kalan riskler / açık borçlar

- **Kök neden hâlâ bulunamadı** (üçüncü turdur) — Windows/Node/vitest fork etkileşiminde kalıyor
  gibi görünüyor, bu depronun kontrol edebileceği bir yapılandırma değişikliğiyle
  düzeltilemedi (üçüncü kez ölçüldü).
- **YENİ borç — `tests/verify-test-run.test.ts`'in B1 testi kendi başına ek bir kırmızı kaynağı.**
  Nested `npm run test` spawn'ı kendi ~%20-25 çökme riskini taşıyor; bu risk config'ten bağımsız,
  önceden de vardı ama bu turda ilk kez canlı gözlemlendi. Eşik: bu test dosyasına dokunan bir
  sonraki tur, ya da G6 sırasında bu spesifik hata tekrar görülürse.
- **YENİ borç (ölçülmedi, hipotez) — `test.projects`'in kendisi (herhangi bir nedenle, tek proje
  koşusuna göre) tepe süreç/kaynak baskısını artırıyor olabilir.** Bu depoda `test.projects`
  gelecekte başka bir amaçla (örn. tarayıcı testleri, farklı ortam gereksinimleri) tekrar
  düşünülürse, önce KÜÇÜK bir pilot ölçümle bu riski yeniden test etmek gerekir — büyük ölçekli
  benimsemeden önce.
- Sınıf B (`ENOTEMPTY` temp-dizin yarışı) bu turda ayrıca gözlenmedi/aranmadı; önceki tur zaten
  bunu ayrı, bağımsız bir flake olarak kayıtlı tutuyordu, bu turun kapsamı dışında.

## 6. Doğrulama ve hijyen

- `git diff vitest.config.ts`: **boş** (bu sözleşmenin sonunda, orijinaline dönüldü).
- `npx tsc --noEmit`: 0 hata (hem deneme sırasında hem son hâlde).
- `npx eslint vitest.config.ts`: 0 hata (deneme sırasında).
- `npm run test` (tek koşu, son/orijinal hâl): `Test Files 87 passed | 1 skipped (88)`,
  `Tests 1852 passed | 4 skipped (1856)`, exit 0.
- `tasklist` içinde `node.exe` sayısı, tur sonunda: **0** (yetim süreç yok).
- Bu turda `npm run e2e` AYRICA koşulmadı — hiçbir kod/config değişikliği kalıcı olarak
  bırakılmadığı için (brief madde 4/"bitti tanımı" bunu yalnızca bir değişiklik bırakılırsa
  istiyor).
