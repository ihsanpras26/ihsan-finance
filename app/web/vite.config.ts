import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // React dan router jarang berubah; memisahkannya membuat peramban hanya mengunduh ulang
        // potongan kecil saat aplikasi diperbarui, bukan seluruh pustaka. Bentuk fungsi dipakai
        // supaya seluruh berkas di dalam paket itu ikut pindah, bukan hanya pintu masuknya.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          return /node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id) ? 'vendor' : undefined;
        },
      },
    },
  },
});
