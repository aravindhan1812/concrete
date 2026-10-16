import { gstinCheckChar, normalisePan, normalisePhone, parseGstin } from './gst';

// Built from a real-format PAN so the check character is computed, not guessed.
const base = '33AABCU9603R1Z';
const valid = base + gstinCheckChar(base);

describe('parseGstin', () => {
  it('accepts a valid GSTIN and derives state and PAN', () => {
    const r = parseGstin(valid.toLowerCase());
    expect(r).toEqual({ gstin: valid, stateCode: '33', stateName: 'Tamil Nadu', pan: 'AABCU9603R' });
  });

  it('rejects a wrong check character', () => {
    const wrong = base + (valid[14] === 'A' ? 'B' : 'A');
    expect(parseGstin(wrong)).toEqual({ error: expect.stringMatching(/check character/) });
  });

  it('rejects malformed numbers and unknown state codes', () => {
    expect(parseGstin('33AABCU9603R1Y5')).toEqual({ error: expect.stringMatching(/15 characters/) });
    const bad = '99AABCU9603R1Z';
    expect(parseGstin(bad + gstinCheckChar(bad))).toEqual({ error: expect.stringMatching(/state code 99/) });
  });

  it('matches the published check digit of a known GSTIN', () => {
    // 27AAPFU0939F1ZV is the GSTN example GSTIN.
    expect(gstinCheckChar('27AAPFU0939F1Z')).toBe('V');
  });
});

describe('normalisePan / normalisePhone', () => {
  it('upper-cases a valid PAN and rejects bad ones', () => {
    expect(normalisePan(' aabcu9603r ')).toBe('AABCU9603R');
    expect(normalisePan('AABCU960')).toEqual({ error: expect.any(String) });
  });
  it('normalises Indian numbers to +91', () => {
    expect(normalisePhone('98400 12345')).toBe('+919840012345');
    expect(normalisePhone('09840012345')).toBe('+919840012345');
    expect(normalisePhone('+91 98400-12345')).toBe('+919840012345');
    expect(normalisePhone('044 2345 6789')).toBe('+914423456789');
  });
});
