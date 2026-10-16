import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A person at a client: owner, architect, site in-charge, accounts contact… */
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) designation?: string | null;
  @Column({ type: 'text', nullable: true }) email?: string | null;
  @Column({ type: 'text', nullable: true }) phone?: string | null;
  @Column({ name: 'is_primary', default: false }) isPrimary: boolean;
  @Column({ type: 'text', nullable: true }) notes?: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date | null;
}
