---
name: duzeltme-turu-kontrolleri
description: Dar düzeltme turu QA'sında zorunlu kontroller — brief'in öncülünü doğrula, önceki turda YEŞİL kalan mutasyonları tekrar dene, düzeltmenin görünür kıldığı yeni tutarsızlığı ara
metadata:
  type: feedback
---

Dar "düzeltme turu doğrulaması" briefinde şu üç kontrol her seferinde iş çıkardı:

1. **Brief'in öncülünü kodda doğrula.** F-002 fix1 turunda brief "gün dosyası adı yerel tarihe
   göre üretiliyor" diyordu; kod aslında `toISOString()` ile **UTC** kullanıyordu. Öncülü
   doğrulamadan analiz yazsaydım rapor yanlış olurdu.
2. **Önceki turda YEŞİL kalan mutasyonları birebir tekrar uygula.** "Test eklendi" demek
   ölçüyor demek değil; yeni testi değil, eski çiti kırarak dene.
3. **Düzeltmenin görünür kıldığı davranışı ara.** Süreç eskiden çöktüğü için gözlemlenemeyen
   yollar, düzeltmeden sonra ilk kez gözlemlenebilir olur (F-002: 503 dönen olay ring'de kalıp
   `GET /api/events`'te hayalet olarak görünüyor).

4. **Dosyadaki bölüm SIRASINA bak.** Developer düzeltme yanıtı, sonradan eklenen bir CEO
   kararından ÖNCE geliyorsa o karar sözleşmeye işlenmemiştir — F-004 tur 2'de CEO'nun iki
   kademeli zamanlama assert'i (sert kapı >1000 ms + scriptin iç ölçümü) hiçbir bölüme
   girmemişti, sözleşme hâlâ CEO'nun kırılgan bulduğu tek kademeli `elapsedMs < 400`'ü
   taşıyordu. F-005 tur 2'de aynısı tekrarladı: CEO "tam tablist deseni F-007'ye ertelendi"
   dedi, gövde hâlâ `useTabs.ts` + `role="tablist"` kuruyordu ve §9 kararı "AÇIK SORU" olarak
   taşıyordu. Bu desende SON bölümü ÖNCE oku, sonra gövdeyi ona karşı grep'le
   (`grep -n 'role="tab\|useTabs\|AÇIK SORU'`); ayrıca kararın hayatta bıraktığı taslağın
   kendisi de karara uymayabilir (F-005'te (a) seçeneği hâlâ `role="tablist"` içeriyordu).
5. **Mutasyon senaryosunu MUTASYONLU hâlde de elle yürüt.** "En az 5 kez damlatan sunucu" gibi
   ÜST SINIRI olmayan değil, ALT sınırı olan ifadeler mutasyona kaçış yolu bırakır: F-004'te
   5 damla bitince idle bekçisi devreye girip mutasyonu yeşile döndürüyordu. Sayıları
   (aralık · eşik · toplam) hem normal hem mutasyonlu yolda yaz.
6. **İki ayrı düzeltmeyi birbirine karşı sına.** Aynı turda kapatılan iki bulgu çelişebilir:
   F-004'te parse-hatası gövdesinin `raw_text = MC_MAX_PAYLOAD karakter` tanımı, aynı turda
   eklenen kırpma zarfını tetikleyip `raw_text`'i düşürüyor ve yeni eklenen testi yapısal
   olarak kırmızı doğuruyordu.

7. **Zamanlama eşiği doğrulaması: testi kopyala, depo dışında ölç.** Bir düzeltme "X ms eşiği"
   getirdiyse test yardımcısını scratchpad'e birebir kopyalayıp 20+ örnek al — hem doğru kod hem
   mutasyonlu kod için. Sonra eşik iki dağılımın **boşluğunun ortasında mı** diye bak (F-004 fix1:
   doğru 147-184 / mutasyonlu 114-133, eşik 145 → üst uca 12 ms, alt uca 2 ms). Yükü de üret
   (`node -e "busy loop"` ×CPU sayısı, kendini sonlandıran süreyle). Kırılmıyorsa NOT ver, KALDI
   verme. Ayrıca **hangi assert'in önce geldiğine** bak: yük altında ilk kırılan eski
   `elapsedMs < 1000` kapısıydı, yeni eşik değil.

8. **Sarmalayıcı/süreç iddialarını ÖLÇ, düzyazıya güvenme.** F-003 tur 2: "npm wrapper'ı atlayıp
   doğrudan `tsx` spawn ediyorum, böylece öldürdüğüm süreç gerçekten sunucu" iddiası yanlış öncüle
   dayanıyordu — `tsx` CLI'ının kendisi bir torun node süreci doğuruyor (ölçüldü: sarmalayıcı pid
   != sunucu pid). Sonuç tesadüfen iyiydi (tsx@4.23 torunu da düşürüyor) ama garanti sürüme bağlı.
   Depo dışında `spawn` + `tasklist` + port doluluk ölçümüyle 2 dakikada doğrulanır.
9. **Sabit port seçen her test tasarımını projenin TÜM belgelenmiş port kümesine karşı sına.**
   `vite.config.ts` (`MC_WEB_PORT`), `playwright*.config.ts`, `scripts/check-ports.mjs` (predev).
   F-003 tur 2 AC5 alt sunucusu 7334'ü seçmişti — o, Vite dev sunucusunun varsayılanı; `npm run dev`
   ile `npm run e2e` iki yönlü kilitleniyordu. Ayrıca `MC_PORT=0` kaçış yolu bu projede işlemez:
   sunucu gerçek dinlenen portu stdout'a basmıyor.
10. **Bir ekran ilk kez GERÇEK veri render etmeye başladığında, E2E sunucusunun hangi veri dizinini
   okuduğuna bak.** Paylaşılan Playwright `webServer`'ına `MC_DATA_DIR` verilmiyorsa gerçek `data/`
   okunur; F-004 hook'u 7333'e canlı olay POST ettiği için test koşarken dışarıdan veri akar ve
   `shell.spec.ts`'in `not.toContain(...)` negatif assert'leri makineye/zamana bağımlı olur.
11. **`role="tab"` gibi ARIA rolleri bağlam rolü olmadan geçerli değildir.** Tek başına `tab`
   (tablist/tabpanel yok) axe `aria-required-parent` ihlalidir; ayrıca tıklaması no-op olan bir
   buton, projenin kendi "iş yapmayan buton yasağı"na girer. Sadeleştirme önerirken UX doc'un
   gezinme + erişilebilirlik bölümlerini (ekran envanteri, kısayollar, odak sırası) birlikte oku.
12. **Derleme çıktısını denetleyen bir çit eklendiyse üç şeyi ayrı ayrı sına.** (a) Çitin
   örneklediği sınıfların/simgelerin YENİ dizinde ve **yalnızca** orada geçtiğini `grep` ile
   doğrula — önceki turda çiti tesadüfen yeşil bırakan sınıf (F-003'te `bg-zinc-950`, iki
   dizinde birden) listede olmamalı. (b) **Bayat artık totolojisi**: çit `dist/` içindeki tüm
   dosyaları okuyorsa, mutasyonlu koşuda eski doğru çıktı orada kalıp yeşil bırakabilir —
   mutasyonu uygulayıp çıktı dizinini kendi gözünle say (`emptyOutDir: true` gerçekten
   çalışıyor mu). (c) **Kapsama oranını ölç**: F-003 fix1'de çit, yeni dizindeki 69 özgün
   sınıfın 5'ini örnekliyordu — dizin seviyesinde kanarya, tek sınıf düşmesine kör. Bu NOT'tur,
   KALDI değil; ama "yeni ekran eklenince çit de elle güncellenmeli" uyarısını rapora yaz.

13. **"X yok" çitleri ikili yaşar: jsdom + E2E.** Yeni bir etkileşimli öğe (buton) eklenen her
   sözleşmede, mevcut negatif çitleri iki katmanda birden ara — F-005'te `tests/web/App.test.tsx`
   (`headerHtml not.toContain('<button')`) §2.2'ye alınmıştı ama `tests/e2e/shell.spec.ts:41`
   (`header button,... count === 0`) hiç anılmamıştı; kod turunda yapısal KIRMIZI olurdu.
14. **Sunucu yaşam döngüsü assert'lerinde gözlem yolunun fiziksel olarak mümkün olduğunu sor.**
   F-005 tur 2'de "`server.close()` öncesi/sonrası `/api/health`'in `watchers` alanını okur"
   yazıyordu — kapanıştan sonra HTTP isteği ECONNREFUSED alır, assert hiç koşamaz. "(veya eşdeğer
   bir sayaç)" gibi kaçış yolları bu tür imkânsızlıkları gizler; tek ve uygulanabilir gözlem
   yolunu sözleşmede sabitlet.

