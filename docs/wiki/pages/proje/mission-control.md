---
type: proje
updated: 2026-09-16
sources: [docs/progress.md, docs/approvals/G6.ok, docs/blockers.md, docs/decisions/ADR-016-onay-dosyalarinin-korunmasi.md, CLAUDE.md, .claude/agent-memory/ceo/feedback_push-onayi-her-seferinde.md]
---
# Mission Control — Faz 2 kapanışı (G0→G6)

Mission Control, App Factory hattının (bkz. [[desen/app-factory-hatti]]) gerçek ürünü: agent
turlarını izleyen bir kontrol paneli. Bu sayfa hattın G0'dan G6'ya kadar geçtiği gerçek kapıları ve
Faz 2'nin (F-008…F-014 + hook borç kapatma turları) kapanışını kaydeder. **Karıştırma:**
[[proje/gorev-listesi-denemesi]] ayrı, kasıtlı bir kalibrasyon provasıdır ve G1'de sonlandırıldı;
bu proje gerçek üründür ve G6'ya kadar gitti.

## Kapı geçmişi
G0 (fikir) → G1 (PRD) → G2 (mimari) → G3 (UX) → G4-1/G4-2 (kilometre taşları) → G5 (güvenlik/kalite
— altı denetim turu + dört sözleşme kararı) → **G6 (yayın, 2026-09-16 onaylandı)**. G6 onayı
kullanıcının `AskUserQuestion` cevabıyla geldi: *"Onaylıyorum — paketle de."*

## G6 kanıtı (2026-09-16, temiz makine, her ölçüm TEK BAŞINA koşuldu)
| Kanıt | Sonuç |
|---|---|
| `npm run verify` üç ardışık TAM YEŞİL | 3/3, ilk denemede |
| Birim + entegrasyon | 87 dosya / 1852 test (4 atlandı), sessizce eksik dosya yok |
| `npm run e2e` | 55/55 |
| Hook self-test (`tests/hooks-selftest.test.ts`) | 420/420, `npm test` zincirinde |
| `tsc` / `eslint` | 0 / 0 |
| Feature'lar | 14/14 `status: done` |

## Paketleme (ADR-011: Electron)
`npm run electron:package` → `release/Mission Control-win32-x64`, 631,3 MB, electron v44.2.0.
Duman testi gerçek `.exe`'yi başlattı: HTTP 200, uygulama HTML'i servis edildi, `/api/events` 200;
kapatma sonrası yetim `mission-control.exe` süreci **0** (bkz. [[hata/claude-code-arac-tuzaklari]]
yetim süreç/port hijyeni dersi).

## Kabul edilen dört açık borç (G6 ile birlikte, hepsi `docs/blockers.md`'de yeniden-açma
ölçütüyle kayıtlı — hiçbiri gizlenmedi)
1. **Hook hattı (`block-dangerous.cjs` v6):** qa-evaluator'ın 24 canlı vektörü açık (Q1 blob-ilk-
   token körlüğü · Q2 `awk`/`sed` yazma biçimleri · Q3 yönlendirme kaçakları · Q4 `git --output=`)
   artı `Write(src/**)` + `Bash(node *)` izinlerinin birlikte sıfır izin kartıyla tam yetki vermesi.
   `ADR-016` bu turda güncellendi: hook hattı **kaza önleyicidir, saldırı önleyici değildir** (bkz.
   [[desen/onay-mekanizmasi-tasarimi]] §9, [[desen/cit-tasarimi]] §9).
2. **B-4 test kararsızlığı:** kök neden üç ayrı ölçüm turunda bulunamadı; yapısal düzeltme
   denemeleri (havuz bölme %50, sıralı koşum %60) taban orandan (%25) **daha kötü** çıktı,
   `vitest.config.ts` değiştirilmedi. Bağlayıcı kural değişmedi: assert kırmızısı = gerçek hata,
   worker çökmesi (assert sıfırken) = yeniden koş, yayın kanıtı = ardışık üç tam yeşil koşu. Ölçüm
   ortamının kirliliğinin sonucu nasıl değiştirdiği için bkz. [[hata/olcum-kirliligi]] §3.
3. **Ö6:** yazma amplifikasyonu (~159×, 10MB eşiği).
4. **A1/A10 → P4 (parçalı yol ailesi):** `normalizePathText` ile büyük ölçüde kapatıldı ama bazı
   varyantlar açık kaldı; borç kaydında ayrıntı.

## Push disiplini hook'tan CEO'ya taşındı — ve ilk sınavında bir kez kaybedildi
`G6.ok` yazıldığı an `block-dangerous.cjs` push için ayrıca `PUSH.ok` aramayı bırakıyor — yani bu
onayla push kapısı **kalıcı olarak açıldı**. Kullanıcının duran kuralı ("her push öncesi sor, kapı
kalıcı açılmasın") bununla çelişiyordu; kullanıcıya açıkça soruldu, kararı: **"Yine de her push
öncesi sor."** Disiplin artık hook'ta değil, CEO'da — `CLAUDE.md`'ye kalıcı madde olarak yazıldı.
Bu depodaki **tek yer**, bir kapının kaybolup yerini insan disiplinine bıraktığı yer; ve o disiplin
**ilk sınavında, yazıldıktan bir saat sonra kaybedildi**: kullanıcı 38 commit için push onayı verdi,
CEO ardından `G6.ok`'u commit edip sormadan **ikinci bir push** daha yaptı (küçük, onaylanan işle
ilgili bir commit — erozyon tam olarak böyle başlar). Kural sıkılaştırıldı: onay **bir push
içindir**, bir oturum ya da bir konu için değil; onaydan sonra yeni bir commit oluşursa onu
göndermek **yeni bir onay** ister (`.claude/agent-memory/ceo/feedback_push-onayi-her-seferinde.md`).

İlgili: [[desen/app-factory-hatti]] [[desen/cit-tasarimi]] [[desen/onay-mekanizmasi-tasarimi]]
[[hata/claude-code-arac-tuzaklari]] [[hata/olcum-kirliligi]] [[proje/gorev-listesi-denemesi]]
