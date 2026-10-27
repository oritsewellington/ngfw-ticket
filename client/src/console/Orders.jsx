import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { errMsg, useCOrdersQuery } from '../store/api';
import { fmtDateTime, naira } from '../lib/format';
import { Badge, Empty, ErrorState, Input, Pagination, Select, Skeleton, Table, Td, Th } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

const TONE = { paid: 'ok', pending: 'warn', failed: 'bad', refunded: 'muted' };

export default function Orders() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const id = setTimeout(() => setQ(search), 350); return () => clearTimeout(id); }, [search]);
  useEffect(() => setPage(1), [q, status]);
  const { data, error, refetch } = useCOrdersQuery({ page, limit: 25, ...(q && { search: q }), ...(status && { status }) });

  return (
    <div>
      <PageHeader title="Orders" sub="Every checkout, including ones that were started but not paid." />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_190px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Search buyer, email or reference" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All orders</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></Select>
      </div>
      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-80" /> : data.rows.length === 0 ? <Empty title="No orders yet" /> : (
        <>
          <Table>
            <thead><tr><Th>When</Th><Th>Buyer</Th><Th>Reference</Th><Th right>Tickets</Th><Th right>Total</Th><Th>Type</Th><Th>Status</Th></tr></thead>
            <tbody>
              {data.rows.map((o) => (
                <tr key={o.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(o.paidAt || o.createdAt)}</Td>
                  <Td><p className="font-medium text-ivory">{o.buyerName}</p><p className="text-xs text-muted">{o.buyerEmail}</p></Td>
                  <Td className="font-mono text-xs">{o.reference}</Td>
                  <Td right>{o.tickets}</Td>
                  <Td right>{naira(o.total)}{o.promoCode && <p className="text-[11px] text-ok">{o.promoCode}</p>}</Td>
                  <Td className="capitalize">{o.source}</Td>
                  <Td><Badge tone={TONE[o.status]}>{o.status.toUpperCase()}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
