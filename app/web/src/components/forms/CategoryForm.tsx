// components/forms/CategoryForm.tsx : create a category or rename an existing one (PRD FR05).
// Categories are archived, never deleted, so old transactions keep their grouping.
import { useId, useState, type FormEvent } from 'react';
import { api, type Category } from '../../lib/api.ts';
import { Button, Field, Sheet, TextInput } from '../ui.tsx';
import { errorMessage, issuesFrom, RadioGroup, ReviewList, type FormIssues } from './support.tsx';

export function CategoryForm({
  open, onClose, onSaved, category = null, initialKind = 'expense',
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  category?: Category | null;
  initialKind?: 'income' | 'expense';
}) {
  const isEdit = category !== null;
  const formId = useId();
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<'income' | 'expense'>(category?.kind ?? initialKind);
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!name.trim()) found.name = 'Isi nama kategori. Nama dipakai di daftar transaksi dan anggaran.';
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
      if (category) {
        await api.updateCategory(category.id, { name: name.trim(), expectedVersion: category.version });
        onSaved(`Kategori diubah menjadi ${name.trim()}.`);
      } else {
        await api.createCategory({ name: name.trim(), kind });
        onSaved(`Kategori ${name.trim()} dibuat.`);
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
      title={isEdit ? 'Ubah nama kategori' : 'Kategori baru'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} size="lg" block>
            {isEdit ? 'Simpan perubahan' : 'Simpan kategori'}
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

        <Field label="Nama kategori" htmlFor={`${formId}-name`} required error={issues.name}>
          <TextInput id={`${formId}-name`} value={name} invalid={Boolean(issues.name)} onChange={(event) => setName(event.target.value)} placeholder="Nama kategori" />
        </Field>

        {isEdit ? (
          <ReviewList
            rows={[{ label: 'Jenis', value: category.kind === 'income' ? 'Pendapatan' : 'Pengeluaran' }]}
            note="Jenis kategori tidak diubah setelah dibuat. Transaksi lama tetap memakai jenis asalnya."
          />
        ) : (
          <RadioGroup
            legend="Jenis kategori"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Pengeluaran', hint: 'Dipakai untuk belanja dan biaya.' },
              { value: 'income', label: 'Pendapatan', hint: 'Dipakai untuk gaji dan pemasukan lain.' },
            ]}
          />
        )}
      </form>
    </Sheet>
  );
}
