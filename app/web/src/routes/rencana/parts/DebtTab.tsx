// routes/rencana/parts/DebtTab.tsx : debts (payable) and receivables (receivable) as two groups of cards.
// Each card states the counterparty, the due date in plain words, the remaining principal at the
// card's right edge, and how much of the principal has already been paid down.
import { useState, type ReactNode } from 'react';
import { api, type Debt, type Wallet } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { useSession } from '../../../lib/session.tsx';
import {
  Button, Card, EmptyState, ErrorState, IconTile, LoadingRows, Money, ProgressBar, RowTitle, SectionHead, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { IconDebt, IconReceivable } from '../../../components/icons.tsx';
import { DebtForm } from '../../../components/forms/DebtForm.tsx';
import { PaymentForm } from '../../../components/forms/PaymentForm.tsx';
import { WriteOffForm } from '../../../components/forms/WriteOffForm.tsx';
import { SwitchRow } from '../../../components/forms/support.tsx';
import { relativeDay, toMinor } from '../../../lib/format.ts';
import { sumMinor } from './money.ts';

type FormState =
  | { mode: 'create'; direction: 'payable' | 'receivable' }
  | { mode: 'edit'; debt: Debt }
  | null;

export function DebtTab() {
  const { push } = useToast();
  const { preferences } = useSession();
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [writingOff, setWritingOff] = useState<Debt | null>(null);

  const debts = useAsync(() => api.debts({ includeArchived: showDone }), [showDone]);
  const wallets = useAsync(() => api.wallets(), []);

  const walletList: Wallet[] = wallets.data ?? [];
  const all = debts.data ?? [];
  const payable = all.filter((entry) => entry.direction === 'payable');
  const receivable = all.filter((entry) => entry.direction === 'receivable');
  const activeOf = (list: Debt[]) => list.filter((entry) => entry.status === 'active');
  const payableTotal = sumMinor(activeOf(payable).map((entry) => entry.remaining));
  const receivableTotal = sumMinor(activeOf(receivable).map((entry) => entry.remaining));

  function refresh(message: string) {
    push('success', message);
    debts.reload();
  }

  if (debts.loading && !debts.data) return <LoadingRows rows={5} label="Memuat utang dan piutang" />;
  if (debts.error && !debts.data) {
    return <ErrorState message={debts.error.display} onRetry={debts.reload} />;
  }

  const nothingYet = all.length === 0;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Ringkasan: satu angka pokok tersisa untuk tiap arah. */}
      <Card className="px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Sisa pokok utang</p>
            <p className="mt-1">
              <Money value={payableTotal} direction="out" size="lg" />
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Sisa pokok piutang</p>
            <p className="mt-1">
              <Money value={receivableTotal} direction="in" size="lg" />
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Sisa pokok dihitung dari jurnal dan bukan seluruh kewajiban masa depan. Utang dan piutang tidak termasuk saldo uang yang dapat dipakai.
        </p>
      </Card>

      {wallets.error ? (
        <ErrorState message={`Daftar dompet gagal dimuat, jadi cicilan dan pencatatan baru belum bisa disimpan. ${wallets.error.display}`} onRetry={wallets.reload} />
      ) : null}

      {debts.error && debts.data ? <ErrorState message={debts.error.display} onRetry={debts.reload} /> : null}

      {/* Aksi utama layar ini: mencatat catatan baru. Tombol di keadaan kosong memakai gaya
          sekunder supaya hanya ada satu tombol utama di layar. */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setForm({ mode: 'create', direction: 'payable' })}>Catat utang</Button>
        <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'receivable' })}>
          Catat piutang
        </Button>
      </div>

      {nothingYet ? (
        <EmptyState
          title="Belum ada utang atau piutang"
          body="Catat utang saat Anda meminjam uang, dan piutang saat Anda meminjamkan. Sisa pokok serta jatuh temponya lalu terpantau di sini."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'payable' })}>
                Catat utang
              </Button>
              <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'receivable' })}>
                Catat piutang
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <DebtGroup
            title="Utang (kewajiban)"
            hint="Uang yang harus Anda bayar."
            items={sortDebts(payable)}
            emptyTitle="Belum ada utang"
            emptyBody="Catat utang supaya sisa pokok dan jatuh temponya terpantau."
            emptyAction={
              <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'payable' })}>
                Catat utang
              </Button>
            }
            onPay={setPaying}
            onEdit={(debt) => setForm({ mode: 'edit', debt })}
            onWriteOff={setWritingOff}
          />
          <DebtGroup
            title="Piutang (hak tagih)"
            hint="Uang yang harus diterima dari pihak lain."
            items={sortDebts(receivable)}
            emptyTitle="Belum ada piutang"
            emptyBody="Catat piutang supaya tagihan Anda tidak terlewat."
            emptyAction={
              <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'receivable' })}>
                Catat piutang
              </Button>
            }
            onPay={setPaying}
            onEdit={(debt) => setForm({ mode: 'edit', debt })}
            onWriteOff={setWritingOff}
          />
        </>
      )}

      <Card className="px-4">
        <SwitchRow
          label="Tampilkan catatan yang sudah selesai"
          hint="Lunas, dihapuskan, dan diarsipkan. Catatan selesai tetap masuk laporan."
          checked={showDone}
          onChange={setShowDone}
        />
      </Card>

      {form ? (
        <DebtForm
          open
          onClose={() => setForm(null)}
          onSaved={refresh}
          wallets={walletList}
          debt={form.mode === 'edit' ? form.debt : null}
          initialDirection={form.mode === 'create' ? form.direction : 'payable'}
        />
      ) : null}

      {paying ? (
        <PaymentForm
          open
          onClose={() => setPaying(null)}
          onSaved={refresh}
          debt={paying}
          wallets={walletList}
          defaultWalletId={preferences.defaultWalletId ?? preferences.lastWalletId}
        />
      ) : null}

      {writingOff ? (
        <WriteOffForm open onClose={() => setWritingOff(null)} onSaved={refresh} debt={writingOff} />
      ) : null}
    </div>
  );
}

