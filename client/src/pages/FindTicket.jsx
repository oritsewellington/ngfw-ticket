import { useState } from 'react';
import { toast } from 'sonner';
import { MailCheck, Search } from 'lucide-react';
import { useFindTicketMutation } from '../store/api';
import { act } from '../lib/act';
import { isEmail } from '../lib/format';
import { Button, Card, Field, Input, Page, useBusy } from '../components/ui';

export default function FindTicket() {
  const [find] = useFindTicketMutation();
  const [busy, run] = useBusy();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!isEmail(email)) return toast.error('Please enter the email address you used to buy your ticket.');
    return run(async () => {
      const res = await act(find({ email }), 'Request received. Check your inbox in a minute or two.');
      if (res) setSent(res.message);
    });
  };

  return (
    <Page className="mx-auto max-w-xl px-5 py-20">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold"><Search className="size-7" /></div>
        <h1 className="mt-6 font-display text-4xl font-bold">Find my ticket</h1>
        <p className="mt-3 text-sand/80">Lost the email? Enter the address you used when buying (or the one a friend used for you) and we'll send your tickets again.</p>
      </div>
      <Card className="mt-10 p-6">
        {sent ? (
          <div className="py-4 text-center">
            <MailCheck className="mx-auto size-12 text-ok" />
            <p className="mt-4 text-sand">{sent}</p>
            <Button variant="outline" className="mt-6" onClick={() => setSent('')}>Use a different email</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Field label="Email address" required><Input type="email" inputMode="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Button type="submit" loading={busy} className="w-full" icon={MailCheck}>Send my tickets</Button>
          </form>
        )}
      </Card>
    </Page>
  );
}
