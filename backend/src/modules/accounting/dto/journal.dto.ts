import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { VOUCHER_TYPES } from '../chart-template';

const VOUCHER_CODES = VOUCHER_TYPES.map((v) => v.code);

export class JournalLineDto {
  /** Either an explicit account or a system key (e.g. `ar_control`) resolved against the company's chart. */
  @IsOptional() @IsUUID() accountId?: string;
  @IsOptional() @IsString() systemKey?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) debit?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit?: number;
  @IsOptional() @IsIn(['customer', 'vendor', 'employee']) partyType?: 'customer' | 'vendor' | 'employee';
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() costCodeId?: string;
  @IsOptional() @IsString() refType?: string;
  @IsOptional() @IsUUID() refId?: string;
  @IsOptional() @IsString() description?: string;
}

export class PostJournalDto {
  @IsIn(VOUCHER_CODES) voucherType: string;
  @IsDateString() entryDate: string;
  @IsOptional() @IsString() narration?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsUUID() sourceId?: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => JournalLineDto) lines: JournalLineDto[];
}

export class ReverseJournalDto {
  @IsOptional() @IsDateString() entryDate?: string;
  @IsOptional() @IsString() narration?: string;
}

export class QueryJournalsDto {
  @IsOptional() @IsString() voucherType?: string;
  @IsOptional() @IsIn(['draft', 'posted', 'reversed']) status?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() accountId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}

export class CreateAccountDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsIn(['asset', 'liability', 'equity', 'income', 'expense']) type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
  @IsOptional() @IsIn(['customer', 'vendor', 'employee']) partyLedger?: 'customer' | 'vendor' | 'employee';
}

export class UpdateAccountDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Re-point a posting rule at this account (moves the key off the account that held it). */
  @IsOptional() @IsString() systemKey?: string;
}

export class CreateFinancialYearDto {
  @IsDateString() startDate: string;
}
