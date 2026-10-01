// parts/RecurringSheet.tsx : konfirmasi kejadian rencana berulang (PRD FR17).
// PRD: rencana P0 memberi pengingat dan nilai yang sudah terisi, dan transaksinya dibukukan
// setelah pengguna menekan Konfirmasi. Melewati satu kejadian tidak menghapus rencananya.
import { useState } from 'react';
import { DataError } from '../../../components/layout/DataError.tsx';
import { useShell } from '../../../components/layout/AppShell.tsx';
import { Button, EmptyState, IconTile, LoadingRows, RowTitle, Sheet, useToast } from '../../../components/ui.tsx';
import { IconRepeat } from '../../../components/icons.tsx';
import { api, ApiError, type Occurrence } from '../../../lib/api.ts';
import { directionOf, formatDateShort, formatSigned } from '../../../lib/format.ts';
import { useAsync } from '../../../lib/hooks.ts';

export function RecurringSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifyDataChanged } = useShell();
  const { push } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Dimuat ulang setiap lembar dibuka: daftar tunggu bisa berubah karena penjadwal di server.
  const state = useAsync(() => api.occurrences({ status: 'pending' }), [open], { enabled: open });
  const pending = state.data ?? [];

  async function decide(occurrence: Occurrence, action: 'confirm' | 'skip') {
    setBusyId(occurrence.id);
    try {
      if (action === 'confirm') {
        const result = await api.confirmOccurrence(occurrence.id);
        push(
          'success',
          `Transaksi berulang tercatat: ${formatSigned(result.transaction.amount, directionOf(result.transaction.type))} pada ${formatDateShort(result.transaction.effectiveDate)}.`,
        );
      } else {
        await api.skipOccurrence(occurrence.id);
        push('info', `Kejadian ${formatDateShort(occurrence.scheduledDate)} dilewati. Rencananya tetap berjalan.`);
      }
      notifyDataChanged();
      state.reload();
    } catch (caught) {
      push('error', caught instanceof ApiError ? caught.display : 'Kejadian ini gagal diproses. Coba lagi.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Transaksi berulang menunggu">
      {state.loading && !state.data ? (
        <LoadingRows rows={2} label="Memuat kejadian berulang" />
      ) : state.error && !state.data ? (
        <DataError error={state.error} onRetry={state.reload} />
      ) : pending.length === 0 ? (
        <EmptyState
          title="Tidak ada yang menunggu"
          body="Semua kejadian rencana sudah dicatat atau dilewati. Rencana berikutnya muncul pada tanggal jadwalnya."
          action={
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col">
          {pending.map((occurrence) => (
            <li key={occurrence.id} className="row-divide flex flex-col gap-3 py-3">
              {/* Nominal di baris judul, meta dapat lebar penuh: 390 px tidak cukup untuk tiga
                  kolom (ikon, dua baris teks, nominal) tanpa memotong meta. */}
              <div className="flex items-center gap-3">
                <IconTile tone="accent-2">
                  <IconRepeat />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <RowTitle
                    title={occurrence.label}
                    meta={`Jadwal ${formatDateShort(occurrence.scheduledDate)}`}
                  />
                </div>
                <span className="figure shrink-0 text-sm font-medium text-fg">
                  {formatSigned(occurrence.amount, directionOf(occurrence.ruleType))}
                </span>
              </div>
              {/* Aksi baris ini duduk di tepi konten lembar, bukan menjorok di bawah kolom teks:
                  aksi utama memakai tinggi 52px seperti janji DESIGN.md pada komponen Button. */}
              <div className="flex gap-2">
                <Button size="lg" loading={busyId === occurrence.id} onClick={() => decide(occurrence, 'confirm')}>
                  Konfirmasi
                </Button>
                <Button variant="ghost" size="lg" disabled={busyId !== null} onClick={() => decide(occurrence, 'skip')}>
                  Lewati
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
