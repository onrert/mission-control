# Mission Control

Agent tabanlı uygulama üretim hattı için yerel, tek kullanıcılık kontrol paneli. Boş bir iskelet:
`node:http` API sunucusu + Vite/React/Tailwind web kabuğu. Hosting/deploy yoktur — araç
kullanıcının kendi makinesinde, kendi deposundan çalışır.

## Gereksinimler

- Node.js **>= 20.11** (öneri: 22.x)
- npm (Node ile birlikte gelir)

## Kurulum

### Windows (PowerShell / Git Bash)

```sh
npm install
npx playwright install chromium
```

### macOS

```sh
npm install
npx playwright install chromium
```

`npm install` sırasında internet gerekir (esbuild/Vite/Playwright önceden derlenmiş ikili
indirir; derleme araçları — node-gyp, Visual Studio Build Tools — **gerekmez**).

## Çalıştırma

Geliştirme (Vite dev sunucusu + API sunucusu, tek komut):

```sh
npm run dev
```

Windows'ta `MC_PORT` ayarlamak için (varsayılan `7333`):

```powershell
$env:MC_PORT=18333; npm run dev
```

macOS/Linux'ta:

```sh
MC_PORT=18333 npm run dev
```

Prod modu (tek süreç, tek port, `dist/web` statik servis edilir):

```sh
npm run build
npm start
```

Prod modda panel `http://127.0.0.1:7333` adresinde açılır (varsayılan port).

`npm run dev` çalıştırdığınızda panel Vite dev sunucusunun portunda,
`http://127.0.0.1:7334` adresinde açılır (varsayılan `MC_WEB_PORT`); `/api` istekleri
arka planda `7333`'teki API sunucusuna proxy'lenir.

## Test

```sh
npm test              # birim + entegrasyon (Vitest)
npm run typecheck      # tsc --noEmit
npm run lint            # ESLint
npm run verify           # typecheck + lint + test + build — feature bitiş kapısı
```

E2E testleri (Playwright, gerçek tarayıcı) **`npm run verify`'a dahil değildir** — commit
öncesi elle çalıştırılmalıdır:

```sh
npm run e2e        # prod modu (build + start üzerinde)
npm run e2e:dev    # dev modu (npm run dev üzerinde)
```

## data/ klasörü

`data/` panelin kendi olay/proje deposudur ve `.gitignore` ile hariç tutulur. F-001'in
sunucusu bu klasörü hiç okumaz/yazmaz; oluşturulması ileride bir feature'ın (olay alma) işidir.

## Fontlar (self-host, lisans)

Uygulama Departure Mono ve IBM Plex ailesi fontlarını `src/web/fonts/` altından kendi sunar
(CDN kullanılmaz). Departure Mono, SIL Open Font License 1.1 (OFL) ile lisanslıdır; IBM Plex Mono ve
IBM Plex Sans da SIL Open Font License 1.1 ile lisanslıdır. Lisans metinleri
`src/web/fonts/LICENSE-DepartureMono.txt` ve `src/web/fonts/LICENSE-IBMPlex.txt` içindedir.

## Token Kullanımı ekranı — `ccusage` ile elle çapraz kontrol

Panelin "Token" sekmesi kendi minimal okuyucusuyla (`~/.claude/projects/**/*.jsonl`) proje/gün/
oturum/agent bazında token toplamı gösterir (ADR-007 karar 3). Bu, resmî/belgeli bir format
değildir; rakamların makul olduğunu elle doğrulamak isterseniz [`ryoppippi/ccusage`][ccusage]
aracını (bağımsız, üçüncü parti) kurulum gerektirmeden çalıştırabilirsiniz. `ccusage`'ın
`daily`/`monthly` komutları **proje filtresi almaz** (yalnızca `--since`/`--until`/`--timezone`
gibi seçenekler vardır) — makinedeki **tüm** projelerin toplamını verir, panel ise yalnızca
**izlenen** projeleri toplar. Bu yüzden karşılaştırma `daily` yerine `session` komutuyla,
**oturum kimliği eşleştirmesiyle** yapılmalıdır (aşağıdaki yordam):

