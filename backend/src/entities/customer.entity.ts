import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column() name: string;
  @Column({ default: 'individual' }) type: string; // individual|business
  @Column({ nullable: true }) gstin?: string;
  @Column({ nullable: true }) pan?: string;
  @Column({ nullable: true }) email?: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ type: 'jsonb', nullable: true }) address?: Record<string, unknown>;
  @Column({ name: 'created_by', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
