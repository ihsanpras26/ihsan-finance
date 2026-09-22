// routes/rencana/Rencana.tsx : Utang & Piutang, Goals, and Anggaran as three tabs (PRD §03).
import { useState } from 'react';
import { PageHeader, Tabs } from '../../components/ui.tsx';
import { DebtTab } from './parts/DebtTab.tsx';
import { GoalTab } from './parts/GoalTab.tsx';
import { BudgetTab } from './parts/BudgetTab.tsx';

type RencanaTab = 'utang' | 'goals' | 'anggaran';

const TABS: { id: RencanaTab; label: string }[] = [
  { id: 'utang', label: 'Utang & Piutang' },
  { id: 'goals', label: 'Goals' },
  { id: 'anggaran', label: 'Anggaran' },
];

export function RencanaPage() {
  const [tab, setTab] = useState<RencanaTab>('utang');

  return (
    <div className="flex flex-col">
      <PageHeader title="Rencana" subtitle="Utang dan piutang, tujuan dana, dan batas anggaran bulan ini." />
      <div className="mt-4">
        <Tabs label="Bagian rencana" tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="mt-5">
        {tab === 'utang' ? <DebtTab /> : null}
        {tab === 'goals' ? <GoalTab /> : null}
        {tab === 'anggaran' ? <BudgetTab /> : null}
      </div>
    </div>
  );
}
