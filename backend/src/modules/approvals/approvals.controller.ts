import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { ApprovalsService } from './approvals.service';

class DecideDto {
  @IsIn(['approve', 'reject']) decision: 'approve' | 'reject';
  @IsOptional() @IsString() remarks?: string;
}

class CreateRuleDto {
  @IsString() entityType: string;
  @IsInt() @Min(1) stepNo: number;
  @IsUUID() approverRoleId: string;
  @IsOptional() @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxAmount?: number | null;
}

class UpdateRuleDto {
  @IsOptional() @IsInt() @Min(1) stepNo?: number;
  @IsOptional() @IsUUID() approverRoleId?: string;
  @IsOptional() @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxAmount?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Requests are created by the owning modules (PO, quotation, expense…) through ApprovalsService.
 * These endpoints let people see and act on them, and let admins configure the rules.
 */
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('box') box: 'inbox' | 'mine' | 'all' = 'inbox',
    @Query('status') status?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const b = box === 'mine' || box === 'all' ? box : 'inbox';
    return this.approvals.list(user, b, { status, entityType, page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  }

  @Get('rules')
  @RequirePermissions('approvals.rules.manage')
  rules(@CurrentUser() user: AuthUser, @Query('entityType') entityType?: string) {
    return this.approvals.listRules(user.companyId, entityType);
  }

  @Post('rules')
  @RequirePermissions('approvals.rules.manage')
  createRule(@CurrentUser() user: AuthUser, @Body() dto: CreateRuleDto) {
    return this.approvals.createRule(user.companyId, dto);
  }

  @Patch('rules/:id')
  @RequirePermissions('approvals.rules.manage')
  updateRule(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRuleDto) {
    return this.approvals.updateRule(user.companyId, id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.get(user, id);
  }

  @Post(':id/decide')
  @HttpCode(200)
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.approvals.decide(user, id, dto.decision, dto.remarks);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.cancel(user, id);
  }
}
