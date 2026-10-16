export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}
export interface SiteAddress extends Address {
  label: string;
}

export interface ClientCredit {
  receivable: number;
  advance: number;
  outstanding: number;
  limit: number | null;
  utilisation: number | null;
  status: 'no_limit' | 'ok' | 'near' | 'over';
  creditDays: number | null;
}

export interface ClientRow {
  id: string;
  code: string | null;
  name: string;
  type: 'individual' | 'business';
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  primaryContact: string | null;
  projectCount: number;
  credit: ClientCredit | null;
}

export interface Contact {
  id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
}

export interface ClientDetail {
  id: string;
  code: string | null;
  name: string;
  type: 'individual' | 'business';
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  stateName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: Address | null;
  siteAddresses: SiteAddress[];
  creditLimit: number | null;
  creditDays: number | null;
  paymentTerms: string | null;
  notes: string | null;
  sourceLeadId: string | null;
  isActive: boolean;
  contacts: Contact[];
  leads: { id: string; code: string | null; title: string; status: string; estimatedValue: number | null; createdAt: string }[];
  projects: { id: string; code: string | null; name: string; status: string; contractValue: number | null; progress: number }[];
  credit: ClientCredit | null;
}

export const CREDIT_LABEL: Record<ClientCredit['status'], string> = {
  no_limit: 'No limit',
  ok: 'Within limit',
  near: 'Near limit',
  over: 'Over limit',
};

export function formatAddress(a: Address | null | undefined) {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
}

/** +919840012345 → +91 98400 12345 */
export function formatPhone(p: string | null | undefined) {
  if (!p) return '';
  const m = /^\+91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}
