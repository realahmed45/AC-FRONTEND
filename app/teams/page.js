'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = { name: '', color: '#2563eb', workStart: '07:00', workEnd: '19:00', active: true, notes: '' };

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [allocating, setAllocating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tms, emps] = await Promise.all([get('/teams'), get('/employees', { active: 'true' })]);
      setTeams(tms);
      setEmployees(emps);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(team) {
    if (
      !confirm(
        `Delete ${team.name}?\n\nIts members become unassigned and its calendar (blocks + jobs) is deleted.`
      )
    )
      return;
    try {
      await del(`/teams/${team._id}`);
      notify('Team deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Teams</h1>
          <p>Create teams, allocate employees, and set working hours</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>
          + New team
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="card">
          <div className="empty">No teams yet. Create your first one.</div>
        </div>
      ) : (
        <div className="grid cols-2">
          {teams.map((t) => (
            <div className="card" key={t._id}>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="dot" style={{ background: t.color }} />
                <strong style={{ fontSize: 15 }}>{t.name}</strong>
                {!t.active && <span className="badge red">Inactive</span>}
                <span className="spacer" />
                <span className="small muted">
                  {t.workStart}–{t.workEnd}
                </span>
              </div>

              <div className="small muted" style={{ marginBottom: 6 }}>
                MEMBERS ({t.members.length})
              </div>
              <div style={{ marginBottom: 12 }}>
                {t.members.length === 0 ? (
                  <span className="muted small">No one allocated yet</span>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    {t.members.map((m) => (
                      <span className="badge" key={m._id}>
                        {m.nickName || m.fullName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="small muted" style={{ marginBottom: 6 }}>
                AREAS ({t.areas.length})
              </div>
              <div style={{ marginBottom: 14 }}>
                {t.areas.length === 0 ? (
                  <span className="muted small">
                    No areas — allocate them on the <Link href="/areas" style={{ color: 'var(--primary)' }}>Areas</Link> page
                  </span>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    {t.areas.map((a) => (
                      <span className="badge" key={a._id}>
                        📍 {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="row">
                <Link href={`/calendar?team=${t._id}`} className="btn sm">
                  Calendar
                </Link>
                <button className="btn sm" onClick={() => setAllocating(t)}>
                  Allocate members
                </button>
                <button className="btn sm" onClick={() => setEditing(t)}>
                  Edit
                </button>
                <span className="spacer" />
                <button className="btn sm danger" onClick={() => remove(t)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TeamForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notify(msg);
            load();
          }}
        />
      )}

      {allocating && (
        <AllocateMembers
          team={allocating}
          employees={employees}
          onClose={() => setAllocating(null)}
          onSaved={() => {
            setAllocating(null);
            notify('Members updated');
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

function TeamForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = !initial._id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        color: form.color,
        workStart: form.workStart,
        workEnd: form.workEnd,
        active: form.active,
        notes: form.notes,
      };
      if (isNew) await post('/teams', payload);
      else await put(`/teams/${initial._id}`, payload);
      onSaved(isNew ? 'Team created' : 'Team updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'New team' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save team'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <label className="field">
            <span>Team name *</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Colour</span>
            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} style={{ height: 38, padding: 3 }} />
          </label>
          <label className="field">
            <span>Work starts</span>
            <input type="time" value={form.workStart} onChange={(e) => set('workStart', e.target.value)} />
          </label>
          <label className="field">
            <span>Work ends</span>
            <input type="time" value={form.workEnd} onChange={(e) => set('workEnd', e.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={form.active ? 'a' : 'i'} onChange={(e) => set('active', e.target.value === 'a')}>
              <option value="a">Active</option>
              <option value="i">Inactive</option>
            </select>
          </label>
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

function AllocateMembers({ team, employees, onClose, onSaved }) {
  const [selected, setSelected] = useState(() => new Set(team.members.map((m) => m._id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await put(`/teams/${team._id}/members`, { employeeIds: [...selected] });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={`Allocate employees to ${team.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : `Save (${selected.size})`}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>
        An employee belongs to one team. Ticking someone who is on another team moves them here.
      </p>
      <div className="checklist">
        {employees.map((e) => (
          <label key={e._id}>
            <input type="checkbox" checked={selected.has(e._id)} onChange={() => toggle(e._id)} />
            <span>
              {e.fullName}
              {e.team && e.team._id !== team._id && (
                <span className="muted small"> · {e.team.name}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
