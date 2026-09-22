// components/layout/AppShell.tsx - kerangka tata letak.
// HP (< 1024px): kepala ringkas dengan sapaan dan avatar, bilah bawah 5 tujuan dengan tombol Tambah
// bulat di tengah sebagai satu-satunya aksi utama (DESIGN.md §6).
// Desktop (>= 1024px): rel kiri 248px dengan merek, tombol Tambah, dan 5 tujuan; kolom isi 1120px.
// Alasan susunan: di HP pengguna mencatat sambil berdiri, jadi Tambah satu jempol dari mana saja;
// di desktop pengguna meninjau.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useOnline } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { QuickEntry, type QuickEntryInit } from '../forms/QuickEntry.tsx';
import {
  IconBell, IconCloudOff, IconGoal, IconLedger, IconMoon, IconPlus, IconReport, IconSun, IconUser, IconWallet,
} from '../icons.tsx';
import { Avatar, Button, IconButton } from '../ui.tsx';

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

/** Judul kepala di HP mengikuti tujuan yang sedang dibuka. */
const TITLES: Record<string, string> = {
  '/': 'Beranda',
  '/transaksi': 'Transaksi',
  '/rencana': 'Rencana',
  '/laporan': 'Laporan',
  '/profil': 'Profil',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, theme, setTheme } = useSession();
  const online = useOnline();
  const location = useLocation();

  const [dataVersion, setDataVersion] = useState(0);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryInit, setEntryInit] = useState<QuickEntryInit | null>(null);

  const notifyDataChanged = useCallback(() => setDataVersion((value) => value + 1), []);
  const openQuickEntry = useCallback((init?: QuickEntryInit) => {
    setEntryInit(init ?? null);
    setEntryOpen(true);
  }, []);
  const closeQuickEntry = useCallback(() => setEntryOpen(false), []);

  const shell = useMemo<ShellValue>(
    () => ({ dataVersion, notifyDataChanged, openQuickEntry }),
    [dataVersion, notifyDataChanged, openQuickEntry],
  );

  const darkNow = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeLabel = darkNow ? 'Mode terang' : 'Mode gelap';
  const toggleTheme = () => setTheme(darkNow ? 'light' : 'dark');

  // Gulir kembali ke atas saat tujuan berubah, supaya layar baru selalu mulai dari kepalanya.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const pageTitle = TITLES[location.pathname] ?? 'Ihsan Finance';

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
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-raised px-4 py-5 lg:flex">
          <Link to="/" className="flex min-h-[44px] items-center gap-2.5 rounded-control px-1">
            <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent text-base font-bold text-accent-fg" aria-hidden="true">
              IF
            </span>
            <span className="text-base font-semibold text-fg">Ihsan Finance</span>
          </Link>

          <Button block className="mt-5" onClick={() => openQuickEntry()}>
            <IconPlus size={18} />
            Tambah transaksi
          </Button>

          <nav aria-label="Navigasi utama" className="mt-6 flex flex-col gap-1">
            {ALL_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm transition-colors duration-150 ${
                    isActive ? 'bg-accent-soft font-semibold text-accent' : 'font-medium text-muted hover:bg-fg/6 hover:text-fg'
                  }`
                }
              >
                <item.Icon size={19} />
                {item.label}
              </NavLink>
            ))}
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
          {/* Kepala: HP memakai judul halaman dan aksi akun; desktop hanya bilah tipis.
              Safe-area atas dijaga supaya judul tidak tertutup poni pada perangkat berponi. */}
          <header className="sticky top-0 z-30 border-b border-hairline/60 bg-surface/85 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
            <div className="mx-auto flex min-h-[56px] max-w-[1120px] items-center gap-2 px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-2xs font-medium text-muted">
                  {user?.workspaceName}
                </p>
                <p className="truncate text-lg font-semibold tracking-tight text-fg">{pageTitle}</p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label={themeLabel} onClick={toggleTheme}>
                  {darkNow ? <IconSun /> : <IconMoon />}
                </IconButton>
                <Link
                  to="/notifikasi"
                  aria-label="Notifikasi"
                  title="Notifikasi"
                  className="press inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg"
                >
                  <IconBell />
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
            {children}
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
                className="press -mt-5 inline-flex size-14 items-center justify-center rounded-chip bg-accent text-accent-fg shadow-[0_8px_20px_-6px_var(--accent)] transition-[filter] duration-150 hover:brightness-110"
              >
                <IconPlus size={26} />
              </button>
            </div>
            {NAV_ITEMS.slice(2).map((item) => (
              <TabLink key={item.to} item={item} />
            ))}
          </div>
        </nav>

        <QuickEntry open={entryOpen} init={entryInit} onClose={closeQuickEntry} onSaved={notifyDataChanged} />
      </div>
    </ShellContext.Provider>
  );
}

function TabLink({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `press relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 pt-1 text-2xs font-semibold transition-colors duration-150 ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active marker: a short accent bar above the icon, so the current tab reads at a glance
              without relying on colour alone (NFR06). */}
          <span
            aria-hidden="true"
            className={`absolute top-0 h-[3px] w-8 rounded-chip transition-opacity duration-150 ${
              isActive ? 'bg-accent opacity-100' : 'opacity-0'
            }`}
          />
          <item.Icon size={22} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}
