'use client';

import { useState } from 'react';
import Shell from '@/components/Shell';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { post } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, notify] = useToast();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('The new passwords do not match');
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword, newPassword });
      notify('Password changed');
      setCurrent('');
      setNew('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Your admin account</p>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 className="card-title">Account</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Signed in as
          </p>
          <p style={{ marginTop: 0, fontWeight: 600 }}>{user?.email}</p>
        </div>

        <div className="card">
          <h3 className="card-title">Change password</h3>
          <form onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}
            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>New password (min 6 chars)</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
      {toast}
    </Shell>
  );
}
