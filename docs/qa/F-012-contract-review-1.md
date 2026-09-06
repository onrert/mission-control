---
feature: F-012
title: F-012 sözleşme denetimi — tur 1 (belge denetimi, kod yok)
author: qa-evaluator
date: 2026-09-06
verdict: KALDI
---

# KARAR: KALDI
# ESKALE: false

Denetlenen belge: `docs/qa/F-012-contract.md` (595 satır, `status: draft`).
Bu tur **belge denetimidir**: uygulama çalıştırılmadı, `npm install` yapılmadı, hiçbir SDK
oturumu açılmadı. Sözleşme dışında hiçbir dosya değiştirilmedi.

**Özet:** sözleşme teknik olarak ciddi ve bu deponun hata sınıflarının çoğunu tanıyor (async
hata sınırı, `x-mc-write`, `id:` tuzağı, deps guard'ı). Ama (a) CEO'nun beş kararının **beşi de**
gövdeye yayılmamış, (b) telafi mekanizması istemcide **var olmayan** bir kancaya dayanıyor,
(c) iki ayrı çit (yazma kapısı statik taraması, tablist sayıcıları) kod turunda kesinlikle
KIRMIZI verecek ve sözleşmenin dosya planında yok, (d) K3'ün "otomatik onay yok" kuralı
sözleşmenin kendi seçtiği yapılandırma tarafından **fiilen deliniyor**.

**Bulgu sayısı:** 7 BLOKLAYICI · 13 ÖNEMLİ · 6 NOT.

---

## BLOKLAYICI bulgular

### B1 — `hello` tabanlı tam senkron telafisi istemcide VAR OLMAYAN bir kancaya dayanıyor

- **Nerede:** sözleşme §5, "Sonuç — kopma/telafi (bağlayıcı)" (satır 282-291) ve §5 "Yarım cevap
  kesilirse" madde 1 (satır 293-297); §2.4 `useEventStream.ts` satırı (satır 137).
- **Sorun:** sözleşme, `chat_*` çerçevelerinin `id:` taşımamasının bedelini şöyle ödüyor:
  *"Panel, `/api/stream` her (yeniden) bağlandığında (`hello` çerçevesini gördüğünde) her zaman
  `GET /api/chat/history`'yi çağırıp sohbet durumunu tam olarak yeniden yükler."*
  **`useEventStream.ts` `hello` kanalına hiç abone olmuyor.** Dinlenen olaylar tam olarak:
  `open`, `error`, `event`, `resync` ve (callback verilmişse) `projects`, `features`
  (`src/web/lib/useEventStream.ts:203-212`). `hello` için ne dinleyici ne de callback seçeneği
  var. Sözleşmenin §2.4'te `useEventStream.ts`'e ekleneceğini söylediği altı callback'in hiçbiri
  de `hello`/yeniden-bağlanma kancası değil (hepsi `chat_*` kanalları).
- **Neden sorun:** bu, `CLAUDE.md`'de kayıtlı F-005 sınıfının birebir tekrarı — *"Sözleşmede
  'handler genel 500 yoluna düşer' gibi bir mekanizmaya dayanmadan önce o yolun VAR olduğunu koda
  bakarak doğrula."* Mekanizma yok; dolayısıyla `id:` taşımama kararının **tek** telafisi de yok.
  Sonuç: bağlantı koptuğunda akan yarım cevabın kalan parçaları kaybolur, panel kalıcı olarak
  eksik bir mesaj gösterir ve **bunu fark edemez** (aşağıda B1b).
- **B1b (aynı bulgunun ikinci yarısı):** `chat_message` yük şekli `{ turn_id, delta, done }`
  (satır 305) — içinde **hiçbir sıra numarası yok**. `id:` de yok. Yani istemci bir delta'nın
  kaybolduğunu **hiçbir biçimde tespit edemez**; "boşluk" kavramı tel üzerinde temsil edilmiyor.
  ADR-004 karar 5'in sıra garantisi vermeyen kanallara izin verme **gerekçesi** şudur:
  *"`features`/`gates`/`projects` kanalları durum anlık görüntüsüdür (delta değil): her mesaj …
  tam listeyi taşır, bir mesaj kaçsa bile bir sonraki durumu düzeltir"*
  (`docs/decisions/ADR-004-gercek-zamanli-tasima.md:27`). `chat_message` **delta**dır, anlık
  görüntü değildir — yani ADR-004'ün istisnasının gerekçesi bu kanalda geçerli değil. Sözleşme
  §5'te "aksine ona uyuyor" diyor; harfine uyuyor, gerekçesine uymuyor. SPIKE-002 §5.2 bunu
  bağlayıcı bir sınır olarak yazmıştı: *"hangisi seçilirse seçilsin, ADR-004 karar 5'in … cümlesi
  güncellenmek zorundadır"*.
- **Önerilen düzeltme:** üç şeyden birini seç ve **koda bakarak** yaz: (a) `useEventStream`'e
  gerçek bir `onHello`/`onReconnect` callback'i eklemeyi §2.4'ün dosya listesine ve mutasyon
  listesine koy (mutasyon: callback'i sil → yeniden bağlanma sonrası eksik mesaj testi KIRMIZI);
  (b) `chat_message`'a kanal-içi monoton `chat_seq` alanı koyup istemcide boşluk tespiti yap;
  (c) sohbeti anlık-görüntü kanalına çevir (her çerçevede turun **tam** metni). Hangisi olursa
  olsun ADR-004 karar 5'e ek gerekiyor.

### B2 — Bariyer yalnızca `ANTHROPIC_API_KEY`; CEO kararı D2 (ad uzayı allowlist'i) ile çelişiyor ve deponun kendi ölçtüğü öncelik tablosuna göre yetersiz

- **Nerede:** §1 "Kapsam DIŞI" son madde (satır 96-97), §7 "Denetlenen tek değişken" (satır
  363-365), §13 açık soru 2 (satır 371-376 civarı).
- **Sorun:** sözleşme `ANTHROPIC_AUTH_TOKEN`'ı bilinçli olarak kapsam dışı bırakıp CEO'ya soru
  olarak taşıyor. CEO kararı D2 bu soruyu **kapatmış**: bariyer denylist değil, tehlikeli ad
  uzayında (`ANTHROPIC_*`, `CLAUDE_*`, `AWS_*`, `GOOGLE_*`) **allowlist** olacak ve temizlenen
  **her** değişken için görünür uyarı çıkacak.
- **Neden sorun (kararın ötesinde, ölçülmüş kanıt):** deponun kendi doğruladığı kimlik önceliği
  tablosu (`docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md:90-97`, ✓ DOĞRULANDI) şöyle:
  1. bulut sağlayıcı (`CLAUDE_CODE_USE_BEDROCK` vb.) · 2. `ANTHROPIC_AUTH_TOKEN` ·
  3. `ANTHROPIC_API_KEY` · 4. `apiKeyHelper`. Yani sözleşmenin temizlediği değişken listede
  **üçüncü** sırada; ondan **daha yüksek** öncelikli iki kaynak (1 ve 2) bariyerden geçiyor.
  Bariyerin AC'si "ücretli yola sessizce düşülmesin"dir; bugünkü hâliyle `ANTHROPIC_AUTH_TOKEN`
  ayarlı bir ortamda bariyer "tripped: false" der, uyarı çıkmaz ve oturum yine de anahtarla açılır.
  Bu, bariyeri **yeşil ama hiçbir şey ölçmeyen** bir çite dönüştürür.
  Ayrıca denylist yerine allowlist emsali bu depoda zaten var ve ölçülerek konulmuştu
  (`docs/decisions/ADR-013-…md`, ek: *"allowlist zorunludur, denylist değil. QA ölçtü…"*).
- **Önerilen düzeltme:** §7'yi D2'ye göre yeniden yaz: dört önekle eşleşen tüm değişkenler
  varsayılan olarak alt sürece **geçmez**; geçenler açık bir sabit listede sayılır; **temizlenen
  her değişkenin adı** (değeri değil) `api_key_barrier` durumuna ve kalıcı uyarı şeridine düşer.
  §1'in kapsam-dışı maddesi ve §13 soru 2 silinir. `apiKeyHelper` bir **ayar** (env değil) olduğu
  için ayrıca ele alınmalı (bkz. N6).

### B3 — K3 "otomatik onay YASAK" çitlenmemiş ve sözleşmenin kendi yapılandırmasıyla fiilen deliniyor

- **Nerede:** §4 `result` paragrafı (satır 242-250), §8 `settingSources: ['project']` (satır 398),
  §11.2 mutasyon 5.
- **Sorun:** sözleşme K3'ü şöyle garanti ediyor: *"sunucu hiçbir zaman kendi başına
  `{behavior:'allow'}` üretmez, yalnızca panelden gelen kararı yönlendirir."* Bu doğru ama
  **yetersiz**: otomatik onay sunucudan değil, sözleşmenin bilerek yüklediği ayarlardan geliyor.
  - `settingSources: ['project']` `.claude/settings.json`'ı yükler — o dosyada 40 satırlık bir
    `permissions.allow` listesi var: `Bash(npm run *)`, `Bash(node *)`, `Write(src/**)`,
    `Edit(docs/**)`, `Bash(git commit *)` … (`.claude/settings.json`, `permissions.allow`).
  - SPIKE-002 §5.4 sınır 3, ✓ DOĞRULANDI: *"`canUseTool` **otomatik onaylanan araçlar için hiç
    ateşlenmez**"*. Aynı sayfa uyarıyor: *"Bu ayrımı karıştırmak, `CLAUDE.md`'deki 'testin yorumu
    ile taradığı şey çelişiyor' hatasının aynısını üretir."*
  - Ayarların gerçekten uygulandığı **ölçüldü**: `docs/spikes/SPIKE-002-asama0-olcum.md:100-108`
    — bir komut hook'tan değil *"`settings.json`'ın kendi izin motorundan"* reddedildi.
- **Neden sorun:** yani barındırılan oturumda `npm run *`, `node *`, `git commit *` ve
  `src/**`/`docs/**` yazmaları **hiçbir izin kartı üretmez**; kullanıcı hiçbir şey görmez.
  UX §7.3 ise *"Otomatik onay yoktur — panel tasarımı hiçbir koşulda kendiliğinden onaylamaz"*
  diyor, ADR-005 eki de ikinci güven seviyesinin çitini "kullanıcının o an verdiği karar"a
  bağlıyor. Mutasyon 5 (*"canUseTool bekleme olmadan otomatik allow döner"*) yalnızca sunucu
  tarafını ölçtüğü için bu yolu **hiç göremez** — yani mutasyon listesindeki tek K3 çiti,
  gerçek ihlal yolunu kapsamıyor.
- **Önerilen düzeltme:** sözleşme bunu açıkça karara bağlamalı: ya (a) izin kararı için
  `settingSources`'ın `permissions.allow`'unun barındırılan oturumda **devre dışı** bırakıldığı
  bir yapılandırma seçilir (ve hook'ların yüklenmeye devam ettiği ayrı ölçülür — bu ikisi aynı
  kaynaktan geldiği için tasarım gerektirir), ya da (b) "otomatik onaylanan araç sınıfı vardır"
  bilinçli bir risk kabulü olarak ADR-014/ADR-005'e yazılır ve **UX §7.3 düzeltilir**. Her iki
  hâlde de yeni bir mutasyon gerekir: `permissions.allow`'daki bir araç çağrısının izin kartı
  üretip üretmediğini ölçen test.

### B4 — `ADR-005` eki YAZILMIŞ; sözleşme onu "yazılmadı, açık soru" sayıyor ve ekin bağlayıcı cümlesiyle çelişiyor

- **Nerede:** §1 "Kapsam DIŞI" (satır 88-95), §12 madde 5, §13 açık soru 3.
- **Sorun:** `docs/decisions/ADR-005-yazma-kapisi-ve-guvenlik-siniri.md:59` altında
  **"Ek — F-012 sohbet arayüzü yazma sınırını ikiye ayırır (2026-09-06, `ADR-014`)"** bölümü
  mevcut. Sözleşme üç ayrı yerde bunun yazılmadığını, dosya sahipliği dışında olduğunu ve CEO'ya
  sorulduğunu söylüyor. Öncül yanlış (CEO kararı D3).
- **Neden sorun:** yalnızca atıf hatası değil — ek **bağlayıcı kurallar** getiriyor ve sözleşme
  onlarla hizalanmamış:
  1. *"İkisini aynı testle ölçmeye çalışmak hatadır: dosya sistemi manifest testi ikinci seviyeyi
     kapsamaz ve kapsamamalıdır."* Sözleşme §1'de hâlâ "mevcut statik/manifest guard'lar bunu
     ölçmüyor → açık soru" diye yazıyor; ek bunu zaten karara bağlamış.
  2. *"ikinci seviyenin çiti hook engellemesinin kendisidir ve iki yönlü test edilmek zorundadır
     — 'hook yükleniyor' testi kabul edilmez."* Sözleşme §8'in `verify`de koşan tek çiti tam
     olarak bir "yükleniyor" testidir (mutasyon 3). D4 canlı testi `verify` dışında bıraktığı
     için bu ayrımın sözleşmede **açıkça** yazılması gerekiyor (bkz. Ö10).
  3. *"(1) Panelin kendi yazması — DEĞİŞMEDİ … F-012 bu kümeye **tek bir yol bile eklemez**"* —
     sözleşme §6 iki yeni panel yazma yolu ekliyor (`<dataDir>/chat/history.jsonl` ve
     `<dataDir>/chat/session-id.txt`). Bu doğrudan çelişki; ya ek düzeltilmeli ya sözleşme.
- **Önerilen düzeltme:** §1/§12/§13-3'ü sil, yerine ADR-005 ekine atıf koy; ekin üç kuralını
  gövdeye yay; iki yeni yazma yolunun ekin (1) numaralı kümesine göre nasıl konumlandığını
  açıkça yaz (bkz. B5).

### B5 — `history-log.ts` kod turunda `no-write-gate-bypass` çitini KIRMIZI yapar; sözleşmede ne dosya ne muafiyet planı var

- **Nerede:** §2.1 `history-log.ts`, §2.3 test listesi, §2.4 "dokunulmayacağını doğruladığım
  dosyalar" (satır 141-147), §0 (satır 43-46).
- **Sorun:** `tests/no-write-gate-bypass.test.ts` **tüm `src/**`'ı** tarıyor
  (`tests/no-write-gate-bypass.test.ts:129` — `walk(path.join(ROOT,'src'), ['.ts','.tsx'])`) ve
  `appendFile(`, `appendFileSync(`, `writeFileSync(`, `mkdirSync(`, `openSync(`, `renameSync(`
  dahil geniş bir yasak liste uyguluyor (satır 34-59); ayrıca `import { appendFile } from 'fs'`
  gibi **edinimi** de yakalıyor (satır 76-113). Muafiyet yalnızca dört dosya için ve
  **çağrının tam metniyle** tanımlı (satır 140-162, `STORE_FILES`).
  `src/features/chat/server/history-log.ts` bir JSONL ekleme logu yazacak → bu çit kesinlikle
  KIRMIZI verir. Sözleşme §0'da guard'ın `src/features/**`'i özyinelemeli taradığını doğru tespit
  ediyor ama sonucu ters yorumluyor: *"yeni `src/features/chat/**` otomatik kapsanıyor, tarama
  kökü eklemek gerekmiyor"* — kapsanmak burada **iyi haber değil**, çitin kırılacağı anlamına
  geliyor.
- **Neden sorun:** kod turu ilk `npm run verify`'da duracak; developer ya çiti gevşetecek (ADR-005
  karar 10'un iddiasını sessizce zayıflatır) ya da sözleşme dışına çıkacak. Bu, bu deponun
  "korumayı kurmak yetmez, bağlandığını kanıtla" dersinin tam tersi yönünde bir baskı yaratır.
- **Önerilen düzeltme:** §2.3'e `tests/no-write-gate-bypass.test.ts` dosyasını ekle; `STORE_FILES`'a
  eklenecek **tam çağrı metinlerini** şimdiden yaz (ör. `fs.promises.appendFile(file, line)`,
  `fs.mkdirSync(dir, { recursive: true })`); ADR-005 ekinin "tek bir yol bile eklemez" cümlesiyle
  ilişkiyi karara bağla; ve bu genişletmenin körleşmemesi için bir mutasyon ekle (allowlist'e
  eklenen satırın dışına çıkan yeni bir yazma çağrısı KIRMIZI vermeli).

### B6 — D1/D5 ile çelişki: sözleşme "minimal geçici ekran + geçici bağlama noktası" üzerine kurulmuş; UX §7 yazıldı ve sohbet üçüncü kalıcı sekme

- **Nerede:** §2.2 `ChatScreen.minimal.tsx` (satır 117), §2.4 `src/web/App.tsx` satırı (satır 136),
  §1 kapsam-dışı (satır 84-87), §10 giriş (satır 470-473), §13 soru 1 ve soru 5, kapanış paragrafı
  (satır 590-594).
- **Sorun:** CEO kararı D1 "minimal/işlevsel geçici arayüz" seçeneğini **reddetti**; D5 sohbeti
  **üçüncü kalıcı sekme** yaptı. `docs/03-ux.md:225-379` (`### 7. Sohbet (CEO)`) yazılmış ve
  onaylanmış: sekme sırası `[Zaman Çizelgesi][Kanban][Sohbet][Kapılar][Thread][Token]`, geniş ve
  dar mockup'lar, altı davranış bölümü, klavye kuralları, ve `docs/03-ux.md:733-762`'de CEO'nun
  üç kararı (S1/S2/S3). Sözleşmenin gövdesi bu belge **yokmuş gibi** yazılmış ("UX dokümanının
  sohbet bölümü bu sözleşme turunda henüz yazılmamıştı").
- **Neden sorun:** `CLAUDE.md` dersi birebir bu: *"CEO kararını turun ortasında/sonunda eklersen
  uygulanmaz … F-005'te … yedi yerde çelişki bıraktı."* Sözleşmenin altı ayrı yeri bu varsayım
  üzerine kurulu; tek bir cümle eklemek yetmez, gövde yeniden yazılmalı.
- **Önerilen düzeltme:** §2.2'yi `ChatScreen.tsx` (UX §7'ye birebir uyan, kalıcı) olarak yeniden
  yaz; §2.4'te App.tsx değişikliğini "üçüncü `TabScreen` + `TABS` girdisi + `panel-chat` tabpanel
  + roving tabindex" olarak somutlaştır; §13 soru 1 ve 5'i sil; §10'un "bu tablo bağlayıcı
  değildir" cümlesini "UX §7 bağlayıcıdır, tablo yalnızca veri karşılığıdır" olarak çevir;
  UX'teki Türkçe metinlerin **birebir** kullanılacağını yaz (developer metin uyduramaz).

### B7 — UX CEO kararı S2'nin **zorunlu kıldığı çit** mutasyon listesinde yok

- **Nerede:** §11.2 (on mutasyon), `docs/03-ux.md:748-753`.
- **Sorun:** CEO kararı S2 açık: *"Bu bir **çit gerektirir**, yalnızca bir tasarım tercihi değil:
  ham araç çıktısını akışa basan bir mutasyon KIRMIZI vermelidir."* On mutasyonun hiçbiri bunu
  ölçmüyor. Sözleşme §5'te ham SDK zarfının sızmadığını **anlatıyor** (satır 305-309) ama
  çitlemiyor.
- **Neden sorun:** iki somut kanıt bu yolun gerçek olduğunu gösteriyor: (a) `ListAgents` bu
  makinedeki **ilgisiz projelerin** oturum adlarını döndürüyor (`SPIKE-002-asama0-olcum.md:176-186`,
  ✓ DOĞRULANDI); (b) `Agent` aracının tool_result'ı *"This tool result is internal metadata — never
  quote or paste any part of it"* iç talimatını taşıyor (aynı dosya, "Ek gözlem"). Çit yoksa,
  `chat_tool` yükünü "hata ayıklamak için" genişleten bir satır bu iki şeyi de panele basar ve
  hiçbir test kırmızı olmaz.
- **Önerilen düzeltme:** mutasyon 11 ekle: `chat_tool` yayınına ham `tool_result`/`content`
  alanını ekleyen mutasyon → `session.test.ts` KIRMIZI (yayınlanan yükün alan kümesi **kapalı**
  bir allowlist ile assert edilmeli: `{tool_name, description, status, elapsed_ms,
  parent_tool_use_id}` gibi; "şu alan yok" biçiminde değil, "yalnızca şu alanlar var" biçiminde —
  aksi hâlde mutasyon kaçar).

---

## ÖNEMLİ bulgular

### Ö1 — Üçüncü sekme mevcut üç çiti kırar; sözleşmenin dosya planında ve AC10 eşlemesinde yok

- **Nerede:** §2.3/§2.4 dosya listeleri, §11.1 AC10 satırı.
- **Kanıt (ölçüldü, dosya:satır):**
  - `tests/web/App.test.tsx:48` → `expect(headerHtml.match(/role="tab"/g)).toHaveLength(2)`
  - `tests/e2e/shell.spec.ts:45` → `expect(clickableCount).toBe(3)`; `:59-60` →
    `expect(tabRoleCount).toBe(2)`
  - `tests/web/App.interaction.test.tsx:205-212` → `End` tuşunun **Kanban**'ı seçtiğini assert
    ediyor; üçüncü sekmede `End` artık Sohbet'i seçer.
- **Neden sorun:** AC10 ("panel bugünkü hâline temiz döner") eşlemesi yalnızca `MC_CHAT_ENABLED=0`
  senaryosunu sayıyor; sekme eklendiğinde kapalı modda sekmenin **hiç görünmemesi** gerektiği de
  (UX "Faz bazlı ekleme kuralı" + sözleşme §10'un `chat_disabled` satırı) test edilmeli.
- **Düzeltme:** üç dosyayı §2.4'e ekle, beklenen yeni sayıları yaz; AC10'a "kapalıyken
  `role="tab"` sayısı 2 kalır" assert'ini ekle.

### Ö2 — Akış (`delta`) kaynağı doğrulanmamış; `includePartialMessages` sözleşmede hiç geçmiyor

- **Nerede:** §5 "`chat_message` delta biçimi" (satır 305-309), §11.1 AC1 satırı.
- **Sorun:** sözleşme deltaları *"SDK'nın `stream_event`/parça mesajlarından"* çıkaracağını
  söylüyor ama `query()` seçeneklerinde bu mesajları açan bir ayar tanımlamıyor. Depoda
  `stream_event`/`includePartialMessages` kelimeleri **hiçbir belgede geçmiyor** (grep, `docs/`
  altı). `SPIKE-002-asama0-olcum.md:229-236` yalnızca **mesaj seviyesinde** akış ölçtü ("`Read`
  tool_use'u, tool_result'u ve özet metni ayrı ayrı, zaman damgalı mesajlar olarak aktı").
- **Neden sorun:** UX §7.1 büyüyen balon + yanıp sönen imleç istiyor; bu, mesaj-seviyesi akışla
  ancak kabaca karşılanır. Sözleşme bunu **✓/[T] işareti olmadan** varsayım olarak yazmış —
  belgenin kendi kanıt disiplinini ihlal ediyor.
- **Düzeltme:** seçeneği adıyla yaz, kanıt seviyesini [T] işaretle, ve AC1'in parça-seviyesi akışla
  da karşılandığı bir geri çekilme yolu tanımla (UX §7.1 buna göre yorumlanır).

### Ö3 — Ekleme-only log ile `streaming → done/interrupted` durum geçişi bağdaşmıyor

- **Nerede:** §2.1 `history-log.ts` ("Kendi basit **ekleme-log** dosyası"), §6 `ChatLogEntry.status`,
  §3 "Çöker ne olur" (`markDanglingAsInterrupted`).
- **Sorun:** `status` alanı bir girdinin yaşam döngüsü boyunca değişiyor (`streaming` → `done` ya
  da `interrupted`). Ekleme-only bir JSONL'de bu ancak (a) dosyayı yeniden yazarak, (b) düzeltme
  girdisi ekleyip okuma anında katlayarak yapılabilir. Sözleşme hangisini seçtiğini yazmıyor.
- **Neden sorun:** (a) seçilirse yeni bir **yerinde yeniden yazma** yolu doğar (B5'in çiti +
  ADR-005 ek çelişkisi büyür, ayrıca kısmi yazmada geçmiş kaybı riski); (b) seçilirse `readAll()`
  saf bir okuma değildir ve `GET /api/chat/history` semantiği değişir. Karar verilmeden mutasyon
  10 ("`markDanglingAsInterrupted` çağrısı kaldırılır") da tam olarak neyi ölçtüğünü bilmiyor.
- **Düzeltme:** yöntemi seç ve yaz; seçilen yöntemin atomiklik/kesinti davranışını (`atomicWrite`
  deseni var mı, yarım yazma ne olur) tanımla.

### Ö4 — Geçmiş sayfalaması yok; UX "son 50 + daha eski" istiyor

- **Nerede:** §4 uç tablosu (`/api/chat/history` parametresiz), §6 "Panel açılınca ne yükleniyor"
  (dosyanın **tamamı**), §6 "Retention: v1'de yok".
- **Sorun:** `docs/03-ux.md:365-367` (madde 7): son **50 mesaj** yüklenir, üstte "▲ Daha eski
  mesajları yükle" bağlantısı vardır, tıklanınca **bir önceki 50'lik blok** üste eklenir ve
  kaydırma konumu korunur. Sözleşmenin ucu ne `limit` ne `before_seq` alıyor.
- **Neden sorun:** retention da olmadığı için "tamamı" zamanla sınırsız büyür; her yeniden
  bağlanmada (B1'in telafisi) tüm dosya çekilir. Bu, F-003'te ölçülen ilk-yükleme davranışının
  (`INITIAL_LOAD_LIMIT = 200`, `useEventStream.ts:12`) tersine bir tasarım.
- **Düzeltme:** uca `limit` (varsayılan 50) ve `before_seq` parametreleri ekle; §6'daki "tamamı"
  ifadesini düzelt.

### Ö5 — Yeniden bağlanma politikası koddan okunmamış (UX kararı S3 bunu ZORUNLU kılıyor)

- **Nerede:** sözleşmenin hiçbir yerinde yeniden bağlanma politikası tanımlı değil; §5 yalnızca
  "her yeniden bağlanmada" diyor.
- **Sorun:** `docs/03-ux.md:757-762` (S3): *"Sözleşme, o politikanın **gerçekte ne olduğunu koddan
  okuyup** yazmak zorundadır; varsayımla geçilemez"* ve gerekçesi olarak F-005'in bloklayıcısı
  gösteriliyor.
- **Gerçek politika (bu turda okundu):** `src/web/lib/useEventStream.ts:166-173` — özel bir
  yeniden deneme mantığı **yok**; tarayıcının yerleşik `EventSource` yeniden bağlanması kullanılıyor,
  `error` olayında yalnızca `readyState` → durum eşlemesi yapılıyor (`CONNECTING` → `reconnecting`,
  `CLOSED` → `disconnected`). Deneme sayacı, backoff, üst sınır ve "N denemeden sonra kalıcı hata"
  eşiği **yok**. Sunucu tarafında `retry:` alanı da yazılmıyor (`src/server/sse/hub.ts:10-17`
  yalnızca `event`/`id`/`data` yazıyor).
- **Neden sorun:** UX §7.5'teki "Yeniden bağlan" butonunun ne yapacağı tanımsız kalıyor —
  `POST /api/chat/restart` mi (oturumu yeniden başlatır, farklı şey), yoksa SSE'yi yeniden mi
  kurar? İkisi karıştırılırsa kullanıcı "bağlantı" derken oturumu öldürür.
- **Düzeltme:** yukarıdaki üç cümleyi sözleşmeye koy; "Yeniden bağlan" butonunun hangi uca/eyleme
  bağlandığını yaz; sohbete özel ikinci bir politika yazılmayacağını (S3) açıkça belirt.

### Ö6 — İzin/soru/alt-agent tel şekilleri tanımsız; UX kartları karşılıksız

- **Nerede:** §5 kanal listesi (satır 260-262), §6 `ChatLogEntry`, §4 `result` paragrafı.
- **Sorun:** `chat_permission_request`, `chat_tool`, `chat_permission_resolved` yüklerinin **alan
  şeması hiç yok** (yalnızca `chat_message` tanımlı). UX'in gerektirdikleri:
  - izin kartı: araç adı + komut/parametre önizlemesi (`docs/03-ux.md:329-333`);
  - `AskUserQuestion`: soru metni + **2-4 seçenek**, her biri başlık (kalın) + kısa açıklama
    (`:335-348`), seçim sonrası **kullanıcı balonu olarak akışa eklenir**;
  - alt agent satırı: agent adı + `description` (3-5 kelime, CEO kararı S1) + **geçen süre** +
    bitiş durumu (✓ yeşil / ✘ kırmızı) + kalıcı kalması (`:325-327`, `:735-746`).
  - `ChatLogEntry.kind` birleşiminde **soru** türü yok (`'text'|'tool'|'permission_request'|
    'permission_resolved'|'error'`), yani `AskUserQuestion` kalıcı geçmişte izin isteğinden
    ayırt edilemez.
- **Düzeltme:** dört kanal için de alan şeması yaz (kapalı allowlist, B7 ile birlikte);
  `kind`'a `'question'` ekle; seçilen cevabın `chat_user_echo` olarak akışa girme kuralını yaz.

### Ö7 — K4 statik çiti gerçek sızma yolunu kaçırıyor (mutasyon 8 fence dışına çıkınca kaçar)

- **Nerede:** §2.3 `no-context-injection.test.ts`, §11.2 mutasyon 8.
- **Sorun:** çit yalnızca `src/features/chat/**` **import'larını** tarıyor. Ama olay verisini
  sohbete taşımanın en doğal yolu import değil **enjeksiyon**: `src/server/index.ts` zaten
  `store`'u tutuyor (`index.ts:293`) ve sözleşme `createChatSession(deps)` imzasını enjekte
  edilebilir tanımlıyor (§2.1). `createChatSession({ query, store })` yazılırsa `chat/**` içinde
  hiçbir yasak import görünmez → mutasyon 8 **yeşil kalır**.
- **Ek sorun:** K4'ün konusu prompt **içeriğidir** (SPIKE-002 §6.3), import grafiği değil. Import
  çiti iyi bir birinci savunma hattı ama tek başına AC9'un ("sınır açık ve test edilmiş")
  kanıtı olamaz.
- **Düzeltme:** çite ikinci bir iddia ekle — `createChatSession`'ın kabul ettiği `deps` alan
  kümesi **kapalı** olarak assert edilsin (yalnızca `query`, `dataDir`, `hub`, `now` gibi); ve
  `index.ts`'in chat'e `store`/`projectsService` geçirmediğini ölçen bir çağrı-yeri assert'i
  konsun. Mutasyonu da buna göre değiştir (`index.ts`'te `store`'u geçir → KIRMIZI).

### Ö8 — "Alt süreç ebeveynle birlikte ölür" ✓ DOĞRULANDI diye yazılmış; kaynak ⊢ ÇIKARIM ve Windows'ta şüpheli

- **Nerede:** §3 "Ne zaman kapanır" (a) maddesi (satır 187-190).
- **Sorun:** sözleşme *"SDK alt süreç ebeveynle birlikte ölür, ✓ DOĞRULANDI SPIKE-002 §5.5"*
  diyor. Kaynak metin şöyle: *"**Panel kapanırsa:** SDK alt süreci de ölür **⊢ ÇIKARIM**"*
  (`SPIKE-002-paneli-ceo-istemcisi-yapmak.md`, §5.5). Kanıt seviyesi yükseltilmiş.
- **Neden sorun:** ADR-009 gereği platform Windows ve Windows'ta ebeveyn süreç ölünce çocuk
  **otomatik ölmez** (POSIX süreç grubu semantiği yok). `CLAUDE.md`'de bu deponun kendi dersi var:
  *"Uygulamayı çalıştıran agent turları arkada yetim `npm run dev` süreç ağaçları bırakıyor."*
  Yetim bir `claude.exe` kota harcamaya ve repo dosyalarını kilitlemeye devam eder.
- **Düzeltme:** iddiayı [T]'ye indir; `stopAll()`'un alt süreci **açıkça** sonlandırdığını (SDK'nın
  hangi API'siyle) yaz; kapanış sonrası yetim süreç kalmadığını ölçen bir kontrol (en azından elle,
  QA turunda) tanımla.

### Ö9 — SDK alt sürecinin stream `'error'` olayları hiçbir sınıra düşmüyor; süreçte `uncaughtException` ağı yok

- **Nerede:** §9 tamamı.
- **Sorun:** §9 iki yolu kapatıyor: senkron dağıtıcı sınırı + her handler'ın kendi `try/catch`'i +
  `for await` döngüsünün `try/catch`'i. Kapatmadığı yol: alt süreç stdio akışlarının **EventEmitter
  `'error'` olayları** (EPIPE, alt süreç ani ölümü). Bu olaylar `try/catch`'e düşmez; dinleyicisi
  yoksa Node bunu `uncaughtException`'a çevirir ve `src/server/index.ts:26-32`'de yalnızca
  **`unhandledRejection`** ağı var, `uncaughtException` ağı **yok** (tam dosya okundu).
- **Neden sorun:** `CLAUDE.md`'nin üç kez tekrarlayan sınıfı tam burada dördüncü kez tekrarlar:
  alt süreç ölür → panelin tamamı düşer → AC8 ihlal. Sözleşme §9 bu sınıfı tanıdığını söylüyor ama
  yeni bileşenin (alt süreç) kendine özgü hata yüzeyini hiç saymıyor.
- **Düzeltme:** §9'a üçüncü bir madde ekle (alt süreç/stdio hata olayları); mutasyon 7'yi
  genişlet ya da yeni bir fault-injection mutasyonu ekle: sahte `query` bir stream `'error'`
  olayı yayınlasın → `/api/health` 200 kalmalı, durum `crashed` olmalı.

### Ö10 — Canlı hook testi asama0'ın iki tuzağını devralmıyor; D4'ün istediği çevrimdışı çit eksik ölçüyor

- **Nerede:** §2.3 `chat-hooks-live.test.ts`, §8 madde 1-2, §11.3, §13 soru 4.
- **Sorun (üç parça):**
  1. **Yanlış negatif tuzağı devralınmamış.** `SPIKE-002-asama0-olcum.md:100-117`: `settings.json`
     `permissions.deny` **ayrı bir katman**; `rm -rf` ile yapılan ilk deneme hook no-op edilse bile
     reddedildi ve duyarlılık kanıtlanamadı. Ölçüm ancak `deny` listesiyle **örtüşmeyen** bir
     komut sınıfına (`drop table`) geçilince temizlendi. Sözleşme yalnızca *"block-dangerous.cjs'in
     yakaladığı zararsız bir işaretleyici komut"* diyor — aynı tuzağa düşmeye açık.
  2. **Ölçülen yapılandırma üretim yapılandırması değil.** Sözleşme ters yönü "sandbox'a kopyalanmış
     no-op hook" ile ölçüyor; ama üretimde `cwd` repo köküdür ve hook'lar `.claude/settings.json`'da
     **göreli** yolla kayıtlıdır (`node .claude/hooks/block-dangerous.cjs`). Sandbox `cwd`'siyle
     yapılan ölçüm, üretimdeki `cwd` çözümlemesini kanıtlamaz.
  3. **Çevrimdışı çit dar.** D4 çevrimdışı çitin `settingSources` + `cwd` + **hook yolları**nı
     ölçmesini istiyor. Mutasyon 3a yalnızca `path.join(cwd,'.claude','settings.json')`'ın var
     olduğunu doğruluyor; altı hook dosyasının o `cwd`'den çözülebildiğini ölçmüyor.
- **Düzeltme:** üç maddeyi de sözleşmeye yaz; çevrimdışı çite "settings.json'daki her hook
  komutunun işaret ettiği dosya `cwd`'den çözülüyor" assert'ini ekle (mevcut
  `.claude/hooks/_selftest.cjs` emsali var); canlı testin **repo kökü cwd'siyle** en az bir yön
  (engelleme) ölçtüğünü şart koş.

### Ö11 — Dosya sahipliği sessizce genişliyor

- **Nerede:** §2.4 tablosu.
- **Sorun:** feature notunun sahiplik cümlesi: *"`src/features/chat/**`, ilgili testler,
  `package.json` …, ve sohbet ucunun kaydı için `src/server/` içindeki dağıtıcı satırı"*
  (`docs/features/F-012-ceo-sohbet-arayuzu.md`, "Dosya sahipliği"). Sözleşme buna ek olarak
  `src/web/App.tsx`, `src/web/lib/useEventStream.ts`, `src/shared/types.ts` ekliyor; D1/D5 ve
  Ö1/B5 ile birlikte liste `tests/web/App.test.tsx`, `tests/e2e/shell.spec.ts`,
  `tests/web/App.interaction.test.tsx`, `tests/no-write-gate-bypass.test.ts` ile daha da büyüyor.
- **Neden sorun:** `CLAUDE.md`: *"Alt agent'lar çalışırken onların dosya sahipliğindeki dizinlere
  dokunma"* — sahiplik bu hattın eşgüdüm mekanizması. Sessiz genişleme QA'nın "cerrahi değişiklik"
  ölçütünü de ölçülemez kılar.
- **Düzeltme:** sözleşme, genişletilmiş sahiplik listesini **açık bir madde** olarak sunsun ve
  CEO'nun feature notunu güncellemesini istesin.

### Ö12 — `resolveEnvInt`'i `src/server/index.ts`'ten import etmek döngüsel bağımlılık kurar; kill-switch tipoda açık kalır

- **Nerede:** §3 "Sohbet devre dışıyken (K6)" (satır 205-208).
- **Sorun (iki parça):**
  1. `index.ts` chat handler'larını import edecek (§2.4a); chat modülü de `index.ts`'ten
     `resolveEnvInt`'i import ederse **döngü** oluşur. `index.ts` modül düzeyinde yan etki taşıyor
     (`process.on('unhandledRejection')` kaydı, `package.json` okuma, `main()` dalı —
     `index.ts:26-40`, `:468-471`), bu yüzden döngü zararsız değil. Mevcut hiçbir feature
     `index.ts`'ten import etmiyor (tümü `../../shared/types` kullanıyor).
  2. `resolveEnvInt(env,'MC_CHAT_ENABLED',1) !== 0` semantiği: geçersiz değer **sessizce
     varsayılana düşer** (`index.ts:83-90`). Yani `MC_CHAT_ENABLED=false` / `=off` / `=no`
     yazan bir kullanıcı için sohbet **açık** kalır. Kota harcayan bir özelliğin kill-switch'i
     tipoda güvenli tarafa düşmüyor.
- **Düzeltme:** çözücüyü paylaşılan bir modüle taşı ya da chat modülünde kendi 3 satırlık
  çözücüsünü yaz (Karpathy §2 açısından da daha temiz); "yalnızca `1` açar, tanınmayan değer
  kapatır + stderr uyarısı" semantiğini seç ve mutasyon 9'a bu vakayı ekle.

### Ö13 — `settingSources: ['project']`'in `CLAUDE.md`'yi ve `agent: "ceo"` personasını yüklediği kanıtlanmamış; `systemPrompt` hiç geçmiyor

- **Nerede:** §8 "Yükleme mekanizması", §3 `cwd` gerekçesi (satır 171-176).
- **Sorun:** sözleşme yanlış `cwd`'nin *"`.claude/` ve `CLAUDE.md`'nin sessizce yüklenmemesi"*
  demek olduğunu yazıyor, yani doğru `cwd` + `settingSources:['project']`'in bunları yüklediğini
  varsayıyor. Spike'ın `CLAUDE.md` satırındaki alıntı ise **`settingSources`'ı atlama** durumunu
  tarif ediyor: *"When you **omit** `settingSources`, `query()` reads the same filesystem settings
  as the Claude Code CLI: … CLAUDE.md files …"* (`SPIKE-002-paneli-ceo-istemcisi-yapmak.md:203`).
  `'project'` kaynağının aynı şeyi yaptığı ayrıca doğrulanmamış. Ayrıca `.claude/settings.json`
  `"agent": "ceo"` taşıyor ve sözleşme `systemPrompt` seçeneğinden hiç söz etmiyor.
- **Neden sorun:** feature'ın adı "panel **CEO oturumunu** barındırır". Sistem promptu ve persona
  yüklenmezse barındırılan şey CEO değil, jenerik bir asistan olur — ve bu **sessizce** olur
  (deponun en pahalı hata sınıfı). AC'lerin hiçbiri bunu ölçmüyor.
- **Düzeltme:** `systemPrompt`/persona/`CLAUDE.md` yükleme kararını açıkça yaz, kanıt seviyesini
  [T] işaretle ve QA turunda **elle** doğrulanacak bir kabul adımı koy (ör. barındırılan oturuma
  "CLAUDE.md'deki kurallardan birini söyle" sorulur).

---

## NOT bulguları

- **N1 — K1-K8'in kaynağı yanlış gösterilmiş.** §0, K1-K8'i
  `docs/features/F-012-ceo-sohbet-arayuzu.md`'nin içeriği gibi listeliyor; o dosyada K1-K8 **yok**
  (yalnızca "kararlar sözleşme turu başlamadan yazılacak" notu var). Kalıcı özet
  `docs/HANDOFF.md:31-36`'da. Kararların kalıcı bir yere (feature notu veya ADR-014 eki)
  yazılması istenmeli; brief kaybolduğunda K-numaraları çözümsüz kalır.
- **N2 — §4 zarf çelişkisi.** *"Tüm yanıtlar `ApiResponse<T>` zarfını kullanır"* deniyor, ama
  `/api/chat/status` satırı zarfsız (`200 { session_active, … }`), `/api/chat/history` satırı
  zarflı (`200 { data: { entries } }`). Birini seç.
- **N3 — `maxBudgetUsd` değeri yok.** §2.1/§2.3'te bir "sabit" olarak geçiyor ama sayısı
  yazılmamış; SPIKE-002 §6.2 madde 4 bunu somut bir üst sınır olarak istiyor. Mutasyon 3 de
  bu değeri ölçmüyor.
- **N4 — Bilinen sınırlama kaydedilmemiş.** SPIKE-002 §5.4 sınır 2: bekleyen bir onay sunucu
  yeniden başlarsa **kaybolur** ve tur ölür; *"v1 için gerekli değildir ama bilinen sınırlama
  olarak yazılmalıdır"*. Sözleşmede yok.
- **N5 — SSE callback referans kararlılığı.** `useEventStream`'in `EventSource` efekti
  `options.onProjects`/`onFeatures`'ı bağımlılık dizisinde tutuyor
  (`src/web/lib/useEventStream.ts:226`); bugün ikisi de kararlı `setState` fonksiyonu
  (`src/web/App.tsx:33-35`). Altı yeni chat callback'i kararsız (inline/her render yeniden
  üretilen) olursa bağlantı her render'da kapanıp açılır ve B1'in telafisi tetiklenerek
  `GET /api/chat/history` döngüsü doğar. Sözleşme bu kısıtı yazmalı.
- **N6 — `apiKeyHelper` env değil ayardır.** Kimlik önceliğinde 4. sırada
  (`SPIKE-002-…:94`); D2'nin env allowlist'i onu kapsamaz. `settingSources:['project']` ile
  yüklenen ayarlarda bir `apiKeyHelper` tanımlıysa bariyer delinir. Sözleşme en azından
  "bu ayarın yokluğu kontrol edilir/uyarılır" demeli.

---

## Karar

**KARAR: KALDI.** Gerekçe: yedi bloklayıcının dördü belgenin **öncüllerinin** yanlış olmasından
kaynaklanıyor (B1 var olmayan istemci kancası, B4 yazılmış sayılmayan ADR eki, B5 kod turunda
kesin kırılacak çit, B6 yazılmış sayılmayan UX belgesi). Üçü ise kabul kriterlerinin
çitlenmemesinden: B2 bariyerin kapsamı, B3 K3'ün fiilen delinmesi, B7 CEO'nun açıkça zorunlu
kıldığı mutasyonun yokluğu. Bu hâliyle kod turu başlarsa `verify` ilk koşuda kırmızı verecek
(B5 + Ö1) ve iki güvenlik iddiası (bariyer, otomatik onay yok) yeşil görünüp hiçbir şey
ölçmeyecek — bu deponun en pahalı hata sınıfı.

Belgenin güçlü yanları (bilerek kaydediliyor, düzeltme turunda korunmalı): §9'un asenkron hata
sınırı analizi ve `ingest.ts` emsaline dayanması doğru ve koda bakılarak doğrulandı; §0'ın
`x-mc-write`'ın dağıtıcıda otomatik kapsadığı tespiti doğru (`index.ts:333`); `id:` tuzağının
mekanizması doğru anlaşılmış (`hub.ts:3-9`); `deps.test.ts` etkisi önceden ve doğru
değerlendirilmiş; `jsonl-store.ts`'i yeniden kullanmama gerekçesi sağlam.

---

## Doğruladıklarım (koda/belgeye bakarak, bu turda)

| İddia | Sonuç | Kanıt |
|---|---|---|
| Dağıtıcı hata sınırı yalnızca **senkron** yakalıyor | ✓ doğru | `src/server/index.ts:147-174` (+ kendi yorumu `:132-146`) |
| `x-mc-write` tüm non-GET `/api/*`'ı otomatik kapsıyor | ✓ doğru | `src/server/index.ts:333-336` |
| `POST /api/events` istisnası içerik-tipi allowlist'i ile | ✓ doğru | `index.ts:325-332`, `ADR-013` eki |
| `hello`/`resync` çerçeveleri `id:` taşımıyor | ✓ doğru | `src/server/sse/stream.ts:70-83`, `hub.ts:10-17` |
| **`useEventStream` `hello` dinlemiyor** | ✓ doğrulandı (B1) | `src/web/lib/useEventStream.ts:203-212` |
| Yeniden bağlanma politikası = tarayıcı yerleşiği, sayaç/backoff yok | ✓ doğrulandı (Ö5) | `useEventStream.ts:166-173`; `hub.ts` `retry:` yazmıyor |
| `ingest.ts` async IIFE kendi `try/catch`'ini taşıyor | ✓ doğru | `src/features/events/server/ingest.ts:54-87` |
| Süreçte `unhandledRejection` var, **`uncaughtException` yok** | ✓ doğrulandı (Ö9) | `index.ts:26-32` (tam dosya tarandı) |
| `server.on('close')` deseni + `shutdown()` sırası | ✓ doğru | `index.ts:425-428`, `:441-448`, `hub.ts:24-30` |
| `no-write-gate-bypass` tüm `src/**`'ı tarıyor, muafiyet 4 dosya/tam-çağrı | ✓ doğrulandı (B5) | `tests/no-write-gate-bypass.test.ts:34-59`, `:76-113`, `:129`, `:140-162` |
| `no-external-host` ve guard'lar `src/features/**`'i özyinelemeli tarıyor | ✓ doğru | `tests/no-external-host.test.ts:28-33` |
| `deps.test.ts` kapalı paket listesi değil, install-script/native/sqlite guard'ı | ✓ doğru | `tests/deps.test.ts:16-66` |
| Tablist çitleri sabit sayı assert ediyor (üçüncü sekme kırar) | ✓ doğrulandı (Ö1) | `tests/web/App.test.tsx:48`; `tests/e2e/shell.spec.ts:45,59-60`; `tests/web/App.interaction.test.tsx:205-212` |
| `.claude/settings.json`'da 6 güvenlik hook'u + `send-event.cjs` | ✓ doğru | `.claude/settings.json` `hooks` bloğu |
| `.claude/settings.json`'da geniş `permissions.allow` listesi var | ✓ doğrulandı (B3) | `.claude/settings.json` `permissions.allow` |
| `canUseTool` otomatik onaylı araçlarda ateşlenmiyor | ✓ (spike kanıtı) | `SPIKE-002-…:386` (§5.4 sınır 3) |
| Kimlik önceliği: `USE_BEDROCK` > `AUTH_TOKEN` > `API_KEY` > `apiKeyHelper` | ✓ (spike kanıtı) | `SPIKE-002-…:90-97` |
| `ADR-005` F-012 eki **yazılmış** | ✓ doğrulandı (B4) | `docs/decisions/ADR-005-…md:59-116` |
| UX §7 (Sohbet) yazılmış + CEO kararları S1/S2/S3 | ✓ doğrulandı (B6/B7) | `docs/03-ux.md:225-379`, `:733-762` |
| "Alt süreç ebeveynle ölür" kaynağı ⊢ ÇIKARIM | ✓ doğrulandı (Ö8) | `SPIKE-002-…` §5.5 |
| M2'nin `permissions.deny` yanlış-negatif tuzağı | ✓ doğrulandı (Ö10) | `SPIKE-002-asama0-olcum.md:100-117` |
| M3 mesaj-seviyesi akış ölçtü; `stream_event` hiç geçmiyor | ✓ doğrulandı (Ö2) | `SPIKE-002-asama0-olcum.md:204-236`; `docs/` genelinde grep boş |
| ADR-004 karar 5'in gerekçesi "anlık görüntü" kanallarına özgü | ✓ doğru | `docs/decisions/ADR-004-…md:27` |

## Doğrulayamadıklarım

1. **`@anthropic-ai/claude-agent-sdk@0.3.261` sürümü ve peer bağımlılık listesi**
   (`zod@^4`, `@anthropic-ai/sdk@>=0.93.0`, `@modelcontextprotocol/sdk@^1.29.0`) — kurulum ve ağ
   erişimi görev kısıtıyla yasak. Sözleşmenin `npm view` iddiası bu turda tekrar edilmedi.
   Kod turunda `package-lock.json` üretildikten sonra **dist/registry kaynağından** doğrulanmalı.
2. **`hasInstallScript` durumu** (§2.5'te [T] işaretli) — sözleşme de doğrulamamış; aynen açık.
3. **SDK'nın gerçek seçenek yüzeyi:** `settingSources:['project']`'in `CLAUDE.md`/`agent` ayarını
   yükleyip yüklemediği, `includePartialMessages`/`stream_event` varlığı, `interrupt()` semantiği,
   alt süreç sonlandırma API'si — hiçbiri kurulu paketten okunmadı (kurulum yok).
4. **Canlı davranış:** hiçbir SDK oturumu açılmadı (kota kısıtı); M1/M2/M3'e ait iddialar
   asama0 raporuna dayanılarak kabul edildi, yeniden ölçülmedi.
5. **Uygulamanın çalışan hâli:** sunucu başlatılmadı, Playwright koşulmadı — bu tur belge
   denetimidir, davranışsal hiçbir iddia test edilmedi.
6. **Windows'ta ebeveyn ölünce `claude.exe`'nin akıbeti** (Ö8) — ölçüm gerektirir, bu turda
   yapılamadı; kod/QA turunda ölçülmeli.
