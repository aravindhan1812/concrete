import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { EntityAccessService } from '../../common/entity-access/entity-access.service';
import { AuthUser } from '../../common/types';
import { Comment } from '../../entities/shared.entities';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateCommentInput {
  entityType: string;
  entityId: string;
  body: string;
  parentId?: string;
  mentionUserIds?: string[];
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: EntityAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, entityType: string, entityId: string) {
    await this.access.assertAccess(user, entityType, entityId);
    const rows: {
      id: string; parent_id: string | null; body: string; mentions: string[]; author_id: string;
      author_name: string; created_at: Date; edited_at: Date | null;
    }[] = await this.dataSource.query(
      `SELECT c.*, u.full_name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.company_id = $1 AND c.entity_type = $2 AND c.entity_id = $3 AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [user.companyId, entityType, entityId],
    );
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      body: r.body,
      mentions: r.mentions,
      authorId: r.author_id,
      authorName: r.author_name,
      createdAt: r.created_at,
      editedAt: r.edited_at,
    }));
  }

  async create(user: AuthUser, input: CreateCommentInput) {
    await this.access.assertAccess(user, input.entityType, input.entityId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException('Comment cannot be empty');
    const repo = this.dataSource.getRepository(Comment);
    if (input.parentId) {
      const parent = await repo.findOne({ where: { id: input.parentId, companyId: user.companyId, deletedAt: IsNull() } });
      if (!parent || parent.entityType !== input.entityType || parent.entityId !== input.entityId) throw new BadRequestException('Reply must be on the same record');
    }
    const mentions = await this.validMentions(user.companyId, input.mentionUserIds ?? []);
    return this.dataSource.transaction(async (em) => {
      const comment = await em.save(
        em.create(Comment, { companyId: user.companyId, entityType: input.entityType, entityId: input.entityId, parentId: input.parentId ?? null, authorId: user.userId, body, mentions }),
      );
      await this.notifications.notify(
        user.companyId,
        mentions.filter((id) => id !== user.userId),
        {
          title: `${user.fullName} mentioned you`,
          body: body.length > 140 ? body.slice(0, 137) + '…' : body,
          data: { entityType: input.entityType, entityId: input.entityId, commentId: comment.id },
        },
        em,
      );
      return comment;
    });
  }

  async update(user: AuthUser, id: string, body: string) {
    const comment = await this.loadOwn(user, id);
    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Comment cannot be empty');
    comment.body = trimmed;
    comment.editedAt = new Date();
    return this.dataSource.getRepository(Comment).save(comment);
  }

  async remove(user: AuthUser, id: string) {
    const comment = await this.loadOwn(user, id);
    comment.deletedAt = new Date();
    await this.dataSource.getRepository(Comment).save(comment);
    return { ok: true };
  }

  private async loadOwn(user: AuthUser, id: string) {
    const comment = await this.dataSource.getRepository(Comment).findOne({ where: { id, companyId: user.companyId, deletedAt: IsNull() } });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.access.assertAccess(user, comment.entityType, comment.entityId);
    if (comment.authorId !== user.userId) throw new ForbiddenException('You can only change your own comments');
    return comment;
  }

  /** Only active staff users of the same company can be mentioned; unknown ids are dropped. */
  private async validMentions(companyId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    if (unique.length > 20) throw new BadRequestException('Too many mentions');
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[]) AND company_id = $2 AND is_active AND deleted_at IS NULL AND client_id IS NULL AND vendor_id IS NULL`,
      [unique, companyId],
    );
    return rows.map((r) => r.id);
  }
}
