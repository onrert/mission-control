---
name: kod-turu-kontrolleri
description: Kod turu QA'sında en çok bulgu üreten teknikler — hata yolu fault injection (her yeni yazma yolunda, asenkron IIFE dahil), "çitin testi var mı" mutasyonu, checkpoint yazar/okur semantiği, derleme çıktısını sınıf sınıf ölçme, statik guard'ın yorumu vs. taradığı, UX'in birincil viewport'unda kırpılmış görünür genişlik ölçme, flaky çitin yanlış-yeşil oranını ölçme
metadata:
  type: feedback
---

Kod turunda (sözleşme turu değil) şu kontroller, testlerin hiç ölçmediği bulguları çıkarıyor:

1. **Hata yolunu fault injection ile zorla, mutlu yolu değil.** Testler mutlu yolu kanıtlar;
   sözleşmedeki "asla 5xx" gibi evrensel iddialar yalnızca I/O hatası enjekte edilerek
   sınanabilir. Ucuz teknik: gün dosyasının adında bir **dizin** oluştur → `appendFile`
   `EISDIR` verir. F-002'de bu, ana yazma yolunda hiç `try/catch` olmadığını ortaya çıkardı:
   istemci hiç yanıt almıyor, `unhandledRejection` süreci öldürüyor ve reddedilen kuyruk
   promise'i (`queue = queue.then(...)`, `.catch` yok) sonraki tüm istekleri kalıcı olarak
   bozuyor. Ayrıca: sözleşme aynı hata sınıfını (Windows EPERM/EBUSY) *başka* bir yol için
   (retention silme) öngörüp kapatmışsa, **ana yol neden kapatılmamış** diye sor.
2. **Her "güvenlik çiti" için ayrı bir mutasyon çalıştır — çitin testi var mı?** Bir kontrol
   iki katmanlıysa (ör. `isInsideDataRoot` kapsama kontrolü **ve** dosya adı deseni), her
   katmanı ayrı ayrı kaldır. F-002'de kapsama kontrolü kırmızı verdi ama desen çiti
   kaldırıldığında 133/133 test yeşil kaldı. F-003'te aynı teknik: yeni eklenen `/api/stream`
   rotasını Host/DNS-rebinding kontrolünden muaf tutmak 314/314 yeşil bıraktı — koruma
   çalışıyordu ama **yeni rotanın hiç regresyon çiti yoktu.** Kural: bir feature yeni bir rota/
   yüzey ekliyorsa, miras alınan her korumayı o rota için ayrıca mutasyonla.
3. **Durum/checkpoint dosyalarında yazar ve okur semantiğini karşılaştır.** `.seq` gibi bir
   dosyaya bir yerde "son kullanılan değer", başka yerde "bir sonraki değer" yazılıyor ve okuma
   `max(...)+1` yapıyorsa, her açılış sayaç bir kayar. Testler bunu görmez çünkü hepsi iki
   yeniden başlatma arasına veri koyar. Kanıtı **olaysız arka arkaya restart** ile üret.
