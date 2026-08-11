'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import MapCanvas from '@/components/MapCanvas';
import ShopMenu from '@/components/ShopMenu';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { get, post } from '@/lib/api';

export default function MapPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [menu, setMenu] = useState(null); // {station, line, x, y}
  const [dialog, setDialog] = useState(null); // {kind, station, line, ...}
  const [toast, notify] = useToast();

  const load = useCallback(
    () => get('/map').then(setData).catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function onStationClick(station, line, e) {
    setSelected(station);
    setMenu({ station, line, x: e.clientX + 4, y: e.clientY + 4 });
  }

  function handleAction(key) {
    const { station, line } = menu;
    setMenu(null);

    if (key === 'view') return setSelected(station);
    if (key === 'edit') return (window.location.href = `/shops?edit=${station._id}`);

    if (key.startsWith('cross-')) {
      const proximity = { 'cross-on': 'on', 'cross-close': 'close', 'cross-near': 'near' }[key];
      return setDialog({ kind: 'crossing', station, line, proximity });
    }
    if (key.startsWith('add-')) {
      return setDialog({ kind: 'adjacent', station, line, side: key.slice(4) });
    }
  }

  if (error) return <Shell><div className="alert error">{error}</div></Shell>;
  if (!data) return <Shell><div className="loading">Loading map…</div></Shell>;

  const hasSections = data.lines.some((l) => l.sections.length > 0);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Map</h1>
          <p>Streets as lines, shops as stations. A shop on two streets joins them at the corner.</p>
        </div>
        <div className="row">
          <Link href="/streets" className="btn">
            Manage streets
          </Link>
          <Link href="/shops" className="btn primary">
            Manage shops
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          {data.lines.map((l) => (
            <span key={l._id} className="row" style={{ gap: 6, marginRight: 14 }}>
              <span
                style={{
                  width: 22,
                  height: 5,
                  borderRadius: 3,
                  background: l.color,
                  display: 'inline-block',
                }}
              />
              <span className="small">
                <strong>{l.name}</strong> <span className="muted">({l.stations.length})</span>
              </span>
            </span>
          ))}
        </div>

        <p className="muted small" style={{ marginTop: 0 }}>
          Click any shop for its menu — edit it, add a crossing street, or add a shop beside it.
        </p>
        <MapCanvas data={data} selectedId={selected?._id} onSelect={onStationClick} />

        <div className="row map-legend">
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-dot" /> Shop
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-dot big" /> Corner — joins two streets
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-dot dashed" /> Not directly on the street
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="legend-dot mine" /> My own shop
          </span>
          <span className="row" style={{ gap: 6 }}>
            <strong style={{ color: '#7c3aed' }}>2</strong> Streets the shop is linked to
          </span>
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="row">
            <h3 className="card-title" style={{ margin: 0 }}>
              {selected.name} {selected.code ? `(${selected.code})` : ''}
            </h3>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <span className="badge">Banner: {selected.banner}</span>
            <span className="badge">Proximity: {selected.proximity}</span>
            <span className="badge">On {selected.streetCount} street(s)</span>
            {selected.interchange && <span className="badge amber">Corner shop</span>}
            {selected.isMine && <span className="badge green">Mine</span>}
          </div>
        </div>
      )}

      {data.orphanShops.length > 0 && (
        <div className="card">
          <h3 className="card-title">Not on the map ({data.orphanShops.length})</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            These shops have no street, so they can&apos;t be drawn or earn commission.
          </p>
          <div className="row" style={{ gap: 6 }}>
            {data.orphanShops.map((s) => (
              <span key={s._id} className="badge">
                {s.code ? `${s.code} — ` : ''}
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasSections && (
        <div className="card">
          <h3 className="card-title">Sections</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Street</th>
                  <th>Section</th>
                  <th>Between</th>
                  <th>Connection</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.flatMap((l) =>
                  l.sections.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          <span className="dot" style={{ background: l.color }} />
                          {l.name}
                        </span>
                      </td>
                      <td>{s.name || <span className="muted">—</span>}</td>
                      <td className="small">
                        {s.fromShop?.name} → {s.toShop?.name}
                      </td>
                      <td className="small">
                        {s.connection.kind === 'none' && <span className="muted">Stand-alone</span>}
                        {s.connection.kind === 'crossing' && (
                          <>
                            Crosses <strong>{s.connection.otherStreet?.name}</strong>
                            {s.connection.atShop ? ` at ${s.connection.atShop.name}` : ''}
                          </>
                        )}
                        {s.connection.kind === 'nextTo' && (
                          <>
                            Next to <strong>{s.connection.otherStreet?.name}</strong>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {menu && (
        <ShopMenu
          station={menu.station}
          line={menu.line}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onAction={handleAction}
        />
      )}

      {dialog?.kind === 'crossing' && (
        <CrossingDialog
          station={dialog.station}
          proximity={dialog.proximity}
          streets={data.lines}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            notify(m);
            load();
          }}
        />
      )}

      {dialog?.kind === 'adjacent' && (
        <AdjacentDialog
          station={dialog.station}
          line={dialog.line}
          side={dialog.side}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            notify(m);
            load();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

const PROX_LABEL = {
  on: 'crossing this shop — 100%',
  close: 'crossing 5 m away — 70%',
  near: 'crossing 15 m away — 20%',
};

/** Attaches a crossing street to a shop, either an existing one or a new one. */
function CrossingDialog({ station, proximity, streets, onClose, onSaved }) {
  const alreadyOn = new Set(
    streets.filter((l) => l.stations.some((s) => String(s._id) === String(station._id))).map((l) => String(l._id))
  );
  const available = streets.filter((l) => !alreadyOn.has(String(l._id)));

  const [mode, setMode] = useState(available.length ? 'existing' : 'new');
  const [street, setStreet] = useState(available[0]?._id || '');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setBusy(true);
    try {
      const body =
        mode === 'existing'
          ? { street, proximity }
          : { newStreet: { name, color }, proximity };
      await post(`/shops/${station._id}/crossing`, body);
      onSaved('Crossing street added');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add a street ${PROX_LABEL[proximity]}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || (mode === 'existing' ? !street : !name.trim())}
          >
            {busy ? 'Adding…' : 'Add crossing'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>
        <strong>{station.name}</strong> will be linked to the crossing street at{' '}
        {PROX_LABEL[proximity]}.
      </p>

      <label className="field">
        <span>Which street</span>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {available.length > 0 && <option value="existing">An existing street</option>}
          <option value="new">Create a new street</option>
        </select>
      </label>

      {mode === 'existing' ? (
        <label className="field">
          <span>Street *</span>
          <select value={street} onChange={(e) => setStreet(e.target.value)}>
            {available.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="form-grid">
          <label className="field">
            <span>New street name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Line colour</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ height: 38, padding: 3 }}
            />
          </label>
        </div>
      )}
      {mode === 'new' && (
        <p className="muted small">
          It is drawn across the street this shop is already on, so the two meet here.
        </p>
      )}
    </Modal>
  );
}

/** Creates a shop immediately to one side of an existing one. */
function AdjacentDialog({ station, line, side, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    banner: 'none',
    proximity: 'on',
    owner: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const where =
    line.orientation === 'h'
      ? side === 'left'
        ? 'to the left of'
        : 'to the right of'
      : side === 'left'
        ? 'above'
        : 'below';

  async function save() {
    setError('');
    setBusy(true);
    try {
      await post(`/shops/${station._id}/adjacent`, { ...form, street: line._id, side });
      onSaved('Shop added');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add a shop ${where} ${station.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy || !form.name.trim()}>
            {busy ? 'Adding…' : 'Add shop'}
          </button>
        </>
      }
    >
      {error && <div className="alert error">{error}</div>}
      <p className="muted small" style={{ marginTop: 0 }}>
        It goes on <strong>{line.name}</strong>, {where} {station.name}.
      </p>

      <div className="form-grid">
        <label className="field">
          <span>Shop name *</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Map code</span>
          <input
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            maxLength={4}
            placeholder="A, B, C…"
          />
        </label>
        <label className="field">
          <span>Banner</span>
          <select value={form.banner} onChange={(e) => set('banner', e.target.value)}>
            <option value="large">Large — 2 points</option>
            <option value="medium">Medium — 1 point</option>
            <option value="none">No banner — 0 points</option>
          </select>
        </label>
        <label className="field">
          <span>How close to the street</span>
          <select value={form.proximity} onChange={(e) => set('proximity', e.target.value)}>
            <option value="on">On the street — 100%</option>
            <option value="close">Close by, ~5 m — 70%</option>
            <option value="near">Nearby, ~15 m — 20%</option>
          </select>
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
    </Modal>
  );
}
