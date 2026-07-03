import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
  ) {}

  listPermissions() {
    return this.permissions.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  listRoles(companyId: string) {
    return this.roles.find({ where: { companyId }, order: { name: 'ASC' } });
  }

  async createRole(companyId: string, name: string, description?: string) {
    const exists = await this.roles.findOne({ where: { companyId, name } });
    if (exists) throw new BadRequestException(`Role "${name}" already exists`);
    return this.roles.save(this.roles.create({ companyId, name, description, permissions: [] }));
  }

  /** Replaces the role's permission set — this is what makes every permission configurable. */
  async setRolePermissions(companyId: string, roleId: string, permissionCodes: string[]) {
    const role = await this.roles.findOne({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Role not found');
    role.permissions = permissionCodes.length
      ? await this.permissions.find({ where: { code: In(permissionCodes) } })
      : [];
    return this.roles.save(role);
  }
}
