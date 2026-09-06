import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiPort = process.env.MC_PORT ?? '7333'
const webPort = Number(process.env.MC_WEB_PORT ?? '7334')

export default defineConfig({
  root: 'src/web',
  plugins: [react(), tailwindcss()],
  // F-012 — `MC_CHAT_ENABLED` sunucu tarafı bir ortam değişkenidir; tarayıcıda `process` yok,
  // bu yüzden derleme anında (bu `npm run build` çağrısının kendi ortamından) literal bir
  // dizgeye gömülür (`App.tsx`'in `isChatUiEnabled` fonksiyonu bunu okur). Vitest bu dosyayı
  // KULLANMAZ (ayrı `vitest.config.ts`) — testlerde aynı ifade gerçek Node `process.env`'i
  // okur, davranış birebir aynı kalır.
  define: {
    'process.env.MC_CHAT_ENABLED': JSON.stringify(process.env.MC_CHAT_ENABLED ?? ''),
  },
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
