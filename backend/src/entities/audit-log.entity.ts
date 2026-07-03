import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ name: 'company_id', nullable: true }) companyId?: string;
  @Column({ name: 'user_id', nullable: true }) userId?: string;
  @Column() action: string;
  @Column({ name: 'entity_type', nullable: true }) entityType?: string;
  @Column({ name: 'entity_id', nullable: true }) entityId?: string;
  @Column({ type: 'jsonb', nullable: true }) before?: unknown;
  @Column({ type: 'jsonb', nullable: true }) after?: unknown;
  @Column({ nullable: true }) ip?: string;
  @Column({ name: 'user_agent', nullable: true }) userAgent?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
