import { useLocation, useNavigate } from 'react-router-dom';
import { findNav } from '../app/nav';
import { Button, EmptyState, PageHeader } from '../components/ui';

/** Placeholder for modules whose screens are not built yet (see docs/SCOPE.md backlog). */
export default function ComingSoon() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const item = findNav(pathname);
  return (
    <>
      <PageHeader title={item?.label ?? 'Coming soon'} />
      <EmptyState
        icon={item?.icon ?? 'inbox'}
        title="This module is on the way"
        body="The data model is ready; the screens are scheduled in the product backlog."
        action={<Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>}
      />
    </>
  );
}

export function NotFound() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState title="Nothing lives at this address" action={<Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>} />
    </>
  );
}

export function Forbidden() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="No access" />
      <EmptyState
        icon="admin"
        title="Your role doesn't include this module"
        body="Ask a company administrator to grant the permission."
        action={<Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>}
      />
    </>
  );
}
