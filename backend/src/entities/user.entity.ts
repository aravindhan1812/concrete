import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, JoinTable, ManyToMany,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @ManyToOne(() => Company) @JoinColumn({ name: 'company_id' }) company: Company;
  @Column({ name: 'branch_id', nullable: true }) branchId?: string;
  /** External logins: exactly one of these is set (DB CHECK enforces mutual exclusion). */
  @Column({ name: 'client_id', nullable: true }) clientId?: string;
  @Column({ name: 'vendor_id', nullable: true }) vendorId?: string;
  @Column({ type: 'citext', nullable: true }) email?: string;
  @Column({ nullable: true }) phone?: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ name: 'mfa_enabled', default: false }) mfaEnabled: boolean;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt?: Date;
  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' },
  })
  roles: Role[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date;
}
