# Personal Website — Design Spec

**Date:** 2026-05-25
**Owner:** Alex (GitHub: `Alexyodude`)
**Domain:** `alexyodude.com`
**Repo:** `Alexyodude/alexyodude.github.io`

## Goal

A fast, minimal personal website that serves as a landing page and project portfolio. Hosted free on GitHub Pages with Cloudflare in front for DNS, CDN, SSL, and DDoS protection.

## Scope

**In scope:**
- Static landing page at `alexyodude.com`
- Hero section (name, one-line bio, social links)
- Curated "Featured Projects" section (manually edited JSON)
- "All Projects" section auto-populated from the GitHub REST API at build time
- Light/dark theme toggle with system default
- CI/CD via GitHub Actions
- Cloudflare DNS + proxy in front of GitHub Pages
- Cloudflare DNS provisioning scripted via API token (user provides token)

**Out of scope (for now):**
- Blog
- Per-project detail pages (`/projects/[slug]`)
- Contact form / backend
- Analytics
- i18n

## Stack

- **Framework:** Astro 5 (static output)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + CSS custom properties for theming
- **Build/Deploy:** GitHub Actions → publish `dist/` to `gh-pages` branch
- **Host:** GitHub Pages
- **CDN/DNS:** Cloudflare (proxied)
- **Testing:** `astro build` in CI; optional Playwright smoke test

## Architecture

Static site. Build-time data fetching. Zero runtime dependencies on the client.

```
Visitor → Cloudflare edge (SSL, CDN, DDoS) → GitHub Pages origin → static HTML/CSS/JS
```

**Build flow:**
1. Push to `main`
2. GitHub Action runs `npm ci && npm run build`
3. During build, `src/lib/github.ts` fetches public repos from `https://api.github.com/users/Alexyodude/repos`
4. Astro renders static HTML with embedded project data
5. Action publishes `dist/` to `gh-pages` branch
6. GitHub Pages serves `gh-pages` content at `alexyodude.com`

**Scheduled rebuild:** Cron-triggered GitHub Action (daily) re-runs build so new public repos appear without a manual push.

## Page Layout

Single landing page (`/`):

1. **Hero**
   - Name (large display typography)
   - One-line bio (placeholder for now)
   - Social icons: GitHub, LinkedIn, X/Twitter, email
2. **Featured Projects**
   - 3-4 curated cards from `src/content/featured.json`
   - Each card: title, description, tech tags, repo link, optional demo link
3. **All Projects**
   - Auto-fetched public repos, compact grid
   - Each tile: name, description, primary language, stars, repo link
   - Filters out forks and the website repo itself
   - Sorted by star count then recency
4. **Footer**
   - Copyright (e.g., `© 2026 Alex`)
   - Theme toggle (sun/moon icon)

## Visual Style

- **Aesthetic:** minimal, typography-focused, lots of whitespace
- **Type:** Inter (or similar humanist sans-serif), large readable sizes
- **Color:** monochrome base + single accent color
- **Theme toggle:** top-right corner sun/moon icon
- **Default theme:** matches OS preference (`prefers-color-scheme`)
- **No flash:** inline pre-paint script sets `data-theme` from `localStorage` before render

## Data Model

**`src/content/featured.json`** — manually curated:
```json
[
  {
    "title": "Project Name",
    "description": "Short description.",
    "repo": "https://github.com/Alexyodude/project",
    "demo": "https://optional-demo.example",
    "tags": ["TypeScript", "WebGL"]
  }
]
```

**`src/lib/github.ts`** — build-time fetch:
- Calls GitHub REST API (unauthenticated; 60 req/hr is plenty for build-time use)
- Returns typed `Repo[]` for use in `AllProjects.astro`
- Handles fetch failure gracefully (build fails loudly rather than silently shipping empty list)

## Repo Structure

```
alexyodude.github.io/
├── .github/workflows/
│   ├── deploy.yml              # build + publish on push to main
│   └── scheduled-rebuild.yml   # daily cron rebuild
├── src/
│   ├── pages/index.astro
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── FeaturedProjects.astro
│   │   ├── AllProjects.astro
│   │   ├── ThemeToggle.astro
│   │   └── Footer.astro
│   ├── content/featured.json
│   ├── lib/github.ts
│   └── styles/global.css
├── scripts/
│   └── cloudflare-dns.ts       # provisions DNS via Cloudflare API
├── public/
│   ├── CNAME                   # "alexyodude.com"
│   └── favicon.svg
├── docs/superpowers/specs/
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Deployment

**GitHub Pages:**
- Repo named `alexyodude.github.io` (apex repo convention)
- Pages source: `gh-pages` branch, `/` root
- Custom domain: `alexyodude.com` (set via repo Settings → Pages, persisted as `public/CNAME`)
- Enforce HTTPS: enabled (after Let's Encrypt cert issues)

**Cloudflare (scripted via API):**
- User generates a Cloudflare API token with `Zone:DNS:Edit` permission on `alexyodude.com` zone
- Token stored as GitHub Actions secret `CLOUDFLARE_API_TOKEN` (or used locally)
- `scripts/cloudflare-dns.ts` creates/updates:
  - `CNAME @ → alexyodude.github.io` (proxied)
  - `CNAME www → alexyodude.github.io` (proxied)
- SSL/TLS mode: **Full** (set manually in Cloudflare dashboard or via API)

**Cert chicken-and-egg gotcha:**
GitHub Pages must issue its Let's Encrypt cert via HTTP-01 challenge, which fails behind a Cloudflare proxy. Procedure:
1. Set DNS records as DNS-only (grey cloud) initially
2. Wait for GitHub to issue cert (visible in repo Settings → Pages)
3. Enable proxy (orange cloud)
4. Set Cloudflare SSL to **Full**

The DNS script defaults to DNS-only on first run; user flips to proxied after cert issues.

## CI/CD

**`deploy.yml`** — triggered on push to `main`:
1. Checkout
2. Setup Node 20
3. `npm ci`
4. `npm run build`
5. Publish `dist/` to `gh-pages` via `peaceiris/actions-gh-pages` or equivalent

**`scheduled-rebuild.yml`** — cron `0 6 * * *` (daily 06:00 UTC):
- Re-runs the build to pick up new public repos

## Testing

- **CI:** `astro build` must succeed (catches type errors and broken imports)
- **Optional:** Playwright smoke test loads `/`, asserts hero heading text, toggles theme, verifies project tiles render
- **Manual:** `npm run dev` for local visual review before pushing

## Content (Placeholders)

For initial scaffold, use placeholders:
- Name: `Alex` (user fills surname)
- Bio: `Software engineer building things.` (user revises)
- Social links: GitHub `Alexyodude`; others empty until user provides
- Featured projects: 4 placeholder cards labeled `Project 1`–`Project 4`

## Open Questions / Deferred

- Final bio copy
- LinkedIn / X / email handles
- Curated list of which 3-4 projects to feature (initial picks deferred to user; placeholders ship in v1)
- Whether to add per-project detail pages later

## Success Criteria

- `alexyodude.com` resolves via Cloudflare and serves the site over HTTPS
- Landing page renders hero, featured projects (placeholders), and auto-fetched repo grid
- Light/dark toggle works with no flash on load
- Push to `main` triggers a green CI run that updates the live site within ~2 minutes
- Lighthouse: 95+ on Performance, Accessibility, Best Practices, SEO
