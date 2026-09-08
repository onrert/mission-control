# ADR-014 — Paneli CEO oturumunun arayüzü yapmak (Agent SDK ile barındırma)

- **Tarih:** 2026-09-06
- **Durum:** Kabul edildi
- **Karar veren:** Kullanıcı (Veron). İki spike ve bir ölçüm turundan sonra, CEO sorusu üzerine.
- **Etkilediği belgeler:** `docs/00-idea.md` ("Kesinlikle olmayacaklar" listesi değişti),
  `docs/specs/mission-control.md` (v2 bölümü yeniden yazıldı).
- **Dayanak:** `docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md`,
  `docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md`,
  `docs/spikes/SPIKE-002-asama0-olcum.md`.

## Bağlam

Faz 1 bitti (7 feature, 732 birim + 23 E2E testi). Kullanıcı paneli denedi ve şunu söyledi:

> "Aşamalara feature kartları görünüyor fakat benim herhangi bir karışabileceğim bir yer yok."

Beklentisi baştan beri farklıydı: panelde CEO ile konuşmak — yeni bir uygulama istemek, soru
sormak, geri dönüş almak. Kendi cümlesiyle:

> "Burada yaptığımız konuşmayı direkt Mission Control üzerinden yapmak istiyorum. Herhangi bir
> gecikme olmadan, başka bir yere yüklenmeden. Subagent'lar veya agent'lar çalışırken seninle
> oradan konuşmak istiyorum, buradaki gibi."

Panel bugüne kadar **salt-izleyici**ydi ve `docs/00-idea.md` "Claude Code'a komut gönderme yok"
diyordu. Bu ADR o kısıtı kaldırır.

## İncelenen ve reddedilen yol: Claude Code Channels

İlk araştırma (SPIKE-001) resmî **Channels** özelliğini buldu: dışarıdan çalışan bir oturuma
mesaj enjekte etmeyi sağlıyor. Reddedildi, dört sebeple:

1. **Oturum `--channels` bayrağıyla başlatılmak zorunda.** ✓ DOĞRULANDI — ne
   `.claude/settings.json`'da, ne `~/.claude.json`'da, ne SDK tip tanımlarında kanal ayarı var.
   Kullanıcı masaüstü uygulamasında çalışıyor ve oraya bayrak geçiremiyor; bu yol onu terminale
   taşınmaya zorlardı.
2. **Kanal yüklenmemişse mesaj hatasız, sessizce kayboluyor.** Bu deponun en pahalı hata sınıfı
   tam olarak budur (`CLAUDE.md`: hook'lar iki feature boyunca sessizce ölü koştu).
3. **Araştırma önizlemesi** (research preview) — kırılganlık riski.
4. **En önemlisi: istenen şey bu değildi.** Kullanıcı mesaj enjeksiyonu değil, sohbetin panelde
   geçmesini istiyor. Channels sohbeti taşımaz, yalnızca tek yönlü dürtme sağlar.

Yan ürün olarak SPIKE-001 §7'de bir ölçüm yapıldı ve bir varsayım çürütüldü: CEO oturumu zamanın
**%87.5'inde boşta** (31 saatlik gerçek kayıt, 341 araç çağrısı; en uzun kesintisiz meşgul pencere
12.4 dakika). Sebep mimari değil çalışma düzeni — alt agent'lar arka planda başlatılıyor. Yani
"agent çalışırken konuşabilme" gereksinimi **zaten karşılanıyordu**; taşıma yolu sorunu değildi.

## Karar

**Mission Control, CEO oturumunu `@anthropic-ai/claude-agent-sdk` ile kendi sunucusunda
barındırır ve panel o oturumun sohbet arayüzü olur.**

Panel artık "izleyen pencere" değil, **hattın kendisini çalıştıran uygulama**dır.

## Ölçülen kanıt (Aşama 0, `SPIKE-002-asama0-olcum.md`)

Tam işe girmeden önce üç şey ölçüldü; hiçbiri belgeye güvenilerek geçilmedi.

| # | Soru | Sonuç |
|---|---|---|
| M1 | Abonelikle mi çalışıyor, para mı harcıyor? | **GEÇTİ** — abonelik OAuth yolu; ortamda `ANTHROPIC_API_KEY` yok |
| M2 | Güvenlik hook'ları SDK oturumunda gerçekten **engelliyor** mu? | **GEÇTİ** — iki yönlü kanıtlandı |
| M3 | Alt agent'lar + arka plan + canlı akış | **GEÇTİ** — alt agent uçarken ana oturum ikinci mesaja cevap verdi |

