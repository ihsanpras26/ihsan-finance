// components/forms/GoalForm.tsx : a savings goal: name, target, optional date, priority (PRD FR13).
import { useId, useState, type FormEvent } from 'react';
import { api, type Goal, type IsoDate } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet, TextInput, Textarea } from '../ui.tsx';
import { toMinor, todayIso } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

const PRIORITY_LABEL: Record<string, string> = { '1': 'Tinggi', '2': 'Sedang', '3': 'Rendah' };

export function GoalForm({
  open, onClose, onSaved, goal = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  goal?: Goal | null;
}) {
  const isEdit = goal !== null;
  const formId = useId();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(() => (goal ? toMinor(goal.target) : 0));
  const [targetDate, setTargetDate] = useState<string>(goal?.targetDate ?? '');
  const [priority, setPriority] = useState(String(goal?.priority ?? 2));
  const [note, setNote] = useState(goal?.note ?? '');
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!name.trim()) found.name = 'Isi nama tujuan. Nama membedakannya dari tujuan lain.';
    if (target <= 0) found.target = 'Target harus lebih dari Rp0. Isi target lalu simpan lagi.';
    if (targetDate && targetDate < todayIso()) {
      found.targetDate = 'Tanggal target sudah lewat. Pilih tanggal setelah hari ini atau kosongkan.';
    }
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
      const shared = {
        name: name.trim(),
        target: String(target),
        targetDate: (targetDate || null) as IsoDate | null,
        priority: Number(priority),
      };
      if (goal) {
        await api.updateGoal(goal.id, { ...shared, note: note.trim() || null, expectedVersion: goal.version });
        onSaved(`Tujuan ${name.trim()} diperbarui.`);
      } else {
        await api.createGoal({ ...shared, note: note.trim() || undefined });
        onSaved(`Tujuan ${name.trim()} dibuat. Alokasikan dana untuk mulai mengisinya.`);
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
      title={isEdit ? 'Ubah tujuan' : 'Buat tujuan'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {isEdit ? 'Simpan perubahan' : 'Simpan tujuan'}
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

        <Field label="Nama tujuan" htmlFor={`${formId}-name`} required error={issues.name} hint="Contoh: dana pendidikan, uang muka rumah.">
          <TextInput
            id={`${formId}-name`}
            value={name}
            invalid={Boolean(issues.name)}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama tujuan"
          />
        </Field>

        <Field label="Target" htmlFor={`${formId}-target`} required error={issues.target}>
          <AmountInput id={`${formId}-target`} label="Target" value={target} invalid={Boolean(issues.target)} onValueChange={setTarget} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal target" htmlFor={`${formId}-date`} error={issues.targetDate} hint="Opsional. Dipakai untuk proyeksi setoran bulanan.">
            <TextInput
              id={`${formId}-date`}
              type="date"
              value={targetDate}
              invalid={Boolean(issues.targetDate)}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </Field>
          <Field label="Prioritas" htmlFor={`${formId}-priority`}>
            <Select id={`${formId}-priority`} value={priority} onChange={(event) => setPriority(event.target.value)}>
              {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Catatan" htmlFor={`${formId}-note`} hint="Opsional.">
          <Textarea id={`${formId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan" />
        </Field>

        <ReviewList
          rows={[
            { label: 'Target', value: <Money value={target} forceVisible /> },
            { label: 'Tanggal target', value: targetDate || 'Belum ditentukan' },
            { label: 'Prioritas', value: PRIORITY_LABEL[priority] ?? 'Sedang' },
          ]}
          note={isEdit ? 'Mengubah target tidak mengubah kas dan tidak mengubah alokasi yang sudah tercatat.' : 'Tujuan dibuat tanpa memindahkan uang. Alokasikan dana setelah ini.'}
        />
      </form>
    </Sheet>
  );
}
