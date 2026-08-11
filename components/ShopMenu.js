'use client';

import { useEffect, useRef } from 'react';

/**
 * Context menu for a shop on the map. Positioned at the click point and
 * clamped so it never runs off the viewport.
 */
export default function ShopMenu({ station, line, x, y, onClose, onAction }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    window.addEventListener('keydown', onKey);
    // Deferred so the click that opened the menu doesn't immediately shut it.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      clearTimeout(t);
    };
  }, [onClose]);

  const WIDTH = 262;
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - WIDTH - 12);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 400);

  const item = (key, label, hint) => (
    <button className="shop-menu-item" onClick={() => onAction(key)}>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </button>
  );

  return (
    <div className="shop-menu" style={{ left, top: Math.max(8, top) }} ref={ref}>
      <div className="shop-menu-head">
        <strong>{station.name}</strong>
        {station.code && <span className="muted small"> ({station.code})</span>}
        <div className="muted small">on {line.name}</div>
      </div>

      {item('view', 'View settings', `${station.banner} banner · on ${station.streetCount} street(s)`)}
      {item('edit', 'Edit shop')}

      <div className="shop-menu-sep">Add a crossing street here</div>
      {item('cross-on', 'Crossing this shop', 'Shop is on it — 100%')}
      {item('cross-close', 'Crossing 5 m away', 'Close by — 70%')}
      {item('cross-near', 'Crossing 15 m away', 'Nearby — 20%')}

      <div className="shop-menu-sep">Add a shop next to this one</div>
      {item('add-left', line.orientation === 'h' ? 'Add shop on the left' : 'Add shop above')}
      {item('add-right', line.orientation === 'h' ? 'Add shop on the right' : 'Add shop below')}
    </div>
  );
}
