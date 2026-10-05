// routes/profil/parts/WalletSection.tsx : dompet: buat, ubah, rekonsiliasi, arsipkan, dan hapus
// saat belum punya histori (PRD FR02, FR03).
import { useEffect, useId, useRef, useState } from 'react';
import { api, ApiError, type Wallet } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, CardHead, ConfirmDialog, EmptyState, IconTile, LoadingRows, Money, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { IconChevronDown, IconWallet } from '../../../components/icons.tsx';
import { DataError } from '../../../components/layout/DataError.tsx';
import { WalletForm } from '../../../components/forms/WalletForm.tsx';
import { ReconcileForm } from '../../../components/forms/ReconcileForm.tsx';
import { errorMessage } from '../../../components/forms/support.tsx';
import { WALLET_TYPE_LABEL, formatDateShort, toMinor } from '../../../lib/format.ts';

export function WalletSection() {
  const { push } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [reconciling, setReconciling] = useState<Wallet | null>(null);
  const [archiving, setArchiving] = useState<Wallet | null>(null);
  const [deleting, setDeleting] = useState<Wallet | null>(null);
  const [deleteNote, setDeleteNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wallets = useAsync(() => api.wallets({ includeArchived: true }), []);
  const list = wallets.data ?? [];
  const active = list.filter((entry) => !entry.archivedAt);
  const archivedCount = list.length - active.length;
  const activeTotal = active.reduce((sum, entry) => sum + toMinor(entry.balance), 0);

  function refresh(message: string) {
    push('success', message);
    wallets.reload();
  }

  async function archiveWallet(wallet: Wallet) {
    setBusy(true);
    try {
      await api.archiveWallet(wallet.id);
      setArchiving(null);
      refresh(`Dompet ${wallet.name} diarsipkan.`);
    } catch (caught) {
      push('error', `Dompet gagal diarsipkan. ${errorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteWallet(wallet: Wallet) {
    setBusy(true);
    setDeleteNote(null);
    try {
      await api.deleteWallet(wallet.id);
      setDeleting(null);
      refresh(`Dompet ${wallet.name} dihapus.`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'wallet_has_history') {
        setDeleteNote('Dompet ini sudah punya histori transaksi, jadi tidak bisa dihapus. Arsipkan saja supaya laporan lama tetap utuh.');
      } else {
        setDeleteNote(`Dompet gagal dihapus. ${errorMessage(caught)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4">
      {wallets.loading && !wallets.data ? <LoadingRows rows={3} label="Memuat dompet" /> : null}
      {wallets.error ? (
        <DataError error={wallets.error} onRetry={wallets.reload} label="Dompet gagal dimuat." />
      ) : null}

      {wallets.data ? (
        list.length === 0 ? (
          <EmptyState
            title="Belum ada dompet"
            body="Dompet adalah tempat uang Anda dicatat, misalnya kas harian, rekening bank, atau e-wallet. Saldo awal dicatat sebagai jurnal pembukaan, bukan pendapatan."
            action={<Button onClick={() => setCreating(true)}>Dompet baru</Button>}
          />
        ) : (
          <Card className="px-4 pb-2">
            <div className="pt-4">
              <CardHead
                title="Dompet"
                subtitle="Saldo tiap dompet setelah semua transaksi."
                action={
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Dompet baru
                  </Button>
                }
              />
            </div>

            {/* Satu angka ringkasan di atas daftar: jumlah saldo yang tersedia untuk transaksi baru. */}
            <div
              className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-control bg-sunken px-3 py-2"
              role="status"
              aria-live="polite"
            >
              <span className="text-xs text-muted">
                Total saldo {active.length} dompet aktif
                {archivedCount > 0 ? `, ${archivedCount} diarsipkan` : ''}
              </span>
              <Money value={activeTotal} size="md" />
            </div>

            <ul className="mt-1 flex flex-col">
              {list.map((wallet) => (
                <li key={wallet.id} className="row-divide flex flex-col gap-1 py-3">
                  <div className="flex items-start gap-3">
                    <IconTile tone={wallet.archivedAt ? 'neutral' : 'accent'}>
                      <IconWallet size={18} />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-fg">{wallet.name}</span>
                        <StatusPill tone="neutral">{WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}</StatusPill>
                        {wallet.archivedAt ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        Mulai {formatDateShort(wallet.openedOn)}
                        {wallet.note ? ` · ${wallet.note}` : ''}
                      </p>
                    </div>
                    <Money value={wallet.balance} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(wallet)}>
                      Ubah
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setReconciling(wallet)}>
                      Rekonsiliasi
                    </Button>
                    {wallet.archivedAt ? (
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(wallet)}>
                        Hapus
                      </Button>
                    ) : (
                      <MoreActions
                        walletName={wallet.name}
                        onArchive={() => setArchiving(wallet)}
                        onDelete={() => setDeleting(wallet)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {creating ? <WalletForm open onClose={() => setCreating(false)} onSaved={refresh} /> : null}
      {editing ? <WalletForm open onClose={() => setEditing(null)} onSaved={refresh} wallet={editing} /> : null}
      {reconciling ? <ReconcileForm open onClose={() => setReconciling(null)} onSaved={refresh} wallet={reconciling} /> : null}

      <ConfirmDialog
        open={archiving !== null}
        title="Arsipkan dompet"
        body={`Arsipkan ${archiving?.name ?? ''}? Dompet arsip tetap masuk laporan historis dan total aset, tetapi tidak menjadi pilihan transaksi baru.`}
        confirmLabel="Arsipkan dompet"
        busy={busy}
        onConfirm={() => {
          if (archiving) void archiveWallet(archiving);
        }}
        onCancel={() => setArchiving(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus dompet"
        body={deleteNote ?? `Hapus ${deleting?.name ?? ''} permanen? Penghapusan hanya berhasil bila dompet belum punya histori transaksi.`}
        confirmLabel="Hapus dompet"
        tone="danger"
        busy={busy}
        onConfirm={() => {
          if (deleting) void deleteWallet(deleting);
        }}
        onCancel={() => {
          setDeleting(null);
          setDeleteNote(null);
        }}
      />
    </section>
  );
}

/**
 * MoreActions: tindakan tambahan satu dompet. Keadaannya dinyatakan lewat aria-expanded dan
 * aria-controls, ditutup dengan Escape atau klik di luar, dan fokus kembali ke tombolnya.
 */
function MoreActions({ walletName, onArchive, onDelete }: { walletName: string; onArchive: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Hentikan di sini supaya Escape tidak ikut menutup lembar yang sedang terbuka.
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Aksi lain untuk ${walletName}`}
        onClick={() => setOpen((value) => !value)}
        className="press inline-flex min-h-[44px] items-center gap-1 rounded-control px-3 text-sm font-semibold text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg"
      >
        Lainnya
        <span aria-hidden="true" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <IconChevronDown size={16} />
        </span>
      </button>
      <div
        id={listId}
        hidden={!open}
        className="absolute right-0 z-20 mt-1 flex w-48 flex-col overflow-hidden rounded-control border border-hairline bg-raised py-1 shadow-lift"
      >
        <button
          type="button"
          className="press min-h-[44px] px-3 text-left text-sm text-fg hover:bg-fg/6"
          onClick={() => {
            setOpen(false);
            onArchive();
          }}
        >
          Arsipkan dompet
        </button>
        <button
          type="button"
          className="press min-h-[44px] px-3 text-left text-sm text-out hover:bg-out/8"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        >
          Hapus dompet
        </button>
      </div>
    </div>
  );
}
