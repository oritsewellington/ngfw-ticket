import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Lock,
  Minus,
  Plus,
  Tag,
  User,
  Users,
} from "lucide-react";
import {
  errMsg,
  useCheckoutMutation,
  useGetEventQuery,
  useValidatePromoMutation,
} from "../store/api";
import { act } from "../lib/act";
import { fmtDate, isEmail, naira } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Page,
  Skeleton,
  cn,
} from "../components/ui";

// One ticket in the basket. `custom` becomes true once the buyer types a different name on ticket 1.
const blank = (tierId) => ({
  key: crypto.randomUUID(),
  tierId,
  attendeeName: "",
  attendeeEmail: "",
  custom: false,
});

function StepTitle({ n, children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-3 font-display text-2xl">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-ink">
          {n}
        </span>
        {children}
      </h2>
      {sub && <p className="mt-1 pl-11 text-sm text-sand/75">{sub}</p>}
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, isLoading, error, refetch } = useGetEventQuery();
  const [checkout, { isLoading: paying }] = useCheckoutMutation();
  const [validatePromo] = useValidatePromoMutation();

  const [items, setItems] = useState([]);
  const [who, setWho] = useState("me"); // 'me' = just me, 'others' = me and other guests
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);
  const [errors, setErrors] = useState({});

  const tiers = data?.tiers || [];
  const event = data?.event;
  const maxPerOrder = event?.maxPerOrder || 10;
  const tierMap = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  // Start with one ticket: the tier they clicked, or the first one still available.
  useEffect(() => {
    if (!tiers.length || items.length) return;
    const wanted =
      tiers.find((t) => t.id === params.get("tier") && !t.soldOut) ||
      tiers.find((t) => !t.soldOut);
    if (wanted) setItems([blank(wanted.id)]);
  }, [tiers]); // eslint-disable-line react-hooks/exhaustive-deps

  const qtyOf = (tierId) => items.filter((i) => i.tierId === tierId).length;
  // The name that will be printed on a ticket. Ticket 1 follows the buyer's name until they type a different one.
  const nameOf = (it, idx) =>
    (idx === 0 && !it.custom ? buyer.name : it.attendeeName).trim();

  const subtotal = items.reduce(
    (s, i) => s + (tierMap.get(i.tierId)?.price || 0),
    0,
  );
  const discount = promo ? Math.min(promo.discount, subtotal) : 0;
  const total = subtotal - discount;

  // A promo was calculated for a specific basket. If the basket changes, ask them to re-apply.
  useEffect(() => {
    if (promo) setPromo(null);
  }, [subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const setItem = (key, patch) => {
    setItems((list) =>
      list.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addTicket = (tier) => {
    if (items.length >= maxPerOrder)
      return toast.error(
        `You can buy up to ${maxPerOrder} tickets in one order.`,
      );
    setItems((l) => [...l, blank(tier.id)]);
    setWho("others"); // more than one ticket means there are other guests
  };
  const removeTicket = (tier) => {
    if (items.length <= 1)
      return toast.error("You need at least one ticket in your order.");
    setItems((l) => {
      const last = [...l].reverse().find((i) => i.tierId === tier.id);
      return last ? l.filter((i) => i.key !== last.key) : l;
    });
  };

  const chooseWho = (value) => {
    setWho(value);
    if (value === "me" && items.length > 1) {
      setItems((l) => l.slice(0, 1));
      toast.message("Switched to one ticket, just for you.");
    }
  };

  const applyPromo = async () => {
    if (!promoInput.trim()) return toast.error("Type your promo code first.");
    const res = await act(
      validatePromo({ code: promoInput, subtotal }),
      (r) => `Promo ${r.code} applied. You save ${naira(r.discount)}.`,
    );
    if (res) setPromo(res);
  };

  const validate = () => {
    const e = {};
    if (buyer.name.trim().length < 2)
      e.buyerName = "Please enter your full name.";
    if (!isEmail(buyer.email))
      e.buyerEmail =
        "Please enter a valid email address. Your tickets are sent here.";
    items.forEach((i, idx) => {
      if (nameOf(i, idx).length < 2)
        e[i.key] = `Please enter the name for ticket ${idx + 1}.`;
      else if (i.attendeeEmail && !isEmail(i.attendeeEmail))
        e[i.key] = `The email for ticket ${idx + 1} doesn't look right.`;
    });
    setErrors(e);
    const first = Object.values(e).find(Boolean);
    if (first) toast.error(first);
    return !first;
  };

  const pay = async () => {
    if (!items.length) return toast.error("Please choose at least one ticket.");
    if (!validate()) return;
    const res = await act(
      checkout({
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        promoCode: promo?.code || "",
        items: items.map((i, idx) => ({
          tierId: i.tierId,
          attendeeName: nameOf(i, idx),
          attendeeEmail: i.attendeeEmail,
        })),
      }),
      "Taking you to our secure payment page...",
    );
    if (res?.authorizationUrl) window.location.href = res.authorizationUrl;
  };

  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (isLoading || !data)
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-14">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!event.salesOpen) {
    return (
      <Page className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-display text-4xl">Sales are closed</h1>
        <p className="mt-4 text-sand/80">
          Tickets can't be bought right now. Please check back soon.
        </p>
        <Button className="mt-8" onClick={() => navigate("/")}>
          Back to event
        </Button>
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-6xl px-5 pb-32 pt-12 lg:pb-12">
      <p className="text-[11px] tracking-[0.5em] text-gold">CHECKOUT</p>
      <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">
        Get your tickets
      </h1>
      <p className="mt-3 max-w-xl text-sand/80">
        Three quick steps. Every guest gets their own QR ticket.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          {/* STEP 1: choose tickets */}
          <section>
            <StepTitle n={1} sub="Tap + to add a ticket.">
              Choose your tickets
            </StepTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {tiers.map((t) => {
                const qty = qtyOf(t.id);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border bg-ink-2/80 p-5 transition-colors",
                      qty > 0 ? "border-gold" : "border-line",
                      t.soldOut && "opacity-60",
                    )}
                    style={
                      qty > 0 ? undefined : { borderColor: `${t.color}44` }
                    }
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ background: t.color }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="text-[11px] font-bold tracking-[0.2em]"
                          style={{ color: t.color }}
                        >
                          {t.name.toUpperCase()}
                        </p>
                        <p className="mt-1 font-display text-3xl font-bold text-ivory">
                          {naira(t.price)}
                          {t.earlyBird && (
                            <span className="ml-2 text-base font-normal text-muted line-through">
                              {naira(t.regularPrice)}
                            </span>
                          )}
                        </p>
                        {t.earlyBird && (
                          <p className="mt-1 text-[11px] font-medium text-ok">
                            Early-bird · ends {fmtDate(t.earlyBird.endsAt)}
                          </p>
                        )}
                      </div>
                      {t.soldOut && <Badge tone="bad">SOLD OUT</Badge>}
                    </div>
                    {t.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-sand/75">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-muted">
                        {qty > 0 ? `${qty} selected` : "per person"}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Remove one ${t.name} ticket`}
                          onClick={() => removeTicket(t)}
                          disabled={qty === 0}
                          className="grid size-10 cursor-pointer place-items-center rounded-full border border-line text-ivory transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span
                          className="w-6 text-center text-lg font-semibold tabular-nums text-ivory"
                          aria-live="polite"
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${t.name} ticket`}
                          onClick={() => addTicket(t)}
                          disabled={t.soldOut}
                          className="grid size-10 cursor-pointer place-items-center rounded-full bg-gold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* STEP 2: buyer details */}
          <section>
            <StepTitle n={2} sub="Your tickets are emailed here.">
              Your details
            </StepTitle>
            <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Your full name" required error={errors.buyerName}>
                <Input
                  placeholder="Your name"
                  value={buyer.name}
                  onChange={(e) => {
                    setBuyer({ ...buyer, name: e.target.value });
                    setErrors((x) => ({ ...x, buyerName: undefined }));
                  }}
                  invalid={Boolean(errors.buyerName)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Email address" required error={errors.buyerEmail}>
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="you@email.com"
                  value={buyer.email}
                  onChange={(e) => {
                    setBuyer({ ...buyer, email: e.target.value });
                    setErrors((x) => ({ ...x, buyerEmail: undefined }));
                  }}
                  invalid={Boolean(errors.buyerEmail)}
                  autoComplete="email"
                />
              </Field>
              <Field
                label="Phone / WhatsApp (optional)"
                className="sm:col-span-2"
              >
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="0801 234 5678"
                  value={buyer.phone}
                  onChange={(e) =>
                    setBuyer({ ...buyer, phone: e.target.value })
                  }
                  autoComplete="tel"
                />
              </Field>
            </Card>
          </section>

          {/* STEP 3: who is coming */}
          <section>
            <StepTitle n={3} sub="Each person walks in with their own QR code.">
              Who is coming?
            </StepTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["me", User, "Just me", "One ticket in my name."],
                [
                  "others",
                  Users,
                  "Me and others",
                  "I am buying for friends or family too.",
                ],
              ].map(([value, Icon, title, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseWho(value)}
                  aria-pressed={who === value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                    who === value
                      ? "border-gold bg-gold/10"
                      : "border-line bg-ink-2/70 hover:border-gold/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      who === value ? "bg-gold text-ink" : "bg-ink-3 text-gold",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-ivory">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-sm text-sand/75">
                      {text}
                    </span>
                  </span>
                  {who === value && (
                    <Check className="size-5 shrink-0 text-gold" />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence initial={false}>
              {who === "me" && (
                <motion.p
                  key="me-note"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-xl border border-line bg-ink-2/60 p-4 text-sm text-sand/80"
                >
                  Your ticket will be in the name{" "}
                  <strong className="text-ivory">
                    {buyer.name.trim() || "you enter in step 2"}
                  </strong>
                  . Nothing else to fill in.
                </motion.p>
              )}
              {who === "others" && (
                <motion.div
                  key="others"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 space-y-3"
                >
                  {items.length < 2 && (
                    <p className="rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm text-sand">
                      Add more tickets in step 1 using the + button, then name
                      each guest here.
                    </p>
                  )}
                  {items.map((it, idx) => {
                    const tier = tierMap.get(it.tierId);
                    const nm = nameOf(it, idx);
                    const err = errors[it.key];
                    return (
                      <Card
                        key={it.key}
                        className="relative overflow-hidden p-4 sm:p-5"
                      >
                        <div
                          className="absolute inset-y-0 left-0 w-1"
                          style={{ background: tier?.color }}
                        />
                        <p className="mb-3 flex items-center justify-between text-sm font-semibold text-ivory">
                          <span>
                            {idx === 0
                              ? "Ticket 1 · You"
                              : `Ticket ${idx + 1} · Guest`}
                          </span>
                          <span className="text-xs font-normal text-muted">
                            {tier?.name}
                          </span>
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Full name on the ticket"
                            required
                            error={err && nm.length < 2 ? err : undefined}
                          >
                            <Input
                              placeholder={
                                idx === 0 ? "Your name" : "e.g. Grace Okoro"
                              }
                              value={
                                idx === 0 && !it.custom
                                  ? buyer.name
                                  : it.attendeeName
                              }
                              onChange={(e) =>
                                setItem(it.key, {
                                  attendeeName: e.target.value,
                                  custom: true,
                                })
                              }
                              invalid={Boolean(err) && nm.length < 2}
                              autoComplete="off"
                            />
                          </Field>
                          <Field
                            label="Their email (optional)"
                            hint={
                              idx === 0
                                ? undefined
                                : "We send their ticket to them directly."
                            }
                            error={err && nm.length >= 2 ? err : undefined}
                          >
                            <Input
                              type="email"
                              inputMode="email"
                              placeholder="guest@email.com"
                              value={it.attendeeEmail}
                              onChange={(e) =>
                                setItem(it.key, {
                                  attendeeEmail: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </Card>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
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
                  <li
                    key={it.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="text-sand">
                      <span className="font-medium text-ivory">{t?.name}</span>
                      <br />
                      <span className="text-xs text-muted">
                        {nameOf(it, i) || (i === 0 ? "You" : `Guest ${i + 1}`)}
                      </span>
                    </span>
                    <span className="text-right tabular-nums text-ivory">
                      {naira(t?.price || 0)}
                      {t?.earlyBird && (
                        <>
                          <br />
                          <span className="text-[11px] text-ok">
                            Early-bird
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex gap-2">
                <Input
                  placeholder="Promo code"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  className="uppercase"
                />
                <Button variant="outline" icon={Tag} onClick={applyPromo}>
                  Apply
                </Button>
              </div>
            </div>

            <dl className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
              {items.some((i) => tierMap.get(i.tierId)?.earlyBird) && (
                <div className="flex justify-between text-ok">
                  <dt>Early-bird savings</dt>
                  <dd className="tabular-nums">
                    {naira(
                      items.reduce((s, i) => {
                        const t = tierMap.get(i.tierId);
                        return s + (t?.earlyBird ? t.earlyBird.savings : 0);
                      }, 0),
                    )}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-sand">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{naira(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-ok">
                  <dt>Promo {promo.code}</dt>
                  <dd className="tabular-nums">−{naira(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-sand">
                <dt>Booking fees</dt>
                <dd className="text-ok">None</dd>
              </div>
              <div className="flex items-end justify-between pt-3">
                <dt className="font-medium text-ivory">Total</dt>
                <dd className="font-display text-3xl font-bold tabular-nums text-gold">
                  {naira(total)}
                </dd>
              </div>
            </dl>

            <div className="hidden lg:block">
              <Button
                size="lg"
                className="mt-6 w-full"
                icon={CreditCard}
                loading={paying}
                onClick={pay}
                disabled={!items.length}
              >
                Pay {naira(total)}
              </Button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted">
              <Lock className="size-3.5" /> Secure payment by Paystack · Card,
              transfer or USSD
            </p>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-gold" /> By
              paying you agree to our{" "}
              <Link to="/policy" className="text-gold underline">
                ticket policy
              </Link>
              . Tickets are non-refundable but can be transferred.
            </p>
          </Card>
        </aside>
      </div>

      {/* Phones and tablets: total and pay button always visible at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/25 bg-ink/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">
              {items.length} ticket{items.length === 1 ? "" : "s"} · no fees
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-gold">
              {naira(total)}
            </p>
          </div>
          <Button
            size="lg"
            className="ml-auto flex-1 sm:flex-none sm:px-10"
            icon={CreditCard}
            loading={paying}
            onClick={pay}
            disabled={!items.length}
          >
            Pay now
          </Button>
        </div>
      </div>
    </Page>
  );
}
