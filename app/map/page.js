'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import MapCanvas from '@/components/MapCanvas';
import { get } from '@/lib/api';

export default function MapPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    get('/map')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

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

        <MapCanvas data={data} selectedId={selected?._id} onSelect={setSelected} />

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
    </Shell>
  );
}
