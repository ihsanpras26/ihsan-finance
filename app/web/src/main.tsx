// main.tsx - titik masuk: rupa huruf, CSS, sesi, toast, router, dan pendaftaran service worker.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Rupa huruf self-host (DESIGN.md §3): Schibsted Grotesk untuk antarmuka,
// IBM Plex Mono untuk seluruh nominal uang.
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/index.css';
import { App } from './app.tsx';
import { ToastProvider } from './components/ui.tsx';
import { SessionProvider } from './lib/session.tsx';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemen #root tidak ada di index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);

// PWA hanya didaftarkan pada build produksi supaya cache aset tidak menutupi perubahan saat dev.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Aplikasi tetap berjalan tanpa service worker; hanya kemampuan pasang yang hilang.
    });
  });
}
