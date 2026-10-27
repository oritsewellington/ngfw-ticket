import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { errMsg, useCEventQuery, usePatchEventMutation } from '../store/api';
import { act } from '../lib/act';
import { fromLagosInput, toLagosInput } from '../lib/format';
import { Button, Card, ErrorState, Field, Input, Skeleton, Switch, Textarea, useBusy } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

const Section = ({ title, sub, children }) => (
  <Card className="p-6 sm:p-7">
    <h2 className="font-display text-2xl">{title}</h2>
    {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    <div className="mt-6 space-y-5">{children}</div>
  </Card>
);

export default function EventSettings() {
  const { data, error, refetch } = useCEventQuery();
  const [patch] = usePatchEventMutation();
  const [busy, run] = useBusy();
  const [f, setF] = useState(null);

  useEffect(() => {
    if (!data?.event || f) return;
    const e = data.event;
    setF({
      name: e.name, tagline: e.tagline || '', description: e.description || '', venue: e.venue || '', address: e.address || '',
      startsAt: toLagosInput(e.startsAt), schedule: e.schedule?.length ? e.schedule.map((s) => ({ label: s.label, time: s.time })) : [],
      contactPhones: (e.contactPhones || []).join(', '), contactEmail: e.contactEmail || '',
      salesOpen: e.salesOpen, transferEnabled: e.transferEnabled, maxPerOrder: e.maxPerOrder, maxTransfersPerTicket: e.maxTransfersPerTicket, transferCutoffHours: e.transferCutoffHours,
      gatePin: e.gatePin || '', policy: { refund: e.policy?.refund || '', transfer: e.policy?.transfer || '', entry: e.policy?.entry || '' },
    });
  }, [data, f]);

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!f) return <Skeleton className="h-96" />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setPolicy = (k) => (e) => setF({ ...f, policy: { ...f.policy, [k]: e.target.value } });
  const setSched = (i, k, v) => setF({ ...f, schedule: f.schedule.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });

  const save = () =>
    run(async () => {
      if (!f.name.trim()) return toast.error('The event name cannot be empty.');
      if (!f.startsAt) return toast.error('Please choose the event date and time.');
      if (f.gatePin && !/^\d{4,8}$/.test(f.gatePin)) return toast.error('The gate PIN must be 4 to 8 digits.');
      await act(
        patch({ ...f, startsAt: fromLagosInput(f.startsAt), contactPhones: f.contactPhones.split(',').map((p) => p.trim()).filter(Boolean) }),
        'Saved. The website now shows your changes.'
      );
    });

  return (
    <div className="space-y-6">
      <PageHeader title="Event & policy" sub="Date, venue, schedule, sales switch and ticket rules. Changes go live straight away.">
        <Button icon={Save} loading={busy} onClick={save}>Save changes</Button>
      </PageHeader>

      <Section title="Sales" sub="Pause or resume ticket sales in one tap.">
        <div className="flex items-center justify-between rounded-xl border border-line bg-ink-3 p-4">
          <div><p className="font-medium">Ticket sales are {f.salesOpen ? 'open' : 'closed'}</p><p className="text-xs text-muted">When closed, nobody can start a new checkout.</p></div>
          <Switch checked={f.salesOpen} onChange={(v) => setF({ ...f, salesOpen: v })} label="Sales open" />
        </div>
      </Section>

      <Section title="Event details">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Event name" required><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Date & start time (Nigeria time)" required><Input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></Field>
          <Field label="Venue"><Input value={f.venue} onChange={set('venue')} /></Field>
          <Field label="Address / area"><Input value={f.address} onChange={set('address')} /></Field>
        </div>
        <Field label="Tagline"><Input value={f.tagline} onChange={set('tagline')} /></Field>
        <Field label="About the event"><Textarea value={f.description} onChange={set('description')} /></Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-sand">Schedule</p>
          <div className="space-y-2">
            {f.schedule.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Red Carpet" value={s.label} onChange={(e) => setSched(i, 'label', e.target.value)} />
                <Input placeholder="12:00 PM" value={s.time} onChange={(e) => setSched(i, 'time', e.target.value)} className="max-w-40" />
                <button aria-label="Remove" onClick={() => setF({ ...f, schedule: f.schedule.filter((_, j) => j !== i) })} className="cursor-pointer rounded-lg px-2 text-muted hover:text-bad"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon={Plus} className="mt-3" onClick={() => setF({ ...f, schedule: [...f.schedule, { label: '', time: '' }] })}>Add schedule item</Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact phone numbers" hint="Separate with commas"><Input value={f.contactPhones} onChange={set('contactPhones')} placeholder="09022360118, 07016553908" /></Field>
          <Field label="Contact email"><Input type="email" value={f.contactEmail} onChange={set('contactEmail')} /></Field>
        </div>
      </Section>

      <Section title="Ticket rules">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Max tickets per order"><Input type="number" min="1" max="20" value={f.maxPerOrder} onChange={set('maxPerOrder')} /></Field>
          <Field label="Max transfers per ticket"><Input type="number" min="0" max="5" value={f.maxTransfersPerTicket} onChange={set('maxTransfersPerTicket')} /></Field>
          <Field label="Transfers close (hours before)"><Input type="number" min="0" max="72" value={f.transferCutoffHours} onChange={set('transferCutoffHours')} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-ink-3 p-4">
          <div><p className="font-medium">Allow ticket transfers</p><p className="text-xs text-muted">The buyer gives a ticket to someone else. The old QR stops working.</p></div>
          <Switch checked={f.transferEnabled} onChange={(v) => setF({ ...f, transferEnabled: v })} label="Allow transfers" />
        </div>
        <Field label="Gate scanner PIN" hint="4 to 8 digits. Share only with gate staff."><Input inputMode="numeric" value={f.gatePin} onChange={set('gatePin')} className="max-w-48 font-mono tracking-widest" /></Field>
      </Section>

      <Section title="Ticket policy" sub="Shown on the Policy page and linked in emails. Use blank lines to start a new paragraph.">
        <Field label="Refunds"><Textarea className="min-h-32" value={f.policy.refund} onChange={setPolicy('refund')} /></Field>
        <Field label="Transfers"><Textarea className="min-h-28" value={f.policy.transfer} onChange={setPolicy('transfer')} /></Field>
        <Field label="Entry rules"><Textarea className="min-h-32" value={f.policy.entry} onChange={setPolicy('entry')} /></Field>
      </Section>

      <div className="flex justify-end"><Button size="lg" icon={Save} loading={busy} onClick={save}>Save changes</Button></div>
    </div>
  );
}
