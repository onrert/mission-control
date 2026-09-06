---
name: panel-ceo-sohbet-vizyonu
description: Veron'un Mission Control icin asil urun vizyonu — panel CEO oturumunun sohbet arayuzu olsun, sadece izleyici degil
metadata:
  type: project
---

Veron'un Mission Control'den asil beklentisi: **panelin CEO ile konustugu yer olmasi.**
2026-09-06'da kendi cumlesiyle: "burada yaptigimiz konusmayi direkt Mission Control uzerinden
yapmak istiyorum, gecikme olmadan, baska bir yere yuklenmeden; subagent'lar calisirken de."

Bu, "disaridan mesaj enjekte etme" (Claude Code Channels) DEGIL — panelin oturumu
**barindirmasi**. Fizibilite: [[spike-001-kanal-gecikme-olcumu]] ve
`docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md`.

**Why:** Faz 1 (7 feature) bittiginde paneli deneyip soyledi: "asamalara feature kartlari
goruyorum fakat benim herhangi bir karisabilecegim bir yer yok." Salt-izleyici bir panel ona
yetmiyor; mudahale edebilecegi bir yuzey istiyor. `docs/00-idea.md`'deki "kesinlikle olmayacaklar"
listesi bunu disliyordu — yani bu G1 seviyesinde bir kapsam degisikligi.

**How to apply:** Faz 2 planini (F-008 kapilar → F-009 transkript → F-010 thread → F-011 token)
bu vizyona gore yeniden degerlendir; F-008 kapilar paneli bu ihtiyacin bir parcasini karsiliyor
ama serbest sohbeti karsilamiyor. Yeni feature onerirken "Veron buraya mudahale edebiliyor mu?"
diye sor. Kilit acik soru: SDK ile barindirma abonelikle mi calisiyor yoksa ucretli API anahtari
mi gerektiriyor (ikincisi gercek para → ayri onay).
