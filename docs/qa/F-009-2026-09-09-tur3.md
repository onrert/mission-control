KARAR: GEÇTİ
ESKALE: false

---
feature: F-009
title: Spike — transkript format doğrulama + dayanıklı okuyucu + fixture'lar
reviewer: qa-evaluator
date: 2026-09-09
round: 3 (kapanış denetimi — dar kapsam)
---

# F-009 QA tur 3 — kapanış denetimi

Kapsam **dar**: yalnızca 2. turun üç bloklayıcısı (Y1/Y2/Y3) + yeni beyaz liste çitini yenme
denemesi. 1. ve 2. turda GEÇTİ verilen hiçbir şey (fixture anonimliği, `bom-crlf`, 13/13 yol
kaçışı, okuyucunun fırlatmaması, format iddiaları, U2/U4/U5/U6) yeniden ölçülmedi.

Denetlenen commit: `ffe436c` (denylist → allowlist yeniden tasarımı).

## Özet

Üç bloklayıcının üçü de kapandı. Beyaz liste tasarımı, iki turda iki kez yenilen denylist'in
aksine, **okunabilir gerçek prompt metnini** (Türkçe/İngilizce, Latin alfabesi) hiçbir biçimde
geçirmiyor — 21 yeni vektörün tamamı denendi. Kalan kaçaklar **sayısal/alfabe-dışı kanallar**:
teorik olarak bit taşınabiliyor, pratik olarak okunabilir bir prompt sızmıyor. Y2'nin bağlantı
çiti hem kaskadla hem **tek noktayla** kanıtlandı; Y3'ün kaynak-şekli çiti gerçek davranış
çitleriyle değişti ve dört mutasyon biçiminin dördü de doğru sonucu verdi.

---

## Y1 — Beyaz listeyi yenme denemesi: **KAPANDI** (pratik sızıntı yok)

**Tekrar üretme:** sonda dosyalarını `tests/fixtures/transcripts/` altına yaz →
`npx vitest run tests/features/thread/transcripts-privacy-guard.test.ts --reporter=verbose` →
`<ad> hiçbir gizlilik ihlali içermiyor` satırına bak (✓ = sızdı, × = yakalandı) → sondaları sil.

### (a) 24 eski sonda — 24/24 hâlâ takılıyor ✓

P1-P12 ve N1-N14 artık **kalıcı regresyon testi** olarak dosyada duruyor
(`transcripts-privacy-guard.test.ts:288-654`), her biri `violations.length > 0` iddia ediyor.
Kendim koşturdum: `npx vitest run tests/features/thread/` → **82 passed (2 dosya)**, hepsi yeşil.
Round-2'de sızan 11 vektörün 11'i de artık yakalanıyor.

### (b) 21 YENİ vektör — 8 yakalandı, 13 geçti

| # | Sonda | Sınıf | Sonuç |
|---|---|---|---|
| X1 | `+90 532 111 22 33` | **doğal biçimde boşluklu telefon** | **GEÇTİ** |
| X2 | `123 456 789 01` | TC kimlik, 3'lük gruplar | **GEÇTİ** |
| X3 | `1 2 3 4 5 6 7 8 9 0 1` | developer'ın bildirdiği kalan risk | **GEÇTİ** |
| X4 | `g: e: r: c: e: k: p: a: r: o: l: a:` | **sürücü-harfi deseniyle harf harf metin** | **GEÇTİ** |
| X5 | Kiril: `Секретный пароль пользователя` | **token charset'i dışındaki alfabe** | **GEÇTİ** |
| X6 | CJK: `用户的银行密码是一二三` | token charset'i dışındaki alfabe | **GEÇTİ** |
| X7b | `2099-99-99T99:99:99.999Z 2053-21-11T22:33:44.555Z` | ISO desenine 15+15 hane gömme | **GEÇTİ** |
| X8 | `msg_example5321 msg_example1112 msg_example2330` | msg-id desenine 4'er hane gömme | **GEÇTİ** |
| X13 | `905.321.111 223.300.000` | semver desenine 9'ar hane gömme | **GEÇTİ** |
| X9 | `__qax9_sub/.gitattributes` (kişisel metin) | **muafiyet ada dayalı, yola değil** | **GEÇTİ — hiç taranmadı** |
| X18 | `__qax18_sub/inner/.gitattributes` | aynı, iki seviye derin | **GEÇTİ — hiç taranmadı** |
| X10 | `kullanici istemi metni ceo developer yanit normal` | yalnızca onaylı sözcükler | **GEÇTİ** (tasarım gereği) |
| X16 | `kullanici istemi 532 111 22 33 yanit metni` | **onaylı bağlam + boşluklu telefon** | **GEÇTİ** |
| X11 | 5000 karakterlik tek token | kontrol | yakalandı × |
| X12 | `Jøsé Mmüllèr Straße évè àdrèssé` | aksanlı Latin | yakalandı × |
| X14 | `g/e/r/c/e/k p/a/r/o/l/a` | eğik çizgiyle harf harf | yakalandı × |
| X15 | `Şükrü Yılmaz Kadıköy` | **Türkçe düz metin** | yakalandı × |
| X17 | `please read the config file and summarize the errors` | **İngilizce düz prompt** | yakalandı × |
| X19 | `TR 330 006 100 519 786 457 841 326` | IBAN (harf önekli) | yakalandı × |
| X20 | `424 242 424 242 424 242 son kullanma 12 26 cvv 123` | kart + Türkçe sözcük | yakalandı × |
| X7 | bozuk biçimli ISO karışımı | kontrol | yakalandı × |