**M2 neden iki yönlü olmak zorundaydı:** "hook yükleniyor" ile "hook durduruyor" aynı şey değil.
`CLAUDE.md`'deki en pahalı ders bu: hook'lar `.js` uzantısı yüzünden çıkış kodu 1 döndürüyordu,
Claude Code yalnızca **çıkış kodu 2**'yi engelleme sayıyor, ve altı kapı iki feature boyunca ölü
koştu. Bu yüzden ölçüm hem "hook aktifken engellendi" (çıkış kodu 2) hem de "hook no-op yapılınca
aynı komut geçti" yönünü gösterdi. Tek yön hiçbir şey kanıtlamazdı — eylem başka bir sebepten de
başarısız olmuş olabilirdi.

## Kabul edilen riskler

1. **Politika grisi (ölçülemez).** Anthropic dokümanında "üçüncü taraf geliştiricilerin
   ürünlerinde claude.ai girişi sunmasına izin verilmez" notu var. Bu, **dağıtılan** ürünleri
   tarif ediyor; tek kullanıcılı yerel bir araç kapsam dışı **görünüyor** — ama bu bizim
   yorumumuz, Anthropic onayı değil. Kullanıcıya açıkça söylendi ve **bilinçli olarak kabul
   edildi**. Bu araç dağıtılmayacak; dağıtım gündeme gelirse bu ADR yeniden açılır.
2. **Eş oturum görünürlüğü (bilinen sınırlama, düzeltilemez).** `ListAgents` aracı, izole `cwd`'li
   bir sanal alandan bile bu makinedeki **ilgisiz başka projelerin** aktif Claude Code oturum
   adlarını listeliyor ✓ DOĞRULANDI. Bizim kodumuzun kusuru değil, Claude Code'un davranışı —
   kapatamayız. Kaydedildi; tek kullanıcılı yerel araçta etkisi kabul edilebilir bulundu.
3. **`ANTHROPIC_API_KEY` sessizce devralır ve gerçek para yakar.** Ortamda varsa SDK onu tercih
   eder. **Bariyer zorunlu** ve çitlenmeli (aşağıya bak).
4. **Geçmiş yazma amplifikasyonu ve sınırsız bellek (bilinen sınırlama, F-012 QA tur 2 Ö6,
   koşullu kabul).** `session.ts` her `content_block_delta`'da BİRİKMİŞ metnin TAMAMINI
   `historyLog.append` ile yeni bir satır olarak yazıyor (O(delta_sayısı × metin_uzunluğu)).
   **Ölçüldü** (`docs/qa/F-012-2026-09-06-tur2.md` §3): tek bir 6.000 karakterlik CEO cevabı
   (20 karakterlik 300 delta) → `history.jsonl`'de **302 satır / 956.300 bayt** (**~159×**
   amplifikasyon). İkinci, daha önce belgelenmemiş kat: `history-log.ts`'in `entries` dizisi
   **tüm** girdileri bellekte tutuyor ve **hiçbir üst sınırı yok** (`jsonl-store.ts`'in ring
   buffer emsalinin aksine); `init()` dosyanın tamamını `readFileSync` ile belleğe alıyor;
   `readPage()` her çağrıda tüm diziyi katlıyor. Ekstrapolasyon (ölçülmedi, tahmin): 100
   cevaplık bir gün ≈ 95 MB dosya + 95 MB bellek + her geçmiş isteğinde ~30.000 girdilik katlama
   + her sunucu açılışında ~95 MB senkron okuma. **Kabul koşulu:** yazma sıklığını kısıtlamak
   (`markDanglingAsInterrupted`'ın restart-sonrası davranışını etkileyebilir, bir dayanıklılık
   tasarım kararı) tek bir turda aceleyle yapılmayacak. **Yeniden ele alınma eşiği:** gerçek
   kullanımda tek bir günlük `history.jsonl` **10 MB**'ı aşarsa veya sunucu açılış gecikmesi
   gözle görülür hâle gelirse (mevcut sentetik ölçüm dışında ilk gerçek belirti), bu bir sonraki
   feature'da (yazma sıklığı sınırlama + `entries` için ring buffer) ele alınmalı;
   `docs/blockers.md`'ye de bir sonraki feature için açık madde olarak yazıldı.
