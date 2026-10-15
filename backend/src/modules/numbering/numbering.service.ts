import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { NumberingSeries } from '../../entities/shared.entities';
import { financialYearFor } from '../accounting/chart-template';

export interface SeriesDefaults {
  prefix: string;
  pattern: string;
  reset: 'yearly' | 'never';
}

const YEARLY = '{PREFIX}/{FY}/{SEQ:4}';

/**
 * Default series per document type. Companies can change prefix / pattern / reset per type;
 * a series row is created from these defaults the first time a number is drawn.
 * Client invoices stay ≤ 16 characters (GST rule): INV/2026-27/0001.
 */
export const DEFAULT_SERIES: Record<string, SeriesDefaults> = {
  lead: { prefix: 'LD', pattern: '{PREFIX}-{SEQ:4}', reset: 'never' },
  client: { prefix: 'CL', pattern: '{PREFIX}-{SEQ:4}', reset: 'never' },
  vendor: { prefix: 'VN', pattern: '{PREFIX}-{SEQ:4}', reset: 'never' },
  project: { prefix: 'PRJ', pattern: '{PREFIX}-{SEQ:4}', reset: 'never' },
  quotation: { prefix: 'QT', pattern: YEARLY, reset: 'yearly' },
  change_order: { prefix: 'CO', pattern: YEARLY, reset: 'yearly' },
  material_request: { prefix: 'MR', pattern: YEARLY, reset: 'yearly' },
  rfq: { prefix: 'RFQ', pattern: YEARLY, reset: 'yearly' },
  purchase_order: { prefix: 'PO', pattern: YEARLY, reset: 'yearly' },
  goods_receipt: { prefix: 'GRN', pattern: YEARLY, reset: 'yearly' },
  work_order: { prefix: 'WO', pattern: YEARLY, reset: 'yearly' },
  ra_bill: { prefix: 'RA', pattern: YEARLY, reset: 'yearly' },
  client_invoice: { prefix: 'INV', pattern: YEARLY, reset: 'yearly' },
  expense: { prefix: 'EXP', pattern: YEARLY, reset: 'yearly' },
  stock_transfer: { prefix: 'TRF', pattern: YEARLY, reset: 'yearly' },
  ncr: { prefix: 'NCR', pattern: YEARLY, reset: 'yearly' },
  permit: { prefix: 'PTW', pattern: YEARLY, reset: 'yearly' },
  incident: { prefix: 'INC', pattern: YEARLY, reset: 'yearly' },
};

const TOKEN = /\{(PREFIX|FY|YYYY|MM|BRANCH|SEQ(?::(\d{1,2}))?)\}/g;

export function validatePattern(pattern: string) {
  if (!/\{SEQ(?::\d{1,2})?\}/.test(pattern)) throw new BadRequestException('Pattern must contain {SEQ} or {SEQ:n}');
  const stripped = pattern.replace(TOKEN, '');
  if (/[{}]/.test(stripped)) throw new BadRequestException('Unknown token in pattern; allowed: {PREFIX} {FY} {YYYY} {MM} {BRANCH} {SEQ:n}');
  if (pattern.length > 60) throw new BadRequestException('Pattern is too long');
}

/** Pure formatter, exported for tests and previews. */
export function formatNumber(pattern: string, t: { prefix: string; fy: string; date: Date; seq: number; branch?: string }): string {
  return pattern.replace(TOKEN, (_m, token: string, pad?: string) => {
    if (token === 'PREFIX') return t.prefix;
    if (token === 'FY') return t.fy;
    if (token === 'YYYY') return String(t.date.getUTCFullYear());
    if (token === 'MM') return String(t.date.getUTCMonth() + 1).padStart(2, '0');
    if (token === 'BRANCH') return t.branch ?? '';
    return String(t.seq).padStart(pad ? Number(pad) : 1, '0');
  });
}

@Injectable()
export class NumberingService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Draws the next number for a document type. Atomic (single UPSERT … RETURNING), so concurrent
   * requests never share a number. Pass the caller's EntityManager to roll the counter back with
   * the document if the transaction fails.
   */
  async next(companyId: string, docType: string, opts: { date?: Date; branch?: string; em?: EntityManager } = {}): Promise<string> {
    const em = opts.em ?? this.dataSource.manager;
    const date = opts.date ?? new Date();
    const series = await this.ensureSeries(em, companyId, docType);
    const fy = financialYearFor(date).name;
    const periodKey = series.reset === 'yearly' ? fy : '';
    const result = await em.query(
      `INSERT INTO number_sequences (series_id, period_key, next_no) VALUES ($1, $2, 2)
       ON CONFLICT (series_id, period_key) DO UPDATE SET next_no = number_sequences.next_no + 1
       RETURNING next_no - 1 AS seq`,
      [series.id, periodKey],
    );
    const rows: { seq: number }[] = Array.isArray(result[0]) ? result[0] : result;
    return formatNumber(series.pattern, { prefix: series.prefix, fy, date, seq: Number(rows[0].seq), branch: opts.branch });
  }

  /** Every known document type with the company's series (or the default it would get). */
  async list(companyId: string) {
    const rows = await this.dataSource.getRepository(NumberingSeries).find({ where: { companyId } });
    const byType = new Map(rows.map((r) => [r.docType, r]));
    const types = new Set([...Object.keys(DEFAULT_SERIES), ...byType.keys()]);
    const fy = financialYearFor(new Date()).name;
    return [...types].sort().map((docType) => {
      const s = byType.get(docType) ?? DEFAULT_SERIES[docType];
      return {
        docType,
        prefix: s.prefix,
        pattern: s.pattern,
        reset: s.reset,
        customised: byType.has(docType),
        example: formatNumber(s.pattern, { prefix: s.prefix, fy, date: new Date(), seq: 1, branch: 'HQ' }),
      };
    });
  }

  /** Changing a series keeps its counters; only future numbers use the new format. */
  async update(companyId: string, docType: string, patch: Partial<SeriesDefaults>) {
    if (patch.pattern) validatePattern(patch.pattern);
    if (patch.prefix !== undefined && !/^[A-Za-z0-9-]{1,10}$/.test(patch.prefix)) throw new BadRequestException('Prefix must be 1–10 letters, digits or dashes');
    const repo = this.dataSource.getRepository(NumberingSeries);
    const series = await this.ensureSeries(this.dataSource.manager, companyId, docType);
    Object.assign(series, {
      ...(patch.prefix !== undefined ? { prefix: patch.prefix } : {}),
      ...(patch.pattern !== undefined ? { pattern: patch.pattern } : {}),
      ...(patch.reset !== undefined ? { reset: patch.reset } : {}),
    });
    return repo.save(series);
  }

  private async ensureSeries(em: EntityManager, companyId: string, docType: string): Promise<NumberingSeries> {
    const existing = await em.findOne(NumberingSeries, { where: { companyId, docType } });
    if (existing) return existing;
    const d = DEFAULT_SERIES[docType];
    if (!d) throw new BadRequestException(`No numbering series for document type "${docType}"`);
    await em.query(
      `INSERT INTO numbering_series (company_id, doc_type, prefix, pattern, reset) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, doc_type) DO NOTHING`,
      [companyId, docType, d.prefix, d.pattern, d.reset],
    );
    return em.findOneOrFail(NumberingSeries, { where: { companyId, docType } });
  }
}
