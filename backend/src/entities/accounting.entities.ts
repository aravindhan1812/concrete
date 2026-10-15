import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type PartyType = 'client' | 'vendor' | 'employee';
export type JournalStatus = 'draft' | 'posted' | 'reversed';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'parent_id', type: 'uuid', nullable: true }) parentId?: string | null;
  @Column() code: string;
  @Column() name: string;
  @Column() type: AccountType;
  @Column({ name: 'is_group', default: false }) isGroup: boolean;
  @Column({ name: 'system_key', type: 'text', nullable: true }) systemKey?: string | null;
  @Column({ name: 'party_ledger', type: 'text', nullable: true }) partyLedger?: PartyType | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('financial_years')
export class FinancialYear {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column() name: string;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date' }) endDate: string;
  @Column({ default: 'open' }) status: 'open' | 'closed';
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true }) closedAt?: Date | null;
}

@Entity('accounting_periods')
export class AccountingPeriod {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'fy_id' }) fyId: string;
  @Column({ name: 'period_start', type: 'date' }) periodStart: string;
  @Column({ name: 'period_end', type: 'date' }) periodEnd: string;
  @Column({ default: 'open' }) status: 'open' | 'locked';
  @Column({ name: 'locked_by', type: 'text', nullable: true }) lockedBy?: string | null;
  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true }) lockedAt?: Date | null;
}

@Entity('voucher_types')
export class VoucherType {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column() code: string;
  @Column() name: string;
  @Column() prefix: string;
}

@Entity('voucher_sequences')
export class VoucherSequence {
  @PrimaryColumn({ name: 'voucher_type_id' }) voucherTypeId: string;
  @PrimaryColumn({ name: 'fy_id' }) fyId: string;
  @Column({ name: 'next_no', type: 'int', default: 1 }) nextNo: number;
}

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'fy_id' }) fyId: string;
  @Column({ name: 'voucher_type_id' }) voucherTypeId: string;
  @Column({ type: 'text', nullable: true }) number?: string | null;
  @Column({ name: 'entry_date', type: 'date' }) entryDate: string;
  @Column({ type: 'text', nullable: true }) narration?: string | null;
  @Column({ default: 'draft' }) status: JournalStatus;
  @Column({ name: 'source_type', type: 'text', nullable: true }) sourceType?: string | null;
  @Column({ name: 'source_id', type: 'uuid', nullable: true }) sourceId?: string | null;
  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true }) reversalOfId?: string | null;
  @Column({ name: 'reversed_by_id', type: 'uuid', nullable: true }) reversedById?: string | null;
  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true }) postedAt?: Date | null;
  @Column({ name: 'posted_by', type: 'text', nullable: true }) postedBy?: string | null;
  @Column({ name: 'created_by', type: 'text', nullable: true }) createdBy?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @OneToMany(() => JournalLine, (l) => l.entry, { cascade: ['insert'] }) lines: JournalLine[];
}

@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'entry_id' }) entryId: string;
  @ManyToOne(() => JournalEntry, (e) => e.lines, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'entry_id' }) entry: JournalEntry;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'line_no', type: 'int' }) lineNo: number;
  @Column({ name: 'account_id' }) accountId: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) debit: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) credit: string;
  @Column({ name: 'party_type', type: 'text', nullable: true }) partyType?: PartyType | null;
  @Column({ name: 'party_id', type: 'uuid', nullable: true }) partyId?: string | null;
  @Column({ name: 'branch_id', type: 'uuid', nullable: true }) branchId?: string | null;
  @Column({ name: 'project_id', type: 'uuid', nullable: true }) projectId?: string | null;
  @Column({ name: 'cost_code_id', type: 'uuid', nullable: true }) costCodeId?: string | null;
  @Column({ name: 'ref_type', type: 'text', nullable: true }) refType?: string | null;
  @Column({ name: 'ref_id', type: 'uuid', nullable: true }) refId?: string | null;
  @Column({ type: 'text', nullable: true }) description?: string | null;
}
