---
name: tur-bolme-ve-commit
description: Alt agent turlari 150 tur sinirina surekli takiliyor — turu kucult, devam brief'inin ILK maddesi commit olsun
metadata:
  type: feedback
---

Buyuk feature'lari tek tura sigdirmaya calisma. F-012 ve F-014 boyunca **her tur** 150 tur
sinirina takildi (ondan fazla kez), ve uc kez is **tamamen commit'siz** kaldi — biri 444k
jetonluk calisma.

**Why:** "Her 2-3 adimda commit at" talimatini kisitlar bolumune yazmak **calismiyor**. Ancak
devam brief'inin **ilk maddesi** "SIMDI commit at, baska hicbir sey yapma" oldugunda tuttu.
Ayrica bu ortamda `SendMessage` **var** — kesilen agent baglami korunarak devam ettirilebiliyor,
brief'i sifirdan yazmaktan cok daha ucuz.

**How to apply:** (1) Feature'i tur bazinda bol — F-012'de "sunucu turu + arayuz turu" ise
yaradi. (2) Devam brief'i kisa olsun: diskteki olculmus durum + commit edilmemis dosya listesi +
"once commit at" + kalan is + kesilen agent'in kendi son cumlesi. (3) Kesinti sonrasi **her
zaman** diskteki gercek durumu olc, agent'in raporuna guvenme. (4) Kota limiti de turu
oldurebiliyor (bir gunde iki kez oldu) — is commit'siz kalmasin diye CEO gerekirse kendisi
WIP commit atsin.
