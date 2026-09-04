# ADR-002: Olay sunucusunu sıfırdan yazmak mı, mevcut OSS'i uyarlamak mı

- **Tarih:** 2026-09-04
- **Durum:** kabul

- **Bağlam:**
  `docs/00-idea-validation.md` "hook olay akışı zaten en az iki açık kaynak projede çözülmüş; sıfırdan yazmak yerine mimarisini kopyalamak veya fork'lamak daha az risklidir" dedi ve MVP önerisinde "mevcut bir OSS'i fork/adapte etmeyi değerlendir (lisans uygunsa)" yazdı. `docs/approvals/G0.ok` bu kararı açıkça architect'e bıraktı: *"olay sunucusunu sıfırdan mı yazacağımıza yoksa mevcut açık kaynaktan mı uyarlayacağımıza architect G2'de ADR ile karar versin."*
  Karar verilecek kapsam yalnızca **Faz 1 / özellik 1**'dir (hook olay alımı + saklama + canlı akış). Kanban, kapılar ve thread zaten hiçbir araçta yok, onlar her hâlükârda bizim.

  **2026-09-04'te doğrulanan gerçekler** (GitHub API üzerinden, bkz. Kaynaklar):

  | Proje | Lisans | Stack | Varsayılan port | Son push | Yıldız |
  |---|---|---|---|---|---|
  | `disler/claude-code-hooks-multi-agent-observability` | **YOK** (`license: null`) | Bun + TypeScript, SQLite (WAL), Vue 3, WebSocket, ayrıca Python scriptleri | sunucu 4000, istemci 5173 | 2026-02-08 | 1529 |
  | `felipeelias/hook-lab` | MIT | **Elixir + Phoenix LiveView + Docker** | 4000 | 2026-08-15 | 9 |

  Doğrulama raporundaki "hafif web panosu" nitelemesi hook-lab için eksikti: proje bir Elixir/Phoenix uygulamasıdır ve önerilen kurulumu Docker'dır.

- **Karar:**
  **Olay sunucusunu kendimiz yazıyoruz** (çıplak `node:http` + JSONL depo + SSE, bkz. `docs/02-architecture.md` §3.2, §5, §6).
  Bu bir "hiçbir şeyi ödünç almıyoruz" kararı **değildir**: her iki projeden de **fikir** düzeyinde yararlanılır (hook olayını POST eden tek dosyalık bağımlılıksız script deseni, olay tipine göre renk/etiketleme, oturum-bazlı gruplama). Kod kopyalanmaz.

  Karar dört maddeye dayanır:

  1. **`disler/...` lisanssızdır.** GitHub'da lisans dosyası olmayan bir depo varsayılan olarak "tüm hakları saklıdır" demektir; fork/adapte etmek yalnızca GitHub ToS'un izin verdiği fork/görüntüleme ile sınırlıdır, türev çalışma üretip kendi projemizde kullanmak için hukuki dayanağımız yoktur. Tek kullanıcılık iç araç olsa bile, App Factory hattı bu depoyu ileride paylaşabilir. Bu tek başına belirleyicidir.
  2. **`hook-lab` stack olarak uyumsuzdur.** Elixir + Phoenix + Docker; bizim bağlayıcı kısıtlarımız "Node/TypeScript, native derleme yok, `npm install` + `npm start` ile çalışsın". Elixir/Erlang çalışma zamanı ve Docker kurmak, kaçınmak için `better-sqlite3`'ü bile elediğimiz kurulum sürtünmesinin kat kat fazlasıdır. Ayrıca panelin asıl değeri olan kanban/kapı katmanını Phoenix LiveView içinde yazmak, ekibin (ve kullanıcının) bildiği stack'in tamamen dışına çıkmak demektir.
  3. **Uyarlama maliyeti, yazma maliyetinden büyüktür.** Bizde kalan iş, disler'in mimarisinden çıkarıldığında şudur: bir POST uç noktası, bir append-only dosya yazıcı, bir SSE yayıncısı, bir normalizer. `docs/02-architecture.md` §6.1/§5.5'teki sözleşmeyle bu ~400 satır kaynak koddur. Buna karşılık uyarlama; Bun→Node, SQLite→JSONL, WebSocket→SSE, Vue→React dönüşümleri demektir — yani dört bileşenin dördünün de değişmesi. Geriye kalan "kopyalanabilir" kısım, kopyalamaya değmeyecek kadar küçülür.
  4. **Bizim gereksinimlerimiz farklıdır.** disler'in olay modeli `docs/features` frontmatter'ı, `docs/approvals` kapıları, `project_id` kayıt defteri, `content_hash` çakışma tespiti ve yazma kapısı kavramlarını bilmez. Olay kaydımızın en kritik alanı (`transcript_path`, `raw` ham payload, `flags`) risk azaltımı için tasarlandı (bkz. `docs/02-architecture.md` §5.1, §9.2); dışarıdan gelen bir şemayı bu ihtiyaçlara büktükçe "uyarlama" fiilen yeniden yazmaya dönüşür.

  **Sonuç olarak doğrulama raporunun bu maddesinin dayanağı, lisans ve stack doğrulandıktan sonra ortadan kalkmıştır.** Rapor "lisans uygunsa" koşulunu zaten koymuştu; koşul sağlanmadı.

