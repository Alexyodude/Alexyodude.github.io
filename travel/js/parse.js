// Turns whatever arrives (typed text, a pasted link, a share-sheet payload,
// a social post caption) into coordinates and/or search queries.
// Pure functions, no DOM — covered by test/parse.test.mjs.

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

const inRange = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

const pair = (a, b) => {
  const lat = parseFloat(a), lng = parseFloat(b);
  return inRange(lat, lng) ? { lat, lng } : null;
};

const plus = s => decodeURIComponent(s.replace(/\+/g, ' ')).trim();

export function extractUrls(text = '') {
  return (text.match(URL_RE) || []).map(u => u.replace(/[),.;!?]+$/, ''));
}

// Coordinates and a place name from a maps link (Google, Apple, OSM, geo:).
export function parseMapUrl(raw) {
  const out = { coords: null, name: null, kind: null };
  if (!raw) return out;

  const geo = raw.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[^?]*)(?:\?q=([^&]+))?/i);
  if (geo) {
    out.kind = 'geo';
    out.coords = pair(geo[1], geo[2]);
    if (geo[3]) {
      const q = plus(geo[3]);
      const m = q.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\s*\((.+)\))?$/);
      if (m) { out.coords = pair(m[1], m[2]) || out.coords; out.name = m[3] || null; }
      else out.name = q;
    }
    return out;
  }

  let u;
  try { u = new URL(raw); } catch { return out; }
  const host = u.hostname.replace(/^www\./, '');
  const p = u.searchParams;
  const full = decodeURIComponent(u.pathname + u.search + u.hash);

  if (/(^|\.)google\.[a-z.]+$/.test(host) || host === 'maps.google.com' || host === 'goo.gl' || host === 'maps.app.goo.gl') {
    out.kind = 'google';
    // !3d!4d is the pin itself; @lat,lng is only the viewport centre.
    const pin = full.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const at = full.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const q = p.get('q') || p.get('query') || p.get('destination') || p.get('daddr') || p.get('ll');
    const qc = q && q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    out.coords = (pin && pair(pin[1], pin[2])) || (qc && pair(qc[1], qc[2])) || (at && pair(at[1], at[2]));
    const place = u.pathname.match(/\/place\/([^/]+)/);
    if (place) out.name = plus(place[1]);
    else if (q && !qc) out.name = q.trim();
    return out;
  }

  if (host === 'maps.apple.com' || host === 'maps.apple') {
    out.kind = 'apple';
    const ll = p.get('ll') || p.get('sll') || p.get('coordinate');
    if (ll) { const [a, b] = ll.split(','); out.coords = pair(a, b); }
    out.name = p.get('q') || p.get('name') || p.get('address') || null;
    return out;
  }

  if (host.endsWith('openstreetmap.org') || host.endsWith('osm.org')) {
    out.kind = 'osm';
    if (p.get('mlat')) out.coords = pair(p.get('mlat'), p.get('mlon'));
    const m = u.hash.match(/map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
    if (!out.coords && m) out.coords = pair(m[1], m[2]);
    out.name = p.get('query') || null;
    return out;
  }

  return out;
}

