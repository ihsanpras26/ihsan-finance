// components/forms/WriteOffForm.tsx : close an uncollectable receivable or a forgiven debt (PRD §06).
// Non-cash adjustment: it never creates a cash movement, and it always needs a reason.
import { useId, useState, type FormEvent } from 'react';
import { api, type Debt, type IsoDate } from '../../lib/api.ts';
import { Button, Field, Money, Sheet, TextInput, Textarea } from '../ui.tsx';
import { todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

export function WriteOffForm({
  open, onClose, onSaved, debt,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  debt: Debt;
}) {
  const formId = useId();
  const payable = debt.direction === 'payable';
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<IsoDate>(todayIso());
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!reason.trim()) found.reason = 'Isi alasan penghapusan. Alasan disimpan di audit dan tidak bisa dikosongkan.';
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
      await api.writeOffDebt(debt.id, { reason: reason.trim(), effectiveDate });
      onSaved(
        payable
          ? `Utang kepada ${debt.counterpartyName} dihapuskan tanpa kas keluar.`
          : `Piutang kepada ${debt.counterpartyName} dihapuskan tanpa kas masuk.`,
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
      title="Hapuskan (non-kas)"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} variant="danger" size="lg" block>
            Simpan penghapusan
          </Button>
          <Button variant="ghost" onClick={onClose} size="lg" block>
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

        <p className="text-sm text-fg">
          {payable
            ? `Catatan ini tidak akan ditandai sudah dibayar. Penghapusan menutup kewajiban sebagai penyesuaian non-kas.`
            : `Piutang yang tidak tertagih tidak ditandai sudah dibayar. Penghapusan menutup tagihan sebagai penyesuaian non-kas.`}
        </p>

        <Field label="Alasan penghapusan" htmlFor={`${formId}-reason`} required error={issues.reason} hint="Contoh: pihak tidak dapat dihubungi sejak Maret.">
          <Textarea id={`${formId}-reason`} value={reason} invalid={Boolean(issues.reason)} onChange={(event) => setReason(event.target.value)} placeholder="Alasan penghapusan" />
        </Field>

        <Field label="Tanggal berlaku" htmlFor={`${formId}-date`} required>
          <TextInput id={`${formId}-date`} type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </Field>

        <ReviewList
          rows={[
            { label: 'Pihak', value: debt.counterpartyName },
            { label: 'Sisa pokok dihapuskan', value: <Money value={debt.remaining} direction="out" forceVisible />, strong: true },
            { label: 'Kas berpindah', value: 'Tidak ada' },
          ]}
          note="Penghapusan tidak menciptakan kas masuk atau keluar, dan tercatat terpisah di audit."
        />
      </form>
    </Sheet>
  );
}
