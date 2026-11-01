// A photo, a short description and sources for a place, from Wikipedia, so every
// marker carries them on any device, even when the place was saved without them
// (data lives per device; a backup restored elsewhere is not needed for this).
//
// One request: a title search on the place's name, with each hit's coordinates,
// lead text and lead image. A hit counts only if its coordinates are within
// MAX_KM of the pin (or it has none, as large regions often do), so a same-named
// place elsewhere is never attached.

const API = 'https://en.wikipedia.org/w/api.php';
const MAX_KM = 120;

const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2
    + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const trim = (text, n = 480) => {
  if (text.length <= n) return text;
  const cut = text.slice(0, n);
  const sentence = cut.slice(0, cut.lastIndexOf('. ') + 1);
  return (sentence.length > n / 2 ? sentence : cut.slice(0, cut.lastIndexOf(' '))) + '…';
};

// The name as Wikipedia would title it: without our "(East Gate)"-style asides.
const searchName = name => name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/** {thumb, info, links} for place p, or null when no nearby article matches. */
export async function wikiFor(p, { signal } = {}) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({
    action: 'query', format: 'json', origin: '*', redirects: 1,
    generator: 'search', gsrsearch: searchName(p.name), gsrlimit: 5,
    prop: 'coordinates|pageimages|extracts|info|pageprops', inprop: 'url', ppprop: 'disambiguation',
    exintro: 1, explaintext: 1, exlimit: 5, piprop: 'thumbnail|name', pithumbsize: 640, colimit: 5,
  })) u.searchParams.set(k, v);
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error(`Wikipedia answered ${r.status} for ${p.name}`);
  const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  const here = { lat: p.lat, lng: p.lng };
  // Words of the name worth matching on (not "the", "park", "station"...): the title
  // must share one, so a search hit about something else is never attached.
  // Apostrophes join a word rather than split it ("Xi'an" is one word, "xian").
  const tokens = s => s.toLowerCase().replace(/['’`]/g, '').split(/[^\p{L}\p{N}]+/u);
  const words = new Set(tokens(searchName(p.name))
    .filter(w => w.length > 2 && !['the', 'and', 'park', 'station', 'street', 'food', 'city', 'town', 'ancient', 'viewpoint'].includes(w)));
  // A shared word, either way round, so transliterations still match ("Hongyadong" / "Hongya Cave").
  const shares = title => tokens(title).filter(t => t.length > 3)
    .some(t => [...words].some(w => w.includes(t) || t.includes(w)));
  const exact = title => title.toLowerCase() === searchName(p.name).toLowerCase();
  // Words of the place's address ("Chongqing", "Xinjiang"...): an article without
  // coordinates must mention one, which rules out people and topics of the same name.
  const area = (p.address || '').split(/[,\s]+/).filter(w => w.length > 3 && !/^\d/.test(w));
  const page = pages.find(pg => {
    if (!pg.extract || 'disambiguation' in (pg.pageprops || {}) || !shares(pg.title)) return false;
    const c = pg.coordinates?.[0];
    // A big area's point can sit far from the pin: allow that only for an exact title match.
    if (c) return km(here, { lat: c.lat, lng: c.lon }) <= (exact(pg.title) ? 600 : MAX_KM);
    return area.some(w => pg.extract.includes(w));
  });
  if (!page) return null;
  const links = [{ title: `Wikipedia: ${page.title}`, url: page.fullurl }];
  if (page.pageimage) links.push({ title: 'Photo: Wikimedia Commons', url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}` });
  return { thumb: page.thumbnail?.source || null, info: trim(page.extract.replace(/\s+/g, ' ').trim()), links };
}
