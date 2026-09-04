# Fikir Doğrulama — Mission Control

## Karar: DARALT

Gerekçe (3 cümle): Hook olay akışı (Faz 1'in en teknik parçası) zaten en az iki açık kaynak projede (disler/claude-code-hooks-multi-agent-observability, felipeelias/hook-lab) çözülmüş durumda — sıfırdan yazmak yerine mimarisini kopyalamak veya fork'lamak daha az risklidir. Faz 2'nin bel kemiği olan `~/.claude/projects/**/*.jsonl` transkript ayrıştırması Anthropic tarafından "her sürümde değişebilir, dahili format" olarak nitelenen, resmen belgelenmemiş bir kaynağa dayanıyor — bu, Thread ve Token ekranlarını kırılgan yapıyor. App Factory'ye özgü gerçek değer (docs/features kanban + G0–G6 kapı onay dosyası yazma) küçük, düşük riskli, kimsede olmayan bir katman; bu yüzden kapsamı bu çekirdeğe daraltıp riskli/emeği-değere-değmeyen parçaları (özel SQLite altyapısı, kendi JSONL parser'ı, port 4000) MVP dışına almak öneriliyor.

## Benzer araçlar

| Araç | Ne yapıyor | Eksiği (bu ihtiyaca göre) | Link |
|---|---|---|---|
| disler/claude-code-hooks-multi-agent-observability | Hook olaylarını Bun sunucu + SQLite + WebSocket ile toplar, Vue dashboard'da canlı gösterir. Yerel, `localhost:4000` (sunucu) + `5173` (istemci). | Kanban, thread, kapı onayı, çok-proje docs/features entegrasyonu yok — salt olay izleme. | [github.com/disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) |
| felipeelias/hook-lab | Hook olaylarını canlı gösteren hafif web panosu, **`localhost:4000`** üzerinde çalışıyor (Mission Control ile aynı varsayılan port — çakışma riski). | Sadece olay akışı; kanban/thread/kapı/token yok. | [github.com/felipeelias/hook-lab](https://github.com/felipeelias/hook-lab) |
| hoangsonww/Claude-Code-Agent-Monitor | Node/Express/React/SQLite/WebSocket; oturum, agent aktivitesi, araç kullanımı izler; **Kanban durum panosu** ve masaüstü (Win/Mac) sürümü var. Aktif görünüyor (yüksek commit/star sayısı, tarih doğrulanamadı). | Kanban jenerik oturum/agent durumuna dayalı — `docs/features/*.md` frontmatter'ına bağlı değil; kapı onay dosyası yazmıyor; CEO→dev→QA sözleşme thread'i yok. | [github.com/hoangsonww/Claude-Code-Agent-Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) |
| ColeMurray/claude-code-otel (ve benzerleri: aaraujodata, zcquant, li0nel, NikiforovAll) | Claude Code'un yerleşik OTel çıktısını Prometheus/Loki + Grafana ile görselleştirir: maliyet, token, oturum, kod satırı metrikleri. Kendi barındırılan, yerel ama ağır altyapı (collector+Prometheus+Loki+Grafana). | Kanban/thread/kapı yok; App Factory doktrinini bilmiyor; kurulum yükü Grafana stack'i gerektirir. | [github.com/ColeMurray/claude-code-otel](https://github.com/ColeMurray/claude-code-otel) |
| ryoppippi/ccusage | CLI: yerel JSONL'lerden günlük/haftalık/oturum bazlı token ve maliyet raporu üretir; Claude Code dahil çok sayıda ajan CLI'sını destekler; canlı akış yok, salt raporlama. | Dashboard/canlı akış/kanban/kapı yok; tek seferlik/CLI raporlama. Token verisi için hazır ve güvenilir bir referans olarak kullanılabilir. | [github.com/ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) |
| Vibe Kanban | Birden çok ajan CLI'sini (Claude Code, Codex, Gemini, Amp) orkestre eden kanban; görev atama, paralel/sıralı çalıştırma, dev server başlatma. Proje "sunsetting" — artık topluluk bakımlı. | Görev orkestrasyonu odaklı (Claude Code'a komut gönderiyor — Mission Control'ün kapsamı dışı); `docs/features` frontmatter'ı veya G0–G6 kapı doktrinini bilmiyor; bakım durumu belirsiz. | [vibekanban.com](https://vibekanban.com/) |
| Multica | Çoklu-ajan (26 CLI) "yönetilen ekip üyesi" platformu; yerel daemon + opsiyonel bulut runtime; görev atama, beceri tekrar kullanımı. | Bulut bağlantı seçeneği var (Mission Control'ün "dış servis yok" ilkesiyle çelişir); App Factory doktrinine özel değil; genel amaçlı, ağır. | [multica.ai](https://multica.ai/) |

## Yap-yerine-kullan değerlendirmesi

Claude Code'un yerleşik OpenTelemetry desteği `api_request`, `tool_result`, `tool_decision`, `skill_activated` gibi olaylar ile token/maliyet/oturum/kod-satırı metriklerini üretiyor; Prometheus+Grafana (veya Loki) ile bunlar %70-80 oranında "ne oluyor, ne kadar harcandı" sorusunu cevaplayabilir — özellikle Faz 2'deki **token kullanımı** ekranı neredeyse bire bir bu yolla (veya daha basitçe `ccusage` ile) karşılanabilir, sıfırdan JSONL ayrıştırmaya gerek kalmadan.

Ancak 3 gereksinim açıkta kalıyor (hazır araçların hiçbiri karşılamıyor):
1. **`docs/features/*.md` frontmatter'ından kurulan, sürüklenince dosyayı güncelleyen kanban** — bu App Factory'nin kendi feature yaşam döngüsüne (`todo→contract→dev→qa→fix→done/blocked`) özel; Grafana/OTel bunu bilmiyor, jenerik agent-monitor araçları da bilmiyor.
2. **G0–G6 kapı onaylarını panelden `docs/approvals/<G>.ok` / `.deny.md` dosyası yazarak vermek** — hiçbir bulunan araçta yok; bu, PROCESS.md'deki kapı zorlama hook'larıyla doğrudan entegre, App Factory'ye özgü bir eylem.
3. **Feature başına CEO brief → developer → QA → düzeltme thread'inin `docs/qa/<feature>-contract.md` + subagent transkriptlerinden sentezlenmesi** — jenerik gözlem araçları oturum/araç bazlı gösterim yapıyor, App Factory'nin sözleşme/QA-turu kavramını modellemiyor.

Sonuç: Grafana/OTel kombosu **token ekranını** ve kısmen **olay akışını** karşılar, ama kanban+kapı+thread'i karşılamaz. Bu nedenle "hiç yapma" seçeneği değil, ama "her şeyi sıfırdan yaz" seçeneği de gereksiz — sadece App Factory'ye özgü 3 maddeyi yaz, geri kalanı hazır araçlardan devşir.

## Teknik riskler

| Risk | Olasılık | Etki | Hafifletme |
|---|---|---|---|
| (a) Hook payload şeması (session_id, agent_id, agent_type, tool_name) resmi olarak "kararlı" diye belgelenmemiş; Claude Code hızlı sürüm çıkarıyor. Resmi dokümantasyon (code.claude.com/docs/en/hooks) alan listesini veriyor ama stabilite/versiyonlama garantisi vermiyor. | Orta | Tüm izlenen projelerdeki `send-event.js` aynı anda kırılabilir (tek nokta arızası); olay akışı sessizce boşalır veya yanlış etiketlenir. | Hook scriptini savunmacı yaz (bilinmeyen/eksik alanı çökme yerine "unknown" olarak logla); her Claude Code güncellemesinden sonra manuel smoke test; şema değişikliğini algılayan bir "raw event" yedek alanı tut. |
| (b) `~/.claude/projects/**/*.jsonl` oturum/subagent transkript formatı resmen "dahili, sürümle değişebilir" olarak nitelendiriliyor; topluluk araçları (claude-code-log, claude-code-transcripts) tersine mühendislikle çalışıyor. Spec'teki tam yol varsayımı (`.../subagents/agent-*.jsonl`) doğrulanmamış. | Yüksek | Faz 2'nin iki özelliği (Thread görünümü, Token kullanımı) sürüm güncellemesinde sessizce bozulabilir veya yanlış veri gösterebilir; en kırılgan bağımlılık burada. | Faz 2'yi opsiyonel/best-effort tut; parser'ı satır bazında try/catch ile sar, hata durumunda ilgili thread'i "okunamadı" göster, tüm paneli çökertme; token için kendi parser'ı yerine `ccusage` çıktısını veya resmi OTel `claude_code.token.usage` metriğini kaynak al; gerçek dizin yapısını kod yazmadan önce kurulu Claude Code sürümünde elle doğrula. |
| (c) `better-sqlite3` Windows'ta node-gyp/Visual Studio Build Tools gerektirebilir (prebuild bulunamazsa derleme başarısız olur); Node sürümü değişince ABI uyumsuzluğu yeniden derleme ister. Tek kullanıcılık, düşük hacimli yerel bir araç için bu risk/fayda oranı düşük. | Orta | İlk kurulumda "npm install" başarısız olabilir — tek kullanıcılı, "hemen çalışsın" beklenen bir iç araç için orantısız sürtünme. | `better-sqlite3` yerine native derleme gerektirmeyen bir seçenek kullan: en basiti düz JSON/JSONL dosya deposu (hacim düşük, tek kullanıcı, sorgu ihtiyacı minimal) — SQLite'a hiç gerek yok. Alternatif: `node:sqlite` (Node 22.13+'ta deneysel bayraksız, Node 24'te RC, Node 26'da kararlı) — ama Node sürüm bağımlılığı ekler, bu yüzden JSONL dosya deposu daha az risklidir. |
| (ek) Port çakışması: en az iki bulunan araç (`hook-lab`, `disler/claude-code-hooks-multi-agent-observability` sunucusu) varsayılan olarak `localhost:4000` kullanıyor — Mission Control ile aynı port. | Düşük-Orta | Kullanıcı bu araçlardan birini de kurarsa/denerse port çakışması. | Portu ortam değişkeniyle yapılandırılabilir yap, varsayılanı gerekirse değiştir. |

## Farklılaşma

Gerçek ayrım: **App Factory'nin kendi dosya doktrinini (feature frontmatter, sözleşme dosyaları, G0–G6 kapı hook'ları) bilen ve o dosyalara doğrudan yazan tek araç bu.** Bulunan hiçbir rakip/benzer proje `docs/features/*.md` frontmatter'ından kanban kurmuyor, hiçbiri kapı onayını `docs/approvals/<G>.ok` yazarak vermiyor. Bu ayrım küçük ama gerçek ve başka hiçbir yerden alınamaz — çünkü App Factory'ye özel bir doktrin, genel amaçlı hiçbir araç bunu bilemez.

Ancak bu ayrımın kapsamı dar: sadece kanban (dosya-izleme + sürükle-güncelle) ve kapı butonları (dosya yazma) bu özgünlüğü taşıyor. Hook olay akışı ve token raporlama özgün değil — bunlar için tekerleği yeniden icat etmeye değmez.

## MVP'ye öneri

**Kalsın (gerçek, düşük riskli, başka yerden alınamayan değer):**
- Kanban panosu: `docs/features/*.md` frontmatter → sütunlar; sürükleme dosyayı günceller.
- Çok projeli izleme: chokidar ile birden fazla proje klasörü.
- Kapılar paneli: G0–G6 onay/red butonları → `docs/approvals/<G>.ok` / `.deny.md` yazar.
- Basit olay/zaman çizelgesi (hook akışı) — ama sıfırdan değil, mevcut açık kaynak bir gözlem aracının (örn. disler/claude-code-hooks-multi-agent-observability) mimarisini/hook scriptini uyarlayarak.

**Çıksın veya ertelensin (risk/emek, hazır alternatif var, veya kırılgan):**
- `better-sqlite3` — yerine düz JSONL/dosya tabanlı depolama (native derleme riski sıfırlanır, tek kullanıcı için performans farkı önemsiz).
- Kendi JSONL/subagent transkript parser'ı (Faz 2 Thread + Token) — riskli/belgesiz kaynağa dayanıyor; token kısmı için `ccusage` çıktısını veya OTel metriklerini kaynak almak, Thread görünümünü ise "best-effort, kırılırsa sessizce devre dışı kal" şeklinde en sona bırakmak.
- Varsayılan port `4000` — en az iki benzer araçla çakışıyor, yapılandırılabilir yap.
- Hook olay sunucusunu sıfırdan yazmak — mevcut bir OSS'i fork/adapte etmeyi değerlendir (lisans uygunsa), sadece App Factory'ye özgü alanları (feature id eşleme vb.) üzerine ekle.

## Kaynaklar

- [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)
- [felipeelias/hook-lab](https://github.com/felipeelias/hook-lab)
- [hoangsonww/Claude-Code-Agent-Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor)
- [ColeMurray/claude-code-otel](https://github.com/ColeMurray/claude-code-otel)
- [aaraujodata/claude-code-otel](https://github.com/aaraujodata/claude-code-otel)
- [zcquant/claude-code-monitor](https://github.com/zcquant/claude-code-monitor)
- [li0nel/claude-otel](https://github.com/li0nel/claude-otel)
- [NikiforovAll/ccdashboard](https://github.com/NikiforovAll/ccdashboard)
- [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage)
- [ccusage.com](https://ccusage.com/)
- [Vibe Kanban](https://vibekanban.com/)
- [Multica](https://multica.ai/)
- [Claude Code Hooks reference (official docs)](https://code.claude.com/docs/en/hooks)
- [Claude Code Observability with OpenTelemetry (official docs)](https://code.claude.com/docs/en/agent-sdk/observability)
- [Inside Claude Code: The Session File Format and How to Inspect It](https://databunny.medium.com/inside-claude-code-the-session-file-format-and-how-to-inspect-it-b9998e66d56b)
- [daaain/claude-code-log](https://github.com/daaain/claude-code-log)
- [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts)
- [WiseLibs/better-sqlite3 troubleshooting](https://app.unpkg.com/better-sqlite3@7.1.5/files/docs/troubleshooting.md)
- [Node.js SQLite documentation (node:sqlite)](https://nodejs.org/api/sqlite.html)
- [better-sqlite3 vs libsql vs sql.js 2026 comparison](https://www.pkgpulse.com/guides/better-sqlite3-vs-libsql-vs-sql-js-sqlite-nodejs-2026)
