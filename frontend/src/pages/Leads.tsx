import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Lead, LeadStatus, NEXT_MOVES, PIPELINE } from '../lib/types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

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

  async function move(lead: Lead, status: LeadStatus) {
    let lostReason: string | undefined;
    if (status === 'lost') {
      lostReason = window.prompt('Why was this lead lost?') ?? undefined;
      if (!lostReason) return;
    }
    try {
      await api.patch(`/crm/leads/${lead.id}/status`, { status, lostReason });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Leads</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>New lead</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="board">
        {PIPELINE.map(({ status, label }) => {
          const column = leads.filter((l) => l.status === status);
          return (
            <div className="column" key={status}>
              <h3>
                {label} <span className="count">{column.length}</span>
              </h3>
              {column.map((lead) => (
                <div className="card" key={lead.id}>
                  <div className="title">{lead.title}</div>
                  <div className="meta">
                    <span>{lead.contactName}{lead.city ? ` · ${lead.city}` : ''}</span>
                    {lead.estimatedValue && <span className="value">{inr.format(Number(lead.estimatedValue))}</span>}
                  </div>
                  {NEXT_MOVES[lead.status].length > 0 && (
                    <div className="actions">
                      {NEXT_MOVES[lead.status].map((next) => (
                        <button key={next} className="chip" onClick={() => move(lead, next)}>
                          → {PIPELINE.find((p) => p.status === next)?.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {column.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: '4px 6px' }}>No leads here yet</div>
              )}
            </div>
          );
        })}
      </div>
      {showCreate && <CreateLeadDialog onClose={() => setShowCreate(false)} onCreated={load} />}
    </>
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
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>New lead</h2>
        <div className="field">
          <label htmlFor="lt">Title</label>
          <input id="lt" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="3BHK interior fit-out, Anna Nagar" required />
        </div>
        <div className="field">
          <label htmlFor="lc">Contact name</label>
          <input id="lc" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="lp">Phone</label>
          <input id="lp" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lcity">City</label>
          <input id="lcity" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lseg">Segment</label>
          <select id="lseg" value={form.segment} onChange={(e) => set('segment', e.target.value)}>
            <option value="">Select…</option>
            <option value="interior">Interior</option>
            <option value="civil">Civil</option>
            <option value="commercial">Commercial</option>
            <option value="mep">MEP</option>
            <option value="fabrication">Fabrication</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="lval">Estimated value (₹)</label>
          <input id="lval" type="number" min="0" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Create lead'}</button>
        </div>
      </form>
    </div>
  );
}
