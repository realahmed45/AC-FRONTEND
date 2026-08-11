'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';
import { duration, money } from '@/lib/format';

const EMPTY = { name: '', durationMinutes: 45, basePrice: 0, active: true, notes: '' };

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [grid, setGrid] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svcs, g] = await Promise.all([get('/services'), get('/services/grid')]);
      setServices(svcs);
      setGrid(g);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(s) {
    if (!confirm(`Delete "${s.name}"? Existing jobs keep their recorded price.`)) return;
    try {
      await del(`/services/${s._id}`);
      notify('Service deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Services &amp; Prices</h1>
          <p>Each service has a duration and a base price; override the price per area below</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>
          + New service
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">Services</h3>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : services.length === 0 ? (
          <div className="empty">No services yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Time</th>
                  <th>Base price</th>
                  <th>Area overrides</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.notes && <div className="small muted">{s.notes}</div>}
                    </td>
                    <td>{duration(s.durationMinutes)}</td>
                    <td>{money(s.basePrice)}</td>
                    <td>{s.areaPrices?.length || 0}</td>
                    <td>
                      <span className={`badge ${s.active ? 'green' : 'red'}`}>
                        {s.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn sm" onClick={() => setEditing(s)}>
                        Edit
                      </button>{' '}
                      <button className="btn sm danger" onClick={() => remove(s)}>
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

      {grid && grid.services.length > 0 && grid.rows.length > 0 && (
        <PriceGrid grid={grid} onSaved={load} notify={notify} />
      )}

      {editing && (
        <ServiceForm
          initial={editing}
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

/** Rows = areas, columns = services. Blank cell falls back to the base price. */
function PriceGrid({ grid, onSaved, notify }) {
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(null);

  const key = (areaId, serviceId) => `${areaId}:${serviceId}`;

  async function commit(areaId, serviceId, raw) {
    const k = key(areaId, serviceId);
    setSaving(k);
    try {
      await put(`/services/${serviceId}/area-price`, {
        areaId,
        price: raw === '' ? null : Number(raw),
      });
      setDraft((d) => {
        const next = { ...d };
        delete next[k];
        return next;
      });
      onSaved();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="card">
      <h3 className="card-title">Price per area</h3>
      <p className="muted small" style={{ marginTop: -6 }}>
        Type a price and press Enter (or click away) to save. Clear the box to fall back to the base
        price. Blue cells are area-specific overrides.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              {grid.services.map((s) => (
                <th key={s._id}>
                  {s.name}
                  <div style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {duration(s.durationMinutes)} · base {money(s.basePrice)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.areaId}>
                <td>
                  <strong>{row.areaName}</strong>
                </td>
                {row.cells.map((cell) => {
                  const k = key(row.areaId, cell.serviceId);
                  const value = draft[k] ?? (cell.isOverride ? String(cell.price) : '');
                  return (
                    <td className="price-cell" key={cell.serviceId}>
                      <input
                        type="number"
                        min="0"
                        className={cell.isOverride ? 'override' : ''}
                        placeholder={String(cell.price)}
                        value={value}
                        disabled={saving === k}
                        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                        onBlur={(e) => {
                          if (draft[k] === undefined) return;
                          commit(row.areaId, cell.serviceId, e.target.value);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceForm({ initial, onClose, onSaved }) {
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
        durationMinutes: Number(form.durationMinutes),
        basePrice: Number(form.basePrice),
        active: form.active,
        notes: form.notes,
      };
      if (isNew) await post('/services', payload);
      else await put(`/services/${initial._id}`, payload);
      onSaved(isNew ? 'Service created' : 'Service updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'New service' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save service'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <label className="field">
            <span>Service name *</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Duration (minutes) *</span>
            <input
              type="number"
              min="5"
              step="5"
              value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Base price *</span>
            <input
              type="number"
              min="0"
              value={form.basePrice}
              onChange={(e) => set('basePrice', e.target.value)}
              required
            />
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
