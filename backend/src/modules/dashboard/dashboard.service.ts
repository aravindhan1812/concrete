import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/types';
import { DashboardDataService } from './dashboard-data.service';
import { canSee, isKnownWidget, resolveLayout, UserLayoutItem, WIDGETS, WIDGETS_BY_KEY } from './widgets';

@Injectable()
export class DashboardService {
  constructor(
    private readonly ds: DataSource,
    private readonly data: DashboardDataService,
  ) {}

  async layout(user: AuthUser) {
    const roles: { name: string; dashboard_layout: string[] | null }[] = await this.ds.query(
      `SELECT r.name, r.dashboard_layout FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.company_id = $2 ORDER BY r.created_at, r.name`,
      [user.userId, user.companyId],
    );
    const own: { layout: UserLayoutItem[] }[] = await this.ds.query('SELECT layout FROM user_dashboard_layouts WHERE user_id = $1', [
      user.userId,
    ]);
    return resolveLayout(
      roles.map((r) => ({ name: r.name, dashboardLayout: r.dashboard_layout })),
      user.permissions,
      own[0]?.layout ?? null,
    );
  }

  /** Every live widget this user may add when customising. */
  catalog(user: AuthUser) {
    return WIDGETS.filter((w) => canSee(w, user.permissions));
  }

  async widgetData(user: AuthUser, key: string) {
    const def = WIDGETS_BY_KEY.get(key);
    if (!def) throw new NotFoundException(`Unknown widget ${key}`);
    if (!canSee(def, user.permissions)) throw new ForbiddenException('Your role cannot see this widget');
    return { key, generatedAt: new Date().toISOString(), data: await this.data.load(user, key) };
  }

  async saveLayout(user: AuthUser, items: UserLayoutItem[]) {
    const seen = new Set<string>();
    for (const item of items) {
      const def = WIDGETS_BY_KEY.get(item.key);
      if (!def) throw new BadRequestException(`Unknown widget ${item.key}`);
      if (!canSee(def, user.permissions)) throw new ForbiddenException(`Your role cannot see ${item.key}`);
      if (seen.has(item.key)) throw new BadRequestException(`Widget ${item.key} listed twice`);
      seen.add(item.key);
    }
    const layout = items.map((i) => ({ key: i.key, hidden: !!i.hidden }));
    await this.ds.query(
      `INSERT INTO user_dashboard_layouts (user_id, company_id, layout, updated_at) VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET layout = EXCLUDED.layout, updated_at = now()`,
      [user.userId, user.companyId, JSON.stringify(layout)],
    );
    return this.layout(user);
  }

  async resetLayout(user: AuthUser) {
    await this.ds.query('DELETE FROM user_dashboard_layouts WHERE user_id = $1', [user.userId]);
    return this.layout(user);
  }

  /** Admin: override a role's default layout (null restores the built-in default). Planned widget keys are allowed. */
  async setRoleLayout(companyId: string, roleId: string, widgets: string[] | null) {
    if (widgets) {
      const unknown = widgets.filter((k) => !isKnownWidget(k));
      if (unknown.length) throw new BadRequestException(`Unknown widgets: ${unknown.join(', ')}`);
      if (new Set(widgets).size !== widgets.length) throw new BadRequestException('A widget is listed twice');
    }
    const res: unknown[] = await this.ds.query(
      'UPDATE roles SET dashboard_layout = $3::jsonb WHERE id = $1 AND company_id = $2 RETURNING id, name, dashboard_layout',
      [roleId, companyId, widgets ? JSON.stringify(widgets) : null],
    );
    const rows = Array.isArray(res[0]) ? (res[0] as unknown[]) : res;
    if (!rows.length) throw new NotFoundException('Role not found');
    return rows[0];
  }
}
