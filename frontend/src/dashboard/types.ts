/** Mirrors backend/src/modules/dashboard (widgets.ts and dashboard-data.service.ts). */
export type WidgetType = 'kpis' | 'trend' | 'funnel' | 'table' | 'alerts' | 'shortcuts';
export type ValueFormat = 'number' | 'inr' | 'percent';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type Severity = 'good' | 'warning' | 'serious' | 'critical';

export interface WidgetMeta {
  key: string;
  title: string;
  description: string;
  type: WidgetType;
  size: 'full' | 'half';
  hidden: boolean;
}

export interface DashboardLayout {
  widgets: WidgetMeta[];
  upcoming: { key: string; title: string; module: string }[];
  customised: boolean;
}

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
