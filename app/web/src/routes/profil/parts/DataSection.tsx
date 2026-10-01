// routes/profil/parts/DataSection.tsx : ekspor CSV, cadangan penuh, dan masa simpan (PRD FR19, NFR07).
import { useState } from 'react';
import { api } from '../../../lib/api.ts';
import { Button, Card, CardHead, useToast } from '../../../components/ui.tsx';
import { errorMessage } from '../../../components/forms/support.tsx';
import { currentPeriod, formatDateLong, todayIso } from '../../../lib/format.ts';
import { ActionRow } from './Row.tsx';

export function DataSection() {
  const { push } = useToast();
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);

  const period = currentPeriod();
  const from = `${period}-01`;
  const to = todayIso();

  async function downloadCsv() {
    setExportingCsv(true);
    try {
      const job = await api.exportCsv({ from, to });
      triggerDownload(job.url, `ihsan-transaksi-${from}-${to}.csv`);
      push('success', `Unduhan CSV disiapkan: ${job.rows} baris untuk rentang ${formatDateLong(from)} sampai ${formatDateLong(to)}.`);
    } catch (caught) {
      push('error', `Ekspor CSV gagal. ${errorMessage(caught)}`);
    } finally {
      setExportingCsv(false);
    }
  }

  async function downloadFull() {
    setExportingFull(true);
    try {
      const job = await api.exportFull();
      triggerDownload(job.url, `ihsan-cadangan-${to}.json`);
      push('success', `Cadangan penuh disiapkan: ${formatBytes(job.bytes)}.`);
    } catch (caught) {
      push('error', `Ekspor penuh gagal. ${errorMessage(caught)}`);
    } finally {
      setExportingFull(false);
    }
  }

  return (
    <section className="mt-4">
      <Card className="px-4 pb-2">
        <div className="pt-4">
          <CardHead title="Data" subtitle="Unduhan catatan keuangan dan masa simpannya." />
        </div>

        <div className="mt-1">
          <ActionRow
            title="Ekspor CSV bulan ini"
            hint={`Berisi ID transaksi, tanggal, jenis, dompet, kategori, nominal, status, serta referensi utang atau tujuan. Rentang ${formatDateLong(from)} sampai ${formatDateLong(to)}; untuk rentang lain pakai pemilih rentang di layar Laporan.`}
            action={
              <Button variant="secondary" onClick={() => void downloadCsv()} loading={exportingCsv}>
                Unduh CSV
              </Button>
            }
          />
          <ActionRow
            title="Cadangan penuh"
            hint="Seluruh catatan keuangan dalam satu berkas JSON, untuk disimpan sendiri atau dipindahkan keluar dari aplikasi."
            action={
              <Button variant="secondary" onClick={() => void downloadFull()} loading={exportingFull}>
                Unduh cadangan penuh
              </Button>
            }
          />

          <div className="py-3">
            <h3 className="text-sm font-semibold text-fg">Masa simpan data</h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              <li className="text-sm text-muted">Tautan unduhan berlaku maksimal 24 jam, lalu kedaluwarsa.</li>
              <li className="text-sm text-muted">Permintaan penghapusan data aktif diproses maksimal 7 hari.</li>
              <li className="text-sm text-muted">Salinan cadangan terhapus dalam 30 hari setelah penghapusan.</li>
              <li className="text-sm text-muted">Pemulihan dari cadangan belum tersedia lewat aplikasi. Prosedurnya masih dijalankan manual oleh pengelola.</li>
            </ul>
          </div>
        </div>
      </Card>
    </section>
  );
}

function triggerDownload(url: string, filename: string) {
  const target = new URL(url, window.location.origin).toString();
  const link = document.createElement('a');
  link.href = target;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
