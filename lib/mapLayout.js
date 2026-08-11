export const GAP = 128; // spacing between consecutive stations
export const LANE = 132; // spacing between parallel lines
export const PAD = 96;
export const R = 11;

/**
 * Places every street on its own lane and every shop along it, then pulls
 * corner shops onto the true intersection of the two lanes so the lines
 * actually meet instead of merely crossing near each other.
 *
 * A horizontal street sits at a fixed y (its lane) and walks along x; a
 * vertical street is the transpose. Where a shop is on one of each, the
 * meeting point is (vertical.x, horizontal.y) — so both lines are redrawn
 * through that single node and the map reads as connected.
 */
export function buildLayout(mapData) {
  if (!mapData) return null;

  // Lanes are assigned per orientation so an h-street and a v-street can
  // share a lane number without landing on top of one another.
  const laneOf = new Map();
  const counters = { h: 0, v: 0 };
  for (const line of mapData.lines) {
    const explicit = Number.isFinite(line.lane) && line.lane !== 0 ? line.lane : null;
    laneOf.set(String(line._id), explicit ?? counters[line.orientation]);
    counters[line.orientation] += 1;
  }

  const axisOf = (line) => PAD + laneOf.get(String(line._id)) * LANE;

  // First pass: naive placement, walking each line in station order.
  const lines = mapData.lines.map((line) => {
    const axis = axisOf(line);
    const stations = line.stations.map((st, i) => ({
      ...st,
      x: line.orientation === 'h' ? PAD + i * GAP : axis,
      y: line.orientation === 'h' ? axis : PAD + i * GAP,
    }));
    return { ...line, axis, stations };
  });

  const byId = new Map(mapData.lines.map((l) => [String(l._id), l]));

  // Second pass: a shop shared by a horizontal and a vertical street belongs
  // at the crossing of the two lanes, so both lines pass through it.
  const anchors = new Map(); // shopId -> {x, y}
  const seen = new Map(); // shopId -> [lineId]
  for (const line of lines) {
    for (const st of line.stations) {
      const key = String(st._id);
      seen.set(key, [...(seen.get(key) || []), String(line._id)]);
    }
  }

  for (const [shopId, lineIds] of seen) {
    if (lineIds.length < 2) continue;
    const shared = lineIds.map((id) => byId.get(id)).filter(Boolean);
    const h = shared.find((l) => l?.orientation === 'h');
    const v = shared.find((l) => l?.orientation === 'v');

    if (h && v) {
      // The natural case: the crossing of a row and a column.
      anchors.set(shopId, { x: axisOf(v), y: axisOf(h) });
    } else {
      // Two streets of the same orientation share this shop, so no crossing
      // falls out of the geometry. Keep the node on the FIRST street's own
      // lane rather than splitting the difference: a midpoint would drop it
      // onto whatever lane sits between them and make both lines zigzag.
      // The second street bends to reach it, which reads as a junction.
      const host = shared[0];
      const along = PAD + indexOnLine(host, shopId) * GAP;
      anchors.set(
        shopId,
        host.orientation === 'h'
          ? { x: along, y: axisOf(host) }
          : { x: axisOf(host), y: along }
      );
    }
  }

  function indexOnLine(line, shopId) {
    return line.stations.findIndex((s) => String(s._id) === String(shopId));
  }

  // Third pass: apply anchors, then shift each line's remaining stations so
  // they stay in order around the pinned node rather than overlapping it.
  for (const line of lines) {
    const horizontal = line.orientation === 'h';
    const main = (p) => (horizontal ? p.x : p.y); // distance along the line
    const anchorIdx = line.stations
      .map((s, i) => (anchors.has(String(s._id)) ? i : -1))
      .filter((i) => i !== -1);

    if (anchorIdx.length === 0) continue;

    // Walk the line once, pinning anchored stations and spacing the rest
    // evenly around them. Later stations are pushed past earlier anchors so
    // the click order along the street is never scrambled.
    let cursor = null;
    const placed = line.stations.map((st, i) => {
      const own = anchors.get(String(st._id));
      if (own) {
        cursor = main(own);
        return { ...st, x: own.x, y: own.y, _pos: cursor };
      }
      // Position relative to the nearest anchor behind, or ahead if none.
      if (cursor === null) {
        const nextAnchor = anchorIdx.find((a) => a > i);
        const base = main(anchors.get(String(line.stations[nextAnchor]._id)));
        const pos = base - (nextAnchor - i) * GAP;
        return horizontal
          ? { ...st, x: pos, y: line.axis, _pos: pos }
          : { ...st, x: line.axis, y: pos, _pos: pos };
      }
      cursor += GAP;
      return horizontal
        ? { ...st, x: cursor, y: line.axis, _pos: cursor }
        : { ...st, x: line.axis, y: cursor, _pos: cursor };
    });

    line.stations = placed.map(({ _pos, ...st }) => st);
  }

  // Normalise so nothing sits at a negative coordinate after the shifting.
  const allX = lines.flatMap((l) => l.stations.map((s) => s.x));
  const allY = lines.flatMap((l) => l.stations.map((s) => s.y));
  const minX = allX.length ? Math.min(...allX) : PAD;
  const minY = allY.length ? Math.min(...allY) : PAD;
  const dx = minX < PAD ? PAD - minX : 0;
  const dy = minY < PAD ? PAD - minY : 0;

  if (dx || dy) {
    for (const line of lines) {
      line.stations = line.stations.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
      line.axis += line.orientation === 'h' ? dy : dx;
    }
  }

  const xs = lines.flatMap((l) => l.stations.map((s) => s.x));
  const ys = lines.flatMap((l) => l.stations.map((s) => s.y));

  return {
    lines,
    width: Math.max(720, (xs.length ? Math.max(...xs) : 0) + PAD + 60),
    height: Math.max(380, (ys.length ? Math.max(...ys) : 0) + PAD),
  };
}

/**
 * The polyline through a line's stations. Drawing point-to-point rather than
 * end-to-end keeps the line attached to every station even after anchoring
 * has nudged them off a perfectly straight run.
 */
export function linePath(stations) {
  if (stations.length < 2) return '';
  return stations.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`).join(' ');
}
