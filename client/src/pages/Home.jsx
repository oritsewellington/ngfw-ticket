import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Mail,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { errMsg, useGetEventQuery } from "../store/api";
import { fmtDate, mapsLink, naira } from "../lib/format";
import {
  Badge,
  Button,
  ErrorState,
  LinkButton,
  Skeleton,
  cn,
} from "../components/ui";

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    done: diff === 0,
    d: Math.floor(diff / 864e5),
    h: Math.floor((diff / 36e5) % 24),
    m: Math.floor((diff / 6e4) % 60),
    s: Math.floor((diff / 1e3) % 60),
  };
}

function Countdown({ target }) {
  const { d, h, m, s, done } = useCountdown(target);
  if (done)
    return (
      <p className="font-display text-2xl text-gold">
        The show is on. Welcome!
      </p>
    );
  return (
    <div className="flex gap-3">
      {[
        ["Days", d],
        ["Hours", h],
        ["Mins", m],
        ["Secs", s],
      ].map(([l, v]) => (
        <div
          key={l}
          className="w-[4.5rem] rounded-2xl border border-gold/25 bg-ink/60 py-3 text-center backdrop-blur sm:w-20"
        >
          <p className="font-display text-3xl font-bold tabular-nums text-ivory sm:text-4xl">
            {String(v).padStart(2, "0")}
          </p>
          <p className="text-[10px] tracking-[0.25em] text-muted">
            {l.toUpperCase()}
          </p>
        </div>
      ))}
    </div>
  );
}

const fade = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

function Reveal({ children, className }) {
  return (
    <motion.div
      variants={fade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ eyebrow, title, sub }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.5em] text-gold">
        {eyebrow}
      </p>
      <h2 className="font-display text-4xl font-bold text-ivory sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-sand/80">{sub}</p>}
    </Reveal>
  );
}

