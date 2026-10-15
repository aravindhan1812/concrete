import { PartialType } from '@nestjs/mapped-types';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty() fullName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(8) password: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) roleIds: string[];
  @IsOptional() @IsUUID() branchId?: string;
  /** Exactly one of customerId / vendorId makes this an external (portal) login. */
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() vendorId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class QueryUsersDto {
  @IsOptional() @IsString() kind?: 'staff' | 'customer' | 'vendor';
  @IsOptional() @IsString() search?: string;
  @IsOptional() page?: number;
  @IsOptional() pageSize?: number;
}