15. **Yeni bir "sarmalayıcı/sınır" eklendiyse MANTIĞINI değil BAĞLANTISINI mutasyonla.** F-005
   fix1'de `withDispatchErrorBoundary`'nin try/catch'i iki birim testiyle çitliydi (mutasyon
   KIRMIZI), ama `http.createServer(withDispatchErrorBoundary(fn))` çağrısındaki sarmalayıcıyı
   **silmek** 430/430 yeşil bıraktı — yani teslimat uygulamadan koparılabiliyordu. Kural: export
   edilip doğrudan birim testlenen her sarmalayıcı/middleware için ayrıca "gerçek HTTP üzerinden
   bağlı mı" mutasyonu çalıştır. (F-005 fix2'de kapatıldı: gerçek `createServer` + gerçek `fetch`
   + servis metodunu test içinde fırlatır hâle getirme deseni doğru çözüm; aynı mutasyon artık
   `Test timed out` + `Uncaught Exception` ile kırmızı.)
16. **Aynı hata sınıfının SUNUCU yarısı kapandığında İSTEMCİ yarısını ayrıca ölç.** F-005 fix1
   sunucuda 500 + `"Liste kaydedilemedi, tekrar deneyin."` döndürüyordu; `add` yolu bunu banner
   olarak gösteriyor, `remove` yolu `if (!res.ok) return` ile sessizce yutuyordu (buton
   "çalışmıyor" gibi görünüyor). Süreç eskiden çöktüğü için bu davranış hiç gözlemlenememişti.
   Fault injection'ı **tarayıcıdan** da tekrarla, yalnızca curl'den değil. Tarayıcı turunda dört
   şeyi birden ölç: alert görünürlüğü · satır/kayıt yerinde mi · düğme yeniden etkin mi ·
   **engel kalkınca kurtarma** (aynı düğme başarıyla çalışıyor mu).
