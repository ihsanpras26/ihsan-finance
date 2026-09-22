// routes/profil/parts/WalletSection.tsx : wallets: create, rename, archive, delete when unused, reconcile (PRD FR02, FR03).
import { useState } from 'react';
import { api, ApiError, type Wallet } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, IconTile, LoadingRows, Money, SectionHead, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { IconChevronDown, IconWallet } from '../../../components/icons.tsx';
import { WalletForm } from '../../../components/forms/WalletForm.tsx';
import { ReconcileForm } from '../../../components/forms/ReconcileForm.tsx';
import { errorMessage } from '../../../components/forms/support.tsx';
import { WALLET_TYPE_LABEL, formatDateShort, formatIDR, toMinor } from '../../../lib/format.ts';

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
    <section>
      <SectionHead
        title="Dompet"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            Dompet baru
          </Button>
        }
      />

      {wallets.loading && !wallets.data ? <LoadingRows rows={3} label="Memuat dompet" /> : null}
      {wallets.error ? <ErrorState message={wallets.error.display} onRetry={wallets.reload} /> : null}

      {wallets.data ? (
        list.length === 0 ? (
          <EmptyState
            title="Belum ada dompet"
            body="Dompet adalah tempat uang Anda dicatat, misalnya kas harian, rekening bank, atau e-wallet. Saldo awal dicatat sebagai jurnal pembukaan, bukan pendapatan."
            action={<Button onClick={() => setCreating(true)}>Dompet baru</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Ringkasan saldo aktif: satu angka, satu tepi kanan. */}
            <Card className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-muted">Total saldo dompet aktif dari {active.length} dompet</span>
              <span className="figure text-sm font-semibold text-fg">{formatIDR(activeTotal)}</span>
            </Card>

            <Card className="px-4">
              <ul className="flex flex-col">
                {list.map((wallet) => (
                  <li key={wallet.id} className="row-divide flex flex-col gap-2 py-3">
                    <div className="flex items-center gap-3">
                      <IconTile tone={wallet.archivedAt ? 'neutral' : 'accent'}>
                        <IconWallet size={18} />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-fg">{wallet.name}</span>
                          <StatusPill tone="neutral">{WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}</StatusPill>
                          {wallet.archivedAt ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
                        </div>
                        <p className="truncate text-xs text-muted">
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
                        <details className="relative">
                          <summary
                            className="press inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1 rounded-control px-2.5 text-xs font-semibold text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg [&::-webkit-details-marker]:hidden"
                            aria-label={`Aksi lain untuk ${wallet.name}`}
                          >
                            Lainnya
                            <IconChevronDown size={14} />
                          </summary>
                          <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col overflow-hidden rounded-control border border-hairline bg-raised py-1 shadow-lift">
                            <button
                              type="button"
                              className="press min-h-[44px] px-3 text-left text-sm text-fg hover:bg-fg/6"
                              onClick={() => setArchiving(wallet)}
                            >
                              Arsipkan dompet
                            </button>
                            <button
                              type="button"
                              className="press min-h-[44px] px-3 text-left text-sm text-out hover:bg-out/8"
                              onClick={() => setDeleting(wallet)}
                            >
                              Hapus dompet
                            </button>
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
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
