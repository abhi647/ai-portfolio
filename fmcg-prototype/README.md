# Seven Billion Analytics — FMCG Operations Prototype

Static, self-contained sales-demo prototype: a hub (`index.html`) that embeds 8
department dashboards under `work/`. No build step, no dependencies — plain
HTML/CSS/JS, Chart.js loaded from a CDN.

## Deploy on Vercel

This folder lives inside the `ai-portfolio` repo, which has its own Next.js
app at the repo root — so when importing on Vercel, set the project's
**Root Directory** to `fmcg-prototype`:

1. On [vercel.com/new](https://vercel.com/new), import the `ai-portfolio` repo.
2. Under **Root Directory**, click *Edit* and select `fmcg-prototype`.
3. Framework Preset: **Other**. Leave Build Command / Output Directory blank.
4. Deploy.

Or via CLI from inside this folder:

```bash
cd fmcg-prototype
npx vercel --prod
```

## Structure

- `index.html` — hub: subway nav, department tiles, section cards, deep-links into each dashboard.
- `work/<dept>/*.html` — one self-contained dashboard per department (Sales, Inventory Planning, Production, WMS, SCM, TMS, Quality, Finance).

All data is illustrative and anonymized — built to demonstrate the shape of a real deployment, not actual client figures.

_Deployed via Vercel._