### (c) Teorik bit taşıma mı, pratik sızıntı mı — **ayrım**

**Pratik sızıntı YOK.** Kaçan 13 vektörün hiçbiri "gerçek bir prompt'un okunabilir biçimde
sızması" değil. Bunu ölçtüm: **projenin fiilen kullandığı iki dilde** (Türkçe X15, İngilizce X17)
ve aksanlı Latin'de (X12) düz metin **her seferinde reddediliyor**, çünkü 57 kelimelik kapalı
kümede olmayan her sözcük tek başına ihlal üretiyor. Round-1 ve round-2'de sızan şey tam olarak
buydu (okunabilir Türkçe cümleler) ve artık kapalı. AC'nin koruduğu şey ("gerçek prompt metinleri
kısaltılır/temizlenir") bu turda gerçekten korunuyor.

**Teorik bit taşıma VAR**, dört kanalda:

1. **Sayısal kanal** — ≤3 haneli çıplak sayılar, ISO damgası (15 hane/token), semver (9 hane),
   `msg_example\d{1,4}` (4 hane). Sonuç: telefon/TC gibi **sayısal PII**, ≤3'lük gruplara
   bölünmüş VE etrafı yalnızca onaylı sözcüklerle çevrilmişse geçiyor (X1, X2, X16).
   Sözleşme §7.1 ve testin yorumu bu noktada **fazla iddialı**: "4+ haneli her sayı — telefon,
   TC kimlik, kredi kartı grupları, IBAN — otomatik reddedilir" cümlesi sınıf düzeyinde bir
   iddia ve boşluklu yazımda yanlış. (Kart ve IBAN gerçek biçimlerinde yakalandı — X19/X20 —
   çünkü harf/sözcük taşıyorlar; telefon ve TC taşımıyor.)
   **Neden bloklayıcı değil:** kazara sızıntı senaryosunda (bir transkript satırı yapıştırılır)
   satır her zaman onaysız sözcük taşır ve yakalanır; yalnızca sayıdan ibaret bir "content"
   alanı gerçekçi bir fixture değil. Kapasitesi bir prompt değil, bir numara.
2. **Alfabe kanalı** — `DRIVE_LETTER` (`^[A-Za-z]:$`) tek harf + iki nokta kabul ettiği için
   `g: e: r: c: e: k:` biçimiyle **keyfî metin harf harf** yazılabiliyor (X4). Bu kasıtlı
   kodlama gerektirir; kaza sınıfı değildir.
3. **Charset dışı alfabeler** — tokenizer `/[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._-]+/` dışındaki her baytı
   **ayırıcı** sayıyor, yani Kiril, CJK, Arapça, emoji ve kontrol karakterleri **hiç token
   üretmiyor → hiç denetlenmiyor** (X5, X6). Beyaz liste tasarımının tek kalan denylist-şekilli
   varsayımı budur ("bu karakterler ayırıcıdır, dolayısıyla zararsızdır"). Bu depo için pratik
   değil (transkriptler TR/EN), ama tasarım belgesinde **yazılı değil**.
4. **Muafiyetin kapsamı** — `.gitattributes` muafiyeti **dosya adına** dayalı ve ağacın her
   yerinde geçerli; alt dizindeki `.gitattributes` adlı bir dosya hiç taranmıyor (X9, X18).
   Yorum "fixture dizinindeki tek git kontrol dosyası" diyor ama kod ada göre, yola göre değil
   eşleştiriyor.

**Sonuç:** Y1 kapandı. Yukarıdaki 4 madde **bloklayıcı değil**, teknik borç olarak yazılmalı
(aşağıdaki "Kalan borç" bölümü).

---

## Y2 — Bağlantı çiti: **KAPANDI** (kaskad ✓ **ve** tek nokta ✓)

