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
| Trip analytics | `/trips/:view` | 11 views: live trips, dispatch, vehicle ageing, hygiene, costing, payments, detention, transporters, destinations, accuracy, cash discount |
| Order analytics | `/orders/:view` | 7 views: live orders, destination tracker, indents and auctions, planning, dedicated fleet, OTIF, e-com appointments |
| Sales | `/sales/:view` | Team, brand and channel hierarchies vs target; period and comparison controls; build-your-own view |
| CFA throughput | `/cfa` | CFA × date heatmap, ranking, daily trend |
| E-com P&L | `/pnl` | Gross-to-margin waterfall, expandable P&L, margin trends |
| Settings (admin) | `/settings/:view` | User access toggles and add-user dialog, refresh schedule, OTIF thresholds (used live across the app), sync health, metric definitions |

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

## Structure

```
src/
  components/overtrue/   overtrue/ui registry components (installed source, MIT)
  components/ui/         shadcn primitives shipped with overtrue/ui
  overtrue-theme.css     overtrue/ui theme tokens
  components/app/        app compositions (Panel, Stat, DataTable adapter, shell, filters)
  data/                  deterministic demo data + formatters + alert rules
  pages/                 one folder/file per module
  state/                 auth/session, settings, drill-down drawer
```

The library is distributed as a shadcn registry, so its components live in this repository as source, as the library intends. Two additive changes were made. `TrendChart` and `ComposedChart` gained an optional `onBarClick` prop to support drill-downs.

To connect real data, replace the generators in `src/data/data.ts` with API calls that return the same shapes.
