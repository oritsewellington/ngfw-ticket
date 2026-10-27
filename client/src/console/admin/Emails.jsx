import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { errMsg, useEmailsQuery, useRetryEmailMutation } from '../../store/api';
import { act } from '../../lib/act';
import { fmtDateTime } from '../../lib/format';
import { Badge, Button, Empty, ErrorState, Pagination, Select, Skeleton, Table, Td, Th } from '../../components/ui';
import { PageHeader } from '../ConsoleLayout';

const TONE = { sent: 'ok', pending: 'warn', failed: 'bad' };

export default function Emails() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, refetch } = useEmailsQuery({ page, limit: 25, ...(status && { status }) }, { pollingInterval: 15000 });
  const [retry] = useRetryEmailMutation();

  return (
    <div>
      <PageHeader title="Email delivery" sub="Every ticket email. Failed ones are retried automatically, or you can retry by hand.">
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All emails</option><option value="sent">Sent</option><option value="pending">Waiting</option><option value="failed">Failed</option></Select>
      </PageHeader>
      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-80" /> : data.rows.length === 0 ? <Empty title="No emails yet" /> : (
        <>
          <Table>
            <thead><tr><Th>Created</Th><Th>To</Th><Th>Type</Th><Th>Status</Th><Th>Tries</Th><Th>Note</Th><Th right>{''}</Th></tr></thead>
            <tbody>
              {data.rows.map((m) => (
                <tr key={m._id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</Td>
                  <Td>{m.to}</Td>
                  <Td className="capitalize">{m.kind}</Td>
                  <Td><Badge tone={TONE[m.status]}>{m.status.toUpperCase()}</Badge>{m.mode === 'dev-log' && <p className="mt-1 text-[10px] text-warn">not really sent (no SMTP)</p>}</Td>
                  <Td>{m.attempts}</Td>
                  <Td className="max-w-xs truncate text-xs text-muted" title={m.lastError}>{m.lastError || '—'}</Td>
                  <Td right>{m.status !== 'sent' && <Button variant="ghost" size="sm" icon={RotateCw} onClick={() => act(retry(m._id), (r) => r.message)}>Retry</Button>}</Td>
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
