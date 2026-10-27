import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Ban, Download, Mail, Search } from 'lucide-react';
import { errMsg, useAttendeesQuery, useCTiersQuery, useResendTicketMutation, useVoidTicketMutation } from '../store/api';
import { act, download } from '../lib/act';
import { fmtDateTime } from '../lib/format';
import { Badge, Button, Empty, ErrorState, Field, Input, Modal, Pagination, Select, Skeleton, Table, Td, Th } from '../components/ui';
import { PageHeader } from './ConsoleLayout';

const TONE = { valid: 'ok', used: 'gold', void: 'bad' };
const LABEL = { valid: 'VALID', used: 'CHECKED IN', void: 'VOID' };

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function Attendees() {
  const token = useSelector((s) => s.auth.token);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const params = { page, limit: 25, ...(q && { search: q }), ...(status && { status }), ...(tier && { tier }) };
  const { data, error, refetch, isFetching } = useAttendeesQuery(params);
  const { data: tiers } = useCTiersQuery();
  const [resend] = useResendTicketMutation();
  const [voidT] = useVoidTicketMutation();
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => setPage(1), [q, status, tier]);

  const exportCsv = () => {
    const qs = new URLSearchParams({ ...(q && { search: q }), ...(status && { status }), ...(tier && { tier }) }).toString();
    return download(`/console/attendees/export${qs ? `?${qs}` : ''}`, 'ngfw-attendees.csv', token);
  };

  const confirmVoid = async () => {
    if (reason.trim().length < 3) return toast.error('Please give a short reason first.');
    const r = await act(voidT({ id: voiding.id, reason }), `Ticket ${voiding.code} cancelled.`);
    if (r) { setVoiding(null); setReason(''); }
  };

  return (
    <div>
      <PageHeader title="Attendees" sub="Every ticket issued, who it's for and whether they've arrived."><Button variant="outline" icon={Download} onClick={exportCsv}>Export CSV</Button></PageHeader>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_170px_170px]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-10" placeholder="Search name, email or ticket code" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="valid">Valid</option><option value="used">Checked in</option><option value="void">Void</option></Select>
        <Select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">All tickets</option>{tiers?.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
      </div>

      {error ? <ErrorState message={errMsg(error)} onRetry={refetch} /> : !data ? <Skeleton className="h-80" /> : data.rows.length === 0 ? <Empty title="No tickets found">Try a different search, or wait for the first sale.</Empty> : (
        <>
          <p className="mb-3 text-xs text-muted">{data.total} ticket{data.total === 1 ? '' : 's'}{isFetching ? ' · updating...' : ''}</p>
          <Table>
            <thead><tr><Th>Attendee</Th><Th>Ticket</Th><Th>Code</Th><Th>Status</Th><Th>Bought by</Th><Th right>Actions</Th></tr></thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <Td><p className="font-medium text-ivory">{t.attendeeName}</p><p className="text-xs text-muted">{t.attendeeEmail || 'no email'}</p></Td>
                  <Td><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: t.tierColor }} />{t.tierName}</span></Td>
                  <Td className="font-mono text-xs text-gold">{t.code}</Td>
                  <Td><Badge tone={TONE[t.status]}>{LABEL[t.status]}</Badge>{t.usedAt && <p className="mt-1 text-[11px] text-muted">{fmtDateTime(t.usedAt)}{t.usedGate ? ` · ${t.usedGate}` : ''}</p>}{t.voidReason && <p className="mt-1 text-[11px] text-muted">{t.voidReason}</p>}</Td>
                  <Td><p>{t.buyerName}</p><p className="text-xs text-muted">{t.source === 'paystack' ? t.buyerEmail : t.source}</p></Td>
                  <Td right>
                    {t.status !== 'void' && <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={Mail} onClick={() => act(resend(t.id), (r) => r.message)}>Resend</Button>
                      {t.status === 'valid' && <Button variant="ghost" size="sm" icon={Ban} onClick={() => setVoiding(t)}>Cancel</Button>}
                    </div>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}

      <Modal open={Boolean(voiding)} onClose={() => setVoiding(null)} title="Cancel this ticket?">
        <p className="text-sm text-sand/85">{voiding?.attendeeName}'s ticket <span className="font-mono text-gold">{voiding?.code}</span> will stop working at the gate. This can't be undone.</p>
        <Field label="Reason" className="mt-5"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate purchase" /></Field>
        <div className="mt-6 flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setVoiding(null)}>Keep ticket</Button><Button variant="danger" className="flex-1" icon={Ban} onClick={confirmVoid}>Cancel ticket</Button></div>
      </Modal>
    </div>
  );
}