| Mutasyon | Hedef | Sonuç |
|---|---|---|
| `isApprovedToken` her zaman `true` (`if (ALLOWED_TOKENS.has(token))` → `if (true)`) | privacy-guard:167 | **35 failed / 19 passed (54)** ✓ kaskad, developer'ın bildirdiğiyle birebir |
| **İnce mutasyon:** `BARE_NUMBER` `{1,3}` → `{1,20}` | privacy-guard:148 | **3 failed / 51 passed** ✓ **kaskad OLMADAN yakalanıyor** |

Brief'in istediği ince mutasyon **kırmızı**: tek bir desenin gevşetilmesi, kaskad devreye
girmeden, doğrudan negatif birim testleriyle (`'4242' → false`, `'12345678901' → false`)
yakalanıyor. Y2'nin "yardımcı gerçek ama bağlantı çitsiz" açığı yapısal olarak kapandı: örtüşen
yedek mekanizma (TC regex'i, secret-prefix, opak blok, yol deseni) artık **kod içinde yok**.

**Tamamlayıcı ölçüm (ÖNEMLİ, bloklayıcı değil):** 7 yapısal desenin her birini tek tek gevşettim.

| Desen | Gevşetme | Sonuç |
|---|---|---|
| `BARE_NUMBER` | `{1,3}` → `{1,20}` | **3 failed** ✓ |
| `ISO_TIMESTAMP` | `/^[0-9TZ:.-]{5,60}$/` | **3 failed** ✓ |
| `SYNTHETIC_UUID` | `/^[0-9a-fA-F-]{36}$/` | **1 failed** ✓ |
| `SEMVER` | `\d{1,3}` → `\d{1,20}` | **54 passed** ✗ çitsiz |
| `DRIVE_LETTER` | `^[A-Za-z]:$` → `^[A-Za-z]{1,20}:$` | **54 passed** ✗ çitsiz |
| `MSG_ID` | `^msg_example\d{1,4}$` → `^msg_.*$` | **54 passed** ✗ çitsiz |
| `COLON_LITERAL` | `^:(...)?$` → `^:.*$` | **54 passed** ✗ çitsiz |

Yedi desenin **üçü** (ve en riskli üçü: çıplak sayı, ISO, UUID) tek nokta çitine sahip; dördü
değil. `DRIVE_LETTER`'ın gevşetilmesi en zararlısı (iki nokta ile biten her sözcük onaylı olur).
Bu bir **eksik çit**tir, hatalı kod değil — ürün davranışı doğru. Brief'in tek nokta ölçütü
(1-3 hane → 1-20 hane) sağlandığı için bloklayıcı saymıyorum; borç olarak yazıyorum.

Her mutasyon birebir geri alındı; `git diff -- tests/features/thread/` temiz.

---

## Y3 — Davranış çitleri: **KAPANDI** (4/4 doğru)

Kaynak-şekli çiti (`expect(source).toMatch(...)`) silinmiş; yerine gerçek
`resolveAllowedTranscriptPath` çağıran S1/S3 testleri konmuş
(`transcript-reader.test.ts:536-592`).

| Mutasyon | Beklenen | Gerçek |
|---|---|---|
| **M10 — satırlar YORUMA alındı** (round-2'de bu biçim 51/51 yeşildi) | S1 tek başına KIRMIZI | **1 failed / 27 passed** ✓ yalnızca S1 |
| **M11 — `resolved` → `candidatePath`** | S3 tek başına KIRMIZI | **1 failed / 27 passed** ✓ yalnızca S3 |
| **M-H — zararsız yeniden adlandırma** (`relFromRootRaw` → `rawRelativeFromRoot`, 5 yer) | YEŞİL | **82 passed** ✓ yanlış pozitif **gitti** |
| **S4 — M6+M11 birleşik kaçış** (kendi repro'm, `tsx` ile gerçek fonksiyon, hermetik geçici kök) | `symlink` | **`{"ok":false,"reason":"symlink"}`** ✓ |

Bağımsız senaryo taraması (geçici kök, junction'lar, temizlik doğrulandı):

| Senaryo | Sonuç |
|---|---|
| S1 — kök dışında, var olmayan dosya | `outside-root` ✓ |
| S2 — kök dışında, var olan dosya | `outside-root` ✓ |
| S3 — kök junction üzerinden, hedef yok | `not-found` ✓ (dosya varken repo testi `outside-root` iddia ediyor ve M11'de kırmızı verdi) |
| S4 — izinli proje içinde junction → kök dışı | `symlink` ✓ |
| S5 — proje dizininin kendisi junction | `symlink` ✓ |
| S6 — mutlu yol | `ok:true` ✓ |

Round-2'nin üç şikâyeti de karşılandı: yorum-satırı mutasyonu artık yakalanıyor, tuzak satır
imkânsız (davranış ölçülüyor), zararsız yeniden yazım artık gürültü üretmiyor.

---

## Ayrıca (kendim koşturdum)

| Kontrol | Sonuç |
|---|---|
| `npm run verify` | **YEŞİL, ilk denemede** (tsc + eslint + test + vite build; worker-fork hatası görülmedi) |
| `npm run test` | **1162 passed, 4 skipped (76 dosya)** — iddia birebir doğru |
| `npm run e2e` | **36 passed (37.6s)** — iddia birebir doğru |
| `grep -rn "MUTATION\|MUTASYON" src/ tests/ electron/ scripts/` | **temiz** — yalnızca kalıcı, meşru test adları (`write-gate-manifest.test.ts:124` dahil, dokunulmadı) |
| Wiki 217/219/220 | **etiketli** — `claude-transcript-formati.md:47-59` üç sayının hangi tarama anına ait olduğunu açıkça yazıyor ("217 (round-1) < 219 (round-2) < 220 (QA)") |
| `git status` | temiz (yalnızca bu turdan ÖNCE de var olan `developer` hafıza dosyaları) |
| Yetim süreç | **0** — `npm run dev` hiç kullanılmadı; yalnızca QA'nın kendi Playwright MCP süreçleri açık. `C:\dev\apps\hayat-mentoru` süreçlerine dokunulmadı. 21 sonda dosyası + 2 sonda alt dizini silindi. |

---

## Puanlama

| Boyut | Puan | Gerekçe |
|---|---:|---|
| İşlevsellik | **9** | Yol çiti altı senaryonun altısında doğru (`symlink`/`outside-root`/`not-found`/`ok`); round-1'in M6+M11 birleşik kaçışı hâlâ kapalı; okuyucu değişmedi ve önceki turlarda kanıtlandı. |
| Özellik bütünlüğü | **8** | AC "fixture'lar anonimleştirilir + yapısal çit": projenin iki dilinde okunabilir hiçbir prompt metni geçmiyor (24 eski + 8 yeni vektör kırmızı). −2: sayısal PII (boşluklu telefon/TC) ve charset dışı alfabeler denetlenmeden geçiyor, ve sözleşmenin "4+ haneli her sayı … otomatik reddedilir" cümlesi sınıf düzeyinde fazla iddialı. |
| Görsel/UX (wiki sayfası) | **9** | 217/219/220 üç ayrı tarama anı olarak etiketlenmiş; kontrol listesi script'i önceki turda birebir koşturuldu; sürüm iddiası önceki turda tam taramayla eşleşti. |
| Kod kalitesi (test/hata yönetimi) | **8** | Tek mekanizma + kaskad (35/54) + tek nokta çiti (3 desen); kaynak-şekli çiti gerçek davranış çitiyle değişti ve dört mutasyon biçiminin dördü doğru; tüm mutasyonlar birebir geri alındı. −2: 7 desenin 4'ünde tek nokta negatif testi yok, ve iki tarama deliği (charset dışı bayt, ada dayalı muafiyet) belgelenmemiş. |

Dört boyut da ≥ 7 → **KARAR: GEÇTİ**.

---

## Kalan borç (bloklayıcı DEĞİL — F-010/F-011 turlarına taşınmalı)

1. **Charset dışı bayt sessizce düşüyor.** Tokenizer'ın kabul etmediği her karakter ayırıcı
   sayılıyor; Kiril/CJK/emoji içeriği sıfır token üretiyor ve hiç denetlenmiyor. Ucuz kapatma:
   satırda `[A-Za-z0-9çÇğĞıİöÖşŞüÜ:._\-{}\[\]",\\/%@\s+]` dışında bir bayt varsa doğrudan ihlal
   say (beyaz liste mantığının tokenizer'a da uygulanması).
2. **`.gitattributes` muafiyeti ada değil, YOLA bağlanmalı** (`path.relative(FIXTURES_DIR, full)
   === '.gitattributes'`). Şu hâliyle alt dizinlerdeki aynı adlı dosyalar hiç taranmıyor.
3. **`SEMVER`, `DRIVE_LETTER`, `MSG_ID`, `COLON_LITERAL` desenlerine birer negatif birim testi.**
   Dördü de gevşetildiğinde 54/54 yeşil kalıyor; kaskad kırılırsa fark edilmez.
4. **Sözleşme §7.1 ve test yorumundaki "4+ haneli her sayı — telefon, TC kimlik, kredi kartı
   grupları, IBAN — otomatik reddedilir" cümlesi düzeltilmeli**: doğru ifade "4+ haneli tek bir
   token reddedilir; ≤3'lük gruplara bölünmüş sayı dizileri geçer". Kredi kartı ve IBAN gerçek
   biçimlerinde harf/sözcük taşıdıkları için pratikte yakalanıyor, telefon ve TC yakalanmıyor.
5. **`createTranscriptReaderStatsTracker().record()` hâlâ tüketicisiz** (round-1'den devreden
   bilinen sınırlama; feature notundaki "F-010 bağlamazsa sil" maddesi geçerli).
