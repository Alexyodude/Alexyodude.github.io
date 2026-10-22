import { state, save, subscribe, addPlace, updatePlace, removePlace, replaceAll, byId } from './store.js';
import { analyseInput, placeCandidates } from './parse.js';
import { analyseMedia } from './media.js';
import * as api from './services.js';
import { bestInsertIndex, optimizeOrder, distMatrix, fmtDistance, fmtDuration, googleMapsUrl, toGpx } from './plan.js';

const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v != null && v !== false) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
};
const LETTERS = i => i < 26 ? String.fromCharCode(65 + i) : String(i + 1);

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

const EMOJI = [
  [/cafe|coffee/, '☕'], [/restaurant|food|fast_food|bar|pub|bakery/, '🍽️'], [/hotel|hostel|guest|motel|camp/, '🛏️'],
  [/museum|gallery|art/, '🏛️'], [/park|garden|forest|nature|wood/, '🌳'], [/beach|coast/, '🏖️'],
  [/viewpoint|peak|mountain|hill/, '⛰️'], [/station|airport|aerodrome|bus|rail/, '🚉'],
  [/shop|market|mall|supermarket/, '🛍️'], [/fuel|charging/, '⛽'], [/temple|shrine|church|mosque|place_of_worship/, '⛩️'],
  [/attraction|tourism|monument|castle|historic/, '📸'], [/toilet/, '🚻'],
];
const emojiFor = p => (EMOJI.find(([re]) => re.test((p.category || '').toLowerCase())) || [, '📍'])[1];
const SOURCE_ICON = { search: '🔎', link: '🔗', video: '🎬', photo: '🖼️', share: '📤', pin: '📍', trip: '🧭' };

/* ---------------- Map ---------------- */

const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([35.68, 139.76], 4);
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const BASEMAPS = {
  'Streets (OpenStreetMap)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: OSM_ATTR,
  }),
  'Voyager (CARTO)': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains: 'abcd', attribution: `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
  }),
  'Satellite (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  }),
  'Terrain (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, subdomains: 'abc', attribution: `${OSM_ATTR}, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>`,
  }),
};
const BASEMAP_KEY = 'wayfinder:basemap';
let basemapName = 'Streets (OpenStreetMap)';
try { if (BASEMAPS[localStorage.getItem(BASEMAP_KEY)]) basemapName = localStorage.getItem(BASEMAP_KEY); } catch { /* private mode */ }
BASEMAPS[basemapName].addTo(map);
L.control.layers(BASEMAPS, null, { position: 'topright' }).addTo(map);
map.on('baselayerchange', e => { try { localStorage.setItem(BASEMAP_KEY, e.name); } catch { /* ignore */ } });

// OSM's tile servers refuse requests without a Referer (e.g. a page opened from file://)
// and throttle heavy users; if most tiles fail, fall back to CARTO's OSM-based tiles.
const osm = BASEMAPS['Streets (OpenStreetMap)'];
let tileOk = 0, tileBad = 0;
osm.on('tileload', () => { tileOk++; });
osm.on('tileerror', () => {
  if (++tileBad < 4 || tileOk > tileBad || !map.hasLayer(osm)) return;
  map.removeLayer(osm);
  BASEMAPS['Voyager (CARTO)'].addTo(map);
  toast('OpenStreetMap tiles unavailable — switched to CARTO');
});

const markers = new Map();
const routeLayer = L.layerGroup().addTo(map);
const suggestLayer = L.layerGroup().addTo(map);
let lastRoute = null;

function pinIcon(p) {
  const idx = state.route.stops.indexOf(p.id);
  const cls = idx >= 0 ? 'pin stop' : 'pin';
  const inner = idx >= 0 ? LETTERS(idx) : emojiFor(p);
  return L.divIcon({ className: '', html: `<div class="${cls}"><span>${inner}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
}

