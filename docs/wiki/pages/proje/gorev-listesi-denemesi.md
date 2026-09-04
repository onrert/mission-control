---
type: proje
updated: 2026-09-04
sources: [docs/00-idea.md, docs/decisions/ADR-001-mvp-davranis-kararlari.md, docs/approvals/G0.ok, docs/progress.md]
---
# Görev Listesi (deneme projesi)

Kasıtlı bir deneme/pipeline kalibrasyon projesi; amaç ürün üretmek değil, App Factory hattının (G0→G6) doğru çalıştığını sınamaktı. G1'de bilinçli olarak sonlandırıldı, kod hiç yazılmadı; `docs/00-idea.md`, `01-prd.md`, `G0.ok`, `ADR-001` deneme artefaktları şablondan sonradan silindi — bu sayfa onların tek kalıcı kaydıdır.

## Kapsam (G0 onaylı)
- Platform: web, tek kullanıcı, veri yalnızca tarayıcı localStorage (backend/veritabanı/auth yok, erken soyutlama yapılmayacak)
- MVP: (1) ekle/tamamla/sil, (2) görev metnini düzenle, (3) filtre: tümü/aktif/tamamlanan, (4) son tarih + öncelik
- Kapsam dışına alındı: sürükle-bırak yeniden sıralama — idea-validator diğer 3 maddeye göre orantısız QA yüzeyi (a11y, dokunmatik/masaüstü farkı, sıra kalıcılığı) uyarısı verdi; ilk turun temiz kapanması önceliklendirildi, sonradan /sprint ile eklenebilir
- Dil: yalnızca TR (i18n paketi devreye girmedi), bütçe: sıfır maliyet, ASSETS kapısı bu projede hiç açılmadı

## idea-validator kararı: DEVAM
Ürün olarak pazar doymuş ve farklılaşma yok — tek başına bu bulgu ticari bir ürün için VAZGEÇ gerektirirdi. Ancak projenin tanımlı amacı pazar kazanmak değil hat kalibrasyonu olduğu için kalibrasyon uygunluğu (kapsam küçük ve net, backend/auth/network yok, CRUD + filtre + tarih/öncelik edge case'leri hattı test etmeye yeterli) ağır bastı. DEVAM edildi, gerekçe bilerek yumuşatılmadı.

## ADR-001 — 6 ürün davranışı kararı
| # | Soru | Karar | Kim verdi |
|---|---|---|---|
| 1 | Silme davranışı | Undo (geri al) çubuğu, 5 sn | kullanıcı |
| 2 | Öncelik kademeleri | 3 kademe: Düşük / Orta / Yüksek | kullanıcı |
| 3 | Son tarih/öncelik zorunlu mu | Opsiyonel, ikisi de boş bırakılabilir | CEO |
| 4 | Gecikmiş görev vurgusu | Var — son tarihi geçmiş görevler görsel vurgulanır | CEO |
| 5 | Tamamlanan görev düzenlenebilir mi | Evet | CEO |
| 6 | Filtre yenilemede hatırlansın mı | Hayır — uygulama her zaman "Tümü" filtresiyle açılır | CEO |

Undo çubuğu (zamanlayıcı, ara durum, yarış koşulu) ilk sprint'i şişiren tek madde olarak işaretlendi; G0'da kesilen sürükle-bırakın yerine hattı sınayan gerçek QA yüzeyi olarak bilerek kabul edildi.

## Nerede durduk
G0 onaylı (`G0.ok`), **G1 onaylanmadı** — kullanıcı provayı burada bitirdi, `G1.ok` bilinçli olarak yazılmadı. ux, architect, developer, qa-evaluator, security-reviewer, devops, tech-writer, explorer, asset-designer, librarian agent'ları hiç çalıştırılmadı.

İlgili: [[desen/app-factory-hatti]] [[hata/claude-code-arac-tuzaklari]]
