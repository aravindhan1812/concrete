export type LeadStatus = 'new' | 'contacted' | 'site_visit' | 'quotation' | 'negotiation' | 'won' | 'lost';

export interface Lead {
  id: string;
  code?: string;
  title: string;
  contactName: string;
  phone?: string;
  city?: string;
  segment?: string;
  estimatedValue?: string;
  status: LeadStatus;
  nextFollowUpAt?: string;
  /** Set once the lead is converted to (or linked with) a client. */
  clientId?: string | null;
  email?: string;
}

export const PIPELINE: { status: LeadStatus; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'site_visit', label: 'Site visit' },
  { status: 'quotation', label: 'Quotation' },
  { status: 'negotiation', label: 'Negotiation' },
  { status: 'won', label: 'Won' },
  { status: 'lost', label: 'Lost' },
];

export const NEXT_MOVES: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['site_visit', 'quotation', 'lost'],
  site_visit: ['quotation', 'lost'],
  quotation: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
};
