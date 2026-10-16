import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface PostalAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}
export interface SiteAddress extends PostalAddress {
  label: string;
}

/** Who the company contracts with and invoices. A client can have many projects. */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ type: 'text', nullable: true }) code?: string | null;
  @Column() name: string;
  @Column({ default: 'individual' }) type: 'individual' | 'business';
  @Column({ type: 'text', nullable: true }) gstin?: string | null;
  @Column({ type: 'text', nullable: true }) pan?: string | null;
  @Column({ name: 'state_code', type: 'text', nullable: true }) stateCode?: string | null;
  @Column({ type: 'text', nullable: true }) email?: string | null;
  @Column({ type: 'text', nullable: true }) phone?: string | null;
  /** Legacy single address; superseded by billingAddress. */
  @Column({ type: 'jsonb', nullable: true }) address?: Record<string, unknown> | null;
  @Column({ name: 'billing_address', type: 'jsonb', nullable: true }) billingAddress?: PostalAddress | null;
  @Column({ name: 'site_addresses', type: 'jsonb', default: () => "'[]'" }) siteAddresses: SiteAddress[];
  @Column({ name: 'credit_limit', type: 'numeric', precision: 14, scale: 2, nullable: true }) creditLimit?: string | null;
  @Column({ name: 'credit_days', type: 'int', nullable: true }) creditDays?: number | null;
  @Column({ name: 'payment_terms', type: 'text', nullable: true }) paymentTerms?: string | null;
  @Column({ type: 'text', nullable: true }) notes?: string | null;
  @Column({ name: 'source_lead_id', type: 'uuid', nullable: true }) sourceLeadId?: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date | null;
}
