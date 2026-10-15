import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useViewport } from '../hooks/useMediaQuery';
import { useSession } from '../lib/session';
import { Icons } from './icons';
import NotificationBell from './NotificationBell';
import { findNav, mobileNav, NAV_GROUPS, NavItem, visibleNav } from './nav';

const COLLAPSE_KEY = 'concrete.sidebar.collapsed';

/**
 * Responsive application shell.
 *  - phone  (<640):  top bar + bottom navigation (4 items + More sheet)
 *  - tablet (640–1023): icon rail, expandable on demand
 *  - desktop (≥1024): full sidebar, collapsible to a rail
 */
export default function Shell() {
  const { user, can, signOut, theme, toggleTheme } = useSession();
  const viewport = useViewport();
  const location = useLocation();
  const items = useMemo(() => visibleNav(can), [can]);
  // null = no explicit choice yet: tablets default to the rail, desktops to the full sidebar.
  const [collapsed, setCollapsed] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(COLLAPSE_KEY);
      return v === '1' ? true : v === '0' ? false : null;
    } catch {
      return null;
    }
  });
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);
  useEffect(() => {
    if (collapsed === null) return;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const current = findNav(location.pathname);
  useEffect(() => {
    document.title = current ? `${current.label} · Concrete` : 'Concrete';
  }, [current]);

  if (viewport === 'phone') {
    const bar = mobileNav(items);
    const inBar = new Set(bar.map((i) => i.key));
    const moreActive = !!current && !inBar.has(current.key);
    return (
      <div className="shell phone">
        <header className="topbar-mobile">
          <span className="brand">Concrete</span>
          <div className="topbar-actions">
            <NotificationBell />
            <button className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
              {theme === 'light' ? <Icons.moon /> : <Icons.sun />}
            </button>
          </div>
        </header>
        <main className="main" id="main">
          <Outlet />
        </main>
        <nav className="bottom-nav" aria-label="Primary">
          {bar.map((item) => (
            <BottomItem key={item.key} item={item} />
          ))}
          <button className={`bottom-item${moreActive || moreOpen ? ' active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <Icons.more />
            <span>More</span>
          </button>
        </nav>
        {moreOpen && (
          <div className="dialog-backdrop" onClick={() => setMoreOpen(false)}>
            <div className="dialog more-sheet" role="dialog" aria-modal="true" aria-label="All modules" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-head">
                <div className="sheet-handle" />
                <h2>All modules</h2>
                <button className="icon-btn" aria-label="Close" onClick={() => setMoreOpen(false)}>
                  <Icons.close />
                </button>
              </div>
              <div className="dialog-body">
                <div className="more-grid">
                  {items.map((item) => (
                    <MoreItem key={item.key} item={item} />
                  ))}
                </div>
                <div className="more-footer">
                  <div className="user-chip">
                    <Avatar name={user?.fullName ?? ''} />
                    <div>
                      <div className="user-name">{user?.fullName}</div>
                      <div className="user-roles">{user?.roles.join(', ')}</div>
                    </div>
                  </div>
                  <button className="btn secondary" onClick={signOut}>
                    <Icons.signOut width={18} height={18} /> Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const rail = collapsed ?? viewport === 'tablet';
  return (
    <div className={`shell${rail ? ' rail' : ''}`}>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-top">
          <NavLink to="/" className="brand" aria-label="Concrete home">
            <span className="brand-mark">C</span>
            <span className="brand-text">Concrete</span>
          </NavLink>
          <button className="icon-btn collapse" aria-label={rail ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed(!rail)}>
            {rail ? <Icons.chevronRight /> : <Icons.chevronLeft />}
          </button>
        </div>
        <div className="sidebar-scroll">
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div className="nav-group" key={group}>
                <div className="nav-group-label">{group}</div>
                {groupItems.map((item) => (
                  <SideItem key={item.key} item={item} rail={rail} />
                ))}
              </div>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <NotificationBell withLabel />
          <button className="nav-item" onClick={toggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
            {theme === 'light' ? <Icons.moon /> : <Icons.sun />}
            <span className="nav-label">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
          <div className="user-chip" title={user?.roles.join(', ')}>
            <Avatar name={user?.fullName ?? ''} />
            <div className="nav-label">
              <div className="user-name">{user?.fullName}</div>
              <div className="user-roles">{user?.roles[0]}</div>
            </div>
          </div>
          <button className="nav-item" onClick={signOut} title="Sign out">
            <Icons.signOut />
            <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}

function SideItem({ item, rail }: { item: NavItem; rail: boolean }) {
  const Icon = Icons[item.icon];
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${item.ready ? '' : ' soon'}`} title={rail ? item.label : undefined}>
      <Icon />
      <span className="nav-label">{item.label}</span>
      {!item.ready && <span className="soon-dot" aria-label="Coming soon" />}
    </NavLink>
  );
}

function BottomItem({ item }: { item: NavItem }) {
  const Icon = Icons[item.icon];
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `bottom-item${isActive ? ' active' : ''}`}>
      <Icon />
      <span>{item.label}</span>
    </NavLink>
  );
}

function MoreItem({ item }: { item: NavItem }) {
  const Icon = Icons[item.icon];
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => `more-item${isActive ? ' active' : ''}${item.ready ? '' : ' soon'}`}>
      <span className="more-icon">
        <Icon />
      </span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return <span className="avatar" aria-hidden>{initials || '?'}</span>;
}