17. **`status: qa`/`fix` gibi frontmatter alanlarını rapordan sonra sen güncelle**; KOŞULLU
   GEÇTİ'de `fix` bırak ve kapanış için istenen maddeleri raporun sonunda numaralı ver.

18. **Asenkron yığın düzeltmelerinde birim testinin KIRMIZI olması yetmez — süreç ölümünü depo
   dışında ölç.** F-005 fix2'de `safelyNotify` düzeltmesinin testi `vi.mock` ile chokidar'ı
   sahteleyip closure'ı doğrudan çağırıyordu: sarmalayıcı kaldırılınca test kırmızı oluyor ama bu,
   "gerçekte süreç ölürdü" iddiasını KANITLAMIYOR (test içinde throw yalnızca assert'i düşürür).
   Scratchpad'e `.mts` bir harness yaz (tsx, `.ts` + top-level await'te "cjs output format"
   hatası verir), servisi `pathToFileURL(...).href` ile dinamik import et, fırlatan sahte hub +
   GERÇEK dosya yazımı kullan, `process.on('uncaughtException')` ile ölümü yakala. F-005'te:
   sarmalayıcıyla `EXIT=0 SURVIVED`, sarmalayıcısız `EXIT=3 UNCAUGHT` — iki yönlü kanıt 2 dakikada.
