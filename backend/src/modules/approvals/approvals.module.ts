import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest, ApprovalRule, ApprovalStep } from '../../entities/shared.entities';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRule, ApprovalRequest, ApprovalStep])],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
