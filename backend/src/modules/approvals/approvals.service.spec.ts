import { ApprovalRule } from '../../entities/shared.entities';
import { matchRules } from './approvals.service';

const rule = (over: Partial<ApprovalRule>): ApprovalRule =>
  ({ id: Math.random().toString(), companyId: 'co-1', entityType: 'purchase_order', stepNo: 1, approverRoleId: 'pm', minAmount: '0', maxAmount: null, isActive: true, createdAt: new Date(0), ...over }) as ApprovalRule;

// Typical PO policy: PM approves everything; Finance joins above ₹1L; Director above ₹10L.
const rules = [
  rule({ stepNo: 1, approverRoleId: 'pm', minAmount: '0' }),
  rule({ stepNo: 2, approverRoleId: 'finance', minAmount: '100000.01' }),
  rule({ stepNo: 3, approverRoleId: 'director', minAmount: '1000000.01' }),
];

describe('matchRules', () => {
  it('small amounts need only the first approver', () => {
    expect(matchRules(rules, 25000).map((r) => r.approverRoleId)).toEqual(['pm']);
  });

  it('band edges are inclusive and exact to the paisa', () => {
    expect(matchRules(rules, 100000).map((r) => r.approverRoleId)).toEqual(['pm']);
    expect(matchRules(rules, 100000.01).map((r) => r.approverRoleId)).toEqual(['pm', 'finance']);
  });

  it('large amounts chain every step in order', () => {
    expect(matchRules(rules, 2500000).map((r) => r.approverRoleId)).toEqual(['pm', 'finance', 'director']);
  });

  it('respects upper bounds and inactive rules', () => {
    const banded = [rule({ approverRoleId: 'site', maxAmount: '5000' }), rule({ approverRoleId: 'pm', minAmount: '5000.01' }), rule({ approverRoleId: 'old', isActive: false })];
    expect(matchRules(banded, 3000).map((r) => r.approverRoleId)).toEqual(['site']);
    expect(matchRules(banded, 8000).map((r) => r.approverRoleId)).toEqual(['pm']);
  });

  it('no matching rule means no steps (auto-approve)', () => {
    expect(matchRules([rule({ minAmount: '1000' })], 10)).toEqual([]);
  });

  it('orders by step number regardless of input order', () => {
    expect(matchRules([...rules].reverse(), 2500000).map((r) => r.stepNo)).toEqual([1, 2, 3]);
  });
});
