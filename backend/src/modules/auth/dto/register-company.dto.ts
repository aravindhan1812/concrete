import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterCompanyDto {
  @IsString() @IsNotEmpty() companyName: string;
  @IsString() @IsNotEmpty() fullName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8, { message: 'Password must be at least 8 characters' }) password: string;
  @IsOptional() @IsString() phone?: string;
}
