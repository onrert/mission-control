# ADR-007: Faz 2 transkript ve token veri kaynağı

- **Tarih:** 2026-09-04
- **Durum:** kabul — **kullanıcı onayı isteniyor** (G0 daralmasından bilinçli sapma)

- **Bağlam:**
  Faz 2'nin iki özelliği yerel transkript verisine dayanıyor: **feature thread görünümü** (PRD özellik 5) ve **token kullanımı** (PRD özellik 6).

  `docs/00-idea-validation.md` bunu en yüksek riskli bağımlılık olarak işaretledi (risk (b), olasılık: yüksek): `~/.claude/projects/**/*.jsonl` formatı resmen "dahili, sürümle değişebilir". `docs/approvals/G0.ok` buna bağlayıcı bir daralma koydu: *"Token ekranı için kendi transkript parser'ı yerine hazır kaynak (ccusage çıktısı veya resmi OTel metriği) öncelikli değerlendirilecek."* Bu ADR o değerlendirmenin sonucudur.

  **2026-09-04'te dosya sistemi üzerinde doğrulanan gerçekler** (tahmin değil, gözlem):
  - Ana oturum: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>.jsonl`
  - Subagent: `~/.claude/projects/<kodlanmış-cwd>/<session-uuid>/subagents/agent-<id>.jsonl`
  - Yanında: `agent-<id>.meta.json`, gözlemlenen içerik
    `{"agentType":"architect","description":"Mission Control architecture","toolUseId":"toolu_…","spawnDepth":1,"stoppedByUser":true}`
  - `<cwd>` kodlaması: `C:\dev\app-factory` → `C--dev-app-factory`; **büyük/küçük harf tutarsız** (`c--Users-pc-…` ile `C--dev-…` aynı dizinde bir arada) → eşleştirme harf duyarsız olmalı.
  - `output_tokens` alanı jsonl içinde mevcut.

  Ayrıca kritik bir gözlem: **her hook olayı `transcript_path` alanı taşıyor**, `SubagentStart`/`SubagentStop` olayları `agent_id` + `agent_type` taşıyor. Yani Faz 1'de zaten topladığımız olaylar, Faz 2'nin ihtiyaç duyduğu dosya yollarını içeriyor.

- **Karar:**

  **(1) Yol bulma: tahmin değil, toplama.**
  Transkript dosyaları `transcript_path` alanından okunur (birincil, kesin, dizin adı kodlamasından bağımsız). `~/.claude/projects/` altında harf duyarsız dizin taraması yalnızca **yedek** yoldur (panel kurulmadan önce yapılmış oturumlar için). Dizin adı kodlaması değişse bile birincil yol çalışmaya devam eder. Bu, risk (b)'nin en büyük parçasını mimari olarak ortadan kaldırır.

  **(2) Thread görünümü: iki kaynak, biri güvenilir.**
  - **Birincil (güvenilir):** `docs/qa/<feature>-contract.md` ve `docs/qa/*.md`. Bunlar App Factory doktrininin kendi dosyalarıdır; formatı biz belirliyoruz, Anthropic değil. `ESKALE: true` rozeti de buradan (`docs/qa/latest.md`) okunur.
  - **İkincil (best-effort):** transkript. Hiç okunamasa bile thread ekranı kullanışlı kalır.
  Böylece PRD F5/AC1 ("ilgili sözleşme/QA dosyaları mevcutsa") en kırılgan kaynağa bağlı olmaktan çıkar.

  **(3) Token kaynağı: kendi minimal okuyucumuz.**
  Yalnızca `type: "assistant"` satırları okunur ve `message.usage.*` alanları toplanır (input, output, cache_creation, cache_read). Konuşma yeniden kurulmaz, araç çağrıları çözümlenmez — bu bir **toplama** işidir, ~60 satır. Gruplama: proje / gün / oturum / agent (agent bilgisi `subagents/*.meta.json` içindeki `agentType`'tan).
  Okuyucu sözleşmesi: satır bazlı `try/catch`, bilinmeyen `type` atlanır ve sayılır, **asla istisna fırlatmaz**, 64 MB üzeri dosyalarda yalnızca son 32 MB okunur, `lines_bad > 0` ise yanıt `degraded: true` döner ve UI "okunamadı" gösterir (PRD F6/AC2). Ham hata/stack trace UI'a **gitmez** (PRD F5/AC3).

  **(4) Ön görev zorunlu (F-009).**
  Thread/token kodu yazılmadan önce bir spike çalışır: en az 3 gerçek `.jsonl` incelenir, gözlemlenen satır tipleri ve `usage` alan adları yazıya dökülür, `tests/fixtures/transcripts/` altına 5 fixture dondurulur (`valid`, `truncated-last-line`, `unknown-schema`, `empty`, `bom-crlf`). Bu doğrulama her Claude Code güncellemesinden sonra tekrarlanır.

  **(5) Faz 2 hiçbir koşulda Faz 1'i etkilemez.** Thread/token uçları salt okunurdur, ayrı modüllerdedir ve `/api/health.degraded` üzerinden raporlanır. Bozulurlarsa zaman çizelgesi, kanban ve kapılar çalışmaya devam eder (PRD F5/AC2).

- **Alternatifler ve neden reddedildi:**

  - **`ryoppippi/ccusage` çıktısını kaynak almak (G0'ın önerdiği yol):**
    - **Format riskini azaltmıyor.** ccusage de aynı belgesiz `.jsonl` dosyalarını tersine mühendislikle okuyor. Anthropic formatı değiştirirse ccusage de kırılır; biz sadece kırılmayı bir üçüncü partinin yayın takvimine bağlamış oluruz. Yani ADR'nin çözmesi gereken asıl riski çözmüyor.
    - **Yeni riskler ekliyor:** çalışma zamanında bir CLI süreci başlatmak (`npx`/global kurulum → ilk çalıştırmada **ağ erişimi**, ki "tamamen yerel, dış servis yok" ilkesiyle sürtüşür), CLI çıktı formatının kendi sürümlemesi, sürüm uyumsuzluğu, Windows'ta `npx` süreç başlatma gecikmesi.
    - **İhtiyacımızın kat kat üstünde:** ccusage çok sağlayıcılı, maliyet hesaplı, canlı bloklu bir rapor aracı. Bizim istediğimiz "proje × gün × agent toplamı".
    - **Red** — ama README'de **elle çalıştırılabilir bir çapraz kontrol** olarak önerilir: kullanıcı `ccusage` çıktısıyla panelin rakamlarını karşılaştırabilir. Bu, doğrulama değeri sağlar, bağımlılık yaratmaz.
  - **Resmi OTel metriği (`claude_code.token.usage`):** Doğru ve desteklenen kaynak. Ancak OTel collector + Prometheus (veya benzeri) kurulumu gerektirir; `docs/00-idea-validation.md` bunu "ağır altyapı" olarak zaten eledi ve `docs/approvals/G0.ok` "dış servis/ek altyapı yok" ilkesini bağlayıcı kıldı. Ayrıca metrikler toplu sayılardır; feature thread'i için gereken oturum/agent kırılımını ve mesaj içeriğini vermez, yani ikinci bir kaynak yine gerekirdi. **Red** — kullanıcı ileride zaten bir Grafana yığını kurarsa panel bunu okumak yerine kullanıcıyı oraya yönlendirir.
  - **`daaain/claude-code-log` veya `simonw/claude-code-transcripts` kütüphanesini bağımlılık olarak almak:** İkisi de Python; Node projesine Python çalışma zamanı bağımlılığı eklemek kurulum sürtünmesini (kaçındığımız asıl şeyi) geri getirir. Ayrıca ikisi de aynı belgesiz formatı okuyor. **Red** — ama F-009 spike'ında **referans olarak okunmaları** önerilir (hangi satır tiplerini nasıl ele almışlar).
  - **Transkripti hiç okumamak, token ekranını iptal etmek:** PRD özellik 6 onaylı kapsamda (P2, best-effort). "Best-effort" iptal demek değil. **Red.**
  - **Kendi parser'ımızla konuşmayı tam olarak yeniden kurmak (mesaj ağacı, araç eşleşmeleri):** Riskin en büyük olduğu yer burası. Thread görünümü için buna ihtiyaç yok — `docs/qa/*` dosyaları zaten kronolojiyi taşıyor; transkript yalnızca **zenginleştirme**. **Red** (kapsam olarak).

- **Sonuçlar / riskler:**
  - **G0 daralmasından sapma.** `G0.ok` "hazır kaynak öncelikli değerlendirilecek" diyordu — değerlendirildi ve reddedildi. Bu, "sorma, kendin karar ver" listesinde olmayan bir kapsam kararıdır; bu yüzden **CEO G2'de kullanıcıya sorar** (bkz. `docs/02-architecture.md` §17 madde 1).
  - **Format değişirse token rakamları sessizce yanlış olabilir** (kırılmak yerine eksik toplamak). Azaltım: okuyucu, tanıdığı satır sayısı ile toplam satır sayısını raporlar; oran düşerse UI "veri eksik olabilir" uyarısı gösterir. Ek azaltım: README'de `ccusage` ile elle çapraz kontrol önerisi.
  - **Fixture'lar anonimleştirilmelidir.** Gerçek transkriptler prompt metinleri içerir; `tests/fixtures/transcripts/` içine konulmadan önce metin alanları kısaltılır/temizlenir. F-009'un kabul kriterlerinden biridir.
  - **`transcript_path` yalnızca panel kurulduktan sonraki oturumlar için var.** Geçmiş oturumlar yedek dizin taramasıyla bulunur; bulunamazsa ilgili thread "okunamadı" gösterir — kabul edilebilir.
  - **Sürüm bağımlılığı görünür kılınmalı:** `/api/health` içinde `transcript_reader: { files_seen, lines_ok, lines_bad }` alanları bulunur; oran bozulduğunda sorun ilk fark edilen yer burasıdır.

- **Kullanıcı onayı gerekli mi:** **Evet** — ücret veya hesap gerektirmiyor, ama `docs/approvals/G0.ok` içindeki bağlayıcı bir daralmadan bilinçli sapma olduğu için CEO G2 kapısında kullanıcıya sorar. Onaylanmazsa yedek plan: token ekranı F-011'de `ccusage` çıktısını *opsiyonel* kaynak olarak okuyacak şekilde genişletilir (kurulu değilse "veri yok"), thread görünümü değişmez.
