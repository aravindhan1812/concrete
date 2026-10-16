import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(10) pincode?: string;
}

export class SiteAddressDto extends AddressDto {
  @IsString() @IsNotEmpty() @MaxLength(80) label: string;
}

export class CreateContactDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(80) designation?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateClientDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsIn(['individual', 'business']) type?: 'individual' | 'business';
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() pan?: string;
  /** Place of supply when there is no GSTIN (individuals); derived from the GSTIN otherwise. */
  @IsOptional() @IsString() stateCode?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) billingAddress?: AddressDto;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => SiteAddressDto) siteAddresses?: SiteAddressDto[];
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) creditLimit?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) creditDays?: number | null;
  @IsOptional() @IsString() @MaxLength(500) paymentTerms?: string;
  @IsOptional() @IsString() notes?: string;
  /** Primary contact created together with the client. */
  @IsOptional() @ValidateNested() @Type(() => CreateContactDto) primaryContact?: CreateContactDto;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryClientsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['active', 'inactive', 'all']) status?: 'active' | 'inactive' | 'all';
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}

export class DuplicateQueryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() gstin?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

/** Convert a lead: link to an existing client, or create one (fields default from the lead). */
export class ConvertLeadDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @ValidateNested() @Type(() => CreateClientDto) client?: CreateClientDto;
}
