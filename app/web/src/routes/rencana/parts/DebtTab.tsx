// routes/rencana/parts/DebtTab.tsx : debts (payable) and receivables (receivable) as two ledgers.
// Each row states the remaining principal, the due date in plain words, and its status.
import { useState, type ReactNode } from 'react';
import { api, type Debt, type Wallet } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { useSession } from '../../../lib/session.tsx';
import {
  Button, EmptyState, ErrorState, LedgerRow, LoadingRows, Money, SectionHead, StatusPill, useToast,
} from '../../../components/ui.tsx';
import { DebtForm } from '../../../components/forms/DebtForm.tsx';
import { PaymentForm } from '../../../components/forms/PaymentForm.tsx';
import { WriteOffForm } from '../../../components/forms/WriteOffForm.tsx';
import { SwitchRow } from '../../../components/forms/support.tsx';
import { formatIDR, relativeDay } from '../../../lib/format.ts';
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
    <div className="flex flex-col gap-4">
      <div className="rounded-panel border border-hairline bg-raised px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-muted">Sisa pokok utang</p>
            <Money value={payableTotal} direction="out" size="lg" />
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Sisa pokok piutang</p>
            <Money value={receivableTotal} direction="in" size="lg" />
          </div>
        </div>
        <p className="mt-2.5 text-xs text-muted">
          Sisa pokok dihitung dari jurnal dan bukan seluruh kewajiban masa depan. Utang dan piutang tidak termasuk saldo uang yang dapat dipakai.
        </p>
      </div>

      {wallets.error ? (
        <ErrorState message={`Daftar dompet gagal dimuat, jadi cicilan dan pencatatan baru belum bisa disimpan. ${wallets.error.display}`} onRetry={wallets.reload} />
      ) : null}

      {debts.error && debts.data ? <ErrorState message={debts.error.display} onRetry={debts.reload} /> : null}

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
              <Button onClick={() => setForm({ mode: 'create', direction: 'payable' })}>Catat utang</Button>
              <Button variant="secondary" onClick={() => setForm({ mode: 'create', direction: 'receivable' })}>
                Catat piutang
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <DebtList
            title="Utang (kewajiban)"
            hint="Uang yang harus Anda bayar."
            items={sortDebts(payable)}
            emptyTitle="Belum ada utang"
            emptyBody="Catat utang supaya sisa pokok dan jatuh temponya terpantau."
            emptyAction={<Button onClick={() => setForm({ mode: 'create', direction: 'payable' })}>Catat utang</Button>}
            onPay={setPaying}
            onEdit={(debt) => setForm({ mode: 'edit', debt })}
            onWriteOff={setWritingOff}
          />
          <DebtList
            title="Piutang (hak tagih)"
            hint="Uang yang harus diterima dari pihak lain."
            items={sortDebts(receivable)}
            emptyTitle="Belum ada piutang"
            emptyBody="Catat piutang supaya tagihan Anda tidak terlewat."
            emptyAction={<Button onClick={() => setForm({ mode: 'create', direction: 'receivable' })}>Catat piutang</Button>}
            onPay={setPaying}
            onEdit={(debt) => setForm({ mode: 'edit', debt })}
            onWriteOff={setWritingOff}
          />
        </>
      )}

      <div className="rounded-panel border border-hairline px-4">
        <SwitchRow
          label="Tampilkan catatan yang sudah selesai"
          hint="Lunas, dihapuskan, dan diarsipkan. Catatan selesai tetap masuk laporan."
          checked={showDone}
          onChange={setShowDone}
        />
      </div>

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

function DebtPill({ debt }: { debt: Debt }) {
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

function DebtList({
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
      <p className="text-xs text-muted">{hint}</p>
      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />
        </div>
      ) : (
        <ul className="mt-1">
          {items.map((debt) => (
            <LedgerRow as="li" key={debt.id}>
              <div className="flex w-full flex-col gap-1.5 py-0.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-sm font-semibold text-fg">{debt.counterpartyName}</span>
                  <DebtPill debt={debt} />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-xs text-muted">
                    {dueText(debt)} · Pokok awal {formatIDR(debt.principal)}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs text-muted">Sisa pokok</span>
                    <Money value={debt.remaining} direction={debt.direction === 'payable' ? 'out' : 'in'} />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {debt.status === 'active' ? (
                    <Button variant="secondary" onClick={() => onPay(debt)}>
                      {debt.direction === 'payable' ? 'Catat cicilan' : 'Catat penerimaan'}
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
              </div>
            </LedgerRow>
          ))}
        </ul>
      )}
    </section>
  );
}
