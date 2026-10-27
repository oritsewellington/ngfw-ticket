import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { BadgeCheck, CreditCard, Lock, Plus, Tag, Trash2, UserRound } from 'lucide-react';
import { errMsg, useCheckoutMutation, useGetEventQuery, useValidatePromoMutation } from '../store/api';
import { act } from '../lib/act';
import { isEmail, naira } from '../lib/format';
import { Button, Card, ErrorState, Field, Input, Page, Select, Skeleton } from '../components/ui';

const blank = (tierId) => ({ key: crypto.randomUUID(), tierId, attendeeName: '', attendeeEmail: '' });

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, isLoading, error, refetch } = useGetEventQuery();
  const [checkout, { isLoading: paying }] = useCheckoutMutation();
  const [validatePromo] = useValidatePromoMutation();

  const [items, setItems] = useState([]);
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);
  const [errors, setErrors] = useState({});

  const tiers = data?.tiers || [];
  const event = data?.event;
  const tierMap = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  // Start with one ticket: the tier they clicked, or the first one still available.
  useEffect(() => {
    if (!tiers.length || items.length) return;
    const wanted = tiers.find((t) => t.id === params.get('tier') && !t.soldOut) || tiers.find((t) => !t.soldOut);
    if (wanted) setItems([blank(wanted.id)]);
  }, [tiers]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = items.reduce((s, i) => s + (tierMap.get(i.tierId)?.price || 0), 0);
  const discount = promo ? Math.min(promo.discount, subtotal) : 0;
  const total = subtotal - discount;

  // A promo was calculated for a specific basket. If the basket changes, ask them to re-apply.
  useEffect(() => {
    if (promo) setPromo(null);
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const setItem = (key, patch) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const addItem = () => {
    if (items.length >= (event?.maxPerOrder || 10)) return toast.error(`You can buy up to ${event.maxPerOrder} tickets in one order.`);
    const last = items[items.length - 1];
    const tier = tierMap.get(last?.tierId);
    setItems((l) => [...l, blank(tier && !tier.soldOut ? tier.id : tiers.find((t) => !t.soldOut)?.id)]);
  };
  const removeItem = (key) => setItems((l) => l.filter((i) => i.key !== key));

  const applyPromo = async () => {
    if (!promoInput.trim()) return toast.error('Type your promo code first.');
    const res = await act(validatePromo({ code: promoInput, subtotal }), (r) => `Promo ${r.code} applied. You save ${naira(r.discount)}.`);
    if (res) setPromo(res);
  };

  const validate = () => {
    const e = {};
    if (buyer.name.trim().length < 2) e.buyerName = 'Please enter your full name.';
    if (!isEmail(buyer.email)) e.buyerEmail = 'Please enter a valid email address. Your tickets are sent here.';
    items.forEach((i, idx) => {
      if (i.attendeeName.trim().length < 2) e[i.key] = `Please enter the name for ticket ${idx + 1}.`;
      else if (i.attendeeEmail && !isEmail(i.attendeeEmail)) e[i.key] = `The email for ticket ${idx + 1} doesn't look right.`;
    });
    setErrors(e);
    const first = Object.values(e).find(Boolean);
    if (first) toast.error(first);
    return !first;
  };

  const pay = async () => {
    if (!items.length) return toast.error('Please add at least one ticket.');
    if (!validate()) return;
    const res = await act(
      checkout({
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        promoCode: promo?.code || '',
        items: items.map((i) => ({ tierId: i.tierId, attendeeName: i.attendeeName, attendeeEmail: i.attendeeEmail })),
      }),
      'Taking you to our secure payment page...'
    );
    if (res?.authorizationUrl) window.location.href = res.authorizationUrl;
  };

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (isLoading || !data) return <div className="mx-auto max-w-5xl space-y-4 px-5 py-14"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div>;
  if (!event.salesOpen) {
    return (
      <Page className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-display text-4xl">Sales are closed</h1>
        <p className="mt-4 text-sand/80">Tickets can't be bought right now. Please check back soon.</p>
        <Button className="mt-8" onClick={() => navigate('/')}>Back to event</Button>
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-[11px] tracking-[0.5em] text-gold">CHECKOUT</p>
      <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Your tickets</h1>
      <p className="mt-3 max-w-xl text-sand/80">Add each guest by name. Everyone gets their own QR ticket, so they can arrive at different times and walk in on their own.</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* Tickets */}
          <section className="space-y-4">
            <AnimatePresence initial={false}>
              {items.map((it, idx) => {
                const tier = tierMap.get(it.tierId);
                return (
                  <motion.div key={it.key} layout initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.25 }}>
                    <Card className="relative overflow-hidden p-5 sm:p-6" style={{ borderColor: `${tier?.color || '#3a2c1f'}55` }}>
                      <div className="absolute inset-y-0 left-0 w-1" style={{ background: tier?.color }} />
                      <div className="mb-4 flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ivory"><span className="grid size-7 place-items-center rounded-full bg-gold/15 text-xs text-gold">{idx + 1}</span> Ticket {idx + 1}</p>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(it.key)} aria-label={`Remove ticket ${idx + 1}`} className="cursor-pointer rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad"><Trash2 className="size-4" /></button>
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Ticket type" className="sm:col-span-2">
                          <Select value={it.tierId} onChange={(e) => setItem(it.key, { tierId: e.target.value })}>
                            {tiers.map((t) => (
                              <option key={t.id} value={t.id} disabled={t.soldOut}>{t.name} · {naira(t.price)}{t.soldOut ? ' (sold out)' : ''}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Guest's full name" required error={errors[it.key] && !it.attendeeName.trim() ? errors[it.key] : undefined}>
                          <Input placeholder="e.g. Grace Okoro" value={it.attendeeName} onChange={(e) => setItem(it.key, { attendeeName: e.target.value })} invalid={Boolean(errors[it.key]) && !it.attendeeName.trim()} autoComplete="off" />
                        </Field>
                        <Field label="Guest's email (optional)" hint="We'll send their ticket straight to them." error={errors[it.key] && it.attendeeName.trim() ? errors[it.key] : undefined}>
                          <Input type="email" inputMode="email" placeholder="guest@email.com" value={it.attendeeEmail} onChange={(e) => setItem(it.key, { attendeeEmail: e.target.value })} />
                        </Field>
                      </div>
                      {idx === 0 && buyer.name.trim() && it.attendeeName.trim() !== buyer.name.trim() && (
                        <button onClick={() => setItem(it.key, { attendeeName: buyer.name.trim() })} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs text-gold hover:underline">
                          <UserRound className="size-3.5" /> This ticket is for me
                        </button>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <Button variant="outline" icon={Plus} onClick={addItem}>Add another ticket</Button>
          </section>

          {/* Buyer */}
          <section>
            <h2 className="mb-4 font-display text-2xl">Your details</h2>
            <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Your full name" required error={errors.buyerName}>
                <Input placeholder="Your name" value={buyer.name} onChange={(e) => { setBuyer({ ...buyer, name: e.target.value }); setErrors((x) => ({ ...x, buyerName: undefined })); }} invalid={Boolean(errors.buyerName)} autoComplete="name" />
              </Field>
              <Field label="Email address" required error={errors.buyerEmail} hint="All your tickets are sent here.">
                <Input type="email" inputMode="email" placeholder="you@email.com" value={buyer.email} onChange={(e) => { setBuyer({ ...buyer, email: e.target.value }); setErrors((x) => ({ ...x, buyerEmail: undefined })); }} invalid={Boolean(errors.buyerEmail)} autoComplete="email" />
              </Field>
              <Field label="Phone / WhatsApp (optional)" className="sm:col-span-2">
                <Input type="tel" inputMode="tel" placeholder="0801 234 5678" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} autoComplete="tel" />
              </Field>
            </Card>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-2xl">Order summary</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {items.map((it, i) => {
                const t = tierMap.get(it.tierId);
                return (
                  <li key={it.key} className="flex items-start justify-between gap-3">
                    <span className="text-sand"><span className="font-medium text-ivory">{t?.name}</span><br /><span className="text-xs text-muted">{it.attendeeName.trim() || `Guest ${i + 1}`}</span></span>
                    <span className="tabular-nums text-ivory">{naira(t?.price || 0)}</span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex gap-2">
                <Input placeholder="Promo code" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && applyPromo()} className="uppercase" />
                <Button variant="outline" icon={Tag} onClick={applyPromo}>Apply</Button>
              </div>
            </div>

            <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
              <div className="flex justify-between text-sand"><dt>Subtotal</dt><dd className="tabular-nums">{naira(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-ok"><dt>Promo {promo.code}</dt><dd className="tabular-nums">−{naira(discount)}</dd></div>}
              <div className="flex justify-between text-sand"><dt>Booking fees</dt><dd className="text-ok">None</dd></div>
              <div className="flex items-end justify-between pt-3"><dt className="font-medium text-ivory">Total</dt><dd className="font-display text-3xl font-bold tabular-nums text-gold">{naira(total)}</dd></div>
            </dl>

            <Button size="lg" className="mt-6 w-full" icon={CreditCard} loading={paying} onClick={pay} disabled={!items.length}>
              Pay {naira(total)}
            </Button>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted"><Lock className="size-3.5" /> Secure payment by Paystack · Card, transfer or USSD</p>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-gold" /> By paying you agree to our <Link to="/policy" className="text-gold underline">ticket policy</Link>. Tickets are non-refundable but can be transferred.</p>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
