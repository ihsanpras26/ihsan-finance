// routes/profil/parts/PreferenceSection.tsx : timezone, hidden amounts, reminders, theme (PRD §03, FR11).
// Theme changes apply immediately and are also stored on the server so the next device matches.
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { useSession } from '../../../lib/session.tsx';
import { Button, ErrorState, Field, LoadingRows, SectionHead, Select, useToast } from '../../../components/ui.tsx';
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
    <section>
      <SectionHead title="Preferensi" />

      {workspace.loading && !workspace.data ? <LoadingRows rows={2} label="Memuat preferensi ruang" /> : null}
      {workspace.error ? <ErrorState message={workspace.error.display} onRetry={workspace.reload} /> : null}

      {workspace.data ? (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Field
                label="Zona waktu ruang"
                htmlFor="profil-zona"
                hint="Dipakai untuk batas periode laporan dan jadwal pengingat."
              >
                <Select id="profil-zona" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {zoneOptions.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button onClick={() => void saveTimezone()} loading={savingZone} disabled={!zoneChanged}>
              Simpan zona waktu
            </Button>
          </div>

          <div className="rounded-panel border border-hairline px-4">
            <SwitchRow
              label="Sembunyikan nominal"
              hint="Angka uang diganti titik di seluruh aplikasi. Cocok saat membuka aplikasi di tempat umum."
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
          </div>

          <div className="rounded-panel border border-hairline px-4 py-3">
            <RadioGroup
              legend="Tema tampilan"
              value={theme}
              onChange={(next) => void chooseTheme(next)}
              options={[
                { value: 'light', label: 'Terang', hint: 'Kertas buku kas, latar terang.' },
                { value: 'dark', label: 'Gelap', hint: 'Papan tulis malam untuk ruangan gelap.' },
                { value: 'system', label: 'Ikuti sistem', hint: 'Mengikuti pengaturan perangkat.' },
              ]}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
