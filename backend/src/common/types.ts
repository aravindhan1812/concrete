/** Who a login belongs to. Staff work inside the company; customers and vendors use the portals. */
export type UserKind = 'staff' | 'customer' | 'vendor';

/** Shape of the authenticated principal attached to every request. */
export interface AuthUser {
  userId: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  kind: UserKind;
  /** Set when kind === 'customer': every portal query is scoped to this customer. */
  customerId?: string;
  /** Set when kind === 'vendor': every portal query is scoped to this vendor. */
  vendorId?: string;
}

export function userKind(u: { customerId?: string | null; vendorId?: string | null }): UserKind {
  if (u.customerId) return 'customer';
  if (u.vendorId) return 'vendor';
  return 'staff';
}
