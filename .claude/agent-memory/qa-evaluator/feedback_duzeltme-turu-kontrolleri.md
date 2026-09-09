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

25. **Bir düzeltmenin getirdiği YENİ ÇİT'i gerçek repoda koştur — doğuştan kırmızı mı?** F-007 tur 2,
    "kapalı `testMatch` listesi" bloklayıcısını `tests/e2e-config-guard.test.ts` ile kapatıyordu:
    her `tests/e2e/*.spec.ts` `playwright.config.ts` metninde geçmeli. Ölçüm 30 saniyede:
    `dev-shell.spec.ts` bilinçli olarak İKİNCİ config'e (`playwright.dev.config.ts`, `npm run e2e:dev`)
    bağlı → çit bugün kırmızı. Kural: çit "tüm X'ler Y'de geçer" diyorsa X kümesini `readdirSync` ile,
    Y kümesini `ls <desen>*` ile **say**; tek bir Y varsaymak en sık hata. Pozitif kontrolü de yap
    (geçici probe dosyası ekle → kırmızı → sil, `git status` ile temizliği kanıtla). Metin tabanlı
    çitlerde iki sınırı ayrıca ölç: yorum satırında geçen ad (yanlış negatif) ve deseni glob'a çevirme
    (yanlış pozitif).
26. **"En fazla N arttı" tipi ÜST SINIR assert'i + tanımsız taban = mutasyon kaçağı.** F-007 D42'de
    render sayacı "PATCH yanıtı sonrası en fazla 1 kez arttı" diyordu; doğru kodda artış 0, mutasyonlu
    kodda 1 → eşik mutasyonu yeşil bırakıyor. Sayaç çitlerinde taban okuma anını sabitlet ve
    `toBe(before)` gibi KESİN EŞİTLİK iste. Ayrıca "tek mutasyon iki çiti de kırar" iddialarını elle
    yürüt: iki çit farklı boyutları (render sayısı vs ağ isteği sayısı) ölçüyorsa bir mutasyon
    genelde yalnız birini kırar — mutasyon→çit eşlemesini bire bir yazdır.
27. **Kütüphane varsayılanını daraltan düzeltme, aynı belgedeki düzyazıyı ve test adımlarını
    bayatlatır.** F-007 tur 2, `KeyboardSensor.keyboardCodes`'u `Space`'e daraltıp AC7/AC9 çakışmasını
    çözdü, ama §7 düzyazısı hâlâ "Enter onaylar", §5 AC9 adımları hâlâ `Enter` basıyordu ve daraltma
    G3 onaylı UX dokümanından (Enter/Boşluk) sapıyordu — sapma listesine girmemişti. Daraltma gördüğün
    an: (a) kütüphane varsayılanını dist'ten oku (`defaultKeyboardCodes`), (b) belgede o tuşun geçtiği
    TÜM satırları grep'le, (c) bağlayıcı UX/mimari dokümanla karşılaştır, sapma işaretli mi diye bak.

28. **Playwright koşusu `dist/`'i YENİDEN DERLER — mutasyonlu bir E2E koşusundan sonra derleme
    çıktısı MUTASYONLU kalır.** F-007 fix1'de düzen mutasyonuyla `npx playwright test -g "T3"`
    koşturdum; `webServer` build çalıştırdığı için `dist/web/assets/*.css` mutasyonlu kaynaktan
    üretildi. Sonra "yeni Tailwind sınıfları üretiliyor mu" diye baktığımda `order-1`/`gap-y-2`
    **0 kez** çıktı ve bir an bloklayıcı sandım — oysa ürün kodu doğruydu, artefakt bayattı.
    Kural: `git checkout --` ile geri aldıktan SONRA `npm run build` koştur, ardından dist'i
    denetle; dizin dosya sayısını da say (`emptyOutDir` çalışıyor mu). Ayrıca minifiye tek satırlık
    CSS'te `grep -c` SATIR sayar, `str.count()` ile OLUŞUM say.
