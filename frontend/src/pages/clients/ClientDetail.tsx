import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icons } from '../../app/icons';
import Attachments from '../../components/Attachments';
import Comments from '../../components/Comments';
import { Alert, Button, Dialog, IconButton, PageHeader, Pill, TextField } from '../../components/ui';
import { api } from '../../lib/api';
import { date, inr } from '../../lib/format';
import { useSession } from '../../lib/session';
import { CREDIT_TONE } from './ClientsList';
import ClientForm from './ClientForm';
import { ClientDetail as Detail, Contact, CREDIT_LABEL, formatAddress, formatPhone } from './types';

const LEAD_STATUS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  site_visit: 'Site visit',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useSession();
  const [client, setClient] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [contactEdit, setContactEdit] = useState<Contact | 'new' | null>(null);
  const canManage = can('crm.clients.manage');

  const load = useCallback(() => {
    api
      .get<Detail>(`/crm/clients/${id}`)
      .then(setClient)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function toggleActive() {
    if (!client) return;
    try {
      await api.patch(`/crm/clients/${client.id}`, { isActive: !client.isActive });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    if (!client || !window.confirm(`Delete ${client.name}? This cannot be undone from the app.`)) return;
    try {
      await api.del(`/crm/clients/${client.id}`);
      navigate('/crm/clients');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function makePrimary(c: Contact) {
    await api.patch(`/crm/clients/${client!.id}/contacts/${c.id}`, { isPrimary: true }).catch((e: Error) => setError(e.message));
    load();
  }

  async function removeContact(c: Contact) {
    if (!window.confirm(`Remove ${c.name}?`)) return;
    await api.del(`/crm/clients/${client!.id}/contacts/${c.id}`).catch((e: Error) => setError(e.message));
    load();
  }

  if (!client)
    return (
      <>
        <Link to="/crm/clients" className="back-link">
          <Icons.chevronLeft width={18} height={18} /> Clients
        </Link>
        {error ? <Alert>{error}</Alert> : <div className="skeleton sk-table" />}
      </>
    );

  const credit = client.credit;
  const address = formatAddress(client.billingAddress);

  return (
    <>
      <Link to="/crm/clients" className="back-link">
        <Icons.chevronLeft width={18} height={18} /> Clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[client.code, client.type === 'business' ? 'Business' : 'Individual', client.isActive ? null : 'Inactive']
          .filter(Boolean)
          .join(' · ')}
        actions={
          canManage && (
            <>
              <Button variant="secondary" size="sm" onClick={toggleActive}>
                {client.isActive ? 'Mark inactive' : 'Mark active'}
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )
        }
      />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}

      <div className="detail-grid">
        <section className="widget">
          <header className="widget-head">
            <h2>Details</h2>
          </header>
          <dl className="facts">
            <div>
              <dt>Phone</dt>
              <dd>{client.phone ? <a href={`tel:${client.phone}`}>{formatPhone(client.phone)}</a> : '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
            </div>
            <div>
              <dt>GSTIN</dt>
              <dd className="mono">{client.gstin ?? '—'}</dd>
            </div>
            <div>
              <dt>PAN</dt>
              <dd className="mono">{client.pan ?? '—'}</dd>
            </div>
            <div>
              <dt>Place of supply</dt>
              <dd>{client.stateName ? `${client.stateCode} · ${client.stateName}` : '—'}</dd>
            </div>
            <div>
              <dt>Payment terms</dt>
              <dd>{client.paymentTerms ?? '—'}</dd>
            </div>
            <div className="span-2">
              <dt>Billing address</dt>
              <dd>{address || '—'}</dd>
            </div>
            {client.siteAddresses.length > 0 && (
              <div className="span-2">
                <dt>Sites</dt>
                <dd>
                  {client.siteAddresses.map((s) => (
                    <div key={s.label}>
                      <strong>{s.label}</strong>
                      {formatAddress(s) ? ` — ${formatAddress(s)}` : ''}
                    </div>
                  ))}
                </dd>
              </div>
            )}
            {client.notes && (
              <div className="span-2">
                <dt>Notes</dt>
                <dd className="pre">{client.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        {credit && (
          <section className="widget">
            <header className="widget-head">
              <h2>Credit</h2>
              {credit.status !== 'no_limit' && <Pill tone={CREDIT_TONE[credit.status]}>{CREDIT_LABEL[credit.status]}</Pill>}
            </header>
            <div className="credit-figure">
              <span className="credit-amount">{inr(credit.outstanding)}</span>
              <span className="credit-of">
                {credit.limit != null ? `outstanding of ${inr(credit.limit)} limit` : 'outstanding · no limit set'}
              </span>
            </div>
            {credit.limit != null && credit.limit > 0 && (
              <div
                className={`meter ${credit.status}`}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.max(0, Math.min(100, credit.utilisation ?? 0))}
                aria-label={`Credit used: ${(credit.utilisation ?? 0).toFixed(1)}%`}
              >
                <span style={{ width: `${Math.max(0, Math.min(100, credit.utilisation ?? 0))}%` }} />
              </div>
            )}
            <dl className="facts compact">
              <div>
                <dt>Receivable</dt>
                <dd className="num">{inr(credit.receivable)}</dd>
              </div>
              <div>
                <dt>Advance held</dt>
                <dd className="num">{inr(credit.advance)}</dd>
              </div>
              <div>
                <dt>Used</dt>
                <dd className="num">{credit.utilisation != null ? `${credit.utilisation.toFixed(1)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Credit days</dt>
                <dd>{credit.creditDays ?? '—'}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="widget">
          <header className="widget-head">
            <h2>Contacts</h2>
            {canManage && (
              <Button variant="ghost" size="sm" icon="plus" onClick={() => setContactEdit('new')}>
                Add
              </Button>
            )}
          </header>
          {client.contacts.length === 0 && <div className="widget-empty">No contacts yet.</div>}
          <ul className="contact-list">
            {client.contacts.map((c) => (
              <li key={c.id}>
                <div className="contact-main">
                  <span className="contact-name">
                    {c.name} {c.isPrimary && <Pill tone="info">Primary</Pill>}
                  </span>
                  <span className="contact-meta">{[c.designation, formatPhone(c.phone), c.email].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="contact-actions">
                  {c.phone && (
                    <a className="icon-btn" href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}>
                      <Icons.phone width={18} height={18} />
                    </a>
                  )}
                  {canManage && !c.isPrimary && (
                    <button className="btn ghost sm" onClick={() => makePrimary(c)}>
                      Make primary
                    </button>
                  )}
                  {canManage && <IconButton icon="edit" label={`Edit ${c.name}`} onClick={() => setContactEdit(c)} />}
                  {canManage && <IconButton icon="close" label={`Remove ${c.name}`} onClick={() => removeContact(c)} />}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="widget">
          <header className="widget-head">
            <h2>Projects</h2>
          </header>
          {client.projects.length === 0 ? (
            <div className="widget-empty">No projects yet. A project is created when a quotation is won.</div>
          ) : (
            <table className="mini-table">
              <tbody>
                {client.projects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.code ? `${p.code} · ${p.name}` : p.name}</td>
                    <td>{p.status.replace('_', ' ')}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {p.contractValue != null ? inr(p.contractValue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {client.leads.length > 0 && (
            <>
              <h3 className="subhead">Leads</h3>
              <table className="mini-table">
                <tbody>
                  {client.leads.map((l) => (
                    <tr key={l.id}>
                      <td>{l.code ? `${l.code} · ${l.title}` : l.title}</td>
                      <td>{LEAD_STATUS[l.status] ?? l.status}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {date(l.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="widget">
          <header className="widget-head">
            <h2>Files</h2>
          </header>
          <Attachments entityType="client" entityId={client.id} canUpload={canManage} />
        </section>

        <section className="widget">
          <header className="widget-head">
            <h2>Comments</h2>
          </header>
          <Comments entityType="client" entityId={client.id} />
        </section>
      </div>

      {canManage && (
        <div className="danger-zone">
          <button className="btn ghost sm danger-text" onClick={remove}>
            Delete client
          </button>
        </div>
      )}

      {editing && (
        <ClientForm
          client={client}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}
      {contactEdit && (
        <ContactDialog
          clientId={client.id}
          contact={contactEdit === 'new' ? undefined : contactEdit}
          onClose={() => setContactEdit(null)}
          onSaved={() => {
            setContactEdit(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ContactDialog({
  clientId,
  contact,
  onClose,
  onSaved,
}: {
  clientId: string;
  contact?: Contact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: contact?.name ?? '',
    designation: contact?.designation ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: f.name, designation: f.designation || undefined, phone: f.phone || undefined, email: f.email || undefined };
      if (contact) await api.patch(`/crm/clients/${clientId}/contacts/${contact.id}`, body);
      else await api.post(`/crm/clients/${clientId}/contacts`, body);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={contact ? `Edit ${contact.name}` : 'Add contact'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="contact-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit}>
        <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus />
        <TextField
          label="Designation"
          value={f.designation}
          onChange={(e) => setF({ ...f, designation: e.target.value })}
          placeholder="Owner, architect, site in-charge, accounts…"
        />
        <TextField label="Phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <TextField label="Email" type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}
