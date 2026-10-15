/** Who a login belongs to. Staff work inside the company; clients and vendors use the portals. */
export type UserKind = 'staff' | 'client' | 'vendor';

/**
 * Which records a user sees (docs/ROLES.md). A user with several roles gets the broadest scope.
 *  company            everything in the company
 *  assigned_projects  only projects they are a member of (project_members)
 *  own_records        only records linked to their client / vendor (portal logins)
 */
export type DataScope = 'company' | 'assigned_projects' | 'own_records';
export const SCOPE_RANK: Record<DataScope, number> = { own_records: 0, assigned_projects: 1, company: 2 };

export function broadestScope(scopes: DataScope[]): DataScope {
  return scopes.reduce<DataScope>((best, s) => (SCOPE_RANK[s] > SCOPE_RANK[best] ? s : best), 'own_records');
}

/** Shape of the authenticated principal attached to every request. */
export interface AuthUser {
  userId: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  kind: UserKind;
  dataScope: DataScope;
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
