import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { NumberingService } from './numbering.service';

class UpdateSeriesDto {
  @IsOptional() @IsString() prefix?: string;
  @IsOptional() @IsString() pattern?: string;
  @IsOptional() @IsIn(['yearly', 'never']) reset?: 'yearly' | 'never';
}

@Controller('admin/numbering')
@RequirePermissions('admin.settings.manage')
export class NumberingController {
  constructor(private readonly numbering: NumberingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.numbering.list(user.companyId);
  }

  @Put(':docType')
  update(@CurrentUser() user: AuthUser, @Param('docType') docType: string, @Body() dto: UpdateSeriesDto) {
    return this.numbering.update(user.companyId, docType, dto);
  }
}
