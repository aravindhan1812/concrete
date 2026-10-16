import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { DashboardService } from './dashboard.service';

class LayoutItemDto {
  @IsString() key: string;
  @IsOptional() @IsBoolean() hidden?: boolean;
}
class SaveLayoutDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => LayoutItemDto) widgets: LayoutItemDto[];
}
class RoleLayoutDto {
  /** null restores the built-in default for the role. */
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) widgets: string[] | null;
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  layout(@CurrentUser() user: AuthUser) {
    return this.dashboard.layout(user);
  }

  @Get('dashboard/catalog')
  catalog(@CurrentUser() user: AuthUser) {
    return this.dashboard.catalog(user);
  }

  @Get('dashboard/widgets/:key')
  widget(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.dashboard.widgetData(user, key);
  }

  @Put('dashboard/layout')
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveLayoutDto) {
    return this.dashboard.saveLayout(user, dto.widgets);
  }

  @Delete('dashboard/layout')
  reset(@CurrentUser() user: AuthUser) {
    return this.dashboard.resetLayout(user);
  }

  @Put('rbac/roles/:id/dashboard')
  @RequirePermissions('admin.roles.manage')
  setRoleLayout(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleLayoutDto) {
    return this.dashboard.setRoleLayout(user.companyId, id, dto.widgets ?? null);
  }
}
