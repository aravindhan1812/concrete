import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account, AccountingPeriod, FinancialYear, JournalEntry, JournalLine, VoucherSequence, VoucherType } from '../../entities/accounting.entities';
import { AccountingController } from './accounting.controller';
import { AccountsService } from './accounts.service';
import { JournalService } from './journal.service';
import { LedgerSetupService } from './ledger-setup.service';
import { ReportsService } from './reports.service';

/**
 * Ledger core. Other modules post through JournalService (by system key) and never write
 * money figures the ledger does not know about.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, FinancialYear, AccountingPeriod, VoucherType, VoucherSequence, JournalEntry, JournalLine])],
  controllers: [AccountingController],
  providers: [LedgerSetupService, AccountsService, JournalService, ReportsService],
  exports: [LedgerSetupService, JournalService],
})
export class AccountingModule {}
