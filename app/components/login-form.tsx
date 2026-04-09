'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.message || 'Login failed.');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card" style={{ maxWidth: 460, margin: '80px auto' }}>
      <h1 style={{ marginTop: 0 }}>Outlook Junk Rescue</h1>
      <label htmlFor="password"><p className="muted">请输入面板密码。</p></label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error ? <p className="error">{error}</p> : null}
      <div className="actions">
        <button type="submit" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
      </div>
    </form>
  );
}

