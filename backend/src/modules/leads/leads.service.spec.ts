import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeadFollowUp } from '../../entities/lead-follow-up.entity';
import { Lead, LeadStatus } from '../../entities/lead.entity';
import { NumberingService } from '../numbering/numbering.service';
import { LeadsService } from './leads.service';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'saved-id', ...x })),
  findOne: jest.fn(),
  findAndCount: jest.fn(async () => [[], 0]),
  count: jest.fn(async () => 4),
  softRemove: jest.fn(async (x) => x),
  createQueryBuilder: jest.fn(),
});

describe('LeadsService', () => {
  let service: LeadsService;
  let leads: ReturnType<typeof mockRepo>;
  let followUps: ReturnType<typeof mockRepo>;
  let numbering: { next: jest.Mock };
  const module_numbering = () => numbering;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: getRepositoryToken(Lead), useFactory: mockRepo },
        { provide: getRepositoryToken(LeadFollowUp), useFactory: mockRepo },
        { provide: NumberingService, useValue: { next: jest.fn(async () => 'LD-0005') } },
      ],
    }).compile();
    service = module.get(LeadsService);
    leads = module.get(getRepositoryToken(Lead));
    followUps = module.get(getRepositoryToken(LeadFollowUp));
    numbering = module.get(NumberingService);
  });

  it('creates a lead scoped to the company with a serial code', async () => {
    const result = await service.create('co-1', 'user-1', {
      title: '3BHK interior fit-out',
      contactName: 'Ravi',
    } as never);
    expect(module_numbering().next).toHaveBeenCalledWith('co-1', 'lead');
    expect(result.code).toBe('LD-0005');
    expect(result.companyId).toBe('co-1');
    expect(result.ownerId).toBe('user-1'); // defaults to creator
  });

  it('throws NotFound for a lead from another tenant', async () => {
    leads.findOne.mockResolvedValue(null);
    await expect(service.findOne('co-1', 'lead-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(leads.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lead-x', companyId: 'co-1' } }));
  });

  it('allows a legal pipeline transition (new -> contacted)', async () => {
    leads.findOne.mockResolvedValue({ id: 'l1', companyId: 'co-1', status: LeadStatus.NEW });
    const updated = await service.changeStatus('co-1', 'l1', { status: LeadStatus.CONTACTED });
    expect(updated.status).toBe(LeadStatus.CONTACTED);
  });

  it('rejects an illegal transition (new -> won)', async () => {
    leads.findOne.mockResolvedValue({ id: 'l1', companyId: 'co-1', status: LeadStatus.NEW });
    await expect(service.changeStatus('co-1', 'l1', { status: LeadStatus.WON })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a reason when marking a lead lost', async () => {
    leads.findOne.mockResolvedValue({ id: 'l1', companyId: 'co-1', status: LeadStatus.NEW });
    await expect(service.changeStatus('co-1', 'l1', { status: LeadStatus.LOST })).rejects.toBeInstanceOf(BadRequestException);
    const ok = await service.changeStatus('co-1', 'l1', {
      status: LeadStatus.LOST,
      lostReason: 'Budget mismatch',
    });
    expect(ok.status).toBe(LeadStatus.LOST);
  });

  it('recording a follow-up updates the lead next follow-up date', async () => {
    leads.findOne.mockResolvedValue({ id: 'l1', companyId: 'co-1', status: LeadStatus.NEW });
    const when = '2026-07-10T10:00:00.000Z';
    await service.addFollowUp('co-1', 'user-1', 'l1', {
      type: 'call',
      summary: 'Discussed budget',
      followUpAt: when,
    });
    expect(followUps.save).toHaveBeenCalled();
    expect(leads.save).toHaveBeenCalledWith(expect.objectContaining({ nextFollowUpAt: new Date(when) }));
  });
});
