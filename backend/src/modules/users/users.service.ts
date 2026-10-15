import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { ILike, In, IsNull, Not, Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { Vendor } from '../../entities/vendor.entity';
import { userKind } from '../../common/types';
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from './dto/user.dto';

/** Company user administration: staff logins and external (customer / vendor) portal logins. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
  ) {}

  async findAll(companyId: string, q: QueryUsersDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const base: Record<string, unknown> = { companyId };
    if (q.kind === 'customer') base.customerId = Not(IsNull());
    if (q.kind === 'vendor') base.vendorId = Not(IsNull());
    if (q.kind === 'staff') {
      base.customerId = IsNull();
      base.vendorId = IsNull();
    }
    const where = q.search ? [{ ...base, fullName: ILike(`%${q.search}%`) }, { ...base, email: ILike(`%${q.search}%`) }] : [base];
    const [rows, total] = await this.users.findAndCount({
      where: where as never,
      order: { fullName: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data: rows.map((u) => this.publicUser(u)), total, page, pageSize };
  }

  async findOne(companyId: string, id: string) {
    const user = await this.users.findOne({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    return this.publicUser(user);
  }

  async create(companyId: string, dto: CreateUserDto) {
    this.assertSingleLink(dto);
    await this.assertLinkBelongsToCompany(companyId, dto);
    const exists = await this.users.findOne({ where: { companyId, email: dto.email } });
    if (exists) throw new ConflictException('A user with this email already exists');
    const roles = await this.resolveRoles(companyId, dto.roleIds);
    const user = await this.users.save(
      this.users.create({
        companyId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        branchId: dto.branchId,
        customerId: dto.customerId,
        vendorId: dto.vendorId,
        passwordHash: await bcrypt.hash(dto.password, 10),
        roles,
      }),
    );
    return this.publicUser(user);
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    const user = await this.users.findOne({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    // The external link is fixed at creation: converting a staff login into a portal login (or
    // moving it to another customer) is a new account, not an edit.
    if ((dto.customerId && dto.customerId !== user.customerId) || (dto.vendorId && dto.vendorId !== user.vendorId)) {
      throw new BadRequestException('customerId / vendorId cannot be changed after creation');
    }
    if (dto.roleIds) user.roles = await this.resolveRoles(companyId, dto.roleIds);
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.branchId !== undefined) user.branchId = dto.branchId;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.email && dto.email !== user.email) {
      const exists = await this.users.findOne({ where: { companyId, email: dto.email } });
      if (exists) throw new ConflictException('A user with this email already exists');
      user.email = dto.email;
    }
    return this.publicUser(await this.users.save(user));
  }

  async deactivate(companyId: string, id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException('You cannot deactivate your own account');
    const user = await this.users.findOne({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.users.save(user);
    return { ok: true };
  }

  private assertSingleLink(dto: { customerId?: string; vendorId?: string }) {
    if (dto.customerId && dto.vendorId) throw new BadRequestException('A user can be linked to a customer or a vendor, not both');
  }

  private async assertLinkBelongsToCompany(companyId: string, dto: { customerId?: string; vendorId?: string }) {
    if (dto.customerId) {
      const c = await this.customers.findOne({ where: { id: dto.customerId, companyId } });
      if (!c) throw new NotFoundException('Customer not found');
    }
    if (dto.vendorId) {
      const v = await this.vendors.findOne({ where: { id: dto.vendorId, companyId } });
      if (!v) throw new NotFoundException('Vendor not found');
    }
  }

  private async resolveRoles(companyId: string, roleIds: string[]) {
    const roles = await this.roles.find({ where: { id: In(roleIds), companyId } });
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException('One or more roles do not belong to this company');
    return roles;
  }

  private publicUser(u: User) {
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      branchId: u.branchId,
      kind: userKind(u),
      customerId: u.customerId ?? undefined,
      vendorId: u.vendorId ?? undefined,
      isActive: u.isActive,
      roles: (u.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }
}
