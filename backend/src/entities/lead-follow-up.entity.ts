import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Lead } from './lead.entity';

@Entity('lead_follow_ups')
export class LeadFollowUp {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'lead_id' }) leadId: string;
  @ManyToOne(() => Lead, (l) => l.followUps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;
  @Column({ default: 'call' }) type: string;
  @Column() summary: string;
  @Column({ nullable: true }) outcome?: string;
  @Column({ name: 'follow_up_at', type: 'timestamptz' }) followUpAt: Date;
  @Column({ name: 'done_at', type: 'timestamptz', nullable: true }) doneAt?: Date;
  @Column({ name: 'created_by', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