function sortDebts(list: Debt[]): Debt[] {
  return [...list].sort((a, b) => {
    const rankA = a.status === 'active' ? 0 : 1;
    const rankB = b.status === 'active' ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.counterpartyName.localeCompare(b.counterpartyName);
  });
}

/**
 * Lencana status pada kartu, sama seperti sebelumnya: lunas, dihapuskan, diarsipkan, lewat jatuh
 * tempo, belum ada jatuh tempo, atau jatuh tempo dalam hitungan hari.
 */
function debtPill(debt: Debt): ReactNode {
  if (debt.status === 'paid') return <StatusPill tone="in">Lunas</StatusPill>;
  if (debt.status === 'written_off') return <StatusPill tone="neutral">Dihapuskan (non-kas)</StatusPill>;
  if (debt.status === 'archived') return <StatusPill tone="neutral">Diarsipkan</StatusPill>;
  if (debt.overdue) return <StatusPill tone="out">Lewat jatuh tempo</StatusPill>;
  if (!debt.dueDate) return <StatusPill tone="neutral">Belum ada jatuh tempo</StatusPill>;
  return <StatusPill tone="accent">Jatuh tempo {relativeDay(debt.dueDate)}</StatusPill>;
}

function dueText(debt: Debt): string {
  if (!debt.dueDate) return 'Tanpa jatuh tempo';
  if (debt.overdue) return `Lewat jatuh tempo ${relativeDay(debt.dueDate)}`;
  return `Jatuh tempo ${relativeDay(debt.dueDate)}`;
}

function DebtGroup({
  title, hint, items, emptyTitle, emptyBody, emptyAction, onPay, onEdit, onWriteOff,
}: {
  title: string;
  hint: string;
  items: Debt[];
  emptyTitle: string;
  emptyBody: string;
  emptyAction: ReactNode;
  onPay: (debt: Debt) => void;
  onEdit: (debt: Debt) => void;
  onWriteOff: (debt: Debt) => void;
}) {
  return (
    <section>
      <SectionHead title={title} />
      <p className="px-0.5 text-xs text-muted">{hint}</p>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 lg:grid-cols-2 lg:gap-4">
          {items.map((debt) => (
            <DebtCard key={debt.id} debt={debt} onPay={onPay} onEdit={onEdit} onWriteOff={onWriteOff} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DebtCard({
  debt, onPay, onEdit, onWriteOff,
}: { debt: Debt; onPay: (debt: Debt) => void; onEdit: (debt: Debt) => void; onWriteOff: (debt: Debt) => void }) {
  const payable = debt.direction === 'payable';
  const principal = toMinor(debt.principal);
  const remaining = toMinor(debt.remaining);
  // Berapa bagian pokok yang sudah turun. Sisa yang lebih besar dari pokok awal tidak pernah
  // menghasilkan isian negatif pada bilah.
  const paidDown = principal > 0 ? (principal - Math.max(0, remaining)) / principal : 0;
  const direction = payable ? 'out' : 'in';
  const pill = debtPill(debt);

  return (
    <Card as="li" className="px-4 py-4 lg:px-5">
      {/* flex-wrap + basis: saat nominal panjang tidak muat lagi di sebelah nama, kolom nominal
          turun ke barisnya sendiri dan tetap rata kanan, jadi tidak pernah ada geser mendatar. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-40 items-start gap-3">
          <IconTile tone={payable ? 'out' : 'in'}>{payable ? <IconDebt /> : <IconReceivable />}</IconTile>
          <div className="min-w-0 flex-1">
            <RowTitle title={debt.counterpartyName} meta={dueText(debt)} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <Money value={debt.remaining} direction={direction} size="lg" />
          <span className="text-2xs text-muted">Sisa pokok</span>
        </div>
      </div>

      {pill ? <div className="mt-2 flex flex-wrap items-center gap-2">{pill}</div> : null}

      <div className="mt-3">
        <ProgressBar
          ratio={paidDown}
          tone={paidDown >= 1 ? 'in' : 'accent'}
          showPercent
          label={payable ? `Progres pembayaran utang ${debt.counterpartyName}` : `Progres penerimaan piutang ${debt.counterpartyName}`}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>Pokok awal</span>
        <Money value={debt.principal} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {debt.status === 'active' ? (
          <Button variant="secondary" onClick={() => onPay(debt)}>
            {payable ? 'Catat cicilan' : 'Catat penerimaan'}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => onEdit(debt)}>
          Ubah
        </Button>
        {debt.status === 'active' ? (
          <Button variant="ghost" onClick={() => onWriteOff(debt)}>
            Hapuskan (non-kas)
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
