import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProjectScopeService } from '../../common/project-scope/project-scope.service';
import { AuthUser } from '../../common/types';
import { financialYearFor, monthlyPeriods } from '../accounting/chart-template';
import { ApprovalsService } from '../approvals/approvals.service';

/** Data shapes per widget type — the frontend renders these without knowing the widget. */
export type ValueFormat = 'number' | 'inr' | 'percent';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type Severity = 'good' | 'warning' | 'serious' | 'critical';

export interface KpisData {
  items: { label: string; value: number; format: ValueFormat; tone?: Tone; hint?: string; link?: string }[];
}
export interface TrendData {
  points: { label: string; value: number }[];
  format: ValueFormat;
  total: number;
  totalLabel: string;
}
export interface FunnelData {
  rows: { label: string; value: number }[];
  link?: string;
}
export interface TableData {
  columns: { key: string; label: string; align?: 'left' | 'right'; format?: ValueFormat | 'date' }[];
  rows: Record<string, unknown>[];
  emptyText: string;
  link?: string;
}
export interface AlertsData {
  items: { title: string; detail?: string; severity: Severity }[];
  emptyText: string;
  link?: string;
}

const LEAD_STAGES: [string, string][] = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['site_visit', 'Site visit'],
  ['quotation', 'Quotation'],
  ['negotiation', 'Negotiation'],
];
/** ₹12.4L / ₹3.2Cr — for short hints; tiles format their own values. */
function formatInrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * One method per live widget. Every query is tenant-scoped, and project-level widgets go through
 * ProjectScopeService so a site engineer's dashboard only counts their own projects.
 */
@Injectable()
export class DashboardDataService {
  constructor(
    private readonly ds: DataSource,
    private readonly scope: ProjectScopeService,
    private readonly approvals: ApprovalsService,
  ) {}

  async load(user: AuthUser, key: string, today = new Date()): Promise<unknown> {
    switch (key) {
      case 'finance.position':
        return this.financePosition(user);
      case 'finance.revenue_trend':
        return this.revenueTrend(user, today);
      case 'finance.receivables_top':
        return this.receivablesTop(user);
      case 'projects.summary':
        return this.projectsSummary(user);
      case 'projects.list':
        return this.projectsList(user);
      case 'site.open_issues':
        return this.openIssues(user);
      case 'sales.pipeline':
        return this.salesPipeline(user);
      case 'sales.funnel':
        return this.salesFunnel(user);
      case 'sales.followups':
        return this.followUps(user, today);
      case 'approvals.inbox':
        return this.approvalsTable(user, 'inbox');
      case 'approvals.mine':
        return this.approvalsTable(user, 'mine');
      case 'shortcuts':
        return {};
      default:
        throw new NotFoundException(`Unknown widget ${key}`);
    }
  }

  // ---------- Finance (ledger) ----------

  /** Balance per system key, debit-positive for assets, credit-positive for liabilities. */
  private async balancesByKey(companyId: string): Promise<Map<string, number>> {
    const rows: { key: string; type: string; dr: string; cr: string }[] = await this.ds.query(
      `SELECT COALESCE(a.system_key, p.system_key || ':child') AS key, a.type,
              COALESCE(SUM(l.debit), 0) AS dr, COALESCE(SUM(l.credit), 0) AS cr
       FROM accounts a
       LEFT JOIN accounts p ON p.id = a.parent_id
       LEFT JOIN journal_lines l ON l.account_id = a.id
            AND EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.entry_id AND e.status IN ('posted','reversed'))
       WHERE a.company_id = $1 AND NOT a.is_group
       GROUP BY 1, a.type`,
      [companyId],
    );
    const out = new Map<string, number>();
    for (const r of rows) {
      const debitPositive = r.type === 'asset' || r.type === 'expense';
      const bal = debitPositive ? Number(r.dr) - Number(r.cr) : Number(r.cr) - Number(r.dr);
      out.set(r.key, (out.get(r.key) ?? 0) + bal);
    }
    return out;
  }

