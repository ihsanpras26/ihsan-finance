// routes/profil/parts/SecuritySection.tsx : the session in use and revoking the others (PRD FR01, NFR04).
import { useState } from 'react';
import { api } from '../../../lib/api.ts';
import { useSession } from '../../../lib/session.tsx';
import { Button, Card, ConfirmDialog, SectionHead, useToast } from '../../../components/ui.tsx';
import { deviceLabel, errorMessage } from '../../../components/forms/support.tsx';

export function SecuritySection() {
  const { user } = useSession();
  const { push } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function revokeOthers() {
    setBusy(true);
    try {
      const result = await api.revokeOthers();
      const message = result.revoked > 0
        ? `${result.revoked} sesi lain diakhiri. Sesi di perangkat ini tetap aktif.`
        : 'Tidak ada sesi lain yang aktif. Sesi di perangkat ini tetap aktif.';
      setNote(message);
      setConfirming(false);
      push('success', message);
    } catch (caught) {
      push('error', `Sesi lain gagal diakhiri. ${errorMessage(caught)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section>
      <SectionHead title="Keamanan" />

      <Card className="px-4 py-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Sesi ini</p>
        <div className="mt-2 flex flex-col">
          <div className="row-divide flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-sm text-muted">Akun</span>
            <span className="text-sm text-fg">{user.email}</span>
          </div>
          <div className="row-divide flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-sm text-muted">Ruang</span>
            <span className="text-sm text-fg">{user.workspaceName}</span>
          </div>
          <div className="row-divide flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-sm text-muted">Zona waktu</span>
            <span className="text-sm text-fg">{user.timezone}</span>
          </div>
          <div className="row-divide flex flex-col gap-1 py-2.5">
            <span className="text-sm text-muted">Peramban di perangkat ini</span>
            <span className="break-all text-xs text-muted">{deviceLabel()}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Layar ini belum bisa menampilkan daftar sesi per perangkat. Yang tampil hanya sesi yang sedang dipakai sekarang. Sesi kedaluwarsa dalam 30 hari dan sesi lain
          dapat diakhiri sekaligus dengan tombol di bawah.
        </p>
        {note ? <p className="mt-2 text-sm text-fg">{note}</p> : null}
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Akhiri sesi perangkat lain
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="Akhiri sesi perangkat lain"
        body="Semua sesi selain sesi ini akan diakhiri. Perangkat lain harus masuk ulang untuk membuka aplikasi."
        confirmLabel="Akhiri sesi lain"
        tone="danger"
        busy={busy}
        onConfirm={() => void revokeOthers()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
