# PROCESS.md — App Factory Süreç Doktrini

CEO bu dosyayı her oturum başında bilir; tüm agent'lar ilgili bölümleri brief ile alır.

## 1. Roller
| Agent | Model | Görev | Yazabildiği yer |
|---|---|---|---|
| ceo | fable (limit daralınca opus) | Tek iletişim noktası; planlar, dağıtır, sentezler, kapılarda sorar | docs/ |
| idea-validator | sonnet | Fikri pazar/rakip/talep açısından eler (G0 öncesi) | docs/00-idea.md eki |
| pm | sonnet | PRD, kullanıcı hikâyeleri, kapsam | docs/01-prd.md |
| ux | sonnet | Ekran envanteri, akışlar, tasarım dili | docs/03-ux.md |
| architect | opus | Stack, veri modeli, API sözleşmesi, ADR'ler | docs/02-architecture.md, docs/decisions/ |
| developer | sonnet | Tek feature uygular, test yazar, commit atar | kod |
| qa-evaluator | opus | Playwright ile gerçek uygulamayı test eder; GEÇTİ/KALDI | docs/qa/ |
| security-reviewer | sonnet | Güvenlik incelemesi (salt-okunur) | docs/security-review.md |
| devops | sonnet | CI/CD, env, deploy scriptleri | ci, scripts |
| tech-writer | haiku | README, CHANGELOG, kullanıcı dokümanı | docs, README |
| explorer | haiku | Kod tabanı keşfi, log okuma (salt-okunur) | — |
| asset-designer | sonnet | Higgsfield ile görsel/video/ses varlıkları | assets/ |
| librarian | sonnet | docs/wiki hafızasını derler (Karpathy LLM Wiki) | docs/wiki/ |

## 2. Kapılar
| Kapı | Ne onaylanır | Zorlama |
|---|---|---|
| G0 Fikir | docs/00-idea.md: problem, kullanıcı, başarı ölçütü, platform, bütçe tercihi | CEO sorar |
| G1 PRD | MVP'ye giren/girmeyen özellikler, öncelik | approvals/G1.ok |
| G2 Mimari | Stack, hosting, DB, auth, ücretli servisler, tahmini aylık maliyet | approvals/G2.ok — G2 yoksa kod dizinine yazılamaz (hook) |
| G3 UX | Tasarım yönü, ekran listesi (küçük projede G1 ile birleşir) | approvals/G3.ok |
| ASSETS | Higgsfield kredi bütçesi | approvals/ASSETS.ok — yoksa üretim engellenir (hook) |
| G4 Kilometre taşı | QA raporu GEÇTİ + çalışan demo | approvals/G4-<n>.ok; QA KALDI iken oturum "bitti" diyemez (hook) |
| G5 Güvenlik/kalite | Security bulguları, /simplify çıktısı, yasal kontrol listesi | approvals/G5.ok |
| G6 Yayın | Deploy, domain, ücret, mağaza gönderimi | approvals/G6.ok — yoksa push/deploy engellenir (hook) |

Onay dosyası içeriği: tarih + onaylanan özet + kullanıcının kararı (bir cümle).

## 3. Eskalasyon (kapı dışında da sor)
Geri alınamaz işlem (push main, deploy, veri silme, ücret, harici API anahtarı) · kapsam değişikliği · ürünü etkileyen belirsizlik · aynı test 3 denemede geçmedi · agent'lar çelişiyor · tahmini limit/kredi tüketimi bütçeyi aşacak · yıkıcı komut gerekiyor (kullanıcı onaylarsa CEO `docs/approvals/DANGER.ok` yazar; hook tek kullanımlık kabul eder).

Sorma (kendin karar ver, ADR'ye not düş): dosya adlandırma, iç refactor, test yazımı, kütüphane sürümü, stil.

## 4. Delegasyon brief şablonu (her Agent çağrısında)
```
GÖREV: <tek cümle>
BAĞLAM DOSYALARI: <yollar ve bölümler>
KISITLAR: <stack, dosya sahipliği, "şunu değiştirme">
BİTTİ TANIMI: <ölçülebilir>
ÇIKTI FORMATI: <dosya yolu + rapor şablonu>
ENGEL DURUMUNDA: dur, docs/blockers.md'ye yaz, tahmin yürütme
```
Alt agent konuşma geçmişini görmez; brief eksiksiz olmalı.

## 5. Feature yaşam döngüsü
`todo → contract → dev → qa → fix → done` (veya `blocked`). Feature notu: `docs/features/F-NNN-<slug>.md` (frontmatter: id, title, status, owner, deps, sprint). İlk feature her zaman iskelet: proje kurulumu + CI + test altyapısı + boş ana sayfa.

Sprint sözleşmesi: developer `docs/qa/<feature>-contract.md`'ye "ne yapacağım + nasıl doğrulanır" yazar; qa-evaluator aynı dosyada onaylar/düzeltir; anlaşınca kod başlar.

QA turu: KALDI → developer düzeltir → tekrar QA; 3 turdan sonra CEO kullanıcıya eskale eder ve `docs/qa/latest.md`'ye `ESKALE: true` yazar.

## 6. Temiz durum kuralı
Her feature sonu: testler yeşil, küçük anlamlı commit, progress.md'de "ne yapıldı / nasıl doğrulandı / kalan risk", feature notu güncel. Oturum bağlamı dolarsa progress.md'den devam edilir.

## 7. Model ve limit yönetimi
developer=sonnet; ceo=fable (Max'te haftalık limitin %50'sine kadar; daralınca opus'a geç); architect/qa=opus; explorer/tech-writer=haiku. Efor: ceo/architect high, developer medium. Kapı raporlarına `/usage` tüketimini ekle. Agent teams yalnızca 3+ bağımsız feature paralel yazılacaksa (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). Toplu tarama/doğrulama için dynamic workflow (kapılar arasında).

## 8. Paketler (/add-package)
i18n, payments, analytics, legal, store — `docs/packages/<ad>.md` tanımlar; skill feature notlarına ve ADR'ye dönüştürür.

## 9. Mobil farkları
Playwright web içindir; mobilde Expo web önizlemesi + Maestro (varsa) + emülatör ekran görüntüleri. Mağaza gönderimi ve inceleme cevabı kullanıcıdadır.

## 10. Hafıza
- Kısa vadeli: docs/progress.md, docs/features/, docs/qa/
- Uzun vadeli: docs/wiki/ (librarian, /retro), CLAUDE.md "öğrenilen kurallar", agent memory (`.claude/agent-memory/`)
