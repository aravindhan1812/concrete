import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Dialog, EmptyState, Fab, PageHeader, Pill, SelectField, TextField, Tone } from '../components/ui';
import { useViewport } from '../hooks/useMediaQuery';
import { api } from '../lib/api';
import { inr, relativeDays } from '../lib/format';
import { useSession } from '../lib/session';
import { Lead, LeadStatus, NEXT_MOVES, PIPELINE } from '../lib/types';

const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: 'neutral',
  contacted: 'info',
  site_visit: 'info',
  quotation: 'accent',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
};

export default function Leads() {
  const { can } = useSession();
  const viewport = useViewport();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [phoneStage, setPhoneStage] = useState<LeadStatus>('new');
  const [lostFor, setLostFor] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ data: Lead[] }>('/crm/leads?pageSize=100');
      setLeads(result.data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !leads) return leads ?? [];
    return leads.filter((l) => [l.title, l.contactName, l.phone, l.city, l.code].some((v) => v?.toLowerCase().includes(q)));
  }, [leads, search]);

  async function move(lead: Lead, status: LeadStatus, lostReason?: string) {
    try {
      await api.patch(`/crm/leads/${lead.id}/status`, { status, lostReason });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function requestMove(lead: Lead, status: LeadStatus) {
    if (status === 'lost') setLostFor(lead);
    else void move(lead, status);
  }

  const canCreate = can('crm.leads.create');
  const canUpdate = can('crm.leads.update');
  const stages = viewport === 'phone' ? PIPELINE.filter((p) => p.status === phoneStage) : PIPELINE;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={leads ? `${leads.length} in pipeline` : undefined}
        actions={canCreate && viewport !== 'phone' ? <Button icon="plus" onClick={() => setShowCreate(true)}>New lead</Button> : undefined}
      />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}

      <div className="toolbar">
        <div className="search">
          <input type="search" placeholder="Search title, contact, phone, city…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search leads" />
        </div>
      </div>

      {viewport === 'phone' && (
        <div className="stage-tabs" role="tablist" aria-label="Pipeline stage">
          {PIPELINE.map((p) => {
            const n = filtered.filter((l) => l.status === p.status).length;
            return (
              <button key={p.status} role="tab" aria-selected={phoneStage === p.status} className={`stage-tab${phoneStage === p.status ? ' active' : ''}`} onClick={() => setPhoneStage(p.status)}>
                {p.label} <span className="count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {leads && leads.length === 0 ? (
        <EmptyState icon="leads" title="No leads yet" body="Add your first enquiry to start the pipeline." action={canCreate ? <Button icon="plus" onClick={() => setShowCreate(true)}>New lead</Button> : undefined} />
      ) : (
        <div className={`board${viewport === 'phone' ? ' single' : ''}`}>
          {stages.map(({ status, label }) => {
            const column = filtered.filter((l) => l.status === status);
            return (
              <div className="column" key={status}>
                {viewport !== 'phone' && (
                  <h3>
                    {label} <span className="count">{column.length}</span>
                  </h3>
                )}
                {column.map((lead) => (
                  <div className="card" key={lead.id}>
                    <div className="card-top">
                      <div className="title">{lead.title}</div>
                      {lead.code && <span className="code">{lead.code}</span>}
                    </div>
                    <div className="meta">
                      <span>
                        {lead.contactName}
                        {lead.city ? ` · ${lead.city}` : ''}
                      </span>
                      {lead.estimatedValue && <span className="value">{inr(lead.estimatedValue)}</span>}
                    </div>
                    <div className="meta">
                      {lead.segment && <Pill tone={STATUS_TONE[lead.status]}>{lead.segment}</Pill>}
                      {lead.nextFollowUpAt && <span className="followup">Follow up {relativeDays(lead.nextFollowUpAt)}</span>}
                    </div>
                    {canUpdate && NEXT_MOVES[lead.status].length > 0 && (
                      <div className="actions">
                        {NEXT_MOVES[lead.status].map((next) => (
                          <button key={next} className={`chip${next === 'lost' ? ' danger' : ''}`} onClick={() => requestMove(lead, next)}>
                            {next === 'lost' ? 'Mark lost' : `→ ${PIPELINE.find((p) => p.status === next)?.label}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {column.length === 0 && <div className="column-empty">No leads at this stage</div>}
              </div>
            );
          })}
        </div>
      )}

      {canCreate && viewport === 'phone' && <Fab label="New lead" onClick={() => setShowCreate(true)} />}
      {showCreate && <CreateLeadDialog onClose={() => setShowCreate(false)} onCreated={load} />}
      {lostFor && (
        <LostDialog
          lead={lostFor}
          onClose={() => setLostFor(null)}
          onConfirm={async (reason) => {
            await move(lostFor, 'lost', reason);
            setLostFor(null);
          }}
        />
      )}
    </>
  );
}

function LostDialog({ lead, onClose, onConfirm }: { lead: Lead; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="Mark lead as lost"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              setBusy(true);
              await onConfirm(reason.trim());
            }}
          >
            Mark lost
          </Button>
        </>
      }
    >
      <p className="muted">{lead.title}</p>
      <TextField label="Why was this lead lost?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus required />
    </Dialog>
  );
}

function CreateLeadDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ title: '', contactName: '', phone: '', city: '', segment: '', estimatedValue: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/crm/leads', {
        title: form.title,
        contactName: form.contactName,
        phone: form.phone || undefined,
        city: form.city || undefined,
        segment: form.segment || undefined,
        estimatedValue: form.estimatedValue || undefined,
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="New lead"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-lead" loading={busy}>Create lead</Button>
        </>
      }
    >
      <form id="create-lead" onSubmit={submit}>
        <TextField label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="3BHK interior fit-out, Anna Nagar" required autoFocus />
        <TextField label="Contact name" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} required autoComplete="off" />
        <TextField label="Phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <TextField label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <SelectField label="Segment" value={form.segment} onChange={(e) => set('segment', e.target.value)}>
          <option value="">Select…</option>
          <option value="interior">Interior</option>
          <option value="civil">Civil</option>
          <option value="commercial">Commercial</option>
          <option value="mep">MEP</option>
          <option value="fabrication">Fabrication</option>
        </SelectField>
        <TextField label="Estimated value (₹)" type="number" inputMode="numeric" min="0" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} />
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}
