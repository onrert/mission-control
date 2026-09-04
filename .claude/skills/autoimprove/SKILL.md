---
name: autoimprove
description: Karpathy autoresearch deseniyle tek bir ölçülebilir metriği gece boyu iyileştirir (öner → uygula → ölç → tut/geri al). docs/autoimprove/program.md tanımlar.
argument-hint: <metrik adı, ör. lighthouse | bundle | coverage | a11y> [tur sayısı]
---
Hedef: $ARGUMENTS

1. docs/autoimprove/program.md'yi oku; metrik, ölçüm komutu, zaman bütçesi ve yasak değişiklikler orada. G4 onaylı bir kilometre taşı yoksa dur.
2. Temiz git durumu şart; yeni dal aç: `autoimprove/<metrik>-<tarih>`.
3. Döngü (tur sayısı kadar, varsayılan 20): tek küçük değişiklik öner → uygula → testler yeşil mi → metriği ölç → iyileştiyse commit (mesajda metrik önce/sonra), değilse `git checkout -- .` ile geri al → docs/autoimprove/log.md'ye satır ekle.
4. Yasak: testleri silmek/zayıflatmak, metriği ölçen kodu değiştirmek, kapsam dışı dosyalara dokunmak, bağımlılık eklemek (program.md izin vermedikçe).
5. Bitince özet: denenen/tutulan değişiklikler, metrik toplam kazanımı, dalın adı. Ana dala merge kullanıcı kararıdır.
