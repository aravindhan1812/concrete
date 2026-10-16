import { Controller, Get, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types';

/**
 * Minimal staff directory (id, name, role names) for @mentions and assignee pickers.
 * Any staff user may read it; it never includes contact details or portal users.
 */
@Controller('people')
export class DirectoryController {
  constructor(private readonly ds: DataSource) {}

  @Get('directory')
  async directory(@CurrentUser() user: AuthUser, @Query('search') search?: string) {
    const params: unknown[] = [user.companyId];
    let filter = '';
    if (search?.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      filter = ` AND lower(u.full_name) LIKE $2`;
    }
    const rows: { id: string; full_name: string; roles: string[] | null }[] = await this.ds.query(
      `SELECT u.id, u.full_name, array_remove(array_agg(r.name ORDER BY r.name), NULL) AS roles
       FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.company_id = $1 AND u.is_active AND u.deleted_at IS NULL AND u.client_id IS NULL AND u.vendor_id IS NULL${filter}
       GROUP BY u.id ORDER BY lower(u.full_name) LIMIT 50`,
      params,
    );
    return rows.map((r) => ({ id: r.id, name: r.full_name, roles: r.roles ?? [] }));
  }
}
