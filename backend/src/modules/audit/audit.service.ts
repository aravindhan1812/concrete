import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.repo.save(this.repo.create(entry));
    } catch (err) {
      // Audit failures must never break the business operation.
      this.logger.warn(`audit write failed: ${(err as Error).message}`);
    }
  }

  findForCompany(companyId: string, limit = 100) {
    return this.repo.find({ where: { companyId }, order: { createdAt: 'DESC' }, take: limit });
  }
}
