// Network calls. Everything here is a free, keyless, CORS-enabled public API.
// They have fair-use limits; swap the base URLs for self-hosted ones if you outgrow them.

const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = {
  car: 'https://routing.openstreetmap.de/routed-car',
  bike: 'https://routing.openstreetmap.de/routed-bike',
  foot: 'https://routing.openstreetmap.de/routed-foot',
};
const OVERPASS = 'https://overpass-api.de/api/interpreter';

async function getJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
  // The caller's signal cancels; the timeout still applies alongside it.
  const signal = opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal;
  try {
    const r = await fetch(url, { ...opts, signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const photonLabel = p => {
  const parts = [p.street && [p.housenumber, p.street].filter(Boolean).join(' '), p.city || p.town || p.village, p.state, p.country];
  return [...new Set(parts.filter(Boolean))].filter(x => x !== p.name).join(', ');
};

export async function search(q, near, { signal } = {}) {
  const u = new URL(`${PHOTON}/api/`);
  u.searchParams.set('q', q);
  u.searchParams.set('limit', '8');
  if (near) { u.searchParams.set('lat', near.lat.toFixed(4)); u.searchParams.set('lon', near.lng.toFixed(4)); }
  const j = await getJson(u, { signal });
  return j.features.map(f => ({
    name: f.properties.name || f.properties.street || q,
    address: photonLabel(f.properties),
    category: f.properties.osm_value || f.properties.type || '',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

export async function reverse({ lat, lng }) {
  try {
    const j = await getJson(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`);
    const a = j.address || {};
    return {
      name: j.name || a.road || a.suburb || a.city || 'Dropped pin',
      address: j.display_name || '',
      category: j.type || '',
    };
  } catch { return { name: 'Dropped pin', address: '', category: '' }; }
}

// Title/caption/thumbnail for a social link. Instagram/Facebook need an app token,
// so for those we only get what the share sheet itself passed in.
export async function oembed(url) {
  const tries = [];
  if (/tiktok\.com/.test(url)) tries.push(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (/youtube\.com|youtu\.be/.test(url)) tries.push(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (/vimeo\.com/.test(url)) tries.push(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
  tries.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
  for (const t of tries) {
    try {
      const j = await getJson(t, { timeout: 8000 });
      if (j && (j.title || j.author_name)) {
        return { title: j.title || '', author: j.author_name || '', thumb: j.thumbnail_url || null, provider: j.provider_name || '' };
      }
    } catch { /* next */ }
  }
  return null;
}

const coordStr = pts => pts.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

export async function route(points, profile = 'car') {
  const u = `${OSRM[profile]}/route/v1/driving/${coordStr(points)}?overview=full&geometries=geojson&steps=true&annotations=false`;
  const j = await getJson(u, { timeout: 20000 });
  if (j.code !== 'Ok' || !j.routes.length) throw new Error(j.message || j.code || 'No route');
  const r = j.routes[0];
  return {
    distance: r.distance,
    duration: r.duration,
    line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    legs: r.legs.map(l => ({
      distance: l.distance,
      duration: l.duration,
      steps: l.steps.map(s => ({
        text: stepText(s),
        distance: s.distance,
      })),
    })),
  };
}

function stepText(s) {
  const m = s.maneuver;
  const road = s.name || s.ref || '';
  const mod = m.modifier ? ` ${m.modifier}` : '';
  switch (m.type) {
    case 'depart': return `Head ${dir(m.bearing_after)}${road ? ` on ${road}` : ''}`;
    case 'arrive': return 'Arrive at stop';
    case 'roundabout': case 'rotary': return `Roundabout, exit ${m.exit || ''}${road ? ` onto ${road}` : ''}`;
    case 'merge': return `Merge${mod}${road ? ` onto ${road}` : ''}`;
    case 'fork': return `Keep${mod}${road ? ` onto ${road}` : ''}`;
    case 'continue': case 'new name': return `Continue${road ? ` on ${road}` : ''}`;
    default: return `Turn${mod}${road ? ` onto ${road}` : ''}`;
  }
}

const dir = b => ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round((b || 0) / 45) % 8];

// Travel-time matrix (seconds) for reordering stops.
export async function table(points, profile = 'car') {
  const j = await getJson(`${OSRM[profile]}/table/v1/driving/${coordStr(points)}`, { timeout: 20000 });
  if (j.code !== 'Ok') throw new Error(j.code);
  return j.durations;
}

export const POI_TYPES = {
  cafe: ['amenity', 'cafe', 'Coffee'],
  restaurant: ['amenity', 'restaurant', 'Food'],
  fuel: ['amenity', 'fuel', 'Fuel'],
  charging_station: ['amenity', 'charging_station', 'EV charging'],
  toilets: ['amenity', 'toilets', 'Toilets'],
  viewpoint: ['tourism', 'viewpoint', 'Viewpoints'],
  attraction: ['tourism', 'attraction', 'Attractions'],
  museum: ['tourism', 'museum', 'Museums'],
  hotel: ['tourism', 'hotel', 'Hotels'],
  supermarket: ['shop', 'supermarket', 'Groceries'],
  park: ['leisure', 'park', 'Parks'],
};

// Public Overpass servers are often overloaded (502/504, or minute-long waits): try a
// second one before giving up on them.
const OVERPASS_MIRRORS = [OVERPASS, 'https://overpass.kumi.systems/api/interpreter'];

// Train stations and bus stations inside a map bounding box (south, west, north, east).
// Metro, tram and light-rail stops are left out: this is for getting between cities.
// Returns { stations, partial }: partial when Overpass was unreachable and the list came
// from Nominatim's search, which caps each query at 40 results.
export async function stationsIn(box, { signal } = {}) {
  const failures = [];
  for (const url of OVERPASS_MIRRORS) {
    try {
      return { stations: await overpassStations(url, box, signal), partial: false };
    } catch (err) {
      if (signal?.aborted) throw err;
      failures.push(`${new URL(url).host}: ${err.message || err.name}`);
    }
  }
  try {
    return { stations: await nominatimStations(box, signal), partial: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error(`${failures.join('; ')}; Nominatim: ${err.message}`);
  }
}

async function nominatimStations([s, w, n, e], signal) {
  const found = [];
  for (const [q, kind] of [['railway station', 'rail'], ['bus station', 'bus']]) {
    const u = new URL(`${NOMINATIM}/search`);
    for (const [k, v] of Object.entries({ q, format: 'jsonv2', limit: 40, bounded: 1, extratags: 1, 'accept-language': 'en',
      viewbox: [w, n, e, s].map(x => x.toFixed(4)).join(',') })) u.searchParams.set(k, v);
    for (const r of await getJson(u, { signal })) {
      const t = r.extratags || {};
      // Nominatim's "railway station" also returns metro stops: keep mainline ones.
      if (kind === 'rail' && (r.type !== 'station' || /subway|light_rail|monorail|tram/.test(t.station || '') || t.subway === 'yes')) continue;
      if (kind === 'bus' && r.type !== 'bus_station') continue;
      found.push({ name: r.name || (kind === 'bus' ? 'Bus station' : 'Station'), local: '', kind,
        lat: +r.lat, lng: +r.lon, osm: `${r.osm_type}/${r.osm_id}` });
    }
  }
  return found;
}

async function overpassStations(url, [s, w, n, e], signal) {
  const bb = [s, w, n, e].map(x => x.toFixed(4)).join(',');
  const q = `[out:json][timeout:12];(
    nwr["railway"="station"]["station"!~"subway|light_rail|monorail|tram"](${bb});
    nwr["amenity"="bus_station"](${bb});
  );out center 300;`;
  const j = await getJson(url, { method: 'POST', body: new URLSearchParams({ data: q }), timeout: 12000, signal });
  return j.elements
    .map(e => ({
      name: e.tags?.['name:en'] || e.tags?.name || (e.tags?.amenity === 'bus_station' ? 'Bus station' : 'Station'),
      local: e.tags?.['name:en'] && e.tags?.name !== e.tags['name:en'] ? e.tags.name : '',
      kind: e.tags?.amenity === 'bus_station' ? 'bus' : 'rail',
      lat: e.lat ?? e.center?.lat,
      lng: e.lon ?? e.center?.lon,
      osm: `${e.type}/${e.id}`,
    }))
    .filter(p => Number.isFinite(p.lat));
}

// POIs within `radius` metres of a polyline.
export async function poisAlong(line, type, radius = 400) {
  const [k, v] = POI_TYPES[type];
  // Overpass rejects very long queries; thin the line to ~80 vertices.
  const step = Math.max(1, Math.ceil(line.length / 80));
  const pts = line.filter((_, i) => i % step === 0 || i === line.length - 1);
  const poly = pts.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(',');
  const q = `[out:json][timeout:25];nwr["${k}"="${v}"](around:${radius},${poly});out center 60;`;
  const j = await getJson(OVERPASS, {
    method: 'POST',
    body: new URLSearchParams({ data: q }),
    timeout: 30000,
  });
  return j.elements
    .map(e => ({
      name: e.tags?.name || POI_TYPES[type][2].replace(/s$/, ''),
      address: [e.tags?.['addr:housenumber'], e.tags?.['addr:street'], e.tags?.['addr:city']].filter(Boolean).join(' '),
      category: v,
      lat: e.lat ?? e.center?.lat,
      lng: e.lon ?? e.center?.lon,
      osm: `${e.type}/${e.id}`,
    }))
    .filter(p => Number.isFinite(p.lat));
}
