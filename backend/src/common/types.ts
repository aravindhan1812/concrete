/** Shape of the authenticated principal attached to every request. */
export interface AuthUser {
  userId: string;
  companyId: string;
  email?: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}
