import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { naira, pct, fmtMedDate } from '../lib/format';
import { Card, cn } from '../components/ui';

export function Stat({ label, value, sub, icon: Icon, tone = 'ivory' }) {
  const colors = { ivory: 'text-ivory', gold: 'text-gold', ok: 'text-ok', bad: 'text-bad', warn: 'text-warn' };
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-ink-2/80 p-5">
      <div className="flex items-center justify-between text-muted">
        <p className="text-[11px] font-semibold uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-4" />}
      </div>
      <p className={cn('mt-3 font-display text-3xl font-bold tabular-nums', colors[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </motion.div>
  );
}

/**
 * THE transparency panel. Shown identically to the host and the platform admin, so nobody has to ask
 * "how was this number worked out?". Paystack fee comes off first, then the NET is split.
 */
export function RevenueBreakdown({ finance, platformPercent }) {
  const f = finance;
  const hostPercent = Math.round((100 - platformPercent) * 100) / 100;
  const parts = [
    { key: 'fee', label: 'Paystack fees', value: f.fees, cls: 'bg-bad/70' },
    { key: 'platform', label: `Platform (${platformPercent}% of net)`, value: f.platformShare, cls: 'bg-clay' },
    { key: 'host', label: `Host (${hostPercent}% of net)`, value: f.hostShare, cls: 'bg-gold' },
  ];
  const rows = [
    { label: 'Gross revenue', note: 'Paid by customers (exact ticket prices)', value: f.gross, big: true },
    { label: 'Paystack fees', note: 'Payment processing, deducted first', value: -f.fees, tone: 'text-bad' },
    { label: 'Net revenue', note: 'After Paystack fees', value: f.net, big: true, tone: 'text-ok', line: true },
    { label: `Platform share (${platformPercent}%)`, note: 'Of net revenue', value: f.platformShare },
    { label: `Host share (${hostPercent}%)`, note: 'Of net revenue', value: f.hostShare, tone: 'text-gold' },
  ];
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-display text-2xl">Revenue &amp; payment fees</h2>
      <p className="mt-1 flex gap-2 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" /> Paystack fees are deducted first. The remaining amount is then split between the host and the platform.</p>

      <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-ink-3">
        {f.gross > 0 && parts.map((p) => (
          <motion.div key={p.key} initial={{ width: 0 }} animate={{ width: `${pct(p.value, f.gross)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className={p.cls} title={`${p.label}: ${naira(p.value)}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {parts.map((p) => <span key={p.key} className="inline-flex items-center gap-1.5"><i className={cn('size-2.5 rounded-full', p.cls)} /> {p.label}</span>)}
      </div>

      <dl className="mt-6 divide-y divide-line/70">
        {rows.map((r) => (
          <div key={r.label} className={cn('flex items-center justify-between gap-4 py-3.5', r.line && 'border-t-2 border-line')}>
            <div><dt className="text-sm text-ivory">{r.label}</dt><p className="text-xs text-muted">{r.note}</p></div>
            <dd className={cn('tabular-nums', r.big ? 'font-display text-2xl font-bold' : 'text-lg font-semibold', r.tone || 'text-ivory')}>{r.value < 0 ? `−${naira(-r.value)}` : naira(r.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-5 sm:grid-cols-3">
        <div><p className="text-[11px] uppercase tracking-wider text-muted">Host share earned</p><p className="mt-1 font-display text-2xl tabular-nums text-ivory">{naira(f.hostShare)}</p></div>
        <div><p className="text-[11px] uppercase tracking-wider text-muted">Already paid to host</p><p className="mt-1 font-display text-2xl tabular-nums text-ok">{naira(f.paidOut)}</p></div>
        <div><p className="text-[11px] uppercase tracking-wider text-muted">Still owed to host</p><p className="mt-1 font-display text-2xl tabular-nums text-gold">{naira(f.outstanding)}</p></div>
      </div>
      {(f.offlineTickets > 0 || f.refundedOrders > 0) && (
        <p className="mt-4 text-xs text-muted">
          Not included above: {f.offlineTickets > 0 && `${f.offlineTickets} cash/complimentary ticket${f.offlineTickets === 1 ? '' : 's'} issued by hand (${naira(f.offlineCash)} cash handled by the host directly)`}
          {f.offlineTickets > 0 && f.refundedOrders > 0 && ' · '}
          {f.refundedOrders > 0 && `${f.refundedOrders} refunded order${f.refundedOrders === 1 ? '' : 's'} (${naira(f.refundedGross)})`}.
        </p>
      )}
    </Card>
  );
}

export function SalesChart({ series }) {
  if (!series?.length) return <p className="py-10 text-center text-sm text-muted">Sales will appear here after the first payment.</p>;
  const data = series.slice(-30);
  const max = Math.max(...data.map((d) => d.gross), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5">
        {data.map((d, i) => (
          <div key={d._id} className="group relative flex h-full min-w-0 flex-1 items-end">
            <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (d.gross / max) * 100)}%` }} transition={{ duration: 0.6, delay: i * 0.02 }} className="w-full rounded-t-md bg-gradient-to-t from-gold/50 to-gold" />
            <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-ink px-3 py-2 text-xs group-hover:block">
              <p className="font-semibold text-ivory">{fmtMedDate(d._id)}</p>
              <p className="text-gold">{naira(d.gross)} · {d.tickets} ticket{d.tickets === 1 ? '' : 's'}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{fmtMedDate(data[0]._id)}</span><span>{fmtMedDate(data[data.length - 1]._id)}</span></div>
    </div>
  );
}

export function TierProgress({ perTier }) {
  return (
    <div className="space-y-5">
      {perTier.map((t) => (
        <div key={t.id}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-ivory"><i className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.name} <span className="text-xs font-normal text-muted">{naira(t.price)}</span>{!t.active && <span className="text-[10px] text-warn">(hidden)</span>}</span>
            <span className="tabular-nums text-sand">{t.sold}<span className="text-muted"> / {t.capacity}</span></span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-ink-3">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(t.sold, t.capacity)}%` }} transition={{ duration: 0.8 }} className="absolute inset-y-0 left-0 rounded-full opacity-40" style={{ background: t.color }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(t.checkedIn, t.capacity)}%` }} transition={{ duration: 0.8 }} className="absolute inset-y-0 left-0 rounded-full" style={{ background: t.color }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">{t.checkedIn} checked in · {Math.max(0, t.capacity - t.sold)} left</p>
        </div>
      ))}
    </div>
  );
}
