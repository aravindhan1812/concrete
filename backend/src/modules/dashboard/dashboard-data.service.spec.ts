import { DataSource } from 'typeorm';
import { ProjectScopeService } from '../../common/project-scope/project-scope.service';
import { AuthUser } from '../../common/types';
import { ApprovalsService } from '../approvals/approvals.service';
import { DashboardDataService } from './dashboard-data.service';

const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'u1',
  companyId: 'co-1',
  fullName: 'X',
  roles: [],
  permissions: [],
  kind: 'staff',
  dataScope: 'assigned_projects',
  ...over,
});

function setup(
  projectIds: string[] | null,
  rows: unknown[] = [{ active: '2', planned: '1', on_hold: '0', value: '5000000', progress: '42.5' }],
) {
  const query = jest.fn(async () => rows);
  const scope = { projectIds: jest.fn(async () => projectIds) } as unknown as ProjectScopeService;
  const svc = new DashboardDataService({ query } as unknown as DataSource, scope, {} as ApprovalsService);
  return { svc, query };
}

describe('DashboardDataService project scoping', () => {
  it('restricts project widgets to the user’s assigned projects', async () => {
    const { svc, query } = setup(['p1', 'p2']);
    const data = (await svc.load(user(), 'projects.summary')) as { items: { label: string; value: number }[] };
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('p.id = ANY($2::uuid[])');
    expect(params).toEqual(['co-1', ['p1', 'p2']]);
    expect(data.items.find((i) => i.label === 'Active projects')?.value).toBe(2);
  });

  it('a user with no assignments gets an empty filter, not every project', async () => {
    const { svc, query } = setup([], []);
    await svc.load(user(), 'projects.list');
    const [, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toEqual(['co-1', []]);
  });

  it('company-wide users are not filtered by project', async () => {
    const { svc, query } = setup(null);
    await svc.load(user({ dataScope: 'company' }), 'projects.summary');
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain('ANY(');
    expect(params).toEqual(['co-1']);
  });

  it('site issues are filtered on the issue’s project', async () => {
    const { svc, query } = setup(['p1'], []);
    await svc.load(user(), 'site.open_issues');
    const [sql] = query.mock.calls[0] as unknown as [string];
    expect(sql).toContain('i.project_id = ANY($2::uuid[])');
  });
});
