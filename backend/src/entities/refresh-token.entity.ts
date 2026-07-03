import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column({ name: 'token_hash' }) tokenHash: string;
  @Column({ name: 'user_agent', nullable: true }) userAgent?: string;
  @Column({ nullable: true }) ip?: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
