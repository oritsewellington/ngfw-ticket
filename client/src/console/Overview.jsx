import { toast } from 'sonner';
import { AlertTriangle, BadgeCheck, CheckCircle2, Mail, RefreshCw, ScanLine, ShoppingBag, Ticket, Users, Wallet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { errMsg, useAOverviewQuery, useCOverviewQuery, useReconcileMutation } from '../store/api';
import { act } from '../lib/act';
import { fmtDateTime, naira, pct } from '../lib/format';
import { Badge, Button, Card, ErrorState, Skeleton, Table, Td, Th } from '../components/ui';
import { PageHeader } from './ConsoleLayout';
import { RevenueBreakdown, SalesChart, Stat, TierProgress } from './widgets';

function Health({ health, onReconcile }) {
  const items = [
    { ok: health.paystackConfigured, label: 'Paystack', detail: health.paystackMode === 'live' ? 'Live payments' : health.paystackMode === 'test' ? 'TEST mode: no real money' : 'Not connected' },
    { ok: Boolean(health.lastWebhookAt), label: 'Webhook', detail: health.lastWebhookAt ? `Last received ${fmtDateTime(health.lastWebhookAt)}` : 'Nothing received yet' },
    { ok: health.smtpConfigured && health.emails.failed === 0, label: 'Email', detail: !health.smtpConfigured ? 'SMTP not set: emails are NOT being sent' : `${health.emails.sent} sent · ${health.emails.pending} waiting · ${health.emails.failed} failed` },
    { ok: health.stalePending === 0, label: 'Unconfirmed payments', detail: health.stalePending ? `${health.stalePending} older than 30 min` : 'All payments confirmed' },
  ];
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">System health</h2>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onReconcile}>Check Paystack for missed payments</Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-line bg-ink-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ivory">{i.ok ? <CheckCircle2 className="size-4 text-ok" /> : <AlertTriangle className="size-4 text-warn" />} {i.label}</p>
            <p className="mt-1.5 text-xs text-muted">{i.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Overview({ admin = false }) {
  const user = useSelector((s) => s.auth.user);
  const host = useCOverviewQuery(undefined, { skip: admin, pollingInterval: 30000 });
  const plat = useAOverviewQuery(undefined, { skip: !admin, pollingInterval: 30000 });
  const q = admin ? plat : host;
  const [reconcile] = useReconcileMutation();
  const d = q.data;

  if (q.error) return <ErrorState message={errMsg(q.error)} onRetry={q.refetch} />;
  if (!d) return <div className="space-y-5"><Skeleton className="h-10 w-1/2" /><div className="grid gap-4 sm:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-96" /></div>;

  const f = d.finance;
  return (
    <div className="space-y-8">
      <PageHeader title={admin ? 'Platform overview' : `Hello, ${user.name.split(' ')[0]}`} sub={admin ? 'Every naira, line by line. The host sees the same split.' : 'Live sales for your event. The revenue split below is exactly what the platform admin sees too.'}>
        <Badge tone={d.event.salesOpen ? 'ok' : 'warn'}>{d.event.salesOpen ? 'SALES OPEN' : 'SALES CLOSED'}</Badge>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross revenue" value={naira(f.gross)} sub={`${f.orders} paid order${f.orders === 1 ? '' : 's'}`} icon={Wallet} tone="gold" />
        <Stat label="Net after fees" value={naira(f.net)} sub={`Paystack took ${naira(f.fees)}`} icon={BadgeCheck} tone="ok" />
        <Stat label={admin ? `Your share (${d.platformPercent}%)` : `Your share (${100 - d.platformPercent}%)`} value={naira(admin ? f.platformShare : f.hostShare)} sub={admin ? 'Platform earnings' : `${naira(f.outstanding)} still to be paid out`} icon={ShoppingBag} />
        <Stat label="Tickets issued" value={d.tickets.issued} sub={`${d.tickets.used} checked in · ${d.capacity - d.tickets.issued} left`} icon={Ticket} />
      </div>

      {admin && <Health health={d.health} onReconcile={() => act(reconcile(), (r) => r.message)} />}

      <RevenueBreakdown finance={f} platformPercent={d.platformPercent} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6"><h2 className="mb-5 font-display text-2xl">Sales by day</h2><SalesChart series={d.series} /></Card>
        <Card className="p-6">
          <h2 className="mb-5 font-display text-2xl">Ticket types</h2>
          <TierProgress perTier={d.perTier} />
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Checked in" value={`${d.tickets.used} / ${d.tickets.issued}`} sub={`${pct(d.tickets.used, d.tickets.issued)}% of issued tickets`} icon={ScanLine} />
        <Stat label="Valid (not yet used)" value={d.tickets.valid} icon={Users} />
        <Stat label="Cancelled / transferred" value={d.tickets.void} icon={Mail} />
      </div>

      {admin && d.recent?.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-2xl">Latest payments</h2>
          <Table>
            <thead><tr><Th>When</Th><Th>Buyer</Th><Th right>Tickets</Th><Th right>Gross</Th><Th right>Fee</Th><Th right>Net</Th><Th right>Platform</Th><Th right>Host</Th></tr></thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.reference}><Td className="whitespace-nowrap">{fmtDateTime(r.paidAt)}</Td><Td>{r.buyerName}</Td><Td right>{r.tickets}</Td><Td right>{naira(r.gross)}</Td><Td right className="text-bad">{naira(r.fee)}</Td><Td right>{naira(r.net)}</Td><Td right>{naira(r.platform)}</Td><Td right className="text-gold">{naira(r.host)}</Td></tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
    </div>
  );
}
