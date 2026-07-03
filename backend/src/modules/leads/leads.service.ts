import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { LeadFollowUp } from '../../entities/lead-follow-up.entity';
import { Lead, LEAD_TRANSITIONS, LeadStatus } from '../../entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ChangeStatusDto, CreateFollowUpDto, QueryLeadsDto, UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(LeadFollowUp) private readonly followUps: Repository<LeadFollowUp>,
  ) {}

  /** Every query is scoped by companyId — tenant isolation is enforced here, not trusted from the client. */
  async findAll(companyId: string, q: QueryLeadsDto) {
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const where: Record<string, unknown>[] = [];
    const base: Record<string, unknown> = { companyId };
    if (q.status) base.status = q.status;
    if (q.search) {
      where.push({ ...base, title: ILike(`%${q.search}%`) });
      where.push({ ...base, contactName: ILike(`%${q.search}%`) });
      where.push({ ...base, phone: ILike(`%${q.search}%`) });
    } else {
      where.push(base);
    }
    const [data, total] = await this.leads.findAndCount({
      where: where as never,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async findOne(companyId: string, id: string) {
    const lead = await this.leads.findOne({ where: { id, companyId }, relations: ['followUps'] });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(companyId: string, userId: string, dto: CreateLeadDto) {
    const lead = this.leads.create({
      ...dto,
      companyId,
      createdBy: userId,
      ownerId: dto.ownerId ?? userId,
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
      code: await this.nextCode(companyId),
    });
    return this.leads.save(lead);
  }

  async update(companyId: string, id: string, dto: UpdateLeadDto) {
    const lead = await this.findOne(companyId, id);
    Object.assign(lead, {
      ...dto,
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : lead.nextFollowUpAt,
    });
    return this.leads.save(lead);
  }

  /** Pipeline moves must follow the state machine; losing a lead requires a reason. */
  async changeStatus(companyId: string, id: string, dto: ChangeStatusDto) {
    const lead = await this.findOne(companyId, id);
    const allowed = LEAD_TRANSITIONS[lead.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot move lead from "${lead.status}" to "${dto.status}". Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
    if (dto.status === LeadStatus.LOST && !dto.lostReason) {
      throw new BadRequestException('A reason is required when marking a lead as lost');
    }
    lead.status = dto.status;
    lead.lostReason = dto.status === LeadStatus.LOST ? dto.lostReason : undefined;
    return this.leads.save(lead);
  }

  async remove(companyId: string, id: string) {
    const lead = await this.findOne(companyId, id);
    await this.leads.softRemove(lead);
    return { id, deleted: true };
  }

  async addFollowUp(companyId: string, userId: string, leadId: string, dto: CreateFollowUpDto) {
    const lead = await this.findOne(companyId, leadId);
    const followUp = await this.followUps.save(
      this.followUps.create({
        companyId,
        leadId: lead.id,
        type: dto.type,
        summary: dto.summary,
        outcome: dto.outcome,
        followUpAt: new Date(dto.followUpAt),
        createdBy: userId,
      }),
    );
    lead.nextFollowUpAt = followUp.followUpAt;
    await this.leads.save(lead);
    return followUp;
  }

  /** Pipeline stats for the sales dashboard. */
  async stats(companyId: string) {
    const rows: { status: LeadStatus; count: string; value: string | null }[] = await this.leads
      .createQueryBuilder('l')
      .select('l.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(l.estimated_value)', 'value')
      .where('l.company_id = :companyId AND l.deleted_at IS NULL', { companyId })
      .groupBy('l.status')
      .getRawMany();
    return rows.map((r) => ({ status: r.status, count: Number(r.count), value: Number(r.value ?? 0) }));
  }

  private async nextCode(companyId: string): Promise<string> {
    const count = await this.leads.count({ where: { companyId }, withDeleted: true });
    return `LD-${String(count + 1).padStart(4, '0')}`;
  }
}