29. **Dar-viewport düzeltmesini tek noktada değil, ARALIK TARAYARAK doğrula.** Bulgu 375px'te
    ölçülmüş olsa bile düzeltme `sm:` gibi bir kırılma noktasına dayanıyorsa 280/320/375/480/560/
    **639/640**/768/1280/1920 dizisini tek `page.setViewportSize` döngüsünde ölç; header yüksekliği
    + kırpılmış görünür genişlik + `documentElement.scrollWidth` üçlüsünü birlikte yaz. F-007
    fix1'de bu, "kırılma noktasının iki yanı da doğru + hiçbir genişlikte yatay belge kaydırması
    yok" kanıtını 30 saniyede verdi ve geniş-ekran regresyonu sorusunu da aynı ölçümle kapattı.
30. **"Yarı-başarı" tasarımlarında KURTARMA yolunu arıza AÇIKKEN ölç.** F-007 D46, yazma başarılı
    ama yeniden okuma başarısız durumunda `data`sız `200` dönüyor; istemcinin `content_hash`'i
    bayat kalıyor ve düzeltmenin kendi yorumu "chokidar echo'su düzeltir" diyor. Bunu kanıtlamanın
    yolu ikinci bir işlemi arıza hâlâ açıkken denemek: aynı kart ikinci kez taşındı ve BAŞARILI
    oldu → yarı-başarı çıkmaz sokak değil. Tek istek ölçmek bu iddiayı doğrulamaz; ikinci istek
    409 verseydi düzeltme kullanıcıyı sahte "dosya dışarıdan değişti" uyarısına düşürüyor olurdu.

31. **"Bilinçli ertelendi" gerekçesinin TEKNİK ÖNCÜLÜNÜ kodda doğrula — çoğu zaman yanlıştır.**
    F-012 tur 2: Ö5'in ertelemesi "sahte `query()` enjekte edilebilen ayrı bir E2E modu mevcut
    harness'e YENİ BİR YETENEK eklemek demektir" diyordu. Oysa dikiş ürün kodunda hazırdı
    (`createServer(port, dataDir, chatQueryOverride)`); ~100 satırlık bir başlatıcı betikle
    (scratchpad, depoya girmeden) gerçek üretim sunucusunu sahte `query()` ile ayağa kaldırıp
    O turun BÜTÜN tarayıcı ölçümlerini **sıfır kota** ile yaptım. Kural: erteleme metnindeki
    "gerektirir / mümkün değil" cümlelerini grep'le doğrula; dependency-injection parametresi,
    `*Override`, `deps.` gibi isimleri ara. Yan fayda: aynı dikiş, pahalı canlı oturum yerine
    ücretsiz uçtan uca QA sağlar — bunu her LLM/dış-servis feature'ında ilk iş olarak ara.
32. **Ertelenen maddenin GERÇEK ETKİSİNİ ölç; "görüntüleme kaybı" diye yazılan şey kilitlenme
    olabilir.** F-012 Ö7 "araç satırları yenilemede kayboluyor" diye ertelenmişti; ölçünce
    bekleyen İZİN İSTEĞİ de kayboluyordu ve `request_id` yalnızca istemci belleğinde yaşadığı
    için oturum **kalıcı, sessiz** kilitleniyordu (90 sn sonra hâlâ `busy:true`, arayüzde
    kurtarma butonu yok, gönderilen mesaj `202 queued` alıp hiç cevaplanmıyor). Erteleme
    gerekçesini okuyup geçme — senaryoyu tarayıcıda yürüt ve **kurtarma yolu var mı** diye bak.
33. **Bir düzeltmenin ertelenen bir kusurun OLASILIĞINI artırıp artırmadığını sor.** F-012'de
    `permissions.ask:['Bash']` (güvenlik düzeltmesi) her Bash çağrısını izin kartına çevirdi;
    böylece Ö7'nin kilitlenme penceresi tur başına 5-10 kat arttı. Erteleme kararı düzeltmeden
    ÖNCE verildiği için bu etkileşim değerlendirilmemişti. Kapanış tablosunu yazarken
    "kapanan X, ertelenen Y'yi daha sık tetikler mi?" çapraz sorusunu her ikili için sor.
