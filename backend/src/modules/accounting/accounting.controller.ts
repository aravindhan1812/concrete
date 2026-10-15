import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthUser } from '../../common/types';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, CreateFinancialYearDto, PostJournalDto, QueryJournalsDto, ReverseJournalDto, UpdateAccountDto } from './dto/journal.dto';
import { JournalService } from './journal.service';
import { LedgerSetupService } from './ledger-setup.service';
import { ReportsService } from './reports.service';

@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly setup: LedgerSetupService,
    private readonly accounts: AccountsService,
    private readonly journals: JournalService,
    private readonly reports: ReportsService,
  ) {}

  /** Idempotent: creates the default chart, voucher types and current FY if missing. */
  @Post('setup')
  @RequirePermissions('finance.ledger.manage')
  bootstrap(@CurrentUser() user: AuthUser) {
    return this.setup.bootstrap(user.companyId);
  }

  // ---- Chart of accounts ----
  @Get('accounts')
  @RequirePermissions('finance.ledger.read')
  listAccounts(@CurrentUser() user: AuthUser, @Query('withBalances') withBalances?: string) {
    return this.accounts.list(user.companyId, { withBalances: withBalances === 'true' });
  }

  @Post('accounts')
  @RequirePermissions('finance.ledger.manage')
  createAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto) {
    return this.accounts.create(user.companyId, dto);
  }

  @Patch('accounts/:id')
  @RequirePermissions('finance.ledger.manage')
  updateAccount(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(user.companyId, id, dto);
  }

  @Get('voucher-types')
  @RequirePermissions('finance.ledger.read')
  voucherTypes(@CurrentUser() user: AuthUser) {
    return this.accounts.listVoucherTypes(user.companyId);
  }

  // ---- Financial years & periods ----
  @Get('financial-years')
  @RequirePermissions('finance.ledger.read')
  financialYears(@CurrentUser() user: AuthUser) {
    return this.accounts.listFinancialYears(user.companyId);
  }

  @Post('financial-years')
  @RequirePermissions('finance.ledger.manage')
  createFinancialYear(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialYearDto) {
    return this.accounts.createFinancialYear(user.companyId, dto.startDate);
  }

  @Post('financial-years/:id/close')
  @RequirePermissions('finance.ledger.manage')
  closeFinancialYear(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.closeFinancialYear(user.companyId, id, user.userId);
  }

  @Post('periods/:id/lock')
  @RequirePermissions('finance.ledger.manage')
  lockPeriod(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.setPeriodLock(user.companyId, id, true, user.userId);
  }

  @Post('periods/:id/unlock')
  @RequirePermissions('finance.ledger.manage')
  unlockPeriod(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.setPeriodLock(user.companyId, id, false, user.userId);
  }

  // ---- Journals ----
  @Get('journals')
  @RequirePermissions('finance.ledger.read')
  listJournals(@CurrentUser() user: AuthUser, @Query() q: QueryJournalsDto) {
    return this.journals.findAll(user.companyId, q);
  }

  @Get('journals/:id')
  @RequirePermissions('finance.ledger.read')
  getJournal(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.journals.findOne(user.companyId, id);
  }

  @Post('journals')
  @RequirePermissions('finance.ledger.post')
  postJournal(@CurrentUser() user: AuthUser, @Body() dto: PostJournalDto) {
    return this.journals.post(user.companyId, user.userId, dto);
  }

  @Post('journals/:id/reverse')
  @RequirePermissions('finance.ledger.post')
  reverseJournal(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverseJournalDto) {
    return this.journals.reverse(user.companyId, user.userId, id, dto);
  }

  // ---- Reports ----
  @Get('reports/trial-balance')
  @RequirePermissions('finance.ledger.read', 'finance.reports.read')
  trialBalance(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.trialBalance(user.companyId, from || undefined, to || undefined);
  }

  @Get('reports/ledger/:accountId')
  @RequirePermissions('finance.ledger.read', 'finance.reports.read')
  ledger(@CurrentUser() user: AuthUser, @Param('accountId', ParseUUIDPipe) accountId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.ledger(user.companyId, accountId, from || undefined, to || undefined);
  }
}
