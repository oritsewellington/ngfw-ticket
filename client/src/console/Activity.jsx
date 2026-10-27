import { useState } from 'react';
import { errMsg, useActivityQuery } from '../store/api';
import { fmtDateTime } from '../lib/format';
import { Badge, Empty, ErrorState, Pagination, Skeleton, Table, Td, Th } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

const pretty = (a) => a.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function Activity() {
  const [page, setPage] = useState(1);
  const { data, error, refetch } = useActivityQuery({ page, limit: 30 });
  return (
    <div>
      <PageHeader title="Activity log" sub="A permanent record of every change: prices, dates, refunds, payouts and more. Nobody can edit or delete it." />
      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-80" /> : data.rows.length === 0 ? <Empty title="No activity yet" /> : (
        <>
          <Table>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>What happened</Th><Th>Details</Th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r._id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td>
                  <Td><span className="text-ivory">{r.actorName}</span> <Badge tone={r.actorRole === 'admin' ? 'gold' : r.actorRole === 'host' ? 'clay' : 'muted'}>{String(r.actorRole).toUpperCase()}</Badge></Td>
                  <Td className="font-medium text-ivory">{pretty(r.action)}</Td>
                  <Td className="max-w-md text-xs text-muted">{r.detail}</Td>
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
