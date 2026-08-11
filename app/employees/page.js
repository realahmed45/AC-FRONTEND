'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = {
  empNo: '',
  fullName: '',
  nickName: '',
  phone1: '',
  phone2: '',
  idCard: '',
  emergencyContact: { name: '', relation: '', location: '', phone: '' },
  referral: { source: 'other', referredBy: '', note: '' },
  team: '',
  active: true,
  notes: '',
};

const SOURCES = [
  { value: 'employee', label: 'Referred by an employee' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'street', label: 'Street' },
  { value: 'other', label: 'Other' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, tms] = await Promise.all([
        get('/employees', { q, team: teamFilter }),
        get('/teams'),
      ]);
      setEmployees(emps);
      setTeams(tms);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, teamFilter, notify]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function remove(emp) {
    if (!confirm(`Delete ${emp.fullName}? This cannot be undone.`)) return;
    try {
      await del(`/employees/${emp._id}`);
      notify('Employee deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Employees</h1>
          <p>{employees.length} record(s)</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>
          + New employee
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <input
            placeholder="Search name, nickname, phone, emp #…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All teams</option>
            <option value="none">Unassigned</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="empty">No employees found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Emp #</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Team</th>
                  <th>ID card</th>
                  <th>Joined via</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e._id}>
                    <td>{e.empNo || <span className="muted">—</span>}</td>
                    <td>
                      <strong>{e.fullName}</strong>
                      {e.nickName && <div className="small muted">&ldquo;{e.nickName}&rdquo;</div>}
                    </td>
                    <td>
                      {e.phone1}
                      {e.phone2 && <div className="small muted">{e.phone2}</div>}
                    </td>
                    <td>
                      {e.team ? (
                        <span className="badge team" style={{ background: e.team.color }}>
                          {e.team.name}
                        </span>
                      ) : (
                        <span className="muted">Unassigned</span>
                      )}
                    </td>
                    <td className="small">{e.idCard || <span className="muted">—</span>}</td>
                    <td className="small">
                      {e.referral?.source === 'employee'
                        ? `Emp: ${e.referral.referredBy?.fullName || '—'}`
                        : SOURCES.find((s) => s.value === e.referral?.source)?.label || '—'}
                    </td>
                    <td>
                      <span className={`badge ${e.active ? 'green' : 'red'}`}>
                        {e.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        className="btn sm"
                        onClick={() =>
                          setEditing({
                            ...EMPTY,
                            ...e,
                            team: e.team?._id || '',
                            emergencyContact: { ...EMPTY.emergencyContact, ...e.emergencyContact },
                            referral: {
                              ...EMPTY.referral,
                              ...e.referral,
                              referredBy: e.referral?.referredBy?._id || '',
                            },
                          })
                        }
                      >
                        Edit
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => remove(e)}>
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
        <EmployeeForm
          initial={editing}
          teams={teams}
          allEmployees={employees}
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

function EmployeeForm({ initial, teams, allEmployees, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isNew = !initial._id;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setNested = (group, key, value) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { ...form };
      delete payload._id;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.__v;
      if (isNew) await post('/employees', payload);
      else await put(`/employees/${initial._id}`, payload);
      onSaved(isNew ? 'Employee created' : 'Employee updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={isNew ? 'New employee' : `Edit ${initial.fullName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save employee'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <fieldset>
          <legend>Personal</legend>
          <div className="form-grid">
            <label className="field">
              <span>Employee #</span>
              <input value={form.empNo} onChange={(e) => set('empNo', e.target.value)} placeholder="E001" />
            </label>
            <label className="field">
              <span>Full name *</span>
              <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </label>
            <label className="field">
              <span>Nick name</span>
              <input value={form.nickName} onChange={(e) => set('nickName', e.target.value)} />
            </label>
            <label className="field">
              <span>Phone number 1 *</span>
              <input value={form.phone1} onChange={(e) => set('phone1', e.target.value)} required />
            </label>
            <label className="field">
              <span>Phone number 2</span>
              <input value={form.phone2} onChange={(e) => set('phone2', e.target.value)} />
            </label>
            <label className="field">
              <span>ID card</span>
              <input value={form.idCard} onChange={(e) => set('idCard', e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Emergency contact</legend>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={form.emergencyContact.name}
                onChange={(e) => setNested('emergencyContact', 'name', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Relation (family / friend)</span>
              <input
                value={form.emergencyContact.relation}
                onChange={(e) => setNested('emergencyContact', 'relation', e.target.value)}
                placeholder="Brother, friend…"
              />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                value={form.emergencyContact.location}
                onChange={(e) => setNested('emergencyContact', 'location', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Phone number</span>
              <input
                value={form.emergencyContact.phone}
                onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>How he joined</legend>
          <div className="form-grid">
            <label className="field">
              <span>Source</span>
              <select
                value={form.referral.source}
                onChange={(e) => setNested('referral', 'source', e.target.value)}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {form.referral.source === 'employee' && (
              <label className="field">
                <span>Referred by</span>
                <select
                  value={form.referral.referredBy || ''}
                  onChange={(e) => setNested('referral', 'referredBy', e.target.value)}
                >
                  <option value="">Select employee…</option>
                  {allEmployees
                    .filter((e) => e._id !== initial._id)
                    .map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.empNo ? `${e.empNo} — ` : ''}
                        {e.fullName}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Note</span>
              <input
                value={form.referral.note || ''}
                onChange={(e) => setNested('referral', 'note', e.target.value)}
                placeholder="Any extra detail about how he became a member"
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Assignment</legend>
          <div className="form-grid">
            <label className="field">
              <span>Team</span>
              <select value={form.team || ''} onChange={(e) => set('team', e.target.value)}>
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={form.active ? 'active' : 'inactive'}
                onChange={(e) => set('active', e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </fieldset>

        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
