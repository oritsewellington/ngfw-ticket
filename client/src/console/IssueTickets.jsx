import { useState } from 'react';
import { toast } from 'sonner';
import { Gift, Plus, Send, Trash2 } from 'lucide-react';
import { errMsg, useCTiersQuery, useManualTicketsMutation } from '../store/api';
import { act } from '../lib/act';
import { isEmail } from '../lib/format';
import { Button, Card, ErrorState, Field, Input, Select, Skeleton, useBusy } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

export default function IssueTickets() {
  const { data, error, refetch } = useCTiersQuery();
  const [issue] = useManualTicketsMutation();
  const [busy, run] = useBusy();
  const [kind, setKind] = useState('complimentary');
  const [tierId, setTierId] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [people, setPeople] = useState([{ name: '', email: '' }]);

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-96" />;

  const setPerson = (i, k, v) => setPeople(people.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const submit = (e) => {
    e.preventDefault();
    if (!tierId) return toast.error('Please choose a ticket type.');
    if (people.some((p) => p.name.trim().length < 2)) return toast.error('Please enter a name for every ticket.');
    if (people.some((p) => p.email && !isEmail(p.email))) return toast.error('One of the guest emails does not look right.');
    if (!isEmail(sendTo)) return toast.error('Please enter the email that should receive the tickets.');
    return run(async () => {
      const r = await act(issue({ kind, tierId, sendTo, attendees: people }), (x) => x.message);
      if (r) { setPeople([{ name: '', email: '' }]); setSendTo(''); }
    });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Issue tickets by hand" sub="For cash sales at the door, sponsors and VIP guests. Each person still gets their own signed QR ticket by email." />
      <form onSubmit={submit}>
        <Card className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type of issue"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="complimentary">Complimentary (free)</option><option value="cash">Cash sale (paid to the host directly)</option></Select></Field>
            <Field label="Ticket type" required><Select value={tierId} onChange={(e) => setTierId(e.target.value)}><option value="">Choose...</option>{data.tiers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.remaining} left)</option>)}</Select></Field>
          </div>
          <p className="rounded-xl border border-line bg-ink-3 p-3 text-xs text-muted">Cash and complimentary tickets don't go through Paystack, so they are not part of the revenue split on the dashboards. They are listed separately for transparency.</p>
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-sand">Guests</p>
            {people.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input placeholder={`Guest ${i + 1} full name`} value={p.name} onChange={(e) => setPerson(i, 'name', e.target.value)} />
                <Input type="email" placeholder="Email (optional)" value={p.email} onChange={(e) => setPerson(i, 'email', e.target.value)} />
                <button type="button" aria-label="Remove guest" disabled={people.length === 1} onClick={() => setPeople(people.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg px-3 text-muted hover:text-bad disabled:opacity-30"><Trash2 className="size-4" /></button>
              </div>
            ))}
            <Button variant="outline" size="sm" icon={Plus} onClick={() => people.length < 20 ? setPeople([...people, { name: '', email: '' }]) : toast.error('You can issue up to 20 tickets at a time.')}>Add guest</Button>
          </div>
          <Field label="Send all tickets to" required hint="Usually your own email, or the sponsor's contact."><Input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="name@email.com" /></Field>
          <Button type="submit" loading={busy} size="lg" icon={kind === 'cash' ? Send : Gift} className="w-full">Issue {people.length} ticket{people.length === 1 ? '' : 's'}</Button>
        </Card>
      </form>
    </div>
  );
}
