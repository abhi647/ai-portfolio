# DFM Foods MIS

A working web application built from the `dfm-mis-prototype.html` clickable prototype. It covers supply, sales and finance analytics for DFM Foods and uses the prototype's deterministic dummy data. Every view, chart and table in it comes from the [overtrue/ui](https://github.com/overtrue/ui) component library.

## Run it

```bash
cd dfm-mis
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

Sign in with any email, then enter any 6-digit code. **Autofill demo code** fills one in for you.

## What's inside

| Area | Routes | Highlights |
| --- | --- | --- |
| Sign-in | `/login` | Split-screen layout with a live data preview, email → OTP flow, paste-to-fill code boxes, resend timer, "trust this device", SSO shortcut, return-to-requested-page |
| Overview | `/` | Greeting, 4 KPI cards with sparklines, a **Needs attention** feed built from live data, trip pipeline, sales pace, zone bullet chart, dashboard launcher |
| Trip analytics | `/trips/:view` | 12 views, including a **Gantt trip timeline** (plan vs actual per leg), plus live trips, dispatch, vehicle ageing, hygiene, costing, payments, detention, transporters, destinations, accuracy and cash discount |
| Order analytics | `/orders/:view` | 7 views: live orders, destination tracker, indents and auctions, planning, dedicated fleet (with a **Gantt vehicle schedule**), OTIF, e-com appointments |
| Sales | `/sales/:view` | Team, brand and channel hierarchies vs target; period and comparison controls; build-your-own view |
| CFA throughput | `/cfa` | CFA × date heatmap, ranking, daily trend |
| E-com P&L | `/pnl` | Gross-to-margin waterfall, expandable P&L, margin trends |
| Settings (admin) | `/settings/:view` | User access toggles and add-user dialog, refresh schedule, OTIF thresholds (used live across the app), sync health, metric definitions |

### Insights and layout

- **An insight on every chart.** Each chart panel ends with a one-line takeaway built from the data, with highlighted metrics. Monthly charts generate it automatically (biggest mix shift, rate against the 5-month average); other charts have hand-written rules (bottlenecks, worst lanes, idle vehicles, savings).
- **Today's briefing.** The Overview has a briefing card (overtrue/ui `InsightCard`) that streams in a summary with linked sources.
- **Bento layout.** Pages use a 12-column grid with panels sized to their content: wide trends, narrow rankings, full-width flows.
- **Sticky toolbar.** View tabs and a compact chip-style filter bar with saved views (overtrue/ui `FilterBar`) stay pinned while you scroll.
- **More chart types.** Gantt (trip timeline, dedicated vehicle schedule), Sankey (plant → fleet → distance, OTIF outcome flow), radar (transporter scorecard), 100% stacked area (brand and channel share), calendar heatmap (dispatches per day), dot plot (gate-outs by hour) and stacked area (indents vs auctions).
- **Brand.** The CRAX logo sits in the app shell. The sign-in page uses a DFM Foods production-line photo, and the Overview hero uses the CRAX range banner. Both images come from DFM Foods' official site, crax.in, and live in `public/brand/`.

### Making it easier to use than the prototype

- **Drill into any number.** Clicking a bar segment, tile, heatmap cell or linked number opens a side drawer listing the trips or orders behind it, with search, sorting and CSV export. Click a trip to see its full journey timeline.
- **⌘K search.** Jump to any dashboard or view, or open a trip or order by ID, vehicle number or customer.
- **Needs attention.** The notification centre and the Overview page flag delayed vehicles, OTIF risk, failed syncs and ASMs behind target, and link straight to the right view.
- **Filters persist per module.** They collapse on phones, and the app works at 390px width.
- **Light and dark themes.** Both are driven by overtrue/ui semantic tokens.
- **Role-based navigation.** Users only see the dashboards they have access to, and Settings is admin-only.

### Chart choices

The charts follow common data-visualisation practice:

- Composition over months uses stacked bars. When a rate matters, a line on a second axis shows the percentage (for example tracking %, accuracy % or claim %).
- Trends across time use line charts, such as cost per km, OTIF % against its target line, and margin %.
- Actual vs target uses **bullet charts** (zones).
- Bridges use **waterfall** charts (gross revenue → material margin, freight build-up).
- Two-dimensional density uses **heatmaps** (CFA × date, destination × month detention, dedicated vehicle utilisation).
- Hierarchical mix uses a **treemap** (brand → pack).
- Rankings and root causes use ranked bar lists instead of doughnuts.
- Funnels show stage conversion (ePOD → PI → paid), and radial gauges show single KPIs that have thresholds.

## Ask AI — talk to your data

Ask questions in plain English, from anywhere in the app:

- the **Ask AI** button in the header, or **⌘/Ctrl + J**
- the ✨ button on any chart, which asks about that chart
- the full-screen **Ask AI** page in the sidebar

Each answer has three parts:

1. **A short narrative** with the key figures highlighted.
2. **One to three generated charts.** The AI picks the chart type (ranking, trend, stacked, heatmap, combo, donut, KPI or table). You can switch the type, export the data as CSV, inspect the query, or **pin** the chart to **My board**, which is your own live dashboard of pinned charts.
3. **Computed insights and follow-up questions.**

### How it works

```
browser ──POST /api/ask──▶ Vite server (server/ask.ts)
                               │  Claude (claude-opus-5-5) + 2 strict tools
                               │   • run_query(spec)  → executes on the MIS semantic layer, returns real numbers
                               │   • present_answer   → narrative + chart specs + follow-ups
                               ◀── answer + QuerySpecs
