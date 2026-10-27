import { errMsg, useCOverviewQuery, useCPayoutsQuery } from '../store/api';
import { fmtDateTime, naira } from '../lib/format';
import { Empty, ErrorState, Skeleton, Table, Td, Th } from '../components/ui';
import { PageHeader } from './ConsoleLayout';
import { Stat } from './widgets';

/** The host's view of money received from the platform. Same records the admin enters, so both sides always agree. */
export default function MyPayouts() {
  const p = useCPayoutsQuery();
  const o = useCOverviewQuery();
  if (p.error) return <ErrorState message={errMsg(p.error)} onRetry={p.refetch} />;
  if (!p.data || !o.data) return <Skeleton className="h-80" />;
  const f = o.data.finance;
  return (
    <div className="space-y-8">
      <PageHeader title="Payouts" sub="Every transfer the platform has made to you, and what is still to come." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Your share earned" value={naira(f.hostShare)} sub={`${100 - o.data.platformPercent}% of net revenue`} />
        <Stat label="Paid to you" value={naira(f.paidOut)} tone="ok" />
        <Stat label="Still to be paid" value={naira(f.outstanding)} tone="gold" />
      </div>
      {p.data.payouts.length === 0 ? <Empty title="No payouts yet">When the platform sends you money, it is listed here with the reference.</Empty> : (
        <Table>
          <thead><tr><Th>Date</Th><Th right>Amount</Th><Th>Method</Th><Th>Reference</Th><Th>Note</Th></tr></thead>
          <tbody>{p.data.payouts.map((x) => <tr key={x._id}><Td className="whitespace-nowrap">{fmtDateTime(x.paidOn)}</Td><Td right className="font-semibold text-ok">{naira(x.amount)}</Td><Td>{x.method}</Td><Td className="font-mono text-xs">{x.reference || '—'}</Td><Td className="text-xs text-muted">{x.note || '—'}</Td></tr>)}</tbody>
        </Table>
      )}
    </div>
  );
}
