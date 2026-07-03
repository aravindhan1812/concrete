import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ name: 'legal_name', nullable: true }) legalName?: string;
  @Column({ nullable: true }) gstin?: string;
  @Column({ nullable: true }) pan?: string;
  @Column({ type: 'jsonb', nullable: true }) address?: Record<string, unknown>;
  @Column({ default: 'trial' }) plan: string;
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, unknown>;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
