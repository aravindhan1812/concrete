import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { EntityAccessModule } from './common/entity-access/entity-access.service';
import { ProjectScopeModule } from './common/project-scope/project-scope.service';
import { AudienceGuard } from './common/guards/audience.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FilesModule } from './modules/files/files.module';
import { LeadsModule } from './modules/leads/leads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NumberingModule } from './modules/numbering/numbering.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL', 'postgres://concrete:concrete@localhost:5432/concrete'),
        autoLoadEntities: true,
        synchronize: false, // schema is owned by database/schema.sql
      }),
    }),
    AuditModule,
    // Shared services (global): numbering, notifications, approvals, entity access
    NumberingModule,
    NotificationsModule,
    ApprovalsModule,
    EntityAccessModule,
    ProjectScopeModule,
    FilesModule,
    CommentsModule,
    AccountingModule,
    AuthModule,
    RbacModule,
    UsersModule,
    LeadsModule,
    DashboardModule,
  ],
  providers: [
    // Order matters: authenticate → check audience (staff vs portal) → check permissions.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AudienceGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
