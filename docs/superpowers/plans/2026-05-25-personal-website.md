# Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a minimal Astro static site at `alexyodude.com`, hosted on GitHub Pages with Cloudflare DNS+proxy in front.

**Architecture:** Astro 5 static output. Build-time fetch of public GitHub repos for an auto-listed "All Projects" grid. Curated "Featured Projects" from a JSON file. Light/dark theme via CSS variables + no-flash inline script. CI/CD via GitHub Actions publishing to `gh-pages` branch. DNS provisioned via Cloudflare API token.

**Tech Stack:** Astro 5, TypeScript, Tailwind CSS, GitHub Actions, Cloudflare API.

**Working directory:** `C:\Users\Alexyodude\Desktop\AlexFolder\Code\Github\alexyodude.github.io\`

---

## File Structure

```
alexyodude.github.io/
├── .github/workflows/
│   ├── deploy.yml
│   └── scheduled-rebuild.yml
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
│   └── cloudflare-dns.mjs
├── public/
│   ├── CNAME
│   └── favicon.svg
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── .gitignore
└── README.md
```

---

### Task 1: Initialize Git Repo and Astro Project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Initialize git repo**

Run from `C:\Users\Alexyodude\Desktop\AlexFolder\Code\Github\alexyodude.github.io\`:
```bash
git init -b main
```
Expected: `Initialized empty Git repository in .../alexyodude.github.io/.git/`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "alexyodude-website",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "cloudflare:dns": "node scripts/cloudflare-dns.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/tailwind": "^5.1.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://alexyodude.com',
  integrations: [tailwind()],
  output: 'static',
});
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.astro/
.env
.env.local
.DS_Store
```

- [ ] **Step 6: Create minimal `README.md`**

```markdown
# alexyodude.com

Personal website. Built with Astro, hosted on GitHub Pages, fronted by Cloudflare.

## Develop

```
npm install
npm run dev
```

## Deploy

Push to `main`. GitHub Actions builds and publishes to `gh-pages`.
```

- [ ] **Step 7: Install dependencies**

Run:
```bash
npm install
```
Expected: `node_modules/` created, no errors. Use `run_in_background` if this is slow.

- [ ] **Step 8: Verify Astro runs**

Run:
```bash
npm run build
```
Expected: Build fails (no pages yet) OR succeeds with empty output. Either is fine — we're confirming the toolchain works.

- [ ] **Step 9: Commit**

```bash
git add package.json astro.config.mjs tsconfig.json .gitignore README.md
git commit -m "chore: initialize astro project"
```

---

### Task 2: Tailwind Config and Global Styles with Theme Variables

**Files:**
- Create: `tailwind.config.mjs`, `src/styles/global.css`

- [ ] **Step 1: Create `tailwind.config.mjs`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--color-bg)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        border: 'var(--color-border)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Create `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-fg: #0a0a0a;
  --color-muted: #6b7280;
  --color-accent: #2563eb;
  --color-border: #e5e7eb;
}

[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-fg: #fafafa;
  --color-muted: #9ca3af;
  --color-accent: #60a5fa;
  --color-border: #1f2937;
}