4. **İlk UI feature'ında derleme çıktısını sınıf sınıf ölç — "test yeşil" ile "ekran doğru"
   arasında hiçbir bağ yok.** F-003'te Tailwind v4 + `vite.config.ts`'in `root: 'src/web'`
   ayarı yüzünden `src/features/**` altındaki HİÇBİR utility sınıfı üretilmedi: ekran stilsiz
   çıktı, `sr-only` canlı bölge görünür oldu, `overflow-y-auto` üretilmediği için liste hiç
   kaydırılamadı ve kaydırma-ile-dondurma özelliği üretimde çalışamaz hâle geldi. 322 testin
   hiçbiri kırmızı vermedi (jsdom CSS yüklemez; E2E `toBeVisible()` stilsiz öğe için de doğrudur;
   tema renk assert'i tesadüfen geçti çünkü o sınıf başka bir dosyada da kullanılıyordu).
   **Teknik:** derlenmiş CSS'i aç, yalnızca YENİ dizinde kullanılan ~8 sınıf ile yalnızca ESKİ
   dizinde kullanılan ~8 sınıfı ayrı ayrı `grep -c` ile say. 8/8 var + 0/9 yok gibi keskin bir
   bölünme kök nedeni doğrudan verir. Ardından gerçek tarayıcıda `scrollHeight`/`clientHeight`
   ölçüp "özellik gerçekten çalışıyor mu" diye bak — kod yolu var olabilir ama layout yoksa
   `onScroll` hiç ateşlenmez.

5. **Her YENİ yazma yolunda F-002'nin fault injection'ını birebir tekrarla — ders taşınmıyor.**
   F-005'te kayıt defteri (`projects.json`, tmp+rename) için hedef dosyayı dizin yapmak / salt-okunur
   yapmak (`chmod 444`) `renameSync`'i `EPERM` ile düşürdü; çağrı zinciri `req.on('end')` dinleyicisinin
   içinden geçtiği için **tüm sunucu süreci exit 1 ile öldü** — F-002'nin B1 bloklayıcısının aynısı,
   üstelik dersin yorumu aynı dosyanın tepesinde yazılıyken. İki ek ipucu: (a) birim testi
   `expect(() => store.write()).toThrow()` diyorsa tasarım fırlatmayı BİLİYOR demektir — üst katmanda
   `try/catch` var mı diye bak; (b) sözleşme "handler genel 500 yoluna düşer" gibi bir cümle
   içeriyorsa o yolu `grep` ile ARA, genelde hiç yoktur (`uncaughtException` handler'ı yok).
   Ayrıca hata dalında geçici dosya (`.tmp`) temizliği ve bellek-disk ayrışması de kontrol edilir.
6. **Statik guard'ın YORUMU ile TARADIĞI dizgeleri karşılaştır.** F-005'in `no-delete-guard`'ı
   "silinmediğini/**yazılmadığını** doğrular" diyordu ama yalnızca `unlink|rmSync|rmdirSync|fs.rm(`
   tarıyordu; `appendFileSync` ile izlenen projeye yazan mutasyonum guard'dan geçti (yalnızca dinamik
   manifest testi yakaladı). Guard iddiasının yarısını yapıyorsa yanlış güven üretir.
7. **Yeşil kalan mutasyon her zaman "eksik test" demektir, "önemsiz" değil — ama şiddeti kodun
   doğruluğuna bakarak ver.** F-005'te `watchers.delete(id)`'yi kaldırmak 425/425 yeşil bıraktı:
   ürün kodu doğruydu (tarayıcıda 1→0 ölçtüm), eksik olan çitti → ÖNEMLİ, bloklayıcı değil.
8. **UX dokümanının BİRİNCİL viewport'unu oku ve orada ölç.** F-005 UX'i paneli 320-480px'lik VS Code
   Simple Browser panelinde tanımlıyordu; 1280px'te kusursuz görünen `ml-auto` + `overflow-x-auto`
   başlık, 375px'te tek Ayarlar girişini ekran dışına itiyordu ve hiçbir test dar genişlikte ölçmüyordu.

**Why:** F-002 kod turunda bloklayıcı ve 3 önemli bulgunun tamamı ilk üç teknikten çıktı;
F-003'te iki bloklayıcının ikisi de dördüncüden çıktı; F-005'in tek bloklayıcısı beşincidendi. Developer'ın kendi mutasyonları bunların
hiçbirini yakalamamıştı çünkü hepsi "test var mı" sorusunu değil "kod doğru mu" sorusunu ölçüyordu.

**How to apply:** Kendi mutasyon setini seçerken developer'ın listesini kopyalama; onun
listesindeki her madde zaten kırmızı verecek şekilde seçilmiştir. Bunun yerine (a) hiç
mutasyon planlanmamış kod yollarını, (b) çok katmanlı savunmaların ikinci katmanını,
(c) hata/`catch` dallarını, (d) sözleşmenin "şu testte doğrulanır" dediği ama dosyada
`grep` ile bulunamayan davranışları hedefle. Bkz. [[sozlesme-turu-kontrolleri]],
[[duzeltme-turu-kontrolleri]].

---

## F-007 turunda eklenen üç teknik

9. **`void (async () => { ... })()` gören her handler'da fault injection çalıştır.** F-007'de
   `PATCH /api/features` yazma yolu senkron dağıtıcıdan asenkron bir IIFE'ye geçmişti;
   `withDispatchErrorBoundary` yalnızca SENKRON dağıtımı sardığı için IIFE içindeki `readFileSync`
   hatası hiçbir yere düşmüyordu. Sonuç: yazma diske uygulandı, istemci **hiç yanıt almadı**
   (curl `HTTP=000`, 10 sn timeout), süreç yalnızca `unhandledRejection` güvenlik ağı sayesinde
   yaşadı, istemcide `pendingKeys` hiç temizlenmediği için kart kalıcı "bekliyor"da dondu.
   Teknik: hata dalını `process.env.MC_QA_FAULT` ile tetiklenen geçici bir `throw`la enjekte et,
   üretim derlemesini ayrı portta başlat, `curl -m 10 -w "HTTP=%{http_code}"` ile ölç, sonra geri
   al. F-002 → F-005 → F-007: bu sınıfın ÜÇÜNCÜ tekrarı; her yeni yazma ucunda tekrar et.
10. **Playwright `toBeVisible()` + `.click()` kaydırma kabındaki öğeyi "görünür" sayar.**
   `overflow-x-auto` bir kapta kaydırılıp ekran dışında kalan bir sekme için `toBeVisible()`
   TRUE döner ve `.click()` öğeyi otomatik kaydırır — yani "dar genişlikte gezinme kaybolmaz"
   çiti kullanıcının hiç göremediği bir arayüzde de yeşil kalır. Gerçek ölçüm: kabın ve öğenin
   `getBoundingClientRect()`'ini al, kırpılmış görünür genişliği hesapla
   (`min(el.right,box.right) - max(el.left,box.left)`), `> 0` iste. F-007'de iki sekmenin de
   görünür genişliği **0 px**'ti ve E2E yeşildi.
11. **Flaky bir çitin yanlış-yeşil ORANINI ölç, "bilinen kalıntı" notuna güvenme.** Developer
   "mutasyona karşı test flaky" diye kaydetmişti; ölçtüm: kendi dar mutasyonum (`return prevCard`
   yerine `return { ...prevCard }`) 11 koşuda **8 kez yeşil** (%73 yanlış-yeşil), developer'ın
   kendi mutasyonu 6 koşuda 1 kez yeşil. Kök neden yapısaldı: assert `waitFor(fetch çağrı
   sayısı === 2)` anında koşuyor, React'in state commit'ini beklemiyor. Aynı davranışın E2E
   karşılığı (render sayacı, kesin eşitlik) deterministik KIRMIZI verdi → bulguyu ÖNEMLİ'ye
   indirdim, BLOKLAYICI yapmadım. Kural: flaky çit bulunca (a) 6-11 koşuluk örneklem al,
   (b) ikinci savunma hattı var mı diye bak, şiddeti ona göre ver.

---

## F-012 turunda eklenen dört teknik

12. **Yeni bir `src/features/<x>/web` dizini varsa İLK İŞ `src/web/index.css`'in `@source`
   listesine bak.** Vite `root: 'src/web'` olduğu için Tailwind v4 kökün dışını taramıyor;
   her yeni web dizini kendi `@source` satırını ve `tests/build-css.test.ts`'te kendi
   `describe` bloğunu gerektiriyor. F-003/B1 → F-005 → F-007 → **F-012: dördüncü tekrar.**
   Bu sefer 24 sınıf düştü (`whitespace-pre-wrap`, `items-end`, `sticky`, `bg-amber-700`,
   `sm:inline`…) ve UX'in görsel sözleşmesinin tamamı üretimde yoktu. Ölçüm 60 saniye:
   `chat/web`'in `className` dizgelerini topla, diğer web köklerinde geçmeyenleri süz,
   `dist/web/assets/*.css` içinde ara. "Yalnızca bu dizinde geçip CSS'te olmayan" listesi
   boş değilse doğrudan bloklayıcı.
13. **Mutasyonu, hassas verinin gerçekten aktığı DALA at — aynı fonksiyonun başka dalına
   değil.** F-012'de sözleşme "chat_tool yayınına ham `tool_result` eklenirse KIRMIZI" diyordu;
   developer mutasyonu `tool_use` (**girdi**) dalına uygulamıştı ve kırmızı almıştı. Aynı
   fonksiyonun `tool_result` (**çıktı**) dalına ham çıktı eklemek 34/34 yeşil kaldı — yani
   sızıntının gerçekten geçeceği yolda çit yoktu. Kural: "X sızmasın" çitinde X'in taşındığı
   satırı koddan bul, mutasyonu oraya at.
14. **Dedup/fold anahtarında ayırt edici alan eksik mi diye bak.** F-012'de hem sunucu
   (`foldByTurn`) hem istemci (`upsertEntry`) `${turn_id}::${kind}` ile katlıyordu; `role`
   anahtarda olmadığı için kullanıcının mesajı ile CEO'nun cevabı aynı kovaya düşüp
   kullanıcının mesajı **siliniyordu**. Hiçbir test aynı turda iki farklı `role` kurmuyordu.
   Teknik: her dedup anahtarını oku, "hangi iki farklı mantıksal kayıt aynı anahtara düşer"
   diye sor, üç satırlık bir harness ile kanıtla.
15. **E2E yapılandırmasının test ettiğin özelliği kapatıp kapatmadığını kontrol et.**
   `playwright.config.ts` F-012'yi `MC_CHAT_ENABLED: '0'` ile koşturuyordu (ücret gerekçesiyle,
   makul) — sonuç: özelliğin tarayıcı seviyesinde **sıfır** kapsaması ve 12. maddedeki
   bloklayıcının oradan geçmesi. Ayrıca `package.json` script'lerinin gösterdiği dosyaların
   var olduğunu `ls` ile doğrula: `test:chat-live` hiç yazılmamış bir dosyayı çağırıyordu ve
   sözleşmenin "iki yönlü kanıt" şartı böylece sessizce düşmüştü.

