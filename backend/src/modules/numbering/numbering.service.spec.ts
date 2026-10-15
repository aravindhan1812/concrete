import { BadRequestException } from '@nestjs/common';
import { DEFAULT_SERIES, formatNumber, validatePattern } from './numbering.service';

const date = new Date('2026-10-15T00:00:00Z');

describe('formatNumber', () => {
  it('formats the yearly default: PREFIX/FY/SEQ:4', () => {
    expect(formatNumber('{PREFIX}/{FY}/{SEQ:4}', { prefix: 'PO', fy: '2026-27', date, seq: 42 })).toBe('PO/2026-27/0042');
  });

  it('supports year, month and branch tokens', () => {
    expect(formatNumber('{BRANCH}-{PREFIX}-{YYYY}{MM}-{SEQ:3}', { prefix: 'GRN', fy: '2026-27', date, seq: 7, branch: 'CHN' })).toBe('CHN-GRN-202610-007');
  });

  it('does not truncate a sequence longer than its padding', () => {
    expect(formatNumber('{PREFIX}-{SEQ:2}', { prefix: 'LD', fy: '', date, seq: 1234 })).toBe('LD-1234');
  });

  it('keeps client invoice numbers within the 16-character GST limit', () => {
    const d = DEFAULT_SERIES.client_invoice;
    expect(formatNumber(d.pattern, { prefix: d.prefix, fy: '2026-27', date, seq: 9999 }).length).toBeLessThanOrEqual(16);
  });

  it('continues the existing lead format', () => {
    const d = DEFAULT_SERIES.lead;
    expect(formatNumber(d.pattern, { prefix: d.prefix, fy: '2026-27', date, seq: 5 })).toBe('LD-0005');
  });
});

describe('validatePattern', () => {
  it('requires a sequence token', () => {
    expect(() => validatePattern('{PREFIX}/{FY}')).toThrow(BadRequestException);
  });
  it('rejects unknown tokens', () => {
    expect(() => validatePattern('{PREFIX}/{DAY}/{SEQ:4}')).toThrow(/Unknown token/);
  });
  it('accepts every supported token', () => {
    expect(() => validatePattern('{BRANCH}/{PREFIX}/{FY}/{YYYY}{MM}/{SEQ:5}')).not.toThrow();
  });
});