  private async financePosition(user: AuthUser): Promise<KpisData> {
    const b = await this.balancesByKey(user.companyId);
    // Every bank ledger sits beside the "bank" system account under the Bank Accounts group.
    const bankRows: { bal: string }[] = await this.ds.query(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS bal
       FROM accounts a
       JOIN journal_lines l ON l.account_id = a.id
       JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       WHERE a.company_id = $1 AND (a.system_key IN ('cash','bank')
             OR a.parent_id = (SELECT parent_id FROM accounts WHERE company_id = $1 AND system_key = 'bank'))`,
      [user.companyId],
    );
    const v = (k: string) => b.get(k) ?? 0;
    const receivables = v('ar_control') + v('retention_receivable');
    const payables = v('ap_control') + v('retention_payable');
    const netGst = v('output_gst') - v('input_gst');
    return {
      items: [
        { label: 'Cash & bank', value: Number(bankRows[0]?.bal ?? 0), format: 'inr', tone: 'info', link: '/accounting' },
        { label: 'Receivables', value: receivables, format: 'inr', tone: 'success', hint: 'incl. retention', link: '/accounting' },
        { label: 'Payables', value: payables, format: 'inr', tone: 'warning', hint: 'incl. retention', link: '/accounting' },
        { label: netGst >= 0 ? 'GST payable' : 'GST credit', value: Math.abs(netGst), format: 'inr', tone: 'neutral', link: '/accounting' },
      ],
    };
  }

  private async revenueTrend(user: AuthUser, today: Date): Promise<TrendData> {
    const fy = financialYearFor(today);
    const rows: { month: string; amount: string }[] = await this.ds.query(
      `SELECT to_char(e.entry_date, 'YYYY-MM') AS month, SUM(l.credit - l.debit) AS amount
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       JOIN accounts a ON a.id = l.account_id
       WHERE l.company_id = $1 AND a.system_key = 'contract_revenue' AND e.entry_date BETWEEN $2 AND $3
       GROUP BY 1`,
      [user.companyId, fy.startDate, fy.endDate],
    );
    const byMonth = new Map(rows.map((r) => [r.month, Number(r.amount)]));
    const points = monthlyPeriods(fy.startDate, fy.endDate).map((p) => {
      const ym = p.periodStart.slice(0, 7);
      return { label: MONTHS[Number(ym.slice(5, 7)) - 1], value: byMonth.get(ym) ?? 0 };
    });
    return { points, format: 'inr', total: points.reduce((a, p) => a + p.value, 0), totalLabel: `FY ${fy.name} to date` };
  }

  private async receivablesTop(user: AuthUser): Promise<TableData> {
    const rows: { client: string | null; balance: string }[] = await this.ds.query(
      `SELECT c.name AS client, SUM(l.debit - l.credit) AS balance
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','reversed')
       JOIN accounts a ON a.id = l.account_id AND a.system_key IN ('ar_control','retention_receivable')
       LEFT JOIN clients c ON c.id = l.party_id
       WHERE l.company_id = $1 AND l.party_type = 'client'
       GROUP BY c.name, l.party_id
       HAVING SUM(l.debit - l.credit) > 0
       ORDER BY balance DESC
       LIMIT 5`,
      [user.companyId],
    );
    return {
      columns: [
        { key: 'client', label: 'Client' },
        { key: 'balance', label: 'Outstanding', align: 'right', format: 'inr' },
      ],
      rows: rows.map((r) => ({ client: r.client ?? 'Unknown client', balance: Number(r.balance) })),
      emptyText: 'Nothing outstanding.',
      link: '/accounting',
    };
  }

  // ---------- Projects & site (project-scoped) ----------

  /** SQL fragment + params restricting to the user's projects. */
  private async projectFilter(user: AuthUser, column: string, params: unknown[]): Promise<string> {
    const ids = await this.scope.projectIds(user);
    if (ids === null) return '';
    params.push(ids);
    return ` AND ${column} = ANY($${params.length}::uuid[])`;
  }

  private async projectsSummary(user: AuthUser): Promise<KpisData> {
    const params: unknown[] = [user.companyId];
    const scope = await this.projectFilter(user, 'p.id', params);
    const [r]: { active: string; planned: string; on_hold: string; value: string; progress: string | null }[] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active') AS active,
              COUNT(*) FILTER (WHERE status = 'planned') AS planned,
              COUNT(*) FILTER (WHERE status = 'on_hold') AS on_hold,
              COALESCE(SUM(contract_value) FILTER (WHERE status IN ('active','planned','on_hold')), 0) AS value,
              AVG(progress_pct) FILTER (WHERE status = 'active') AS progress
       FROM projects p WHERE p.company_id = $1 AND p.deleted_at IS NULL${scope}`,
      params,
    );
    return {
      items: [
        { label: 'Active projects', value: Number(r.active), format: 'number', tone: 'info', link: '/projects' },
        { label: 'Planned', value: Number(r.planned), format: 'number', link: '/projects' },
        {
          label: 'On hold',
          value: Number(r.on_hold),
          format: 'number',
          tone: Number(r.on_hold) > 0 ? 'warning' : 'neutral',
          link: '/projects',
        },
        { label: 'Contract value', value: Number(r.value), format: 'inr', tone: 'success', hint: 'active, planned, on hold' },
        { label: 'Average progress', value: Number(r.progress ?? 0), format: 'percent', hint: 'active projects' },
      ],
    };
  }

