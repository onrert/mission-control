---
name: statik-cit-denetimi
description: Statik guard/çit testlerini denetleme yöntemi — AC'nin kanıt cümlesini teste karşı doğrula, çitin kendi muafiyetlerine mutasyon at, desen listesini aile bazında sızdır
metadata:
  type: feedback
---

Bir feature'ın kabul kriteri "statik tarama testi doğrular" diyorsa, o cümleyi **teste karşı**
doğrula — F-006 kod turunda iki bloklayıcının ikisi de buradan çıktı.

1. **AC'nin "Kanıt:" satırındaki dosya adını aç ve o testin gerçekten o iddiayı ölçüp
   ölçmediğine bak.** F-006'da AC3 ("silme işlevi yok") kanıt olarak `no-write-gate-bypass.test.ts`
   gösteriyordu; o test `write-gate.ts`'i **dosya-seviyesinde muaf tutuyordu** (tek istisnası).
   Yani AC'nin çiti taradığı kümede hiç yoktu. AC5 ("statik tarama testi doğrular") için ise
   böyle bir tarama hiç yazılmamıştı. İkisi de tek `grep` ile ortaya çıktı.
2. **Çitin MUAFİYETİNE mutasyon at, çitin kendisine değil.** Muaf dosyaya gerçek bir yetenek ekle
   (F-006: `setFeatureStatus` içine `fs.unlinkSync(targetPath)`) → 539/539 yeşil kaldı. Developer'ın
   mutasyonları hep taranan tarafı hedefler; muaf taraf hiç sınanmaz.
3. **Desen listesini AİLE bazında sızdır, tek desen bazında değil.** Liste `writeFileSync(`,
   `writeFile(`, `writeSync(` içeriyorsa `fs.write(fd,…)`, `fs.writev(`, `fs.writevSync(`
   ailenin geri kalanıdır ve kaçar. `fs.open(p,'w',cb)` + `fs.write(fd,…)` tam işlevsel bir
   yazma yoludur. Ayrıca listede **nesne-önekli tek bir desen** varsa (`'fs.rm('`) o desen
   `fsp.rm(`/`promises.rm(` ile atlanır — F-005 D28 dersinin birebir tekrarı.
   Yöntem: 8-10 satırlık gerçek çağrı parçacığını taranan bir dosyaya sırayla ekle,
   yalnızca o test dosyasını koştur, tabloyu rapora yaz.

**Why:** Statik çit "yazıldı" ile "iddia ettiği şeyi tarıyor" arasındaki fark, feature'ın
deliverable'ının kendisi olduğu durumlarda (AC7 gibi) doğrudan AC ihlalidir; ve yanlış güven
üretir — sonraki tur "guard var" diye bakmaz.

**How to apply:** Guard içeren her feature'da üç adımı da koş; kanıtı "mutasyon → test sayısı →
yeşil/kırmızı" tablosu olarak ver. Bkz. [[kod-turu-kontrolleri]] madde 6, [[duzeltme-turu-kontrolleri]]
madde 19.

4. **"Mimari fazlalık" savunmasını KABUL ET ama bedelini yazdır.** F-006'da developer'ın
   "yeşil kalan 3 mutasyon fazlalıktır" iddiası ölçümle **doğrulandı** (adım 2+3+6 aynı anda
   kaldırıldığında bile adım 8 tüm junction saldırılarını reddetti). Doğru tepki iddiayı çürütmeye
   çalışmak değil, (a) birleşik mutasyonu gerçekten koşmak, (b) developer'ın **gerekçesinin**
   doğru olup olmadığına bakmak (onunki "geometrik imkânsızlık"tı; gerçek neden
   `path.relative`'in kök referanslı olmasıydı), (c) "bu katmanların sıfır bağımsız test
   kapsaması var" cümlesini rapora koymak.
