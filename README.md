# WriteSpace

A browser-local blog demo with public discovery, registration/login, reading, post authoring and publication/account administration. Built with React 18, Vite 5, JavaScript JSX, React Router v6 and Tailwind 3. There is no backend or database.

## Safety and persistence
**Use synthetic/demo credentials only.** Passwords are stored in plain text in localStorage. Session, role and ownership checks are client-side conveniences, not secure authentication or authorization. Data belongs to one browser profile/device; clearing browser data loses it. No cross-device sync, recovery, export, cross-tab transactions or durability guarantee exists.

Keys: `writespace_posts`, `writespace_users`, `writespace_session`. Complete records and canonical ISO dates are validated. Invalid/blocked reads show warnings, preserve original bytes and disable affected mutations. Writes report failure without false success; registration can disclose partial account creation if session persistence fails.

## Run locally
Use Node 22 (22.16.0 verified for Playwright; the sandbox Node 24 hung in the older Playwright ESM loader).

```sh
cd frontend
npm ci
npm run dev
```

Dev defaults to 127.0.0.1:5173. Public host/port/test variables are documented in `frontend/.env.example`. No app secrets or API URL are required. Copy the example to `.env` for local development if desired; do not commit `.env`. Test preview uses `E2E_BASE_URL=http://127.0.0.1:4173` and `E2E_PORT=4173`.

Demo administrator: username `admin`, password `admin`. Self-registration creates only `user`. The admin predicate recognizes `admin` and `Admin` without rewriting stored roles. Bootstrap uses the source session spelling `admin`; canonical casing remains a product question.

## Test and build
From frontend:

```sh
npm test
NODE_ENV=production npm run build
node node_modules/@playwright/test/cli.js install chromium
E2E_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

Playwright starts and stops the real production preview automatically, uses one Chromium worker, captures browser errors, and tests real localStorage state. Build before E2E. Scripts invoke Node entries rather than relying on npm bin symlinks. Change-run verification: 812 unit/component tests passed; all 38 browser journeys passed under Node 22 after correcting featured-preview focus interaction. All six theme journeys passed. Production build succeeded; independent critic PASS 1.0/zero high failures. Discovery specs save persistent HTML/accessibility/styles/screenshots under `frontend/review-evidence/`.

## Container delivery
From repository root:

```sh
docker build -t writespace frontend
docker run --rm -p 8080:80 writespace
```

Two-stage Node build/nginx image. Root `/` returns 200; nginx serves index.html for client-side deep routes. No backend proxy, database, volume or application API exists. Container build, nginx syntax and root/deep route responses were verified locally. AWS ECR/ECS/ALB/CloudFront deployment belongs to downstream DevOps and has not been performed here. The root `vercel.json` retains the source-required rewrite-only convention; AWS is the selected delivery target. Optional Vercel setup requires project root frontend and copying/applying the rewrite there; it is not an independently verified target.

## Appearance
Activate the visible Dark appearance / Light appearance button in navigation to switch presentation. Click, Enter and Space work on desktop and mobile. The mode is transient App state: it adds no preference storage, network call or extra mode. Retention/reset across reload or session changes is not guaranteed or specified. Existing posts, users and session records are unchanged by appearance switching.

## Routes and behavior
`/` landing; `/login`, `/register` guest entry; `/blogs`, `/blog/:id`, `/write`, `/edit/:id` authenticated. `/admin`, `/users` require the demo admin role. Users manage only owned posts through the UI; admins manage all. Reader renders plain text, never stored HTML. Deletes require confirmation; bootstrap and active account cannot be deleted.

## Open product decisions and audit warning
The duplicated `Total Users` / `Total users` dashboard labels remain; the fourth value is shown as unresolved rather than an invented metric. No missing admin banner or bootstrap tooltip copy is fabricated. Light editorial brand accents replace the full-page gradient with explicit human approval. Content limits and quota recovery remain out of scope.

React Router was upgraded to 6.30.6: production audit has no high/critical findings but retains two moderate advisories in v6 (untrusted redirect/SSR-related categories; this app has no SSR and uses internal route targets). Full prescribed toolchain audit reports 4 moderate, 4 high and 2 critical findings. Do not expose development/test servers publicly. Major framework/test-runner upgrades need a separately tested stack update; this release does not claim a clean dependency audit.