  private async projectsList(user: AuthUser): Promise<TableData> {
    const params: unknown[] = [user.companyId];
    const scope = await this.projectFilter(user, 'p.id', params);
    const rows: { name: string; code: string | null; status: string; progress: string; end_date: string | null }[] = await this.ds.query(
      `SELECT name, code, status, progress_pct AS progress, end_date
       FROM projects p WHERE p.company_id = $1 AND p.deleted_at IS NULL AND p.status IN ('active','planned','on_hold')${scope}
       ORDER BY (status = 'active') DESC, end_date NULLS LAST LIMIT 8`,
      params,
    );
    return {
      columns: [
        { key: 'name', label: 'Project' },
        { key: 'status', label: 'Status' },
        { key: 'progress', label: 'Progress', align: 'right', format: 'percent' },
        { key: 'endDate', label: 'Due', align: 'right', format: 'date' },
      ],
      rows: rows.map((r) => ({
        name: r.code ? `${r.code} · ${r.name}` : r.name,
        status: r.status.charAt(0).toUpperCase() + r.status.slice(1).replace('_', ' '),
        progress: Number(r.progress),
        endDate: r.end_date,
      })),
      emptyText: user.dataScope === 'assigned_projects' ? 'You are not assigned to any active project yet.' : 'No active projects yet.',
      link: '/projects',
    };
  }

  private async openIssues(user: AuthUser): Promise<AlertsData> {
    const params: unknown[] = [user.companyId];
    const scope = await this.projectFilter(user, 'i.project_id', params);
    const rows: { title: string; type: string; severity: string; project: string; created_at: Date; delay_days: number | null }[] =
      await this.ds.query(
        `SELECT i.title, i.type, i.severity, p.name AS project, i.created_at, i.delay_days
       FROM site_issues i JOIN projects p ON p.id = i.project_id AND p.deleted_at IS NULL
       WHERE i.company_id = $1 AND i.status <> 'resolved'${scope}
       ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, i.created_at
       LIMIT 6`,
        params,
      );
    const sev: Record<string, Severity> = { critical: 'critical', high: 'serious', medium: 'warning', low: 'good' };
    return {
      items: rows.map((r) => ({
        title: r.title,
        detail: [r.project, r.type, r.delay_days ? `${r.delay_days} days delay` : null].filter(Boolean).join(' · '),
        severity: sev[r.severity] ?? 'warning',
      })),
      emptyText: 'No open issues on your projects.',
      link: '/site',
    };
  }

