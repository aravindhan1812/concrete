import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', nullable: true }) companyId?: string;
  @Column() name: string;
  @Column({ nullable: true }) description?: string;
  @Column({ name: 'is_system', default: false }) isSystem: boolean;
  @Column({ name: 'data_scope', default: 'company' }) dataScope: 'company' | 'assigned_projects' | 'own_records';
  /** Admin override of the role's default dashboard widgets (null = built-in default). */
  @Column({ name: 'dashboard_layout', type: 'jsonb', nullable: true }) dashboardLayout?: string[] | null;
  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id' },
    inverseJoinColumn: { name: 'permission_id' },
  })
  permissions: Permission[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
