import { date, inr, inrShort } from '../lib/format';
import { ValueFormat } from './types';

const num = new Intl.NumberFormat('en-IN');

/** Display value for tiles: compact rupees (₹12.4L), grouped numbers, one-decimal percentages. */
export function formatValue(value: unknown, format?: ValueFormat | 'date', opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'date') return date(value as string);
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (format === 'inr') return opts.compact ? inrShort(n) : inr(n);
  if (format === 'percent') return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
  return num.format(n);
}

/** Axis ticks: 0 and 3–4 clean steps up to a round maximum. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}
