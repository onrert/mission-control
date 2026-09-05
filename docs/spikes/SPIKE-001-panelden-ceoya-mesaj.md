# SPIKE-001 — Panelden CEO'ya mesaj göndermek mümkün mü?

- **Tarih:** 2026-09-06
- **Tip:** Fizibilite araştırması (spike). **Kod yazılmadı, hiçbir şey kurulmadı, hiçbir süreç başlatılmadı.**
- **Yazan:** architect
- **Durum:** Karar bekliyor (kullanıcı)
- **Kapsam dışı:** mimari tasarım, ADR, feature sözleşmesi. Bu belge yalnızca ölçüm sonucudur.

## Kanıt kuralları (bu belgede uygulanan)

Her iddia üç kaynak tipinden birine dayanır:

| İşaret | Anlamı |
|---|---|
| **[R]** | Resmî Anthropic/Claude Code dokümanı, URL + erişim tarihi verildi |
| **[Y]** | Bu makinede okunan yerel dosya, `yol:satır` verildi |
| **[T]** | Tahmin / çıkarım — **doğrulanmadı**, nasıl doğrulanacağı §5'te |

Blog ve forum kaynakları **[?]** ile işaretlendi ve hiçbir kararın dayanağı değildir.

Tüm resmî doküman erişimleri **2026-09-06** tarihinde yapıldı.

**Ölçüm sınırı:** bu tur kabuk erişimi olmadan yürütüldü — `claude --version` ve `claude mcp list`
**çalıştırılamadı**. Sürüm ve MCP yapılandırması diskteki yapılandırma dosyalarından okundu (§2.5).
Bu bir zayıflıktır ve §5'te açıkça listelenmiştir.

---

## §1 — Soru ve neden soruldu

**Soru:** Mission Control panelinden, çalışan CEO Claude Code oturumuna mesaj göndermek mümkün mü?
Hangi biçimde, hangi gecikmeyle, hangi maliyetle?

**Kullanıcının istediği deneyim:** panelde CEO ile konuşulabilecek bir yer — *"yeni bir app
istiyorum"*, *"şunu neden böyle yaptın"* gibi.

**Neden şimdi soruluyor:** bu yetenek projenin kendi belgelerinde **v2** olarak işaretli ve
**G0'da bilinçli olarak kapsam dışı** bırakılmıştı. Kullanıcı öne çekmeyi düşünüyor ama önce
ölçmek istiyor.

İki bağlayıcı alıntı:

> **v2** — Panodan CEO'ya mesaj: Claude Code Channels protokolüyle özel kanal (MCP sunucusu).
> — `docs/specs/mission-control.md:23` **[Y]**