19. **Bir "istisna daraltıldı" düzeltmesinden sonra istisnanın YENİ kenarını mutasyonla.** D28,
   `no-delete-guard`'ın registry istisnasını dize seviyesine (`unlinkSync(tmpPath)`) indirdi;
   istenen mutasyon (proje dosyasını hedefle) kırmızı verdi, ama aynı dosyaya hiç çağrılmayan bir
   `fs.promises.unlink(...)` eklemek 12/12 yeşil kaldı — daraltma `unlinkSync` ailesini kapatıp
   asenkron kardeşini açık bıraktı. Kural: daraltılan çitin **regex/desenini oku**, desenin
   DIŞINDA kalan en yakın eşdeğer API ile ikinci bir mutasyon çalıştır.
20. **Yeni bir try/catch sarmalayıcısında closure GRANÜLERLİĞİNE bak.** Birden çok yan etki tek
   `safelyNotify(...)` closure'ına konursa ilk fırlatan kardeşini de yutar (F-005: `watcher.stop()`
   fırlarsa hemen ardındaki `watchers.delete(id)` hiç çalışmaz → sayaç yalan söyler; `addProject`'te
   izleme kurulumu fırlarsa `broadcast` atlanır → istemciler bayat kalır). NOT seviyesi, ama
   raporda adı geçmeli.
21. **Fixture kurarken kabuktan özyinelemeli silme komutu çağırma** — `block-dangerous.cjs` hook'u
   scratchpad yolları için de tetikleniyor ve tur harcatıyor. Benzersiz dizin adı seç; silmen
   gerekiyorsa `node -e` içinden `fs` API'siyle yap. Aynı hook, **memory dosyasına** böyle bir
   komutu örnek olarak yazan Bash komutunu da bloklar — o dosyaları Write aracıyla yaz.

**Why:** Düzeltme turları dar tutulduğu için yeniden inceleme yapılmaz; kaçan kusur bir daha
bakılmayan bölgede kalır. **How to apply:** Kapanış tablosunu yazmadan önce bu üç kontrolü
uygula; kanıtı komut çıktısı + dosya:satır ile ver. Ayrıca arşivleme yaparken önceki raporun
zaten tarihli bir kopyası var mı diye bak (`diff -q`) — ikinci kez yanlış adla kopyalama.

İlgili: [[kod-turu-kontrolleri]], [[sozlesme-turu-kontrolleri]]

22. **Geri getirilen bir çalışma-zamanı deseni (regex allowlist) ile o adı ÜRETEN kodu birlikte
    çalıştır.** F-006 tur 2: QA'nın istediği "işlem/yol eşleşmesi" geri geldi ama arşiv deseni
    `[0-9-]+` idi, ad üreteci ise `toISOString().replace(/[:.]/g,'-')` ile `T`/`Z` içeren bir
    damga üretiyordu → her arşivleme `write_denied` (scratchpad'de 30 saniyede ölçüldü:
    `archive rx: false`). Sözleşmedeki her regex'i, aynı sözleşmenin başka bir bölümündeki
    üreteciyle besleyip node ile koştur.
23. **Genişletilen statik tarama listesini GERÇEK depoda grep'le.** "DENIED'a `truncate` ekle"
    dendiğinde liste `content.includes()` ile kullanılıyorsa Tailwind `truncate` sınıfı,
    `Math.trunc`, `truncateSummary` gibi meşru satırlara çarpar (F-006'da 4 dosya, 9 satır) ve
    çit doğuştan kırmızı doğar. Kural: her yeni desen için `grep -rn <desen> src` çalıştır;
    çağrı biçimi (`desen(`) ile çıplak alt dizge arasındaki farkı sözleşmeye yazdır.
24. **"Dışa açık değil" + "test doğrudan çağırır" ikilisini ara.** Aynı turda hem export
    yüzeyini `toEqual([tam liste])` ile kilitleyip hem de iç yardımcıyı test/mutasyondan
    doğrudan çağırmayı planlayan sözleşme kendi kendini yener; düşen taraf her zaman sessizce
    çit olur (F-006 adım 8).
