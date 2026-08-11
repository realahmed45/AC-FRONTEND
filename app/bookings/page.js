'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { del, get, put } from '@/lib/api';
import { addDaysISO, money, prettyDate, prettyTime, todayISO } from '@/lib/format';

export default function BookingsPage() {
  const [rows, setRows] = useState([]);
  const [teams, setTeams] = useState([]);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(addDaysISO(todayISO(), 30));
  const [team, setTeam] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, notify] = useToast();

  useEffect(() => {
    get('/teams').then(setTeams).catch((e) => notify(e.message, 'error'));
  }, [notify]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await get('/bookings', { from, to, team, status }));
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, team, status, notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatusOf(b, next) {
    try {
      await put(`/bookings/${b._id}`, { status: next });
      notify(`Marked ${next}`);
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  async function remove(b) {
    if (!confirm('Delete this job?')) return;
    try {
      await del(`/bookings/${b._id}`);
      notify('Job deleted');
      load();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  const total = rows
    .filter((r) => r.status !== 'cancelled')
    .reduce((s, r) => s + (r.price || 0), 0);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Jobs</h1>
          <p>
            {rows.length} job(s) · {money(total)} excluding cancelled
          </p>
        </div>
        <Link href="/calendar" className="btn primary">
          Book on calendar
        </Link>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <label className="row small" style={{ gap: 6 }}>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="row small" style={{ gap: 6 }}>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ maxWidth: 170 }}>
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No jobs in this range.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Team</th>
                  <th>Service</th>
                  <th>Area</th>
                  <th>Customer</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/calendar?team=${b.team?._id}&date=${b.date}`}>
                        {prettyDate(b.date)}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {prettyTime(b.startTime)}–{prettyTime(b.endTime)}
                    </td>
                    <td>
                      <span className="badge team" style={{ background: b.team?.color || '#64748b' }}>
                        {b.team?.name || '—'}
                      </span>
                    </td>
                    <td>{b.service?.name || '—'}</td>
                    <td>{b.area?.name || <span className="muted">—</span>}</td>
                    <td>
                      {b.customerName || <span className="muted">—</span>}
                      {b.customerPhone && <div className="small muted">{b.customerPhone}</div>}
                    </td>
                    <td>{money(b.price)}</td>
                    <td>
                      <span
                        className={`badge ${
                          b.status === 'done' ? 'green' : b.status === 'cancelled' ? 'red' : 'amber'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="actions">
                      {b.status !== 'done' && (
                        <>
                          <button className="btn sm" onClick={() => setStatusOf(b, 'done')}>
                            Done
                          </button>{' '}
                        </>
                      )}
                      {b.status !== 'cancelled' && (
                        <>
                          <button className="btn sm" onClick={() => setStatusOf(b, 'cancelled')}>
                            Cancel
                          </button>{' '}
                        </>
                      )}
                      <button className="btn sm danger" onClick={() => remove(b)}>
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
      {toast}
    </Shell>
  );
}