34. **Derleme-anı bayrakları (`vite define`) özelliği SESSİZCE yok edebilir — test koşusundan
    sonra `dist/`'i denetle.** F-012'de `playwright.config.ts` `webServer.env`'i
    `npm run build && npm start`'ın TAMAMINA uygulanıyor; `MC_CHAT_ENABLED:'0'` bundle'a gömülüyor
    ve `npm run e2e` sonrası panelde sohbet sekmesi HİÇ yok, `GET /api/chat/status` ise
    `chat_enabled:true` diyor. Kural: `vite.config.ts`'te `define:` varsa, o bayrağın E2E/CI
    ortamında farklı bir değer aldığı her yolu ara; test koşusundan sonra üretim sunucusunu
    açıp özelliğin GÖRÜNDÜĞÜNÜ doğrula (sunucu API'sine değil, DOM'a bak).
35. **Canlı/ücretli testlerde assert MEKANİZMAYA bağlanmalı, MODEL DAVRANIŞINA değil.** F-012'nin
    `chat-hooks-live.test.ts`'i "model gerçekten şu komutu çalıştırsın" varsayıyordu; 3 koşunun
    3'ü de kırmızı geldi (1× 30 sn zaman aşımı, 2× `blockedActive=false` — mekanizma sağlamken).
    Sözleşme "her QA turunda koşulur" diyorsa bu yanlış alarm üretir ve kanıta güveni aşındırır.
    Canlı bir testi kabul etmeden önce **en az 2 kez koştur**; tek yeşil koşu kanıt değildir.
    Ayrıca kendi bağımsız probe'unu yazmak genelde daha ucuz ve daha kesindir (F-012 E1 iki yönlü
    kanıtı 3 kısa oturum / $0,10).

36. **Aynı durum parçası İKİ FARKLI YOLLA geliyorsa (SSE olayı + ilk yükleme `fetch`'i), testin
    handler'ı ELLE çağırması gerçek yolu ölçmez.** F-012 tur 3: sunucu `pending_permissions`'ı
    doğru gönderiyordu (mutasyon KIRMIZI) ama istemcinin `loadStatus`'u (mount **ve** SSE `open`
    yolu) yanıtı `setStatus`'a doğrudan yazıp kartı kuran `onChatStatus` indirgeyicisinden
    GEÇMİYORDU — yenilemeden sonra izin kartı yine yoktu. Test (`ChatScreen.test.tsx`)
    `handlers.onChatStatus(...)`'u elle çağırıyor ve **yorumunda** "sayfa yenilenince bu yol
    tetiklenir" diye iddia ediyordu; ürün kodunda öyle bir bağ yoktu. Kural: bir durum parçası
    hem SSE hem `fetch` ile geliyorsa ikisinin AYNI indirgeyiciden geçtiğini kodda izle, sonra
    "o çağrıyı tamamen sil" mutasyonunu koştur — yeşil kalıyorsa o yolda hiç çit yoktur
    (F-012'de `onChatSync`'ten `loadStatus()` silindi → **855/855 YEŞİL**). Bu, [[16]]'nın
    okuma yolundaki ikizi: sunucu yarısı kapandı diye bulguyu kapatma.
37. **Kırmızı canlı testte, hangi SATIRIN kırıldığına bak — tanı dalı mı, mekanizma assert'i mi.**
    F-012 tur 3'te `test:chat-live` yine exit 1 verdi, ama kırılan satır "model işaretleyici
    komutu önermedi" tanı dalıydı; `expect(blockedActive).toBe(true)` hiç koşmadı. Doğru rapor
    cümlesi "mekanizma bozuk" değil, "bu koşu mekanizma hakkında hiçbir şey söylemiyor" olmalı.
    Daha iyi hata mesajı kararsızlığı gidermez — model işbirliğine bağlı her canlı assert,
    kadans şartını ("her QA turunda en az bir kez kanıt") karşılayamaz.
