// routes/profil/parts/WalletSection.tsx : wallets: create, rename, archive, delete when unused, reconcile (PRD FR02, FR03).
import { useState } from 'react';
import { api, ApiError, type Wallet } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, LedgerRow, LoadingRows, Money, SectionHead, StatusPill, useToast,
} from '../../../components/ui.tsx';
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
        action={<Button onClick={() => setCreating(true)}>Dompet baru</Button>}
      />

      {wallets.loading && !wallets.data ? <LoadingRows rows={3} label="Memuat dompet" /> : null}
      {wallets.error ? <ErrorState message={wallets.error.display} onRetry={wallets.reload} /> : null}

      {wallets.data ? (
        <>
          <p className="mt-1 text-xs text-muted">
            Total saldo dompet aktif <span className="tnum font-semibold text-fg">{formatIDR(activeTotal)}</span> dari {active.length} dompet.
          </p>

          {list.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="Belum ada dompet"
                body="Dompet adalah tempat uang Anda dicatat, misalnya kas harian, rekening bank, atau e-wallet. Saldo awal dicatat sebagai jurnal pembukaan, bukan pendapatan."
                action={<Button onClick={() => setCreating(true)}>Dompet baru</Button>}
              />
            </div>
          ) : (
            <ul className="mt-2">
              {list.map((wallet) => (
                <LedgerRow as="li" key={wallet.id}>
                  <div className="flex w-full flex-col gap-1.5 py-0.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="text-sm font-semibold text-fg">{wallet.name}</span>
                      <StatusPill tone="neutral">{WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}</StatusPill>
                      {wallet.archivedAt ? <StatusPill tone="neutral">Diarsipkan</StatusPill> : null}
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-xs text-muted">
                        Mulai {formatDateShort(wallet.openedOn)}
                        {wallet.note ? ` · ${wallet.note}` : ''}
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs text-muted">Saldo</span>
                        <Money value={wallet.balance} />
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Button variant="ghost" onClick={() => setEditing(wallet)}>
                        Ubah
                      </Button>
                      <Button variant="ghost" onClick={() => setReconciling(wallet)}>
                        Rekonsiliasi saldo
                      </Button>
                      {wallet.archivedAt ? null : (
                        <Button variant="ghost" onClick={() => setArchiving(wallet)}>
                          Arsipkan
                        </Button>
                      )}
                      {wallet.archivedAt ? null : (
                        <Button variant="ghost" onClick={() => setDeleting(wallet)}>
                          Hapus
                        </Button>
                      )}
                    </div>
                  </div>
                </LedgerRow>
              ))}
            </ul>
          )}
        </>
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
