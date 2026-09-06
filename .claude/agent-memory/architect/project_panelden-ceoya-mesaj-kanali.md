---
name: panelden-ceoya-mesaj-kanali
description: SPIKE-001 bulgusu — "Claude Code Channels" gerçek ve resmî bir özellik; panelden CEO oturumuna sıra enjekte etmenin tek yolu, ama research preview ve G0 kısıtını gevşetiyor
metadata:
  type: project
---

Mission Control'ün spec'inde v2 olarak duran "panodan CEO'ya mesaj" özelliği **teknik olarak
mümkün**: Claude Code **Channels** gerçek, resmî bir özellik (<https://code.claude.com/docs/en/channels>,
research preview). Çalışan bir oturuma dışarıdan sıra enjekte edebilen **tek** mekanizma budur —
sıradan MCP sunucusu çekme (pull) modelidir ve bunu yapmaz; `claude -p`/`--resume` yeni süreç açar.

Ölçüm sonucu (2026-09-06, `docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md`):
- Gecikme: CEO boştaysa anında; meşgulse **bir sonraki turda**. Alt agent (`Task`) turu sırasında
  on dakikalar bekleyebilir — **bu sayı henüz ölçülmedi** ve özelliğin ürün değerini belirliyor.
- Kendi kanalımız Anthropic onay listesinde olmadığı için CEO oturumu her açılışta
  `--dangerously-load-development-channels` + tam ekran uyarı istiyor. Kalıcı sürtünme.
- Kanal, teslim onayı vermiyor: oturum kanalı yüklememişse olaylar **sessizce düşüyor** — bu
  deponun en pahalı hata sınıfı (ölü hook'lar emsali).
- Kurulu Claude Code 2.1.205; güncel 2.1.261. İzin isteği sıkılaştırması 2.1.234'te gelmiş, yani
  kurulu sürüm bu konuda geride.

**Why:** Kullanıcı özelliği öne çekmeyi düşünüyordu ama önce ölçmek istedi; `docs/00-idea.md:16`
G0'da "Claude Code'a komut gönderme yok (v2'de Channels ile ayrı ele alınacak)" diye onaylanmıştı.

**How to apply:** Bu konu tekrar açılırsa spike raporunu oku, sıfırdan araştırma yapma. Öneri
sırası: önce kod yazmadan `fakechat` ile ~1 saatlik ölçüm (eklenti bu makinede zaten kurulu),
sonra karar. Uygulanırsa ADR şartları: `claude/channel/permission` **asla** bildirilmez ·
mesaj ucu `x-mc-write`e tabidir (`ADR-013`, `POST /api/events` gibi muafiyet almaz) · G0
gevşetmesi kullanıcı onayı ister. Bu özellik `ADR-005`'in yazma sınırını delmez ama
**etrafından dolaşır**: panel CEO'ya serbest metin verebilirse dolaylı yetkisi CEO'nun tüm
yetkisi kadar olur — bunu ADR'de açıkça yaz. İlgili: [[veron-olcmeden-kapsam-degistirmez]]
