import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { LeadFollowUp } from './lead-follow-up.entity';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  SITE_VISIT = 'site_visit',
  QUOTATION = 'quotation',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

/** Legal pipeline transitions; terminal states have no exits. */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.LOST],
  [LeadStatus.CONTACTED]: [LeadStatus.SITE_VISIT, LeadStatus.QUOTATION, LeadStatus.LOST],
  [LeadStatus.SITE_VISIT]: [LeadStatus.QUOTATION, LeadStatus.LOST],
  [LeadStatus.QUOTATION]: [LeadStatus.NEGOTIATION, LeadStatus.WON, LeadStatus.LOST],
  [LeadStatus.NEGOTIATION]: [LeadStatus.WON, LeadStatus.LOST],
  [LeadStatus.WON]: [],
  [LeadStatus.LOST]: [],
};

@Entity('leads')
@Index(['companyId', 'status'])
export class Lead {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId?: string;
  @Column({ nullable: true }) code?: string;
  @Column() title: string;
  @Column({ name: 'contact_name' }) contactName: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ nullable: true }) email?: string;
  @Column({ nullable: true }) source?: string;
  @Column({ nullable: true }) segment?: string;
  @Column({ nullable: true }) city?: string;
  @Column({ name: 'estimated_value', type: 'numeric', precision: 14, scale: 2, nullable: true })
  estimatedValue?: string;
  @Column({ type: 'text', default: LeadStatus.NEW }) status: LeadStatus;
  @Column({ name: 'lost_reason', nullable: true }) lostReason?: string;
  @Column({ name: 'owner_id', nullable: true }) ownerId?: string;
  @Column({ name: 'client_id', nullable: true }) clientId?: string;
  @Column({ name: 'next_follow_up_at', type: 'timestamptz', nullable: true }) nextFollowUpAt?: Date;
  @Column({ nullable: true }) notes?: string;
  @Column({ name: 'created_by', nullable: true }) createdBy?: string;
  @OneToMany(() => LeadFollowUp, (f) => f.lead) followUps: LeadFollowUp[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