---

## F-013 turunda eklenen üç teknik

16. **Manifest/`snapshotDir` testlerinde anlık görüntülerin SIRASINI ve karşılaştırma
   biçimini denetle.** F-013'ün AC3 kanıtı olan manifest testi iki yerden delikti:
   (a) "önce" anlık görüntüsü ölçülen fonksiyonun mutlu-yol çağrısından **sonra** alınıyordu,
   (b) karşılaştırma `before.every(e => after'da aynı relPath+sha256 var)` biçimindeydi —
   yalnızca **var olan** dosyaların değişmediğini ölçer, **yeni dosya eklenmesini** görmez.
   Sonuç: mutlu yola koyduğum **sabit içerikli** `fs.writeFileSync` manifest testinden geçti
   (`-t "manifest"` → 2 passed). Teknik: mutasyonu iki biçimde koştur — (i) sabit içerikli,
   mutlu yolda; (ii) çağrı başına değişen içerikli. Yalnızca (ii) kırmızı veriyorsa test
   sıralaması bozuktur. `expect(after).toEqual(before)` tam eşitliği iste.
17. **Guard'ın "hangi kök" kısıtı ile "hangi dosya" kısıtını ayır; string-interpolasyonla
   dosya adı üreten İKİNCİ yol-kurma noktalarını ara.** F-013'te tüm okumaların guard'dan
   geçtiği sanılıyordu; `readOptionalDocument` yolu `path.join(dir, `${card.id}-contract.md`)`
   ile guard'sız kuruyordu ve `card.id` **frontmatter'dan** (dosya içeriğinden) geliyordu.
   Tek savunma bir regex'ti (`SAFE_ID_PATTERN`) ve **sıfır testi vardı**: kaldırınca 109/109
   yeşil, ardından `id: ../../../outside/qa/EVIL` frontmatter'ıyla kök dışı içeriği gerçekten
   sızdırdım. Ayrıca guard'ın kendisi yalnızca "kök altında"yı kısıtlıyordu:
   `buildFeatureDetail(root,'../../package.json')` → **ok**. Yöntem: `path.join(`/`${`
   geçen her satırı grep'le, girdinin nereden geldiğini geriye izle, her biri için ayrı
   mutasyon koştur.