- **Alternatifler ve neden reddedildi:**
  - **`disler/...`'i fork'layıp Node/React'e taşımak:** Lisans yok (hukuki engel) + dört bileşenin dördü de değişecek (teknik olarak sıfırdan yazmakla aynı iş). **Red.**
  - **`disler/...`'i olduğu gibi ayrı bir araç olarak yan yana kurmak, Mission Control'ün yalnızca kanban+kapı yapması:** Kullanıcı iki panel, iki port, iki kurulum yönetir; PRD'nin başarı ölçütü "tek yere bakarak 5 saniyede cevap" bunu doğrudan ihlal eder. Ayrıca Bun kurulumu gerektirir. **Red.**
  - **`hook-lab`'ı fork'lamak (MIT, lisans uygun):** Elixir/Phoenix/Docker; Node+React kısıtına ve "kurulum sürtünmesi olmasın" ilkesine aykırı; 9 yıldızlı, tek bakımcılı bir depoya stack bağımlılığı almak riski azaltmaz artırır. **Red.**
  - **`hoangsonww/Claude-Code-Agent-Monitor`'ı (Node/Express/React/SQLite/WS) uyarlamak:** Stack en yakın olan bu. Ancak SQLite (native derleme riski, ADR-003 ile yasaklı), kendi jenerik kanban'ı bizimkiyle çatışan bir kavram (oturum/agent durumu ≠ feature frontmatter'ı) ve masaüstü sürüm bagajı var; lisansı ve bakım durumu doğrulama raporunda "tarih doğrulanamadı" notuyla geçiyor. Uyarlama, kullanılmayan yarısını sökmekle başlardı. **Red** — ama bu depo, olay UI'ı için referans olarak okunabilir.
  - **Claude Code'un yerleşik OTel çıktısı + Prometheus/Grafana:** Grafana yığını kurmak tek kullanıcılık bir iç araç için orantısız; kanban/kapı/thread'i zaten karşılamıyor. **Red** (doğrulama raporu da aynı sonuca varmıştı).
  - **Hook'ları `type: "http"` ile doğrudan sunucuya bağlayıp script yazmamak:** Ayrı bir karar; bkz. **ADR-006**.

- **Sonuçlar / riskler:**
  - Olay sunucusunun bakımı tamamen bizde. Azaltım: yüzey küçük (~400 satır), sözleşme dokümante (`docs/02-architecture.md` §6), birim + entegrasyon testleriyle sabitleniyor.
  - Bir hata sınıfını kendimiz keşfetmek zorundayız (disler'in 1529 yıldızlık kullanım deneyimi bizde yok). Azaltım: olay şeması bilinçli olarak "şemasız" (`raw` her şeyi saklar), yani yanlış modelleme veri kaybına dönüşmez.
  - `disler/...` ileride bir lisans eklerse bu karar yeniden değerlendirilebilir; o noktada bile taşıma maliyeti (madde 3) muhtemelen kararı değiştirmez.
  - **Fikir alma sınırı:** Başka bir depodan kod parçası kopyalanacaksa (lisansı uygun olsa bile) yeni bir ADR gerekir ve kaynak dosya başına atıf yazılır. Bu, PR incelemesinde kontrol edilir.

- **Kullanıcı onayı gerekli mi:** Hayır. Ücret, hesap veya geri alınamaz sonuç içermiyor; G0.ok bu kararı açıkça architect'e devretti. CEO G2 raporunda kararı ve gerekçesini bir cümleyle özetler.

- **Kaynaklar:**
  - `https://api.github.com/repos/disler/claude-code-hooks-multi-agent-observability` — `license: null`, `pushed_at: 2026-02-08`, 1529 yıldız (2026-09-04'te sorgulandı)
  - `https://api.github.com/repos/felipeelias/hook-lab` — `license.spdx_id: MIT`, `language: Elixir`, `pushed_at: 2026-08-15`, 9 yıldız (2026-09-04'te sorgulandı)
  - `docs/00-idea-validation.md` — "Yap-yerine-kullan değerlendirmesi", "MVP'ye öneri"
  - `docs/approvals/G0.ok` — kararın architect'e devri
