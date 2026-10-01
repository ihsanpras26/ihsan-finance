// routes/laporan/parts/RangePicker.tsx : month, year, or an exact date range (PRD FR18).
// v2 shape: satu kartu berisi pil jenis rentang dan isian yang mengikuti pilihannya. Dua isian
// tanggal menumpuk satu kolom di HP dan berdampingan mulai sm, jadi tidak ada yang terpotong.
import { Card, CardHead, Field, Select, TabPanel, Tabs, TextInput } from '../../../components/ui.tsx';
import { formatPeriod, periodOptions } from '../../../lib/format.ts';
import { yearOptions, type RangeDraft, type RangeMode } from './calc.ts';

const MODES: { id: RangeMode; label: string }[] = [
  { id: 'bulan', label: 'Bulan' },
  { id: 'tahun', label: 'Tahun' },
  { id: 'khusus', label: 'Tanggal khusus' },
];

export function RangePicker({ draft, onChange }: { draft: RangeDraft; onChange: (next: RangeDraft) => void }) {
  return (
    <Card className="px-4 py-4">
      <CardHead title="Rentang laporan" subtitle="Pilih bulan, tahun, atau rentang tanggal yang persis." />

      <div className="mt-4">
        <Tabs
          idBase="laporan-rentang"
          label="Jenis rentang laporan"
          tabs={MODES}
          active={draft.mode}
          onChange={(mode) => onChange({ ...draft, mode })}
        />
      </div>

      {/* Satu panel untuk tab yang aktif saja, sehingga isian jenis rentang lain tidak pernah dipasang. */}
      <TabPanel idBase="laporan-rentang" id={draft.mode} className="mt-4">
        {draft.mode === 'bulan' ? (
          <div className="sm:max-w-xs">
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
          <div className="sm:max-w-xs">
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
          <div className="grid grid-cols-1 gap-4 sm:max-w-lg sm:grid-cols-2">
            <Field label="Dari tanggal" htmlFor="laporan-dari" required>
              <TextInput id="laporan-dari" type="date" value={draft.from} onChange={(event) => onChange({ ...draft, from: event.target.value })} />
            </Field>
            <Field label="Sampai tanggal" htmlFor="laporan-sampai" required>
              <TextInput id="laporan-sampai" type="date" value={draft.to} onChange={(event) => onChange({ ...draft, to: event.target.value })} />
            </Field>
          </div>
        ) : null}
      </TabPanel>
    </Card>
  );
}
