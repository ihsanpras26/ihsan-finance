// app.tsx - routing, penjaga sesi, dan kerangka tata letak.
import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell.tsx';
import { EmptyState, ErrorState, LoadingRows, PageHeader } from './components/ui.tsx';
import { ApiError } from './lib/api.ts';
import { useSession } from './lib/session.tsx';
import { AuthPage } from './routes/auth/Auth.tsx';

// Layar ber-sesi dimuat sesuai kebutuhan. Berkas awal hanya membawa kerangka, sesi, komponen UI
// dasar, dan layar masuk; sisa aplikasi menyusul sebagai potongan kecil saat rutenya dibuka.
// Layar masuk sengaja tidak dipecah: itu layar pertama pengunjung baru, satu perjalanan tambahan
// ke server di sana terasa mahal. Muatannya berjalan berbarengan dengan permintaan data layar,
// jadi biaya tambahannya tidak menambah waktu tunggu secara berurutan.
const BerandaPage = lazy(() => import('./routes/beranda/Beranda.tsx').then((mod) => ({ default: mod.BerandaPage })));
const TransaksiPage = lazy(() => import('./routes/transaksi/Transaksi.tsx').then((mod) => ({ default: mod.TransaksiPage })));
const RencanaPage = lazy(() => import('./routes/rencana/Rencana.tsx').then((mod) => ({ default: mod.RencanaPage })));
const LaporanPage = lazy(() => import('./routes/laporan/Laporan.tsx').then((mod) => ({ default: mod.LaporanPage })));
const NotifikasiPage = lazy(() => import('./routes/notifikasi/Notifikasi.tsx').then((mod) => ({ default: mod.NotifikasiPage })));
const ProfilPage = lazy(() => import('./routes/profil/Profil.tsx').then((mod) => ({ default: mod.ProfilPage })));

export function App() {
  const { user, loading, error, refresh } = useSession();
  const location = useLocation();

  // Memuat sesi: kerangka baris, bukan lingkaran berputar di tengah (DESIGN.md "Motion").
  if (loading) return <BootScreen />;

  // Server tidak terjangkau saat memeriksa sesi: sebutkan sebab dan tindakannya.
  if (!user && error) return <BootError error={error} onRetry={() => void refresh()} />;

  // Belum masuk (401 dari api.me): arahkan ke layar masuk.
  if (!user) {
    if (location.pathname !== '/masuk') {
      return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
    }
    return (
      <Routes>
        <Route path="/masuk" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/masuk" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingRows rows={6} label="Memuat halaman" />}>
        <Routes>
          <Route path="/" element={<BerandaPage />} />
          <Route path="/transaksi" element={<TransaksiPage />} />
          <Route path="/rencana" element={<RencanaPage />} />
          <Route path="/laporan" element={<LaporanPage />} />
          <Route path="/notifikasi" element={<NotifikasiPage />} />
          <Route path="/profil" element={<ProfilPage />} />
          <Route path="/masuk" element={<Navigate to="/" replace />} />
          <Route path="*" element={<HalamanTidakAda />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function BootScreen() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[880px] flex-col justify-center px-4">
      <p className="text-lg font-semibold text-fg">Ihsan Finance</p>
      <p className="mt-2 text-sm text-muted">Memeriksa sesi dan preferensi.</p>
      <div className="mt-6">
        <LoadingRows rows={4} label="Memeriksa sesi" />
      </div>
    </div>
  );
}

function BootError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[880px] flex-col justify-center px-4">
      <p className="text-lg font-semibold text-fg">Ihsan Finance</p>
      <p className="mt-2 text-sm text-muted">Sesi belum dapat diperiksa.</p>
      <div className="mt-6">
        <ErrorState message={error.display} onRetry={onRetry} />
      </div>
    </div>
  );
}

function HalamanTidakAda() {
  return (
    <div>
      <PageHeader title="Halaman tidak ditemukan" subtitle="Alamat yang dibuka tidak ada di aplikasi ini." />
      <div className="mt-6">
        <EmptyState
          title="Kembali ke Beranda"
          body="Saldo, ringkasan bulan ini, dan kewajiban terdekat ada di Beranda."
          action={
            <Link to="/" className="inline-flex min-h-[44px] items-center rounded-control px-3 text-sm font-semibold text-accent">
              Buka Beranda
            </Link>
          }
        />
      </div>
    </div>
  );
}
