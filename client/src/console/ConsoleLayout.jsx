import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Activity, BadgeDollarSign, CalendarCog, Gauge, Landmark, LogOut, Mail, Menu, Percent, ScanLine, Settings, Tag, Ticket, Users, X, ReceiptText, Gift } from 'lucide-react';
import { logout } from '../store/authSlice';
import { Badge, Logo, cn } from '../components/ui';

const HOST_NAV = [
  { to: '/console', label: 'Overview', icon: Gauge, end: true },
  { to: '/console/attendees', label: 'Attendees', icon: Users },
  { to: '/console/orders', label: 'Orders', icon: ReceiptText },
  { to: '/console/payouts', label: 'Payouts received', icon: Percent },
  { to: '/console/tiers', label: 'Tickets & prices', icon: Ticket },
  { to: '/console/event', label: 'Event & policy', icon: CalendarCog },
  { to: '/console/promos', label: 'Promo codes', icon: Tag },
  { to: '/console/issue', label: 'Issue tickets', icon: Gift },
  { to: '/console/activity', label: 'Activity log', icon: Activity },
];
const ADMIN_NAV = [
  { to: '/admin', label: 'Platform overview', icon: Landmark, end: true },
  { to: '/admin/ledger', label: 'Payments ledger', icon: BadgeDollarSign },
  { to: '/admin/payouts', label: 'Host payouts', icon: Percent },
  { to: '/admin/emails', label: 'Email delivery', icon: Mail },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

function NavItems({ items, onClick }) {
  return items.map((n) => (
    <NavLink key={n.to} to={n.to} end={n.end} onClick={onClick} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors', isActive ? 'bg-gold/12 font-medium text-gold' : 'text-sand hover:bg-white/5 hover:text-ivory')}>
      <n.icon className="size-[18px]" /> {n.label}
    </NavLink>
  ));
}

export default function ConsoleLayout() {
  const { token, user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!token || !user) return <Navigate to="/console/login" replace />;
  const admin = user.role === 'admin';

  const signOut = () => {
    dispatch(logout());
    toast.success('You have been signed out.');
    navigate('/console/login');
  };

  const sidebar = (close) => (
    <div className="flex h-full flex-col">
      <Link to="/" className="mb-8 flex items-center gap-3 px-2">
        <Logo size={34} />
        <span className="leading-none"><span className="block text-[9px] tracking-[0.4em] text-gold">NGFW</span><span className="block font-display text-base font-bold">Control room</span></span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {admin && <p className="px-3.5 pb-1 pt-2 text-[10px] font-semibold tracking-[0.3em] text-muted">PLATFORM</p>}
        {admin && <NavItems items={ADMIN_NAV} onClick={close} />}
        <p className="px-3.5 pb-1 pt-4 text-[10px] font-semibold tracking-[0.3em] text-muted">{admin ? 'HOST TOOLS' : 'MANAGE EVENT'}</p>
        <NavItems items={HOST_NAV} onClick={close} />
        <p className="px-3.5 pb-1 pt-4 text-[10px] font-semibold tracking-[0.3em] text-muted">GATE</p>
        <NavLink to="/scanner" onClick={close} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sand hover:bg-white/5"><ScanLine className="size-[18px]" /> Open scanner</NavLink>
      </nav>
      <div className="mt-4 rounded-2xl border border-line bg-ink-3 p-4">
        <p className="truncate text-sm font-medium text-ivory">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
        <div className="mt-3 flex items-center justify-between">
          <Badge tone={admin ? 'gold' : 'clay'}>{admin ? 'PLATFORM ADMIN' : 'HOST'}</Badge>
          <button onClick={signOut} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-bad"><LogOut className="size-3.5" /> Sign out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[270px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-ink-2/60 p-5 lg:block">{sidebar(() => {})}</aside>
      <div className="flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2"><Logo size={30} /><span className="font-display font-bold">Control room</span></div>
        <button aria-label="Menu" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg p-2 text-sand"><Menu className="size-6" /></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} className="absolute inset-y-0 left-0 w-72 border-r border-line bg-ink-2 p-5">
              <button aria-label="Close" onClick={() => setOpen(false)} className="absolute right-3 top-3 cursor-pointer p-2 text-muted"><X className="size-5" /></button>
              {sidebar(() => setOpen(false))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}

export function RequireAdmin({ children }) {
  const user = useSelector((s) => s.auth.user);
  if (user?.role !== 'admin') return <Navigate to="/console" replace />;
  return children;
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-sm text-sand/80">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
