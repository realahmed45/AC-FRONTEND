'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = { name: '', city: '', teams: [], notes: '' };

export default function AreasPage() {
  const [areas, setAreas] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ars, tms] = await Promise.all([get('/areas'), get('/teams')]);
      setAreas(ars);
      setTeams(tms);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(area) {
    if (!confirm(`Delete ${area.name}? Its price overrides will be removed too.`)) return;
    try {
      await del(`/areas/${area._id}`);
      notify('Area deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Areas</h1>
          <p>Service areas and the teams that cover them</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>
          + New area
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading…</div>
        ) : areas.length === 0 ? (
          <div className="empty">No areas yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>City</th>
                  <th>Teams allocated</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <strong>{a.name}</strong>
                    </td>
                    <td>{a.city || <span className="muted">—</span>}</td>
                    <td>
                      {a.teams.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <div className="row" style={{ gap: 5 }}>
                          {a.teams.map((t) => (
                            <span key={t._id} className="badge team" style={{ background: t.color }}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="small muted">{a.notes || '—'}</td>
                    <td className="actions">
                      <button
                        className="btn sm"
                        onClick={() => setEditing({ ...a, teams: a.teams.map((t) => t._id) })}
                      >
                        Edit
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => remove(a)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AreaForm
          initial={editing}
          teams={teams}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notify(msg);
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

function AreaForm({ initial, teams, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = !initial._id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleTeam(id) {
    setForm((f) => ({
      ...f,
      teams: f.teams.includes(id) ? f.teams.filter((t) => t !== id) : [...f.teams, id],
    }));
  }

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { name: form.name, city: form.city, teams: form.teams, notes: form.notes };
      if (isNew) await post('/areas', payload);
      else await put(`/areas/${initial._id}`, payload);
      onSaved(isNew ? 'Area created' : 'Area updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'New area' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save area'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <label className="field">
            <span>Area name *</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>City</span>
            <input value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Teams covering this area</span>
        </label>
        <div className="checklist" style={{ marginBottom: 14 }}>
          {teams.length === 0 ? (
            <span className="muted small">No teams created yet.</span>
          ) : (
            teams.map((t) => (
              <label key={t._id}>
                <input
                  type="checkbox"
                  checked={form.teams.includes(t._id)}
                  onChange={() => toggleTeam(t._id)}
                />
                <span className="row" style={{ gap: 6 }}>
                  <span className="dot" style={{ background: t.color }} />
                  {t.name}
                </span>
              </label>
            ))
          )}
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
