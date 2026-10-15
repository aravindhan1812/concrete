import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalRequest, ApprovalRule, ApprovalStep } from '../../entities/shared.entities';
import { AuthUser } from '../../common/types';
import { NotificationsService } from '../notifications/notifications.service';

export type ApprovalOutcome = 'approved' | 'rejected' | 'cancelled';
export type ApprovalHandler = (request: ApprovalRequest, outcome: ApprovalOutcome, em: EntityManager) => Promise<void> | void;

export interface SubmitInput {
  companyId: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  title: string;
  amount?: number;
}

/** Rules whose amount band contains `amount`, in step order. Pure; exported for tests. */
export function matchRules(rules: ApprovalRule[], amount: number): ApprovalRule[] {
  const paise = Math.round(amount * 100);
  return rules
    .filter((r) => r.isActive)
    .filter((r) => Math.round(Number(r.minAmount) * 100) <= paise && (r.maxAmount == null || paise <= Math.round(Number(r.maxAmount) * 100)))
    .sort((a, b) => a.stepNo - b.stepNo || a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Generic approval engine. A module submits a document; configured rules (entity type + amount
 * band → approver role per step) become sequential steps. Anyone holding the step's role may act,
 * except the requester (segregation of duties). Modules register a handler per entity type to
 * react to the final outcome inside the same transaction.
 */
@Injectable()
export class ApprovalsService {
  private readonly handlers = new Map<string, ApprovalHandler[]>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  onDecision(entityType: string, handler: ApprovalHandler) {
    this.handlers.set(entityType, [...(this.handlers.get(entityType) ?? []), handler]);
  }

  submit(input: SubmitInput, em?: EntityManager): Promise<ApprovalRequest> {
    const run = (m: EntityManager) => this.submitWith(m, input);
    return em ? run(em) : this.dataSource.transaction(run);
  }

  private async submitWith(em: EntityManager, input: SubmitInput): Promise<ApprovalRequest> {
    const open = await em.findOne(ApprovalRequest, {
      where: { companyId: input.companyId, entityType: input.entityType, entityId: input.entityId, status: 'pending' },
    });
    if (open) throw new ConflictException('This document already has a pending approval request');

    const rules = await em.find(ApprovalRule, { where: { companyId: input.companyId, entityType: input.entityType, isActive: true } });
    const steps = matchRules(rules, input.amount ?? 0);

    const request = await em.save(
      em.create(ApprovalRequest, {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        requestedBy: input.requestedBy,
        title: input.title,
        amount: input.amount != null ? input.amount.toFixed(2) : null,
        status: steps.length ? 'pending' : 'approved',
        currentStep: steps.length ? 1 : null,
        decidedAt: steps.length ? null : new Date(),
      }),
    );

    if (steps.length === 0) {
      // No rule covers this document/amount: approved automatically, but still recorded.
      await this.fire(request, 'approved', em);
      return request;
    }

    await em.save(
      steps.map((rule, i) =>
        em.create(ApprovalStep, { requestId: request.id, companyId: input.companyId, stepNo: i + 1, approverRoleId: rule.approverRoleId, status: 'pending' }),
      ),
    );
    await this.notifications.notifyRole(input.companyId, steps[0].approverRoleId, this.pendingMessage(request), { exclude: [input.requestedBy], em });
    return request;
  }

  async decide(user: AuthUser, requestId: string, decision: 'approve' | 'reject', remarks?: string) {
    if (decision === 'reject' && !remarks?.trim()) throw new BadRequestException('A reason is required to reject');
    return this.dataSource.transaction(async (em) => {
      const request = await em.findOne(ApprovalRequest, { where: { id: requestId, companyId: user.companyId }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Approval request not found');
      if (request.status !== 'pending') throw new BadRequestException(`This request is already ${request.status}`);
      if (request.requestedBy === user.userId) throw new ForbiddenException('You cannot approve your own request');

      const step = await em.findOne(ApprovalStep, { where: { requestId, stepNo: request.currentStep ?? 0 } });
      if (!step) throw new BadRequestException('Approval request has no current step');
      if (!(await this.holdsStep(em, user.userId, step))) throw new ForbiddenException('You are not an approver for this step');

      step.status = decision === 'approve' ? 'approved' : 'rejected';
      step.actedBy = user.userId;
      step.actedAt = new Date();
      step.remarks = remarks?.trim() || null;
      await em.save(step);

      if (decision === 'reject') {
        await em.update(ApprovalStep, { requestId, status: 'pending' }, { status: 'skipped' });
        request.status = 'rejected';
        request.decidedAt = new Date();
        await em.save(request);
        await this.notifications.notify(user.companyId, [request.requestedBy], { title: `Rejected: ${request.title}`, body: step.remarks ?? undefined, data: this.link(request) }, em);
        await this.fire(request, 'rejected', em);
        return this.detail(em, user.companyId, requestId);
      }

      const nextStep = await em.findOne(ApprovalStep, { where: { requestId, stepNo: step.stepNo + 1 } });
      if (nextStep) {
        request.currentStep = nextStep.stepNo;
        await em.save(request);
        await this.notifications.notifyRole(user.companyId, nextStep.approverRoleId!, this.pendingMessage(request), { exclude: [request.requestedBy], em });
      } else {
        request.status = 'approved';
        request.currentStep = null;
        request.decidedAt = new Date();
        await em.save(request);
        await this.notifications.notify(user.companyId, [request.requestedBy], { title: `Approved: ${request.title}`, data: this.link(request) }, em);
        await this.fire(request, 'approved', em);
      }
      return this.detail(em, user.companyId, requestId);
    });
  }

  async cancel(user: AuthUser, requestId: string) {
    return this.dataSource.transaction(async (em) => {
      const request = await em.findOne(ApprovalRequest, { where: { id: requestId, companyId: user.companyId } });
      if (!request) throw new NotFoundException('Approval request not found');
      if (request.requestedBy !== user.userId) throw new ForbiddenException('Only the requester can cancel');
      if (request.status !== 'pending') throw new BadRequestException(`This request is already ${request.status}`);
      await em.update(ApprovalStep, { requestId, status: 'pending' }, { status: 'skipped' });
      request.status = 'cancelled';
      request.decidedAt = new Date();
      await em.save(request);
      await this.fire(request, 'cancelled', em);
      return this.detail(em, user.companyId, requestId);
    });
  }

  /**
   * box = 'inbox' (waiting on me), 'mine' (I requested), 'all' (needs approvals.read).
   */
  async list(user: AuthUser, box: 'inbox' | 'mine' | 'all', opts: { status?: string; entityType?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize ?? 20)));
    const qb = this.dataSource.getRepository(ApprovalRequest).createQueryBuilder('r').where('r.companyId = :companyId', { companyId: user.companyId });
    if (box === 'inbox') {
      qb.andWhere("r.status = 'pending'")
        .andWhere('r.requestedBy <> :userId', { userId: user.userId })
        .andWhere(
          `EXISTS (SELECT 1 FROM approval_steps s JOIN user_roles ur ON ur.role_id = s.approver_role_id
                   WHERE s.request_id = r.id AND s.step_no = r.current_step AND ur.user_id = :userId)`,
        );
    } else if (box === 'mine') {
      qb.andWhere('r.requestedBy = :userId', { userId: user.userId });
    } else if (!user.permissions.includes('approvals.read')) {
      throw new ForbiddenException('Missing permission: approvals.read');
    }
    if (opts.status) qb.andWhere('r.status = :status', { status: opts.status });
    if (opts.entityType) qb.andWhere('r.entityType = :entityType', { entityType: opts.entityType });
    const [data, total] = await qb.orderBy('r.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { data, total, page, pageSize };
  }

  async get(user: AuthUser, requestId: string) {
    const detail = await this.detail(this.dataSource.manager, user.companyId, requestId);
    const involved =
      detail.requestedBy === user.userId ||
      user.permissions.includes('approvals.read') ||
      (await this.holdsAnyRole(this.dataSource.manager, user.userId, detail.steps.map((s) => s.approverRoleId).filter((x): x is string => !!x)));
    if (!involved) throw new NotFoundException('Approval request not found');
    return detail;
  }

  /** Latest request for a document — modules use this to show approval state on their screens. */
  latestFor(companyId: string, entityType: string, entityId: string) {
    return this.dataSource.getRepository(ApprovalRequest).findOne({ where: { companyId, entityType, entityId }, order: { createdAt: 'DESC' } });
  }

  // ---- Rules ----
  listRules(companyId: string, entityType?: string) {
    return this.dataSource.getRepository(ApprovalRule).find({
      where: { companyId, ...(entityType ? { entityType } : {}) },
      order: { entityType: 'ASC', stepNo: 'ASC', minAmount: 'ASC' },
    });
  }

  async createRule(companyId: string, dto: { entityType: string; stepNo: number; approverRoleId: string; minAmount?: number; maxAmount?: number | null }) {
    await this.assertRole(companyId, dto.approverRoleId);
    if (dto.maxAmount != null && dto.maxAmount < (dto.minAmount ?? 0)) throw new BadRequestException('maxAmount must be ≥ minAmount');
    const repo = this.dataSource.getRepository(ApprovalRule);
    return repo.save(
      repo.create({
        companyId,
        entityType: dto.entityType,
        stepNo: dto.stepNo,
        approverRoleId: dto.approverRoleId,
        minAmount: (dto.minAmount ?? 0).toFixed(2),
        maxAmount: dto.maxAmount != null ? dto.maxAmount.toFixed(2) : null,
      }),
    );
  }

  async updateRule(companyId: string, id: string, dto: { stepNo?: number; approverRoleId?: string; minAmount?: number; maxAmount?: number | null; isActive?: boolean }) {
    const repo = this.dataSource.getRepository(ApprovalRule);
    const rule = await repo.findOne({ where: { id, companyId } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (dto.approverRoleId) {
      await this.assertRole(companyId, dto.approverRoleId);
      rule.approverRoleId = dto.approverRoleId;
    }
    if (dto.stepNo !== undefined) rule.stepNo = dto.stepNo;
    if (dto.minAmount !== undefined) rule.minAmount = dto.minAmount.toFixed(2);
    if (dto.maxAmount !== undefined) rule.maxAmount = dto.maxAmount != null ? dto.maxAmount.toFixed(2) : null;
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;
    if (rule.maxAmount != null && Number(rule.maxAmount) < Number(rule.minAmount)) throw new BadRequestException('maxAmount must be ≥ minAmount');
    return repo.save(rule);
  }

  // ---- internals ----
  private async detail(em: EntityManager, companyId: string, requestId: string) {
    const request = await em.findOne(ApprovalRequest, { where: { id: requestId, companyId } });
    if (!request) throw new NotFoundException('Approval request not found');
    const steps = await em.find(ApprovalStep, { where: { requestId }, order: { stepNo: 'ASC' } });
    return { ...request, steps };
  }

  private async holdsStep(em: EntityManager, userId: string, step: ApprovalStep) {
    if (step.approverUserId) return step.approverUserId === userId;
    return step.approverRoleId ? this.holdsAnyRole(em, userId, [step.approverRoleId]) : false;
  }

  private async holdsAnyRole(em: EntityManager, userId: string, roleIds: string[]) {
    if (roleIds.length === 0) return false;
    const rows: unknown[] = await em.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = ANY($2::uuid[])', [userId, roleIds]);
    return rows.length > 0;
  }

  private async assertRole(companyId: string, roleId: string) {
    const rows: unknown[] = await this.dataSource.query('SELECT 1 FROM roles WHERE id = $1 AND company_id = $2', [roleId, companyId]);
    if (rows.length === 0) throw new BadRequestException('Approver role does not belong to this company');
  }

  private async fire(request: ApprovalRequest, outcome: ApprovalOutcome, em: EntityManager) {
    for (const handler of this.handlers.get(request.entityType) ?? []) await handler(request, outcome, em);
  }

  private pendingMessage(r: ApprovalRequest) {
    return { title: `Approval needed: ${r.title}`, body: r.amount ? `Amount ₹${Number(r.amount).toLocaleString('en-IN')}` : undefined, data: this.link(r) };
  }

  private link(r: ApprovalRequest) {
    return { entityType: 'approval_request', entityId: r.id, documentType: r.entityType, documentId: r.entityId };
  }
}
