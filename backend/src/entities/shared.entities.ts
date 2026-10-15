import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('numbering_series')
export class NumberingSeries {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'doc_type' }) docType: string;
  @Column() prefix: string;
  @Column() pattern: string;
  @Column() reset: 'yearly' | 'never';
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('approval_rules')
export class ApprovalRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'step_no', type: 'int' }) stepNo: number;
  @Column({ name: 'approver_role_id' }) approverRoleId: string;
  @Column({ name: 'min_amount', type: 'numeric', precision: 14, scale: 2, default: 0 }) minAmount: string;
  @Column({ name: 'max_amount', type: 'numeric', precision: 14, scale: 2, nullable: true }) maxAmount?: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ type: 'text', nullable: true }) title?: string | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true }) amount?: string | null;
  @Column({ default: 'pending' }) status: ApprovalStatus;
  @Column({ name: 'current_step', type: 'int', nullable: true }) currentStep?: number | null;
  @Column({ name: 'requested_by' }) requestedBy: string;
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true }) decidedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('approval_steps')
export class ApprovalStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'request_id' }) requestId: string;
  @Column({ name: 'company_id', type: 'uuid', nullable: true }) companyId?: string | null;
  @Column({ name: 'step_no', type: 'int' }) stepNo: number;
  @Column({ name: 'approver_role_id', type: 'uuid', nullable: true }) approverRoleId?: string | null;
  @Column({ name: 'approver_user_id', type: 'uuid', nullable: true }) approverUserId?: string | null;
  @Column({ default: 'pending' }) status: 'pending' | 'approved' | 'rejected' | 'skipped';
  @Column({ name: 'acted_by', type: 'uuid', nullable: true }) actedBy?: string | null;
  @Column({ name: 'acted_at', type: 'timestamptz', nullable: true }) actedAt?: Date | null;
  @Column({ type: 'text', nullable: true }) remarks?: string | null;
}

@Entity('files')
export class FileRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true }) uploadedBy?: string | null;
  @Column({ name: 'storage_key' }) storageKey: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type', type: 'text', nullable: true }) mimeType?: string | null;
  @Column({ name: 'size_bytes', type: 'bigint', nullable: true }) sizeBytes?: string | null;
  @Column({ name: 'entity_type', type: 'text', nullable: true }) entityType?: string | null;
  @Column({ name: 'entity_id', type: 'uuid', nullable: true }) entityId?: string | null;
  @Column({ name: 'gps_lat', type: 'numeric', precision: 10, scale: 7, nullable: true }) gpsLat?: string | null;
  @Column({ name: 'gps_lng', type: 'numeric', precision: 10, scale: 7, nullable: true }) gpsLng?: string | null;
  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true }) capturedAt?: Date | null;
  @Column({ default: 'ready' }) status: 'pending' | 'ready' | 'deleted';
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ name: 'parent_id', type: 'uuid', nullable: true }) parentId?: string | null;
  @Column({ name: 'author_id' }) authorId: string;
  @Column() body: string;
  @Column({ type: 'uuid', array: true, default: () => "'{}'" }) mentions: string[];
  @Column({ name: 'shared_with_client', default: false }) sharedWithClient: boolean;
  @Column({ name: 'shared_with_vendor', default: false }) sharedWithVendor: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true }) editedAt?: Date | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt?: Date | null;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id' }) companyId: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column({ default: 'inapp' }) channel: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) body?: string | null;
  @Column({ type: 'jsonb', nullable: true }) data?: Record<string, unknown> | null;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt?: Date | null;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