html {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

body {
  margin: 0;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.mjs src/styles/global.css
git commit -m "feat: add tailwind config and themed global styles"
```

---

### Task 3: Theme Toggle Component (with no-flash inline script)

**Files:**
- Create: `src/components/ThemeToggle.astro`

- [ ] **Step 1: Create `src/components/ThemeToggle.astro`**

```astro
---
// No props
---

<button
  id="theme-toggle"
  type="button"
  aria-label="Toggle color theme"
  class="rounded p-2 text-fg hover:bg-border transition-colors"
>
  <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
  <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
</button>

<script is:inline>
  (function () {
    const btn = document.getElementById('theme-toggle');
    const sun = document.getElementById('theme-icon-sun');
    const moon = document.getElementById('theme-icon-moon');

    function applyIcon(theme) {
      if (theme === 'dark') {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
      } else {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
      }
    }

    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyIcon(current);

    btn.addEventListener('click', () => {
      const now = document.documentElement.getAttribute('data-theme') || 'light';
      const next = now === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      applyIcon(next);
    });
  })();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ThemeToggle.astro
git commit -m "feat: theme toggle component"
```

---

### Task 4: Hero Component

**Files:**
- Create: `src/components/Hero.astro`

- [ ] **Step 1: Create `src/components/Hero.astro`**

```astro
---
const name = 'Alex';
const bio = 'Software engineer building things.';
const socials = [
  { label: 'GitHub', href: 'https://github.com/Alexyodude' },
  { label: 'LinkedIn', href: '#' },
  { label: 'X', href: '#' },
  { label: 'Email', href: 'mailto:hello@alexyodude.com' },
];
---

<section class="px-6 py-24 md:py-32 max-w-3xl mx-auto">
  <h1 class="text-5xl md:text-7xl font-bold tracking-tight">{name}</h1>
  <p class="mt-6 text-xl md:text-2xl text-muted">{bio}</p>
  <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
    {socials.map((s) => (
      <li>
        <a href={s.href} class="underline decoration-muted underline-offset-4 hover:text-accent hover:decoration-accent">
          {s.label}
        </a>
      </li>
    ))}
  </ul>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Hero.astro
git commit -m "feat: hero component with placeholder content"
```

---

### Task 5: Featured Projects Content and Component

**Files:**
- Create: `src/content/featured.json`, `src/components/FeaturedProjects.astro`

- [ ] **Step 1: Create `src/content/featured.json`**

```json
[
  {
    "title": "Project 1",
    "description": "Placeholder description for the first featured project.",
    "repo": "https://github.com/Alexyodude",
    "demo": null,
    "tags": ["TypeScript"]
  },
  {
    "title": "Project 2",
    "description": "Placeholder description for the second featured project.",
    "repo": "https://github.com/Alexyodude",
    "demo": null,
    "tags": ["Python"]
  },
  {
    "title": "Project 3",
    "description": "Placeholder description for the third featured project.",
    "repo": "https://github.com/Alexyodude",
    "demo": null,
    "tags": ["Rust"]
  },
  {
    "title": "Project 4",
    "description": "Placeholder description for the fourth featured project.",
    "repo": "https://github.com/Alexyodude",
    "demo": null,
    "tags": ["C++"]
  }
]
```

- [ ] **Step 2: Create `src/components/FeaturedProjects.astro`**

```astro
---
import featured from '../content/featured.json';

type FeaturedProject = {
  title: string;
  description: string;
  repo: string;
  demo: string | null;
  tags: string[];
};

const projects = featured as FeaturedProject[];
---

<section class="px-6 py-16 max-w-3xl mx-auto">
  <h2 class="text-sm uppercase tracking-widest text-muted">Featured</h2>
  <ul class="mt-6 grid gap-6 md:grid-cols-2">
    {projects.map((p) => (
      <li class="border border-border rounded-lg p-5 hover:border-accent transition-colors">
        <h3 class="text-lg font-semibold">{p.title}</h3>
        <p class="mt-2 text-sm text-muted">{p.description}</p>
        <ul class="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          {p.tags.map((t) => (<li class="border border-border rounded px-2 py-0.5">{t}</li>))}
        </ul>
        <div class="mt-4 flex gap-4 text-sm">
          <a href={p.repo} class="underline decoration-muted underline-offset-4 hover:text-accent hover:decoration-accent">Repo</a>
          {p.demo && (
            <a href={p.demo} class="underline decoration-muted underline-offset-4 hover:text-accent hover:decoration-accent">Demo</a>
          )}
        </div>
      </li>
    ))}
  </ul>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add src/content/featured.json src/components/FeaturedProjects.astro
git commit -m "feat: featured projects content and component"
```

---

### Task 6: GitHub Fetch Library

**Files:**
- Create: `src/lib/github.ts`

- [ ] **Step 1: Create `src/lib/github.ts`**

```ts
export type Repo = {
  name: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  language: string | null;
  updatedAt: string;
};

type GhRepo = {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  archived: boolean;
};

const USER = 'Alexyodude';
const WEBSITE_REPO = 'alexyodude.github.io';

export async function fetchRepos(): Promise<Repo[]> {
  const url = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`;
  const res = await fetch(url, {
    headers: { 'User-Agent': `${USER}-website`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub API failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as GhRepo[];
  return data
    .filter((r) => !r.fork && !r.archived && r.name !== WEBSITE_REPO)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .map((r) => ({
      name: r.name,
      description: r.description,
      htmlUrl: r.html_url,
      stars: r.stargazers_count,
      language: r.language,
      updatedAt: r.updated_at,
    }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/github.ts
git commit -m "feat: github repo fetch library"
```

---

### Task 7: All Projects Component

**Files:**
- Create: `src/components/AllProjects.astro`

- [ ] **Step 1: Create `src/components/AllProjects.astro`**

```astro
---
import { fetchRepos } from '../lib/github';

const repos = await fetchRepos();
---

<section class="px-6 py-16 max-w-3xl mx-auto">
  <h2 class="text-sm uppercase tracking-widest text-muted">All Projects</h2>
  <ul class="mt-6 grid gap-3 md:grid-cols-2">
    {repos.map((r) => (
      <li>
        <a
          href={r.htmlUrl}
          class="block border border-border rounded-md px-4 py-3 hover:border-accent transition-colors"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-medium">{r.name}</span>
            <span class="text-xs text-muted">★ {r.stars}</span>
          </div>
          {r.description && (
            <p class="mt-1 text-sm text-muted line-clamp-2">{r.description}</p>
          )}
          {r.language && (
            <p class="mt-2 text-xs text-muted">{r.language}</p>
          )}
        </a>
      </li>
    ))}
  </ul>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AllProjects.astro
git commit -m "feat: all projects component with build-time github fetch"
```

---

### Task 8: Footer Component

**Files:**
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create `src/components/Footer.astro`**

```astro
---
import ThemeToggle from './ThemeToggle.astro';
const year = new Date().getFullYear();
---

<footer class="px-6 py-10 max-w-3xl mx-auto border-t border-border mt-16">
  <div class="flex items-center justify-between text-sm text-muted">
    <span>© {year} Alex</span>
    <ThemeToggle />
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat: footer with theme toggle"
```

---

### Task 9: Landing Page Assembly with No-Flash Theme Script

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `src/pages/index.astro`**

```astro
---
import '../styles/global.css';
import Hero from '../components/Hero.astro';
import FeaturedProjects from '../components/FeaturedProjects.astro';
import AllProjects from '../components/AllProjects.astro';
import Footer from '../components/Footer.astro';
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Alex — alexyodude.com</title>
    <meta name="description" content="Personal site of Alex." />
    <script is:inline>
      (function () {
        try {
          var stored = localStorage.getItem('theme');
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var theme = stored || (prefersDark ? 'dark' : 'light');
          document.documentElement.setAttribute('data-theme', theme);
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })();
    </script>
  </head>
  <body>
    <main>
      <Hero />
      <FeaturedProjects />
      <AllProjects />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Build the site**

Run:
```bash
npm run build
```
Expected: Build succeeds, `dist/index.html` exists.

- [ ] **Step 3: Manual visual check**

Run:
```bash
npm run dev
```
Open `http://localhost:4321/` in a browser. Verify: hero renders, featured cards render, all-projects grid populates with Alex's repos, theme toggle flips colors and persists across reload, no flash of wrong theme.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: assemble landing page"
```

---

### Task 10: Static Assets — CNAME and Favicon

**Files:**
- Create: `public/CNAME`, `public/favicon.svg`

- [ ] **Step 1: Create `public/CNAME`**

File contents (single line, no trailing newline if possible):
```
alexyodude.com
```

- [ ] **Step 2: Create `public/favicon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0a0a0a"/>
  <text x="32" y="42" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="700" fill="#fafafa" text-anchor="middle">A</text>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add public/CNAME public/favicon.svg
git commit -m "feat: add CNAME and favicon"
```

---

### Task 11: GitHub Actions — Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: alexyodude.com
```

- [ ] **Step 2: Generate `package-lock.json`**

`npm ci` requires a lockfile. Run:
```bash
npm install
```
Expected: `package-lock.json` exists (or is updated).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml package-lock.json
git commit -m "ci: add deploy workflow"
```

---

### Task 12: GitHub Actions — Scheduled Rebuild Workflow

**Files:**
- Create: `.github/workflows/scheduled-rebuild.yml`

- [ ] **Step 1: Create `.github/workflows/scheduled-rebuild.yml`**

```yaml
name: Scheduled Rebuild

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Publish to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: alexyodude.com
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/scheduled-rebuild.yml
git commit -m "ci: daily rebuild to pick up new repos"
```

---

### Task 13: Cloudflare DNS Provisioning Script

**Files:**
- Create: `scripts/cloudflare-dns.mjs`

This script reads a Cloudflare API token + zone ID from environment variables and creates/updates the two CNAME records. Defaults to **DNS-only** (grey cloud) on first run so GitHub Pages can issue its Let's Encrypt cert.

- [ ] **Step 1: Create `scripts/cloudflare-dns.mjs`**

```js
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
```

- [ ] **Step 2: Document usage in `README.md`**

Append to `README.md`:

````markdown

## Cloudflare DNS

1. Create a Cloudflare API token with `Zone:DNS:Edit` permission on `alexyodude.com`.
2. Get the zone ID from the Cloudflare dashboard (zone overview).
3. First run — DNS only, so GitHub Pages can issue its cert:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run cloudflare:dns
```

4. Wait until GitHub Pages shows "Your site is published at https://alexyodude.com" with a valid cert (visible in repo Settings → Pages).
5. Re-run with proxy enabled:

```bash
PROXIED=true CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... npm run cloudflare:dns
```

6. In the Cloudflare dashboard, set SSL/TLS → Overview → mode = **Full**.
````

- [ ] **Step 3: Commit**

```bash
git add scripts/cloudflare-dns.mjs README.md
git commit -m "feat: cloudflare dns provisioning script"
```

---

### Task 14: Push to GitHub and Verify Live

**Files:** none — operational steps.

- [ ] **Step 1: Create the GitHub repo**

In the browser, create a new public repo named exactly `alexyodude.github.io` under the `Alexyodude` account. Do NOT initialize with README/license/gitignore — we have one already.

- [ ] **Step 2: Add remote and push**

Run:
```bash
git remote add origin https://github.com/Alexyodude/alexyodude.github.io.git
git push -u origin main
```

- [ ] **Step 3: Verify Action runs green**

Open `https://github.com/Alexyodude/alexyodude.github.io/actions`. Wait for the `Deploy` workflow to finish. If it fails, read logs and fix.

- [ ] **Step 4: Confirm `gh-pages` branch exists**

Run:
```bash
git fetch origin
git branch -r
```
Expected: `origin/gh-pages` listed.

- [ ] **Step 5: Configure Pages (one-time, in browser)**

Repo Settings → Pages → Source: **Deploy from a branch** → Branch: `gh-pages` / root → Save. Custom domain field should auto-populate from the `CNAME` file; if not, enter `alexyodude.com`.

- [ ] **Step 6: Verify default GitHub URL works**

Browse `https://alexyodude.github.io/` (will redirect to alexyodude.com once DNS is live, but should at least serve the site directly via raw GitHub Pages URL).

---

### Task 15: Provision Cloudflare DNS and Cut Over

**Files:** none — operational steps.

- [ ] **Step 1: Ensure `alexyodude.com` is on Cloudflare**

In the Cloudflare dashboard, add `alexyodude.com` as a site if not already present. Update nameservers at the domain registrar to the two Cloudflare nameservers shown.

- [ ] **Step 2: Create API token**

Cloudflare → My Profile → API Tokens → Create Token. Template "Edit zone DNS", restrict to zone `alexyodude.com`. Copy the token.

- [ ] **Step 3: Grab zone ID**

Cloudflare → `alexyodude.com` overview → right sidebar → Zone ID. Copy it.

- [ ] **Step 4: Run DNS script (DNS-only first)**

Run:
```bash
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ZONE_ID=<zone-id> npm run cloudflare:dns
```
Expected:
```
Creating CNAME alexyodude.com → alexyodude.github.io (proxied=false)
Creating CNAME www.alexyodude.com → alexyodude.github.io (proxied=false)
Done.
```

- [ ] **Step 5: Wait for GitHub Pages cert**

Watch repo Settings → Pages until "Your site is published at https://alexyodude.com" appears with a green checkmark (no TLS warnings). This can take a few minutes.

- [ ] **Step 6: Re-run script with proxy enabled**

Run:
```bash
PROXIED=true CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ZONE_ID=<zone-id> npm run cloudflare:dns
```
Expected: both records updated, `proxied=true`.

- [ ] **Step 7: Set Cloudflare SSL mode to Full**

Dashboard → `alexyodude.com` → SSL/TLS → Overview → mode **Full**.

- [ ] **Step 8: Verify live site**

Browse `https://alexyodude.com`. Verify:
- Site loads over HTTPS, no cert warning
- Hero shows "Alex"
- Featured cards render
- All-projects grid populated
- Theme toggle works and persists

- [ ] **Step 9: Verify Cloudflare is actually proxying**

Run:
```bash
curl -sI https://alexyodude.com | grep -i 'server\|cf-ray'
```
Expected: `server: cloudflare` and a `cf-ray:` header present.

---

## Done Criteria

- `https://alexyodude.com` serves the site over HTTPS through Cloudflare
- Push to `main` triggers a green CI run that updates the live site
- Daily scheduled rebuild keeps the "All Projects" list fresh
- Light/dark toggle works with no flash on load
- Lighthouse: Performance, Accessibility, Best Practices, SEO each ≥ 95
