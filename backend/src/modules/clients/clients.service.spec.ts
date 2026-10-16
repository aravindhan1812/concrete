import { BadRequestException } from '@nestjs/common';
import { creditStatus, normaliseIdentity } from './clients.service';
import { gstinCheckChar } from './gst';

const gstin = (first14: string) => first14 + gstinCheckChar(first14);
const TN = gstin('33AABCU9603R1Z');

describe('creditStatus', () => {
  it('no limit set', () => expect(creditStatus(500000, null)).toEqual({ utilisation: null, status: 'no_limit' }));
  it('under 80 % is ok', () => expect(creditStatus(700000, 1000000)).toEqual({ utilisation: 70, status: 'ok' }));
  it('80 % and above is near', () => expect(creditStatus(800000, 1000000).status).toBe('near'));
  it('above the limit is over', () => expect(creditStatus(1000001, 1000000).status).toBe('over'));
  it('exactly at the limit is near, not over', () => expect(creditStatus(1000000, 1000000).status).toBe('near'));
  it('advances can make outstanding negative — still ok', () => expect(creditStatus(-50000, 100000).status).toBe('ok'));
  it('a zero limit means cash only: anything owed is over', () => {
    expect(creditStatus(1, 0).status).toBe('over');
    expect(creditStatus(0, 0).status).toBe('ok');
  });
});

describe('normaliseIdentity', () => {
  it('derives state and PAN from the GSTIN', () => {
    expect(normaliseIdentity({ gstin: TN.toLowerCase() })).toEqual({ gstin: TN, stateCode: '33', pan: 'AABCU9603R' });
  });

  it('rejects a PAN that does not match the GSTIN', () => {
    expect(() => normaliseIdentity({ gstin: TN, pan: 'ZZZZZ9999Z' })).toThrow(/does not match/);
  });

  it('accepts a matching PAN in any case', () => {
    expect(normaliseIdentity({ gstin: TN, pan: 'aabcu9603r' }).pan).toBe('AABCU9603R');
  });

  it('uses the given state code only when there is no GSTIN, and validates it', () => {
    expect(normaliseIdentity({ stateCode: '29' }).stateCode).toBe('29');
    expect(normaliseIdentity({ gstin: TN, stateCode: '29' }).stateCode).toBe('33');
    expect(() => normaliseIdentity({ stateCode: '99' })).toThrow(BadRequestException);
  });

  it('clearing the GSTIN clears it; phones are normalised', () => {
    expect(normaliseIdentity({ gstin: '' })).toEqual({ gstin: null });
    expect(normaliseIdentity({ phone: '98400 12345' }).phone).toBe('+919840012345');
  });

  it('rejects an invalid GSTIN with a helpful message', () => {
    expect(() => normaliseIdentity({ gstin: '33AABCU9603R1ZZ' })).toThrow(/check character|15 characters/);
  });
});
