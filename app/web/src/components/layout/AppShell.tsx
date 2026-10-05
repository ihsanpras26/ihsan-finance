// components/layout/AppShell.tsx - kerangka tata letak.
// HP (< 1024px): kepala ringkas dengan sapaan dan avatar, bilah bawah 5 tujuan dengan tombol Tambah
// bulat di tengah sebagai satu-satunya aksi utama (DESIGN.md "Components").
// Desktop (>= 1024px): rel kiri 248px dengan merek, tombol Tambah, dan 5 tujuan; kolom isi 1120px.
// Alasan susunan: di HP pengguna mencatat sambil berdiri, jadi Tambah satu jempol dari mana saja;
// di desktop pengguna meninjau.
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, clearApiReadCache } from '../../lib/api.ts';
import { useAsync, useOnline } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import type { QuickEntryInit } from '../forms/QuickEntry.tsx';
import {
  IconBell, IconCloudOff, IconGoal, IconLedger, IconMoon, IconPlus, IconReport, IconSun, IconUser, IconWallet,
} from '../icons.tsx';
import { Avatar, Button, LoadingRows, Sheet } from '../ui.tsx';

// Formulir catat dipecah dari berkas awal: ia hanya dipakai setelah tombol Tambah ditekan.
// Potongannya dihangatkan saat peramban menganggur, jadi menekan Tambah tetap terasa seketika;
// selama potongan itu menyusul, kerangka lembar tampil lebih dulu supaya tombol tidak terasa mati.
const QuickEntry = lazy(() => import('../forms/QuickEntry.tsx').then((mod) => ({ default: mod.QuickEntry })));

interface ShellValue {
  /** Bertambah setiap ada mutasi yang berhasil, sehingga layar memuat ulang datanya. */
  dataVersion: number;
  notifyDataChanged: () => void;
  openQuickEntry: (init?: QuickEntryInit) => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell harus dipakai di dalam AppShell.');
  return value;
}

// Ikon dipilih karena artinya, bukan karena gaya pustaka (R-04):
// Beranda menjawab "berapa uang yang tersedia" (dompet), Transaksi adalah baris buku besar,
// Rencana adalah target dan batas, Laporan adalah kolom angka, Profil adalah orangnya.
const NAV_ITEMS = [
  { to: '/', label: 'Beranda', Icon: IconWallet, end: true },
  { to: '/transaksi', label: 'Transaksi', Icon: IconLedger, end: false },
  { to: '/rencana', label: 'Rencana', Icon: IconGoal, end: false },
  { to: '/laporan', label: 'Laporan', Icon: IconReport, end: false },
] as const;

const PROFIL_ITEM = { to: '/profil', label: 'Profil', Icon: IconUser, end: false } as const;

