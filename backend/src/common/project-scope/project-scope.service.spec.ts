import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser, broadestScope } from '../types';
import { ProjectScopeService } from './project-scope.service';

const user = (over: Partial<AuthUser>): AuthUser => ({
  userId: 'u1',
  companyId: 'co-1',
  fullName: 'X',
  roles: [],
  permissions: [],
  kind: 'staff',
  dataScope: 'assigned_projects',
  ...over,
});

function serviceWith(handler: (sql: string, params: unknown[]) => unknown[]) {
  const query = jest.fn(async (sql: string, params: unknown[]) => handler(sql, params));
  return { svc: new ProjectScopeService({ query } as unknown as DataSource), query };
}

describe('ProjectScopeService', () => {
  it('company-wide staff are not restricted', async () => {
    const { svc, query } = serviceWith(() => []);
    expect(await svc.projectIds(user({ dataScope: 'company' }))).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('site staff see only the projects they are members of', async () => {
    const { svc, query } = serviceWith(() => [{ project_id: 'p1' }, { project_id: 'p2' }]);
    expect(await svc.projectIds(user({}))).toEqual(['p1', 'p2']);
    expect(query.mock.calls[0][1]).toEqual(['u1', 'co-1']);
  });

  it('a client login sees its own projects only', async () => {
    const { svc, query } = serviceWith(() => [{ id: 'p9' }]);
    expect(await svc.projectIds(user({ kind: 'client', clientId: 'cl-1', dataScope: 'own_records' }))).toEqual(['p9']);
    expect(query.mock.calls[0][1]).toEqual(['co-1', 'cl-1']);
  });

  it('vendor logins see no projects through project scope', async () => {
    const { svc } = serviceWith(() => [{ project_id: 'p1' }]);
    expect(await svc.projectIds(user({ kind: 'vendor', vendorId: 'v1', dataScope: 'own_records' }))).toEqual([]);
  });

  it('a portal login can never get company-wide scope, even if a role is misconfigured', async () => {
    const { svc } = serviceWith(() => []);
    expect(await svc.projectIds(user({ kind: 'vendor', dataScope: 'company' }))).toEqual([]);
  });

  it('assertProject rejects projects outside the assignment with NotFound', async () => {
    const { svc } = serviceWith(() => [{ project_id: 'p1' }]);
    await expect(svc.assertProject(user({}), 'p1')).resolves.toBeUndefined();
    await expect(svc.assertProject(user({}), 'p2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assertProject still checks the tenant for company-wide users', async () => {
    const { svc } = serviceWith(() => []);
    await expect(svc.assertProject(user({ dataScope: 'company' }), 'p-other-co')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('broadestScope', () => {
  it('picks the widest scope across a user’s roles', () => {
    expect(broadestScope(['assigned_projects', 'company'])).toBe('company');
    expect(broadestScope(['own_records', 'assigned_projects'])).toBe('assigned_projects');
    expect(broadestScope([])).toBe('own_records');
  });
});
