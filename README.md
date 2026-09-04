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

Panel `http://127.0.0.1:7333` adresinde açılır (varsayılan port).

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

## Sorun giderme

Windows'ta `Ctrl+C` sonrası port tutulu kalırsa:

```powershell
netstat -ano | findstr 7333
taskkill /PID <pid> /F
```
