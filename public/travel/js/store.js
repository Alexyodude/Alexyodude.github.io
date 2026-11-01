// State lives in localStorage on this device. Back up / Restore moves it between devices.
import { socialKind } from './parse.js';

const KEY = 'wayfinder:v1';

// route: the active route; routeOptions: the other saved routes, keyed by name (same shape as route).
const blank = () => ({ places: [], route: { stops: [], profile: 'car', keepEnd: true }, routeOptions: {} });
const isObj = o => o != null && typeof o === 'object' && !Array.isArray(o);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.places)) return { ...blank(), ...s, route: { ...blank().route, ...s.route }, routeOptions: isObj(s.routeOptions) ? s.routeOptions : {} };
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

// Local date as YYYY-MM-DD.
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const SOCIAL_NAME = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', x: 'X', vimeo: 'Vimeo', pinterest: 'Pinterest', reddit: 'Reddit' };
const VIDEO_SITES = new Set(['youtube', 'tiktok', 'instagram', 'facebook', 'vimeo']);

// Where a suggestion came from, { kind, by, via, url, date }, guessed from how it was saved.
export function guessProvenance(src = {}) {
  const date = today();
  const url = src.url || null;
  let out;
  if (src.type === 'pin') out = { kind: 'self', via: 'dropped pin' };
  else if (src.type === 'trip') out = { kind: 'friend', via: 'shared trip link' };
  else if (src.type === 'photo') out = { kind: 'self', via: 'photo', url };
  else if (src.type === 'video') out = { kind: 'reel', by: src.by, via: 'video', url };
  else {
    const social = url && socialKind(url);
    if (social) out = { kind: VIDEO_SITES.has(social) ? 'reel' : 'web', by: src.by, via: `${SOCIAL_NAME[social]} ${VIDEO_SITES.has(social) ? 'reel' : 'post'}`, url };
    else if (url) out = { kind: 'web', by: src.by, via: new URL(url).hostname.replace(/^www\./, ''), url };
    else out = { kind: 'web', via: 'place search' };
  }
  return Object.fromEntries(Object.entries({ ...out, date }).filter(([, v]) => v));
}

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
    provenance: p.provenance || guessProvenance(p.source || { type: 'search' }),
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
  state.routeOptions = isObj(data.routeOptions) ? data.routeOptions : {};
  save();
}

/* Route options: alternative saved routes. state.route.name is the active one's name. */

export const routeName = () => state.route.name || 'Main';
export const routeNames = () => [routeName(), ...Object.keys(state.routeOptions)].sort((a, b) => a.localeCompare(b));

// Keeps the current route active and stores a copy of it as a new option.
export function saveRouteAs(name) {
  name = String(name || '').trim();
  if (!name) throw new Error('give the option a name');
  if (routeNames().includes(name)) throw new Error(`“${name}” already exists`);
  state.routeOptions[name] = { ...structuredClone(state.route), name };
  save();
}

export function switchRoute(name) {
  const next = state.routeOptions[name];
  if (!next) throw new Error(`no route option “${name}”`);
  state.routeOptions[routeName()] = { ...structuredClone(state.route), name: routeName() };
  delete state.routeOptions[name];
  state.route = { ...blank().route, ...next, name };
  state.route.stops = state.route.stops.filter(id => byId(id));
  save();
}

// Deletes the active option and makes another (the first by name) active.
export function deleteRoute() {
  const [other] = Object.keys(state.routeOptions).sort((a, b) => a.localeCompare(b));
  if (!other) throw new Error('it is the only route');
  const gone = routeName();
  switchRoute(other);
  delete state.routeOptions[gone];
  save();
  return gone;
}
