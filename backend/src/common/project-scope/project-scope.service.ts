import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../types';

/**
 * Which projects a user may see, from their data scope (docs/ROLES.md):
 *  - company            → no restriction (null)
 *  - assigned_projects  → projects they are a member of
 *  - own_records        → a client login sees its client's projects; other portal logins none
 *
 * Every project-level module filters lists with `projectIds()` and guards single records with
 * `assertProject()`, exactly like `companyId` is threaded through every service today.
 */
@Injectable()
export class ProjectScopeService {
  constructor(private readonly dataSource: DataSource) {}

  /** null = every project in the company; otherwise the allowed project ids (possibly empty). */
  async projectIds(user: AuthUser): Promise<string[] | null> {
    if (user.dataScope === 'company' && user.kind === 'staff') return null;
    if (user.kind === 'client' && user.clientId) {
      const rows: { id: string }[] = await this.dataSource.query(
        'SELECT id FROM projects WHERE company_id = $1 AND client_id = $2 AND deleted_at IS NULL',
        [user.companyId, user.clientId],
      );
      return rows.map((r) => r.id);
    }
    if (user.kind !== 'staff') return [];
    const rows: { project_id: string }[] = await this.dataSource.query(
      `SELECT pm.project_id FROM project_members pm JOIN projects p ON p.id = pm.project_id
       WHERE pm.user_id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL`,
      [user.userId, user.companyId],
    );
    return rows.map((r) => r.project_id);
  }

  /** Throws NotFound (not Forbidden, so ids of other projects are not confirmed to exist). */
  async assertProject(user: AuthUser, projectId: string): Promise<void> {
    const allowed = await this.projectIds(user);
    if (allowed === null) {
      const rows: unknown[] = await this.dataSource.query('SELECT 1 FROM projects WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [projectId, user.companyId]);
      if (rows.length) return;
    } else if (allowed.includes(projectId)) {
      return;
    }
    throw new NotFoundException('Project not found');
  }
}

@Global()
@Module({ providers: [ProjectScopeService], exports: [ProjectScopeService] })
export class ProjectScopeModule {}
