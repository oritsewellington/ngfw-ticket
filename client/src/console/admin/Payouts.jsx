import { useState } from 'react';
import { toast } from 'sonner';
import { HandCoins } from 'lucide-react';
import { errMsg, useAPayoutsQuery, useRecordPayoutMutation } from '../../store/api';
import { act } from '../../lib/act';
import { fmtDateTime, naira } from '../../lib/format';
import { Button, Card, Empty, ErrorState, Field, Input, Skeleton, Table, Td, Th, useBusy } from '../../components/ui';
import { PageHeader } from '../ConsoleLayout';
import { Stat } from '../widgets';

export default function Payouts() {
  const { data, error, refetch } = useAPayoutsQuery();
  const [record] = useRecordPayoutMutation();
  const [busy, run] = useBusy();
  const [f, setF] = useState({ amount: '', method: 'Bank transfer', reference: '', note: '', paidOn: '' });

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-96" />;

  const submit = (e) => {
    e.preventDefault();
    const amt = Number(f.amount);
    if (!(amt >= 1)) return toast.error('Please enter the amount you paid the host.');
    if (amt * 100 > data.outstanding) return toast.error(`That's more than the host is owed (${naira(data.outstanding)}).`);
    return run(async () => {
      const r = await act(record({ ...f, amount: amt, paidOn: f.paidOn || undefined }), `Payout of ${naira(amt * 100)} recorded.`);
      if (r) setF({ amount: '', method: 'Bank transfer', reference: '', note: '', paidOn: '' });
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Host payouts" sub="Record every transfer you make to the host. The host sees these on their own dashboard, so both sides always agree on what's owed." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Host share earned" value={naira(data.owed)} sub="From confirmed payments" />
        <Stat label="Paid to host" value={naira(data.paidOut)} tone="ok" />
        <Stat label="Still owed" value={naira(data.outstanding)} tone="gold" />
      </div>
      <Card className="p-6">
        <h2 className="mb-5 font-display text-2xl">Record a payout</h2>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Amount (₦)" required><Input type="number" min="1" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Method"><Input value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} /></Field>
          <Field label="Transfer reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Bank / OPay ref" /></Field>
          <Field label="Date paid"><Input type="date" value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></Field>
          <Field label="Note" className="sm:col-span-2 lg:col-span-4"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" /></Field>
          <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" loading={busy} icon={HandCoins}>Record payout</Button></div>
        </form>
      </Card>
      {data.payouts.length === 0 ? <Empty title="No payouts recorded yet" /> : (
        <Table>
          <thead><tr><Th>Date</Th><Th right>Amount</Th><Th>Method</Th><Th>Reference</Th><Th>Note</Th><Th>Recorded by</Th></tr></thead>
          <tbody>{data.payouts.map((p) => <tr key={p._id}><Td className="whitespace-nowrap">{fmtDateTime(p.paidOn)}</Td><Td right className="font-semibold text-ok">{naira(p.amount)}</Td><Td>{p.method}</Td><Td className="font-mono text-xs">{p.reference || '—'}</Td><Td className="text-xs text-muted">{p.note || '—'}</Td><Td>{p.recordedBy}</Td></tr>)}</tbody>
        </Table>
      )}
    </div>
  );
}
