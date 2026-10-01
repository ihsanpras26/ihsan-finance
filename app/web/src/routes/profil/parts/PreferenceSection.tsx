// routes/profil/parts/PreferenceSection.tsx : tema, nominal tersembunyi, pengingat, dan zona waktu
// (PRD §03, FR11). Tema langsung berlaku di perangkat ini dan disimpan ke server agar perangkat
// berikutnya mengikuti.
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { useSession } from '../../../lib/session.tsx';
import { Button, Card, CardHead, ErrorState, Field, LoadingRows, Select, useToast } from '../../../components/ui.tsx';
import { RadioGroup, SwitchRow, errorMessage } from '../../../components/forms/support.tsx';

const ZONES: { value: string; label: string }[] = [
  { value: 'Asia/Jakarta', label: 'WIB, Asia/Jakarta' },
  { value: 'Asia/Pontianak', label: 'WIB, Asia/Pontianak' },
  { value: 'Asia/Makassar', label: 'WITA, Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT, Asia/Jayapura' },
  { value: 'Asia/Singapore', label: 'SGT, Asia/Singapore' },
  { value: 'UTC', label: 'UTC' },
];

export function PreferenceSection() {
  const { push } = useToast();
  const { theme, setTheme, hideAmounts, setHideAmounts, preferences, updatePreferences } = useSession();
  const workspace = useAsync(() => api.workspace(), []);
  const [timezone, setTimezone] = useState('');
  const [savingZone, setSavingZone] = useState(false);

  useEffect(() => {
    if (workspace.data) setTimezone(workspace.data.timezone);
  }, [workspace.data]);

  const zoneOptions = workspace.data && !ZONES.some((zone) => zone.value === workspace.data?.timezone)
    ? [{ value: workspace.data.timezone, label: workspace.data.timezone }, ...ZONES]
    : ZONES;
  const zoneChanged = workspace.data ? timezone !== workspace.data.timezone : false;

  async function saveTimezone() {
    setSavingZone(true);
    try {
      await api.updateWorkspace({ timezone });
      push('success', `Zona waktu ruang diubah ke ${timezone}. Laporan dan pengingat mengikuti zona ini.`);
      workspace.reload();
    } catch (caught) {
      push('error', `Zona waktu gagal disimpan. ${errorMessage(caught)}`);
    } finally {
      setSavingZone(false);
    }
  }

  async function toggleReminders(next: boolean) {
    try {
      await updatePreferences({ remindersOn: next });
      push('success', next ? 'Pengingat jatuh tempo dinyalakan.' : 'Pengingat jatuh tempo dimatikan.');
    } catch (caught) {
      push('error', `Preferensi gagal disimpan. ${errorMessage(caught)}`);
    }
  }

  async function chooseTheme(next: 'system' | 'light' | 'dark') {
    setTheme(next);
    try {
      await updatePreferences({ theme: next });
    } catch {
      push('error', 'Tema berubah di perangkat ini, tetapi gagal disimpan di server. Coba lagi saat koneksi membaik.');
    }
  }

  return (
    <section className="mt-4">
      {workspace.loading && !workspace.data ? <LoadingRows rows={2} label="Memuat preferensi ruang" /> : null}
      {workspace.error ? (
        <ErrorState message={`Preferensi gagal dimuat. ${workspace.error.display}`} onRetry={workspace.reload} />
      ) : null}

      {workspace.data ? (
        <Card className="px-4 pb-2">
          <div className="pt-4">
            <CardHead title="Preferensi" subtitle="Tema, nominal, pengingat, dan zona waktu." />
          </div>

          <div className="mt-1">
            <div className="row-divide py-3">
              <RadioGroup
                legend="Tema tampilan"
                value={theme}
                onChange={(next) => void chooseTheme(next)}
                options={[
                  { value: 'light', label: 'Terang', hint: 'Semua layar memakai latar terang, termasuk saat perangkat disetel gelap.' },
                  { value: 'dark', label: 'Gelap', hint: 'Semua layar memakai latar gelap, termasuk saat perangkat disetel terang.' },
                  { value: 'system', label: 'Ikuti sistem', hint: 'Tema mengikuti setelan perangkat dan berganti sendiri saat perangkat berganti setelan.' },
                ]}
              />
            </div>

            <SwitchRow
              label="Sembunyikan nominal"
              hint="Setiap nominal diganti titik di seluruh layar aplikasi, termasuk laporan. Angka aslinya tidak berubah."
              checked={hideAmounts}
              onChange={(next) => {
                void setHideAmounts(next);
                push('success', next ? 'Nominal disembunyikan.' : 'Nominal ditampilkan kembali.');
              }}
            />
            <SwitchRow
              label="Pengingat jatuh tempo"
              hint="Pengingat muncul pada H−7, H−1, dan hari jatuh tempo untuk utang dan piutang yang belum lunas."
              checked={preferences.remindersOn}
              onChange={(next) => void toggleReminders(next)}
            />

            <div className="py-3">
              <Field
                label="Zona waktu ruang"
                htmlFor="profil-zona"
                hint="Menentukan batas awal dan akhir periode laporan, jam transaksi, dan jadwal pengingat."
              >
                <Select id="profil-zona" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {zoneOptions.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button onClick={() => void saveTimezone()} loading={savingZone} disabled={!zoneChanged}>
                  Simpan zona waktu
                </Button>
                <span className="text-xs text-muted" role="status" aria-live="polite">
                  {zoneChanged ? 'Belum disimpan.' : `Tersimpan: ${workspace.data.timezone}`}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
