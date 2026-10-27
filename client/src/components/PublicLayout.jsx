import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Phone, Mail, X } from 'lucide-react';
import { useGetEventQuery } from '../store/api';
import { Logo, buttonClasses, cn } from './ui';

const links = [
  { to: '/', label: 'Event', end: true },
  { to: '/find-ticket', label: 'Find my ticket' },
  { to: '/policy', label: 'Ticket policy' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Logo size={36} />
          <span className="leading-none">
            <span className="block text-[9px] tracking-[0.45em] text-gold">NIGERIA</span>
            <span className="block font-display text-[15px] font-bold tracking-wide text-ivory">GALA FASHION WEEK</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn('rounded-lg px-3.5 py-2 text-sm transition-colors', isActive ? 'text-gold' : 'text-sand hover:text-ivory')}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/#tickets" className={buttonClasses('gold', 'sm', 'ml-3')}>
            Get tickets
          </Link>
        </nav>
        <button aria-label="Menu" className="cursor-pointer rounded-lg p-2 text-sand md:hidden" onClick={() => setOpen((o) => !o)}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line md:hidden">
            <div className="flex flex-col gap-1 p-4">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)} className={({ isActive }) => cn('rounded-xl px-4 py-3', isActive ? 'bg-gold/10 text-gold' : 'text-sand')}>
                  {l.label}
                </NavLink>
              ))}
              <Link to="/#tickets" onClick={() => setOpen(false)} className={buttonClasses('gold', 'md', 'mt-2')}>
                Get tickets
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <span className="hidden">{pathname}</span>
    </header>
  );
}

function Footer() {
  const { data } = useGetEventQuery();
  const e = data?.event;
  return (
    <footer className="mt-24 border-t border-line bg-ink-2/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <p className="font-display text-lg font-bold">Nigeria Gala Fashion Week</p>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Redefining fashion through our culture and heritage.</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.3em] text-gold">TICKETS</p>
          <ul className="space-y-2 text-sand">
            <li><Link className="hover:text-gold" to="/#tickets">Buy tickets</Link></li>
            <li><Link className="hover:text-gold" to="/find-ticket">Lost your ticket email?</Link></li>
            <li><Link className="hover:text-gold" to="/policy">Refund &amp; transfer policy</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.3em] text-gold">NEED HELP?</p>
          <ul className="space-y-2 text-sand">
            {(e?.contactPhones || []).map((p) => (
              <li key={p}>
                <a className="inline-flex items-center gap-2 hover:text-gold" href={`tel:${p}`}>
                  <Phone className="size-4 text-gold" /> {p}
                </a>
              </li>
            ))}
            {e?.contactEmail && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-gold" href={`mailto:${e.contactEmail}`}>
                  <Mail className="size-4 text-gold" /> {e.contactEmail}
                </a>
              </li>
            )}
          </ul>
          <Link to="/console/login" className="mt-6 inline-block text-xs text-muted hover:text-sand">Organiser sign in</Link>
        </div>
      </div>
      <div className="border-t border-line/60 py-5 text-center text-xs text-muted">© {new Date().getFullYear()} Nigeria Gala Fashion Week. Payments secured by Paystack.</div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
