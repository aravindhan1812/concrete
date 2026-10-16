import { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { NAV } from './app/nav';
import Shell from './app/Shell';
import { SessionProvider, useSession } from './lib/session';
import ComingSoon, { Forbidden, NotFound } from './pages/ComingSoon';
import Dashboard from './pages/Dashboard';
import ClientsRoutes from './pages/clients';
import Leads from './pages/Leads';
import Login from './pages/Login';

/** Renders children only if the user holds one of the permissions; otherwise a friendly 403. */
function Guard({ permissions, children }: { permissions: string[]; children: ReactNode }) {
  const { can } = useSession();
  return can(...permissions) ? <>{children}</> : <Forbidden />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

const PAGES: Record<string, ReactNode> = {
  home: <Dashboard />,
  leads: <Leads />,
  clients: <ClientsRoutes />,
};

function AppRoutes() {
  const { user } = useSession();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        {NAV.map((item) => (
          <Route
            key={item.key}
            path={item.path === '/' ? '/' : `${item.path}/*`}
            element={<Guard permissions={item.permissions}>{item.ready ? PAGES[item.key] : <ComingSoon />}</Guard>}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
