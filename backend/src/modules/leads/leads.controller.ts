import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ChangeStatusDto, CreateFollowUpDto, QueryLeadsDto, UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions('crm.leads.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(user.companyId, query);
  }

  @Get('stats')
  @RequirePermissions('crm.leads.read', 'reports.read')
  stats(@CurrentUser() user: AuthUser) {
    return this.leadsService.stats(user.companyId);
  }

  @Get(':id')
  @RequirePermissions('crm.leads.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(user.companyId, id);
  }

  @Post()
  @RequirePermissions('crm.leads.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.companyId, user.userId, dto);
  }

  @Patch(':id')
  @RequirePermissions('crm.leads.update')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('crm.leads.update')
  changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.leadsService.changeStatus(user.companyId, id, dto);
  }

  @Post(':id/follow-ups')
  @RequirePermissions('crm.leads.update')
  addFollowUp(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.leadsService.addFollowUp(user.companyId, user.userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('crm.leads.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.remove(user.companyId, id);
  }
}
