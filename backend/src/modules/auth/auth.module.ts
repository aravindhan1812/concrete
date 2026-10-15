import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { Company } from '../../entities/company.entity';
import { Permission } from '../../entities/permission.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    AccountingModule,
    TypeOrmModule.forFeature([User, Company, Role, Permission, RefreshToken]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
