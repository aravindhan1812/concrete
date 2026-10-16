import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Column, DataTable, EmptyState, Fab, PageHeader, Pill, Tone } from '../../components/ui';
import { useViewport } from '../../hooks/useMediaQuery';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';
import { useSession } from '../../lib/session';
import ClientForm from './ClientForm';
import { ClientCredit, ClientRow, CREDIT_LABEL, formatPhone } from './types';

export const CREDIT_TONE: Record<ClientCredit['status'], Tone> = { no_limit: 'neutral', ok: 'success', near: 'warning', over: 'danger' };

export default function ClientsList() {
  const { can } = useSession();
  const navigate = useNavigate();
  const viewport = useViewport();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const canManage = can('crm.clients.manage');

  useEffect(() => {
    const t = window.setTimeout(() => {
      const qs = new URLSearchParams({ status, pageSize: '100' });
      if (search.trim()) qs.set('search', search.trim());
      api
        .get<{ data: ClientRow[]; total: number }>(`/crm/clients?${qs}`)
        .then((r) => {
          setRows(r.data);
          setTotal(r.total);
        })
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, status]);

  const showCredit = rows?.some((r) => r.credit) ?? false;
  const columns: Column<ClientRow>[] = [
    {
      key: 'name',
      header: 'Client',
      render: (r) => (
        <span className="cell-main">
          <span className="cell-title">{r.name}</span>
          <span className="cell-sub">
            {r.code}
            {!r.isActive && ' · inactive'}
          </span>
        </span>
      ),
    },
    { key: 'contact', header: 'Primary contact', render: (r) => r.primaryContact ?? '—', hideOnPhone: true },
    { key: 'phone', header: 'Phone', render: (r) => formatPhone(r.phone) || '—' },
    { key: 'state', header: 'GST state', render: (r) => r.stateName ?? '—', hideOnPhone: true },
    { key: 'projects', header: 'Projects', render: (r) => r.projectCount, align: 'right', hideOnPhone: true },
  ];
  if (showCredit)
    columns.push({
      key: 'credit',
      header: 'Outstanding',
      align: 'right',
      render: (r) =>
        r.credit ? (
          <span className="cell-credit">
            <span className="num">{inr(r.credit.outstanding)}</span>
            {r.credit.status !== 'no_limit' && <Pill tone={CREDIT_TONE[r.credit.status]}>{CREDIT_LABEL[r.credit.status]}</Pill>}
          </span>
        ) : (
          '—'
        ),
    });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={rows ? `${total} ${status === 'all' ? '' : status} client${total === 1 ? '' : 's'}`.replace('  ', ' ') : undefined}
        actions={
          canManage && viewport !== 'phone' ? (
            <Button icon="plus" onClick={() => setCreating(true)}>
              New client
            </Button>
          ) : undefined
        }
      />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}
      <div className="toolbar">
        <div className="search">
          <input
            type="search"
            placeholder="Search name, code, phone, GSTIN, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
        </div>
        <div className="segmented" role="radiogroup" aria-label="Status">
          {(['active', 'inactive', 'all'] as const).map((s) => (
            <button key={s} role="radio" aria-checked={status === s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {rows && (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/crm/clients/${r.id}`)}
          empty={
            <EmptyState
              icon="clients"
              title={search ? 'No clients match your search' : 'No clients yet'}
              body={search ? undefined : 'Convert a lead or add a client directly.'}
              action={
                canManage && !search ? (
                  <Button icon="plus" onClick={() => setCreating(true)}>
                    New client
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
      {canManage && viewport === 'phone' && <Fab label="New client" onClick={() => setCreating(true)} />}
      {creating && <ClientForm onClose={() => setCreating(false)} onSaved={(c) => navigate(`/crm/clients/${c.id}`)} />}
    </>
  );
}
