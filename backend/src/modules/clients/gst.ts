/**
 * GSTIN / PAN helpers. A GSTIN is 15 characters: 2-digit state code, the 10-character PAN, the
 * entity number, 'Z', and a check character (base-36 checksum).
 */

/** GST state / UT codes (place of supply). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

const GSTIN_RE = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export interface GstinInfo {
  gstin: string;
  stateCode: string;
  stateName: string;
  pan: string;
}

/** Returns parsed details, or an error message for the person typing it. */
export function parseGstin(raw: string): GstinInfo | { error: string } {
  const gstin = raw.trim().toUpperCase();
  const m = GSTIN_RE.exec(gstin);
  if (!m) return { error: 'GSTIN must be 15 characters: state code, PAN, entity number, Z, check character' };
  if (!GST_STATES[m[1]]) return { error: `GSTIN state code ${m[1]} is not a valid GST state` };
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14])
    return { error: 'GSTIN check character does not match — please re-check the number' };
  return { gstin, stateCode: m[1], stateName: GST_STATES[m[1]], pan: m[2] };
}

export function normalisePan(raw: string): string | { error: string } {
  const pan = raw.trim().toUpperCase();
  return PAN_RE.test(pan) ? pan : { error: 'PAN must be 10 characters: 5 letters, 4 digits, 1 letter' };
}

/** Indian mobile / landline, kept as digits with an optional leading +91. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+91\d{10}$/.test(digits)) return digits;
  if (/^0?\d{10}$/.test(digits)) return '+91' + digits.slice(-10);
  return digits;
}
