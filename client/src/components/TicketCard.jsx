import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin } from 'lucide-react';
import { fmtDate } from '../lib/format';
import { cn } from './ui';

const STAMP = {
  used: { text: 'USED', cls: 'text-warn border-warn' },
  void: { text: 'NOT VALID', cls: 'text-bad border-bad' },
};

/** The ticket. Landscape on desktop, stacked on phones. Same look as the PDF and email. */
export default function TicketCard({ ticket, qrPayload, event, className }) {
  const color = ticket.tierColor || '#e2b865';
  const stamp = STAMP[ticket.status];
  const inactive = ticket.status !== 'valid';
  return (
    <motion.div initial={{ opacity: 0, y: 20, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className={cn('relative w-full', className)}>
      <div className="relative grid overflow-hidden rounded-[28px] border border-gold/25 bg-gradient-to-br from-ink-3 via-ink-2 to-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] grain md:grid-cols-[1fr_250px]">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full opacity-[0.12] blur-3xl" style={{ background: color }} />

        {/* Left: details */}
        <div className={cn('relative p-6 pl-8 sm:p-8 sm:pl-10', inactive && 'opacity-60 grayscale')}>
          <p className="text-[11px] tracking-[0.5em] text-gold">NIGERIA</p>
          <h3 className="font-display text-3xl font-bold leading-tight text-ivory sm:text-4xl">GALA FASHION WEEK</h3>
          <div className="my-4 h-px w-16 bg-gold" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full px-4 py-1.5 text-[11px] font-bold tracking-[0.2em] text-ink" style={{ background: color }}>
              {String(ticket.tierName).toUpperCase()}
            </span>
            <span className="text-[10px] tracking-[0.3em] text-muted">ADMIT ONE</span>
          </div>
          <p className="mt-5 text-[10px] tracking-[0.3em] text-muted">ATTENDEE</p>
          <p className="font-display text-2xl font-bold text-ivory sm:text-3xl [overflow-wrap:anywhere]">{ticket.attendeeName}</p>
          {event && (
            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex gap-2.5">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-gold" />
                <div>
                  <p className="font-semibold text-ivory">{fmtDate(event.startsAt)}</p>
                  <p className="text-xs text-muted">{(event.schedule || []).map((s) => `${s.label} ${s.time}`).join(' · ')}</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                <div>
                  <p className="font-semibold text-ivory">{event.venue}</p>
                  <p className="text-xs text-muted">{event.address}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Perforation */}
        <div className="relative md:hidden">
          <div className="mx-6 border-t-2 border-dashed border-gold/30" />
          <span className="absolute -left-3 -top-3 size-6 rounded-full bg-ink" />
          <span className="absolute -right-3 -top-3 size-6 rounded-full bg-ink" />
        </div>
        <div className="pointer-events-none absolute inset-y-6 right-[250px] hidden border-l-2 border-dashed border-gold/30 md:block" />
        <span className="absolute -top-3 right-[238px] hidden size-6 rounded-full bg-ink md:block" />
        <span className="absolute -bottom-3 right-[238px] hidden size-6 rounded-full bg-ink md:block" />

        {/* Right: QR */}
        <div className="relative grid place-items-center p-6 sm:p-7">
          <div className={cn('w-full max-w-[210px] rounded-2xl bg-ivory p-4 text-center', inactive && 'opacity-40')}>
            {qrPayload ? <QRCodeSVG value={qrPayload} level="M" bgColor="#f6ecd9" fgColor="#120d0a" className="h-auto w-full" size={400} /> : <div className="aspect-square" />}
            <p className="mt-3 font-mono text-[13px] font-bold tracking-wider text-ink">{ticket.code}</p>
            <p className="mt-1 text-[9px] font-semibold tracking-[0.25em] text-[#6b5a45]">SCAN ONCE AT THE GATE</p>
          </div>
        </div>

        {stamp && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className={cn('-rotate-12 rounded-xl border-4 bg-ink/70 px-6 py-2 font-display text-4xl font-bold tracking-widest backdrop-blur-sm', stamp.cls)}>{stamp.text}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
