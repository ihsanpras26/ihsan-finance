// parts/WorkBanner.tsx : kartu paling atas Beranda, dan hanya dirender bila ada yang menunggu.
// Patokan YNAB: pekerjaan yang menunggu diletakkan sebelum angka apa pun, dengan satu tombol tindakan.
import { Button, Card, IconTile } from '../../../components/ui.tsx';
import { IconAlert } from '../../../components/icons.tsx';

export interface WorkCounts {
  drafts: number;
  occurrences: number;
  budgetsOver: number;
  budgetsNear: number;
}

/** "a, b, dan c": daftar sebab tetap terbaca sebagai satu kalimat. */
function joinCauses(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} dan ${parts[parts.length - 1]}`;
}

/** Setiap sebab menyebut jumlahnya sendiri, jadi kalimatnya tidak pernah berbunyi umum. */
function causeSentence(counts: WorkCounts): string {
  const parts: string[] = [];
  if (counts.drafts > 0) parts.push(counts.drafts === 1 ? '1 draf belum terkirim' : `${counts.drafts} draf belum terkirim`);
  if (counts.occurrences > 0) parts.push(`${counts.occurrences} transaksi berulang menunggu konfirmasi`);
  if (counts.budgetsOver > 0) parts.push(`${counts.budgetsOver} anggaran lewat batas`);
  if (counts.budgetsNear > 0) parts.push(`${counts.budgetsNear} anggaran mendekati batas`);
  return `${joinCauses(parts)}.`;
}

export function WorkBanner({
  counts, onWriteDraft, onReviewBudget, onConfirmRecurring,
}: {
  counts: WorkCounts;
  onWriteDraft: () => void;
  onReviewBudget: () => void;
  onConfirmRecurring: () => void;
}) {
  const waiting = counts.drafts + counts.occurrences + counts.budgetsOver + counts.budgetsNear;
  if (waiting === 0) return null;

  // Satu tombol saja: menulis transaksi lebih dulu daripada meninjau anggaran.
  const serving = counts.drafts > 0 ? 'draft' : counts.occurrences > 0 ? 'occurrence' : 'budget';
  return (
    <Card as="div" className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 lg:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconTile tone="warn">
          <IconAlert />
        </IconTile>
        <p className="min-w-0 flex-1 text-sm font-medium text-fg">{causeSentence(counts)}</p>
      </div>
      <div className="shrink-0 sm:self-center">
        {serving === 'budget' ? (
          <Button variant="secondary" size="sm" onClick={onReviewBudget}>
            Tinjau anggaran
          </Button>
        ) : serving === 'occurrence' ? (
          <Button variant="secondary" size="sm" onClick={onConfirmRecurring}>
            Konfirmasi transaksi berulang
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onWriteDraft}>
            Tulis draf yang belum terkirim
          </Button>
        )}
      </div>
    </Card>
  );
}
