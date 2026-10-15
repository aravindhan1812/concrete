import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { Role } from '../../entities/role.entity';
import { DataScope } from '../../common/types';

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

  async createRole(companyId: string, name: string, description?: string, dataScope: DataScope = 'assigned_projects') {
    const exists = await this.roles.findOne({ where: { companyId, name } });
    if (exists) throw new BadRequestException(`Role "${name}" already exists`);
    return this.roles.save(this.roles.create({ companyId, name, description, dataScope, permissions: [] }));
  }

  /** Rename, describe or change which records the role sees. */
  async updateRole(companyId: string, roleId: string, patch: { name?: string; description?: string; dataScope?: DataScope }) {
    const role = await this.roles.findOne({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException('Role not found');
    if (patch.name && patch.name !== role.name) {
      if (await this.roles.findOne({ where: { companyId, name: patch.name } })) throw new BadRequestException(`Role "${patch.name}" already exists`);
      role.name = patch.name;
    }
    if (patch.description !== undefined) role.description = patch.description;
    if (patch.dataScope) {
      const isPortal = (role.permissions ?? []).some((p) => p.module === 'portal');
      if (isPortal && patch.dataScope !== 'own_records') throw new BadRequestException('Portal roles always see only their own records');
      role.dataScope = patch.dataScope;
    }
    return this.roles.save(role);
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
