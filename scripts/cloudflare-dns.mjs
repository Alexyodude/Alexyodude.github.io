#!/usr/bin/env node
// Provisions DNS records for alexyodude.com on Cloudflare.
//
// Required env vars:
//   CLOUDFLARE_API_TOKEN  - token with Zone:DNS:Edit on the alexyodude.com zone
//   CLOUDFLARE_ZONE_ID    - zone ID for alexyodude.com
//
// Optional:
//   PROXIED=true          - enable orange-cloud proxy (default: false)
//                           Use false on first run so GitHub can issue cert,
//                           then re-run with PROXIED=true.

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const PROXIED = process.env.PROXIED === 'true';

if (!TOKEN || !ZONE_ID) {
  console.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
  process.exit(1);
}

const API = 'https://api.cloudflare.com/client/v4';

const DOMAIN = 'alexyodude.com';
const TARGET = 'alexyodude.github.io';

const records = [
  { type: 'CNAME', name: DOMAIN, content: TARGET, proxied: PROXIED, ttl: 1 },
  { type: 'CNAME', name: `www.${DOMAIN}`, content: TARGET, proxied: PROXIED, ttl: 1 },
];

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

async function listRecords() {
  return cf(`/zones/${ZONE_ID}/dns_records?per_page=100`);
}

async function upsert(record) {
  const existing = await listRecords();
  const match = existing.find((r) => r.type === record.type && r.name === record.name);
  if (match) {
    console.log(`Updating ${record.type} ${record.name} → ${record.content} (proxied=${record.proxied})`);
    return cf(`/zones/${ZONE_ID}/dns_records/${match.id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  }
  console.log(`Creating ${record.type} ${record.name} → ${record.content} (proxied=${record.proxied})`);
  return cf(`/zones/${ZONE_ID}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

for (const r of records) {
  await upsert(r);
}

console.log('Done.');
