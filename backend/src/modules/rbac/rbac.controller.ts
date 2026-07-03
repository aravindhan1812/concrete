import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { RbacService } from './rbac.service';

class CreateRoleDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
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
    return this.rbac.createRole(user.companyId, dto.name, dto.description);
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
