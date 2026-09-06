---
name: faz2-durum
description: Faz 2'nin gercek sirasi ve neden degistigi — F-012 sohbet ve F-014 masaustu bitti, sirada F-013 var
metadata:
  type: project
---

**2026-09-06 sonu itibariyla bitenler:** Faz 1 (F-001…F-007) + **F-012** (panel CEO oturumunu
barindiriyor, sohbet calisiyor) + **F-014** (Electron masaustu uygulamasi, cift tikla acilir,
tepside calisir).

**Sirada:** F-013 (feature kartina tiklayinca icinde ne yapildigini gormek — kullanicinin kendi
istegi) → F-008 kapilar paneli → F-009 transkript kesif → F-010 thread → F-011 token.

**Why:** Orijinal Faz 2 sirasi F-008'le basliyordu. Kullanici Faz 1'i deneyip "karisabilecegim
bir yer yok" deyince sira degisti: once konusma yuzeyi (F-012), sonra onu her gun acabilmek
(F-014). Bkz. [[panel-ceo-sohbet-vizyonu]].

**How to apply:** Yeni is onerirken bu sirayi varsay, `docs/features/` frontmatter'ini kaynak
gercegi say. **Iki CEO oturumu riski:** masaustu uygulamasindaki sohbet de bir CEO oturumu —
ikisine ayni anda is verilirse ayni depoya commit atip birbirlerini bozarlar. Devir
`docs/HANDOFF.md` uzerinden yapilir.
