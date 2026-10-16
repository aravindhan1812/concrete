import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { ClientsService } from './clients.service';
import {
  ConvertLeadDto,
  CreateClientDto,
  CreateContactDto,
  DuplicateQueryDto,
  QueryClientsDto,
  UpdateClientDto,
  UpdateContactDto,
} from './dto/client.dto';
import { GST_STATES, parseGstin } from './gst';

@Controller('crm')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get('clients')
  @RequirePermissions('crm.clients.read')
  list(@CurrentUser() user: AuthUser, @Query() q: QueryClientsDto) {
    return this.clients.list(user, q);
  }

  @Get('clients/duplicates')
  @RequirePermissions('crm.clients.read')
  duplicates(@CurrentUser() user: AuthUser, @Query() q: DuplicateQueryDto) {
    return this.clients.duplicates(user, q);
  }

  /** GST state list and a GSTIN check for forms (no data access). */
  @Get('gst/states')
  @RequirePermissions('crm.clients.read')
  states() {
    return Object.entries(GST_STATES).map(([code, name]) => ({ code, name }));
  }

  @Get('gst/validate/:gstin')
  @RequirePermissions('crm.clients.read')
  validateGstin(@Param('gstin') gstin: string) {
    return parseGstin(gstin);
  }

  @Get('clients/:id')
  @RequirePermissions('crm.clients.read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(user, id);
  }

  @Post('clients')
  @RequirePermissions('crm.clients.manage')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user, dto);
  }

  @Patch('clients/:id')
  @RequirePermissions('crm.clients.manage')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user, id, dto);
  }

  @Delete('clients/:id')
  @RequirePermissions('crm.clients.manage')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(user, id);
  }

  @Post('clients/:id/contacts')
  @RequirePermissions('crm.clients.manage')
  addContact(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.clients.addContact(user, id, dto);
  }

  @Patch('clients/:id/contacts/:contactId')
  @RequirePermissions('crm.clients.manage')
  updateContact(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.clients.updateContact(user, id, contactId, dto);
  }

  @Delete('clients/:id/contacts/:contactId')
  @RequirePermissions('crm.clients.manage')
  removeContact(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.clients.removeContact(user, id, contactId);
  }

  @Post('leads/:id/convert')
  @RequirePermissions('crm.clients.manage')
  convertLead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.clients.convertLead(user, id, dto);
  }
}
