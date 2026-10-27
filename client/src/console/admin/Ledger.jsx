import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Download, Search, Undo2 } from 'lucide-react';
import { errMsg, useLedgerQuery, useRefundOrderMutation } from '../../store/api';
import { act, download } from '../../lib/act';
import { fmtDateTime, naira } from '../../lib/format';
import { Button, Empty, ErrorState, Field, Input, Modal, Pagination, Skeleton, Table, Td, Th } from '../../components/ui';
import { PageHeader } from '../ConsoleLayout';

export default function Ledger() {
  const token = useSelector((s) => s.auth.token);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState(null);
  const [reason, setReason] = useState('');
  const [doRefund] = useRefundOrderMutation();

  useEffect(() => { const id = setTimeout(() => setQ(search), 350); return () => clearTimeout(id); }, [search]);
  useEffect(() => setPage(1), [q, from, to]);
  const filters = { ...(q && { search: q }), ...(from && { from }), ...(to && { to }) };
  const { data, error, refetch } = useLedgerQuery({ page, limit: 25, ...filters });

  const exportCsv = () => download(`/admin/ledger/export${Object.keys(filters).length ? `?${new URLSearchParams(filters)}` : ''}`, 'ngfw-ledger.csv', token);

  const confirmRefund = async () => {
    if (reason.trim().length < 3) return toast.error('Please give a short reason for this refund.');
    const r = await act(doRefund({ id: refund.id, reason }), (x) => x.message);
    if (r) { setRefund(null); setReason(''); }
  };

  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Payments ledger" sub="Every successful payment with the exact split. Totals below follow your filters."><Button variant="outline" icon={Download} onClick={exportCsv}>Export CSV</Button></PageHeader>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_170px_170px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Search buyer, email or reference" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-96" /> : data.rows.length === 0 ? <Empty title="No payments match">Payments appear here as soon as they are confirmed.</Empty> : (
        <>
          <Table>
            <thead><tr><Th>Paid</Th><Th>Buyer</Th><Th right>Tix</Th><Th right>Gross</Th><Th right>Paystack fee</Th><Th right>Net</Th><Th right>Platform</Th><Th right>Host</Th><Th right>{''}</Th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.paidAt)}<p className="font-mono text-[10px] text-muted">{r.reference}</p></Td>
                  <Td><p className="font-medium text-ivory">{r.buyerName}</p><p className="text-xs text-muted">{r.buyerEmail}{r.channel ? ` · ${r.channel}` : ''}</p></Td>
                  <Td right>{r.tickets}</Td>
                  <Td right>{naira(r.gross)}{r.promoCode && <p className="text-[11px] text-ok">{r.promoCode}</p>}</Td>
                  <Td right className="text-bad">−{naira(r.fee)}</Td>
                  <Td right>{naira(r.net)}</Td>
                  <Td right>{naira(r.platform)}<p className="text-[10px] text-muted">{r.percent}%</p></Td>
                  <Td right className="text-gold">{naira(r.host)}</Td>
                  <Td right><Button variant="ghost" size="sm" icon={Undo2} onClick={() => setRefund(r)}>Refund</Button></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-3 font-semibold text-ivory">
                <Td className="text-xs uppercase tracking-wider text-muted">Totals</Td><Td>{data.total} payments</Td><Td right>{t.tickets}</Td><Td right>{naira(t.gross)}</Td><Td right className="text-bad">−{naira(t.fees)}</Td><Td right>{naira(t.net)}</Td><Td right>{naira(t.platform)}</Td><Td right className="text-gold">{naira(t.host)}</Td><Td>{''}</Td>
              </tr>
            </tfoot>
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
      <Modal open={Boolean(refund)} onClose={() => setRefund(null)} title="Refund this order?">
        <p className="text-sm text-sand/85">{refund?.buyerName} will be refunded <strong className="text-ivory">{refund && naira(refund.gross)}</strong> through Paystack and all tickets in this order stop working. Paystack may not return its processing fee. Orders with already-used tickets can't be refunded.</p>
        <Field label="Reason" className="mt-5"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Event cancelled / duplicate payment" /></Field>
        <div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setRefund(null)}>Cancel</Button><Button variant="danger" className="flex-1" icon={Undo2} onClick={confirmRefund}>Refund</Button></div>
      </Modal>
    </div>
  );
}
