import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { visibleNav } from '../app/nav';
import { Icons } from '../app/icons';
import { Alert, Card, Grid, KpiTile, PageHeader, Section } from '../components/ui';
import { api } from '../lib/api';
import { inrShort } from '../lib/format';
import { useSession } from '../lib/session';
import { LeadStatus, PIPELINE } from '../lib/types';

interface StatRow {
  status: LeadStatus;
  count: number;
  value: number;
}

const OPEN: LeadStatus[] = ['new', 'contacted', 'site_visit', 'quotation', 'negotiation'];

/**
 * Home dashboard. Today it shows the sales pipeline (the only live data source) plus a
 * module launcher; the per-role dashboard framework (P0.8) will replace the fixed layout.
 */
export default function Dashboard() {
  const { user, can } = useSession();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [error, setError] = useState('');
  const canSeeLeads = can('crm.leads.read', 'reports.read');

  useEffect(() => {
    if (!canSeeLeads) return;
    api
      .get<StatRow[]>('/crm/leads/stats')
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, [canSeeLeads]);

  const open = stats?.filter((s) => OPEN.includes(s.status)) ?? [];
  const openCount = open.reduce((a, s) => a + s.count, 0);
  const openValue = open.reduce((a, s) => a + s.value, 0);
  const won = stats?.find((s) => s.status === 'won');
  const lost = stats?.find((s) => s.status === 'lost');
  const followUps = stats?.find((s) => s.status === 'negotiation');

  const firstName = user?.fullName.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const modules = visibleNav(can).filter((i) => i.key !== 'home');

  return (
    <>
      <PageHeader title={`${greeting}, ${firstName}`} subtitle={user?.roles.join(' · ')} />
      {error && <Alert onDismiss={() => setError('')}>{error}</Alert>}

      {canSeeLeads && (
        <Section title="Sales pipeline">
          <Grid min={160}>
            <KpiTile label="Open leads" value={stats ? openCount : '—'} icon="leads" onClick={() => navigate('/crm/leads')} />
            <KpiTile label="Pipeline value" value={stats ? inrShort(openValue) : '—'} tone="info" />
            <KpiTile label="In negotiation" value={stats ? followUps?.count ?? 0 : '—'} tone="warning" delta={stats && followUps ? inrShort(followUps.value) : undefined} />
            <KpiTile label="Won" value={stats ? won?.count ?? 0 : '—'} tone="success" delta={stats && won ? inrShort(won.value) : undefined} />
            <KpiTile label="Lost" value={stats ? lost?.count ?? 0 : '—'} tone="danger" />
          </Grid>
          {stats && (
            <div className="funnel">
              {PIPELINE.filter((p) => OPEN.includes(p.status)).map((p) => {
                const row = stats.find((s) => s.status === p.status);
                const pct = openCount ? ((row?.count ?? 0) / openCount) * 100 : 0;
                return (
                  <div className="funnel-row" key={p.status}>
                    <span className="funnel-label">{p.label}</span>
                    <span className="funnel-bar">
                      <span style={{ width: `${Math.max(pct, row?.count ? 4 : 0)}%` }} />
                    </span>
                    <span className="funnel-count">{row?.count ?? 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      <Section title="Modules">
        <Grid min={150}>
          {modules.map((m) => {
            const Icon = Icons[m.icon];
            return (
              <Card key={m.key} onClick={() => navigate(m.path)} className="module-card">
                <Icon />
                <div className="module-title">{m.label}</div>
                {!m.ready && <div className="module-soon">Coming soon</div>}
              </Card>
            );
          })}
        </Grid>
      </Section>
    </>
  );
}
