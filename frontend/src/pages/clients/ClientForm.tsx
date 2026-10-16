import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Dialog, SelectField, TextArea, TextField } from '../../components/ui';
import { api } from '../../lib/api';
import { ClientDetail } from './types';

interface Props {
  client?: ClientDetail;
  onClose: () => void;
  onSaved: (client: { id: string }) => void;
}

interface Dup {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
}

/** Create / edit a client. GSTIN is checked as it is entered and fills in state and PAN. */
export default function ClientForm({ client, onClose, onSaved }: Props) {
  const editing = !!client;
  const [states, setStates] = useState<{ code: string; name: string }[]>([]);
  const [f, setF] = useState({
    name: client?.name ?? '',
    type: client?.type ?? 'individual',
    gstin: client?.gstin ?? '',
    pan: client?.pan ?? '',
    stateCode: client?.stateCode ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    line1: client?.billingAddress?.line1 ?? '',
    line2: client?.billingAddress?.line2 ?? '',
    city: client?.billingAddress?.city ?? '',
    state: client?.billingAddress?.state ?? '',
    pincode: client?.billingAddress?.pincode ?? '',
    creditLimit: client?.creditLimit != null ? String(client.creditLimit) : '',
    creditDays: client?.creditDays != null ? String(client.creditDays) : '',
    paymentTerms: client?.paymentTerms ?? '',
    notes: client?.notes ?? '',
    contactName: '',
    contactDesignation: '',
    contactPhone: '',
  });
  const [gstInfo, setGstInfo] = useState<{ stateName?: string; pan?: string; error?: string } | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ code: string; name: string }[]>('/crm/gst/states')
      .then(setStates)
      .catch(() => undefined);
  }, []);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  // PAN and state come from a validated GSTIN, so they are locked only once it has been checked.
  const gstValid = !!f.gstin && !!gstInfo && !gstInfo.error;

  async function checkGstin() {
    const g = f.gstin.trim();
    if (!g) return setGstInfo(null);
    try {
      const r = await api.get<{ gstin?: string; stateCode?: string; stateName?: string; pan?: string; error?: string }>(
        `/crm/gst/validate/${encodeURIComponent(g)}`,
      );
      setGstInfo(r);
      if (!r.error)
        setF((x) => ({ ...x, gstin: r.gstin!, stateCode: r.stateCode!, pan: r.pan!, type: 'business', state: x.state || r.stateName! }));
    } catch {
      setGstInfo(null);
    }
    void checkDups();
  }

  async function checkDups() {
    if (editing) return;
    const qs = new URLSearchParams();
    if (f.name.trim().length >= 3) qs.set('name', f.name.trim());
    if (f.phone.trim()) qs.set('phone', f.phone.trim());
    if (f.email.trim()) qs.set('email', f.email.trim());
    if (f.gstin.trim()) qs.set('gstin', f.gstin.trim());
    if (![...qs.keys()].length) return setDups([]);
    try {
      setDups(await api.get<Dup[]>(`/crm/clients/duplicates?${qs}`));
    } catch {
      setDups([]);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const address = { line1: f.line1, line2: f.line2, city: f.city, state: f.state, pincode: f.pincode };
    const hasAddress = Object.values(address).some((v) => v.trim());
    const body = {
      name: f.name,
      type: f.type,
      gstin: f.gstin.trim() || (editing ? '' : undefined),
      pan: f.pan.trim() || (editing ? '' : undefined),
      stateCode: f.gstin.trim() ? undefined : f.stateCode || (editing ? '' : undefined),
      phone: f.phone.trim() || (editing ? '' : undefined),
      email: f.email.trim() || undefined,
      billingAddress: hasAddress ? address : editing ? null : undefined,
      creditLimit: f.creditLimit === '' ? (editing ? null : undefined) : Number(f.creditLimit),
      creditDays: f.creditDays === '' ? (editing ? null : undefined) : Number(f.creditDays),
      paymentTerms: f.paymentTerms || undefined,
      notes: f.notes || undefined,
      primaryContact:
        !editing && f.contactName.trim()
          ? { name: f.contactName, designation: f.contactDesignation || undefined, phone: f.contactPhone || undefined }
          : undefined,
    };
    try {
      const saved = editing
        ? await api.patch<{ id: string }>(`/crm/clients/${client!.id}`, body)
        : await api.post<{ id: string }>('/crm/clients', body);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={editing ? `Edit ${client!.name}` : 'New client'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={busy}>
            {editing ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="form-grid">
        <fieldset>
          <legend>Client</legend>
          <TextField
            label="Name"
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={checkDups}
            required
            autoFocus
            placeholder="Company or person"
          />
          <SelectField label="Type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </SelectField>
          <TextField
            label="Phone"
            type="tel"
            inputMode="tel"
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            onBlur={checkDups}
          />
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            value={f.email}
            onChange={(e) => set('email', e.target.value)}
            onBlur={checkDups}
          />
        </fieldset>

        {dups.length > 0 && (
          <Alert tone="warning">
            Possible duplicate:{' '}
            {dups.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ', '}
                <Link to={`/crm/clients/${d.id}`} onClick={onClose}>
                  {d.code ? `${d.code} · ` : ''}
                  {d.name}
                </Link>
              </span>
            ))}
            . Check before creating a new one.
          </Alert>
        )}

        <fieldset>
          <legend>GST</legend>
          <TextField
            label="GSTIN"
            value={f.gstin}
            onChange={(e) => {
              set('gstin', e.target.value.toUpperCase());
              setGstInfo(null);
            }}
            onBlur={checkGstin}
            maxLength={15}
            placeholder="15 characters, optional for individuals"
            error={gstInfo?.error}
            hint={gstInfo && !gstInfo.error ? `${gstInfo.stateName} · PAN ${gstInfo.pan}` : undefined}
            autoCapitalize="characters"
          />
          <TextField
            label="PAN"
            value={f.pan}
            onChange={(e) => set('pan', e.target.value.toUpperCase())}
            maxLength={10}
            disabled={gstValid}
            autoCapitalize="characters"
          />
          <SelectField
            label="State (place of supply)"
            value={f.stateCode}
            onChange={(e) => set('stateCode', e.target.value)}
            disabled={gstValid}
            hint="Decides CGST + SGST or IGST on invoices"
          >
            <option value="">Select…</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.name}
              </option>
            ))}
          </SelectField>
        </fieldset>

        <fieldset>
          <legend>Billing address</legend>
          <TextField label="Address line 1" value={f.line1} onChange={(e) => set('line1', e.target.value)} />
          <TextField label="Address line 2" value={f.line2} onChange={(e) => set('line2', e.target.value)} />
          <div className="field-row">
            <TextField label="City" value={f.city} onChange={(e) => set('city', e.target.value)} />
            <TextField
              label="PIN code"
              inputMode="numeric"
              maxLength={6}
              value={f.pincode}
              onChange={(e) => set('pincode', e.target.value)}
            />
          </div>
          <TextField label="State" value={f.state} onChange={(e) => set('state', e.target.value)} />
        </fieldset>

        <fieldset>
          <legend>Credit</legend>
          <div className="field-row">
            <TextField
              label="Credit limit (₹)"
              type="number"
              inputMode="numeric"
              min="0"
              value={f.creditLimit}
              onChange={(e) => set('creditLimit', e.target.value)}
              hint="Leave empty for no limit"
            />
            <TextField
              label="Credit days"
              type="number"
              inputMode="numeric"
              min="0"
              max="365"
              value={f.creditDays}
              onChange={(e) => set('creditDays', e.target.value)}
            />
          </div>
          <TextField
            label="Payment terms"
            value={f.paymentTerms}
            onChange={(e) => set('paymentTerms', e.target.value)}
            placeholder="e.g. 30% advance, balance against RA bills"
          />
        </fieldset>

        {!editing && (
          <fieldset>
            <legend>Primary contact</legend>
            <TextField label="Contact name" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
            <div className="field-row">
              <TextField label="Designation" value={f.contactDesignation} onChange={(e) => set('contactDesignation', e.target.value)} />
              <TextField
                label="Contact phone"
                type="tel"
                inputMode="tel"
                value={f.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            </div>
          </fieldset>
        )}

        <fieldset className="span-2">
          <TextArea label="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </fieldset>
        {error && <Alert>{error}</Alert>}
      </form>
    </Dialog>
  );
}