function TierCard({ tier, salesOpen, onChoose }) {
  const disabled = tier.soldOut || !salesOpen;
  return (
    <motion.div
      variants={fade}
      whileHover={disabled ? undefined : { y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border bg-ink-2/80 p-7"
      style={{ borderColor: `${tier.color}55` }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: tier.color }}
      />
      <div className="mb-5 flex items-center justify-between">
        <span
          className="rounded-full px-3.5 py-1 text-[11px] font-bold tracking-[0.2em] text-ink"
          style={{ background: tier.color }}
        >
          {tier.name.toUpperCase()}
        </span>
        {tier.soldOut ? (
          <Badge tone="bad">SOLD OUT</Badge>
        ) : tier.lowStock ? (
          <Badge tone="warn">SELLING FAST</Badge>
        ) : null}
      </div>
      <p className="font-display text-5xl font-bold text-ivory">
        {naira(tier.price)}
      </p>
      <p className="mt-1 text-xs text-muted">
        per person · pay exactly this, no hidden fees
      </p>
      {tier.description && (
        <p className="mt-4 text-sm text-sand/80">{tier.description}</p>
      )}
      <ul className="mt-5 flex-1 space-y-2.5 text-sm text-sand">
        {(tier.perks || []).map((p) => (
          <li key={p} className="flex gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0"
              style={{ color: tier.color }}
            />{" "}
            {p}
          </li>
        ))}
        <li className="flex gap-2.5">
          <Check
            className="mt-0.5 size-4 shrink-0"
            style={{ color: tier.color }}
          />{" "}
          Your own personal QR ticket
        </li>
      </ul>
      <Button
        className="mt-7 w-full"
        variant={disabled ? "outline" : "gold"}
        disabled={disabled}
        onClick={() => onChoose(tier)}
      >
        {tier.soldOut
          ? "Sold out"
          : !salesOpen
            ? "Sales closed"
            : `Choose ${tier.name}`}
        {!disabled && <ArrowRight className="size-4" />}
      </Button>
    </motion.div>
  );
}

const STEPS = [
  {
    icon: Ticket,
    title: "Choose your tickets",
    text: "Pick a ticket type and enter the name of each guest.",
  },
  {
    icon: CreditCard,
    title: "Pay securely",
    text: "Card, bank transfer or USSD through Paystack. You pay exactly the ticket price.",
  },
  {
    icon: Mail,
    title: "Get tickets instantly",
    text: "Each guest gets their own QR ticket on screen and by email, as a PDF too.",
  },
  {
    icon: ScanLine,
    title: "Scan and walk in",
    text: "Show your QR at the gate. Everyone enters on their own, no waiting for the buyer.",
  },
];

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-ink-2/70">
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left font-medium text-ivory"
        onClick={() => setOpen((o) => !o)}
      >
        {q}
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-gold transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-sand/85">{a}</p>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetEventQuery();

  if (error)
    return (
      <ErrorState
        message={errMsg(error)}
        onRetry={() =>
          refetch().then((r) => r.error && toast.error(errMsg(r.error)))
        }
      />
    );
  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-20">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  const { event, tiers } = data;
  const choose = (tier) => navigate(`/checkout?tier=${tier.id}`);

  return (
    <div>
      {/* HERO */}
      <section className="relative isolate overflow-hidden grain">
        {/* Desktop / tablet: the photo is a wide backdrop behind the text. */}
        <img
          src={event.heroImage || "/hero.jpg"}
          alt=""
          className="absolute inset-0 -z-20 hidden h-full w-full object-cover object-top opacity-50 md:block"
        />
        <div className="absolute inset-0 -z-10 hidden bg-gradient-to-b from-ink/70 via-ink/60 to-ink md:block" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(226,184,101,0.16),transparent)]" />
        {/* Phones: show the WHOLE group photo at its natural shape (nobody cropped out), fading into the page. */}
        <div className="relative md:hidden">
          <img
            src={event.heroImage || "/hero.jpg"}
            alt="Models in traditional Nigerian attire"
            className="aspect-[810/475] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
        </div>
        <div className="mx-auto -mt-10 flex max-w-6xl flex-col items-center justify-center px-5 pb-16 text-center md:mt-0 md:min-h-[88dvh] md:py-20">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-xs tracking-[0.7em] text-gold sm:text-sm"
          >
            NIGERIA
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="font-display text-5xl font-extrabold leading-[1.05] text-ivory sm:text-7xl lg:text-8xl"
          >
            Gala <span className="gold-text italic">Fashion</span> Week
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-6 max-w-xl text-lg text-sand"
          >
            {event.tagline}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-sand"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/60 px-4 py-2 backdrop-blur">
              <CalendarDays className="size-4 text-gold" />{" "}
              {fmtDate(event.startsAt)}
            </span>
            <a
              href={mapsLink(event)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-ink/60 px-4 py-2 backdrop-blur hover:border-gold/60"
            >
              <MapPin className="size-4 text-gold" /> {event.venue}, Benin City
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-10"
          >
            <Countdown target={event.startsAt} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            <LinkButton href="#tickets" size="lg" icon={Ticket}>
              Get tickets
            </LinkButton>
            <LinkButton to="/find-ticket" variant="outline" size="lg">
              Find my ticket
            </LinkButton>
          </motion.div>
        </div>
      </section>

      {/* Pure CSS animation: it starts immediately and keeps running even while the page is busy loading. */}
      <div
        className="overflow-hidden border-y border-gold/20 bg-gold py-3 text-ink"
        aria-hidden="true"
      >
        <div className="flex w-max animate-marquee whitespace-nowrap text-xs font-bold tracking-[0.4em] will-change-transform motion-reduce:animate-none">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 gap-10 pr-10">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="flex items-center gap-10">
                  REDEFINING FASHION THROUGH OUR CULTURE AND HERITAGE{" "}
                  <Sparkles className="size-3.5" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* DETAILS */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionTitle
          eyebrow="THE DAY"
          title="One day. Two moments."
          sub={event.description}
        />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-5 md:grid-cols-3"
        >
          {(event.schedule || []).map((s, i) => (
            <motion.div
              key={s.label}
              variants={fade}
              className="rounded-3xl border border-line bg-ink-2/80 p-7"
            >
              <p className="font-display text-6xl font-bold text-gold/30">
                0{i + 1}
              </p>
              <p className="mt-2 font-display text-2xl text-ivory">{s.label}</p>
              <p className="mt-1 text-lg text-gold">{s.time}</p>
            </motion.div>
          ))}
          <motion.a
            variants={fade}
            href={mapsLink(event)}
            target="_blank"
            rel="noreferrer"
            className="group rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/10 to-transparent p-7 transition-colors hover:border-gold"
          >
            <MapPin className="size-7 text-gold" />
            <p className="mt-4 font-display text-2xl text-ivory">
              {event.venue}
            </p>
            <p className="mt-1 text-sm text-sand/80">{event.address}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold">
              Open in Maps{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </p>
          </motion.a>
        </motion.div>
      </section>

      {/* TICKETS */}
      <section
        id="tickets"
        className="scroll-mt-20 border-y border-line bg-ink-2/40 py-24"
      >
        <div className="mx-auto max-w-6xl px-5">
          <SectionTitle
            eyebrow="TICKETS"
            title="Choose your experience"
            sub="Buy for yourself or for your whole group. Every guest gets their own ticket."
          />
          {!event.salesOpen && (
            <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-warn/40 bg-warn/10 p-4 text-center text-sm text-warn">
              Ticket sales are closed right now. Please check back soon.
            </div>
          )}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {tiers.map((t) => (
              <TierCard
                key={t.id}
                tier={t}
                salesOpen={event.salesOpen}
                onChoose={choose}
              />
            ))}
          </motion.div>
          {tiers.length === 0 && (
            <p className="text-center text-muted">
              Tickets will be available shortly.
            </p>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionTitle
          eyebrow="HOW IT WORKS"
          title="From checkout to the front row"
        />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              variants={fade}
              className="relative rounded-3xl border border-line bg-ink-2/70 p-6"
            >
              <span className="absolute right-5 top-4 font-display text-4xl font-bold text-white/5">
                {i + 1}
              </span>
              <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                <s.icon className="size-5" />
              </div>
              <p className="font-semibold text-ivory">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-sand/80">
                {s.text}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FAIR ENTRY */}
      <section className="mx-auto max-w-6xl px-5">
        <Reveal className="grid gap-8 overflow-hidden rounded-[32px] border border-gold/25 bg-gradient-to-br from-ink-3 to-ink-2 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Badge tone="gold">
              <ShieldCheck className="size-3.5" /> FAIR &amp; SECURE ENTRY
            </Badge>
            <h3 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
              One ticket. One person. No duplicates.
            </h3>
            <p className="mt-4 text-sand/85">
              Every guest has a personal QR code that can only be scanned once.
              A screenshot forwarded to a friend is worthless once the original
              has been used.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-sand">
              {[
                "Each QR is cryptographically signed, so fakes and edited screenshots fail instantly",
                "Buying for friends? Put each name on their own ticket so everyone enters on their own phone",
                "Can’t make it? Transfer your ticket to someone else for free",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              [QrCode, "Signed QR"],
              [Users, "Ticket per guest"],
              [ShieldCheck, "Single use"],
              [Mail, "Instant email"],
            ].map(([I, t]) => (
              <div
                key={t}
                className="rounded-2xl border border-line bg-ink/60 p-5 text-center"
              >
                <I className="mx-auto size-7 text-gold" />
                <p className="mt-3 text-sm font-medium">{t}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-24">
        <SectionTitle eyebrow="QUESTIONS" title="Good to know" />
        <div className="space-y-3">
          <Faq
            q="I didn't get my ticket email. What do I do?"
            a="Check your spam folder first. You can also open Find my ticket, enter the email you used to buy, and we will send your tickets again. Your ticket is also shown on screen right after payment."
          />
          <Faq
            q="Can I buy tickets for my friends?"
            a="Yes. Choose how many tickets you need and enter each guest's name. Everyone gets their own QR code, so they can arrive at different times and still walk in on their own."
          />
          <Faq
            q="Can I get a refund?"
            a="Tickets are non-refundable, but you can transfer your ticket to someone else for free. If the event is cancelled by the organisers, we will make it right. See the full ticket policy for details."
          />
          <Faq
            q="What if two people scan the same ticket?"
            a="Only the first scan is accepted. The second person sees a red 'Already scanned' screen at the gate, so keep your QR code private."
          />
          <Faq
            q="How do I pay?"
            a="Payments are handled by Paystack. You can pay with your card, bank transfer or USSD. You are charged exactly the ticket price."
          />
        </div>
      </section>
    </div>
  );
}