function popupFor(p) {
  const inRoute = state.route.stops.includes(p.id);
  return h('div', {},
    h('b', {}, p.name),
    p.address && h('div', { class: 'muted small' }, p.address),
    h('div', { class: 'row' },
      h('button', { type: 'button', onclick: () => openEdit(p.id) }, 'Edit'),
      h('button', { type: 'button', onclick: () => { toggleStop(p.id); map.closePopup(); } }, inRoute ? 'Remove from route' : 'Add to route')));
}

function renderMarkers() {
  const seen = new Set();
  for (const p of state.places) {
    seen.add(p.id);
    let m = markers.get(p.id);
    if (!m) {
      m = L.marker([p.lat, p.lng], { draggable: true, autoPan: true }).addTo(map);
      m.on('dragend', () => {
        const ll = m.getLatLng();
        updatePlace(p.id, { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) });
        toast(`Moved “${byId(p.id).name}”`);
      });
      markers.set(p.id, m);
    }
    m.setLatLng([p.lat, p.lng]);
    m.setIcon(pinIcon(p));
    m.bindPopup(() => popupFor(byId(p.id)));
  }
  for (const [id, m] of markers) if (!seen.has(id)) { m.remove(); markers.delete(id); }
}

function focusPlace(p, open = true) {
  map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: .6 });
  if (open) setTimeout(() => markers.get(p.id)?.openPopup(), 650);
  if (window.innerWidth < 900) setPanel('min');
}

function fitAll() {
  const pts = state.places.map(p => [p.lat, p.lng]);
  if (pts.length === 1) map.setView(pts[0], 14);
  else if (pts.length) {
    // Keep pins clear of the sidebar (desktop) or bottom sheet (phone).
    const wide = window.innerWidth >= 900;
    map.fitBounds(pts, { paddingTopLeft: wide ? [420, 40] : [30, 80], paddingBottomRight: wide ? [40, 40] : [30, window.innerHeight * 0.48] });
  }
}

/* ---------------- Panel ---------------- */

function setPanel(size) { $('#panel').dataset.size = size; setTimeout(() => map.invalidateSize(), 250); }
$('#grab').onclick = () => {
  const order = ['min', 'half', 'full'];
  setPanel(order[(order.indexOf($('#panel').dataset.size) + 1) % 3]);
};

function showTab(name) {
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
  $('#tab-places').hidden = name !== 'places';
  $('#tab-route').hidden = name !== 'route';
  if ($('#panel').dataset.size === 'min') setPanel('half');
}
document.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });

