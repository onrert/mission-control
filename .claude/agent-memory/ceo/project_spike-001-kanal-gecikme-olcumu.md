---
name: spike-001-kanal-gecikme-olcumu
description: Olculdu — CEO oturumu zamanin %87.5'inde bosta; alt agent'lari arka planda calistirmak "agent calisirken konusma" sorununu zaten cozuyor
metadata:
  type: project
---

2026-09-06 olcumu (31 saatlik gercek CEO oturum kaydi, 341 arac cagrisi):
oturum zamanin **%87.5'inde bosta**, en uzun kesintisiz mesgul pencere **12.4 dakika**,
5 dakikayi asan tek bir arac cagrisi **yok**. Rastgele bir anda yazilan mesajin beklenen
gecikmesi ~15 saniye. Kayit: `docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md` §7.

**Why:** Sebebi mimari degil **calisma duzeni**: alt agent'lar `run_in_background` ile
baslatiliyor, `Agent` cagrisi ~3 saniyede donuyor, CEO turu bitiriyor ve bosa dusuyor.
Bloklayici alt agent'a donulurse bu tavan cok yukselir.

**How to apply:** "Alt agent calisirken kullaniciyla konusamam" varsayimini kurma — yanlis.
Arka plan duzenini koru; bu, [[panel-ceo-sohbet-vizyonu]]'nun bir gereksinimini bedelsiz
karsiliyor. Ayrica: bir turun **ortasindayken** hicbir tasima yolu mesaj teslim edemez
(arac cagrisi devam ederken model calismiyor) — bu, Channels'a da SDK'ya da esit uygulanir.
