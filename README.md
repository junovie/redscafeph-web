# redscafeph-web

Red's Cafe public website (www.redscafeph.com), migrated from Wix. React + Vite + Tailwind front end served by a Cloudflare Worker (`wrangler.jsonc`). Customer reviews are stored in Supabase.

- Menu prices: `src/data/menu.js`
- Locations, hours, emails, socials: `src/data/site.js`
- Rewards: `src/data/rewards.js` (points are checked at https://perks.redscafeph.com)
- Old Wix URLs are redirected in `public/_redirects`

## Reviews

Customers post star ratings and comments on `/reviews`. New reviews stay hidden until staff approve them in the Red's Cafe POS (Loyalty > Website Reviews, built with `VITE_WEBSITE_REVIEWS=true`), where they can also hide, delete, or reply publicly. Access: super admins, Red's Cafe admins, and staff given the `loyalty/reviews` section (RLS in junovie/redscafe `supabase/migrations/20261106000000_website_reviews.sql`).

- API: `worker/index.js` (`GET`/`POST /api/reviews`)
- Storage: table `redscafeweb.reviews` in Supabase (`supabase/migrations/`). The site uses the Reds Cafe project (psrtuqwrmnfqszazhnjx); an older copy is in the Common Tools project (gjlowgdezdnyjqolrwad). RLS is on with no policies, so only the Worker's service role key can read or write it. The `redscafeweb` schema must be listed in each project's exposed API schemas.
- Worker settings: `SUPABASE_URL` (a plain variable in `wrangler.jsonc`; change it to switch projects), and the runtime secret `SUPABASE_SERVICE_ROLE_KEY` (the project's `redscafeph_web` secret API key). Locally, put both in `.dev.vars`.

## Development (Node 22+)

```
npm install
npm run build && npm run dev:api   # full site + API on http://localhost:8787
npm run dev                        # Vite hot reload on :5173, proxies /api to :8787
```

## Deploy

`npm run build && npm run deploy` deploys the Worker. Apply new SQL in `supabase/migrations/` to both Supabase projects.
