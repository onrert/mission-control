# ADR-006: Hook taşıma biçimi — `command` scripti mi, yerleşik `http` hook'u mu

- **Tarih:** 2026-09-04
- **Durum:** kabul

- **Bağlam:**
  `docs/specs/mission-control.md` ve doğrulama raporu, izlenen projeye bir `.claude/hooks/send-event.js` scripti kurulacağını varsayıyordu. Ancak Claude Code hook dokümantasyonu (2026-09-04'te okundu) `type: "command"` dışında **`type: "http"`** adında yerleşik bir handler tipi tanımlıyor:

  ```json
  { "type": "http", "url": "http://localhost:8080/hooks/pre-tool-use",
    "headers": { "Authorization": "Bearer $MY_TOKEN" }, "allowedEnvVars": ["MY_TOKEN"] }
  ```

  Yani hook payload'ı, hiçbir script yazmadan doğrudan sunucumuza POST edilebilir. Bu, `send-event.js`'i tamamen ortadan kaldırabilecek bir sadeleştirmedir ve fabrika "önce basitlik" kuralı gereği ciddiye alınmalıdır.

  Karar kriterleri: (1) izlenen oturumu **asla bloklamamak** — bu ürünün varlık sebebini yok eder; (2) sunucu kapalıyken zararsız olmak; (3) `docs/02-architecture.md` §5.1'deki olay kaydını üretebilmek; (4) kurulum sürtünmesi.

- **Karar:**
  **`type: "command"` + `async: true` + `timeout: 5`** ile tek dosyalık, bağımlılıksız `send-event.js` scripti kullanılır. Tam script tasarımı ve `settings.json` metni: `docs/02-architecture.md` §8.

  Gerekçeler:

  1. **Sunucu kapalıyken davranışı kontrol edebiliyoruz.** `http` hook'unun bağlantı reddi durumunda ne yapacağı bizim elimizde değil; varsayılan `timeout` **600 saniye**dir ve hata davranışı sürüme bağlıdır. Kendi scriptimizde 400 ms'lik kesin bir zaman aşımı, `req.on('error')` yakalaması ve her yolda `process.exit(0)` garantisi var. Panel çoğu zaman kapalı olacak (kullanıcı ihtiyaç duyunca açıyor); bu senaryonun **kesinlikle** zararsız olması gerekiyor.
  2. **`async: true` yalnızca command hook'ta belgelenmiş.** Oturumu hiç bekletmemenin doğrudan yolu bu. `http` hook'unun eşdeğeri dokümantasyonda tanımlı değil.
  3. **Zenginleştirme scriptte yapılıyor.** Ham payload'da olmayan ama bize gereken alanlar: `project_path` (`cwd` yoksa `CLAUDE_PROJECT_DIR`/`process.cwd()` yedeği), `project_name`, `client_ts`, `summary` (olay tipine göre türetilen ≤200 karakterlik özet) ve `MC_MAX_PAYLOAD` kırpması. `http` hook'unda payload olduğu gibi gider; bu işleri sunucuya taşımak mümkün ama o zaman **oversize payload'lar da olduğu gibi ağa çıkar** (bir `Write` PostToolUse olayı megabaytlarca dosya içeriği taşıyabilir). Kırpmanın kaynakta olması doğru yer.
  4. **`MC_DISABLE=1` kaçış kapısı.** Kullanıcı hook'ları settings'ten sökmeden tek ortam değişkeniyle susturabilir. `http` hook'unda karşılığı yok.
  5. **Fabrikada kanıtlanmış desen.** `C:\dev\app-factory\.claude\settings.json` içindeki tüm hook'lar `"command": "node .claude/hooks/<script>"` biçimindedir ve bu ortamda çalıştığı doğrulanmıştır. `http` handler'ının kurulu sürümde desteklendiğini **doğrulayamadık** (kabuk erişimi yok); belgelenmiş olması, kurulu sürümde çalıştığı anlamına gelmiyor.
  6. **Maliyet düşük.** Script ~70 satır, sıfır bağımlılık, tek dosya kopyalama. `npm install` gerektirmez, izlenen projenin `package.json`'ına dokunmaz.

  Ek karar — **sunucu kapalıyken olay kuyruğa alınmaz, sessizce düşer.** Gerekçe `docs/02-architecture.md` §8.4'te: kuyruk, "hook'lar dosyaya yazmaz" tasarımını bozar (ikinci yazar, kilit, kısmi satır, çift gönderim), oysa verinin değeri "şu an ne oluyor"dur ve panel kapalıysa kimse bakmıyordur. Bunun yerine görünürlük eklenir: UI, sunucunun başlangıç zamanını gösterir ve öncesinin kaydedilmediğini belirtir.

- **Alternatifler ve neden reddedildi:**
  - **`type: "http"` ile doğrudan POST (script yok):** En basit görünen seçenek. Reddedilme sebepleri yukarıdaki 1, 2, 3, 4 ve 5. **Red** — ama gelecekte, kurulu sürümde `http` handler'ının bağlantı reddinde hızlı ve sessiz düştüğü ölçülerek doğrulanırsa, bu ADR gözden geçirilmeye değer (kurulumu bir dosya kopyalamadan tamamen kurtarırdı).
  - **`type: "command"` fakat senkron (`async` olmadan):** `timeout: 5` bile en kötü durumda her araç çağrısına 5 saniye ekleyebilir; panelin izlediği oturumu yavaşlatması kabul edilemez ("gözlemci gözlenene zarar vermez"). **Red** — `async` desteklenmiyorsa scriptin kendi 400 ms zaman aşımı üst sınırı sağlar, bu yüzden bu durumda da kabul edilebilir bir taban var.
  - **`type: "mcp_tool"` ile bir MCP sunucusuna yazmak:** MCP sunucusu kurmak, süreç yönetimi ve protokol katmanı eklemek — tek bir POST için orantısız. **Red.**
  - **Hook'un doğrudan JSONL dosyasına yazması (HTTP yok):** Sunucu kapalıyken de veri toplardı. Ama ADR-003'ün "tek yazar" garantisini yok eder: N paralel agent süreci aynı dosyaya append eder, `seq` üretimi merkezi olamaz, retention yarışa girer ve bozuk satır olasılığı artar. Ayrıca izlenen projeye panelin veri yazması gerekirdi (yazma kapısı ihlali) veya `MC_DATA_DIR`'in hook tarafından bilinmesi gerekirdi. **Red.**
  - **Claude Code'un yerleşik OTel çıktısını kullanmak (hook yerine):** Collector + Prometheus/Loki kurulumu gerektirir; `docs/00-idea-validation.md` bunu "ağır altyapı" olarak zaten eledi ve olay bazında `tool_input` detayı vermez. **Red.**

- **Sonuçlar / riskler:**
  - **Kurulum bir adım daha uzun:** izlenen her projeye script kopyalanmalı ve `settings.json` birleştirilmeli. Azaltım: `npm run install-hook -- <proje-yolu>` (F-004) bunu otomatik yapar; `KURULUM.md` elle yapılışını da yazar.
  - **Script sürüm sürüklenmesi:** N projeye kopyalanan script güncellenirse hepsinin güncellenmesi gerekir. Azaltım: olay kaydında `client_version` alanı var; sunucu farklı sürümleri görürse `/api/health.degraded` içinde bildirir, `install-hook` üzerine yazarak günceller.
  - **`async: true` desteklenmiyorsa** hook senkron çalışır; scriptin 400 ms zaman aşımı sayesinde en kötü durum araç çağrısı başına ~0,4 s'dir. F-004 bunu ölçer; ölçüm 1 s'yi aşarsa CEO'ya bildirilir.
  - **Sunucu kapalıyken olaylar kaybolur.** Bilinçli kabul; PRD hiçbir kabul kriterinde "panel kapalıyken toplanan olaylar" istemiyor. README'de açıkça yazılır.
  - Script `stdout`'a **hiçbir şey yazmamalıdır** (exit 0'da stdout bir karar objesi olarak ayrıştırılır). Bu, kod incelemesinde ve entegrasyon testinde ("stdout boş") kontrol edilir.

- **Kullanıcı onayı gerekli mi:** Hayır. Ücret/hesap yok. Ancak izlenen projelerin `.claude/settings.json` dosyalarının **kullanıcı tarafından çalıştırılan bir kurulum komutuyla** değiştirileceği G2 raporunda belirtilir; bu panelin çalışma zamanı yazması değildir ve yazma kapısı kapsamı dışındadır.

- **Kaynaklar:**
  - Claude Code Hooks reference (`https://code.claude.com/docs/en/hooks`) — handler tipleri (`command`/`http`/`mcp_tool`), `async`, `timeout` varsayılanları, olay adları ve stdin alanları; 2026-09-04'te okundu.
  - `C:\dev\app-factory\.claude\settings.json` — bu ortamda çalıştığı doğrulanmış `command` hook kayıt biçimi.
