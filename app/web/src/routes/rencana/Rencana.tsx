// routes/rencana/Rencana.tsx : Utang & Piutang, Goals, and Anggaran as three tabs (PRD §03).
// The tab strip is a segmented pill row inside its own card, so the switch between sections reads
// as one control sitting on the card canvas instead of a row of links floating above the content.
import { useState } from 'react';
import { Card, PageHeader, Tabs } from '../../components/ui.tsx';
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
      <Card as="div" className="mt-4 px-4 py-3 lg:px-5">
        <Tabs label="Bagian rencana" tabs={TABS} active={tab} onChange={setTab} />
      </Card>
      <div className="mt-3 lg:mt-4">
        {tab === 'utang' ? <DebtTab /> : null}
        {tab === 'goals' ? <GoalTab /> : null}
        {tab === 'anggaran' ? <BudgetTab /> : null}
      </div>
    </div>
  );
}
