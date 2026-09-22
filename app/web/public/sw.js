// sw.js — service worker PWA Ihsan Finance.
// Aturan cache:
// 1. /api: selalu ke jaringan, tidak pernah disimpan. Saldo dan transaksi tidak boleh tampil basi,
//    dan draf yang belum terkirim tidak boleh terlihat seolah sudah tersimpan (PRD §09).
//    Bila jaringan gagal, permintaan dibiarkan gagal supaya aplikasi menampilkan pesan koneksi.
// 2. Aset statis (kerangka aplikasi, skrip, gaya, huruf): cache-first, diisi saat pemasangan.
// 3. Navigasi halaman: jaringan lebih dulu, lalu kerangka yang tersimpan saat perangkat luring.
const CACHE = 'ihsan-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Data keuangan tidak pernah masuk cache.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