18. **Okuma amaçlı bir yüzeyde focus-trap'in seçicisiyle kaydırma kaplarını karşılaştır.**
   F-013 penceresinde 12 kaydırma bölgesi vardı (1 dış kap + 11 `<pre>`), hiçbirinde
   `tabindex` yoktu ve trap'in seçicisi (`button, [href], input, select, textarea, [tabindex]`)
   yalnızca "Kapat"ı buluyordu → `PageDown`/`ArrowDown` sonrası dış kabın `scrollTop` **0**
   (kaydırılabilir mesafe 2690px). Klavye kullanıcısı her belgenin ilk ~254 pikselini görebiliyor.
   Ölçüm 30 saniye: `[...m.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight)` ile
   kaydırma bölgelerini say, `tabindex`lerine bak, tuşa bas, `scrollTop`'u tekrar oku.

---

## F-008 turunda eklenen dört teknik

19. **"Kullanicinin ONAYLADIGI" ile "diske YAZILAN" arasina mutasyon at.** Iki adimli onay/
   onizleme iceren her ekranda sozlesme genelde "onizleme ile yazilan bayt bayt ayni" diyor ve
   bunu "ayni saf fonksiyonu cagiriyoruz" ile gerekcelendiriyor — ama modalin `onConfirm`'e
   gercekten ayni degeri gecirdigini hicbir sey olcmuyor. F-008'de `onConfirm(decision)` →
   `onConfirm(decision + ' [ek]')` mutasyonu **1066/1066 yesil** kaldi; E2E de yakalayamadi
   cunku `toContain` onek eslesmesi. Ayrica gercek bir ayrisma uretilebiliyor: modal ACIKKEN
   etiketin/tarihin kaynagini (PROCESS.md) degistir → onizleme eski etiketi, disk yeniyi alir.
   **Kural:** onizleme metnini tarayicidan oku, sha256'sini al, diskteki dosyanin sha256'siyla
   **tam esitlik** karsilastir; sonra ayni yolu mutasyonla kir.
