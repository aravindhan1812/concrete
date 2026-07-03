import {
  IsEmail, IsIn, IsISO8601, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';

export class CreateLeadDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(120) contactName: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['referral', 'website', 'walkin', 'social', 'other']) source?: string;
  @IsOptional() @IsIn(['interior', 'civil', 'commercial', 'mep', 'fabrication']) segment?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsNumberString() estimatedValue?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsISO8601() nextFollowUpAt?: string;
  @IsOptional() @IsString() notes?: string;
}
