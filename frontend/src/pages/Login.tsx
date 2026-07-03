import { FormEvent, useState } from 'react';
import { api, SessionUser, setSession } from '../lib/api';

interface Props {
  onLogin: (user: SessionUser) => void;
}

export default function Login({ onLogin }: Props) {
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
      const result = await api.post<{ user: SessionUser; accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, password },
      );
      setSession(result);
      onLogin(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>
          Build<em style={{ color: 'var(--accent)', fontStyle: 'normal' }}>Flow</em>
        </h1>
        <p className="sub">
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your company workspace'}
        </p>
        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="company">Company name</label>
              <input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create workspace'}
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'New company? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