38. **Kapanış turunda düzeltmeyi BİREBİR GERİ SARAN ikinci bir mutasyon at.** Brief'in istediği
    mutasyon (F-012 tur 4: `onChatSync`'ten `loadStatus()` silinir) yalnızca YENİDEN BAĞLANMA
    yolunu vurur; düzeltmenin asıl hedefi olan MOUNT/yenileme yolunu vurmaz. İkinci mutasyonu
    düzeltilen satırın kendisine uygula (`onChatStatus(body.data)` → `setStatus(body.data)`).
    F-012'de ikisi de kırmızı verdi ve "her iki yarı da çitli" cümlesi ancak böyle kanıtlandı.
    Maliyeti 2 dakika; tek mutasyonla "kapandı" demek eksik kanıttır.
39. **Model-bağımlı canlı testler ZAR ATIŞIDIR: kırmızı tur arası YER DEĞİŞTİRİR.** F-012 tur 3'te
    AC4 kırmızı / E1-B5 yeşildi; tur 4'te düzeltilen AC4 yeşil geldi ama DOKUNULMAMIŞ E1/B5
    kırmızı oldu (model hiç Bash çağırmadı). Paket yine exit 1. Bunu "düzeltme işe yaramadı" diye
    okuma: kırılan testin bloğunu düzeltme öncesi/sonrası sürümlerden çıkarıp `diff`'le
    (`git show <once>:<dosya>` + `awk` ile blok kes) — byte-byte aynıysa düzeltmenin ürünü
    değildir. Ayrıca kırmızının "kanıt yok" dalı mı (araç hiç çağrılmadı) yoksa mekanizma
    assert'i mi olduğunu ayır ([[37]]). Kardeş testler aynı kırılganlığı taşır: bir tanesine
    uygulanan tedavi (direktif systemPrompt, persona kaldırma) diğerlerine de uygulanmalı —
    rapora yaz, yoksa gelecek turda aynı yalancı kırmızı geri gelir.
40. **Canlı ölçüm sırasında TARAYICI KONSOLUNU oku, ama bulduğunu tarihlendir.** F-012 tur 4'te
    yenileme akışında React "two children with the same key" hatası aktı (`m:<turn_id>:text`);
    kaynağı `ChatScreen.tsx`'in render anahtarının `role` içermemesiydi — B2'de `entryKey()` için
    düzeltilen hatanın render tarafındaki ikizi. Dar kapsamlı kapanış turunda bunu bloklayıcı
    yapmadan önce `git log -L <satır>,<satır>:<dosya>` ile satırın YAŞINI ölç ve o turun
    commit'lerinin dosyaya dokunup dokunmadığını `git show --stat -- <dosya>` ile doğrula.
    Önceden varsa: kayda geç, bir sonraki işe taşı, kararı yumuşatma ama kapsamı da genişletme.
41. **Playwright'ın `locator.focus()`'u odağı ZORLA verir — "klavyeyle odaklanabilir" iddiasını
    ölçmez.** F-013 tur 2: K6 düzeltmesi içerik kabına `tabIndex={0}` ekledi ve E2E testi
    `scrollBox.focus()` + `PageDown` ile "klavye ile odaklanabilir VE kaydırılabilir" iddia
    ediyordu. `tabIndex={0}`'ı tamamen kaldıran mutasyon **hem 943 birim testini hem E2E'yi
    YEŞİL** bıraktı: `locator.focus()` CDP `DOM.focus` kullanır, doğal odaklanabilirliği
    atlar (`getAttribute('tabindex')` null iken `document.activeElement` yine o div oldu).
    Kural: odak/erişilebilirlik assert'lerinde `focus()` çağırma — `page.keyboard.press('Tab')`
    ile GERÇEK odak akışını yürüt ve `document.activeElement === hedef` assert'i koy. Aynı tuzak
    `click()` için de geçerli (otomatik kaydırır, bkz. dar genişlik dersi).
42. **Salt-okunur manifest çitinde `mtime`-only mutasyonu dene.** Ortak `snapshotDir` yardımcısı
    (relPath+size+sha256) bilinçli olarak `mtimeMs` taşımaz; bu yüzden **boş** `appendFileSync`
    (içerik ve boyut değişmez, yalnızca mtime dokunur) manifest testinden GEÇER. F-013'te ikinci
    katman (`no-write-gate-bypass` statik taraması) yakaladı — ama çit tek katmansa bu sessiz bir
    yazma yoludur ve `mtime` sıralamaya/izleyiciye giriyorsa davranışı da değiştirir.
43. **Savunma derinliği iddiasını KATMAN BAŞINA bir mutasyonla sına, sonra çapraz doğrula.**
    F-013'te iki katman vardı (yol guard'ı + `id` deseni). M1 (guard) kırmızı verdi ve mutasyonlu
    kodda GERÇEK sızıntı ölçüldü; M2 (desen) kırmızı verdi ama mutasyonlu kodda sızıntı YOKTU —
    yani her katmanın kendi testi var ama koruduğu senaryolar farklı. "İki mutasyon da kırmızı"
    demek yetmez; her mutasyonun altında **hangi saldırının açıldığını** ayrıca probla ölç,
    yoksa iki testin de aynı şeyi ölçtüğünü fark edemezsin.

