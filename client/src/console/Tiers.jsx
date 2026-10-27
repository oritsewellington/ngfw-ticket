import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { errMsg, useCTiersQuery, useCreateTierMutation, useDeleteTierMutation, useUpdateTierMutation } from '../store/api';
import { act } from '../lib/act';
import { naira } from '../lib/format';
import { Badge, Button, Card, ErrorState, Field, Input, Modal, Skeleton, Switch, Textarea, useBusy } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

const empty = { name: '', price: '', capacity: '', color: '#e2b865', description: '', perks: '', active: true };

function TierForm({ tier, onClose }) {
  const [create] = useCreateTierMutation();
  const [update] = useUpdateTierMutation();
  const [busy, run] = useBusy();
  const [f, setF] = useState(tier ? { name: tier.name, price: tier.price / 100, capacity: tier.capacity, color: tier.color, description: tier.description || '', perks: (tier.perks || []).join('\n'), active: tier.active } : empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return toast.error('Please give this ticket a name.');
    if (!(Number(f.price) >= 100)) return toast.error('The price must be at least ₦100.');
    if (f.capacity === '' || Number(f.capacity) < 0) return toast.error('Please enter how many tickets are available.');
    return run(async () => {
      const payload = { ...f, price: Number(f.price), capacity: Number(f.capacity) };
      const res = tier
        ? await act(update({ id: tier.id, ...payload }), `${f.name} updated. Existing tickets are not affected.`)
        : await act(create(payload), `${f.name} tickets are now on sale.`);
      if (res) onClose();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticket name" required><Input value={f.name} onChange={set('name')} placeholder="e.g. Royalty" /></Field>
        <Field label="Colour" hint="Shown on the ticket and the website."><input type="color" value={f.color} onChange={set('color')} className="h-12 w-full cursor-pointer rounded-xl border border-line bg-ink-2 p-1" /></Field>
        <Field label="Price (₦)" required><Input type="number" inputMode="numeric" min="100" value={f.price} onChange={set('price')} placeholder="10000" /></Field>
        <Field label="Tickets available" required hint={tier ? `${tier.sold} already sold` : undefined}><Input type="number" inputMode="numeric" min="0" value={f.capacity} onChange={set('capacity')} placeholder="100" /></Field>
      </div>
      <Field label="Short description (optional)"><Input value={f.description} onChange={set('description')} placeholder="Best seats, meet-and-greet..." /></Field>
      <Field label="What's included (one per line)"><Textarea value={f.perks} onChange={set('perks')} placeholder={'Front row seating\nWelcome drink'} /></Field>
      <div className="flex items-center justify-between rounded-xl border border-line bg-ink-3 p-4">
        <div><p className="text-sm font-medium">Show on website</p><p className="text-xs text-muted">Hide to pause sales for this ticket.</p></div>
        <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Show on website" />
      </div>
      {tier && <p className="text-xs text-muted">Changing the price only affects future buyers. Tickets already sold keep the price they paid.</p>}
      <Button type="submit" loading={busy} icon={Save} className="w-full">{tier ? 'Save changes' : 'Add ticket type'}</Button>
    </form>
  );
}

export default function Tiers() {
  const { data, error, refetch } = useCTiersQuery();
  const [update] = useUpdateTierMutation();
  const [del] = useDeleteTierMutation();
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!data) return <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>;

  return (
    <div>
      <PageHeader title="Tickets & prices" sub="Change prices, availability and what each ticket includes. The website updates instantly.">
        <Button icon={Plus} onClick={() => setEditing('new')}>Add ticket type</Button>
      </PageHeader>
      <div className="grid gap-5 sm:grid-cols-2">
        {data.tiers.map((t) => (
          <Card key={t.id} className="p-6" style={{ borderColor: `${t.color}55` }}>
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-ink" style={{ background: t.color }}>{t.name.toUpperCase()}</span>
                <p className="mt-4 font-display text-4xl font-bold">{naira(t.price)}</p>
              </div>
              {t.active ? <Badge tone="ok"><Eye className="size-3" /> ON SALE</Badge> : <Badge tone="warn"><EyeOff className="size-3" /> HIDDEN</Badge>}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[['Sold', t.sold], ['Left', t.remaining], ['Total', t.capacity]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-ink-3 py-3"><p className="font-display text-2xl tabular-nums">{v}</p><p className="text-[10px] uppercase tracking-wider text-muted">{l}</p></div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing(t)}>Edit</Button>
              <Button variant="ghost" size="sm" icon={t.active ? EyeOff : Eye} onClick={() => act(update({ id: t.id, active: !t.active }), t.active ? `${t.name} is now hidden from the website.` : `${t.name} is back on sale.`)}>{t.active ? 'Hide' : 'Show'}</Button>
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDel(t)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'New ticket type' : `Edit ${editing?.name || ''}`} wide>
        {editing && <TierForm tier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal open={Boolean(confirmDel)} onClose={() => setConfirmDel(null)} title={`Delete ${confirmDel?.name}?`}>
        <p className="text-sm text-sand/85">This removes the ticket type for good. If anyone has already bought it, you'll need to hide it instead.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDel(null)}>Keep it</Button>
          <Button variant="danger" className="flex-1" icon={Trash2} onClick={async () => { const r = await act(del(confirmDel.id), `${confirmDel.name} deleted.`); if (r) setConfirmDel(null); }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
