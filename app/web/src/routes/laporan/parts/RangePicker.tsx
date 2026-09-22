// routes/laporan/parts/RangePicker.tsx : month, year, or an exact date range (PRD FR18).
import { Field, Select, Tabs, TextInput } from '../../../components/ui.tsx';
import { formatPeriod, periodOptions } from '../../../lib/format.ts';
import { yearOptions, type RangeDraft, type RangeMode } from './calc.ts';

const MODES: { id: RangeMode; label: string }[] = [
  { id: 'bulan', label: 'Bulan' },
  { id: 'tahun', label: 'Tahun' },
  { id: 'khusus', label: 'Tanggal khusus' },
];

export function RangePicker({ draft, onChange }: { draft: RangeDraft; onChange: (next: RangeDraft) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Tabs label="Jenis rentang laporan" tabs={MODES} active={draft.mode} onChange={(mode) => onChange({ ...draft, mode })} />

      {draft.mode === 'bulan' ? (
        <div className="max-w-[220px]">
          <Field label="Bulan laporan" htmlFor="laporan-bulan" required>
            <Select id="laporan-bulan" value={draft.period} onChange={(event) => onChange({ ...draft, period: event.target.value })}>
              {periodOptions(18).map((option) => (
                <option key={option} value={option}>
                  {formatPeriod(option)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {draft.mode === 'tahun' ? (
        <div className="max-w-[220px]">
          <Field label="Tahun laporan" htmlFor="laporan-tahun" required>
            <Select id="laporan-tahun" value={draft.year} onChange={(event) => onChange({ ...draft, year: event.target.value })}>
              {yearOptions().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {draft.mode === 'khusus' ? (
        <div className="grid gap-4 sm:max-w-[460px] sm:grid-cols-2">
          <Field label="Dari tanggal" htmlFor="laporan-dari" required>
            <TextInput id="laporan-dari" type="date" value={draft.from} onChange={(event) => onChange({ ...draft, from: event.target.value })} />
          </Field>
          <Field label="Sampai tanggal" htmlFor="laporan-sampai" required>
            <TextInput id="laporan-sampai" type="date" value={draft.to} onChange={(event) => onChange({ ...draft, to: event.target.value })} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
