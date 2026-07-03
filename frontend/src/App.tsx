import { useEffect, useState } from 'react';
import { clearSession, hasSession, SessionUser } from './lib/api';
import Leads from './pages/Leads';
import Login from './pages/Login';

const NAV = [
  { key: 'leads', label: 'Leads', ready: true },
  { key: 'quotations', label: 'Quotations', ready: false },
  { key: 'projects', label: 'Projects', ready: false },
  { key: 'site', label: 'Site', ready: false },
  { key: 'procurement', label: 'Procurement', ready: false },
  { key: 'inventory', label: 'Inventory', ready: false },
  { key: 'finance', label: 'Finance', ready: false },
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [page, setPage] = useState('leads');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!user || !hasSession()) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Build<em>Flow</em>
        </div>
        {NAV.map((item) => (
          <a
            key={item.key}
            href="#"
            className={`nav-item${page === item.key ? ' active' : ''}`}
            style={item.ready ? undefined : { opacity: 0.45, pointerEvents: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              if (item.ready) setPage(item.key);
            }}
          >
            {item.label}
            {!item.ready && ' · soon'}
          </a>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '0 4px' }}>{user.fullName}</div>
          <button
            className="btn ghost"
            onClick={() => {
              clearSession();
              setUser(null);
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{page === 'leads' && <Leads />}</main>
    </div>
  );
}
