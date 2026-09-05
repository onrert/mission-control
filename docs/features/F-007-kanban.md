---
id: F-007
title: Kanban panosu + frontmatter status yazma + çakışma/echo yönetimi
status: done
owner: developer
deps: [F-005, F-006]
sprint: 1
---
## Açıklama
Faz 1'in en büyük ve en riskli parçası: feature kartları, 7 sütun (+ "Bilinmeyen durum"), sürükle-bırak ile dosyaya yazma, eşzamanlı dış değişiklik çakışması ve chokidar echo yönetimi.
Kaynak: `docs/02-architecture.md` §7; `docs/03-ux.md` ekran 2 + akışlar (a), (b), (c).

## Kabul kriterleri
- [x] Kartlar frontmatter `status` değerine göre doğru sütunda görünür (PRD F2/AC1). Kanıt: `parse-feature.test.ts` (AC1 birim), `kanban.spec.ts` T2/AC6 senaryoları (gerçek Chromium); mutasyon 1 (`columnFor` her zaman `'todo'`) KIRMIZI verdi (`docs/qa/F-007-contract.md` "Mutasyon kanıtı").
- [x] Sürükleme YALNIZCA `status` alanını değiştirir; dosyanın geri kalanı karakter bazında aynı kalır (PRD F2/AC2) — diff testiyle kanıtlanır. Kanıt: `tests/server/write-gate.test.ts` bayt-koruma golden fixture'ları (F-006'dan miras, bu turda async imzaya uyarlandı), `kanban.spec.ts` AC9 gerçek dosya yazımı.
- [x] Dosya dışarıdan değiştiğinde pano en geç 2 sn içinde günceli yansıtır (PRD F2/AC3). Kanıt: `tests/e2e/kanban.spec.ts:158` gerçek duvar-saati ölçümü (`elapsed < 2000ms`), gerçek chokidar + gerçek SSE.
- [x] Çakışma: diskteki içerik beklenenden farklıysa yazma durur, "dosya değişti" uyarısı gösterilir, kart yeni duruma göre yeniden çizilir; sessizce üzerine yazılmaz (PRD F2/AC4). Kanıt: `tests/integration/features-api.test.ts` 409 testi, `useFeatures.test.ts` conflict testi, `kanban.spec.ts:261` gerçek yarış senaryosu; mutasyon 3 (`expected_hash` kontrolü atlandı) KIRMIZI verdi.
- [x] Yazma hatasında kart eski sütununa döner, okunabilir hata gösterilir, panel çökmez (PRD F2/AC5). Kanıt: `useFeatures.test.ts` rollback testleri, `kanban.spec.ts:303` gerçek salt-okunur dizin; mutasyon 4 (ham hata mesajı sızması) KIRMIZI verdi. **QA düzeltme turu 1 (B1) sonrası güncellendi:** yazma başarılı olup yeniden okuma (`rereadCard`) başarısız olduğunda istemci artık asla yanıtsız kalmaz — `handlers.ts`'teki async IIFE tamamı `try/catch`'e alındı, yarı-başarı durumunda `data` olmadan `200` döner. Kanıt: `tests/integration/features-api.test.ts` "D46/B1" fault-injection testi (gerçek HTTP yanıtı + süreç ayakta); mutasyon D46 (try/catch kaldırıldı) KIRMIZI verdi (`docs/qa/F-007-contract.md` "Mutasyon kanıtı — düzeltme turu 1").
- [x] Tanımsız `status` değeri "Bilinmeyen durum" sütununda görünür ve buradan geçerli bir sütuna sürüklenebilir (PRD F2/AC6, ADR-001 karar 5). Kanıt: `parse-feature.test.ts` AC6 testi, `kanban.spec.ts:188` gerçek sürükleme.
- [x] Karta tıklanınca id, title, owner, deps, sprint salt okunur görünür (PRD F2/AC7). Kanıt: `KanbanScreen.test.tsx` modal içerik/focus-trap testleri.
- [x] Kendi yazımız chokidar üzerinden geri gelip sonsuz döngü veya yanıp sönme yaratmaz. Kanıt: `useFeatures.test.ts` echo/hash-birleştirme testleri (test bu turda güçlendirildi, bkz. kontrat "Mutasyon kanıtı"), `kanban.spec.ts:367` D42 render-sayacı ölçümü; mutasyon 5 (hash birleştirme kaldırıldı) KIRMIZI verdi.
- [x] Sürükle-bırakın klavye alternatifi çalışır (UX erişilebilirlik bölümü). Kanıt: `keyboardCoordinates.test.ts`, `kanban.spec.ts:217` gerçek `Tab`/`Space`/`ArrowRight`/`Enter` tuş dizisi; mutasyon 10 (piksel artışı) ve mutasyon 14 (`keyboardCodes.start` bozuldu) ikisi de KIRMIZI verdi.
- [x] Sütun başlıkları "Geliştirme (dev)" biçimindedir (ADR-001 karar 8). Kanıt: `KanbanScreen.test.tsx`/`KanbanColumn.tsx` render testleri, `constants.ts` `STATUS_COLUMNS` sabiti.

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/kanban/**` (server + web), frontmatter yaması, ilgili testler.

## Notlar / kararlar
- Tüm yazmalar F-006 yazma kapısından geçer; doğrudan `fs` çağrısı yasak.

## F-005'ten devralınan taahhütler (CEO, 2026-09-05)

**Tümü kapatıldı (2026-09-06, kanıtlar `docs/qa/F-007-contract.md` "Mutasyon kanıtı" bölümünde):**
- [x] Madde 1 (tablist) — `App.tsx` `role="tablist"/"tab"/"tabpanel"`, `App.test.tsx` kanıtlıyor; mutasyon 9 (`role="tablist"` kaldırıldı) KIRMIZI verdi.
- [x] Madde 2 (AC1 görsel kanıt) — `kanban.spec.ts:140` T2 senaryosu, gerçek `POST /api/projects` + 5 sn içinde kart görünürlüğü.
- [x] Madde 3 (dar genişlik) — `kanban.spec.ts:341` T3, 375px'te sekmeler+dişli erişilebilir. **QA düzeltme turu 1 (B2) sonrası güncellendi:** QA'nın ölçtüğü gibi eski tek-satırlık `overflow-x-auto` düzeni 375px'te her iki sekmenin de kırpılmış görünür genişliğini 0 px'e indiriyordu (`toBeVisible()` bunu yakalamıyordu). Sekme çubuğu artık <640px'te kendi tam genişlikli satırına iniyor; çit `toBeVisible()` yerine gerçek kırpılmış-görünür-genişlik (`getBoundingClientRect` + scroll kabı kırpması) ölçüyor, her iki sekme için de `>0` bekliyor. Kanıt: `tests/e2e/kanban.spec.ts:349-389` (`clippedVisibleWidth`); mutasyon D47 (eski düzene geri dönüş) KIRMIZI verdi.
- [x] Madde 4 (`Atomics.wait`→async) — `write-gate.ts` `delay()` `setTimeout` tabanlı, `setFeatureStatus`/`writeGateApproval`/`writeGateDenial` async; `write-gate.test.ts` T4 mikro-görev testi, mutasyon 7 (senkron bekleme geri getirildi) KIRMIZI verdi.
- [x] Madde 5 (`safeYamlValue` sertleştirme) — `YAML_INDICATOR_START` + `resolvesToNonString` (gerçek `yaml.parse()` tip kontrolü), 40/40 golden fixture; mutasyon 8/8b ikisi de KIRMIZI verdi.
- [x] Madde 6 (`OPERATION_PATTERNS` koşulu) — bu turda `OPERATION_PATTERNS`'a dokunulmadı (grep ile doğrulandı, `write-gate.ts` diff'i yalnızca madde 4/5'in gerektirdiği satırları içeriyor) — koşul tetiklenmedi, kayıt olarak kalıyor (F-008'e devir).

1. **Tam ve geçerli `tablist` deseni.** F-003 ve F-005 bilinçli olarak sekme deseni kurmadı: tek
   gerçek ekran varken `role="tab"` geçersiz ARIA üretiyor (bağlamı `tablist` olmadan). Kanban
   **gerçek ikinci sekmeyi** getirdiği için desen burada kurulacak: `role="tablist"` + `role="tab"` +
   `role="tabpanel"` + `aria-controls`/`id` eşleşmesi + ok tuşu gezinmesi + roving `tabindex`.
   Ayarlar bu desene **girmez** — o sağda sabit bir dişli düğmesidir (`docs/03-ux.md:21`).
2. **AC1'in görsel kanıtı.** F-005'in AC1'i ("klasör eklendiğinde `docs/features/*.md` dosyaları
   5 sn içinde görünür") yalnızca `features` SSE sinyali seviyesinde kanıtlandı; "kanbanda görünür"
   kısmı Kanban var olmadığı için ertelendi (F-005 sözleşmesi §9). F-007 bunu uçtan uca kanıtlamalı.
3. **Dar genişlikte gezinme kaybolmamalı.** `docs/03-ux.md:17` birincil senaryoyu 320-480px
   (VS Code Simple Browser) olarak tanımlıyor ve "gizli navigasyon olmasın" diyor. F-005'te Ayarlar
   dişlisi sağa sabitlenince nav etiketleri 375px'te kaydırma şeridinin arkasında kaldı; bugün
   statik etiket oldukları için gezinme kaybı yok, ama **Kanban gerçek sekmeye dönüşünce bu kuralı
   ihlal eder**. F-007 sözleşmesine dar genişlikte gezinilebilirlik kriteri konmalı ve E2E'de
   375px'te ölçülmeli.
4. **`Atomics.wait` asenkrona çevrilecek.** F-006'nın yazma kapısı EPERM/EBUSY için `Atomics.wait`
   ile **senkron** yeniden deneme yapıyor (50/100/200 ms). F-006'da kabul edilebilirdi çünkü modül
   hiçbir HTTP handler'a bağlı değildi. **F-007 onu `PATCH /api/features`'a bağladığı gün** bu
   ~350 ms ana iş parçacığını bloklar ve SSE akışı dahil **tüm istekleri** durdurur. F-007
   sözleşmesi bunu asenkron bir yaklaşımla değiştirmek zorundadır. Kaynak: `docs/qa/F-006-contract.md`
   §9 risk 4 + QA doğrulama tur 2.
5. **`safeYamlValue` sertleştirilecek — handler'a bağlamadan ÖNCE.** QA ölçtü (F-006 doğrulama
   turu 2, NOT-3): `src/server/write-gate.ts:190` yalnızca `:`/`#`/`\r`/`\n` görünce tırnaklıyor;
   `"x`, `[x`, `*x`, `!x` gibi değerler **ayrıştırılamaz bir `status:` satırı** üretiyor. F-006'da
   bloklayıcı sayılmadı çünkü `setFeatureStatus`'un `src/` içinde **hiç çağıranı yok** (grep: 0).
   **F-007 onu `PATCH /api/features`'a bağlayan feature'dır** — bağlamadan önce kapatılmalı.
6. **`OPERATION_PATTERNS` gevşetilirse adım 3/6 aynı turda çitlenecek.** QA'nın koşulu: yol
   çözümlemesinin 3. ve 6. adımlarının **bağımsız kapsaması sıfır** (adım 8'in işlem/yol regex'i
   onları gölgeliyor; QA 28 varyantla doğruladı). Bugün kabul edilebilir. Ama F-007
   `OPERATION_PATTERNS`'a yeni bir desen eklerse veya mevcut birini gevşetirse, o gölge kalkar ve
   adım 3/6 **aynı turda** çitlenmek zorundadır.

## QA kod turu (2026-09-06, KARAR: KALDI) — düzeltme turu 1 kapatıldı

QA raporu: `docs/qa/F-007-2026-09-06.md` (2 bloklayıcı: B1, B2 · 5 önemli: Ö1-Ö5 · 4 not: N1-N4).
Developer'ın kapsamındaki 7 madde (B1, B2, Ö1, Ö2, Ö3, Ö4, N1 — Ö5 CEO ödevi, kod sahipliğinde
değil) kapatıldı, commit'ler: `7ebd29b` (D46/B1), `73faeea`+`f6b516b` (D47/B2), `fc4a1cf` (N1),
`e8686f7` (D49/Ö4). Ö1/Ö2 (roving tabindex + ok tuşu testi) ve Ö3 (`aria-controls` ters yön çiti)
`73faeea` ile aynı `App.tsx` diff'inde çözüldü (D50/D48). Mutasyon kanıtı: `docs/qa/F-007-contract.md`
"Mutasyon kanıtı — düzeltme turu 1 (2026-09-06)" — D46/D47/D48a/D48b/D50/N1 birer kez, D49 beş kez
ardışık koşuldu, hepsi KIRMIZI. Açık kalan: Ö5 ve N3 (CEO ödevi, `docs/03-ux.md` güncellemesi —
`docs/blockers.md`'de kayıtlı, bu feature'ın dosya sahipliği dışında).
