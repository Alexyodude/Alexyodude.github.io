import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMapUrl, findCoordinates, parseIso6709, placeCandidates, analyseInput, socialKind } from '../../public/travel/js/parse.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-4, `${a} ≈ ${b}`);

test('google maps place link prefers the pin over the viewport', () => {
  const r = parseMapUrl('https://www.google.com/maps/place/Fushimi+Inari+Taisha/@34.9671402,135.7726717,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d34.9676945!4d135.7791876');
  assert.equal(r.kind, 'google');
  assert.equal(r.name, 'Fushimi Inari Taisha');
  near(r.coords.lat, 34.9676945);
  near(r.coords.lng, 135.7791876);
});

test('google maps search link with q=lat,lng and q=name', () => {
  near(parseMapUrl('https://maps.google.com/?q=48.8584,2.2945').coords.lat, 48.8584);
  const r = parseMapUrl('https://www.google.com/maps/search/?api=1&query=Eiffel+Tower');
  assert.equal(r.name, 'Eiffel Tower');
  assert.equal(r.coords, null);
});

test('apple, osm and geo links', () => {
  const a = parseMapUrl('https://maps.apple.com/?ll=37.8199,-122.4783&q=Golden%20Gate%20Bridge');
  near(a.coords.lng, -122.4783);
  assert.equal(a.name, 'Golden Gate Bridge');
  const o = parseMapUrl('https://www.openstreetmap.org/#map=17/51.50080/-0.12460');
  near(o.coords.lat, 51.5008);
  const g = parseMapUrl('geo:0,0?q=40.6892,-74.0445(Statue of Liberty)');
  near(g.coords.lat, 40.6892);
  assert.equal(g.name, 'Statue of Liberty');
});

test('coordinates in plain text, decimal and DMS', () => {
  near(findCoordinates('meet at 35.6586, 139.7454 ok').lng, 139.7454);
  const d = findCoordinates(`48°51'29.6"N 2°17'40.2"E`);
  near(d.lat, 48.858222);
  near(d.lng, 2.2945);
  assert.equal(findCoordinates('call 555.1234 now'), null);
});

test('ISO 6709 from phone videos', () => {
  const c = parseIso6709('+37.7749-122.4194+012.345/');
  near(c.lat, 37.7749);
  near(c.lng, -122.4194);
});

test('place candidates from a travel caption', () => {
  const c = placeCandidates('Sunrise hike at Fushimi Inari 🦊 📍 Kyoto, Japan #kyoto #japantravel #fyp');
  assert.ok(c.includes('Kyoto, Japan'), c.join(' | '));
  assert.ok(c.includes('Fushimi Inari'), c.join(' | '));
  assert.ok(!c.some(x => /fyp/i.test(x)));
});

test('google maps app share text: name + address + short link', () => {
  const r = analyseInput({ text: 'Tartine Bakery\n600 Guerrero St, San Francisco, CA 94110\nhttps://maps.app.goo.gl/AbC123' });
  assert.equal(r.coords, null);
  assert.equal(r.name, 'Tartine Bakery');
  assert.equal(r.queries[0], 'Tartine Bakery, 600 Guerrero St, San Francisco, CA 94110');
});

test('social links are recognised', () => {
  assert.equal(socialKind('https://www.tiktok.com/@a/video/1'), 'tiktok');
  assert.equal(socialKind('https://youtu.be/xyz'), 'youtube');
  assert.equal(socialKind('https://www.instagram.com/reel/abc/'), 'instagram');
  const r = analyseInput({ text: 'Best ramen in Tokyo! https://www.instagram.com/reel/abc/' });
  assert.equal(r.social, 'instagram');
  assert.ok(r.queries.includes('Tokyo'));
});

test('typed place name becomes the query', () => {
  assert.deepEqual(analyseInput({ text: 'Blue Lagoon Iceland' }).queries[0], 'Blue Lagoon Iceland');
});

test('long itinerary caption yields every stop', () => {
  const t = `1️⃣ Gansu + Qinghai
I used Xining as my starting point and took high speed rail to Dunhuang, Zhangye and back to Xining then took bus to Xiahe then bus to Lanzhou then train to Longnan.

Xining you can do a daytrip to Chaka Salt Lake & Qinghai lake.

2️⃣ Xinjiang
If already in Dunhuang, take high speed rail to Yumen Station and there's a direct 5.5-6h high speed rail to Urumqi 🚄`;
  const q = analyseInput({ text: t }).queries;
  for (const p of ['Xining', 'Dunhuang', 'Zhangye', 'Xiahe', 'Lanzhou', 'Longnan', 'Chaka Salt Lake', 'Qinghai Lake', 'Yumen Station', 'Urumqi', 'Xinjiang', 'Gansu']) {
    assert.ok(q.includes(p), `${p} missing from ${q.join(' | ')}`);
  }
  assert.ok(!q.some(x => /^(If|I|Xining the)$/.test(x)), q.join(' | '));
});
