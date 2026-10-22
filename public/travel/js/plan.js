// Route planning maths. Pure functions — covered by test/plan.test.mjs.

export function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const distMatrix = pts => pts.map(a => pts.map(b => haversine(a, b)));

// Where to slot `p` into `stops` so the detour is smallest.
// Never before the start; appends when there are fewer than two stops.
export function bestInsertIndex(stops, p) {
  if (stops.length < 2) return stops.length;
  let best = stops.length, cost = haversine(stops[stops.length - 1], p);
  for (let i = 1; i < stops.length; i++) {
    const c = haversine(stops[i - 1], p) + haversine(p, stops[i]) - haversine(stops[i - 1], stops[i]);
    if (c < cost) { cost = c; best = i; }
  }
  return best;
}

const pathCost = (m, order) => order.slice(1).reduce((s, j, i) => s + m[order[i]][j], 0);

function permute(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p]));
}

// Order indices 0..n-1 for the shortest path. Start (index 0) stays first;
// if keepEnd, index n-1 stays last. Exact up to 8 middle stops, else
// nearest-neighbour plus 2-opt.
export function optimizeOrder(m, keepEnd = true) {
  const n = m.length;
  if (n <= 3) return [...Array(n).keys()];
  const middle = [...Array(n).keys()].slice(1, keepEnd ? n - 1 : n);
  const wrap = mid => [0, ...mid, ...(keepEnd ? [n - 1] : [])];

  if (middle.length <= 8) {
    let best = null, bestCost = Infinity;
    for (const p of permute(middle)) {
      const o = wrap(p), c = pathCost(m, o);
      if (c < bestCost) { bestCost = c; best = o; }
    }
    return best;
  }

  const left = new Set(middle), mid = [];
  let cur = 0;
  while (left.size) {
    let nx = null;
    for (const j of left) if (nx === null || m[cur][j] < m[cur][nx]) nx = j;
    mid.push(nx); left.delete(nx); cur = nx;
  }
  let order = wrap(mid), improved = true;
  const last = keepEnd ? n - 2 : n - 1;
  while (improved) {
    improved = false;
    for (let i = 1; i < last; i++) {
      for (let k = i + 1; k <= last; k++) {
        const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (pathCost(m, cand) + 1e-9 < pathCost(m, order)) { order = cand; improved = true; }
      }
    }
  }
  return order;
}

export function fmtDistance(m) {
  return m >= 10000 ? `${Math.round(m / 1000)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function fmtDuration(s) {
  const h = Math.floor(s / 3600), min = Math.round((s % 3600) / 60);
  return h ? `${h} h ${min} min` : `${Math.max(1, min)} min`;
}

const MODE = { car: 'driving', bike: 'bicycling', foot: 'walking' };

export function googleMapsUrl(stops, profile = 'car') {
  const ll = p => `${p.lat},${p.lng}`;
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', ll(stops[0]));
  u.searchParams.set('destination', ll(stops[stops.length - 1]));
  if (stops.length > 2) u.searchParams.set('waypoints', stops.slice(1, -1).map(ll).join('|'));
  u.searchParams.set('travelmode', MODE[profile]);
  return u.toString();
}

const esc = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

export function toGpx(stops, line, name = 'Trip') {
  const wpts = stops.map(s => `  <wpt lat="${s.lat}" lon="${s.lng}"><name>${esc(s.name)}</name>${s.notes ? `<desc>${esc(s.notes)}</desc>` : ''}</wpt>`).join('\n');
  const trk = line?.length
    ? `  <trk><name>${esc(name)}</name><trkseg>\n${line.map(([a, b]) => `    <trkpt lat="${a}" lon="${b}"/>`).join('\n')}\n  </trkseg></trk>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wayfinder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name></metadata>
${wpts}
${trk}
</gpx>
`;
}
