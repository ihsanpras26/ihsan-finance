// components/forms/WalletForm.tsx : create a wallet, or rename and retype an existing one (PRD FR02).
import { useId, useState, type FormEvent } from 'react';
import { api, type IsoDate, type Wallet } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet, TextInput, Textarea } from '../ui.tsx';
import { formatIDR, WALLET_TYPE_LABEL, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

export function WalletForm({
  open, onClose, onSaved, wallet = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  wallet?: Wallet | null;
}) {
  const isEdit = wallet !== null;
  const formId = useId();
  const [name, setName] = useState(wallet?.name ?? '');
  const [type, setType] = useState<string>(wallet?.type ?? 'cash');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openedOn, setOpenedOn] = useState<IsoDate>(wallet?.openedOn ?? todayIso());
  const [note, setNote] = useState(wallet?.note ?? '');
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!name.trim()) found.name = 'Isi nama dompet. Nama muncul di setiap transaksi.';
    if (openingBalance < 0) found.openingBalance = 'Saldo awal tidak boleh negatif. Isi Rp0 bila dompet mulai kosong.';
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
      if (wallet) {
        await api.updateWallet(wallet.id, {
          name: name.trim(),
          type,
          note: note.trim() || undefined,
          expectedVersion: wallet.version,
        });
        onSaved(`Dompet ${name.trim()} diperbarui.`);
      } else {
        await api.createWallet({
          name: name.trim(),
          type,
          openingBalance: String(openingBalance),
          openedOn,
          note: note.trim() || undefined,
        });
        onSaved(
          openingBalance > 0
            ? `Dompet ${name.trim()} dibuat dengan saldo awal ${formatIDR(openingBalance)}.`
            : `Dompet ${name.trim()} dibuat tanpa saldo awal.`,
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
      title={isEdit ? 'Ubah dompet' : 'Dompet baru'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {isEdit ? 'Simpan perubahan' : 'Simpan dompet'}
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

        <Field label="Nama dompet" htmlFor={`${formId}-name`} required error={issues.name} hint="Contoh: kas harian, rekening bank, e-wallet.">
          <TextInput id={`${formId}-name`} value={name} invalid={Boolean(issues.name)} onChange={(event) => setName(event.target.value)} placeholder="Nama dompet" />
        </Field>

        <Field label="Jenis" htmlFor={`${formId}-type`} required>
          <Select id={`${formId}-type`} value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(WALLET_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {isEdit ? (
          <p className="text-xs text-muted">
            Saldo tidak diubah dari sini. Pakai rekonsiliasi saldo bila catatan dan saldo nyata berbeda.
          </p>
        ) : (
          <>
            <Field label="Saldo awal" htmlFor={`${formId}-opening`} error={issues.openingBalance} hint="Saldo dompet saat mulai dipakai. Isi Rp0 bila belum ada uang.">
              <AmountInput
                id={`${formId}-opening`}
                label="Saldo awal"
                value={openingBalance}
                invalid={Boolean(issues.openingBalance)}
                onValueChange={setOpeningBalance}
              />
            </Field>
            <Field label="Tanggal mulai" htmlFor={`${formId}-opened`} required>
              <TextInput id={`${formId}-opened`} type="date" value={openedOn} onChange={(event) => setOpenedOn(event.target.value)} />
            </Field>
          </>
        )}

        <Field label="Catatan" htmlFor={`${formId}-note`} hint="Opsional. Nama rekening lengkap tidak wajib.">
          <Textarea id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan" />
        </Field>

        {isEdit ? null : (
          <ReviewList
            rows={[
              { label: 'Jenis', value: WALLET_TYPE_LABEL[type] ?? type },
              { label: 'Saldo awal', value: <Money value={openingBalance} forceVisible />, strong: true },
              { label: 'Tanggal mulai', value: openedOn },
            ]}
            note="Saldo awal dicatat sebagai jurnal pembukaan dan tidak menambah pendapatan. Saldo awal nol tidak membuat jurnal."
          />
        )}
      </form>
    </Sheet>
  );
}
