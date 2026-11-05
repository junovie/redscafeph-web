# redscafeph-web

Red's Cafe public website (www.redscafeph.com), migrated from Wix. Static React + Vite + Tailwind site served by a Cloudflare Worker (`wrangler.jsonc`).

- Menu prices: `src/data/menu.js`
- Locations, hours, emails, socials: `src/data/site.js`
- Rewards: `src/data/rewards.js` (points are checked at https://perks.redscafeph.com)
- Old Wix URLs are redirected in `public/_redirects`

```
npm install
npm run dev
npm run build
```