  // ---------- Sales ----------

  private async leadStats(companyId: string) {
    const rows: { status: string; count: string; value: string | null }[] = await this.ds.query(
      `SELECT status, COUNT(*) AS count, SUM(estimated_value) AS value FROM leads
       WHERE company_id = $1 AND deleted_at IS NULL GROUP BY status`,
      [companyId],
    );
    return new Map(rows.map((r) => [r.status, { count: Number(r.count), value: Number(r.value ?? 0) }]));
  }

  private async salesPipeline(user: AuthUser): Promise<KpisData> {
    const s = await this.leadStats(user.companyId);
    const open = LEAD_STAGES.map(([k]) => s.get(k) ?? { count: 0, value: 0 });
    const won = s.get('won') ?? { count: 0, value: 0 };
    const lost = s.get('lost') ?? { count: 0, value: 0 };
    const decided = won.count + lost.count;
    return {
      items: [
        { label: 'Open leads', value: open.reduce((a, x) => a + x.count, 0), format: 'number', tone: 'info', link: '/crm/leads' },
        { label: 'Pipeline value', value: open.reduce((a, x) => a + x.value, 0), format: 'inr', tone: 'info' },
        {
          label: 'Won',
          value: won.count,
          format: 'number',
          tone: 'success',
          hint: won.value ? `worth ${formatInrShort(won.value)}` : undefined,
        },
        {
          label: 'Win rate',
          value: decided ? (won.count / decided) * 100 : 0,
          format: 'percent',
          hint: `${won.count} won of ${decided} decided`,
        },
      ],
    };
  }

  private async salesFunnel(user: AuthUser): Promise<FunnelData> {
    const s = await this.leadStats(user.companyId);
    return { rows: LEAD_STAGES.map(([k, label]) => ({ label, value: s.get(k)?.count ?? 0 })), link: '/crm/leads' };
  }

  private async followUps(user: AuthUser, today: Date): Promise<TableData> {
    const until = new Date(today.getTime() + 2 * 86_400_000);
    const rows: { code: string | null; title: string; contact_name: string; next_follow_up_at: Date }[] = await this.ds.query(
      `SELECT code, title, contact_name, next_follow_up_at FROM leads
       WHERE company_id = $1 AND deleted_at IS NULL AND status NOT IN ('won','lost')
         AND next_follow_up_at IS NOT NULL AND next_follow_up_at <= $2
       ORDER BY next_follow_up_at LIMIT 8`,
      [user.companyId, until],
    );
    return {
      columns: [
        { key: 'lead', label: 'Lead' },
        { key: 'contact', label: 'Contact' },
        { key: 'due', label: 'Due', align: 'right', format: 'date' },
      ],
      rows: rows.map((r) => ({ lead: r.code ? `${r.code} · ${r.title}` : r.title, contact: r.contact_name, due: r.next_follow_up_at })),
      emptyText: 'No follow-ups due.',
      link: '/crm/leads',
    };
  }

  // ---------- Approvals ----------

  private async approvalsTable(user: AuthUser, box: 'inbox' | 'mine'): Promise<TableData> {
    const res = await this.approvals.list(user, box, { status: 'pending', pageSize: 6 });
    return {
      columns: [
        { key: 'title', label: 'Request' },
        { key: 'amount', label: 'Amount', align: 'right', format: 'inr' },
        { key: 'raised', label: 'Raised', align: 'right', format: 'date' },
      ],
      rows: res.data.map((r) => ({
        title: r.title ?? r.entityType,
        amount: r.amount != null ? Number(r.amount) : null,
        raised: r.createdAt,
      })),
      emptyText: box === 'inbox' ? 'Nothing waiting for you.' : 'No pending requests.',
    };
  }
}
