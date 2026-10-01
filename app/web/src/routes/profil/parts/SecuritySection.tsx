// routes/profil/parts/SecuritySection.tsx : sesi yang sedang dipakai, mengakhiri sesi perangkat lain,
// dan keluar dari perangkat ini (PRD FR01, NFR04).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api.ts';
import { useSession } from '../../../lib/session.tsx';
import { countDrafts } from '../../../lib/offline.ts';
import { Button, Card, CardHead, ConfirmDialog, useToast } from '../../../components/ui.tsx';
import { deviceLabel, errorMessage } from '../../../components/forms/support.tsx';
import { ActionRow, InfoRow } from './Row.tsx';

export function SecuritySection() {
  const { user, signOut } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [confirmingOut, setConfirmingOut] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const drafts = user ? countDrafts(user.workspaceId) : 0;

  async function revokeOthers() {
    setRevoking(true);
    try {
      const result = await api.revokeOthers();
      const message = result.revoked > 0
        ? `${result.revoked} sesi lain diakhiri. Sesi di perangkat ini tetap aktif.`
        : 'Tidak ada sesi lain yang aktif. Sesi di perangkat ini tetap aktif.';
      setNote(message);
      setConfirmingRevoke(false);
      push('success', message);
    } catch (caught) {
      push('error', `Sesi lain gagal diakhiri. ${errorMessage(caught)}`);
    } finally {
      setRevoking(false);
    }
  }

  async function leave() {
    setSigningOut(true);
    try {
      await signOut();
      setConfirmingOut(false);
      void navigate('/');
    } finally {
      setSigningOut(false);
    }
  }

  if (!user) return null;

  return (
    <section className="mt-4">
      <Card className="px-4 pb-2">
        <div className="pt-4">
          <CardHead title="Keamanan" subtitle="Sesi yang dipakai dan cara keluar dari perangkat ini." />
        </div>

        <div className="mt-1">
          <InfoRow label="Akun" value={user.email} />
          <InfoRow label="Ruang keuangan" value={user.workspaceName} />
          <InfoRow label="Zona waktu" value={user.timezone} />
          <InfoRow
            label="Kata sandi"
            value="Diganti lewat pemulihan akses di layar masuk"
            meta="Pemulihan memakai kode pemulihan yang Anda simpan sendiri; setelah itu kata sandi baru langsung berlaku."
          />
          <InfoRow
            label="Peramban di perangkat ini"
            value={<span className="text-xs text-muted">{deviceLabel()}</span>}
          />

          <ActionRow
            title="Akhiri sesi perangkat lain"
            hint="Semua sesi selain sesi ini berakhir dan perangkat itu harus masuk ulang. Sesi di perangkat ini tetap aktif."
            action={
              <Button variant="secondary" onClick={() => setConfirmingRevoke(true)}>
                Akhiri sesi perangkat lain
              </Button>
            }
          />
          <ActionRow
            title="Keluar dari perangkat ini"
            hint={
              drafts > 0
                ? `${drafts} draf di perangkat ini belum dikirim dan akan terhapus saat keluar.`
                : 'Anda perlu memasukkan kata sandi lagi untuk membuka catatan keuangan di perangkat ini.'
            }
            action={
              <Button variant="secondary" onClick={() => setConfirmingOut(true)}>
                Keluar
              </Button>
            }
          />
        </div>

        <p className="py-3 text-xs text-muted">
          Layar ini belum bisa menampilkan daftar sesi per perangkat, jadi yang tampil hanya sesi yang sedang dipakai sekarang. Sesi kedaluwarsa dalam 30 hari.
        </p>
        {note ? (
          <p className="pb-3 text-sm text-fg" role="status" aria-live="polite">
            {note}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmingRevoke}
        title="Akhiri sesi perangkat lain"
        body="Semua sesi selain sesi ini akan diakhiri. Perangkat lain harus masuk ulang untuk membuka aplikasi."
        confirmLabel="Akhiri sesi lain"
        tone="danger"
        busy={revoking}
        onConfirm={() => void revokeOthers()}
        onCancel={() => setConfirmingRevoke(false)}
      />

      <ConfirmDialog
        open={confirmingOut}
        title="Keluar"
        body={
          drafts > 0
            ? `Ada ${drafts} draf di perangkat ini yang belum dikirim. Keluar akan menghapus draf tersebut. Lanjutkan keluar?`
            : 'Keluar dari aplikasi di perangkat ini? Anda perlu masuk lagi untuk membuka catatan keuangan.'
        }
        confirmLabel="Keluar"
        tone="danger"
        busy={signingOut}
        onConfirm={() => void leave()}
        onCancel={() => setConfirmingOut(false)}
      />
    </section>
  );
}