5. **Araç/agent durum satırları sayfa yenilemesinde ekrandan kaybolur (F-012 QA tur 3 Ö7,
   koşullu kabul — `docs/qa/F-012-2026-09-06-tur3.md` §6).** `docs/03-ux.md:327` şunu şart
   koşuyor: alt agent durum satırı "kalıcı kalır (silinmez) — kullanıcı geçmişe döndüğünde
   hangi agent'ın ne zaman çalıştığını görebilir." Gerçek davranış bunu karşılamıyor: istemci
   `kind:'tool'` girdilerini sayfa yenilemesi sonrası **render etmiyor** (yalnızca `kind:'text'`/
   `'error'` transkriptte geri geliyor). **Kaybolan tam olarak şu:** `✓ Bash tamamlandı (…)` gibi
   araç/agent özet satırları. **Veri kaybolmuyor** — `history.jsonl`'e `kind:'tool'` olarak
   yazılıyor ve diskte duruyor, yalnızca istemcinin `history-log.ts`/`useChatSession.ts` yeniden
   çizim yolu bunları atlıyor. **Bloklayıcı değil** kabul edildi (QA gerekçesi): oturum durumu
   bozulmuyor, kullanıcı akışında kilitlenme veya sessiz yarı-başarı üretmiyor, yalnızca **geçmiş
   bir olayın izini** gizliyor (Y1'in aksine karar bekleyen bir durumu gizlemiyor). **Yeniden ele
   alınma eşiği:** bir sonraki sohbet ekranı feature'ında (ör. Thread/derin detay ekranı, F-010,
   ya da `history-log.ts`'in `kind:'tool'` girdilerini de fold edip render etmesi) ele alınmalı;
   o zamana kadar `docs/03-ux.md:327`'nin "kalıcı kalır" ifadesi ile gerçek davranış arasında
   bilinen bir sapma vardır. Ayrıca `docs/blockers.md`'ye açık madde olarak yazıldı.

## Sonuçlar (uygulamayı bağlayan kurallar)

- **Ücretli anahtar bariyeri:** oturum başlatılmadan önce ortam denetlenir; `ANTHROPIC_API_KEY`
  varsa alt süreç ortamından temizlenir **veya** oturum açılmaz ve kullanıcıya görünür hata
  verilir — sessiz devralma YASAK. **Mutasyonla çitlenecek:** bariyeri kaldıran mutasyon KIRMIZI
  vermeli. `docs/00-idea.md`'nin "ücretli API yok" kısıtı bu bariyerle korunur.
- **Hook kapıları çitlenecek:** altı güvenlik hook'unun barındırılan oturumda da **engellediği**
  otomatik testle kanıtlanmalı; "yükleniyor" testi kabul edilmez (M2'nin gerekçesi).
- **Yazma ucu dağıtıcıdan geçer:** yeni sohbet ucu `ADR-013`'ün `x-mc-write` kuralına otomatik
  tabidir; muafiyet YOK. Panele serbest metin vermek, panele dolaylı olarak CEO'nun tüm yetkisini
  vermek demektir — CSRF savunması burada `POST /api/events`'ten daha kritiktir.
- **Prompt injection sınırı:** olay akışında izlenen projelerin hook verileri var. Bu veriler
  CEO'nun bağlamına **doğrudan talimat olarak** girmemeli; sınır açıkça tasarlanmalı.
- **Hata sınırı:** `CLAUDE.md`'nin üç kez tekrarlayan dersi — yazma yolundaki yakalanmamış hata
  tüm sunucuyu öldürüyor. Barındırılan oturum uzun ömürlü ve asenkron; her asenkron handler kendi
  `try/catch`'ini taşımalı (dağıtıcının senkron sınırı yetmez).
- **Geri dönüş yolu:** iş yarıda kalırsa panel bugünkü salt-izleyici hâline temiz dönebilmeli;
  sohbet özelliği mevcut ekranların hiçbirini bozmamalı.
- **`ListAgents` bulgusu** ayrıca `docs/wiki`'ye taşınmalı (çok-projeli hafıza).

## Reddedilen alternatifler

- **Channels ile mesaj enjeksiyonu** — yukarıda dört sebeple.
- **Dosya tabanlı gelen kutusu** (panel dosyaya yazar, CEO tur başında okur) — hiçbir bayrak
  gerektirmez ama CEO boştayken mesajı görmez; kullanıcının uyandırmak için başka bir arayüze
  yazması gerekirdi. Sohbet hissi vermez, istenen şeyi karşılamaz.
- **Dar yetkili ayrı oturum** (SPIKE-002 seçenek B) — maliyetin %70'i, değerin %40'ı.
- **Hiç yapmama** — Faz 2 planlandığı gibi sürerdi, ama kullanıcının panelden beklediği asıl şey
  hiç gelmezdi.

## Ek — İki koruma mekanizmasının sırası (2026-09-06, F-012 düzeltme turu 2)

F-012'nin canlı testlerini determinize etme çabası bir mimari ayrıntıyı ortaya çıkardı. Kayda
geçiyor çünkü **hangi testin neyi ölçtüğünü** belirliyor.

**Bulgu (`sdk.d.ts:4853`, ✓ DOĞRULANDI):** `PreToolUse` hook'u modelin **önerdiği ham
`tool_input`** üzerinde çalışır ve kararını `canUseTool` çağrılmadan **ÖNCE** verir.
`canUseTool`'un döndürdüğü `updatedInput`, hook'un gördüğü girdiyi geriye dönük değiştirmez;
yalnızca hook **ve** izin geçtikten sonra fiilen çalışacak komutu değiştirir.

**K3 garantisi DEĞİŞMEDİ.** Panelin iki koruması **bağımsız** iki mekanizmadır ve ikisi de ayrı
ayrı canlı doğrulandı:

1. **Hook zinciri** (`.claude/hooks/*.cjs`) — yıkıcı komut, uzak depoya gönderme, kapı onayı.
   Önce çalışır. İki yönlü kanıt: `SPIKE-002-asama0-olcum.md` M2 ve
   `tests/integration/chat-hooks-live.test.ts`.
2. **İzin sorusu** (`canUseTool` + `managedSettings.permissions.ask`) — kullanıcıya çıkar.
   İki yönlü kanıt: `docs/qa/F-012-2026-09-06-tur2.md` (QA'nın bağımsız probe'u: çit varken
   `git log` soruldu ve reddedilince çıktı hiç üretilmedi; çit yokken aynı komut sorulmadan
   çalıştı).

Yani bir komutun kullanıcıya ulaşmadan çalışması için **ikisinin birden** delinmesi gerekir.

**Pratik sonucu — test yazarken:** hook'un engellediği bir komut `canUseTool`'a **hiç ulaşmaz**.
Bu yüzden "izin kartı çıktı mı" testi, hook'un zaten reddettiği bir komutla yazılamaz; iki
mekanizma **ayrı ayrı** test edilmek zorundadır. F-012'de canlı testin beş denemede kararsız
kalmasının sebebi buydu — assert yanlış katmanı ölçüyordu.

### Ek — `Write` de izin kartına uğruyor (ölçüldü, 2026-09-09)

F-008'in sözleşme denetimi, barındırılan CEO oturumunun kapı onayı dosyasını **izin kartı
çıkmadan** yazabileceği bir zincir buldu ve bunu bloklayıcı olarak işaretledi. Zincir mantıklıydı:
`ceo.md` araçlarında `Write` var · `gate-check.cjs`'in `free` listesi `docs/` altını serbest
bırakıyor · `.claude/settings.json` `permissions.allow` içinde `Write(docs/**)` var ·
`settingSources:['project']` o listeyi yüklüyor · `permissions.ask` yalnızca `['Bash']`.

**Ölçüldü ve zincir gerçekte kopuyor: `Write` HER ZAMAN `canUseTool`'a uğruyor.**
✓ DOĞRULANDI — iki yönlü canlı probe, gerçek SDK `query()`, sandbox çalışma dizini
(`docs/qa/F-008-write-izin-olcumu.md`):
- `allowManagedPermissionRulesOnly: true` (mevcut yapılandırma) → kart tetiklendi, reddedildi,
  sandbox `docs/` **boş kaldı**.
- `allowManagedPermissionRulesOnly: false` (kontrol) → **birebir aynı**; kart yine tetiklendi.

**Bayrağın gerçek kapsamı:** `Write` vektöründe hiçbir gözlemlenebilir fark yaratmıyor. Bu,
F-012'nin `Bash` ölçümüyle **çelişmiyor**: orada bayrak, `Bash`'e özgü dahili "salt-okunur komut"
kısa devresini kapatıyordu. `Write`'ın böyle bir kısa devresi yok — zaten her koşulda karta düşüyor.

**Neden kayda geçiyor:** aynı zincir gelecekte yeniden türetilip "delik" sanılabilir. Statik
okumayla çıkarılan izin zinciri, SDK'nın çalışma zamanı davranışını **yanlış tahmin etti** —
bu, bu deponun kuralının tersten kanıtı: mekanizmayı okumak yetmez, **ölçmek** gerekir.
`session.ts:495-497`'deki yorum yanlış değil ama **eksik**: yalnızca `Read`/`Grep`/`Glob`/
`WebSearch` hakkında konuşuyor, `Write` hakkında hiçbir iddiada bulunmuyor. Bu ölçüm o boşluğu
doldurur.

**Sınır — abartılmasın:** bu, kabuk erişimi olan yerel bir agent'a karşı savunmanın **mutlak**
olduğu anlamına gelmez. Anlamı şudur: kapı onayı dosyasını yazan her yol, kullanıcının gördüğü
**izin kartından** geçer. Asıl koruma odur.
