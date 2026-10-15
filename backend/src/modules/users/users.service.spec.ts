import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer } from '../../entities/customer.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { Vendor } from '../../entities/vendor.entity';
import { UsersService } from './users.service';

const repo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(async (x: unknown) => ({ id: 'new', ...(x as object) })),
  create: jest.fn((x: unknown) => x),
});

describe('UsersService', () => {
  let service: UsersService;
  let users: ReturnType<typeof repo>;
  let roles: ReturnType<typeof repo>;
  let customers: ReturnType<typeof repo>;
  let vendors: ReturnType<typeof repo>;

  const base = { fullName: 'Priya', email: 'priya@client.in', password: 'secret123', roleIds: ['r-client'] };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: repo },
        { provide: getRepositoryToken(Role), useFactory: repo },
        { provide: getRepositoryToken(Customer), useFactory: repo },
        { provide: getRepositoryToken(Vendor), useFactory: repo },
      ],
    }).compile();
    service = module.get(UsersService);
    users = module.get(getRepositoryToken(User));
    roles = module.get(getRepositoryToken(Role));
    customers = module.get(getRepositoryToken(Customer));
    vendors = module.get(getRepositoryToken(Vendor));
    roles.find.mockResolvedValue([{ id: 'r-client', name: 'Client', companyId: 'co-1' }]);
    users.findOne.mockResolvedValue(null);
  });

  it('creates a customer-linked login and reports kind=customer', async () => {
    customers.findOne.mockResolvedValue({ id: 'cust-1', companyId: 'co-1' });
    const result = await service.create('co-1', { ...base, customerId: 'cust-1' });
    expect(result.kind).toBe('customer');
    expect(result.customerId).toBe('cust-1');
    expect(customers.findOne).toHaveBeenCalledWith({ where: { id: 'cust-1', companyId: 'co-1' } });
  });

  it('rejects linking one login to both a customer and a vendor', async () => {
    await expect(service.create('co-1', { ...base, customerId: 'cust-1', vendorId: 'ven-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a customer that belongs to another company (tenant isolation)", async () => {
    customers.findOne.mockResolvedValue(null);
    await expect(service.create('co-1', { ...base, customerId: 'cust-other' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a vendor that belongs to another company", async () => {
    vendors.findOne.mockResolvedValue(null);
    await expect(service.create('co-1', { ...base, vendorId: 'ven-other' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects roles from another company', async () => {
    roles.find.mockResolvedValue([]);
    await expect(service.create('co-1', base)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('staff logins have kind=staff', async () => {
    roles.find.mockResolvedValue([{ id: 'r-pm', name: 'Project Manager', companyId: 'co-1' }]);
    const result = await service.create('co-1', { ...base, roleIds: ['r-pm'] });
    expect(result.kind).toBe('staff');
    expect(result.customerId).toBeUndefined();
  });

  it('does not allow re-pointing an existing login at a different customer', async () => {
    users.findOne.mockResolvedValue({ id: 'u1', companyId: 'co-1', customerId: 'cust-1', roles: [] });
    await expect(service.update('co-1', 'u1', { customerId: 'cust-2' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to deactivate your own account', async () => {
    await expect(service.deactivate('co-1', 'me', 'me')).rejects.toBeInstanceOf(BadRequestException);
  });
});
