import { ArrowLeftRight, DoorOpen, Receipt } from 'lucide-react';
import { errMsg, useGetEventQuery } from '../store/api';
import { ErrorState, Page, Skeleton } from '../components/ui';

export default function Policy() {
  const { data, error, refetch } = useGetEventQuery();
  if (error) return <ErrorState message={errMsg(error)} onRetry={refetch} />;
  if (!data) return <div className="mx-auto max-w-3xl space-y-4 px-5 py-14"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>;
  const p = data.event.policy || {};
  const blocks = [
    { icon: Receipt, title: 'Refunds', text: p.refund },
    { icon: ArrowLeftRight, title: 'Transfers', text: p.transfer },
    { icon: DoorOpen, title: 'Entry rules', text: p.entry },
  ];
  return (
    <Page className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-[11px] tracking-[0.5em] text-gold">TICKET POLICY</p>
      <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Simple and fair</h1>
      <div className="mt-10 space-y-5">
        {blocks.map((b) => (
          <section key={b.title} className="rounded-3xl border border-line bg-ink-2/70 p-7">
            <h2 className="flex items-center gap-3 font-display text-2xl"><b.icon className="size-5 text-gold" /> {b.title}</h2>
            <div className="mt-4 space-y-3 leading-relaxed text-sand/90">
              {(b.text || 'Details will be shared soon.').split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </section>
        ))}
      </div>
    </Page>
  );
}
