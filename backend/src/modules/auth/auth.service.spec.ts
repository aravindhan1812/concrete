import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { LedgerSetupService } from '../accounting/ledger-setup.service';
import { AuditService } from '../audit/audit.service';
import { Company } from '../../entities/company.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { AuthService } from './auth.service';

const repo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (x: unknown) => x),
  insert: jest.fn(),
  update: jest.fn(),
  create: jest.fn((x: unknown) => x),
});

describe('AuthService', () => {
  let service: AuthService;
  let users: ReturnType<typeof repo>;
  let refreshTokens: ReturnType<typeof repo>;

  const activeUser = async () => ({
    id: 'u1',
    companyId: 'co-1',
    email: 'owner@acme.in',
    fullName: 'Owner',
    isActive: true,
    passwordHash: await bcrypt.hash('secret123', 4),
    roles: [{ name: 'Company Owner', permissions: [{ code: 'crm.leads.read' }, { code: 'admin.roles.manage' }] }],
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: repo },
        { provide: getRepositoryToken(Company), useFactory: repo },
        { provide: getRepositoryToken(Role), useFactory: repo },
        { provide: getRepositoryToken(RefreshToken), useFactory: repo },
        { provide: JwtService, useValue: { signAsync: jest.fn(async () => 'signed.jwt') } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: unknown) => d) } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: LedgerSetupService, useValue: { bootstrap: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
    users = module.get(getRepositoryToken(User));
    refreshTokens = module.get(getRepositoryToken(RefreshToken));
  });

  it('login returns tokens and flattened permissions for a valid user', async () => {
    users.findOne.mockResolvedValue(await activeUser());
    const result = await service.login({ email: 'owner@acme.in', password: 'secret123' });
    expect(result.accessToken).toBe('signed.jwt');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.user.permissions).toEqual(
      expect.arrayContaining(['crm.leads.read', 'admin.roles.manage']),
    );
    expect(refreshTokens.insert).toHaveBeenCalled(); // hashed refresh token persisted
    expect(result.user.kind).toBe('staff');
  });

  it('login reports the broadest data scope across the user\'s roles', async () => {
    const u = await activeUser();
    users.findOne.mockResolvedValue({
      ...u,
      roles: [
        { name: 'Site Engineer', dataScope: 'assigned_projects', permissions: [] },
        { name: 'Store Manager', dataScope: 'company', permissions: [] },
      ],
    });
    expect((await service.login({ email: 'owner@acme.in', password: 'secret123' })).user.dataScope).toBe('company');
    users.findOne.mockResolvedValue({ ...u, roles: [{ name: 'Site Engineer', dataScope: 'assigned_projects', permissions: [] }] });
    expect((await service.login({ email: 'owner@acme.in', password: 'secret123' })).user.dataScope).toBe('assigned_projects');
  });

  it('login marks a vendor-linked user as kind=vendor and carries the vendorId', async () => {
    users.findOne.mockResolvedValue({ ...(await activeUser()), vendorId: 'ven-1' });
    const result = await service.login({ email: 'owner@acme.in', password: 'secret123' });
    expect(result.user.kind).toBe('vendor');
    expect(result.user.vendorId).toBe('ven-1');
  });

  it('login rejects a wrong password without revealing which field failed', async () => {
    users.findOne.mockResolvedValue(await activeUser());
    await expect(
      service.login({ email: 'owner@acme.in', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rejects an unknown token', async () => {
    refreshTokens.findOne.mockResolvedValue(null);
    await expect(service.refresh('bogus')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rotates: revokes the old token and issues a new pair', async () => {
    refreshTokens.findOne.mockResolvedValue({ id: 'rt1', userId: 'u1' });
    users.findOne.mockResolvedValue(await activeUser());
    const result = await service.refresh('old-token');
    expect(refreshTokens.update).toHaveBeenCalledWith('rt1', expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(result.accessToken).toBe('signed.jwt');
  });
});
