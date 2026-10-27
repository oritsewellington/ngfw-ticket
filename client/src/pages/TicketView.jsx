import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarPlus, Download, MapPin, Send, ShieldAlert } from 'lucide-react';
import { errMsg, useGetTicketQuery, useTransferTicketMutation } from '../store/api';
import { act, download, saveBlob } from '../lib/act';
import { buildIcs, fmtDateTime, isEmail, mapsLink } from '../lib/format';
import TicketCard from '../components/TicketCard';
import { Button, ErrorState, Field, Input, Modal, Page, Skeleton, useBusy } from '../components/ui';

function TransferModal({ open, onClose, token }) {
  const [transfer] = useTransferTicketMutation();
  const [busy, run] = useBusy();
  const [form, setForm] = useState({ name: '', email: '' });
  const [confirm, setConfirm] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Please enter the new holder's full name.");
    if (!isEmail(form.email)) return toast.error("Please enter the new holder's email address.");
    if (!confirm) return toast.error('Please confirm that you understand your current QR code will stop working.');
    return run(async () => {
      const res = await act(transfer({ token, ...form }), (r) => r.message);
      if (res) onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Transfer this ticket">
      <p className="mb-5 text-sm text-sand/80">Give this ticket to someone else. They'll get a brand-new QR code by email.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New holder's full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rita Eze" /></Field>
        <Field label="New holder's email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rita@email.com" /></Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-sand">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 size-4 accent-[#e2b865]" />
          I understand my current QR code will stop working immediately and this can't be undone.
        </label>
        <Button type="submit" loading={busy} icon={Send} className="w-full">Transfer ticket</Button>
      </form>
    </Modal>
  );
}

export default function TicketView() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useGetTicketQuery(token);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (isLoading || !data) return <div className="mx-auto max-w-4xl space-y-4 px-5 py-14"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-80" /></div>;

  const { ticket, qrPayload, event, canTransfer } = data;
  const addToCalendar = () => {
    saveBlob(new Blob([buildIcs(event)], { type: 'text/calendar' }), 'nigeria-gala-fashion-week.ics');
    toast.success('Calendar file downloaded. Open it to add the event.');
  };

  return (
    <Page className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-[11px] tracking-[0.5em] text-gold">YOUR TICKET</p>
      <h1 className="mb-8 mt-2 font-display text-4xl font-bold">See you at the show</h1>

      {ticket.status === 'used' && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn"><ShieldAlert className="size-5 shrink-0" /> This ticket was scanned{ticket.usedAt ? ` on ${fmtDateTime(ticket.usedAt)}` : ''}. It can't be used again.</div>
      )}
      {ticket.status === 'void' && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad"><ShieldAlert className="size-5 shrink-0" />
          {ticket.voidReason === 'transferred' ? 'This ticket was transferred to someone else and no longer works.' : ticket.voidReason === 'refunded' ? 'This ticket was refunded and no longer works.' : 'This ticket has been cancelled and no longer works.'}
        </div>
      )}

      <TicketCard ticket={ticket} qrPayload={qrPayload} event={event} />

      {ticket.status === 'valid' && (
        <>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button icon={Download} onClick={() => download(`/tickets/view/${token}/pdf`, `NGFW-ticket-${ticket.code}.pdf`)}>Download PDF</Button>
            <Button variant="outline" icon={CalendarPlus} onClick={addToCalendar}>Add to calendar</Button>
            <Button variant="outline" icon={MapPin} onClick={() => window.open(mapsLink(event), '_blank', 'noopener')}>Directions</Button>
            {canTransfer && <Button variant="outline" icon={Send} onClick={() => setOpen(true)}>Transfer ticket</Button>}
          </div>
          <div className="mt-8 grid gap-4 rounded-2xl border border-line bg-ink-2/70 p-6 text-sm text-sand sm:grid-cols-3">
            <p><strong className="mb-1 block text-ivory">Keep it private</strong>Whoever scans this QR first gets in. Don't post it online.</p>
            <p><strong className="mb-1 block text-ivory">Turn brightness up</strong>It helps the scanner read your phone screen quickly.</p>
            <p><strong className="mb-1 block text-ivory">Can't make it?</strong>{canTransfer ? 'Transfer it to a friend for free.' : 'Transfers are closed for this ticket.'} See the <Link to="/policy" className="text-gold underline">policy</Link>.</p>
          </div>
        </>
      )}
      <TransferModal open={open} onClose={() => setOpen(false)} token={token} />
    </Page>
  );
}
