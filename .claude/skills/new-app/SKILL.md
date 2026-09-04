---
name: new-app
description: Yeni bir uygulama fikrini alır; fikir doğrulama ve G0 akışını başlatır (netleştirme soruları → docs/00-idea.md → onay → PRD).
argument-hint: <bir-iki cümlelik uygulama fikri>
---
Kullanıcının fikri: $ARGUMENTS

1. docs/ şablon dosyalarının var olduğunu doğrula (yoksa PROCESS.md'ye göre oluştur). Önceki bir proje varsa (docs/01-prd.md dolu) kullanıcıya "yeni klasörde başla" öner ve dur.
2. AskUserQuestion ile en fazla 6 soru sor: platform (web/mobil/masaüstü), hedef kullanıcı, MVP'de olmazsa olmaz 3 şey, olmaması gerekenler, hız/kapsam tercihi, ücretli servis/kredi kullanılabilir mi, diller.
3. docs/00-idea.md'yi doldur. idea-validator'ı çalıştır; sonucunu 5 satırda özetle (DEVAM/DARALT/VAZGEÇ).
4. G0 onayı iste (AskUserQuestion). Onay gelince docs/approvals/G0.ok yaz.
5. pm agent'ına PRD brief'i ver. PRD gelince kapsam sorularını sor ve G1 onayı iste; onayla birlikte docs/approvals/G1.ok yaz.
6. Kullanıcı istediği paketleri (i18n, payments, analytics, legal, store) belirttiyse her biri için /add-package çalıştır.
7. ux ve architect'i paralel başlat; sentezle; G2 ve G3 onaylarını iste. G2.ok yazılmadan kod dizinine yazılamaz (hook).
8. Feature notlarını (docs/features/) oluştur: ilk feature iskelet + CI + test altyapısı. Kullanıcıya /sprint ile devam edebileceğini söyle.
