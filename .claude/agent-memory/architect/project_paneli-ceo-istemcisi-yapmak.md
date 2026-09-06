---
name: paneli-ceo-istemcisi-yapmak
description: SPIKE-002 bulgusu — Agent SDK ile panelin CEO oturumunu barındırması teknik olarak mümkün ve ABONELİKLE çalışır (ücretli API anahtarı gerekmez); asıl bedel ADR-005 güvenlik sınırının testler yeşilken kaybolması
metadata:
  type: project
---

Kullanıcı (Veron) CEO ile konuşmayı Claude Code'dan **Mission Control paneline taşımak** istiyor.
Ölçüm: `docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md` (2026-09-06). Bu konu tekrar
açılırsa **sıfırdan araştırma yapma, o raporu oku.**

Kalıcı olarak hatırlanması gerekenler:
- **Maliyet sorusu kapandı:** `@anthropic-ai/claude-agent-sdk` mevcut Claude aboneliğiyle
  (`/login` mirası veya `CLAUDE_CODE_OAUTH_TOKEN`) çalışır. **Ayrı ücretli API anahtarı
  gerekmiyor** → `docs/00-idea.md:18`'in "ücretli servis yok" kararı ihlal edilmiyor. Ama
  ortamda `ANTHROPIC_API_KEY` **varsa** o kazanır ve gerçek para harcanır — koda bariyer şart.
- **Gri alan:** SDK dokümanındaki "third party developers … for their products" notu tek
  kullanıcılı yerel aracı kapsamıyor *gibi görünüyor*, ama bu benim yorumum; Anthropic onayı yok.
  Kullanıcı kararı.
- **En pahalı bulgu:** panel bir agent barındırınca `ADR-005`'in yazma sınırı fiilen kalkar ama
  statik guard testi (`src/**` taraması) ve manifest testi **yeşil kalmaya devam eder** —
  koruma sessizce kaybolur. Bu deponun kanıtlanmış hata sınıfı (ölü hook'lar, silinmiş hata
  sınırının 430/430 yeşil bırakması).
- SDK kendi Claude Code ikilisini taşır → kurulu 2.1.205'in geriliği bu yolda **ilgisiz**.
- `.claude/agents/*.md` ve `.claude/settings.json` hook'ları SDK'da yükleniyor (doküman
  doğruladı) — ama çıkış-kodu-2 engelleme semantiği **ölçülmedi**; ilk çitlenmesi gereken şey bu.

**Why:** SPIKE-001'in ölçtüğü gecikme sorunu (%87,5 boşta) barındırmayı gereksiz kılmıyor;
kullanıcının istediği şey gecikme değil, sohbetin *nerede geçtiği*.

**How to apply:** Önerilen sıra: yarım günlük Aşama 0 ölçümü (kimlik + hook engelleme + arka plan
alt agent), sonra karar. Uygulanırsa ADR koşulları raporun §9'unda 9 madde hâlinde yazılı.
İlgili: [[panelden-ceoya-mesaj-kanali]] · [[veron-olcmeden-kapsam-degistirmez]] ·
[[kanitli-iddia-zorunlulugu]]
