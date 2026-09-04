# ADR-008 — F-002 kapsam kararları: Host/Origin koruması ve dosya rotasyonu

- **Tarih:** 2026-09-04
- **Durum:** Kabul edildi
- **Karar veren:** CEO (PROCESS §3 — "sorma, kendin karar ver" sınıfı; kullanıcıya eskale edilmedi)
- **Bağlam:** `docs/qa/F-002-contract.md` §9, developer'ın CEO'ya yönelttiği iki soru.

## Karar 1 — Host/Origin koruması F-002'DE yazılır (ertelenmez)

Developer, DNS-rebinding/CSRF korumasının F-002 kapsamı dışında olduğunu ve düşük şiddetli
olduğu için ertelenmesini önerdi. **Reddedildi.**

Gerekçe:
- `docs/qa/F-001-contract.md` satır 39-41 bunu yazılı bir taahhüt olarak kaydetmiştir:
  "Host/Origin kontrolü ilk yazma ucuyla birlikte **F-002**'de eklenecek. Bu bilinçli bir
  erteleme." `POST /api/events` projenin **ilk yazma ucudur**; taahhüdün koşulu tam olarak
  şimdi gerçekleşti. İkinci kez ertelemek, kapanış tarihi olmayan bir güvenlik borcu üretir.
- Şiddet değerlendirmesi F-002 ile sınırlı bakınca doğru ama miyop: aynı sunucu süreci
  F-006'da **yazma kapısını** (kanban frontmatter, kapı `.ok`/`.deny.md` dosyaları) açacak.
  Koruma o gün eklenirse, F-002…F-005 boyunca korumasız koşan bir sunucu bırakılmış olur ve
  koruma en riskli anda ilk kez devreye girer. Sunucunun güvenlik sınırı, en zayıf ucun değil
  ilk yazma ucunun geldiği gün kurulur (mimari §10, ADR-005 ile aynı ilke).
- Maliyet küçük: gelen istekte `Host` başlığı loopback değilse ve/veya `Origin` başlığı
  kendi kaynağımız dışındaysa reddet. Onlarca satır kod + iki test. Karpathy §2 ("ileride
  lazım olur kodu yok") ihlali değildir — bu spekülatif özellik değil, şu an açılan bir
  uca ait erişim kontrolüdür.

Kapsam (minimum, genişletme yok): loopback `Host` beyaz listesi + cross-origin `Origin`
reddi. Kimlik doğrulama, token, CORS preflight ince ayarı bu ADR'nin dışındadır.

## Karar 2 — 50 MB gün dosyası rotasyonu ERTELENİR

Mimari §5.5 `YYYY-MM-DD.1.jsonl` rotasyonundan söz ediyor. F-002'de **yazılmayacak.**

Gerekçe:
- Hiçbir kabul kriteri bunu istemiyor; test edilmeyen kod eklemek Karpathy §2 ihlalidir.
- Retention tavanı zaten `MC_RETENTION_EVENTS` (varsayılan 20.000) olay. Gerçekçi olay
  boyutuyla bir gün dosyasının 50 MB'a ulaşması retention tavanından önce mümkün değil;
  yani rotasyon bugün ölü koddur.
- Koşul: depo katmanı, ileride rotasyon eklenirse **çağıran tarafı değiştirmeyecek** şekilde
  dosya adını tek bir yerden üretmelidir. Soyutlama katmanı istemiyoruz, tek fonksiyon yeterli.

Yeniden açılma tetikleyicisi: `MC_RETENTION_EVENTS` 20.000'in belirgin üstüne çıkarılırsa
veya bir gün dosyası pratikte 50 MB'ı aşarsa.

## Sonuçlar
- F-002 sözleşmesi §1/§2/§3/§5/§7'de Karar 1'i kapsayacak şekilde güncellenmeli; Host/Origin
  için en az bir kabul kriteri ve bir mutasyon adımı eklenmeli.
- Karar 2 `docs/features/F-002-olay-alma-jsonl-depo.md` kapsam-dışı listesine yazılmalı.

## Ek — 2026-09-04: Karar 1'in uygulama kuralı (R-1 regresyonu üzerine)

Sözleşme tur 2'de Host beyaz listesi `createServer`'a verilen porta bağlanmış, bu da efemeral
port (`createServer(0)`) kullanan tüm testleri 403'e düşürmüştü (QA tur 2, bulgu R-1).

**Karar:** Host ve Origin kontrolünde **port bileşeni yok sayılır**; yalnızca ana bilgisayar
adı (`127.0.0.1`, `localhost`, `::1`) beyaz listelenir. Gerekçe: DNS-rebinding/CSRF tehdidi
ana bilgisayar adına dayanır (`Host: evil.com`); portu doğrulamak, portu zaten bilen bir
saldırgana karşı koruma eklemez. Ayrıntı ve test tablosu: `docs/qa/F-002-contract.md`
"CEO kararı — R-1".

**Yan etki:** ADR'nin ilk hâlinde öngörülmeyen `webPort` özel durumu (R9) gereksizleşti.

**Kabul edilen artık risk:** başka bir yerel sayfa panele olay POST edebilir. F-002'de etkisi
sınırlı (yalnızca panelin kendi olay kaydı). **F-006 (yazma kapısı) bu kararı yeniden
değerlendirmek zorundadır** — orada sunucu kullanıcı adına diske yazacak.
