// routes/rencana/Rencana.tsx : Anggaran, utang dan piutang, serta tujuan sebagai tiga tab (PRD §03).
// Hanya tab yang sedang terbuka yang dirender, jadi tab yang belum dibuka tidak memanggil
// endpoint-nya sendiri dan berpindah tab tidak memuat ulang tab lain.
import { useState } from 'react';
import { Card, PageHeader, TabPanel, Tabs } from '../../components/ui.tsx';
import { BudgetTab } from './parts/BudgetTab.tsx';
import { DebtTab } from './parts/DebtTab.tsx';
import { GoalTab } from './parts/GoalTab.tsx';

type RencanaTab = 'anggaran' | 'utang' | 'tujuan';

const TABS: { id: RencanaTab; label: string }[] = [
  { id: 'anggaran', label: 'Anggaran' },
  { id: 'utang', label: 'Utang' },
  { id: 'tujuan', label: 'Tujuan' },
];

export function RencanaPage() {
  const [tab, setTab] = useState<RencanaTab>('anggaran');

  return (
    <div className="flex flex-col">
      <PageHeader title="Rencana" subtitle="Batas anggaran bulan ini, utang dan piutang, dan tujuan dana." />
      <Card as="div" className="mt-4 px-4 py-3 lg:px-5">
        <Tabs label="Bagian rencana" tabs={TABS} active={tab} onChange={setTab} idBase="rencana" />
      </Card>
      <TabPanel idBase="rencana" id={tab} className="mt-3 lg:mt-4">
        {tab === 'anggaran' ? <BudgetTab /> : null}
        {tab === 'utang' ? <DebtTab /> : null}
        {tab === 'tujuan' ? <GoalTab /> : null}
      </TabPanel>
    </div>
  );
}
