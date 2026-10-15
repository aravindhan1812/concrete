import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const SCOPES = ['company', 'assigned_projects', 'own_records'] as const;
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { RbacService } from './rbac.service';

class CreateRoleDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(SCOPES) dataScope?: (typeof SCOPES)[number];
}
class UpdateRoleDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(SCOPES) dataScope?: (typeof SCOPES)[number];
}
class SetPermissionsDto {
  @IsArray() @IsString({ each: true }) permissionCodes: string[];
}

@Controller('rbac')
@RequirePermissions('admin.roles.manage')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('permissions')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Get('roles')
  listRoles(@CurrentUser() user: AuthUser) {
    return this.rbac.listRoles(user.companyId);
  }

  @Post('roles')
  createRole(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.rbac.createRole(user.companyId, dto.name, dto.description, dto.dataScope);
  }

  @Patch('roles/:id')
  updateRole(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rbac.updateRole(user.companyId, id, dto);
  }

  @Put('roles/:id/permissions')
  setPermissions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.rbac.setRolePermissions(user.companyId, id, dto.permissionCodes);
  }
}
