'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';

const EMPTY = {
  name: '',
  code: '',
  owner: '',
  phone: '',
  address: '',
  banner: 'none',
  isMine: false,
  active: true,
  notes: '',
  streets: [],
};

const BANNER_LABEL = { large: 'Large', medium: 'Medium', none: 'None' };
const PROX_LABEL = { on: 'On the street', close: 'Close ~5m', near: 'Nearby ~15m' };
const PROX_PCT = { on: 100, close: 70, near: 20 };

export default function ShopsPage() {
  const [shops, setShops] = useState([]);
  const [streets, setStreets] = useState([]);
  const [q, setQ] = useState('');
  const [streetFilter, setStreetFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sh, st] = await Promise.all([
        get('/shops', { q, street: streetFilter }),
        get('/streets'),
      ]);
      setShops(sh);
      setStreets(st);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [q, streetFilter, notify]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function remove(s) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      await del(`/shops/${s._id}`);
      notify('Shop deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Shops</h1>
          <p>Stations on the map. A shop on two streets sits on the corner.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => setEditing(EMPTY)}
          disabled={streets.length === 0}
          title={streets.length === 0 ? 'Create a street first' : ''}
        >
          + New shop
        </button>
      </div>

      {streets.length === 0 && (
        <div className="alert error">
          Create a{' '}
          <Link href="/streets" style={{ textDecoration: 'underline' }}>
            street
          </Link>{' '}
          first — a shop is placed along one.
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <input
            placeholder="Search name, code, owner, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <select
            value={streetFilter}
            onChange={(e) => setStreetFilter(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="">All streets</option>
            {streets.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : shops.length === 0 ? (
          <div className="empty">No shops found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Shop</th>
                  <th>On streets</th>
                  <th>Banner</th>
                  <th>Points</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => {
                  const pts = s.banner === 'large' ? 2 : s.banner === 'medium' ? 1 : 0;
                  return (
                    <tr key={s._id}>
                      <td>
                        <strong>{s.code || '—'}</strong>
                      </td>
                      <td>
                        <strong>{s.name}</strong>
                        {s.isMine && <span className="badge green" style={{ marginLeft: 6 }}>Me</span>}
                        {s.streets.length > 1 && (
                          <span className="badge amber" style={{ marginLeft: 6 }}>
                            Corner
                          </span>
                        )}
                        {s.owner && <div className="small muted">{s.owner}</div>}
                      </td>
                      <td>
                        {s.streets.length === 0 ? (
                          <span className="muted">Not placed</span>
                        ) : (
                          <div className="row" style={{ gap: 5 }}>
                            {s.streets.map((l, i) => (
                              <span
                                key={i}
                                className="badge team"
                                style={{ background: l.street?.color || '#64748b' }}
                                title={PROX_LABEL[l.proximity]}
                              >
                                {l.street?.name} · {PROX_PCT[l.proximity]}%
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{BANNER_LABEL[s.banner]}</td>
                      <td>{pts}</td>
                      <td className="actions">
                        <button
                          className="btn sm"
                          onClick={() =>
                            setEditing({
                              ...s,
                              streets: s.streets.map((l) => ({
                                street: l.street?._id || l.street,
                                order: l.order,
                                proximity: l.proximity,
                                between: [],
                              })),
                            })
                          }
                        >
                          Edit
                        </button>{' '}
                        <button className="btn sm danger" onClick={() => remove(s)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ShopForm
          initial={editing}
          streets={streets}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            notify(m);
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

function ShopForm({ initial, streets, onClose, onSaved }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Shops already on each street, so "add between A and B" can list them.
  const [onStreet, setOnStreet] = useState({});
  const isNew = !initial._id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchStreetShops = useCallback(
    async (streetId) => {
      if (!streetId || onStreet[streetId]) return;
      try {
        const data = await get(`/streets/${streetId}`);
        setOnStreet((m) => ({
          ...m,
          [streetId]: data.shops.filter((s) => s._id !== initial._id),
        }));
      } catch {
        /* dropdown just stays empty */
      }
    },
    [onStreet, initial._id]
  );

  useEffect(() => {
    form.streets.forEach((l) => l.street && fetchStreetShops(l.street));
  }, [form.streets, fetchStreetShops]);

  function addLink() {
    set('streets', [...form.streets, { street: '', proximity: 'on', between: [], order: '' }]);
  }
  function updateLink(i, patch) {
    set(
      'streets',
      form.streets.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );
  }
  function removeLink(i) {
    set('streets', form.streets.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        owner: form.owner,
        phone: form.phone,
        address: form.address,
        banner: form.banner,
        isMine: form.isMine,
        active: form.active,
        notes: form.notes,
        streets: form.streets.filter((l) => l.street),
      };
      if (isNew) await post('/shops', payload);
      else await put(`/shops/${initial._id}`, payload);
      onSaved(isNew ? 'Shop created' : 'Shop updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const points = form.banner === 'large' ? 2 : form.banner === 'medium' ? 1 : 0;

  return (
    <Modal
      wide
      title={isNew ? 'New shop' : `Edit ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save shop'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <fieldset>
          <legend>Shop</legend>
          <div className="form-grid">
            <label className="field">
              <span>Shop name *</span>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
            </label>
            <label className="field">
              <span>Map code</span>
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="A, B, C…"
                maxLength={4}
              />
            </label>
            <label className="field">
              <span>Owner</span>
              <input value={form.owner} onChange={(e) => set('owner', e.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Address</span>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Banner — decides the commission share</legend>
          <div className="form-grid">
            <label className="field">
              <span>Banner bought</span>
              <select value={form.banner} onChange={(e) => set('banner', e.target.value)}>
                <option value="large">Large — full, 2 points</option>
                <option value="medium">Medium — 50%, 1 point</option>
                <option value="none">No banner — 0 points</option>
              </select>
            </label>
            <label className="field">
              <span>This is my own shop</span>
              <select value={form.isMine ? 'y' : 'n'} onChange={(e) => set('isMine', e.target.value === 'y')}>
                <option value="n">No</option>
                <option value="y">Yes — shop (me)</option>
              </select>
            </label>
          </div>
          <div className="alert success" style={{ marginBottom: 0 }}>
            Worth <strong>{points} point{points === 1 ? '' : 's'}</strong> before proximity is applied.
          </div>
        </fieldset>

        <fieldset>
          <legend>Placement on streets</legend>
          <p className="muted small" style={{ marginTop: 0 }}>
            Add a second street to make this a corner shop — it then earns on both.
          </p>

          {form.streets.length === 0 && (
            <div className="empty" style={{ padding: 18 }}>
              Not placed on any street yet.
            </div>
          )}

          {form.streets.map((link, i) => {
            const candidates = onStreet[link.street] || [];
            const pct = PROX_PCT[link.proximity];
            return (
              <div
                key={i}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    <span>Street *</span>
                    <select
                      value={link.street}
                      onChange={(e) => updateLink(i, { street: e.target.value, between: [] })}
                    >
                      <option value="">Select street…</option>
                      {streets
                        .filter(
                          (s) => s._id === link.street || !form.streets.some((l) => l.street === s._id)
                        )
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>How close is it?</span>
                    <select
                      value={link.proximity}
                      onChange={(e) => updateLink(i, { proximity: e.target.value })}
                    >
                      <option value="on">On the street — 100%</option>
                      <option value="close">Close by, ~5m — 70%</option>
                      <option value="near">Nearby, ~15m — 20%</option>
                    </select>
                  </label>
                </div>

                {candidates.length >= 2 && (
                  <label className="field">
                    <span>Place between (pick two, optional)</span>
                    <div className="checklist" style={{ maxHeight: 130 }}>
                      {candidates.map((c) => {
                        const picked = (link.between || []).includes(c._id);
                        return (
                          <label key={c._id}>
                            <input
                              type="checkbox"
                              checked={picked}
                              onChange={() => {
                                const cur = link.between || [];
                                const next = picked
                                  ? cur.filter((x) => x !== c._id)
                                  : [...cur, c._id].slice(-2);
                                updateLink(i, { between: next, order: '' });
                              }}
                            />
                            <span>
                              {c.code ? `${c.code} — ` : ''}
                              {c.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <span className="small muted">
                      Leave empty to append at the end of the line.
                    </span>
                  </label>
                )}

                <div className="row">
                  <span className="badge">Weight on this street: {(points * pct) / 100}</span>
                  <span className="spacer" />
                  <button type="button" className="btn sm danger" onClick={() => removeLink(i)}>
                    Remove street
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn sm"
            onClick={addLink}
            disabled={form.streets.length >= streets.length}
          >
            + Add street
          </button>
        </fieldset>

        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
