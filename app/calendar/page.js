'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { del, get, post, put } from '@/lib/api';
import {
  addDaysISO,
  money,
  prettyDate,
  prettyTime,
  todayISO,
  toHHMM,
  toMinutes,
} from '@/lib/format';

const SLOT = 30; // grid granularity in minutes

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      <CalendarInner />
    </Suspense>
  );
}

function CalendarInner() {
  const params = useSearchParams();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState(params.get('team') || '');
  const [date, setDate] = useState(params.get('date') || todayISO());
  const [day, setDay] = useState(null);
  const [services, setServices] = useState([]);
  const [areas, setAreas] = useState([]);
  const [weekBlocks, setWeekBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [blockModal, setBlockModal] = useState(false);
  const [toast, notify] = useToast();

  // Reference data is fetched once.
  useEffect(() => {
    Promise.all([get('/teams'), get('/services'), get('/areas')])
      .then(([tms, svcs, ars]) => {
        setTeams(tms);
        setServices(svcs.filter((s) => s.active));
        setAreas(ars);
        setTeamId((cur) => cur || tms[0]?._id || '');
      })
      .catch((e) => notify(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [notify]);

  const weekStart = useMemo(() => addDaysISO(date, -3), [date]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart]
  );

  const loadDay = useCallback(async () => {
    if (!teamId) return;
    try {
      const [dayData, blocks] = await Promise.all([
        get('/bookings/day', { team: teamId, date }),
        get('/blocks', { team: teamId, from: weekDays[0], to: weekDays[6] }),
      ]);
      setDay(dayData);
      setWeekBlocks(blocks);
    } catch (e) {
      notify(e.message, 'error');
    }
  }, [teamId, date, weekDays, notify]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const team = teams.find((t) => t._id === teamId);

  // Slot rows between the team's work window, tagged with what occupies them.
  const rows = useMemo(() => {
    if (!team || !day) return [];
    const start = toMinutes(team.workStart);
    const end = toMinutes(team.workEnd);
    const out = [];

    for (let m = start; m < end; m += SLOT) {
      const hhmm = toHHMM(m);
      const slotEnd = m + SLOT;

      const job = day.bookings.find((b) => toMinutes(b.startTime) === m);
      const inJob = day.bookings.find(
        (b) => toMinutes(b.startTime) < slotEnd && m < toMinutes(b.endTime)
      );
      const hourBlock = day.blocks.find(
        (b) => b.kind === 'hours' && toMinutes(b.startTime) < slotEnd && m < toMinutes(b.endTime)
      );

      out.push({
        time: hhmm,
        job: job || null,
        occupiedBy: inJob && !job ? inJob : null,
        block: day.dayBlocked ? day.blocks.find((b) => b.kind === 'day') : hourBlock || null,
      });
    }
    return out;
  }, [team, day]);

  async function removeBlock(id) {
    try {
      await del(`/blocks/${id}`);
      notify('Block removed');
      loadDay();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  async function deleteBooking(id) {
    if (!confirm('Delete this job?')) return;
    try {
      await del(`/bookings/${id}`);
      notify('Job deleted');
      loadDay();
    } catch (e) {
      notify(e.message, 'error');
    }
  }

  if (loading) return <Shell><div className="loading">Loading…</div></Shell>;

  return (
    <Shell>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p>{team ? `${team.name} · ${prettyDate(date)}` : 'Pick a team'}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setBlockModal(true)} disabled={!teamId}>
            Block time
          </button>
          <button
            className="btn primary"
            onClick={() => setBooking({ startTime: team?.workStart || '09:00' })}
            disabled={!teamId}
          >
            + Book job
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="card">
          <div className="empty">Create a team first — the calendar is per team.</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row" style={{ marginBottom: 14 }}>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ maxWidth: 200 }}>
                {teams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ maxWidth: 175 }}
              />
              <button className="btn sm" onClick={() => setDate(todayISO())}>
                Today
              </button>
              <span className="spacer" />
              <button className="btn sm" onClick={() => setDate(addDaysISO(date, -1))}>
                ← Prev
              </button>
              <button className="btn sm" onClick={() => setDate(addDaysISO(date, 1))}>
                Next →
              </button>
            </div>

            <div className="day-strip">
              {weekDays.map((d) => {
                const [, , dd] = d.split('-');
                const blocked = weekBlocks.some((b) => b.date === d && b.kind === 'day');
                const label = new Date(...d.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)))
                  .toLocaleDateString(undefined, { weekday: 'short' });
                return (
                  <button
                    key={d}
                    className={`day-chip${d === date ? ' active' : ''}${blocked ? ' has-block' : ''}`}
                    onClick={() => setDate(d)}
                  >
                    <small>{label}</small>
                    {dd}
                  </button>
                );
              })}
            </div>
          </div>

          {day && (
            <>
              {day.dayBlocked && (
                <div className="alert error" style={{ marginTop: 16 }}>
                  This whole day is blocked for {team.name}
                  {day.blocks.find((b) => b.kind === 'day')?.reason
                    ? ` — ${day.blocks.find((b) => b.kind === 'day').reason}`
                    : ''}
                  .{' '}
                  <button
                    className="btn sm"
                    style={{ marginLeft: 8 }}
                    onClick={() => removeBlock(day.blocks.find((b) => b.kind === 'day')._id)}
                  >
                    Unblock day
                  </button>
                </div>
              )}

              <div className="card" style={{ marginTop: 16 }}>
                <div className="cal-grid">
                  {rows.map((row) => {
                    if (row.occupiedBy) {
                      return (
                        <Row key={row.time} time={row.time}>
                          <div className={`cal-continue ${row.occupiedBy.status}`} />
                        </Row>
                      );
                    }

                    if (row.job) {
                      const j = row.job;
                      return (
                        <Row key={row.time} time={row.time}>
                          <div className="cal-slot busy">
                            <div
                              className={`cal-job ${j.status}`}
                              onClick={() => setBooking(j)}
                              style={{ cursor: 'pointer' }}
                            >
                              <strong>{j.service?.name}</strong>
                              <span className="who">
                                {j.customerName || 'No name'}
                                {j.area?.name ? ` · ${j.area.name}` : ''} · {money(j.price)}
                              </span>
                              <span className="spacer" />
                              <span className="small muted">
                                {prettyTime(j.startTime)}–{prettyTime(j.endTime)}
                              </span>
                              <button
                                className="btn sm danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteBooking(j._id);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </Row>
                      );
                    }

                    if (row.block) {
                      return (
                        <Row key={row.time} time={row.time}>
                          <div className="cal-slot blocked" title={row.block.reason || 'Blocked'}>
                            Blocked{row.block.reason ? ` — ${row.block.reason}` : ''}
                            {row.block.kind === 'hours' && (
                              <button
                                className="btn sm"
                                style={{ marginLeft: 'auto' }}
                                onClick={() => removeBlock(row.block._id)}
                              >
                                Unblock
                              </button>
                            )}
                          </div>
                        </Row>
                      );
                    }

                    return (
                      <Row key={row.time} time={row.time}>
                        <div
                          className="cal-slot"
                          onClick={() => setBooking({ startTime: row.time })}
                        >
                          <span className="muted small">+ Book</span>
                        </div>
                      </Row>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {booking && (
        <BookingForm
          initial={booking}
          teamId={teamId}
          date={date}
          services={services}
          areas={areas}
          teams={teams}
          onClose={() => setBooking(null)}
          onSaved={(msg) => {
            setBooking(null);
            notify(msg);
            loadDay();
          }}
        />
      )}

      {blockModal && (
        <BlockForm
          teamId={teamId}
          date={date}
          teamName={team?.name}
          onClose={() => setBlockModal(false)}
          onSaved={() => {
            setBlockModal(false);
            notify('Time blocked');
            loadDay();
          }}
        />
      )}
      {toast}
    </Shell>
  );
}

function Row({ time, children }) {
  return (
    <>
      <div className="cal-time">{prettyTime(time)}</div>
      {children}
    </>
  );
}

function BookingForm({ initial, teamId, date, services, areas, teams, onClose, onSaved }) {
  const isNew = !initial._id;
  const [form, setForm] = useState({
    team: initial.team?._id || teamId,
    service: initial.service?._id || services[0]?._id || '',
    area: initial.area?._id || '',
    date: initial.date || date,
    startTime: initial.startTime || '09:00',
    customerName: initial.customerName || '',
    customerPhone: initial.customerPhone || '',
    address: initial.address || '',
    price: initial.price ?? '',
    status: initial.status || 'scheduled',
    notes: initial.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const service = services.find((s) => s._id === form.service);
  // Mirror the server's rule so the preview matches what will be saved.
  const override = service?.areaPrices?.find((p) => String(p.area?._id || p.area) === form.area);
  const effectiveDuration = override?.durationMinutes ?? service?.durationMinutes ?? 0;
  const effectivePrice = override ? override.price : service?.basePrice ?? 0;
  const endTime = form.startTime ? toHHMM(toMinutes(form.startTime) + effectiveDuration) : '';

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { ...form, price: form.price === '' ? undefined : Number(form.price) };
      if (isNew) await post('/bookings', payload);
      else await put(`/bookings/${initial._id}`, payload);
      onSaved(isNew ? 'Job booked' : 'Job updated');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      wide
      title={isNew ? 'Book a job' : 'Edit job'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy || !form.service}>
            {busy ? 'Saving…' : isNew ? 'Book job' : 'Save changes'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        {services.length === 0 && (
          <div className="alert error">Create a service first — a job needs one.</div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Team</span>
            <select value={form.team} onChange={(e) => set('team', e.target.value)}>
              {teams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Service *</span>
            <select value={form.service} onChange={(e) => set('service', e.target.value)} required>
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Area</span>
            <select value={form.area} onChange={(e) => set('area', e.target.value)}>
              <option value="">— none —</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date *</span>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
          <label className="field">
            <span>Start time *</span>
            <input
              type="time"
              step="300"
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Ends at (auto)</span>
            <input value={endTime ? `${endTime} · ${effectiveDuration} min` : '—'} disabled />
          </label>
        </div>

        <div className="alert success" style={{ marginTop: 4 }}>
          Suggested price for this area: <strong>{money(effectivePrice)}</strong>
          {override && ' (area override)'} · duration {effectiveDuration} min
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Customer name</span>
            <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
          </label>
          <label className="field">
            <span>Customer phone</span>
            <input value={form.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} />
          </label>
          <label className="field">
            <span>Price (blank = suggested)</span>
            <input
              type="number"
              min="0"
              value={form.price}
              placeholder={String(effectivePrice)}
              onChange={(e) => set('price', e.target.value)}
            />
          </label>
          {!isNew && (
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          )}
        </div>

        <label className="field">
          <span>Address</span>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function BlockForm({ teamId, date, teamName, onClose, onSaved }) {
  const [kind, setKind] = useState('day');
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(date);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Expand the date range client-side so one call blocks the whole span.
      const dates = [];
      for (let d = from; d <= to; d = addDaysISO(d, 1)) {
        dates.push(d);
        if (dates.length > 366) break;
      }
      await post('/blocks', {
        team: teamId,
        dates,
        kind,
        startTime: kind === 'hours' ? startTime : undefined,
        endTime: kind === 'hours' ? endTime : undefined,
        reason,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Block time for ${teamName || 'team'}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? 'Blocking…' : 'Block'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <label className="field">
          <span>What to block</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="day">Whole day(s)</option>
            <option value="hours">Specific hours</option>
          </select>
        </label>

        <div className="form-grid">
          <label className="field">
            <span>From date</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (e.target.value > to) setTo(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>To date</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        {kind === 'hours' && (
          <div className="form-grid">
            <label className="field">
              <span>From time</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="field">
              <span>To time</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
        )}

        <label className="field">
          <span>Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Holiday, maintenance, training…"
          />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