browser re-executes each QuerySpec locally (src/ai/engine.ts) and renders it with overtrue/ui charts
```

- **Semantic layer.** `src/ai/catalog.ts` defines the datasets the AI can query: trips, orders, secondary sales, CFA throughput and the e-com P&L. Each dataset lists its dimensions and measures. To connect real data, point the `rows()` functions at your warehouse.
- **Numbers are never invented.** Claude can only see figures that come back from `run_query`. The browser recomputes every chart and insight from the same spec.
- **Claude API features used:** strict tool use (specs always match the schema), a cached system prompt and tools, adaptive thinking at `medium` effort, and server-side refusal fallbacks (`fallbacks: "default"`).
- **Offline mode.** With no `ANTHROPIC_API_KEY`, a keyword parser (`src/ai/local.ts`) maps common questions to the same specs, so the feature still works for demos. The panel shows **Offline mode** or **Claude** so users know which one answered.

### Configure

```bash
cp .env.example .env    # then set ANTHROPIC_API_KEY
npm run dev             # or: npm run build && npm run preview
```

The key is only read on the server. `/api/ask` runs in both `vite dev` and `vite preview`. For another host, move `handleAsk()` from `server/ask.ts` into a serverless function.

## Phone app (PWA) — `/app`

The phone app is a separate, installable app built for phone screens (about 360–430 px). It shares the data, the Ask AI engine and the overtrue/ui components with the desktop dashboard.

| Tab | What it does |
| --- | --- |
| **Ask** (home) | Chat with the data: a today-at-a-glance strip, suggested questions, **voice input** (browser speech recognition), and phone-width charts that can be shared, exported or pinned |
| **Monitor** | Secondary live view: alerts with one-tap trip/order lists and "Ask AI about this", swipeable key numbers, trip pipeline, trips behind plan, sales pace. **Pull down to sync** |
| **Board** | Charts pinned from Ask, re-run live and reorderable |
| **More** | Profile, AI engine status, sync, dark mode, **Install app**, open desktop dashboard, sign out |

- Entry: `app/index.html` → `src/mobile/`. Routes live under `/app` (`/app/monitor`, `/app/board`, …).
- PWA: `vite-plugin-pwa` adds a manifest and service worker **scoped to `/app/` only**, so the desktop site stays a normal website. The app installs as a standalone app with home-screen shortcuts to Ask and Monitor, and the app shell is cached for offline use. Ask AI calls are never cached; without a network connection the app falls back to offline mode.
- Phone details: safe-area padding for notches, 16 px inputs (no zoom when typing on iOS), 44 px+ tap targets, haptic feedback where supported, and an install hint on iOS.

## Deploy to Vercel

`vercel.json` builds both apps and the Ask AI serverless function:

- `npm run build`: bundles `server/ask.ts` into `api/_lib/ask.mjs` (`npm run build:api`), type-checks, then builds `dist/` with the desktop app at `/` and the phone app at `/app`.
- `api/ask.mjs` (POST, up to 60 s) and `api/ask/status.mjs` (GET) are the serverless functions.
- Rewrites send `/app/*` to the phone app and other paths to the desktop app. The service worker and manifest are served with no-cache headers so updates reach users.

**One-time setup (Vercel dashboard):**

1. **Add New → Project → Import** the GitHub repo, and set **Root Directory = `dfm-mis`**. The framework (Vite) and build settings come from `vercel.json`.
2. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (and optionally `DFM_AI_MODEL`). Without it, Ask AI runs in offline mode.
3. Deploy. Every push to the connected branch redeploys. Open `https://<project>.vercel.app/app` on a phone, then use **Install app** (Android) or **Share → Add to Home Screen** (iOS).

**Or with the CLI:**

```bash
cd dfm-mis
npx vercel link
npx vercel env add ANTHROPIC_API_KEY
npx vercel deploy --prod
```

## Structure

```
src/
  components/overtrue/   overtrue/ui registry components (installed source, MIT)
  components/ui/         shadcn primitives shipped with overtrue/ui
  overtrue-theme.css     overtrue/ui theme tokens
  components/app/        app compositions (Panel, Stat, DataTable adapter, shell, filters)
  data/                  deterministic demo data + formatters + alert rules
  pages/                 one folder/file per module
  state/                 auth/session, settings, drill-down drawer, Ask AI conversation + pins
  ai/                    semantic layer (catalog), query engine + insights, offline parser, client
  components/ai/         Ask AI UI: conversation (AssistantPanel), generated charts, slide-over
  mobile/                phone app (PWA): shell + Ask / Monitor / Board / More screens
app/index.html           phone app entry (served at /app)
server/ask.ts            /api/ask — Claude tool loop (Vite plugin + shared handler)
server/vercel.ts         Vercel function entry → bundled to api/_lib/ask.mjs
api/                     Vercel serverless functions
vercel.json              Vercel build, rewrites, headers
```

The library is distributed as a shadcn registry, so its components live in this repository as source, as the library intends. Two additive changes were made. `TrendChart` and `ComposedChart` gained an optional `onBarClick` prop to support drill-downs.

To connect real data, replace the generators in `src/data/data.ts` with API calls that return the same shapes.
