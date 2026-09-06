---
id: F-012
title: CEO sohbet arayüzü — panel, oturumu Agent SDK ile barındırır
status: qa
owner: developer
deps: [F-003, F-006]
sprint: 2
---
## Açıklama
Faz 2'nin **yeni ilk işi** (kullanıcı kararı 2026-09-06, `ADR-014`) — F-008'in önüne geçer.
Panel bugüne kadar salt-izleyiciydi; bu feature onu CEO oturumunun **sohbet arayüzü** yapar.
Kullanıcı panelde yazar, CEO orada cevap verir, alt agent'lar arka planda çalışırken sohbet
devam eder.

Yöntem: `@anthropic-ai/claude-agent-sdk` ile oturum panelin kendi Node sunucusunda barındırılır.
Claude Code **Channels** yaklaşımı reddedildi (gerekçe `ADR-014`).

Kaynak: `ADR-014` · `docs/spikes/SPIKE-002-paneli-ceo-istemcisi-yapmak.md` (mimari seçenekler) ·
`docs/spikes/SPIKE-002-asama0-olcum.md` (M1/M2/M3 ölçümleri) ·
`docs/spikes/SPIKE-001-panelden-ceoya-mesaj.md` §7 (gecikme ölçümü).

## Kabul kriterleri
- [ ] Panelden yazılan mesaj barındırılan CEO oturumuna ulaşır; cevap panelde **akış hâlinde**
      (token token ya da parça parça) görünür, tamamlanmayı beklemeden.
- [ ] Oturum kullanıcının **mevcut Claude aboneliğiyle** açılır. Ortamda `ANTHROPIC_API_KEY`
      varsa sessizce kullanılmaz: ya alt süreç ortamından temizlenir ya da oturum açılmaz ve
      kullanıcıya görünür hata verilir (`ADR-014` sonuç 1).
- [ ] **Bariyer çitlenmiştir:** `ANTHROPIC_API_KEY` bariyerini kaldıran mutasyon KIRMIZI verir.
- [ ] `.claude/hooks/` altındaki güvenlik kapıları barındırılan oturumda da **engeller** —
      "yükleniyor" değil, **durduruyor** olduğu kanıtlanır. Testte hook aktifken yasaklı eylem
      engellenir; hook devre dışıyken aynı eylem geçer (iki yönlü, `ADR-014` M2 gerekçesi).
- [ ] Alt agent arka planda çalışırken ana oturum yeni mesaja cevap verebilir; alt agent
      ilerlemesi panelde görülebilir.
- [ ] Sohbet ucu `ADR-013` `x-mc-write` kuralına tabidir; başlıksız istek reddedilir ve bu
      **mutasyonla çitlenir**. Muafiyet yok.
- [ ] Konuşma geçmişi kalıcıdır: panel kapatılıp açılınca geçmiş görünür. (Oturumun kaldığı
      yerden devam edip etmeyeceği sözleşme turunda karara bağlanacak.)
- [ ] Barındırılan oturumdaki bir hata **paneli çökertmez**: sunucu ayakta kalır, mevcut
      ekranlar (zaman çizelgesi, kanban, ayarlar) çalışmaya devam eder, kullanıcı okunabilir bir
      hata görür. Asenkron handler'lar kendi `try/catch`'ini taşır (`CLAUDE.md`, üç kez tekrarlayan
      hata sınıfı).
- [ ] Olay akışındaki izlenen proje verileri CEO'nun bağlamına **doğrudan talimat olarak**
      girmez; sınır açık ve test edilmiş.
- [ ] Sohbet özelliği kapatılsa/kaldırılsa panel bugünkü hâline temiz döner (geri dönüş yolu).

## Dosya sahipliği (bu feature yalnızca şu dosyalara dokunur)
`src/features/chat/**`, ilgili testler, `package.json` (yeni bağımlılık: agent SDK),
ve sohbet ucunun kaydı için `src/server/` içindeki dağıtıcı satırı.

## Notlar / kararlar
- **CEO'nun önden verdiği kararlar sözleşme turu başlamadan yazılacak** (`CLAUDE.md` dersi:
  tur ortasında/sonunda verilen karar gövdeye yayılmıyor).
- Kabul edilen riskler `ADR-014`'te: politika grisi (kullanıcı bilinçli kabul etti) ve
  `ListAgents`'ın makinedeki diğer oturumları görmesi (düzeltilemez, bilinen sınırlama).
- Ölçülmüş bağlam: CEO oturumu zamanın %87.5'inde boşta; "agent çalışırken konuşma" mevcut
  arka plan düzeniyle zaten karşılanıyor (`SPIKE-001` §7). Bloklayıcı alt agent düzenine
  dönülürse bu kayıp.
- Aşama 0 ölçümünde tespit edildi: alt agent aracının gerçek adı `Agent` (dokümandaki `Task`
  değil) ve `ListAgents` beklenen işi yapmıyor. **Araç isim yüzeyi dokümandan değil, kurulu
  sürümden doğrulanacak.**
