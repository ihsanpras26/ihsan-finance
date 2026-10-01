// routes/profil/Profil.tsx : dompet, kategori, preferensi, keamanan, dan data (PRD §03).
// Lima bagian tetap dengan urutan ini; keluar dari perangkat ada di bagian Keamanan.
import { useSession } from '../../lib/session.tsx';
import { Avatar, Card, LoadingRows, PageHeader } from '../../components/ui.tsx';
import { WalletSection } from './parts/WalletSection.tsx';
import { CategorySection } from './parts/CategorySection.tsx';
import { PreferenceSection } from './parts/PreferenceSection.tsx';
import { SecuritySection } from './parts/SecuritySection.tsx';
import { DataSection } from './parts/DataSection.tsx';

export function ProfilPage() {
  const { user } = useSession();

  if (!user) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Profil" subtitle="Dompet, kategori, preferensi, keamanan, dan data." />
        <div className="mt-3">
          <LoadingRows rows={3} label="Memuat profil" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Profil" subtitle="Dompet, kategori, preferensi, keamanan, dan data." />

      {/* Kartu identitas: siapa yang sedang masuk dan di ruang keuangan mana. */}
      <Card className="mt-3 flex items-center gap-3 px-4 py-4">
        <Avatar name={user.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-fg">{user.displayName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <p className="truncate text-xs text-muted">
            {user.workspaceName} · {user.timezone}
          </p>
        </div>
      </Card>

      <WalletSection />
      <CategorySection />
      <PreferenceSection />
      <SecuritySection />
      <DataSection />
    </div>
  );
}
