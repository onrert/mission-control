# Wiki log

(tarih · işlem · sayfalar · kaynak)

- 2026-09-04 · 3 yeni sayfa oluşturuldu (App Factory kurulumu + G0–G1 kalibrasyon provası kalıcı hafızaya işlendi) · [[proje/gorev-listesi-denemesi]], [[desen/app-factory-hatti]], [[hata/claude-code-arac-tuzaklari]] · kaynak: docs/progress.md, CLAUDE.md ("Öğrenilen kurallar"), docs/00-idea.md, docs/decisions/ADR-001-mvp-davranis-kararlari.md, docs/approvals/G0.ok
- 2026-09-10 · Faz 2 retrospektifi (F-008…F-014 + test-atlama-çiti altyapı işi) işlendi: 1 yeni sayfa oluşturuldu, 2 mevcut sayfaya ekleme yapıldı · [[desen/cit-tasarimi]] (yeni — kara/beyaz liste, sözdizimi vs davranış gözlemi, pozitif kontrol, kaskad kırmızı, iç tutarlılık vs dış referans, mimari sınır), [[desen/app-factory-hatti]] (ekleme — sözleşme turunun ölçülmüş getirisi, tur bölünmesi + "önce commit", "ana vaat en az test edilen şey"), [[hata/claude-code-arac-tuzaklari]] (ekleme — tek kullanımlık onay tüketimi, korunan komut adı geçen metin, fork bomb, gitattributes normalizasyonu; madde 4'e SendMessage düzeltmesi "## Çelişki" bloğuyla) · kaynak: docs/qa/F-008-contract-review-1.md, docs/qa/F-008-contract-review-2.md, docs/qa/F-008-2026-09-09.md, docs/qa/F-009-2026-09-09.md, docs/qa/F-009-2026-09-09-tur2.md, docs/qa/F-009-2026-09-09-tur3.md, docs/qa/F-011-2026-09-10.md…tur7.md, docs/qa/test-skip-gate-2026-09-10.md, docs/qa/test-skip-gate-contract.md, docs/decisions/ADR-013-yazma-uclarinda-ozel-baslik-zorunlulugu.md, CLAUDE.md
- 2026-09-11 · G5 (güvenlik/kalite kapısı) denetiminin dersleri işlendi: altı denetim turu + dört sözleşme-kararı turu tek bir günde üretildiği için ders yoğunluğu yüksekti. 1 yeni sayfa oluşturuldu, 1 mevcut sayfaya iki yeni ders eklendi, 2 mevcut sayfaya çapraz bağlantı eklendi · [[desen/onay-mekanizmasi-tasarimi]] (yeni — 8 ders: onay artefaktının korunması, serbest metinden makine kararı çıkarmama, kayıpsız ayrıştırma, gösterilen≡yapılan, onay yorgunluğu/tüketim birimi, güvenlik testinin kendini yok etmemesi, kapatmadan önce ölçekte doğrulama, aşırı engellemenin maliyeti), [[desen/cit-tasarimi]] (ekleme — §7 bağımsız oracle ile doğrulama, §8 yük taşıyan ama çitsiz kontrol; F-011'in başarısız "kendi mantığınla doğrulama" örneğiyle karşılaştırıldı), [[hata/claude-code-arac-tuzaklari]] (madde 6'ya çapraz bağlantı + İlgili güncellendi), [[desen/app-factory-hatti]] (İlgili güncellendi) · kaynak: docs/qa/G5-guvenlik-denetimi-2026-09-10.md…tur5.md, docs/qa/G5-sozlesme-kararlari-2026-09-10.md…tur5.md, docs/qa/g5-guard-json-contract.md, docs/qa/g5-tur5-kapsam-ve-selftest-contract.md, docs/decisions/ADR-016-onay-dosyalarinin-korunmasi.md, docs/approvals/G5.ok, docs/blockers.md (son bölüm), CLAUDE.md
- 2026-09-16 · G5 sonrası hook borç kapatma (block-dangerous.cjs v0→v6, yedi tur) + G6 yayın kapısı
  dönemi işlendi: 2 yeni sayfa oluşturuldu, 3 mevcut sayfaya ekleme yapıldı ·
  [[proje/mission-control]] (yeni — G0→G6 kapı geçmişi, G6 yayın kanıtı, Electron paketleme, dört
  kabul edilen açık borç, push disiplininin hook'tan CEO'ya geçmesi), [[hata/olcum-kirliligi]]
  (yeni — üç ölçüm-kirliliği vakası: e2e 8/55→55/55, test kapısının kendi testine çarpması, G6
  kanıtı için 8 koşumluk kirli kampanya %50 çökme → temiz tek koşum 3/3), [[desen/cit-tasarimi]]
  (ekleme — §9: bir muafiyet bayrağının uygulandığı bölgenin tamamını körleştirmesi, altı turluk
  "bir yazmayı nasıl tanırız" yolculuğu, additive mekanizma disiplini), [[desen/onay-mekanizmasi-tasarimi]]
  (ekleme — §9: derinlik katmanından önce ön kapıyı ölçmek — B5 sıfır izin kartı açığı, ADR-016
  "kaza önleyici, saldırı önleyici değil"; §10: güvenlik turlarının gizli maliyeti aşırı
  engellemedir, v5 %14,7 → v6 %0), [[hata/claude-code-arac-tuzaklari]] (ekleme — madde 10: kendi
  teşhis komutunun kendi kapısına takılması; madde 11: büyük hook adayının bayt-eşitliğiyle
  kurulması; SendMessage Çelişki bloğuna güncelleme — varlığı oturuma bağlı) · kaynak:
  CLAUDE.md ("Öğrenilen kurallar" son ~15 madde), docs/blockers.md (2026-09-15/16 bölümleri),
  docs/qa/hook-borclari-karari-2026-09-15.md, docs/qa/hook-borclari-karari-v3-2026-09-15.md,
  docs/qa/hook-polarite-karari-2026-09-15.md, docs/qa/hook-writepos-karari-2026-09-15.md,
  docs/qa/hook-borclari-contract.md, docs/qa/hook-allowlist-contract.md,
  docs/qa/hook-polarite-contract.md, docs/qa/hook-writepos-contract.md,
  docs/qa/b4-havuz-contract.md, docs/decisions/ADR-016-onay-dosyalarinin-korunmasi.md (2026-09-15
  güncellemesi), docs/approvals/G6.ok, docs/progress.md (son bölüm),
  .claude/agent-memory/ceo/feedback_push-onayi-her-seferinde.md