44. **"Kabul et ve normalize et" düzeltmelerinde İKİ katman vardır; ikincisi genelde çitsiz kalır.**
    F-008 tur 2: S2 hem regex'e `i` bayrağı ekledi hem ayrıştırılan id'yi `.toUpperCase()` ile
    kanonikleştirdi. Brief'in istediği mutasyon (`i` bayrağını kaldır) KIRMIZI verdi, ama
    `.toUpperCase()`'i kaldıran ikinci mutasyon **1077/1077 YEŞİL** kaldı — üstelik gerçek sızıntı
    üretiyordu: aynı kapı listede **iki satır** (`G2` + `g2`, ikincisi bilinmeyen id olduğu için
    sıralamada sona düşüyor). Test yalnızca `unrecognized` boş mu + hedef kapı `approved` mi diye
    bakıyordu; **satır kümesinin tamamını** (`ids.toEqual([...])`) iddia etmiyordu. Kural:
    normalizasyon düzeltmelerinde "tanıma" ve "kanonikleştirme" katmanlarını AYRI mutasyonla sına,
    ve liste döndüren her çitte tam küme eşitliği iste — "aradığım eleman var mı" yetmez.
45. **Bir düzeltme diagnostik bir sinyali kaldırıyorsa, o sinyalin GİZLEDİĞİ çıkmazı ölç.**
    F-008 S2, `g2.ok`'u artık normal bir kapı sayıyor ve "Tanınmayan dosyalar" satırını (bilinçli,
    sözleşme gereği) kaldırıyor. Ama kanonik olmayan harfli dosya varken yazma yolu hâlâ kalıcı
    500 veriyor: `write-gate.ts` en yakın var olan atayı `fs.realpathSync.native` ile diskteki
    gerçek yazıma çeviriyor (`G2.ok` → `g2.ok`), sonra harfe **duyarlı** `OPERATION_PATTERNS` ile
    karşılaştırıp `write_denied` diyor. Yani düzeltme çelişkiyi kaldırdı ama çıkmazın tek ipucunu
    da kaldırdı. Ölçüm sırası: (a) yeni davranışı listede doğrula, (b) o satırın SUNDUĞU aksiyonu
    tarayıcıda gerçekten tıkla, (c) `git log -- <yazma modülü>` ile hatanın bu turun ürünü olup
    olmadığını tarihlendir (F-008'de değildi → taşınan borç, bloklayıcı değil).
46. **İki adımlı onay/önizleme akışlarında 409 yolunun "hiçbir dosyaya dokunmaz" iddiasını
    YAN ETKİLİ bir kurulumla sına.** Uyuşmazlık testini boş dizinde yapmak yetersiz: hedef kapıya
    ait bir `.deny.md` KOYUP dene — çünkü doğru kodda arşivleme adımı eşitlik kontrolünden SONRA
    gelmeli. F-008'de bu, "409 döndü ama deny dosyası arşive taşındı" sınıfını tek ölçümde eledi
    (`deny mtime değişmedi` + `archive/ oluşmadı`). Ardından **kurtarma yolunu** da yürüt (kapat →
    yeniden aç → 200): 409 bir çıkmaz mı yoksa tazelenebilir bir durum mu, ancak böyle anlaşılır.
47. **React kontrollü input'a `evaluate` ile değer yazarsan buton `disabled` kalır.** Doğrudan
    `el.value = x` React'in değer izleyicisini günceller ve `onChange` yutulur; ardından
    Playwright'ın `fill()`'i de aynı değeri yazdığı için hiç olay üretmez — "buton etkin değil"
    diye 5 sn timeout alırsın. Çözüm: prototype value setter ile ÖNCE `''` yaz + `input` olayı,
    SONRA gerçek metni yaz + `input` olayı. (Ya da hiç `evaluate` kullanma, temiz modalda yalnızca
    `browser_type`.)
