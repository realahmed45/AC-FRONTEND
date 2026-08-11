'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { get } from '@/lib/api';
import { money, prettyDate, prettyTime, todayISO } from '@/lib/format';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const today = todayISO();

  useEffect(() => {
    get('/stats', { date: today })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [today]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{prettyDate(today)}</p>
        </div>
        <Link href="/calendar" className="btn primary">
          Open calendar
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}

      {data && (
        <>
          <div className="grid cols-4">
            <Stat label="Jobs today" value={data.counts.todayJobs} />
            <Stat label="Revenue today" value={money(data.todayRevenue)} />
            <Stat label="Active teams" value={data.counts.teams} />
            <Stat label="Employees" value={data.counts.employees} />
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3 className="card-title">Today&apos;s schedule</h3>
              {data.todayBookings.length === 0 ? (
                <div className="empty">Nothing booked for today.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Team</th>
                        <th>Service</th>
                        <th>Customer</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.todayBookings.map((b) => (
                        <tr key={b._id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {prettyTime(b.startTime)}–{prettyTime(b.endTime)}
                          </td>
                          <td>
                            <span
                              className="badge team"
                              style={{ background: b.team?.color || '#64748b' }}
                            >
                              {b.team?.name || '—'}
                            </span>
                          </td>
                          <td>{b.service?.name || '—'}</td>
                          <td>
                            {b.customerName || <span className="muted">—</span>}
                            {b.area?.name && <div className="small muted">{b.area.name}</div>}
                          </td>
                          <td>{money(b.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">Coming up</h3>
              {data.upcoming.length === 0 ? (
                <div className="empty">No upcoming jobs scheduled.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Team</th>
                        <th>Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming.map((b) => (
                        <tr key={b._id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{prettyDate(b.date)}</td>
                          <td>{prettyTime(b.startTime)}</td>
                          <td>
                            <span
                              className="badge team"
                              style={{ background: b.team?.color || '#64748b' }}
                            >
                              {b.team?.name || '—'}
                            </span>
                          </td>
                          <td>{b.service?.name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
