import { BadRequestException, ForbiddenException, Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../types';
import { ENTITY_REGISTRY } from './entity-registry';

/**
 * Single check used by files and comments: the entity type is known, the caller may read it,
 * and the record exists inside the caller's company. Portal access (shared-with-client/vendor
 * records) is added with the portals; until then attachments are staff-only.
 */
@Injectable()
export class EntityAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async assertAccess(user: AuthUser, entityType: string, entityId: string): Promise<void> {
    const def = ENTITY_REGISTRY[entityType];
    if (!def) throw new BadRequestException(`Unknown entity type "${entityType}"`);
    if (user.kind !== 'staff') throw new ForbiddenException('Not available to portal accounts yet');
    if (!def.read.some((p) => user.permissions.includes(p))) throw new ForbiddenException(`Missing permission: one of [${def.read.join(', ')}]`);
    const rows: unknown[] = await this.dataSource.query(`SELECT 1 FROM ${def.table} WHERE id = $1 AND company_id = $2`, [entityId, user.companyId]);
    if (rows.length === 0) throw new NotFoundException(`${entityType} not found`);
  }
}

@Global()
@Module({ providers: [EntityAccessService], exports: [EntityAccessService] })
export class EntityAccessModule {}