// "37.7749, -122.4194", "37.7749 -122.4194", "48°51'29.6\"N 2°17'40.2\"E"
export function findCoordinates(text = '') {
  const stripped = text.replace(URL_RE, ' ');
  const dec = stripped.match(/(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/);
  if (dec) { const c = pair(dec[1], dec[2]); if (c) return c; }
  const dms = stripped.match(
    /(\d{1,2})°\s*(\d{1,2})['′]\s*([\d.]+)?["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)?["″]?\s*([EW])/i);
  if (dms) {
    const conv = (d, m, s, h) => (+d + +m / 60 + (+s || 0) / 3600) * (/[SW]/i.test(h) ? -1 : 1);
    return pair(conv(dms[1], dms[2], dms[3], dms[4]), conv(dms[5], dms[6], dms[7], dms[8]));
  }
  return null;
}

// ISO 6709 as stored in phone videos: "+37.7749-122.4194+012.345/"
export function parseIso6709(s = '') {
  const m = s.match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  return m ? pair(m[1], m[2]) : null;
}

const STOP = new Set(`the a an and or of to in on at for with from by this that these those is are was
were be been my our your their we i you it its so just very really best top must new day days trip
travel vlog guide things thing do see eat food video reel reels shorts tiktok youtube instagram watch
part episode ep vs how what why where when here there amazing beautiful hidden gem gems spot spots
fyp foryou foryoupage viral explore explorepage travelgram wanderlust instatravel traveltok
traveltiktok bucketlist`.split(/\s+/));

const clean = s => s.replace(/[\s\-–—|:,.!?·•"“”'’()[\]]+$/g, '').replace(/^[\s\-–—|:,.!?·•"“”'’()[\]]+/g, '').trim();

// Pulls likely place names out of a caption/title, best guesses first.
export function placeCandidates(text = '') {
  const found = [];
  const add = (s, weight) => {
    s = clean(s || '');
    if (s.length < 3 || s.length > 80) return;
    if (STOP.has(s.toLowerCase())) return;
    const key = s.toLowerCase();
    const prev = found.find(f => f.key === key);
    if (prev) prev.weight += weight; else found.push({ key, text: s, weight });
  };

  const body = text.replace(URL_RE, ' ');
  for (const line of body.split(/\n+/)) {
    // 📍 Name, City  /  Location: Name
    for (const m of line.matchAll(/(?:📍|📌|🗺️?|(?:location|address|where|place)\s*[:\-–])\s*([^\n#@|•]+)/gi)) add(m[1], 10);
  }
  // "at Fushimi Inari", "in Kyoto, Japan"
  for (const m of body.matchAll(/\b(?:at|in|to|visit(?:ing|ed)?|near|from)\s+((?:the\s+)?[A-Z][\p{L}'’.-]*(?:[\s,]+(?:de|del|da|di|la|le|of|the|&|[A-Z][\p{L}'’.-]*))*)/gu)) add(m[1].replace(/^the\s+/i, ''), 4);
  // Hashtags: #KyotoJapan -> Kyoto Japan
  for (const m of body.matchAll(/#([\p{L}\p{N}_]{3,})/gu)) {
    const tag = m[1];
    if (STOP.has(tag.toLowerCase())) continue;
    add(tag.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\p{Ll}/u, c => c.toUpperCase()), 2);
  }
  // Runs of Capitalised Words that aren't the start of a sentence.
  for (const m of body.matchAll(/(?:^|[^.!?\n]\s)((?:[A-Z][\p{L}'’-]+)(?:\s+(?:de|del|la|of|the|[A-Z][\p{L}'’-]+)){1,4})/gu)) add(m[1], 1);

  return found.sort((a, b) => b.weight - a.weight).map(f => f.text).slice(0, 8);
}

const SOCIAL = [
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.watch)$/],
  ['x', /(^|\.)(twitter\.com|x\.com)$/],
  ['vimeo', /(^|\.)vimeo\.com$/],
  ['pinterest', /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  ['reddit', /(^|\.)(reddit\.com|redd\.it)$/],
];

export function socialKind(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\.|^m\./, '');
    return (SOCIAL.find(([, re]) => re.test(host)) || [null])[0];
  } catch { return null; }
}

// One entry point for typed/pasted/shared input.
// Returns { coords, name, queries[], urls[], social }.
export function analyseInput({ title = '', text = '', url = '' } = {}) {
  const all = [title && !text.includes(title) ? title : '', text, url].filter(Boolean).join('\n');
  const urls = [...new Set([url, ...extractUrls(all)].filter(Boolean))];
  const geoUri = all.match(/geo:[^\s]+/i);
  if (geoUri) urls.unshift(geoUri[0]);

  let coords = null, name = null, social = null, mapLink = null;
  for (const u of urls) {
    const r = parseMapUrl(u);
    if (r.kind) {
      mapLink = u;
      coords = coords || r.coords;
      name = name || r.name;
    }
    social = social || socialKind(u);
  }
  coords = coords || findCoordinates(all);

  // Lines that aren't links: map apps share "Name\nAddress\nlink".
  const lines = all.replace(URL_RE, '\n').split('\n').map(s => s.trim()).filter(s => s && !/^geo:/i.test(s));
  const queries = [];
  if (name) queries.push(name);
  if (mapLink && lines.length) {
    queries.push(lines.slice(0, 2).join(', '));
    queries.push(lines[0]);
  } else if (!social && lines.length === 1 && lines[0].length <= 120) {
    queries.push(lines[0]);
  }
  for (const c of placeCandidates(lines.join('\n'))) queries.push(c);

  return {
    coords,
    name: name || (mapLink && lines[0]) || null,
    queries: [...new Set(queries.map(q => q.trim()).filter(Boolean))].slice(0, 8),
    urls,
    social,
  };
}
