import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '../../../entities/lead.entity';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class ChangeStatusDto {
  @IsIn(Object.values(LeadStatus)) status: LeadStatus;
  @IsOptional() @IsString() lostReason?: string;
}

export class CreateFollowUpDto {
  @IsIn(['call', 'meeting', 'site_visit', 'email', 'whatsapp']) type: string;
  @IsString() @IsNotEmpty() summary: string;
  @IsOptional() @IsString() outcome?: string;
  @IsString() @IsNotEmpty() followUpAt: string;
}

export class QueryLeadsDto {
  @IsOptional() @IsIn(Object.values(LeadStatus)) status?: LeadStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}
