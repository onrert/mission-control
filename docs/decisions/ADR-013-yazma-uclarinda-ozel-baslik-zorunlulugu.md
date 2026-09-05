# ADR-013 — Yazma uçlarında özel başlık zorunluluğu

- **Tarih:** 2026-09-05
- **Durum:** Kabul edildi
- **Karar veren:** Kullanıcı (Veron), CEO sorusu üzerine. F-006 sözleşmesi **başlamadan önce** soruldu —
  F-005'te karar turun sonunda verildiği için gövdeye hiç yayılmamıştı (`CLAUDE.md` öğrenilen kural).
- **Kapatılan borç:** `ADR-008` "Ek — R-1" bölümündeki artık risk. Orada "F-006 bu kararı yeniden
  değerlendirmek ZORUNDADIR" yazılmıştı; bu ADR o zorunluluğu yerine getirir.

## Bağlam

`ADR-008` ekiyle Host/Origin kontrolünde **port bileşeni yok sayıldı**: yalnızca ana bilgisayar adı
(`127.0.0.1`, `localhost`, `::1`) beyaz listelendi. Gerekçe sağlamdı — uzak bir sitenin DNS-rebinding
saldırısı `Host: evil.com` ile gelir ve ana bilgisayar adı kontrolü onu zaten keser; portu ayrıca
doğrulamak, portu bilen bir saldırgana karşı koruma eklemezdi. Ayrıca porta bağlamak efemeral
portlu testleri ve Vite proxy'sini kırıyordu.

Kabul edilen artık risk şuydu: **aynı makinede çalışan başka bir yerel sayfa** (ör. kullanıcının
geliştirdiği bir projenin `http://localhost:3000`'deki dev sunucusu, ya da oraya sızmış üçüncü taraf
bir script) panele istek atabilir.

F-002'de bunun etkisi sınırlıydı: yalnızca panelin kendi olay kaydı kirlenirdi. **F-006 tehdit
modelini değiştiriyor** — yazma kapısı sunucuya *kullanıcı adına diske* yazdırıyor: izlenen projelerin
kanban durumları ve **kapı onay dosyaları** (`docs/approvals/<G>.ok`). Kötü niyetli bir yerel sayfa
teorik olarak bir kapıyı onaylayabilirdi.

## Karar

**Tüm yazma uçları (`/api/*` üzerinde non-GET) özel bir istek başlığı taşımak zorundadır.**
Başlık yoksa veya değeri beklenenden farklıysa istek reddedilir. Bu, mevcut Host/Origin
kontrolüne **ek** bir katmandır; onun yerine geçmez.

Gerekçe: tarayıcılar çapraz kaynaklı bir isteğe özel başlık ekleyemez — böyle bir istek CORS
preflight (`OPTIONS`) gerektirir ve panel preflight'ı kabul etmez. Dolayısıyla **başka hiçbir sayfa
(yerel veya uzak) yazma isteği gönderemez**; yalnızca panelin kendi arayüzü, kendi kaynağından
`fetch` yaparken başlığı ekleyebilir.

Reddedilen alternatifler:
- **Tam kaynak (origin) eşleştirmesi:** aynı korumayı sağlar ama geliştirme modunda iki ayrı kaynağın
  (üretim `7333`, Vite `7334`) beyaz listelenmesini gerektirir — ADR-008'de porttan tam bu yüzden
  vazgeçilmişti. Daha karmaşık, ek kazanç yok.
- **Token (sunucu açılışta üretir, sayfaya gömer):** en sıkı seçenek ama en çok tesisat — üretim,
  enjeksiyon, istemci tarafında saklama, yenileme. Yerel, tek kullanıcılı bir araç için orantısız
  (Karpathy §2).
- **Olduğu gibi bırakmak:** F-006 tam da güvenlik sınırı feature'ı; kabul edilmedi.

## Sonuçlar
- Sunucu tarafında kontrol **tek bir yerde** (dağıtıcı seviyesinde) uygulanmalı ki yeni bir yazma ucu
  eklendiğinde korumasız kalmasın — F-003'te `/api/stream`'in Host korumasından muaf kalması ve
  QA mutasyonunun 314/314 yeşil bırakması bu sınıfın emsalidir.
- İstemci tarafında başlığı ekleyen tek bir sarmalayıcı olmalı; her `fetch` çağrısına elle eklenmemeli.
- **Çitlenme zorunlu:** başlıksız bir yazma isteğinin reddedildiğini ölçen test + kontrolü kaldıran
  mutasyonun KIRMIZI vermesi. F-005'in dersi: korumayı kurmak yetmiyor, **bağlandığını** kanıtlamak
  gerekiyor (dağıtıcı hata sınırı silinince 430/430 yeşil kalmıştı).
- `ADR-008`'in artık riski bu ADR ile **kapanmıştır**; ADR-008'in "F-006 yeniden değerlendirmeli"
  maddesi yerine getirildi.

## Ek — `POST /api/events` istisnası (2026-09-05, F-006 sözleşme turu)

"Tüm yazma uçları" ifadesinin **tek istisnası** `POST /api/events`'tir. Gerekçe ve karşılığında
konan koruma:

**Neden muaf:** bu uca yazan istemci `send-event.cjs` hook'udur, bir tarayıcı değildir — CSRF
tehdidi taşımaz. Ve muafiyeti kaldırmanın gizli bir bedeli var: **izlenen projelere zaten kurulmuş
hook kopyaları sessizce kırılırdı.** Script tasarım gereği sessizce başarısız oluyor (ADR-006), yani
olay akışı durur ve kimse fark etmez — bu projenin en pahalı hata sınıfı.

**Karşılığında konan koruma:** bu uçta `Content-Type` **allowlist**'i uygulanır — yalnızca
`application/json` kabul edilir, başlık **yoksa da reddedilir**. Karşılaştırma `;` öncesi alınıp
küçük harfe çevrilerek yapılır (`application/json; charset=utf-8` kabul edilir).

Bu, `x-mc-write` ile **eşdeğer** korumadır: `application/json` CORS'un güvenli listesinde değildir,
dolayısıyla bu içerik tipini taşıyan çapraz kaynaklı bir tarayıcı isteği preflight gerektirir ve
panel preflight'ı kabul etmez. Preflight'tan kaçmak isteyen bir sayfa güvenli listedeki bir tip
(`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`) kullanmak zorundadır —
üçü de reddedilir. Başlıksız istek (tipsiz `Blob` ile `sendBeacon`) da reddedilir.

Doğrulandı: hook tam olarak `application/json` gönderiyor (`.claude/hooks/send-event.cjs:153`,
küçük harf, `charset` eki yok), yani kurulu kopyalar kırılmaz.

**Not:** allowlist zorunludur, denylist değil. QA ölçtü: denylist yazılsaydı `multipart/form-data`
geçer ve gövde JSON olmasa bile `parse_error` işaretiyle kaydedilirdi.