```sh
# 1) Bu projenin kendi oturum kimliklerini (üst düzey `.jsonl` dosya adları) listele.
#    Dizin adı, proje yolunda `:`/`\`/`/` karakterlerinin `-` ile değiştirilmiş hâlidir
#    (ör. `C:\dev\apps\mission-control` → `C--dev-apps-mission-control`); emin değilseniz
#    `ls ~/.claude/projects` çıktısında projenizin yolunu andıran dizini bulun.
PROJECT_DIR="$HOME/.claude/projects/C--dev-apps-mission-control"
node -e "console.log(require('fs').readdirSync(process.argv[1]).filter(f=>f.endsWith('.jsonl')).map(f=>f.slice(0,-6)).join('\n'))" \
  "$PROJECT_DIR" > /tmp/session-ids.txt

# 2) ccusage'ın oturum bazlı JSON çıktısını al (makinedeki TÜM projeler dahildir, sorun değil —
#    3. adımda yalnızca bizim oturum kimliklerimizle eşleşenler süzülecek).
npx ccusage@latest session --json > /tmp/ccusage-session.json

# 3) Yalnızca bu projenin oturum kimlikleriyle eşleşen satırları topla.
node -e "
const fs = require('fs');
const ids = new Set(fs.readFileSync('/tmp/session-ids.txt','utf8').trim().split(/\r?\n/).filter(Boolean));
const data = JSON.parse(fs.readFileSync('/tmp/ccusage-session.json','utf8'));
let total = 0;
for (const s of data.session) {
  if (ids.has(s.period)) total += s.inputTokens + s.outputTokens + s.cacheCreationTokens + s.cacheReadTokens;
}
console.log('ccusage toplamı (bu projenin oturumları):', total);
"
```

4. Çıkan sayıyı panelin "Token" sekmesindeki genel "Toplam" rakamıyla karşılaştırın (panel yalnızca
   tek proje izliyorsa bu, panelin tüm ekranının toplamıdır; birden fazla proje izleniyorsa panelin
   proje bazlı satırından kendi projenizin toplamını okuyun ve yalnızca onunla karşılaştırın).

**Beklenen sapma — dürüstçe ölçüldü (2026-09-09, bu depo, 67 token-üretmiş oturum):** Şu an
**etkin/büyümekte olan** oturum(lar) hariç tutulduğunda (66 tamamlanmış oturum) panelin toplamı
`ccusage session`'ın verdiğiyle **birebir (%0,00 fark)** eşleşiyor — ikisi de aynı `.jsonl`
satırlarını, aynı `message.id`+`requestId` çiftine göre tekilleştirerek okuyor. **O an açık/aktif
bir oturum varsa** o oturumun satırı iki ölçüm arasında büyümeye devam ettiği için (panel ve
`ccusage` iki AYRI anda okur) o TEK oturumda gerçek, geçici bir fark görülür — bu turda ölçülen
tam sapma (aktif oturum dahil, 67/67 oturum) **%10,8** idi, tamamı o tek büyüyen oturumdan
geliyordu. **Sonuç:** büyük bir sapma görürseniz önce hangi oturumun sebep olduğuna bakın (yukarıdaki
betiği oturum bazında — `data.session` içindeki `period`/toplam alanlarını tek tek yazdırarak —
çalıştırıp en büyük farkı veren `period`'u panelin "genişlet" görünümündeki oturum kimlikleriyle
karşılaştırın); eğer fark **tek bir**, o anda hâlâ kullanılan oturumdaysa bu bir hata değildir,
ölçümü Claude Code'u kapattıktan/oturum bittikten sonra tekrarlayın. Sapma birden fazla
**tamamlanmış** oturuma yayılıyorsa panelin "veri eksik olabilir" uyarısını kontrol edin (bkz.
`docs/03-ux.md` ekran 6) ve bir hata olarak ele alın.

`ccusage` panelin bir bağımlılığı **değildir**; panel onsuz da tam çalışır, yalnızca isteğe
bağlı bir doğrulama aracıdır (ADR-007).

[ccusage]: https://github.com/ryoppippi/ccusage

## Sorun giderme

Windows'ta `Ctrl+C` sonrası port tutulu kalırsa:

```powershell
netstat -ano | findstr 7333
taskkill /PID <pid> /F
```
