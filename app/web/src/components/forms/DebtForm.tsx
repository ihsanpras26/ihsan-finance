// components/forms/DebtForm.tsx : one debt or receivable note (PRD FR09).
// The parent mounts this per open, so every field starts from the record it edits.
import { useId, useState, type FormEvent } from 'react';
import { api, type Debt, type IsoDate, type Wallet } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet, TextInput, Textarea } from '../ui.tsx';
import { toMinor, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, RadioGroup, ReviewList, type FormIssues } from './support.tsx';

export function DebtForm({
  open, onClose, onSaved, wallets, debt = null, initialDirection = 'payable',
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  wallets: Wallet[];
  debt?: Debt | null;
  initialDirection?: 'payable' | 'receivable';
}) {
  const isEdit = debt !== null;
  const formId = useId();
  const [direction, setDirection] = useState<'payable' | 'receivable'>(debt?.direction ?? initialDirection);
  const [name, setName] = useState(debt?.counterpartyName ?? '');
  const [principal, setPrincipal] = useState(() => (debt ? toMinor(debt.principal) : 0));
  const [startDate, setStartDate] = useState<IsoDate>(debt?.startDate ?? todayIso());
  const [dueDate, setDueDate] = useState<string>(debt?.dueDate ?? '');
  const [openingMode, setOpeningMode] = useState<'cash' | 'legacy'>('cash');
  const [walletId, setWalletId] = useState(() => wallets[0]?.id ?? '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const payable = direction === 'payable';
  const wallet = wallets.find((entry) => entry.id === walletId) ?? null;

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!name.trim()) found.counterpartyName = 'Isi nama pihak. Nama menandai catatan ini di daftar.';
    if (principal <= 0) found.principal = 'Nominal harus lebih dari Rp0. Isi nominal lalu simpan lagi.';
    if (dueDate && dueDate < startDate) found.dueDate = 'Jatuh tempo tidak boleh sebelum tanggal mulai.';
    if (!isEdit && openingMode === 'cash' && !walletId) found.walletId = 'Pilih dompet. Dana yang berpindah harus punya dompet.';
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
      if (debt) {
        await api.updateDebt(debt.id, {
          counterpartyName: name.trim(),
          principal: String(principal),
          startDate,
          dueDate: dueDate || null,
          note: note.trim() || null,
          expectedVersion: debt.version,
        });
        onSaved(`Catatan ${name.trim()} diperbarui.`);
      } else {
        await api.createDebt({
          direction,
          counterpartyName: name.trim(),
          principal: String(principal),
          startDate,
          dueDate: dueDate || null,
          openingMode,
          walletId: openingMode === 'cash' ? walletId : null,
          note: note.trim() || null,
        });
        onSaved(payable ? `Utang kepada ${name.trim()} tercatat.` : `Piutang kepada ${name.trim()} tercatat.`);
      }
      onClose();
    } catch (caught) {
      setIssues(issuesFrom(caught));
      setFailure(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const effect = isEdit
    ? 'Perubahan pokok dan tanggal terekam sebagai versi baru. Kas tidak berubah.'
    : openingMode === 'legacy'
      ? 'Tidak ada kas yang berpindah. Sisa pokok dicatat sebesar nominal ini.'
      : payable
        ? 'Kas bertambah sebesar pokok, kewajiban bertambah sebesar pokok.'
        : 'Kas berkurang sebesar pokok, piutang bertambah sebesar pokok.';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Ubah catatan' : payable ? 'Catat utang' : 'Catat piutang'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {isEdit ? 'Simpan perubahan' : payable ? 'Simpan utang' : 'Simpan piutang'}
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

        <RadioGroup
          legend="Arah catatan"
          value={direction}
          disabled={isEdit}
          onChange={setDirection}
          options={[
            { value: 'payable', label: 'Utang (kewajiban saya)', hint: 'Saya meminjam dan harus membayar.' },
            { value: 'receivable', label: 'Piutang (hak tagih saya)', hint: 'Saya memberi pinjaman dan akan menerima kembali.' },
          ]}
        />

        <Field label="Nama pihak" htmlFor={`${formId}-name`} required error={issues.counterpartyName} hint="Nama orang, toko, atau lembaga.">
          <TextInput
            id={`${formId}-name`}
            value={name}
            invalid={Boolean(issues.counterpartyName)}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama pihak"
          />
        </Field>

        <Field label="Nominal pokok" htmlFor={`${formId}-principal`} required error={issues.principal}>
          <AmountInput id={`${formId}-principal`} label="Nominal pokok" value={principal} invalid={Boolean(issues.principal)} onValueChange={setPrincipal} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal mulai" htmlFor={`${formId}-start`} required>
            <TextInput id={`${formId}-start`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Jatuh tempo" htmlFor={`${formId}-due`} error={issues.dueDate} hint="Kosongkan bila tanggalnya belum diketahui.">
            <TextInput id={`${formId}-due`} type="date" value={dueDate} invalid={Boolean(issues.dueDate)} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>

        {isEdit ? (
          <p className="text-xs text-muted">
            Cara pencatatan awal tidak diubah setelah catatan dibuat. Ubah pokok, tanggal, atau catatan bila ada koreksi.
          </p>
        ) : (
          <>
            <RadioGroup
              legend="Cara mencatat"
              value={openingMode}
              onChange={setOpeningMode}
              options={[
                {
                  value: 'cash',
                  label: 'Dana diterima atau diberikan sekarang',
                  hint: payable ? 'Kas masuk ke dompet yang dipilih.' : 'Kas keluar dari dompet yang dipilih.',
                },
                { value: 'legacy', label: 'Saldo lama', hint: 'Catatan yang sudah terjadi sebelumnya, tanpa arus kas baru.' },
              ]}
            />

            {openingMode === 'cash' ? (
              <Field
                label={payable ? 'Dompet penerima dana' : 'Dompet sumber dana'}
                htmlFor={`${formId}-wallet`}
                required
                error={issues.walletId}
                hint={payable ? undefined : 'Pastikan dompet punya saldo cukup.'}
              >
                <Select
                  id={`${formId}-wallet`}
                  value={walletId}
                  invalid={Boolean(issues.walletId)}
                  onChange={(event) => setWalletId(event.target.value)}
                >
                  <option value="">Pilih dompet</option>
                  {wallets.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </>
        )}

        <Field label="Catatan" htmlFor={`${formId}-note`} hint="Opsional. Dipakai untuk syarat atau kesepakatan.">
          <Textarea id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan" />
        </Field>

        <ReviewList
          rows={[
            { label: 'Pokok', value: <Money value={principal} forceVisible /> },
            { label: 'Tanggal mulai', value: startDate },
            ...(dueDate ? [{ label: 'Jatuh tempo', value: dueDate }] : [{ label: 'Jatuh tempo', value: 'Belum ada' }]),
            ...(isEdit || openingMode === 'legacy' ? [] : [{ label: 'Dompet', value: wallet?.name ?? 'Belum dipilih' }]),
          ]}
          note={effect}
        />
      </form>
    </Sheet>
  );
}
