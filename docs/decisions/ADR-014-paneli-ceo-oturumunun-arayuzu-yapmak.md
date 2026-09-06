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
