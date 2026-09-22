// components/forms/ReconcileForm.tsx : compare recorded balance with the real one (PRD FR03).
// The difference is only stored after the user reviews it, with a reason.
import { useId, useState, type FormEvent } from 'react';
import { api, type IsoDate, type Wallet } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Sheet, TextInput, Textarea } from '../ui.tsx';
import { formatIDR, toMinor, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

export function ReconcileForm({
  open, onClose, onSaved, wallet,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  wallet: Wallet;
}) {
  const formId = useId();
  const recorded = toMinor(wallet.balance);
  const [actualBalance, setActualBalance] = useState(recorded);
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<IsoDate>(todayIso());
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const difference = actualBalance - recorded;
  const noDifference = difference === 0;

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!reason.trim()) found.reason = 'Isi alasan penyesuaian. Alasan disimpan bersama selisihnya.';
    if (noDifference) found.actualBalance = 'Saldo catatan dan saldo aktual sama. Tidak ada penyesuaian yang perlu disimpan.';
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
      const result = await api.reconcile(wallet.id, {
        actualBalance: String(actualBalance),
        reason: reason.trim(),
        effectiveDate,
      });
      onSaved(`Penyesuaian ${formatIDR(result.difference)} dicatat untuk ${wallet.name}.`);
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
      title="Rekonsiliasi saldo"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} disabled={noDifference} block>
            Simpan penyesuaian
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
          {wallet.name} · saldo catatan <Money value={wallet.balance} forceVisible />
        </p>

        <Field label="Saldo aktual" htmlFor={`${formId}-actual`} required error={issues.actualBalance} hint="Isi saldo yang benar-benar ada saat ini.">
          <AmountInput
            id={`${formId}-actual`}
            label="Saldo aktual"
            value={actualBalance}
            invalid={Boolean(issues.actualBalance)}
            onValueChange={setActualBalance}
          />
        </Field>

        <Field label="Alasan" htmlFor={`${formId}-reason`} required error={issues.reason} hint="Contoh: catatan belanja tunai belum dimasukkan.">
          <Textarea id={`${formId}-reason`} value={reason} invalid={Boolean(issues.reason)} onChange={(event) => setReason(event.target.value)} placeholder="Alasan penyesuaian" />
        </Field>

        <Field label="Tanggal berlaku" htmlFor={`${formId}-date`} required>
          <TextInput id={`${formId}-date`} type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </Field>

        <ReviewList
          rows={[
            { label: 'Saldo catatan', value: <Money value={wallet.balance} forceVisible /> },
            { label: 'Saldo aktual', value: <Money value={actualBalance} forceVisible /> },
            {
              label: difference >= 0 ? 'Selisih masuk' : 'Selisih keluar',
              value: <Money value={Math.abs(difference)} direction={difference >= 0 ? 'in' : 'out'} forceVisible />,
              strong: true,
            },
          ]}
          note="Selisih disimpan sebagai penyesuaian saldo, bukan pendapatan atau pengeluaran. Riwayat lama tidak diubah."
        />
      </form>
    </Sheet>
  );
}
