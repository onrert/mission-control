---
name: release
description: Yayın akışı — deploy planı, kullanıcı onayı (G6), deploy, mağaza gönderimi hazırlığı, README/CHANGELOG.
---
1. G5.ok yoksa dur. devops'a yayın planı brief'i ver (hedef ortam, env değişkenleri, domain, geri alma planı, mağaza adımları — docs/packages/store.md).
2. Planı kullanıcıya özetle; ücret, domain ve hesap gerektiren adımları açıkça işaretle. G6 onayı iste; onayla docs/approvals/G6.ok yaz.
3. devops deploy eder (hook artık izin verir). Sonucu doğrula (canlı URL'de qa-evaluator kısa duman testi).
4. tech-writer README, CHANGELOG ve mağaza metinlerini üretir. Mağaza gönderimi kullanıcı tarafından yapılır; adım adım liste ver.
5. progress.md'ye yayın kaydı; /retro öner.