const ALL_ITEMS = [...NAV_ITEMS, PROFIL_ITEM];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, theme, setTheme } = useSession();
  const online = useOnline();
  const location = useLocation();

  const [dataVersion, setDataVersion] = useState(0);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryInit, setEntryInit] = useState<QuickEntryInit | null>(null);

  const notifyDataChanged = useCallback(() => {
    // Data bersama (dompet, kategori) tidak boleh lagi disajikan dari cache setelah ada perubahan.
    clearApiReadCache();
    setDataVersion((value) => value + 1);
  }, []);
  const openQuickEntry = useCallback((init?: QuickEntryInit) => {
    setEntryInit(init ?? null);
    setEntryOpen(true);
  }, []);

  // Hangatkan potongan formulir saat peramban menganggur, bukan saat tombol Tambah ditekan.
  useEffect(() => {
    const warm = () => void import('../forms/QuickEntry.tsx');
    const idle = window.requestIdleCallback?.(warm) ?? window.setTimeout(warm, 1_500);
    return () => {
      window.cancelIdleCallback?.(idle);
      window.clearTimeout(idle);
    };
  }, []);
  const closeQuickEntry = useCallback(() => setEntryOpen(false), []);

  const shell = useMemo<ShellValue>(
    () => ({ dataVersion, notifyDataChanged, openQuickEntry }),
    [dataVersion, notifyDataChanged, openQuickEntry],
  );

  // Satu kueri murah per perubahan data: lonceng tidak boleh diam saat ada yang menunggu dibaca.
  const unread = useAsync(() => api.notifications({ status: 'unread' }), [dataVersion]);
  const unreadCount = unread.data?.length ?? 0;

  const darkNow = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeLabel = darkNow ? 'Mode terang' : 'Mode gelap';
  const toggleTheme = () => setTheme(darkNow ? 'light' : 'dark');

  // Gulir kembali ke atas saat tujuan berubah, supaya layar baru selalu mulai dari kepalanya.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <ShellContext.Provider value={shell}>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-control focus:bg-raised focus:px-3 focus:text-sm focus:font-semibold focus:text-fg"
      >
        Lompat ke konten
      </a>

      <div className="min-h-dvh">
        {/* Rel kiri: hanya desktop. */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-hairline bg-raised px-4 py-5 lg:flex">
          <Link to="/" className="flex min-h-[44px] items-center gap-2.5 rounded-control px-1">
            <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-solid text-base font-bold text-accent-fg" aria-hidden="true">
              IF
            </span>
            <span className="text-base font-semibold text-fg">Ihsan Finance</span>
          </Link>

          <Button block className="mt-5" onClick={() => openQuickEntry()}>
            <IconPlus size={18} />
            Tambah transaksi
          </Button>

          <nav aria-label="Navigasi utama" className="mt-6 flex flex-col gap-1">
            {ALL_ITEMS.map((item) => {
              const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[48px] items-center gap-3 rounded-control px-3 text-sm transition-colors duration-150 ${
                    active ? 'bg-accent-soft font-semibold text-accent' : 'font-medium text-muted hover:bg-fg/6 hover:text-fg'
                  }`}
                >
                  <item.Icon size={19} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Link to="/profil" className="flex min-h-[52px] items-center gap-3 rounded-control px-1 hover:bg-fg/4">
              <Avatar name={user?.displayName ?? '?'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-fg">{user?.displayName}</span>
                <span className="block truncate text-2xs text-muted">{user?.workspaceName}</span>
              </span>
            </Link>
            <Button variant="secondary" size="sm" block onClick={toggleTheme}>
              {darkNow ? <IconSun size={17} /> : <IconMoon size={17} />}
              {themeLabel}
            </Button>
          </div>
        </aside>

        <div className="lg:pl-[248px]">
          {/* Kepala: identitas ruang kerja dan aksi akun. Judul halaman hidup di dalam konten
              sebagai satu h1 per layar (PageHeader), jadi kepala tidak mengulanginya.
              Safe-area atas dijaga supaya isi kepala tidak tertutup poni pada perangkat berponi. */}
          <header className="sticky top-0 z-30 border-b border-hairline bg-surface pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="mx-auto flex min-h-[56px] max-w-[1120px] items-center gap-2 px-4">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                {user?.workspaceName}
              </p>
              <div className="flex items-center gap-1">
                <Link
                  to="/notifikasi"
                  aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
                  title="Notifikasi"
                  className="press relative inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg"
                >
                  <IconBell />
                  {unreadCount > 0 ? (
                    <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-chip bg-out ring-2 ring-surface" />
                  ) : null}
                </Link>
                <Link to={PROFIL_ITEM.to} aria-label="Profil" title="Profil" className="press inline-flex size-11 items-center justify-center rounded-control">
                  <Avatar name={user?.displayName ?? '?'} size="sm" />
                </Link>
              </div>
            </div>
          </header>

          {!online ? (
            <div className="border-b border-warn/30 bg-warn/10">
              <p className="mx-auto flex max-w-[1120px] items-center gap-2 px-4 py-2 text-xs text-warn sm:px-6 lg:px-8">
                <IconCloudOff size={16} />
                Tidak ada koneksi. Transaksi baru disimpan sebagai draf di perangkat ini dan belum mengubah saldo.
              </p>
            </div>
          ) : null}

          {/* Ruang bawah menyisakan tinggi bilah navigasi supaya baris terakhir tidak tertutup (R-03).
              Lebar HP memakai padding 16px; layar besar naik ke 24/32px supaya kartu tidak melebar
              tanpa kendali (mobile-first). */}
          <main
            id="konten"
            className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-16"
          >
            <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
          </main>
        </div>

        {/* Bilah bawah: hanya HP. Lima tujuan dengan tombol Tambah bulat di tengah. */}
        <nav
          aria-label="Navigasi utama"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="mx-auto grid max-w-[1120px] grid-cols-5 items-stretch px-1">
            {NAV_ITEMS.slice(0, 2).map((item) => (
              <TabLink key={item.to} item={item} />
            ))}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openQuickEntry()}
                aria-label="Tambah transaksi"
                className="press -mt-5 inline-flex size-14 items-center justify-center rounded-chip bg-accent-solid text-accent-fg shadow-lift transition-[filter] duration-150 hover:brightness-110"
              >
                <IconPlus size={26} />
              </button>
            </div>
            {NAV_ITEMS.slice(2).map((item) => (
              <TabLink key={item.to} item={item} />
            ))}
          </div>
        </nav>

        {entryOpen ? (
          <Suspense
            fallback={
              <Sheet open onClose={closeQuickEntry} title="Catat transaksi">
                <LoadingRows rows={3} label="Menyiapkan formulir" />
              </Sheet>
            }
          >
            <QuickEntry open={entryOpen} init={entryInit} onClose={closeQuickEntry} onSaved={notifyDataChanged} />
          </Suspense>
        ) : null}
      </div>
    </ShellContext.Provider>
  );
}

function TabLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const { pathname } = useLocation();
  const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`press relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 pt-1 text-2xs font-semibold transition-colors duration-150 ${
        active ? 'text-accent' : 'text-muted'
      }`}
    >
      {/* Active marker: a short accent bar above the icon, so the current tab reads at a glance
          without relying on colour alone (NFR06). */}
      <span
        aria-hidden="true"
        className={`absolute top-0 h-[3px] w-8 rounded-chip transition-opacity duration-150 ${
          active ? 'bg-accent opacity-100' : 'opacity-0'
        }`}
      />
      <item.Icon size={22} />
      <span>{item.label}</span>
    </Link>
  );
}
