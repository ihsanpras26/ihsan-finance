// components/forms/AllocationForm.tsx : allocate wallet money to a goal, or release it (PRD FR14).
// Allocation marks part of a wallet balance; it does not move money unless the user asks for a transfer.
import { useId, useState, type FormEvent } from 'react';
import { api, type Goal, type IsoDate, type Wallet } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet, TextInput } from '../ui.tsx';
import { formatIDR, toMinor, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, SwitchRow, type FormIssues } from './support.tsx';

export function AllocationForm({
  open, onClose, onSaved, goal, wallets, mode, defaultWalletId = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  goal: Goal;
  wallets: Wallet[];
  mode: 'allocate' | 'release';
  defaultWalletId?: string | null;
}) {
  const formId = useId();
  const releasing = mode === 'release';
  const allocated = toMinor(goal.allocated);
  const preferred = wallets.find((entry) => entry.id === defaultWalletId) ?? wallets[0] ?? null;

  const [walletId, setWalletId] = useState(preferred?.id ?? '');
  const [amount, setAmount] = useState(releasing ? allocated : 0);
  const [effectiveDate, setEffectiveDate] = useState<IsoDate>(todayIso());
  const [note, setNote] = useState('');
  const [moveMoney, setMoveMoney] = useState(false);
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const after = releasing ? Math.max(0, allocated - amount) : allocated + amount;

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (amount <= 0) found.amount = 'Nominal harus lebih dari Rp0. Isi nominal lalu simpan lagi.';
    if (releasing && amount > allocated) {
      found.amount = `Nominal melebihi alokasi aktif ${formatIDR(allocated)}. Kurangi nominal lalu simpan lagi.`;
    }
    if (!walletId) found.walletId = releasing ? 'Pilih dompet asal alokasi.' : 'Pilih dompet sumber dana.';
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setIssues(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      if (releasing) {
        await api.releaseGoal(goal.id, { walletId, amount: String(amount), effectiveDate, note: note.trim() || undefined });
        onSaved(`Alokasi ${formatIDR(amount)} dilepas dari ${goal.name}. Saldo dompet tidak berubah.`);
      } else {
        await api.allocateGoal(goal.id, {
          walletId,
          amount: String(amount),
          effectiveDate,
          note: note.trim() || undefined,
          moveMoney,
        });
        onSaved(
          moveMoney
            ? `Dana dipindahkan lalu dialokasikan ke ${goal.name}.`
            : `Alokasi ${formatIDR(amount)} dicatat untuk ${goal.name}. Saldo dompet tidak berubah.`,
        );
      }
      onClose();
    } catch (caught) {
      setIssues(issuesFrom(caught));
      setFailure(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={releasing ? 'Lepas alokasi' : 'Alokasikan dana'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {releasing ? 'Lepas alokasi' : 'Alokasikan dana'}
          </Button>
          <Button variant="ghost" onClick={onClose} block>
            Batal
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {failure ? (
          <p className="rounded-control border border-out/40 px-3 py-2.5 text-sm text-fg" role="alert">
            {failure}
          </p>
        ) : null}

        <p className="text-sm text-muted">
          {goal.name} · alokasi aktif <Money value={goal.allocated} forceVisible />
        </p>

        <Field
          label="Nominal"
          htmlFor={`${formId}-amount`}
          required
          error={issues.amount}
          hint={releasing ? `Maksimum ${formatIDR(allocated)}.` : undefined}
        >
          <AmountInput id={`${formId}-amount`} label="Nominal" value={amount} invalid={Boolean(issues.amount)} onValueChange={setAmount} />
        </Field>

        <Field
          label={releasing ? 'Dompet asal alokasi' : 'Dompet sumber dana'}
          htmlFor={`${formId}-wallet`}
          required
          error={issues.walletId}
          hint={releasing ? undefined : 'Alokasi tidak menurunkan saldo dompet ini.'}
        >
          <Select id={`${formId}-wallet`} value={walletId} invalid={Boolean(issues.walletId)} onChange={(event) => setWalletId(event.target.value)}>
            <option value="">Pilih dompet</option>
            {wallets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal" htmlFor={`${formId}-date`} required>
          <TextInput id={`${formId}-date`} type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </Field>

        <Field label="Catatan" htmlFor={`${formId}-note`} hint="Opsional.">
          <TextInput id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan" />
        </Field>

        {releasing ? null : (
          <div className="rounded-panel border border-hairline px-4">
            <SwitchRow
              label="Pindahkan uang sekaligus"
              hint="Transfer ke dompet tujuan lalu alokasi dikerjakan dalam satu proses. Bila mati, alokasi hanya menandai saldo."
              checked={moveMoney}
              onChange={setMoveMoney}
            />
          </div>
        )}

        <ReviewList
          rows={[
            { label: 'Alokasi aktif sekarang', value: <Money value={goal.allocated} forceVisible /> },
            {
              label: releasing ? 'Dilepas' : 'Ditambahkan',
              value: <Money value={amount} direction={releasing ? 'out' : 'in'} forceVisible />,
            },
            { label: 'Alokasi setelah ini', value: <Money value={after} forceVisible />, strong: true },
          ]}
          note={
            releasing
              ? 'Melepas alokasi hanya membebaskan dana. Tidak ada pendapatan yang tercatat.'
              : 'Alokasi menandai sebagian saldo dompet untuk tujuan ini dan tidak menurunkan saldo dompet.'
          }
        />
      </form>
    </Sheet>
  );
}
