import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiPort = process.env.MC_PORT ?? '7333'
const webPort = Number(process.env.MC_WEB_PORT ?? '7334')

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  // QA F-012 tur 2 Y2 (BLOKLAYICI) düzeltmesi — `MC_CHAT_ENABLED`'ı derleme anında bir dize
  // literaline gömen `define` KALDIRILDI (CEO kararı F2). Eskiden `npm run e2e`'nin
  // `webServer.command`'ı (`npm run build && npm start`) TÜM ortamı (`MC_CHAT_ENABLED:'0'` dahil)
  // `build` adımına da uyguluyordu; bu yüzden e2e koşusundan sonra kalan `dist/` sohbet sekmesini
  // KALICI olarak içermiyordu — sunucu `chat_enabled:true` derken bile (bkz. `docs/qa/
  // F-012-2026-09-06-tur2.md` §4 Y2). Artık istemci bu bilgiyi `GET /api/chat/status`'un
  // `chat_enabled` alanından ÇALIŞMA ZAMANINDA okuyor (`src/web/App.tsx`) — derlenmiş `dist/`
  // artık hangi ortamda derlendiğinden BAĞIMSIZ, her zaman aynı davranışı sergiliyor.
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
})
