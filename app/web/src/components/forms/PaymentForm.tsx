// components/forms/PaymentForm.tsx : a partial or full payment against one debt note (PRD FR10).
// Principal, interest, and fee are separated; the cash total is reviewed before saving.
import { useId, useState, type FormEvent } from 'react';
import { api, type Debt, type IsoDate, type Wallet } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet, TextInput, Textarea } from '../ui.tsx';
import { formatIDR, toMinor, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

export function PaymentForm({
  open, onClose, onSaved, debt, wallets, defaultWalletId = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  debt: Debt;
  wallets: Wallet[];
  defaultWalletId?: string | null;
}) {
  const formId = useId();
  const remaining = toMinor(debt.remaining);
  const payable = debt.direction === 'payable';
  const preferred = wallets.find((entry) => entry.id === defaultWalletId) ?? wallets[0] ?? null;

  const [principal, setPrincipal] = useState(remaining);
  const [interest, setInterest] = useState(0);
  const [fee, setFee] = useState(0);
  const [walletId, setWalletId] = useState(preferred?.id ?? '');
  const [paymentDate, setPaymentDate] = useState<IsoDate>(todayIso());
  const [note, setNote] = useState('');
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = principal + interest + fee;
  const after = remaining - principal;

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (principal < 0 || interest < 0 || fee < 0) found.principal = 'Nominal tidak boleh negatif. Isi angka nol atau lebih.';
    if (principal > remaining) {
      found.principal = `Pokok yang dibayar melebihi sisa pokok ${formatIDR(remaining)}. Kurangi nominal pokok lalu simpan lagi.`;
    }
    if (total <= 0) found.principal = 'Total pembayaran harus lebih dari Rp0. Isi pokok, bunga, atau biaya.';
    if (!walletId) found.walletId = 'Pilih dompet. Kas harus punya dompet asal atau tujuan.';
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
      await api.payDebt(debt.id, {
        principal: String(principal),
        interest: String(interest),
        fee: String(fee),
        walletId,
        paymentDate,
        note: note.trim() || undefined,
      });
      const rest = remaining - principal;
      onSaved(
        rest <= 0
          ? `Pembayaran tercatat. Sisa pokok nol, catatan ${debt.counterpartyName} lunas.`
          : `Pembayaran tercatat. Sisa pokok ${debt.counterpartyName} kini ${formatIDR(rest)}.`,
      );
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
      title={payable ? 'Catat cicilan' : 'Catat penerimaan piutang'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {payable ? 'Catat cicilan' : 'Catat penerimaan'}
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
          {debt.counterpartyName} · sisa pokok <Money value={debt.remaining} forceVisible />
        </p>

        <Field
          label="Pokok yang dibayar"
          htmlFor={`${formId}-principal`}
          required
          error={issues.principal}
          hint={`Maksimum ${formatIDR(remaining)}.`}
        >
          <AmountInput
            id={`${formId}-principal`}
            label="Pokok yang dibayar"
            value={principal}
            invalid={Boolean(issues.principal)}
            onValueChange={setPrincipal}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bunga" htmlFor={`${formId}-interest`} hint="Isi 0 bila tidak ada.">
            <AmountInput id={`${formId}-interest`} label="Bunga" value={interest} onValueChange={setInterest} />
          </Field>
          <Field label="Biaya" htmlFor={`${formId}-fee`} hint="Isi 0 bila tidak ada.">
            <AmountInput id={`${formId}-fee`} label="Biaya" value={fee} onValueChange={setFee} />
          </Field>
        </div>

        <Field label={payable ? 'Dompet sumber dana' : 'Dompet penerima dana'} htmlFor={`${formId}-wallet`} required error={issues.walletId}>
          <Select id={`${formId}-wallet`} value={walletId} invalid={Boolean(issues.walletId)} onChange={(event) => setWalletId(event.target.value)}>
            <option value="">Pilih dompet</option>
            {wallets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal pembayaran" htmlFor={`${formId}-date`} required>
          <TextInput id={`${formId}-date`} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </Field>

        <Field label="Catatan" htmlFor={`${formId}-note`} hint="Opsional.">
          <Textarea id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan" />
        </Field>

        <ReviewList
          rows={[
            { label: 'Pokok', value: <Money value={principal} direction="out" forceVisible /> },
            { label: 'Bunga', value: <Money value={interest} direction="out" forceVisible /> },
            { label: 'Biaya', value: <Money value={fee} direction="out" forceVisible /> },
            {
              label: payable ? 'Total kas keluar' : 'Total kas masuk',
              value: <Money value={total} direction={payable ? 'out' : 'in'} forceVisible />,
              strong: true,
            },
            { label: 'Sisa pokok setelah ini', value: <Money value={Math.max(0, after)} forceVisible /> },
          ]}
          note={
            payable
              ? 'Kas berkurang sebesar total. Pokok mengurangi kewajiban; bunga dan biaya dicatat sebagai pengeluaran.'
              : 'Kas bertambah sebesar total. Pokok mengurangi piutang; bunga dicatat sebagai pendapatan.'
          }
        />
      </form>
    </Sheet>
  );
}