20. **Windows'ta `fs.existsSync` harfe DUYARSIZ; dosya adi regex'i duyarli.** Iki katman ayni
   dosya hakkinda zit karar verir. F-008'de `g2.ok` ayni ekranda hem "Taninmayan dosyalar"
   listesinde hem `G2 = Onaylandi (kilitli)` durumunun kaynagiydi ve kapiyi panelden
   reddedilemez yapti (409). **Olcum 60 saniye:** sandbox `docs/approvals/`'a yalnizca kucuk
   harfli `g2.ok`/`g5.deny.md` koy, listeyi cek. ADR "yalnizca Windows" diyorsa bu sinifi her
   dosya-adi-desenli feature'da ara. Siddeti kalibre et: sistemin geri kalani (hook'lar) da
   `existsSync` kullaniyorsa durum tutarlidir, hatali olan yalnizca siniflandirma mesajidir.
21. **Yari-basari icin ACL asimetrisi kur (Windows'ta `chmod` ise yaramaz).**
   `icacls <dir> /deny "<user>:(NP)(WD,AD)"` → dizinde YENI dosya olusturulamaz ama dosyayi
   dizinden DISARI `rename` etmek calisir. Bu tam olarak "arsivleme oldu, onay yazilamadi"
   senaryosunu uretir. PowerShell'de `$env:USERNAME:` degisken adi olarak yutulur — `('{0}:(NP)(WD,AD)' -f $env:USERNAME)` kullan. Kaldirma: `/remove:d <user>`.
   Onay/geri-al arasinda dosyalari geri tasimak icin ONCE ACL'i kaldir (iceri rename de bloklu).
22. **Kirmizi bir betigin feature'a ait OLMADIGINI kanitla, varsayma.** `npm run e2e:dev`
   kirmiziydi; suclamadan once dort ayirt edici olcum yaptim: (a) alt komut tek basina calisiyor
   mu, (b) araci (`tsx watch`) tek basina calisiyor mu, (c) feature'in katkisini (yeni izleyici)
   mutasyonla devre disi birak — hala kirmizi mi, (d) bos bir veri dizini ile hala kirmizi mi.
   Dorduncusu de kirmiziysa bulgu proje borcudur, feature'in kararini etkilemez.

---

## F-009 turunda eklenen bes teknik (arastirma/fixture feature'i)

23. **Kara listeye dayanan "gizlilik/sizinti citi"ni 12'lik standart sonda setiyle yen.**
   F-009'da fixture'lari tarayan cit 12/12 sizdiran sondadan gecti. En verimli iki delik
   desenin kendisinde degil, **numaralandirma ve on-isleme** katmanindaydi: (a) `readdirSync`
   yalnizca ust seviye + yalnizca `.jsonl` suzuyordu → `.json` uzantili ve alt dizindeki
   sizintilar **hic taranmadi**; (b) tarayici satiri `JSON.parse` edip basarisiz olunca
   `continue` ediyordu → secret/uzunluk kontrolleri **yalnizca ayristirilabilen** satirlarda
   kosuyordu, yani fixture setinin **tanim geregi bozuk** uyesi (`truncated-last-line`)
   sizinti icin serbest kanaldi. Sonda seti: kisa-ama-kisisel metin · POSIX yol (`/c/Users/…`)
   · `%USERPROFILE%` · UNC · ileri bolu (`C:/Users/…`) · 80 karakter altinda base64 ·
   ayristirilamayan satirda uzun prompt · JSON **anahtari** olarak metin · uzun metni
   <esik parcalara bolme · listede olmayan gercek proje adi · farkli uzanti · alt dizin.
   Sondalari fixture dizinine birak, gercek cit testini kostur, sonra sil.
24. **Bir BELGE teslimatinda `✓ DOGRULANDI` isaretli her sayisal iddiayi tam taramayla yeniden
   uret.** F-009 wiki sayfasi "217 dosyanin tamaminda ayni `version` degeri" diyordu; tam tarama
   uc ayri deger buldu ve **baskin deger sayfada hic gecmiyordu** (%96). Bu tur iddialar genelde
   tek dosyanin `head -1`'inden gelir. Arastirma feature'inda teslimat kod degil belge oldugu icin
   bu dogrudan bloklayicidir; ayrica sayfanin cikarimlarini (burada "transkript surumu CLI'dan
   ayridir") da cokertebilir. Ucuz olcum: `find … | xargs grep -oh '"alan":"[^"]*"' | sort | uniq -c`.
25. **`.gitattributes` ile "bayt korunuyor" iddiasini UC yerde olc.** Diskte, `git show HEAD:<yol>`
   blob'unda ve **temiz klonda** (`git clone --no-hardlinks .` scratchpad'e). F-009'da ucu de
   3 CRLF + BOM gosterdi. Dikkat: `git check-attr -a` hala `eol: lf` gosterebilir — `text: unset`
   oldugu icin etkisizdir, ama bunu belgeye degil **olcume** dayanarak soyle. Kontrol grubu sart:
   kardes fixture'da (`valid.jsonl`) 0 CRLF olmali, yoksa fixture ayirt edici degildir.
26. **Cok katmanli yol guard'inda her katmani AYRI kaldir; birlesik mutasyonun kirmizi vermesi
   citi kanitlamaz.** F-009'un guard'i dort katmanliydi (ata symlink · hedef symlink ·
   realpath ONCESI kapsama · realpath SONRASI kapsama); dordu de **tek tek** kaldirildiginda
   69/69 yesil kaldi, yalnizca ikisi birlikte kaldirilinca kirmizi verdi (ve o hâlde gercek
   kok-disi okuma gerceklesti). Kok neden: junction testi yalnizca `{ok:false}` iddia ediyordu,
   `reason`'a bakmiyordu — bir katman dusunce digerinin farkli `reason` ile reddetmesi testi
   yesil birakiyor. Kural: rededilme iddialarinda **`reason` alanini da** assert ettir.
27. **Esik mutasyonlarinda sondanin BASKA bir desene takilip takilmadigini kontrol et.**
   `MAX_FREE_TEXT_CHARS = 200 → 100000` mutasyonu yesil kaldi; cunku testin sondasi
   `'x'.repeat(250)` idi ve bu dizge esikten bagimsiz olarak "uzun opak blok" desenine
   (`[A-Za-z0-9+/_=]{80,}`) de uyuyordu. Test "ihlal bulundu" diye geciyor ama olctugunu sandigi
   esigi hic olcmuyor. Genel kural: bir mutasyon beklenmedik sekilde YESIL kaldiginda once
   "test dogru sebeple mi geciyordu" diye sor — cogu zaman ikinci bir desen/dal maskeliyor.
   Ayrica bu turda "MUTASYON hedefi" adli dort test kendi kendine referans veriyordu
   (`expect(alwaysAllowed()).toMatchObject({ok:true})` gibi); **test adinda "mutasyon" gecmesi
   mutasyon kanitlandi demek degildir** — uretim kodunu gercekten degistirip kostur.

---

## F-009 tur 3'te eklenen üç teknik (BEYAZ LİSTE çitini denetleme)

28. **Beyaz liste (allowlist) çitinde saldırıyı desene değil, ÇİTİN KENDİ ONAYLI ŞEKİLLERİNE
   yönelt.** "Yasak desen" aramak anlamsızdır; kaçış yalnızca (a) onaylı yapısal desenlerin
   serbest bıraktığı karakter aralıklarından, (b) tokenizer'ın hiç görmediği baytlardan,
   (c) muafiyetlerin kapsamından gelir. F-009'da üç kanal da açıktı: `^[A-Za-z]:$` (sürücü
   harfi) tek harf taşıdığı için `g: e: r: c: e: k:` biçiminde keyfî metin; tokenizer charset'i
   dışındaki her bayt (Kiril/CJK/emoji) **ayırıcı** sayıldığı için sıfır token → hiç denetlenmez;
   `.gitattributes` muafiyeti **ada** dayalı olduğu için alt dizindeki aynı adlı dosya hiç
   taranmaz. Standart sonda seti: doğal boşluklu telefon · sayıyı ≤N'lik gruplara bölme ·
   onaylı desene (ISO/semver/uuid/msg-id) hane gömme · yalnızca onaylı sözcüklerden cümle ·
   Latin dışı alfabe · muaf dosya adını alt dizinde kullanma.
29. **Kararı "teorik bit taşıma" ile "pratik sızıntı" arasında AÇIKÇA böl — ve pratikliği
   projenin FİİLEN kullandığı dilde ölç.** F-009'da 13 vektör geçti ama hiçbiri okunabilir
   prompt değildi: Türkçe düz metin, İngilizce düz prompt ve aksanlı Latin **her seferinde**
   reddedildi. Kontrol sondası olarak bu üçünü mutlaka koy — geçen vektörlerin listesi tek
   başına bakıldığında çit yenilmiş gibi görünür. Kaza sınıfı (bir transkript satırı
   yapıştırılır) ile kasıt sınıfını (harf harf kodlama) ayır; ikincisi borç, bloklayıcı değil.
30. **Kaskad ("mekanizmayı kapat → 35/54 kırmızı") tek nokta çitinin yerini TUTMAZ: her onaylı
   deseni TEK TEK gevşet.** F-009'da 7 desenin 3'ü (çıplak sayı, ISO, UUID) negatif birim
   testleriyle çitliydi, 4'ü (semver, sürücü harfi, msg-id, iki nokta) gevşetildiğinde 54/54
   yeşil kaldı. Gevşetme mutasyonu silme mutasyonundan daha ucuz ve daha gerçekçidir
   (`{1,3}` → `{1,20}`, `^msg_example\d{1,4}$` → `^msg_.*$`). Ayrıca sözleşmenin sınıf düzeyli
   iddialarını ("4+ haneli her sayı — telefon, TC, kart, IBAN — reddedilir") her sınıf için
   ayrı sondayla sına: F-009'da kart ve IBAN yakalandı (harf taşıyorlar), telefon ve TC
   boşluklu yazımda geçti — iddia sınıf düzeyinde yanlıştı.
