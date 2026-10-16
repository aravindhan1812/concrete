import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [convertFor, setConvertFor] = useState<Lead | null>(null);

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
  const canConvert = can('crm.clients.manage');
  const stages = viewport === 'phone' ? PIPELINE.filter((p) => p.status === phoneStage) : PIPELINE;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={leads ? `${leads.length} in pipeline` : undefined}
        actions={
          canCreate && viewport !== 'phone' ? (
            <Button icon="plus" onClick={() => setShowCreate(true)}>
              New lead
            </Button>
          ) : undefined
        }
      />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}

      <div className="toolbar">
        <div className="search">
          <input
            type="search"
            placeholder="Search title, contact, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search leads"
          />
        </div>
      </div>

      {viewport === 'phone' && (
        <div className="stage-tabs" role="tablist" aria-label="Pipeline stage">
          {PIPELINE.map((p) => {
            const n = filtered.filter((l) => l.status === p.status).length;
            return (
              <button
                key={p.status}
                role="tab"
                aria-selected={phoneStage === p.status}
                className={`stage-tab${phoneStage === p.status ? ' active' : ''}`}
                onClick={() => setPhoneStage(p.status)}
              >
                {p.label} <span className="count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {leads && leads.length === 0 ? (
        <EmptyState
          icon="leads"
          title="No leads yet"
          body="Add your first enquiry to start the pipeline."
          action={
            canCreate ? (
              <Button icon="plus" onClick={() => setShowCreate(true)}>
                New lead
              </Button>
            ) : undefined
          }
        />
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
                    {lead.clientId ? (
                      <Link className="lead-client" to={`/crm/clients/${lead.clientId}`}>
                        Client linked →
                      </Link>
                    ) : (
                      canConvert &&
                      lead.status !== 'lost' && (
                        <button className="chip convert" onClick={() => setConvertFor(lead)}>
                          Convert to client
                        </button>
                      )
                    )}
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
      {convertFor && (
        <ConvertDialog
          lead={convertFor}
          onClose={() => setConvertFor(null)}
          onDone={async () => {
            setConvertFor(null);
            await load();
          }}
        />
      )}
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
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
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-lead" loading={busy}>
            Create lead
          </Button>
        </>
      }
    >
      <form id="create-lead" onSubmit={submit}>
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="3BHK interior fit-out, Anna Nagar"
          required
          autoFocus
        />
        <TextField
          label="Contact name"
          value={form.contactName}
          onChange={(e) => set('contactName', e.target.value)}
          required
          autoComplete="off"
        />
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
        <TextField
          label="Estimated value (₹)"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.estimatedValue}
          onChange={(e) => set('estimatedValue', e.target.value)}
        />
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}

interface ClientHit {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
}

/** Turn a lead into a client: create one from the lead's details, or link an existing client. */
function ConvertDialog({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState(lead.contactName);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [dups, setDups] = useState<ClientHit[]>([]);
  const [picked, setPicked] = useState<ClientHit | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams({ name: lead.contactName });
    if (lead.phone) qs.set('phone', lead.phone);
    if (lead.email) qs.set('email', lead.email);
    api
      .get<ClientHit[]>(`/crm/clients/duplicates?${qs}`)
      .then((d) => {
        setDups(d);
        if (d.length) setMode('existing');
      })
      .catch(() => undefined);
  }, [lead]);

  useEffect(() => {
    if (mode !== 'existing' || !search.trim()) return setHits([]);
    const t = window.setTimeout(() => {
      api
        .get<{ data: ClientHit[] }>(`/crm/clients?search=${encodeURIComponent(search.trim())}&pageSize=8`)
        .then((r) => setHits(r.data))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, mode]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/crm/leads/${lead.id}/convert`, mode === 'existing' ? { clientId: picked!.id } : { client: { name } });
      await onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const options = search.trim() ? hits : dups;
  return (
    <Dialog
      title="Convert to client"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={mode === 'existing' ? !picked : !name.trim()}>
            {mode === 'existing' ? 'Link client' : 'Create client'}
          </Button>
        </>
      }
    >
      <p className="muted">{lead.title}</p>
      <div className="segmented full" role="radiogroup" aria-label="Convert how">
        <button role="radio" aria-checked={mode === 'new'} className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>
          New client
        </button>
        <button
          role="radio"
          aria-checked={mode === 'existing'}
          className={mode === 'existing' ? 'active' : ''}
          onClick={() => setMode('existing')}
        >
          Existing client
        </button>
      </div>
      {mode === 'new' ? (
        <>
          <TextField
            label="Client name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Phone, email and city are copied from the lead; the contact becomes the primary contact."
          />
          {dups.length > 0 && (
            <Alert tone="warning">A client with the same name, phone or email already exists — consider linking it instead.</Alert>
          )}
        </>
      ) : (
        <>
          <TextField
            label="Find client"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, code, phone…"
            autoFocus
          />
          {!search.trim() && dups.length > 0 && <p className="muted small">Possible matches for this lead:</p>}
          <ul className="pick-list" role="listbox" aria-label="Clients">
            {options.map((c) => (
              <li key={c.id}>
                <button
                  role="option"
                  aria-selected={picked?.id === c.id}
                  className={picked?.id === c.id ? 'selected' : ''}
                  onClick={() => setPicked(c)}
                >
                  <span>{c.name}</span>
                  <span className="muted small">{[c.code, c.phone].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <Alert>{error}</Alert>}
    </Dialog>
  );
}