> **Kesinlikle olmayacaklar:** dış servis/bulut/hesap/giriş yok · … · **Claude Code'a komut
> gönderme yok (v2'de Channels ile ayrı ele alınacak)** · …
> — `docs/00-idea.md:16` (G0'da onaylı) **[Y]**

Yani bu spike'ın çıktısı yalnızca "teknik olarak mümkün mü" değil, aynı zamanda **onaylı bir G0
kısıtını gevşetmenin bedeli ne** sorusuna da cevap vermek zorunda (§2.6).

---

## §2 — Bulgular

### 2.1 — "Claude Code Channels" gerçek mi? **EVET, gerçek ve resmî.**

Spec'teki ifade kullanıcının varsayımı değil; **doğrulanmış resmî bir özelliktir**.

- Resmî doküman: <https://code.claude.com/docs/en/channels> — *"Push events into a running session
  with channels"* **[R]**
- Protokol referansı: <https://code.claude.com/docs/en/channels-reference> — *"Build an MCP server
  that pushes webhooks, alerts, and chat messages into a Claude Code session."* **[R]**

Tanım, dokümanın kendi cümlesiyle:

> A channel is an MCP server that pushes events into your running Claude Code session, so Claude
> can react to things that happen while you're not at the terminal.
> — channels **[R]**

Doğrulanmış nitelikler:

| Nitelik | Kanıt |
|---|---|
| **Durum: research preview** | *"Channels are a research preview feature. Availability is rolling out gradually, and the `--channels` flag syntax and protocol contract **may change** based on feedback."* **[R]** |
| Hazır kanallar | Telegram, Discord, iMessage + `fakechat` (yerel demo) **[R]** |
| Kimlik doğrulama | *"They require Anthropic authentication through claude.ai or a Console API key"* **[R]** |
| Çalışmadığı yerler | *"not available on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry"* **[R]** |
| Bayraklar gizli | *"Neither `--channels` nor `--dangerously-load-development-channels` appears in `claude --help` while the feature is in preview. The flags work even though they aren't listed."* **[R]** |

**Sürüm tabanı bulunamadı.** Resmî changelog (<https://code.claude.com/docs/en/changelog>,
erişim 2026-09-06) taraması **"channel" veya "--channels" için hiçbir kayıt döndürmedi** **[R]** —
yani özelliğin hangi sürümde geldiği resmî sürüm notlarında **belgelenmemiş**. Bazı bloglar
"2.1.80+" diyor **[?]** ama bu doğrulanamadı ve hiçbir karara dayanak yapılmadı. Doğrulanabilir
olan: protokol referansı `v2.1.211` ve `v2.1.234` için davranış farkları anlatıyor **[R]**, yani
özellik bu sürümlerden **önce** de vardı.

Aynı bloglar "API anahtarları desteklenmiyor" diyor **[?]**; **resmî doküman bunun aksini söylüyor**
(*"claude.ai or a Console API key"*) **[R]**. Blog kaynağı bu yüzden güvenilmez sayıldı.

**Yerel doğrulama:** kanal eklentileri bu makinede **zaten mevcut** — resmî marketplace senkron:
- `C:\Users\pc\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\fakechat\.mcp.json` **[Y]**
- aynı dizinde `telegram\`, `discord\`, `imessage\` **[Y]**

`fakechat\.mcp.json` içeriği (bir kanalın nasıl kaydedildiğini gösteriyor) **[Y]**:

```json
{ "mcpServers": { "fakechat": { "command": "bun",
  "args": ["run", "--cwd", "${CLAUDE_PLUGIN_ROOT}", "--shell=bun", "--silent", "start"] } } }
```

### 2.2 — Çalışan bir oturuma dışarıdan sıra (turn) enjekte edilebilir mi? **EVET — ama yalnızca kanal ile.**

Bu, kanalın **tam olarak var oluş sebebi**:

> Unlike integrations that spawn a fresh cloud session or wait to be polled, **the event arrives in
> the session you already have open**.
> — channels **[R]**

Dokümanın kendi karşılaştırma tablosu, diğer tüm yolların bunu yapamadığını açıkça söylüyor **[R]**:

| Yol | Dokümanın ifadesi | Sıra enjekte eder mi? |
|---|---|---|
| **Channels** | *"pushing events from non-Claude sources into your already-running local session"* | **Evet** |
| Standard MCP server | *"Claude queries it during a task; **nothing is pushed to the session**"* | **Hayır** |
| Claude Code on the web | *"Runs tasks in a **fresh cloud sandbox**"* | Hayır (yeni oturum) |
| Claude in Slack | *"**Spawns a web session** from an `@Claude` mention"* | Hayır (yeni oturum) |
| Remote Control | *"You drive your local session from claude.ai or the Claude mobile app"* | Evet, ama insan yazar (§2.4) |

**Ama üç sert koşul var** **[R]**:

1. **Oturum açık olmalı.** *"Events only arrive while the session is open."*
2. **Oturum `--channels` ile başlatılmış olmalı.** *"Being in `.mcp.json` isn't enough to push
   messages: a server also has to be named in `--channels`."* → mevcut CEO oturumuna **sonradan
   kanal takılamaz**; oturumun yeniden başlatılması gerekir.
3. **Özel (bizim yazacağımız) kanal, önizleme süresince onay listesinde değil.**
   *"During the research preview, custom channels aren't on the approved allowlist. Use
   `--dangerously-load-development-channels` to test locally."* Ve başlangıçta
   *"a full-screen warning dialog"* çıkıyor; kullanıcı **her açılışta** *"I am using this for local
   development"* seçmek zorunda. **[R]**

Bu üçüncü madde kritik: Mission Control'ün kendi kanalı **hiçbir zaman** `--channels` ile temiz
şekilde çalışmaz; `--dangerously-load-development-channels` gerekir. Doküman bunu kalıcı sayıyor:
*"During the research preview, the approved allowlist is Anthropic-curated, so **your channel stays
on the development flag while you build and test**."* **[R]**

### 2.3 — MCP yaklaşımının gerçekçi gecikmesi

**Önce ayrımı netleştirelim: "MCP sunucusu" tek başına bu işi yapmaz.**

Sıradan bir MCP sunucusu **çekme (pull)** modelidir: CEO ancak kendisi bir tool çağırmayı seçerse
mesajı görür — yani panel mesaj bıraksa bile CEO'nun onu görmesi **modelin o an o tool'u çağırmayı
akıl etmesine** bağlıdır. Doküman: *"Claude queries it during a task; nothing is pushed to the
session."* **[R]** Bu, kullanıcının istediği deneyimi **vermez**.

Kanal ise **itme (push)** modelidir. Gecikme, dokümanın tek cümlesinde tanımlı **[R]**:

> **Events queue into the session and are processed in order. If several notifications arrive while
> Claude is busy, they're delivered together on the next turn and Claude handles them as a group.**

Bunu bu projenin gerçek çalışma düzenine çevirirsek:

| CEO oturumunun durumu | Mesaj ne zaman görünür | Pratik gecikme |
|---|---|---|
| **Boşta** (kullanıcı girdisi bekliyor) | Hemen — mesaj gelir ve CEO **kendiliğinden** bir tura başlar | Saniyeler **[R]** |
| Kısa bir tur ortasında (dosya okuyor) | O tur bitince | Saniyeler–dakika **[R]** |
| **Alt agent turu ortasında** (developer/QA `Task` içinde) | `Task` dönene kadar **hiç** | **On dakikalar** **[T]** |

Üçüncü satır bu proje için en önemlisi ve **[T]** işaretli: doküman "busy → next turn" diyor **[R]**;
bir `Task` çağrısının CEO'nun turunu on dakikalarca meşgul ettiği ise bu deponun kendi kaydından
bilinen bir olgu (ör. `docs/progress.md`'de tek feature turlarının süresi ve *"Alt agent 150 tur
sınırına takılabilir"* dersi, `CLAUDE.md`) **[Y]**. İkisinin birleşimi ölçülmedi.

**Sessiz düşme — bu projenin en pahalı hata sınıfı.** Doküman **[R]**:

> Claude Code doesn't acknowledge notifications. The `await` on `mcp.notification()` resolves when
> the message is written to the transport, not when Claude has processed it. **If the session hasn't
> loaded your server as a channel, or the organization policy blocks it, Claude Code drops the
> events silently and returns no error to your server.**

Yani panel "gönderdim" diyebilir ve mesaj **hiçbir yere gitmemiş** olabilir. Bu, `CLAUDE.md`'de
kayıtlı en pahalı dersle birebir aynı sınıf: *"Script tasarım gereği sessizce başarısız oluyor
(ADR-006), yani olay akışı durur ve kimse fark etmez — bu projenin en pahalı hata sınıfı"*
(`ADR-013` eki) **[Y]** ve bütün hook'ların haftalarca ölü koşması **[Y]**. Bir uygulama bu
riski **tasarımla** karşılamak zorundadır (doküman öneriyor: *"If you need delivery confirmation,
track event state in your server and expose a reply tool that Claude can call to report status
back."*) **[R]**

**İyi haber — iki yönlü çalışıyor.** Kanal bir `reply` tool'u açarsa CEO cevabı aynı kanaldan geri
gönderebilir; yani panelde gerçek bir sohbet mümkün **[R]**. Uyarı: *"When Claude replies through a
channel, you see the inbound message in your terminal but not the reply text."* **[R]**

**Protokol sözleşmesi (özet)** — bir kanal sunucusunun yapması gerekenler **[R]**:

1. `capabilities.experimental['claude/channel'] = {}` bildir (dinleyiciyi kaydeder)
2. `notifications/claude/channel` bildirimi yayınla; `params.content` (gövde) + `params.meta`
   (etiket öznitelikleri; anahtarlar yalnızca harf/rakam/alt çizgi olabilir, tireli anahtarlar
   **sessizce düşürülür**)
3. **stdio** üzerinden bağlan — *"Claude Code spawns it as a subprocess and communicates over stdio"*

Mesaj CEO'nun bağlamına şu biçimde düşer **[R]**:

```text
<channel source="mission-control" chat_id="7">yeni bir app istiyorum</channel>
```

Çalışma zamanı gereksinimi **[R]**: *"The only hard requirement is the
`@modelcontextprotocol/sdk` package and a Node.js-compatible runtime. Bun, Node, and Deno all
work."* — yani **Bun zorunlu değil**; hazır eklentiler Bun kullanıyor ama bizim kanalımız Node ile
yazılabilir. Bu, `ADR-009` (Windows-only) ve "native derleme yok" kısıtı açısından iyi haber.

**Mimari sonuç (çoğu kişinin gözden kaçırdığı):** kanal sunucusunu **panel başlatmaz — Claude Code
başlatır**, kendi alt süreci olarak **[R]**. Yani panel (`:7333`) ile kanal sunucusu iki ayrı
süreçtir ve birbirlerine yerel bir port üzerinden konuşmak zorundadır (dokümanın örneği kanalın
`127.0.0.1:8788`'de kendi HTTP dinleyicisini açmasıdır) **[R]**. Bunun doğrudan sonucu: **CEO
oturumu kanal bayrağıyla açık değilse panelin POST'u bağlantı reddi alır** — panel bu durumu
dürüstçe göstermek zorundadır ("kanal bağlı değil").

### 2.4 — Alternatif mekanizmalar

#### (a) Hook'lar bir "gelen kutusu" dosyası okuyabilir mi? — Kısmen, ve **boştayken hayır**.

- `SessionStart` → `additionalContext` enjekte edebilir: *"added to Claude's context at session
  start"* **[R]**. Yalnızca oturum başında/`resume`/`PostCompact`'te ateşler → **oturum başına bir
  kez**.
- `UserPromptSubmit` → `additionalContext` enjekte edebilir: *"added to Claude's context before
  Claude processes the prompt"* **[R]**. Ama yalnızca **kullanıcı bir şey yazdığında** ateşler —
  yani kullanıcı zaten terminaldedir; panelden konuşma sorununu çözmez.
- `Stop` → **tek gerçek "devam ettir" kolu**: `{"block": true, "reason": "…"}` çıktısı
  *"prevents Claude from stopping, continues the conversation"* ve `reason` *"shown to Claude in a
  system message"* **[R]**. Yani her turun sonunda gelen kutusu okunabilir; doluysa mesaj `reason`
  olarak enjekte edilip oturum devam ettirilebilir.
- **Boşta ateşleyen hook yok.** Resmî dokümana göre oturum kullanıcı girdisi beklerken ateşleyen
  bir olay yoktur **[R]**.

**Bunun anlamı:** `Stop` kolu, CEO **çalışırken** gelen mesajı tur sonunda yakalar. Ama CEO boşta
kaldığı anda `Stop` zaten ateşlenip izin vermiştir ve **bir daha hiçbir şey ateşlemez** — o andan
sonra gelen mesaj, kullanıcı terminale bir şey yazana kadar bekler. Yani bu mekanizma
"panelden konuşma" değil, **"çalışan CEO'ya sıraya iş bırakma"**dır.

Ek risk: `stop_hook_active` alanı ve sonsuz döngü tehlikesi **[R]**; ve bu depoda `stop-check`
hook'unun zaten yanlış pozitif ürettiği kayıtlı (`CLAUDE.md`: *"`stop-check` … düzeltme turu arkada
çalışırken bekleyen oturumu ayırt edemiyor; her turda yanlış pozitif üretiyor"*) **[Y]**.

#### (b) `claude -p` / headless — **yeni oturum açar, CEO bağlamını görmez.**

- `claude -p "…"` yeni bir oturum başlatır ve çıkar **[R]**.
- `--continue` / `--resume` **çalışan sürece bağlanmaz**; geçmişi **yeni bir sürece** yükler **[R]**.
- `claude attach <id>` yalnızca arka plan oturumuna **terminalden interaktif** bağlanmaktır,
  programatik mesaj enjeksiyonu değildir **[R]**.

Sonuç: *"şunu neden böyle yaptın"* sorusu için işe yaramaz — soru tam olarak **o oturumun
bağlamına** sorulmak isteniyor.

#### (c) Dosya tabanlı gelen kutusu + CEO'nun tur başında okuması

Bu depoda deseni zaten var (`docs/blockers.md`, `docs/approvals/*`, `docs/progress.md` — CEO'nun
oturum başında okuduğu dosyalar; `session-start.cjs` hook'u bunu yapıyor) **[Y]**. Panel bir
`docs/inbox/*.md` yazsa, CEO **bir sonraki turunun başında** görür.

Dürüst değerlendirme: bu **mesajlaşma değil, kuyruğa iş bırakmaktır**. Kullanıcı yine terminale
dönüp Enter'a basmak zorundadır. "Yeni bir app istiyorum"u kaydetmek için yeterli, "şunu neden
böyle yaptın" için **yetersiz**.

#### (d) Remote Control — **resmî cevabı var, ama buluta bağlı.**

<https://code.claude.com/docs/en/remote-control> **[R]**: claude.ai veya mobil uygulamadan
**yerel** oturumu sürmeyi sağlar; kod ve dosya erişimi makinede kalır. Ama:

- *"available on Pro, Max, Team, and Enterprise plans. **API keys are not supported**"* **[R]**
- *"Remote Control requires access to the Anthropic API on port 443"* **[R]**

Yani sohbet trafiği Anthropic bulutundan geçer. Bu, `docs/00-idea.md:16`'nın *"dış servis/bulut/
hesap/giriş yok"* kısıtıyla **doğrudan çelişir** **[Y]** — ve panelin kendisi devre dışı kalır
(arayüz Mission Control değil, claude.ai olur). Kullanıcının istediği "**panelde** bir yer" değil.

#### (e) Başka IPC yolu — **bulunamadı.**

Çalışan Claude Code sürecine sıra enjekte eden başka resmî bir arayüz (named pipe, soket, CLI
alt komutu) **resmî dokümanlarda bulunamadı**. Doküman kendi karşılaştırma tablosunda (§2.2)
seçenekleri tüketici biçimde sayıyor ve kanalı *"fill the gap in that list"* diye tanımlıyor
**[R]**. Belgelenmemiş bir yol olabilir; **arayıp bulamadım, yok olduğunu kanıtlayamam**.

### 2.5 — Bu depoda kurulu MCP sunucuları ve Claude Code sürümü

**Kurulu Claude Code sürümü: `2.1.205`** **[Y]**

- `C:\Users\pc\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\package.json:3` → `"version": "2.1.205"`
- `…\node_modules\@anthropic-ai\claude-code-win32-x64\package.json:3` → `"version": "2.1.205"` (yerel ikili)

⚠️ **Bu değer komutla doğrulanmadı** (`claude --version` çalıştırılamadı, §5). Ve bir uyarı işareti
var: `C:\Users\pc\.claude\.last-update-result.json` **[Y]**:

```json
{"timestamp":"2026-07-09T17:59:34.348Z","path":"npm-global","outcome":"failed",
 "status":"install_failed","version_from":"2.1.158","version_to":"2.1.205",
 "error_code":"update_apply_exe_locked"}
```

Yani 2026-07-09'da 2.1.205'e güncelleme **`claude.exe` kilitli olduğu için başarısız oldu**; npm
paket meta verisi 2.1.205 gösteriyor ama çalışan ikilinin gerçekten 2.1.205 olduğu **kanıtlanmadı**
**[T]**.

**En güncel sürüm: `2.1.261` (2026-09-04)** — resmî changelog'un en üstteki kaydı **[R]**. Yani
kurulu sürüm **en az 56 yama geride**.

Bu geriliğin **somut bir güvenlik sonucu var** (§2.6): protokol referansı diyor ki *"Claude Code
**v2.1.234 and later** sends permission requests **only to servers it registered as channels for
the session**"* **[R]**. 2.1.205 < 2.1.234 → bu makinede izin isteklerinin dağıtımı daha gevşek
**[T]** (dokümanın cümlesinden çıkarım; ölçülmedi).

**Bu projede kurulu MCP sunucusu: YOK.** **[Y]**

- `C:\dev\apps\mission-control\.mcp.json` → **dosya yok** (Glob, sonuç boş)
- `C:\Users\pc\.claude.json:1531-1539` → proje kaydı:
  ```json
  "C:\\dev\\apps\\mission-control": {
    "allowedTools": [], "mcpContextUris": [],
    "enabledMcpjsonServers": [], "disabledMcpjsonServers": [],
    "hasTrustDialogAccepted": true, …
  }
  ```
  `mcpServers` anahtarı **hiç yok**, etkin MCP json sunucusu listesi **boş**.
- `C:\dev\apps\mission-control\.claude\settings.json` → `mcpServers` bölümü **yok**; yalnızca
  `Bash(claude mcp *)` ve `Bash(claude plugin *)` izinleri var (satır 47-48) **[Y]**. Ayrıca bir
  `mcp__higgsfield__.*` hook eşleştiricisi var (satır 121) — o sunucu bu projede **tanımlı değil**,
  yalnızca varlığı hâlinde devreye girecek bir koruma **[Y]**.

**Bu makinede başka projelerde tanımlı MCP sunucusu var:** `knowhow` adlı bir HTTP sunucusu
(`http://127.0.0.1:27123/mcp`), üç ayrı kapsamda — `C:/Users/pc/Desktop/reddit-analyzer`,
`C:/Users/pc/Documents/Obsidian Vault/Onur 2.0`, `C:/Users/pc` (`~/.claude.json:1011`, `1097`,
`1183`) **[Y]**. Mission Control kapsamında **etkin değil**. *(Yan gözlem, bu spike'ın kapsamı
dışında: bu kayıtlarda bir Bearer token düz metin duruyor — değeri bu belgeye kopyalanmadı.)*

**Kanal altyapısı hazır durumda:** resmî marketplace bu makinede senkron ve dört kanal eklentisi
diskte mevcut (§2.1) **[Y]**. Yani `fakechat` denemesi için **indirilecek yeni bir şey yok** —
yalnızca Bun gerekiyor (hazır eklentiler Bun script'i) **[R]**; Bun'ın kurulu olup olmadığı
**ölçülmedi** (§5).

### 2.6 — Güvenlik ve kapsam etkisi

Bu, spike'ın en ağır bulgusu. **Teknik fizibilite kolay kısım; asıl bedel burada.**

#### (1) G0 kısıtı — gevşetme kullanıcı kararıdır

`docs/00-idea.md:16` *"Claude Code'a komut gönderme yok"* der ve parantez içinde **"v2'de Channels
ile ayrı ele alınacak"** diye devam eder **[Y]**. Yani bu, ihlal değil, **önceden tanınmış bir
kapı**. Ama G0 onaylı bir belgedir; kapıyı açmak `PROCESS.md` anlamında bir **kapsam değişikliğidir
ve kullanıcı onayı ister** (emsal: `ADR-009` — *"kapsam daraltmasıdır, PROCESS §3 gereği soruldu"*)
**[Y]**.

#### (2) Yeni bir yetki sınıfı — ADR-005'in tamamından daha güçlü

`ADR-005` panelin yazma yetkisini **niyet düzeyinde dört işleme** hapsediyor ve *"Genel
`write(path, content)` fonksiyonu yoktur"* diyor **[Y]**. Bir kanal bu beyaz listeyi **delmez** —
izlenen projelere hiçbir şey yazmaz.

Ama sonuç şudur: **panel, CEO agent'ının önüne serbest metin koyabilir hâle gelir. CEO ise her şeyi
yazabilir ve çalıştırabilir.** Yani kanal, ADR-005'in koruduğu sınırın **etrafından dolaşır**:
panelin doğrudan yazma yetkisi dört dosyayla sınırlı kalır, ama **dolaylı** yetkisi CEO'nun tüm
yetkisi kadar olur. Bu, kanalın uygulanması hâlinde ADR'ye **açıkça yazılması gereken** bir
gerçektir; sessizce geçilirse `ADR-005`'in tehdit modeli yanlış kalır.

#### (3) Prompt injection — dokümanın kendi uyarısı + bu projenin bilinen artık riski

Protokol referansı **[R]**:

> **An ungated channel is a prompt injection vector. Anyone who can reach your endpoint can put text
> in front of Claude.** … Gate on the sender's identity, not the chat or room identity.

Bunu bu deponun kendi kabul edilmiş artık riskiyle birleştirin — `ADR-013` **[Y]**:

> Kabul edilen artık risk şuydu: **aynı makinede çalışan başka bir yerel sayfa** … panele istek
> atabilir.

Bugün bu riskin etkisi sınırlı (olay kaydının kirlenmesi, ya da `ADR-013`'ün `x-mc-write`
başlığıyla kapatılmış yazma uçları). **Kanal eklenirse etki değişir:** kötü niyetli ya da sadece
dikkatsiz bir yerel sayfa, panelin mesaj ucuna POST atarak **CEO'ya talimat verebilir**.

Sonuç: bir mesaj ucu **`ADR-013`'ün `x-mc-write` kuralına tabi olmak zorundadır** ve
`POST /api/events` gibi bir muafiyet **alamaz** — çünkü o muafiyetin gerekçesi *"bu uca yazan
istemci `send-event.cjs` hook'udur, bir tarayıcı değildir"* idi **[Y]**; mesaj ucunun istemcisi ise
tam olarak panelin kendi tarayıcı arayüzüdür.

#### (4) İzin aktarımı (permission relay) — **bildirilmemeli**

Kanal `claude/channel/permission` yeteneğini bildirirse Claude Code araç onay diyaloglarını kanala
aktarır ve kanaldan gelen `allow`/`deny` **yerel diyalog kadar geçerli** olur **[R]**. Doküman:
*"Anyone who can reply through the channel can approve or deny tool use in your session."* **[R]**

Bu, `CLAUDE.md`'nin *"Geri alınamaz işlem … her zaman kullanıcı onayı ister"* kuralını ve
`gate-check.cjs`/`block-dangerous.cjs` hook zincirini **bypass edebilecek** bir yüzeydir **[Y]**.
Ayrıca kurulu sürüm 2.1.234'ün altında (§2.5), yani bu alandaki sıkılaştırma **bu makinede yok**
**[T]**. **Öneri: bu yetenek asla bildirilmemeli** ve bu bir ADR maddesi olmalı.

#### (5) ADR-009 (Windows-only) ve yeni bağımlılık

- **Windows sorunu yok:** kanal sunucusu Node ile yazılabilir **[R]**, Bun zorunlu değil.
- **Yeni bağımlılık var:** `@modelcontextprotocol/sdk` **[R]**. Bu deponun mevcut üretim
  bağımlılıkları yalnızca 5 paket (`@dnd-kit/core`, `chokidar`, `react`, `react-dom`, `yaml`)
  **[Y]** ve `ADR-009`'un sonucu *"native derleme gerektiren bağımlılık yok"* güvencesi
  `tests/deps.test.ts` ile çitleniyor **[Y]**. SDK'nın saf JS olup olmadığı **ölçülmedi** **[T]**
  — `npm install` yasak olduğu için doğrulanamadı (§5).
- **Süreç sahipliği değişir:** kanal sunucusunu `npm run dev` değil **Claude Code** başlatır **[R]**
  → `scripts/check-ports.mjs` ve `predev` kilidi bu süreci görmez; ayrı bir port daha yönetilecek.
- **Başlatma ritüeli değişir:** CEO oturumu artık `claude --dangerously-load-development-channels
  server:mission-control` ile açılmak zorunda ve her açılışta tam ekran uyarıyı onaylamak gerekir
  **[R]**. Depoda bir `.claude/launch.json` var **[Y]**; bu ritüelin oraya yansıması gerekir.

#### (6) Önizleme riski

*"the `--channels` flag syntax and protocol contract **may change** based on feedback"* **[R]**.
Bu, `docs/00-idea-validation.md`'nin en yüksek riskiyle **aynı sınıftır**: transkript formatının
belgesiz ve sürümle değişebilir olması (YÜKSEK risk olarak kaydedilmiş) **[Y]**. Yani proje bu tip
bir kırılganlığı **daha önce ölçüp fiyatlamış** durumda ve nasıl davranacağını biliyor:
*"best-effort, kırılırsa paneli çökertme"* **[Y]**.

---

## §3 — Seçenekler tablosu

Maliyet birimi: bu hattın gerçek temposu — **1 feature ≈ 1 gün** (sözleşme turu + kod turu + QA +
düzeltme turu; `docs/progress.md`'deki F-001…F-006 kayıtlarından) **[Y]**.

| # | Seçenek | Nasıl çalışır | Gerçekçi gecikme | Maliyet | Teknik risk | Kısıtlarla çatışma |
|---|---|---|---|---|---|---|
| **A0** | **`fakechat` ile doğrulama** (kod yok) | Zaten diskte olan resmî eklenti; CEO oturumu `claude --channels plugin:fakechat@claude-plugins-official` ile açılır, `localhost:8787`'de kendi web arayüzünden yazılır | Boşta **anında**; meşgulken sonraki tur **[R]** | **~1 saat**, 0 feature | Çok düşük. Onay listesinde olduğu için `--dangerously…` bayrağı **gerekmez** **[R]**. Bun gerekir **[R]** | **Yok.** Yerel, dış servis yok. Panelle ilgisi yok — yalnızca mekanizmayı kanıtlar |
| **A** | **Kendi kanalımız** (spec'in v2'si) | Node MCP sunucusu, `claude/channel` yeteneği + `reply` tool'u; panel `127.0.0.1:<port>`'a POST eder; CEO'nun bağlamına `<channel>` etiketi düşer | Boşta **anında**; kısa tur içinde **saniyeler–dakika**; **alt agent turu içinde on dakikalar** **[R]+[T]** | **2 feature ≈ 2 gün** (kanal sunucusu + panel sohbet ekranı), + 0.5 gün ADR/sözleşme | **Orta-yüksek.** Önizleme sözleşmesi değişebilir **[R]** · her açılışta `--dangerously-load-development-channels` + tam ekran uyarı **[R]** · sessiz düşme, teslim onayı yok **[R]** · yeni bağımlılık **[T]** | **G0 kısıtını gevşetir** (kullanıcı onayı şart) · `ADR-005`'in etrafından dolaşan yeni yetki sınıfı · `ADR-013` `x-mc-write` **zorunlu** · başlatma ritüeli değişir |
| **B** | **`Stop` hook + gelen kutusu** | Panel `data/inbox/*.json` yazar; `Stop` hook'u okur, doluysa `{"block":true,"reason":"<mesaj>"}` döner → oturum durmaz, mesajı işler | **CEO çalışıyorsa** o turun sonunda. **CEO boştaysa hiç** — kullanıcı Enter'a basana kadar **[R]** | **1 feature ≈ 1 gün** | **Orta.** Sonsuz döngü/`stop_hook_active` tuzağı **[R]** · bu depoda `stop-check` zaten yanlış pozitif üretiyor **[Y]** · hook'ların sessizce ölme geçmişi var **[Y]** | G0 kısıtını **yine gevşetir** (aynı yetki sınıfı) · yeni bağımlılık **yok** · Windows sorunu yok |
| **C** | **Dosya kuyruğu, CEO tur başında okur** | Panel `docs/inbox/`'a yazar; `session-start.cjs` ve/veya CEO turu başında okur (mevcut `blockers.md`/`progress.md` deseni) **[Y]** | **Kullanıcı terminale dönene kadar hiç** | **~0.5 feature ≈ yarım gün** | **Düşük.** Mevcut desenin aynısı | `ADR-005` beyaz listesine **1 yol eklenir** (ADR + manifest testi güncellemesi gerekir **[Y]**) · G0 kısıtı fiilen gevşemez (komut değil, not) |
| **D** | **Remote Control** | claude.ai / mobil uygulamadan yerel oturum sürülür | Anında **[R]** | **0 gün kod** | Düşük (resmî, önizleme değil) | **G0 ile doğrudan çelişir:** bulut + hesap + Anthropic API:443 **[R][Y]** · panel devre dışı kalır — istenen "panelde bir yer" değil |
| **E** | **`claude -p` / `--resume`** | Panel yeni bir headless oturum açar | — | 1 feature | Düşük | **İşi yapmaz:** yeni oturum, CEO bağlamı yok **[R]**. *"Şunu neden böyle yaptın"* cevaplanamaz |

**Doğrudan elenenler:** **E** (soruyu yapısal olarak cevaplayamıyor) ve **D** (G0'ın en net
kısıtıyla çelişiyor, üstelik istenen ürünü vermiyor).

---

## §4 — Öneri

**Yapılabilir. Ama bugün başlatılmasını önermiyorum — üç aşamalı, kapıya bağlı bir yol öneriyorum.**

### Aşama 0 — Önce mekanizmayı kanıtla (Seçenek A0, ~1 saat, kod yok)

**Bunu kod yazmadan önce yapın.** `fakechat` bu makinede zaten kurulu **[Y]** ve onay listesinde
olduğu için tehlikeli bayrak gerektirmiyor **[R]**. Tek oturumluk bir deneme şu üç bilinmeyeni
**ölçerek** kapatır:

1. Kurulu 2.1.205'te kanallar **gerçekten çalışıyor mu** (sürüm tabanı belgesiz, §2.1)
2. **Alt agent turu sırasında** gönderilen mesaj ne kadar bekliyor — bu, A seçeneğinin ürün değerini
   belirleyen tek sayı (§2.3, `[T]` işaretli satır)
3. Bun kurulu mu (§5)

Bu ölçüm olmadan A seçeneğine feature bütçesi ayırmak, ölçülmemiş bir varsayıma 2 gün yatırmaktır.

### Aşama 1 — Ölçüm iyiyse: Seçenek A, ama Faz 2'nin sonunda

**Neden A (B veya C değil):** kullanıcının istediği iki cümleden ikincisi — *"şunu neden böyle
yaptın"* — **bir sohbettir**, kuyruğa iş bırakmak değil. B ve C bunu veremez: B, CEO boştayken hiç
ateşlemez (§2.4a); C, kullanıcının zaten terminalde olmasını gerektirir. **Yalnızca A, dokümanın
kendi ifadesiyle "the event arrives in the session you already have open" garantisini verir** **[R]**.

**Neden şimdi değil:** A'nın maliyeti 2 gün değil, **2 gün + kalıcı bir ritüel vergisi**. Her CEO
oturumu `--dangerously-load-development-channels` ile ve tam ekran uyarı onaylanarak açılacak
**[R]**; sözleşme önizlemede ve değişebilir **[R]**; kurulu sürüm 56 yama geride **[Y]**. Faz 1/Faz
2 işleri bitmeden bu vergiyi ödemek, `CLAUDE.md`'nin *"tek seferde tek feature"* kuralına ve
Karpathy §2'ye aykırı.

**Koşullar (uygulanırsa ADR'ye girmesi gerekenler):**

1. **G0 kapısı açıkça gevşetilir** — kullanıcı onayı, `docs/00-idea.md:16` güncellenir.
2. **Önce `claude update` ile ≥ 2.1.234'e çıkılır** — izin isteği dağıtımının sıkılaştığı sürüm
   **[R]**; kurulu sürüm altında **[Y]**. (Not: 2026-07'deki güncelleme `exe kilitli` diye
   başarısız olmuştu **[Y]** — Claude Code kapalıyken denenmeli.)
3. **`claude/channel/permission` yeteneği asla bildirilmez** (§2.6/4).
4. **Mesaj ucu `ADR-013`'ün `x-mc-write` kuralına tabidir**, `POST /api/events` benzeri muafiyet
   almaz (§2.6/3).
5. **Gönderen çitlenir** — dokümanın *"gate on the sender's identity"* kuralı **[R]**; bu tek
   kullanıcılı yerel araçta karşılığı `x-mc-write` + `Host`/`Origin` zinciridir.
6. **Sessiz düşme tasarımla karşılanır** — `reply` tool'u ile teslim onayı **[R]**; panel "kanal
   bağlı değil" durumunu dürüstçe gösterir. Bu deponun en pahalı hata sınıfı tam olarak budur
   **[Y]**.
7. **Kırılganlık kabul edilir:** *"best-effort, kırılırsa paneli çökertme"* — `docs/00-idea.md:23`'ün
   transkript riski için verdiği kararın aynısı **[Y]**.

### Aşama 2 — Ölçüm kötüyse (ya da kullanıcı bugün bir şey istiyorsa): Seçenek C

Aşama 0'da gecikme kabul edilemez çıkarsa (ör. alt agent turları mesajı 40 dakika bekletiyorsa),
A'nın ürün değeri çöker. O durumda **C** dürüst asgari çözümdür: panelden *"yeni bir app istiyorum"*
notu bırakılır, CEO bir sonraki turunda görür. Yarım gün, yeni bağımlılık yok, `ADR-005` beyaz
listesine tek yol eklenir. **Ama bunun bir sohbet olmadığı kullanıcıya açıkça söylenmelidir** —
arayüzde "mesaj kutusu" değil "CEO'ya not" denmelidir.

**Seçenek B'yi önermiyorum:** A ile aynı yetki sınıfını açıyor, A'nın deneyimini vermiyor, ve bu
depoda hook katmanının kırılgan olduğu iki kez kanıtlandı (tüm hook'ların haftalarca ölü koşması;
`stop-check`'in yanlış pozitifleri) **[Y]**.

---

## §5 — Bilinmeyenler (ölçemediklerim ve nasıl ölçülür)

| # | Bilinmeyen | Neden ölçemedim | Nasıl ölçülür |
|---|---|---|---|
| U1 | **Kanallar kurulu 2.1.205'te gerçekten çalışıyor mu** | Sürüm tabanı hiçbir resmî kaynakta yok (changelog "channel" içermiyor **[R]**) | Aşama 0: `claude --channels plugin:fakechat@claude-plugins-official` ile aç, başlangıç bildirimi çıkıyor mu bak |
| U2 | **Çalışan ikilinin gerçek sürümü** | Kabuk yok; 2026-07'de güncelleme `update_apply_exe_locked` ile başarısız olmuş **[Y]** | `claude --version` (salt okunur) |
| U3 | **Alt agent turu sırasında gerçek gecikme** — A seçeneğinin ürün değerini belirleyen tek sayı | Oturum çalıştırmadım | Aşama 0: uzun bir `Task` başlat, fakechat'ten mesaj gönder, CEO'nun görme anını saatle ölç |
| U4 | **Bun kurulu mu** | Kabuk yok | `bun --version`. (Yalnızca A0 için gerekli; kendi kanalımız Node ile yazılabilir **[R]**) |
| U5 | **`@modelcontextprotocol/sdk` native derleme gerektiriyor mu** | `npm install` yasak | Ayrı bir geçici dizinde `npm install`, sonra `tests/deps.test.ts` çitini uygula |
| U6 | **Mevcut MCP yapılandırmasının çalışma zamanı görünümü** | `claude mcp list` çalıştırılamadı | `claude mcp list` (salt okunur) — §2.5'in dosya tabanlı bulgusunu doğrular |
| U7 | **Kanal alt süreci ile panelin port çakışması** | Ölçülmedi | Kanal portu `MC_*` ile yapılandırılabilir yapılır; `scripts/check-ports.mjs` deseni genişletilir |
| U8 | **Belgelenmemiş bir IPC yolu var mı** | Yokluğu kanıtlanamaz (§2.4e) | Kapsam dışı; resmî doküman tükendi |
| U9 | **2.1.234 altındaki izin isteği davranışı** | Dokümanın cümlesinden çıkarım **[T]** | Zaten öneri güncelleme; ölçmeye gerek yok, kaçınılıyor |

---

## §6 — Kullanıcıya özet

1. **"Channels" gerçek.** Spec'teki not doğruydu — Anthropic'in resmî özelliği, dokümanı var
   (<https://code.claude.com/docs/en/channels>). Uydurma değil.
2. **İstediğin şey teknik olarak mümkün.** Panelden yazdığın mesaj, çalışan CEO oturumunun içine
   düşer — yeni bir oturum açmaz, CEO neyi neden yaptığını hatırlar. Bunu yapabilen **tek** yol bu;
   diğer bütün yollar ya yeni oturum açıyor ya da senin terminale dönüp Enter'a basmanı bekliyor.
3. **Gecikme duruma göre değişiyor.** CEO boştaysa mesaj **anında** düşer ve kendiliğinden cevap
   verir. Ama **bir developer/QA agent'ı çalışırken gönderirsen, o iş bitene kadar bekler** — bu
   projede on dakikalar sürebilir. Bu sayıyı henüz ölçmedim ve bu, işin değerini belirleyen tek
   sayı.
4. **Süre: yaklaşık 2 gün** (biri kanal sunucusu, biri paneldeki sohbet ekranı) + yarım gün karar
   dokümanı.
5. **En büyük iki risk.** (a) Özellik "research preview" — Anthropic sözleşmeyi değiştirebilir,
   yazdığımız şey bir sürüm sonra kırılabilir. (b) Kendi kanalımız Anthropic'in onay listesinde
   olmadığı için CEO oturumunu **her açışında** `--dangerously-load-development-channels`
   bayrağıyla açıp tam ekran bir uyarıyı onaylaman gerekecek. Bu kalıcı bir sürtünme.
6. **Bir de kapsam gerçeği:** G0'da *"Claude Code'a komut gönderme yok"* diye onaylamıştın (v2
   istisnasıyla birlikte). Bunu açmak, panelin CEO'ya serbest metin verebilmesi demek — panelin
   dolaylı yetkisi CEO'nun tüm yetkisi kadar olur. Yapılabilir, ama bunun açıkça karara bağlanması
   gerek.
7. **Önerim:** kod yazmadan önce **~1 saatlik bir deneme** yapalım. Anthropic'in kendi `fakechat`
   demosu bu makinede zaten kurulu; onunla mekanizmayı ve gerçek gecikmeyi ölçeriz. Sonuç iyiyse
   Faz 2'nin sonunda gerçek kanalı yaparız; kötüyse yarım günlük "panelden CEO'ya not bırak"
   çözümüne döneriz.
8. **Küçük ama önemli not:** Claude Code sürümün **2.1.205**, güncel sürüm **2.1.261**. Temmuz'daki
   güncelleme `.exe` kilitli olduğu için başarısız olmuş. Bu işe girişmeden önce (Claude Code
   kapalıyken) güncellemek gerekiyor — güvenlikle ilgili bir sıkılaştırma 2.1.234'te gelmiş.

---

## Kaynaklar

**Resmî [R]** — hepsi 2026-09-06'da erişildi:
- <https://code.claude.com/docs/en/channels> — Channels (kullanım, güvenlik, research preview)
- <https://code.claude.com/docs/en/channels-reference> — protokol sözleşmesi, bildirim biçimi, izin aktarımı
- <https://code.claude.com/docs/en/hooks> — hook olayları, `additionalContext`, `Stop` karar alanları
- <https://code.claude.com/docs/en/cli-reference> — `-p`, `--continue`, `--resume`, `attach`
- <https://code.claude.com/docs/en/remote-control> — Remote Control gereksinimleri ve sınırları
- <https://code.claude.com/docs/en/changelog> — en güncel sürüm 2.1.261 (2026-09-04); "channel" kaydı yok

**Yerel [Y]:** `docs/specs/mission-control.md:23` · `docs/00-idea.md:16,23` · `docs/decisions/ADR-005…`
· `ADR-008` · `ADR-009` · `ADR-013` (ve eki) · `CLAUDE.md` · `docs/progress.md` · `package.json:27-33`
· `.claude/settings.json:47-48,121` · `C:\Users\pc\.claude.json:1011,1097,1183,1531-1539` ·
`C:\Users\pc\.claude\.last-update-result.json` ·
`C:\Users\pc\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\package.json:3` ·
`…\@anthropic-ai\claude-code-win32-x64\package.json:3` ·
`C:\Users\pc\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\{fakechat,telegram,discord,imessage}\`

**Doğrulanmamış [?]** (hiçbir karara dayanak yapılmadı): the-decoder, VentureBeat, Medium ve benzeri
blog yazıları — "2.1.80+ gerekir" ve "API anahtarı desteklenmiyor" iddiaları resmî dokümanla
**çelişiyor** ya da doğrulanamıyor.

---

## §7 — ÖLÇÜM SONUCU (2026-09-06, CEO) — U3 kapandı

Kullanıcı "ölçümü yap" dedi. Aşama 0'da önerilen canlı deneme **yapılmadı**; onun yerine daha
kesin ve bedelsiz bir ölçüm yapıldı. Gerekçe ve sonuçlar:

### 7.1 — Neden canlı deneme yerine kayıt analizi

İki bulgu Aşama 0'ın tasarımını geçersiz kıldı:

1. **Kurulu CLI derlenmiş bir binary.** `@anthropic-ai/claude-code/bin/claude.exe`, **247 MB**
   tek parça yürütülebilir (sürüm 2.1.205). Paket içinde okunabilir `cli.js` bundle'ı **yok** —
   yalnızca `cli-wrapper.cjs` (native binary bulunamazsa çalışan yedek launcher) ve
   `sdk-tools.d.ts` var. Kuyruğun kodda nerede boşaltıldığını okuma yolu **kapalı**.
   ✓ DOĞRULANDI (dizin listesi + `package.json` sürümü).

2. **Soru mantıkla kapanıyor — ölçmeye gerek yok.** §2.3'te (a) "araç çağrıları arasında" mı
   (b) "tur sonunda" mı diye ayrılan iki ihtimal, **bizim durumumuzda aynı sonuca çıkar**: bir
   `Task` aracı çalışırken model çalışmıyor, araç sonucunu bekliyor. Kuyruğa giren bir bildirim
   ancak modelin yeniden çağrıldığı bir noktada enjekte edilebilir. Devam eden bir araç çağrısını
   kesen bir mekanizma yok. Dolayısıyla **en erken teslim anı, o araç çağrısının döndüğü andır** —
   (a) okunsa bile. ⊢ ÇIKARIM (kanıt: araç çağrısı semantiği; §2.3'teki resmî doküman alıntısıyla
   tutarlı).

Bundan sonra sorulacak doğru soru şu hâle geldi: **CEO oturumu ne kadar süre kesintisiz meşgul
kalıyor?** Bu, kayıtlardan ölçülebilir.

### 7.2 — Yöntem

Bu projenin gerçek CEO oturum kaydı çözümlendi:
`~/.claude/projects/C--dev-apps-mission-control/b13e8d3f-….jsonl` — 2994 olay, 0 bozuk satır,
**341 eşleşen araç çağrısı**, **~31 saatlik** takvim aralığı (2026-09-04 → 09-06).

İki ölçüm yapıldı:
- **Araç bazında süre:** her `tool_use` ile onun `tool_result`'ı arasındaki fark.
- **Kesintisiz meşgul pencere:** ardışık olaylar arasındaki boşluk 90 sn'yi aşınca oturum
  "durdu/bekliyor" sayıldı; aradaki kesintisiz bloklar birer pencere olarak ölçüldü. Bir mesajın
  en kötü bekleme süresi = içine düştüğü pencerenin kalan kısmı.

Betikler: `scratchpad/measure.js`, `scratchpad/windows.js` (geçici; depoya girmedi).

### 7.3 — Sonuçlar

**Araç çağrısı süreleri (n=341):**

| Araç | n | medyan | p90 | maks |
|---|---:|---:|---:|---:|
| Bash | 235 | 3.6 sn | 14.7 sn | **122.6 sn** |
| Agent | 67 | 3.0 sn | 12.0 sn | 121.1 sn |
| AskUserQuestion | 9 | 24.1 sn | 78.8 sn | 78.8 sn |
| Write / Edit / Read | 30 | <2 sn | 2.6 sn | 2.6 sn |
| **Tümü** | **341** | **3.2 sn** | **13.2 sn** | **122.6 sn** |

Eşik üstü: **>5 dk: 0 çağrı. >15 dk: 0. >30 dk: 0.** Araç içinde geçen toplam süre 39 dk /
1843 dk = **%2.1**.

**Kesintisiz meşgul pencereler (n=98):**

| medyan | p75 | p90 | p99 | maks |
|---:|---:|---:|---:|---:|
| 2.0 dk | 2.9 dk | 4.2 dk | 12.4 dk | **12.4 dk** |

Toplam meşgul 231 dk / 1844 dk = **%12.5**. Yani oturum zamanın **%87.5'inde boşta** — ve §2.2'ye
göre boştayken kanal olayı **kendiliğinden yeni bir tur başlatır**, teslim saniyeler içinde olur.

**Türetilen iki sayı:**
- **Rastgele bir anda yazılan mesajın beklenen gecikmesi: ≈ 15 saniye.**
  (Pencere içine düşme olasılığı süresiyle orantılı; düşerse ortalama yarısını bekler.)
- **En kötü durum: 12.4 dakika** (en uzun pencerenin ta başında yazılırsa).

### 7.4 — Neden §2.3'ün "on dakikalar" tahmini tutmadı

§2.3'teki [T] tahmini, alt agent'ların **ön planda (bloklayıcı)** çalıştığını varsayıyordu.
Bu oturumda alt agent'lar **arka planda** başlatılıyor: `Agent` çağrısı ortalama **3 saniyede**
dönüyor ("async agent launched"), CEO turu biter, oturum boşa düşer, agent bittiğinde bildirim
yeni bir tur başlatır. Yani uzun alt agent turları CEO oturumunu **meşgul etmiyor**.

⚠ **Bu sonuç çalışma düzenine bağlı, mimariye değil.** `run_in_background: false` ile bloklayıcı
bir alt agent çalıştırılırsa pencere o agent'ın süresi kadar uzar (bu projede alt agent turları
30+ dakika sürebiliyor — `CLAUDE.md`'deki tur sınırı dersi). Ölçülen 12.4 dk'lık tavan, **arka
plan düzeninin bir sonucudur** ve o düzen korunduğu sürece geçerlidir.

### 7.5 — U3 üzerine karar

**U3 KAPANDI: gecikme ürün değerini çökertmiyor.** §4'teki eşik "birkaç dakikaysa değer, yarım
saatse değmez" idi. Ölçülen beklenen değer **15 saniye**, tavan **12.4 dakika**.

Sohbet hissi verir mi? **Kısmen** — mesajların çoğu saniyeler içinde görülür, ama %12.5'lik
dilimde birkaç dakika sessizlik olur. Bu, panelde **"CEO şu an meşgul, mesajın sıraya alındı"**
göstergesi gerektirir; sessizce beklemek kullanıcıya "gitmedi mi?" dedirtir. Bu gösterge, A
seçeneğinin kabul kriterlerine **eklenmelidir**.

§4'ün geri kalanı (Aşama 1 tasarımı, güvenlik kısıtları, §2.6'daki tüm uyarılar) **değişmedi**.
Özellikle §2.6(2) yetki sınıfı sorunu ve §2.3'teki **sessiz düşme** riski hâlâ açık — bunlar
gecikmeden bağımsız ve hâlâ kullanıcı kararı gerektiriyor.
