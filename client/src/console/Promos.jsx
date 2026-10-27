import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { errMsg, useCreatePromoMutation, useDeletePromoMutation, usePromosQuery, useTogglePromoMutation } from '../store/api';
import { act } from '../lib/act';
import { fmtMedDate, naira } from '../lib/format';
import { Badge, Button, Card, Empty, ErrorState, Field, Input, Select, Skeleton, Switch, Table, Td, Th, useBusy } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

export default function Promos() {
  const { data, error, refetch } = usePromosQuery();
  const [create] = useCreatePromoMutation();
  const [toggle] = useTogglePromoMutation();
  const [del] = useDeletePromoMutation();
  const [busy, run] = useBusy();
  const [f, setF] = useState({ code: '', type: 'percent', value: '', maxUses: '', expiresAt: '' });

  const submit = (e) => {
    e.preventDefault();
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(f.code.trim())) return toast.error('Promo codes must be 3 to 20 letters or numbers.');
    if (!(Number(f.value) > 0)) return toast.error('Please enter the discount amount.');
    if (f.type === 'percent' && Number(f.value) > 100) return toast.error("A percentage discount can't be more than 100%.");
    return run(async () => {
      const r = await act(create({ ...f, code: f.code.trim(), value: Number(f.value), maxUses: Number(f.maxUses) || 0, expiresAt: f.expiresAt || undefined }), `Promo code ${f.code.toUpperCase()} created.`);
      if (r) setF({ code: '', type: 'percent', value: '', maxUses: '', expiresAt: '' });
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Promo codes" sub="Discount codes buyers can enter at checkout. Discounted tickets still pay Paystack fees normally." />
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Code" className="lg:col-span-2"><Input className="uppercase" placeholder="EARLYBIRD" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percent off</option><option value="fixed">Naira off</option></Select></Field>
          <Field label={f.type === 'percent' ? 'Percent' : 'Amount (₦)'}><Input type="number" min="1" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Max uses" hint="0 = unlimited"><Input type="number" min="0" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></Field>
          <Field label="Expires"><Input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
          <div className="sm:col-span-2 lg:col-span-6"><Button type="submit" loading={busy} icon={Plus}>Create promo code</Button></div>
        </form>
      </Card>

      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-48" /> : data.promos.length === 0 ? <Empty title="No promo codes yet" /> : (
        <Table>
          <thead><tr><Th>Code</Th><Th>Discount</Th><Th right>Used</Th><Th>Expires</Th><Th>Active</Th><Th right>{''}</Th></tr></thead>
          <tbody>
            {data.promos.map((p) => (
              <tr key={p._id}>
                <Td className="font-mono font-semibold text-gold">{p.code}</Td>
                <Td>{p.type === 'percent' ? `${p.value}% off` : `${naira(p.value)} off`}</Td>
                <Td right>{p.used}{p.maxUses ? ` / ${p.maxUses}` : ''}</Td>
                <Td>{p.expiresAt ? fmtMedDate(p.expiresAt) : <Badge>NEVER</Badge>}</Td>
                <Td><Switch checked={p.active} onChange={(v) => act(toggle({ id: p._id, active: v }), v ? `${p.code} is active.` : `${p.code} is paused.`)} label={`Toggle ${p.code}`} /></Td>
                <Td right><Button variant="ghost" size="sm" icon={Trash2} onClick={() => act(del(p._id), `${p.code} deleted.`)}>Delete</Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
