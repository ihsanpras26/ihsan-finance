// components/layout/AppShell.tsx - kerangka tata letak.
// HP (< 1024px): konten + bilah bawah 4 tab dengan tombol Tambah di tengah + ikon Profil di kanan atas.
// Desktop (>= 1024px): rel kiri 240px dengan 5 tujuan + kolom isi maksimum 880px (DESIGN.md §4).
// Alasan susunan: di HP pengguna mencatat, jadi Tambah satu jempol dari mana saja; di desktop pengguna meninjau.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useOnline } from '../../lib/hooks.ts';
import { useSession } from '../../lib/session.tsx';
import { QuickEntry, type QuickEntryInit } from '../forms/QuickEntry.tsx';
import { IconCloudOff, IconGoal, IconLedger, IconMoon, IconPlus, IconReport, IconSun, IconUser, IconWallet } from '../icons.tsx';
import { Button, IconButton } from '../ui.tsx';

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
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-hairline bg-surface px-4 py-5 lg:flex">
          <Link to="/" className="flex min-h-[44px] items-center gap-2 rounded-control px-1">
            <span className="text-lg font-semibold text-fg">Ihsan Finance</span>
            <span className="text-2xs font-semibold text-muted" title="Penanda tempat logo. Berkas logo belum ada.">
              [LOGO]
            </span>
          </Link>

          <Button block className="mt-5" onClick={() => openQuickEntry()}>
            <IconPlus size={18} />
            Tambah transaksi
          </Button>

          <nav aria-label="Navigasi utama" className="mt-6 flex flex-col gap-0.5">
            {ALL_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex min-h-[44px] items-center gap-3 rounded-control px-3 text-sm transition-colors duration-150 ${
                    isActive ? 'font-semibold text-accent' : 'font-medium text-muted hover:bg-fg/6 hover:text-fg'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 ${isActive ? 'bg-accent' : 'bg-transparent'}`}
                      aria-hidden="true"
                    />
                    <item.Icon size={19} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 border-t border-hairline pt-4">
            <div>
              <p className="truncate text-sm font-semibold text-fg">{user?.displayName}</p>
              <p className="truncate text-2xs text-muted">{user?.workspaceName}</p>
            </div>
            <Button variant="secondary" size="sm" block onClick={toggleTheme}>
              {darkNow ? <IconSun size={17} /> : <IconMoon size={17} />}
              {themeLabel}
            </Button>
          </div>
        </aside>

        <div className="lg:pl-[232px]">
          {/* Bilah atas: hanya HP. */}
          <header className="sticky top-0 z-30 border-b border-hairline bg-surface lg:hidden">
            <div className="mx-auto flex min-h-[56px] max-w-[1120px] items-center gap-2 px-4">
              <Link to="/" className="inline-flex min-h-[44px] items-baseline gap-2 rounded-control py-1">
                <span className="text-lg font-semibold text-fg">Ihsan Finance</span>
                <span className="text-2xs font-semibold text-muted" title="Penanda tempat logo. Berkas logo belum ada.">
                  [LOGO]
                </span>
              </Link>
              <div className="ml-auto flex items-center gap-1">
                <IconButton label={themeLabel} onClick={toggleTheme}>
                  {darkNow ? <IconSun /> : <IconMoon />}
                </IconButton>
                <Link
                  to={PROFIL_ITEM.to}
                  aria-label={PROFIL_ITEM.label}
                  title={PROFIL_ITEM.label}
                  className="inline-flex size-11 items-center justify-center rounded-control text-fg hover:bg-fg/6"
                >
                  <PROFIL_ITEM.Icon />
                </Link>
              </div>
            </div>
          </header>

          {!online ? (
            <div className="border-b border-warn/40 bg-warn/8">
              <p className="mx-auto flex max-w-[1120px] items-center gap-2 px-4 py-2 text-xs text-warn sm:px-6 lg:px-8">
                <IconCloudOff size={16} />
                Tidak ada koneksi. Transaksi baru disimpan sebagai draf di perangkat ini dan belum mengubah saldo.
              </p>
            </div>
          ) : null}

          {/* Ruang bawah menyisakan tinggi bilah navigasi supaya baris terakhir tidak tertutup (R-03). */}
          <main
            id="konten"
            className="mx-auto w-full max-w-[1120px] px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-20"
          >
            {children}
          </main>
        </div>

        {/* Bilah bawah: hanya HP. Tambah memakai warna aksen sebagai satu-satunya aksi utama di bilah ini. */}
        <nav
          aria-label="Navigasi utama"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-raised lg:hidden"
        >
          <div className="mx-auto grid max-w-[1120px] grid-cols-5 items-stretch gap-1 px-2 pb-[env(safe-area-inset-bottom)]">
            {NAV_ITEMS.slice(0, 2).map((item) => (
              <TabLink key={item.to} item={item} />
            ))}
            <button
              type="button"
              onClick={() => openQuickEntry()}
              className="my-1.5 flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-control bg-accent px-1 py-1 text-accent-fg hover:brightness-110"
            >
              <IconPlus size={20} />
              <span className="text-2xs font-semibold leading-none">Tambah</span>
            </button>
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
        `flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-2xs font-semibold ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.Icon size={20} />
          <span>{item.label}</span>
          <span className={`h-0.5 w-5 ${isActive ? 'bg-accent' : 'bg-transparent'}`} aria-hidden="true" />
        </>
      )}
    </NavLink>
  );
}
