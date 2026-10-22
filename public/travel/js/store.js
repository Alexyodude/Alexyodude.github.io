// State lives in localStorage on this device. Back up / Restore moves it between devices.

const KEY = 'wayfinder:v1';

const blank = () => ({ places: [], route: { stops: [], profile: 'car', keepEnd: true } });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.places)) return { ...blank(), ...s, route: { ...blank().route, ...s.route } };
  } catch { /* fall through */ }
  return blank();
}

export const state = load();
const subs = new Set();

export function subscribe(fn) { subs.add(fn); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('save failed', e); }
  subs.forEach(fn => fn(state));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const byId = id => state.places.find(p => p.id === id);

export function addPlace(p) {
  const place = {
    id: uid(),
    name: p.name || 'Untitled place',
    address: p.address || '',
    category: p.category || '',
    notes: p.notes || '',
    lat: +p.lat,
    lng: +p.lng,
    thumb: p.thumb || null,
    source: p.source || { type: 'search' },
    createdAt: new Date().toISOString(),
  };
  state.places.unshift(place);
  save();
  return place;
}

export function updatePlace(id, patch) {
  Object.assign(byId(id), patch);
  save();
}

export function removePlace(id) {
  state.places = state.places.filter(p => p.id !== id);
  state.route.stops = state.route.stops.filter(s => s !== id);
  save();
}

export function replaceAll(data) {
  const b = blank();
  state.places = Array.isArray(data.places) ? data.places : [];
  state.route = { ...b.route, ...(data.route || {}) };
  state.route.stops = state.route.stops.filter(id => byId(id));
  save();
}
