import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, TextField } from '../components/ui';
import { api, SessionUser, setSession } from '../lib/api';
import { useSession } from '../lib/session';

export default function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.post('/auth/register-company', { companyName, fullName, email, password });
      }
      const result = await api.post<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/login', { email, password });
      setSession(result);
      signIn(result.user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">Concrete</span>
        </div>
        <p className="sub">{mode === 'login' ? 'Sign in to your workspace' : 'Create your company workspace'}</p>
        {mode === 'register' && (
          <>
            <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoComplete="organization" />
            <TextField label="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
          </>
        )}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        <TextField
          label="Password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} style={{ width: '100%' }}>
          {mode === 'login' ? 'Sign in' : 'Create workspace'}
        </Button>
        <Button type="button" variant="ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New company? Register' : 'Have an account? Sign in'}
        </Button>
      </form>
    </div>
  );
}
