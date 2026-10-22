import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine, bestInsertIndex, optimizeOrder, distMatrix, fmtDistance, fmtDuration, googleMapsUrl, toGpx } from '../../public/travel/js/plan.js';

const P = (lat, lng) => ({ lat, lng });

test('haversine London→Paris ≈ 344 km', () => {
  const d = haversine(P(51.5074, -0.1278), P(48.8566, 2.3522));
  assert.ok(Math.abs(d - 343500) < 2000, d);
});

test('insert slots a stop between the two it sits between', () => {
  const stops = [P(0, 0), P(0, 2), P(0, 4)];
  assert.equal(bestInsertIndex(stops, P(0.1, 1)), 1);
  assert.equal(bestInsertIndex(stops, P(0.1, 3)), 2);
  assert.equal(bestInsertIndex(stops, P(0, 6)), 3);
  assert.equal(bestInsertIndex([P(0, 0)], P(1, 1)), 1);
});

test('optimise keeps start and end, fixes a zig-zag', () => {
  const pts = [P(0, 0), P(0, 3), P(0, 1), P(0, 2), P(0, 4)];
  assert.deepEqual(optimizeOrder(distMatrix(pts), true), [0, 2, 3, 1, 4]);
});

test('optimise with a free end, and the heuristic path for many stops', () => {
  const pts = [P(0, 0), P(0, 3), P(0, 1), P(0, 2)];
  assert.deepEqual(optimizeOrder(distMatrix(pts), false), [0, 2, 3, 1]);
  const many = [P(0, 0), ...[7, 3, 9, 1, 5, 2, 8, 4, 6, 10, 11].map(x => P(0, x))];
  const o = optimizeOrder(distMatrix(many), false);
  assert.deepEqual(o.map(i => many[i].lng), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('formatting', () => {
  assert.equal(fmtDistance(850), '850 m');
  assert.equal(fmtDistance(1530), '1.5 km');
  assert.equal(fmtDistance(123456), '123 km');
  assert.equal(fmtDuration(30), '1 min');
  assert.equal(fmtDuration(3900), '1 h 5 min');
});

test('google maps directions link and GPX', () => {
  const stops = [{ ...P(1, 2), name: 'A' }, { ...P(3, 4), name: 'B & C' }, { ...P(5, 6), name: 'D' }];
  const u = new URL(googleMapsUrl(stops, 'foot'));
  assert.equal(u.searchParams.get('origin'), '1,2');
  assert.equal(u.searchParams.get('waypoints'), '3,4');
  assert.equal(u.searchParams.get('travelmode'), 'walking');
  const g = toGpx(stops, [[1, 2], [3, 4]]);
  assert.match(g, /<name>B &amp; C<\/name>/);
  assert.match(g, /<trkpt lat="3" lon="4"\/>/);
});
