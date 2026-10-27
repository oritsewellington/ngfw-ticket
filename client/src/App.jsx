import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PublicLayout from './components/PublicLayout';
import { LinkButton, Page, PageLoader } from './components/ui';
import Home from './pages/Home';
import ConsoleLayout, { RequireAdmin } from './console/ConsoleLayout';

// Rarely-used screens load on demand so the public site stays fast on phones.
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const TicketView = lazy(() => import('./pages/TicketView'));
const FindTicket = lazy(() => import('./pages/FindTicket'));
const Policy = lazy(() => import('./pages/Policy'));
const Scanner = lazy(() => import('./pages/Scanner'));
const Login = lazy(() => import('./console/Login'));
const Overview = lazy(() => import('./console/Overview'));
const Attendees = lazy(() => import('./console/Attendees'));
const Orders = lazy(() => import('./console/Orders'));
const MyPayouts = lazy(() => import('./console/MyPayouts'));
const Tiers = lazy(() => import('./console/Tiers'));
const EventSettings = lazy(() => import('./console/EventSettings'));
const Promos = lazy(() => import('./console/Promos'));
const IssueTickets = lazy(() => import('./console/IssueTickets'));
const Activity = lazy(() => import('./console/Activity'));
const Ledger = lazy(() => import('./console/admin/Ledger'));
const Payouts = lazy(() => import('./console/admin/Payouts'));
const Emails = lazy(() => import('./console/admin/Emails'));
const Settings = lazy(() => import('./console/admin/Settings'));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 80);
      return () => clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const NotFound = () => (
  <Page className="mx-auto max-w-lg px-5 py-28 text-center">
    <p className="font-display text-7xl font-bold text-gold/40">404</p>
    <h1 className="mt-4 font-display text-3xl">We couldn't find that page</h1>
    <p className="mt-3 text-sand/80">The link may be old or mistyped.</p>
    <LinkButton to="/" className="mt-8">Back to the event</LinkButton>
  </Page>
);

export default function App() {
  const location = useLocation();
  return (
    <>
      <ScrollManager />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname.startsWith('/console') || location.pathname.startsWith('/admin') ? 'console' : location.pathname}>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="order/:reference" element={<OrderStatus />} />
              <Route path="ticket/:token" element={<TicketView />} />
              <Route path="find-ticket" element={<FindTicket />} />
              <Route path="policy" element={<Policy />} />
            </Route>

            <Route path="scanner" element={<Scanner />} />
            <Route path="console/login" element={<Login />} />

            <Route element={<ConsoleLayout />}>
              <Route path="console" element={<Overview />} />
              <Route path="console/attendees" element={<Attendees />} />
              <Route path="console/orders" element={<Orders />} />
              <Route path="console/payouts" element={<MyPayouts />} />
              <Route path="console/tiers" element={<Tiers />} />
              <Route path="console/event" element={<EventSettings />} />
              <Route path="console/promos" element={<Promos />} />
              <Route path="console/issue" element={<IssueTickets />} />
              <Route path="console/activity" element={<Activity />} />

              <Route path="admin" element={<RequireAdmin><Overview admin /></RequireAdmin>} />
              <Route path="admin/ledger" element={<RequireAdmin><Ledger /></RequireAdmin>} />
              <Route path="admin/payouts" element={<RequireAdmin><Payouts /></RequireAdmin>} />
              <Route path="admin/emails" element={<RequireAdmin><Emails /></RequireAdmin>} />
              <Route path="admin/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
            </Route>

            <Route path="*" element={<PublicLayout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}
