# progress.md — kaldığımız yer

Her oturum sonu CEO/developer ekler: tarih · ne yapıldı · nasıl doğrulandı · kalan risk · sonraki adım.

> Bu klasör `C:\dev\app-factory` şablonundan kopyalandı. Şablonun kendi kurulum/kalibrasyon geçmişi orada durur; buradaki kayıtlar yalnızca **Mission Control** projesine aittir.

---

## 2026-09-04 — G0 geçildi (fikir kapısı)

**Ne yapıldı**
- `/new-app` akışı `C:\dev\app-factory` oturumunda başlatıldı; gerçek proje bu kopya klasörde (`C:\dev\apps\mission-control`) yürüyecek.
- Kullanıcı kararları alındı: kapsam **2 fazlı** · panel **tam yazma** yetkili (kanban frontmatter + kapı `.ok`/`.deny.md`) · arayüz **Türkçe** · fikir doğrulaması **tam** yapıldı.
- `docs/00-idea.md` dolduruldu (problem, başarı ölçütü, Faz 1/Faz 2, kesinlikle olmayacaklar, doğrulama özeti, G2'yi bağlayan kısıtlar).
- `idea-validator` çalıştırıldı → `docs/00-idea-validation.md` (7 benzer araç, yap-yerine-kullan değerlendirmesi, 4 teknik risk, MVP önerisi). Karar: **DARALT**.
- Kullanıcı G0'ı onayladı → `docs/approvals/G0.ok` yazıldı.

**Nasıl doğrulandı**
- Kopya klasör şablonla birebir aynıydı (`diff -rq` farksız), yani temiz başlangıç.
- Doğrulama raporundaki her iddia kaynak linkiyle verildi (resmi Claude Code hooks/observability dokümanları + 12 OSS proje).

**Nerede durduk**
- G0 onaylı. **G1 (PRD) başlamadı** — `pm` agent'ı henüz çalıştırılmadı, `docs/01-prd.md` boş şablon.
- Kod yok, `src/` yok, git deposu yok (kopyada `.git` bulunmuyor — ilk feature'da `git init` + iskelet commit'i gerekecek).

**Kalan risk**
- `~/.claude/projects/**/*.jsonl` transkript formatı belgesiz (YÜKSEK): Faz 2'nin Thread + Token ekranlarını tehdit ediyor. Kod yazmadan önce kurulu Claude Code sürümünde gerçek dizin yapısı elle doğrulanmalı (`.../subagents/agent-*.jsonl` yolu varsayım).
- Hook payload şeması stabilite garantisiz (ORTA): `send-event.js` savunmacı yazılmalı, ham olay saklanmalı.
- Port 4000 en az iki benzer araçla çakışıyor: varsayılan değiştirilmeli, env ile yapılandırılabilir olmalı.
- `better-sqlite3` Windows'ta native derleme sürtünmesi (ORTA): düz JSONL depo tercih edilecek — architect G2'de karara bağlayacak.

**Sonraki adım**
1. Bu klasörde (`C:\dev\apps\mission-control`) yeni bir Claude oturumu aç — hook'lar (özellikle G2 kod yazma koruması) yalnızca proje kendi çalışma dizininde açıldığında işler.
2. CEO `pm` agent'ına PRD brief'i versin: kaynak `docs/00-idea.md` + `docs/00-idea-validation.md` + `docs/specs/mission-control.md`; Faz 1/Faz 2 ayrımı ve G0.ok'taki daraltmalar bağlayıcı.
3. PRD sonrası G1 onayı → `docs/approvals/G1.ok`.
4. Ardından `ux` + `architect` paralel; architect'in **açık ADR görevi**: olay sunucusunu sıfırdan yazmak mı, mevcut OSS'i (disler/claude-code-hooks-multi-agent-observability) uyarlamak mı — lisans, stack uyumu (onlar Bun+Vue, biz Node+Vite/React) ve bakım yükü karşılaştırılacak.

---

## 2026-09-04 — G1, G2, G3 geçildi; kod öncesi tüm dokümanlar hazır

**Ne yapıldı**
- PRD yazıldı ve onaylandı (`docs/01-prd.md`, 6 özellik, ölçülebilir kabul kriterleri) → `approvals/G1.ok`.
- PRD'nin 8 açık sorusu kapatıldı: 3'ü kullanıcıya soruldu (yalnızca localhost · tüm olay tipleri + filtre · onayda doğrulama, rette zorunlu gerekçe), 5'i CEO kararı olarak `ADR-001`'e yazıldı.
- `ux` → `docs/03-ux.md` (474 satır): 6 ekran, 7 kritik akış, durum tasarımı, koyu "sefer tablosu" teması, Türkçe metin sözlüğü, erişilebilirlik. → `approvals/G3.ok`.
- `architect` → `docs/02-architecture.md` (1019 satır, 17 bölüm) + ADR-002…ADR-007. → `approvals/G2.ok`.
- Kullanıcı G2'de 3 kararı verdi: kendi minimal token okuyucumuz (ADR-007, G0 daralmasından onaylı sapma) · Faz 2'de önce F-008 kapılar paneli, sonra F-009 spike · veri deposu repo içinde `data/` (gitignore'lu).
- CEO 11 feature notu oluşturdu: `docs/features/F-001…F-011.md`, hepsi `status: todo`.

**Nasıl doğrulandı**
- `src/` oluşmadı, kod yazılmadı (G2 öncesi kısıt korundu).
- ADR-002 iddiaları kaynakla doğrulandı: `disler/...` deposu lisanssız (türev çalışma üretilemez), `hook-lab` Elixir+Phoenix+Docker → "lisans uygunsa uyarla" koşulu sağlanmadı, sunucu sıfırdan yazılacak.
- ADR-007'deki transkript yolları diskte gerçekten gözlemlendi (tahmin değil): `<session-uuid>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json` içinde `agentType`; dizin adı kodlaması harf duyarsız eşleşmeli.
- Tahmini aylık maliyet 0 TL, 8 kalemli tabloyla doğrulandı.

**Nerede durduk**
- G0, G1, G2, G3 onaylı. Kod yazımı serbest ama HENÜZ BAŞLAMADI.
- Sıradaki iş: **F-001 iskelet** (git init, Vite/React/TS/Tailwind kabuğu, `node:http` sunucusu + `/api/health`, Vitest + Playwright, CI, `npm run verify`).
- Faz 1 sırası: F-001 → F-002 → F-004 → F-003 → F-005 → F-006 → F-007. (F-006 yazma kapısı F-007'den önce bitmek zorunda.)

**Kalan risk**
- Bu klasörde hâlâ git deposu yok; tüm dokümanlar versiyonsuz. F-001'in ilk işi `git init` + baseline commit.
- G0–G3 arası tüm çalışma `C:\dev\app-factory` oturumundan mutlak yollarla yürütüldü (şablona yazılmadı, doğrulandı). Kod aşaması için bu KABUL EDİLEMEZ: hook'lar yalnızca proje kendi çalışma dizininde açıldığında devreye girer.
- `docs/features/F-000-template.md` silindi (kullanıcı onayıyla, 2026-09-04) — panel kendini izlediğinde kanbanda hayalet kart oluşturmasın diye. Şablonun aslı `C:/dev/app-factory/docs/features/F-000-template.md` içinde duruyor.
- Faz 2'nin transkript bağımlılığı hâlâ en kırılgan yer; F-009 spike'ı bunu ölçecek.

**Sonraki adım**
1. `C:\dev\apps\mission-control` klasöründe yeni Claude oturumu aç.
2. CEO'ya "F-001'i başlat" de → developer sözleşmesi (`docs/qa/F-001-contract.md`) → kod → qa-evaluator → G4-1.
