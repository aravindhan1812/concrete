/** Who a login belongs to. Staff work inside the company; clients and vendors use the portals. */
export type UserKind = 'staff' | 'client' | 'vendor';

/** Shape of the authenticated principal attached to every request. */
export interface AuthUser {
  userId: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  kind: UserKind;
  /** Set when kind === 'client': every portal query is scoped to this client. */
  clientId?: string;
  /** Set when kind === 'vendor': every portal query is scoped to this vendor. */
  vendorId?: string;
}

export function userKind(u: { clientId?: string | null; vendorId?: string | null }): UserKind {
  if (u.clientId) return 'client';
  if (u.vendorId) return 'vendor';
  return 'staff';
}
