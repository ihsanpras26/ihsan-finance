// routes/profil/Profil.tsx : wallets, categories, preferences, security, data, and sign out (PRD §03).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/session.tsx';
import { countDrafts } from '../../lib/offline.ts';
import { Button, ConfirmDialog, LoadingRows, PageHeader, SectionHead } from '../../components/ui.tsx';
import { WalletSection } from './parts/WalletSection.tsx';
import { CategorySection } from './parts/CategorySection.tsx';
import { PreferenceSection } from './parts/PreferenceSection.tsx';
import { SecuritySection } from './parts/SecuritySection.tsx';
import { DataSection } from './parts/DataSection.tsx';

export function ProfilPage() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [confirmingOut, setConfirmingOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const drafts = user ? countDrafts(user.workspaceId) : 0;

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

  if (!user) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Profil" subtitle="Dompet, kategori, preferensi, keamanan, dan pengelolaan data." />
        <div className="mt-6">
          <LoadingRows rows={3} label="Memuat profil" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Profil" subtitle={`${user.displayName} · ${user.workspaceName}`} />

      <WalletSection />
      <CategorySection />
      <PreferenceSection />
      <SecuritySection />
      <DataSection />

      <section>
        <SectionHead title="Keluar" />
        <p className="mt-1 text-sm text-muted">
          {drafts > 0
            ? `Ada ${drafts} draf di perangkat ini yang belum dikirim. Keluar akan menghapus draf tersebut.`
            : 'Keluar dari aplikasi di perangkat ini. Draf yang belum dikirim tidak akan tersimpan.'}
        </p>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setConfirmingOut(true)}>
            Keluar
          </Button>
        </div>
      </section>

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
    </div>
  );
}
