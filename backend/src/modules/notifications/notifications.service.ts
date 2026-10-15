import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Notification } from '../../entities/shared.entities';

export interface NotificationInput {
  title: string;
  body?: string;
  /** Deep-link payload for the UI, e.g. { entityType: 'approval_request', entityId, path: '/approvals/…' }. */
  data?: Record<string, unknown>;
}

/**
 * In-app notifications. Other channels (email, WhatsApp, push) will be delivered from these rows
 * by a worker later, using the same `channel` column — callers do not change.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async notify(companyId: string, userIds: string[], input: NotificationInput, em?: EntityManager) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return [];
    const m = em ?? this.dataSource.manager;
    return m.save(
      unique.map((userId) =>
        m.create(Notification, { companyId, userId, channel: 'inapp', title: input.title, body: input.body ?? null, data: input.data ?? null, sentAt: new Date() }),
      ),
    );
  }

  /** Notify every active user holding a role (e.g. the approvers of an approval step). */
  async notifyRole(companyId: string, roleId: string, input: NotificationInput, opts: { exclude?: string[]; em?: EntityManager } = {}) {
    const m = opts.em ?? this.dataSource.manager;
    const rows: { user_id: string }[] = await m.query(
      `SELECT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id
       WHERE ur.role_id = $1 AND u.company_id = $2 AND u.is_active AND u.deleted_at IS NULL`,
      [roleId, companyId],
    );
    const exclude = new Set(opts.exclude ?? []);
    return this.notify(companyId, rows.map((r) => r.user_id).filter((id) => !exclude.has(id)), input, m);
  }

  async listForUser(userId: string, opts: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize ?? 20)));
    const [data, total] = await this.dataSource.getRepository(Notification).findAndCount({
      where: { userId, ...(opts.unreadOnly ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async unreadCount(userId: string) {
    const count = await this.dataSource.getRepository(Notification).count({ where: { userId, readAt: IsNull() } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const repo = this.dataSource.getRepository(Notification);
    const n = await repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      n.readAt = new Date();
      await repo.save(n);
    }
    return n;
  }

  async markAllRead(userId: string) {
    const res = await this.dataSource.getRepository(Notification).update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { updated: res.affected ?? 0 };
  }
}
