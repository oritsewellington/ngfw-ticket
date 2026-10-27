import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, Download, ExternalLink, Loader2, Mail, XCircle } from 'lucide-react';
import { errMsg, useGetOrderQuery } from '../store/api';
import { download } from '../lib/act';
import { naira } from '../lib/format';
import { Button, Card, ErrorState, LinkButton, Page } from '../components/ui';

export default function OrderStatus() {
  const { reference } = useParams();
  const [poll, setPoll] = useState(3000);
  const [seconds, setSeconds] = useState(0);
  const { data, error, refetch } = useGetOrderQuery(reference, { pollingInterval: poll });
  const announced = useRef(false);

  useEffect(() => {
    if (data && data.status !== 'pending') setPoll(0);
  }, [data]);

  useEffect(() => {
    if (data?.status && data.status !== 'pending') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [data?.status]);

  useEffect(() => {
    if (!data || announced.current) return;
    if (data.status === 'paid') {
      announced.current = true;
      toast.success('Payment successful! Your tickets are ready.');
    } else if (data.status === 'failed') {
      announced.current = true;
      toast.error("Your payment didn't go through. If money left your account, your bank will return it.");
    }
  }, [data]);

  if (error && !data) return <ErrorState message={errMsg(error)} onRetry={refetch} />;

  if (!data || data.status === 'pending') {
    return (
      <Page className="mx-auto max-w-lg px-5 py-28 text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }} className="mx-auto grid size-20 place-items-center rounded-full border border-gold/30">
          <Loader2 className="size-9 text-gold" />
        </motion.div>
        <h1 className="mt-8 font-display text-3xl">Confirming your payment</h1>
        <p className="mt-3 text-sand/80">Please don't close this page. This usually takes a few seconds.</p>
        {seconds > 40 && (
          <div className="mt-8 rounded-2xl border border-line bg-ink-2 p-5 text-sm text-sand">
            This is taking longer than usual. If your payment went through, your tickets will be emailed to you shortly, so you don't need to pay again.
            <div className="mt-4"><Button variant="outline" onClick={() => refetch()}>Check again</Button></div>
          </div>
        )}
      </Page>
    );
  }

  if (data.status === 'failed' || data.status === 'refunded') {
    return (
      <Page className="mx-auto max-w-lg px-5 py-28 text-center">
        <XCircle className="mx-auto size-16 text-bad" />
        <h1 className="mt-6 font-display text-3xl">{data.status === 'refunded' ? 'This order was refunded' : 'Payment not completed'}</h1>
        <p className="mt-3 text-sand/80">{data.status === 'refunded' ? 'The tickets in this order are no longer valid.' : "Your payment didn't go through, so no tickets were issued. If money left your account, your bank will return it automatically."}</p>
        <LinkButton to="/#tickets" className="mt-8">Try again</LinkButton>
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-3xl px-5 py-14">
      <div className="text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto grid size-20 place-items-center rounded-full bg-ok/15">
          <CheckCircle2 className="size-11 text-ok" />
        </motion.div>
        <h1 className="mt-6 font-display text-4xl font-bold sm:text-5xl">You're going!</h1>
        <p className="mx-auto mt-3 max-w-md text-sand/85">
          Payment of <strong className="text-gold">{naira(data.total)}</strong> received. Your {data.tickets.length === 1 ? 'ticket is' : `${data.tickets.length} tickets are`} below and on the way to <strong className="text-ivory">{data.buyerEmail}</strong>.
        </p>
      </div>

      <div className="mt-10 space-y-4">
        {data.tickets.map((t, i) => (
          <motion.div key={t.code} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i }}>
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: `${t.tierColor}55` }}>
              <div>
                <span className="rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-ink" style={{ background: t.tierColor }}>{t.tierName.toUpperCase()}</span>
                <p className="mt-3 font-display text-2xl">{t.attendeeName}</p>
                <p className="font-mono text-sm text-gold">{t.code}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton to={`/ticket/${t.token}`} icon={ExternalLink}>Open ticket</LinkButton>
                <Button variant="outline" icon={Download} onClick={() => download(`/tickets/view/${t.token}/pdf`, `NGFW-ticket-${t.code}.pdf`)}>PDF</Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex gap-3 rounded-2xl border border-line bg-ink-2/70 p-5 text-sm text-sand">
        <Mail className="mt-0.5 size-5 shrink-0 text-gold" />
        <p>Check your inbox (and spam folder) for the email with your tickets. If it doesn't arrive in a few minutes, use <Link to="/find-ticket" className="text-gold underline">Find my ticket</Link>. Each person must show <em>their own</em> QR code at the gate.</p>
      </div>
    </Page>
  );
}
