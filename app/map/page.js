'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { get } from '@/lib/api';

// Metro-diagram geometry, in SVG units.
const GAP = 128; // spacing between consecutive stations
const LANE = 108; // spacing between parallel lines
const PAD = 90;
const R = 11;

export default function MapPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [toast, notify] = useToast();

  useEffect(() => {
    get('/map')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  /**
   * Lays every street out as a straight line. Horizontal streets stack by lane
   * downwards, vertical ones across. A shop appearing on two lines is drawn
   * once per line but flagged as an interchange.
   */
  const layout = useMemo(() => {
    if (!data) return null;

    const positions = new Map(); // shopId -> [{x, y, line}]
    const lines = data.lines.map((line, lineIndex) => {
      const lane = Number.isFinite(line.lane) && line.lane !== 0 ? line.lane : lineIndex;
      const stations = line.stations.map((st, i) => {
        const x = line.orientation === 'h' ? PAD + i * GAP : PAD + lane * LANE;
        const y = line.orientation === 'h' ? PAD + lane * LANE : PAD + i * GAP;
        const point = { ...st, x, y };
        const prev = positions.get(String(st._id)) || [];
        positions.set(String(st._id), [...prev, { x, y, lineId: line._id }]);
        return point;
      });
      return { ...line, stations };
    });

    const xs = lines.flatMap((l) => l.stations.map((s) => s.x));
    const ys = lines.flatMap((l) => l.stations.map((s) => s.y));

    return {
      lines,
      positions,
      width: Math.max(760, (xs.length ? Math.max(...xs) : 0) + PAD + 120),
      height: Math.max(420, (ys.length ? Math.max(...ys) : 0) + PAD),
    };
  }, [data]);

  if (error) return <Shell><div className="alert error">{error}</div></Shell>;
  if (!layout) return <Shell><div className="loading">Loading map…</div></Shell>;

  const empty = layout.lines.every((l) => l.stations.length === 0);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Map</h1>
          <p>Streets as lines, shops as stations. Corner shops appear on both lines.</p>
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

      {layout.lines.length === 0 ? (
        <div className="card">
          <div className="empty">
            No active streets yet.{' '}
            <Link href="/streets" style={{ color: 'var(--primary)' }}>
              Create one
            </Link>{' '}
            to start the map.
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              {layout.lines.map((l) => (
                <span key={l._id} className="row" style={{ gap: 6, marginRight: 14 }}>
                  <span
                    style={{ width: 22, height: 5, borderRadius: 3, background: l.color, display: 'inline-block' }}
                  />
                  <span className="small">
                    <strong>{l.name}</strong>{' '}
                    <span className="muted">({l.stations.length})</span>
                  </span>
                </span>
              ))}
            </div>

            {empty ? (
              <div className="empty">
                Streets exist but no shops are placed on them yet.{' '}
                <Link href="/shops" style={{ color: 'var(--primary)' }}>
                  Add a shop
                </Link>
                .
              </div>
            ) : (
              <div className="map-scroll">
                <svg
                  width={layout.width}
                  height={layout.height}
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  role="img"
                  aria-label="Street and shop map"
                >
                  {/* Lines first so stations sit on top of them. */}
                  {layout.lines.map((line) => {
                    if (line.stations.length < 2) return null;
                    const a = line.stations[0];
                    const b = line.stations[line.stations.length - 1];
                    return (
                      <line
                        key={line._id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={line.color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    );
                  })}

                  {/* Street name at the start of each line. */}
                  {layout.lines.map((line) => {
                    const first = line.stations[0];
                    if (!first) return null;
                    return (
                      <text
                        key={`lbl-${line._id}`}
                        x={line.orientation === 'h' ? first.x - 16 : first.x}
                        y={line.orientation === 'h' ? first.y - 26 : first.y - 34}
                        textAnchor={line.orientation === 'h' ? 'end' : 'middle'}
                        fontSize="14"
                        fontWeight="700"
                        fill={line.color}
                      >
                        {line.name}
                      </text>
                    );
                  })}

                  {layout.lines.map((line) =>
                    line.stations.map((st) => {
                      const isSel = selected?._id === st._id;
                      return (
                        <g
                          key={`${line._id}-${st._id}`}
                          onClick={() => setSelected(st)}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle
                            cx={st.x}
                            cy={st.y}
                            r={st.interchange ? R + 4 : R}
                            fill="#fff"
                            stroke={isSel ? '#0f172a' : line.color}
                            strokeWidth={st.interchange ? 5 : 4}
                          />
                          {st.isMine && <circle cx={st.x} cy={st.y} r={4} fill="#16a34a" />}
                          {st.proximity !== 'on' && (
                            <circle
                              cx={st.x}
                              cy={st.y}
                              r={st.interchange ? R + 4 : R}
                              fill="none"
                              stroke={line.color}
                              strokeWidth="2"
                              strokeDasharray="3 3"
                              opacity="0.85"
                            />
                          )}
                          <text
                            x={st.x}
                            y={st.y - (st.interchange ? R + 12 : R + 8)}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="600"
                            fill="#0f172a"
                          >
                            {st.code || st.name}
                          </text>
                          <text
                            x={st.x}
                            y={st.y + (st.interchange ? R + 20 : R + 16)}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#64748b"
                          >
                            {st.banner === 'none' ? 'no banner' : st.banner}
                          </text>
                        </g>
                      );
                    })
                  )}
                </svg>
              </div>
            )}

            <div className="row map-legend">
              <span className="row" style={{ gap: 6 }}>
                <span className="legend-dot" /> Shop
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="legend-dot big" /> Corner (on 2+ streets)
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="legend-dot dashed" /> Not directly on the street
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="legend-dot mine" /> My own shop
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

          {layout.lines.some((l) => l.sections.length > 0) && (
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
                    {layout.lines.flatMap((l) =>
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
        </>
      )}
      {toast}
    </Shell>
  );
}
