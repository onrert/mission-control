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
aracını (bağımsız, üçüncü parti) kurulum gerektirmeden çalıştırabilirsiniz:

```sh
npx ccusage@latest daily
```

Karşılaştırma adımları:

1. Panelde "Token" sekmesini açın, "Grupla: Gün" seçin, ilgilendiğiniz günün giriş/çıkış token
   toplamını not edin.
2. Yukarıdaki komutu çalıştırın, aynı takvim gününe ait `Input`/`Output` sütunlarını okuyun.
3. Rakamlar **birebir eşleşmeyebilir** — panel günü dosyanın son değiştirilme zamanına
   (`mtime`) göre ayırır, gece yarısını aşan bir oturumun tamamını tek güne yazar; `ccusage`
   kendi zaman damgası mantığını kullanır. Büyük bir sapma (ör. %10+) varsa panelin "veri eksik
   olabilir" uyarısını kontrol edin (bkz. `docs/03-ux.md` ekran 6) — bu, ayrıştırılamayan satır
   oranının yüksek olduğunu gösterir.

`ccusage` panelin bir bağımlılığı **değildir**; panel onsuz da tam çalışır, yalnızca isteğe
bağlı bir doğrulama aracıdır (ADR-007).

[ccusage]: https://github.com/ryoppippi/ccusage

## Sorun giderme

Windows'ta `Ctrl+C` sonrası port tutulu kalırsa:

```powershell
netstat -ano | findstr 7333
taskkill /PID <pid> /F
```
