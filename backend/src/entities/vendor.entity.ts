import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column() name: string;
  @Column({ nullable: true }) code?: string;
  @Column({ nullable: true }) gstin?: string;
  @Column({ nullable: true }) pan?: string;
  @Column({ nullable: true }) email?: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ type: 'jsonb', nullable: true }) address?: Record<string, unknown>;
  @Column({ type: 'text', array: true, nullable: true }) categories?: string[];
  @Column({ name: 'payment_terms', nullable: true }) paymentTerms?: string;
  @Column({ name: 'credit_days', type: 'int', nullable: true }) creditDays?: number;
  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true }) rating?: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
