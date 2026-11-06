# redscafeph-web

Red's Cafe public website (www.redscafeph.com), migrated from Wix. React + Vite + Tailwind front end served by a Cloudflare Worker (`wrangler.jsonc`), with a D1 database for customer reviews.

- Menu prices: `src/data/menu.js`
- Locations, hours, emails, socials: `src/data/site.js`
- Rewards: `src/data/rewards.js` (points are checked at https://perks.redscafeph.com)
- Old Wix URLs are redirected in `public/_redirects`

## Reviews

Customers post star ratings and comments on `/reviews`. New reviews stay hidden until approved at `/admin`, where staff can approve, hide, delete, or reply publicly.

- API: `worker/index.js` (`/api/reviews`, `/api/admin/reviews`)
- Schema: `migrations/`
- Admin password: the `ADMIN_PASSWORD` Worker secret (locally, put `ADMIN_PASSWORD=...` in `.dev.vars`)

## Development (Node 22+)

```
npm install
npx wrangler d1 migrations apply redscafeph-reviews --local
npm run build && npm run dev:api   # full site + API on http://localhost:8787
npm run dev                        # Vite hot reload on :5173, proxies /api to :8787
```

## Deploy

`npm run build && npm run deploy` applies pending D1 migrations and deploys the Worker.
