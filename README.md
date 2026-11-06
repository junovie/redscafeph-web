# redscafeph-web

Red's Cafe public website (www.redscafeph.com), migrated from Wix. React + Vite + Tailwind front end served by a Cloudflare Worker (`wrangler.jsonc`). Customer reviews are stored in Supabase.

- Menu prices: `src/data/menu.js`
- Locations, hours, emails, socials: `src/data/site.js`
- Rewards: `src/data/rewards.js` (points are checked at https://perks.redscafeph.com)
- Old Wix URLs are redirected in `public/_redirects`

## Reviews

Customers post star ratings and comments on `/reviews`. New reviews stay hidden until approved at `/admin`, where staff can approve, hide, delete, or reply publicly.

- API: `worker/index.js` (`/api/reviews`, `/api/admin/reviews`)
- Storage: table `redscafeweb.reviews` in Supabase (`supabase/migrations/`). It is in both the Common Tools project (gjlowgdezdnyjqolrwad, which the site uses) and the Reds Cafe project (psrtuqwrmnfqszazhnjx). RLS is on with no policies, so only the Worker's service role key can read or write it. The `redscafeweb` schema must be listed in each project's exposed API schemas.
- Worker settings: `SUPABASE_URL` (a plain variable in `wrangler.jsonc`; change it to switch projects), and secrets `SUPABASE_SERVICE_ROLE_KEY` (the project's secret API key) and `ADMIN_PASSWORD`. Locally, put all three in `.dev.vars`.

## Development (Node 22+)

```
npm install
npm run build && npm run dev:api   # full site + API on http://localhost:8787
npm run dev                        # Vite hot reload on :5173, proxies /api to :8787
```

## Deploy

`npm run build && npm run deploy` deploys the Worker. Apply new SQL in `supabase/migrations/` to both Supabase projects.
