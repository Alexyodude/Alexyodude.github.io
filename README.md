# alexyodude.com

Personal website. Built with Astro, hosted on GitHub Pages, fronted by Cloudflare.

## Develop

```
npm install
npm run dev
```

## Deploy

Push to `main`. GitHub Actions builds and publishes to `gh-pages`.

## Cloudflare DNS

1. Create a Cloudflare API token with `Zone:DNS:Edit` permission on `alexyodude.com`.
2. Get the zone ID from the Cloudflare dashboard (zone overview).
3. First run — DNS only, so GitHub Pages can issue its cert:

   `CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run cloudflare:dns`

4. Wait until GitHub Pages shows the site published at https://alexyodude.com with a valid cert (visible in repo Settings → Pages).
5. Re-run with proxy enabled:

   `PROXIED=true CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run cloudflare:dns`

6. In the Cloudflare dashboard, set SSL/TLS → Overview → mode = **Full**.