function thumbEl(p) {
  return p.thumb
    ? h('img', { class: 'thumb', src: p.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
    : h('div', { class: 'thumb', 'aria-hidden': 'true' }, emojiFor(p));
}

function renderPlaces() {
  const f = $('#filter').value.trim().toLowerCase();
  const list = state.places.filter(p => !f || `${p.name} ${p.address} ${p.category} ${p.notes}`.toLowerCase().includes(f));
  $('#count').textContent = state.places.length;
  $('#places-empty').hidden = state.places.length > 0;
  $('#places').replaceChildren(...list.map(p => {
    const inRoute = state.route.stops.includes(p.id);
    return h('li', {},
      thumbEl(p),
      h('button', { class: 'main', type: 'button', onclick: () => focusPlace(p) },
        h('div', { class: 'title' }, p.name),
        h('div', { class: 'sub' }, `${SOURCE_ICON[p.source?.type] || ''} ${p.address || p.category || ''}`)),
      h('button', { type: 'button', class: inRoute ? 'in-route' : '', title: inRoute ? 'Remove from route' : 'Add to route', onclick: () => toggleStop(p.id) },
        inRoute ? `✓ ${LETTERS(state.route.stops.indexOf(p.id))}` : '+ Route'),
      h('button', { type: 'button', class: 'icon', title: 'Edit', 'aria-label': `Edit ${p.name}`, onclick: () => openEdit(p.id) }, '✎'));
  }));
  $('#categories').replaceChildren(...[...new Set(state.places.map(p => p.category).filter(Boolean))].map(c => h('option', { value: c })));
}
$('#filter').oninput = renderPlaces;

/* ---------------- Route ---------------- */

const stopPlaces = () => state.route.stops.map(byId).filter(Boolean);

function toggleStop(id) {
  const stops = state.route.stops;
  const i = stops.indexOf(id);
  if (i >= 0) stops.splice(i, 1);
  else insertStop(id);
  save();
}

// New stops go where they add the least detour, keeping the start (and the end, if pinned) fixed.
function insertStop(id, at) {
  const stops = state.route.stops;
  if (at == null) {
    const pts = stopPlaces();
    at = bestInsertIndex(pts, byId(id));
    if (state.route.keepEnd && pts.length >= 2 && at === pts.length) at = pts.length - 1;
  }
  stops.splice(at, 0, id);
}

let dragFrom = null;
function renderStops() {
  const stops = stopPlaces();
  $('#stop-count').textContent = stops.length;
  $('#stops-empty').hidden = stops.length > 0;
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-checked', b.dataset.profile === state.route.profile));
  $('#keep-end').checked = state.route.keepEnd;

  const items = [];
  stops.forEach((p, i) => {
    const li = h('li', { draggable: 'true', 'data-i': i },
      h('span', { class: 'letter' }, LETTERS(i)),
      h('button', { class: 'main', type: 'button', onclick: () => focusPlace(p) },
        h('div', { class: 'title' }, p.name),
        h('div', { class: 'sub' }, i === 0 ? 'Start' : i === stops.length - 1 ? 'Destination' : p.address || p.category)),
      h('span', { class: 'tools' },
        h('button', { type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => moveStop(i, i - 1) }, '↑'),
        h('button', { type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: i === stops.length - 1, onclick: () => moveStop(i, i + 1) }, '↓'),
        h('button', { type: 'button', title: 'Edit', 'aria-label': 'Edit', onclick: () => openEdit(p.id) }, '✎'),
        h('button', { type: 'button', title: 'Remove', 'aria-label': 'Remove from route', onclick: () => toggleStop(p.id) }, '✕')));
    li.addEventListener('dragstart', e => { dragFrom = i; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drop-above'); });
    li.addEventListener('dragleave', () => li.classList.remove('drop-above'));
    li.addEventListener('drop', e => { e.preventDefault(); li.classList.remove('drop-above'); if (dragFrom != null) moveStop(dragFrom, i); dragFrom = null; });
    items.push(li);
    const leg = lastRoute?.legs?.[i];
    if (leg && i < stops.length - 1) items.push(h('li', { class: 'leg' }, `↓ ${fmtDistance(leg.distance)} · ${fmtDuration(leg.duration)}`));
  });
  $('#stops').replaceChildren(...items);

  const ok = stops.length >= 2;
  for (const id of ['#btn-optimize', '#btn-reverse', '#btn-gpx', '#btn-share-route', '#btn-along']) $(id).disabled = !ok;
  $('#btn-gmaps').toggleAttribute('hidden', !ok);
  if (ok) $('#btn-gmaps').href = googleMapsUrl(stops, state.route.profile);
}

function moveStop(from, to) {
  const s = state.route.stops;
  if (to < 0 || to >= s.length || from === to) return;
  s.splice(to, 0, s.splice(from, 1)[0]);
  save();
}

document.querySelectorAll('.seg button').forEach(b => {
  b.onclick = () => { state.route.profile = b.dataset.profile; save(); };
});
$('#keep-end').onchange = e => { state.route.keepEnd = e.target.checked; save(); };
$('#btn-reverse').onclick = () => { state.route.stops.reverse(); save(); };
$('#btn-clear').onclick = () => {
  if (!state.route.stops.length || confirm('Remove all stops from the route? Your places stay saved.')) {
    state.route.stops = []; save();
  }
};
$('#btn-optimize').onclick = async () => {
  const pts = stopPlaces();
  if (pts.length < 3) return toast('Add at least 3 stops to optimise');
  const before = state.route.stops.slice();
  let m;
  try { m = await api.table(pts, state.route.profile); }
  catch { m = distMatrix(pts); toast('Using straight-line distances (router busy)'); }
  const order = optimizeOrder(m, state.route.keepEnd);
  state.route.stops = order.map(i => before[i]);
  save();
  toast(before.join() === state.route.stops.join() ? 'Already the best order' : 'Stops reordered');
};

let routeSeq = 0, routeTimer;
function scheduleRoute() {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(computeRoute, 250);
}

let routeKey = '';
async function computeRoute() {
  const stops = stopPlaces();
  const key = state.route.profile + '|' + stops.map(p => `${p.lat},${p.lng}`).join(';');
  if (key === routeKey && lastRoute) return;
  routeKey = key;
  const seq = ++routeSeq;
  routeLayer.clearLayers();
  if (stops.length < 2) {
    lastRoute = null;
    $('#summary').textContent = stops.length ? 'Add one more stop to get directions.' : '';
    $('#steps').replaceChildren();
    renderStops();
    return;
  }
  $('#summary').textContent = 'Routing…';
  try {
    const r = await api.route(stops, state.route.profile);
    if (seq !== routeSeq) return;
    lastRoute = r;
    const line = L.polyline(r.line, { color: getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#2563eb', weight: 6, opacity: .85 });
    line.on('click', e => addStopOnLine(e.latlng));
    line.bindTooltip('Tap to add a stop here', { sticky: true });
    routeLayer.addLayer(line);
    $('#summary').replaceChildren(`${fmtDistance(r.distance)} · ${fmtDuration(r.duration)} `, h('span', { class: 'muted' }, `· ${stops.length} stops`));
    $('#steps').replaceChildren(...r.legs.flatMap((leg, i) => [
      h('li', { class: 'stop-h' }, `${LETTERS(i)} → ${LETTERS(i + 1)}  ${stops[i + 1].name}`),
      ...leg.steps.filter(s => s.distance > 0 || /Arrive/.test(s.text)).map(s => h('li', {}, s.text, s.distance ? h('span', { class: 'muted' }, ` · ${fmtDistance(s.distance)}`) : null)),
    ]));
  } catch (e) {
    if (seq !== routeSeq) return;
    lastRoute = null;
    routeKey = '';
    routeLayer.addLayer(L.polyline(stops.map(p => [p.lat, p.lng]), { color: '#888', dashArray: '6 8', weight: 3 }));
    $('#summary').replaceChildren(h('span', { class: 'muted' }, `Couldn’t get a route (${e.message}). Showing straight lines.`));
  }
  renderStops();
}

async function addStopOnLine(latlng) {
  const pos = { lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6) };
  const info = await api.reverse(pos);
  const p = addPlace({ ...pos, ...info, source: { type: 'pin' } });
  insertStop(p.id);
  save();
  toast(`Added stop “${p.name}”`);
}

// Stops along the route
$('#poi-type').replaceChildren(...Object.entries(api.POI_TYPES).map(([k, v]) => h('option', { value: k }, v[2])));
$('#btn-along').onclick = async () => {
  if (!lastRoute) return toast('Need a route first');
  const type = $('#poi-type').value;
  const box = $('#along-results');
  box.replaceChildren(h('li', { class: 'muted' }, 'Searching…'));
  suggestLayer.clearLayers();
  try {
    const found = await api.poisAlong(lastRoute.line, type, state.route.profile === 'car' ? 800 : 300);
    if (!found.length) return box.replaceChildren(h('li', { class: 'muted' }, 'Nothing found near the route.'));
    const add = (poi, li) => {
      const p = addPlace({ ...poi, source: { type: 'search', url: `https://www.openstreetmap.org/${poi.osm}` } });
      insertStop(p.id);
      save();
      li.replaceChildren(h('span', { class: 'added' }, `✓ ${poi.name} added`));
    };
    box.replaceChildren(...found.slice(0, 40).map(poi => {
      const li = h('li', {},
        h('button', { class: 'main', type: 'button', onclick: () => map.flyTo([poi.lat, poi.lng], 16) },
          h('div', { class: 'title' }, poi.name), h('div', { class: 'sub' }, poi.address || poi.category)));
      li.append(h('button', { type: 'button', onclick: () => add(poi, li) }, '+ Stop'));
      L.marker([poi.lat, poi.lng], { icon: L.divIcon({ className: '', html: '<div class="pin suggest"><span>+</span></div>', iconSize: [24, 24], iconAnchor: [12, 24] }) })
        .bindPopup(() => h('div', {}, h('b', {}, poi.name), h('button', { type: 'button', onclick: () => { add(poi, li); map.closePopup(); } }, 'Add as stop')))
        .addTo(suggestLayer);
      return li;
    }));
  } catch (e) {
    box.replaceChildren(h('li', { class: 'muted' }, `Search failed (${e.message}). Try again in a moment.`));
  }
};
$('#along').addEventListener('toggle', e => { if (!e.target.open) suggestLayer.clearLayers(); });

function download(name, type, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#btn-gpx').onclick = () => download('wayfinder-trip.gpx', 'application/gpx+xml', toGpx(stopPlaces(), lastRoute?.line, 'Wayfinder trip'));

const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

$('#btn-share-route').onclick = async () => {
  const trip = { p: state.route.profile, s: stopPlaces().map(p => [p.name, +p.lat.toFixed(5), +p.lng.toFixed(5), p.address || '', p.notes || '']) };
  const url = `${location.origin}${location.pathname}#trip=${b64(JSON.stringify(trip))}`;
  const title = `Trip: ${trip.s.map(s => s[0]).join(' → ')}`.slice(0, 120);
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast('Trip link copied'); }
  } catch { /* cancelled */ }
};

function importTripFromHash() {
  const m = location.hash.match(/#trip=([\w-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  try {
    const trip = JSON.parse(unb64(m[1]));
    if (!confirm(`Import a shared trip with ${trip.s.length} stops? It replaces your current route.`)) return;
    const ids = trip.s.map(([name, lat, lng, address, notes]) => {
      const dup = state.places.find(p => Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lng - lng) < 1e-4);
      return dup ? dup.id : addPlace({ name, lat, lng, address, notes, source: { type: 'trip' } }).id;
    });
    state.route = { ...state.route, profile: trip.p || 'car', stops: ids };
    save();
    showTab('route');
    fitAll();
  } catch { toast('That trip link is damaged'); }
}

/* ---------------- Edit dialog ---------------- */

let editing = null;
function openEdit(id) {
  const p = byId(id);
  if (!p) return;
  editing = id;
  map.closePopup();
  const f = $('#edit-form');
  for (const k of ['name', 'address', 'category', 'notes', 'lat', 'lng']) f.elements[k].value = p[k] ?? '';
  $('#edit-thumb').hidden = !p.thumb;
  if (p.thumb) $('#edit-thumb').src = p.thumb;
  const src = p.source || {};
  $('#edit-source').replaceChildren(
    `Saved ${new Date(p.createdAt).toLocaleDateString()} via ${src.type || 'search'}`,
    src.url ? h('span', {}, ' · ', h('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.title || 'original post')) : null);
  $('#edit-route').textContent = state.route.stops.includes(id) ? 'Remove from route' : 'Add to route';
  $('#dlg-edit').showModal();
}
$('#dlg-edit').addEventListener('close', () => {
  const action = $('#dlg-edit').returnValue;
  const id = editing;
  editing = null;
  if (!id || !byId(id)) return;
  const f = $('#edit-form').elements;
  const patch = () => {
    const lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
    updatePlace(id, {
      name: f.name.value.trim() || byId(id).name,
      address: f.address.value.trim(),
      category: f.category.value.trim(),
      notes: f.notes.value.trim(),
      ...(Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : {}),
    });
  };
  if (action === 'save') patch();
  else if (action === 'route') { patch(); toggleStop(id); }
  else if (action === 'delete' && confirm(`Delete “${byId(id).name}”?`)) removePlace(id);
});

/* ---------------- Search / paste ---------------- */

let searchCtl = null, searchTimer = null;
const results = $('#results');

function showResults(items, onPick) {
  results.hidden = !items.length;
  results.replaceChildren(...items.map(r => h('li', {},
    h('button', { type: 'button', onclick: () => onPick(r) },
      h('div', { class: 'title' }, r.name),
      h('div', { class: 'muted small' }, [r.category, r.address].filter(Boolean).join(' · '))))));
}

async function runSearch(q, render) {
  searchCtl?.abort();
  searchCtl = new AbortController();
  try {
    render(await api.search(q, map.getCenter(), { signal: searchCtl.signal }));
  } catch (e) {
    if (e.name !== 'AbortError') toast(`Search failed: ${e.message}`);
  }
}

function addFromResult(r, source = { type: 'search' }, thumb = null) {
  const p = addPlace({ ...r, source, thumb });
  focusPlace(p);
  toast(`Saved “${p.name}”`);
  return p;
}

const looksLikeInput = v => /https?:\/\/|geo:|-?\d{1,2}\.\d{3,}\s*[, ]\s*-?\d{1,3}\.\d{3,}/i.test(v);

$('#q').addEventListener('input', e => {
  const v = e.target.value.trim();
  clearTimeout(searchTimer);
  if (!v || looksLikeInput(v)) { results.hidden = true; return; }
  searchTimer = setTimeout(() => runSearch(v, items => showResults(items, r => {
    addFromResult(r);
    results.hidden = true;
    $('#q').value = '';
  })), 350);
});
$('#q').addEventListener('paste', e => {
  const t = e.clipboardData.getData('text');
  if (looksLikeInput(t)) { e.preventDefault(); $('#q').value = ''; handleIncoming({ text: t }, 'link'); }
});
$('#search-form').onsubmit = e => {
  e.preventDefault();
  const v = $('#q').value.trim();
  if (!v) return;
  if (looksLikeInput(v)) { $('#q').value = ''; results.hidden = true; handleIncoming({ text: v }, 'link'); return; }
  clearTimeout(searchTimer);
  runSearch(v, items => {
    if (items.length === 1) { addFromResult(items[0]); $('#q').value = ''; results.hidden = true; }
    else showResults(items, r => { addFromResult(r); results.hidden = true; $('#q').value = ''; });
  });
};
document.addEventListener('click', e => { if (!e.target.closest('.topbar')) results.hidden = true; });

/* ---------------- Drop pin ---------------- */

let pinMode = null; // null | { meta }
function startPin(meta = {}) {
  pinMode = { meta };
  $('#pin-hint').hidden = false;
  $('#map').style.cursor = 'crosshair';
  if (window.innerWidth < 900) setPanel('min');
}
function stopPin() {
  pinMode = null;
  $('#pin-hint').hidden = true;
  $('#map').style.cursor = '';
}
async function dropPin(latlng, meta = {}) {
  const pos = { lat: +latlng.lat.toFixed(6), lng: +latlng.lng.toFixed(6) };
  const info = await api.reverse(pos);
  const p = addPlace({ ...pos, ...info, ...(meta.name ? { name: meta.name } : {}), source: meta.source || { type: 'pin' }, thumb: meta.thumb || null });
  toast(`Saved “${p.name}” — drag it to adjust`);
  setTimeout(() => markers.get(p.id)?.openPopup(), 100);
}
$('#btn-pin').onclick = () => (pinMode ? stopPin() : startPin());
$('#pin-cancel').onclick = stopPin;
map.on('click', e => {
  if (!pinMode) return;
  const { meta } = pinMode;
  stopPin();
  dropPin(e.latlng, meta);
});
// Long-press (mobile) / right-click (desktop) always drops a pin.
map.on('contextmenu', e => dropPin(e.latlng));

/* ---------------- Import: links, shares, videos ---------------- */

// pending = { source, thumb, coords, name, queries }
let pending = null;

async function handleIncoming({ title = '', text = '', url = '', files = [] }, type = 'share') {
  const info = analyseInput({ title, text, url });
  const p = pending = {
    source: { type, url: info.urls.find(u => !/^geo:/i.test(u)) || null, title: title || null },
    thumb: null,
    coords: info.coords,
    name: info.name,
    queries: info.queries,
    caption: [title, text].filter(Boolean).join(' ').replace(/https?:\/\/\S+/g, '').trim(),
    loading: true,
  };
  openImport();

  for (const f of files) {
    const media = await analyseMedia(f);
    p.source.type = media.kind;
    p.source.title = p.source.title || media.fileName;
    p.thumb = p.thumb || media.thumb;
    if (media.coords && !p.coords) {
      p.coords = media.coords;
      p.foundIn = `${media.kind} metadata`;
    }
  }

  if (info.social && p.source.url) {
    const meta = await api.oembed(p.source.url);
    if (meta) {
      p.source.title = meta.title || p.source.title;
      p.thumb = p.thumb || meta.thumb;
      p.caption = [p.caption, meta.title].filter(Boolean).join(' · ');
      p.queries = [...new Set([...p.queries, ...placeCandidates(meta.title)])];
    }
  }

  if (p.coords && !p.name) {
    const r = await api.reverse(p.coords);
    p.name = r.name;
    p.address = r.address;
    p.category = r.category;
  }
  p.loading = false;
  if (pending === p) openImport();
}

function openImport() {
  const p = pending;
  const dlg = $('#dlg-import');
  $('#import-title').textContent = p.source.type === 'video' ? 'Add from video' : p.source.type === 'photo' ? 'Add from photo' : 'Add places';
  $('#import-source').replaceChildren(...(p.thumb || p.caption || p.source.url ? [
    p.thumb ? h('img', { class: 'thumb', src: p.thumb, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { class: 'thumb' }, '🔗'),
    h('div', { class: 'small', style: 'min-width:0' },
      h('div', { class: 'title' }, (p.source.title || p.caption || 'Shared link').slice(0, 140)),
      p.source.url ? h('a', { href: p.source.url, target: '_blank', rel: 'noopener', class: 'muted' }, new URL(p.source.url).hostname) : null),
  ] : []));

  const found = $('#import-found');
  found.replaceChildren();
  if (p.coords) {
    const add = h('button', { type: 'button', class: 'primary', onclick: () => {
      addFromResult({ name: p.name || 'Saved place', address: p.address || '', category: p.category || '', ...p.coords }, p.source, p.thumb);
      add.replaceWith(h('span', { class: 'added' }, '✓ Added'));
    } }, 'Add');
    found.append(h('div', { class: 'found' },
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { class: 'title' }, `📍 ${p.name || 'Location found'}`),
        h('div', { class: 'muted small' }, p.foundIn ? `From the ${p.foundIn}` : (p.address || `${p.coords.lat.toFixed(5)}, ${p.coords.lng.toFixed(5)}`))),
      add));
  } else if (p.loading) {
    found.append(h('p', { class: 'muted small' }, 'Looking for a location…'));
  } else if (p.source.type === 'video' || p.source.type === 'photo') {
    found.append(h('p', { class: 'muted small' }, 'No GPS in this file (apps often strip it). Search for the place below or pick it on the map.'));
  }

  $('#import-chips').replaceChildren(...p.queries.map(q => h('button', { type: 'button', onclick: () => { $('#import-q').value = q; importSearch(q); } }, q)));
  const q = $('#import-q');
  if (!q.value && p.queries[0] && !p.coords) { q.value = p.queries[0]; importSearch(p.queries[0]); }
  if (!dlg.open) dlg.showModal();
}

function importSearch(q) {
  const box = $('#import-results');
  box.replaceChildren(h('li', { class: 'muted' }, 'Searching…'));
  runSearch(q, items => {
    if (!items.length) return box.replaceChildren(h('li', { class: 'muted' }, 'No matches — try another spelling or pick on the map.'));
    box.replaceChildren(...items.map(r => {
      const li = h('li', {},
        h('div', { class: 'main' }, h('div', { class: 'title' }, r.name), h('div', { class: 'sub' }, [r.category, r.address].filter(Boolean).join(' · '))));
      li.append(h('button', { type: 'button', onclick: () => {
        addFromResult(r, pending?.source, pending?.thumb);
        li.lastChild.replaceWith(h('span', { class: 'added' }, '✓'));
      } }, 'Add'));
      return li;
    }));
  });
}
let importTimer;
$('#import-q').addEventListener('input', e => {
  clearTimeout(importTimer);
  const v = e.target.value.trim();
  if (v) importTimer = setTimeout(() => importSearch(v), 400);
});
$('#import-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); importSearch(e.target.value.trim()); } });
$('#import-pin').onclick = () => {
  const meta = { source: pending?.source, thumb: pending?.thumb };
  $('#dlg-import').close();
  startPin(meta);
};
$('#dlg-import').addEventListener('close', () => {
  $('#import-q').value = '';
  $('#import-results').replaceChildren();
  pending = null;
});

$('#btn-media').onclick = () => $('#media-input').click();
$('#media-input').onchange = async e => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const f of files) await handleIncoming({ files: [f] }, 'video');
};

// Drag & drop files or links onto the page.
document.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/uri-list')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (e.target.closest('#stops')) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files].filter(f => /^(video|image)\//.test(f.type));
  const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (files.length || text) handleIncoming({ text, files }, files.length ? 'video' : 'link');
});

// Share-sheet entry points: Android share target (POST via service worker),
// iOS Shortcut / bookmarklet (GET ?text=&url=&title=).
async function readShareInbox() {
  const params = new URLSearchParams(location.search);
  const get = k => params.get(k) || '';
  if (params.has('share')) {
    try {
      const cache = await caches.open('wayfinder-share');
      const metaRes = await cache.match('share/meta');
      if (metaRes) {
        const meta = await metaRes.json();
        const files = [];
        for (let i = 0; i < meta.files; i++) {
          const r = await cache.match(`share/file-${i}`);
          if (r) files.push(new File([await r.blob()], decodeURIComponent(r.headers.get('x-name') || `shared-${i}`), { type: r.headers.get('content-type') || '' }));
        }
        await caches.delete('wayfinder-share');
        history.replaceState(null, '', location.pathname);
        return handleIncoming({ ...meta, files }, files.length ? 'video' : 'share');
      }
    } catch (e) { console.warn('share inbox', e); }
  }
  if (get('text') || get('url') || get('title')) {
    history.replaceState(null, '', location.pathname);
    return handleIncoming({ title: get('title'), text: get('text'), url: get('url') }, 'share');
  }
}

/* ---------------- Backup ---------------- */

$('#btn-export').onclick = () => download(`wayfinder-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(state, null, 2));
$('#import-file').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.places)) throw new Error('not a Wayfinder backup');
    if (confirm(`Replace your ${state.places.length} places with ${data.places.length} from the backup?`)) { replaceAll(data); fitAll(); }
  } catch (err) { toast(`Couldn’t restore: ${err.message}`); }
};

/* ---------------- How-to ---------------- */

$('#btn-howto').onclick = () => {
  const base = `${location.origin}${location.pathname}`;
  $('#shortcut-url').textContent = `${base}?text=`;
  $('#bookmarklet').href = `javascript:(()=>{window.open('${base}?title='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(String(getSelection())))})()`;
  $('#dlg-howto').showModal();
};

/* ---------------- Boot ---------------- */

subscribe(() => { renderPlaces(); renderMarkers(); renderStops(); scheduleRoute(); });
renderPlaces();
renderMarkers();
renderStops();
scheduleRoute();
if (state.places.length) fitAll();
else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 13), () => {}, { timeout: 5000 });

importTripFromHash();
readShareInbox();
window.addEventListener('hashchange', importTripFromHash);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
