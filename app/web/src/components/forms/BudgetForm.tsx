// components/forms/BudgetForm.tsx : a monthly limit for one expense category (PRD FR15).
import { useId, useState, type FormEvent } from 'react';
import { api, type Budget, type Category } from '../../lib/api.ts';
import { AmountInput, Button, Field, Money, Select, Sheet } from '../ui.tsx';
import { formatPeriod, periodOptions, toMinor } from '../../lib/format.ts';
import { errorMessage, issuesFrom, ReviewList, type FormIssues } from './support.tsx';

export function BudgetForm({
  open, onClose, onSaved, categories, period, budget = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  categories: Category[];
  period: string;
  budget?: Budget | null;
}) {
  const isEdit = budget !== null;
  const formId = useId();
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? categories[0]?.id ?? '');
  const [limit, setLimit] = useState(() => (budget ? toMinor(budget.limit) : 0));
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [issues, setIssues] = useState<FormIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const category = categories.find((entry) => entry.id === categoryId) ?? null;

  function validate(): FormIssues {
    const found: FormIssues = {};
    if (!isEdit && !categoryId) found.categoryId = 'Pilih kategori pengeluaran yang diberi batas.';
    if (limit <= 0) found.limit = 'Limit harus lebih dari Rp0. Isi limit lalu simpan lagi.';
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
      if (budget) {
        await api.updateBudget(budget.id, { limit: String(limit), expectedVersion: budget.version });
        onSaved(`Limit ${budget.categoryName} menjadi ${formatPeriod(budget.periodStart.slice(0, 7))} diperbarui.`);
      } else {
        await api.createBudget({ categoryId, period: selectedPeriod, limit: String(limit) });
        onSaved(`Anggaran ${category?.name ?? 'kategori'} untuk ${formatPeriod(selectedPeriod)} ditetapkan.`);
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
      title={isEdit ? 'Ubah limit' : 'Tetapkan anggaran'}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" form={formId} loading={busy} block>
            {isEdit ? 'Ubah limit' : 'Simpan anggaran'}
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

        {isEdit ? (
          <p className="text-sm text-muted">
            {budget.categoryName} · {formatPeriod(budget.periodStart.slice(0, 7))}
          </p>
        ) : (
          <Field label="Kategori pengeluaran" htmlFor={`${formId}-category`} required error={issues.categoryId}>
            <Select id={`${formId}-category`} value={categoryId} invalid={Boolean(issues.categoryId)} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Pilih kategori</option>
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Limit bulanan" htmlFor={`${formId}-limit`} required error={issues.limit}>
          <AmountInput id={`${formId}-limit`} label="Limit bulanan" value={limit} invalid={Boolean(issues.limit)} onValueChange={setLimit} />
        </Field>

        {isEdit ? null : (
          <Field label="Bulan anggaran" htmlFor={`${formId}-period`} required hint="Periode memakai bulan kalender di zona waktu ruang.">
            <Select id={`${formId}-period`} value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
              {periodOptions(12).map((option) => (
                <option key={option} value={option}>
                  {formatPeriod(option)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <ReviewList
          rows={[
            { label: 'Kategori', value: isEdit ? budget.categoryName : category?.name ?? 'Belum dipilih' },
            { label: 'Bulan', value: formatPeriod(isEdit ? budget.periodStart.slice(0, 7) : selectedPeriod) },
            { label: 'Limit', value: <Money value={limit} forceVisible />, strong: true },
          ]}
          note="Pengeluaran tetap boleh dicatat setelah limit terlampaui. Angka terpakai dihitung dari pengeluaran bersih setelah refund."
        />
      </form>
    </Sheet>
  );
}
