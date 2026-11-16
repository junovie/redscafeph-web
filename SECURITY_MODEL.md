# Threat model: Common Tools platform and side apps

Owner: junoviekitamura. Scope: the 9 scanned repos, junovie/CommonTools, commonpay, redscafe, redscafeph-web, sgr-ridescape, wallet, hurado, lakas and Loyalty. The same file lives in the root of each of these repos. Security scans start from it, so update it when the system changes. It was drafted from the code and includes the owner's answers from 2026-11-16, marked **[user]**. The infrastructure is in the code repos (Supabase migrations, Cloudflare `wrangler.jsonc`). There is no separate infra repo.

## System overview and trust boundaries
- **Common Tools** is a multi-tenant SaaS the owner sells to businesses. Each app is its own React/Vite SPA on a Cloudflare Worker (static assets) and talks straight to Supabase (PostgREST + RLS, Edge Functions).
- **Shared Supabase project** `gjlowgdezdnyjqolrwad` has one schema per app (`platform`, `commonorder`, `commonpay`, `commonfleet`, `wallet`, `hurado`, `lakas`). Auth is shared, and the session cookie is scoped to `.commontools.app` (`@supabase/ssr` in each `src/api/base44Client.js`), so one login reaches every app. RLS is the main tenant boundary.
- **Reds Cafe project** `psrtuqwrmnfqszazhnjx` is separate. It runs Red's POS (`commonorder` schema, pos.redscafeph.com) and perks, and backs the public website and online store (`redscafeweb` schema).
- Boundaries: browser ↔ PostgREST/RLS; browser ↔ Edge Functions (`verify_jwt` on unless noted); internet ↔ unauthenticated functions and Worker routes; Edge Functions/Worker ↔ service-role key (bypasses RLS); app ↔ third parties (OpenAI/Gemini, Telegram, Maya, KaHero, OneDrive/Google Drive/Sheets, BudgetBakers).
- `base44/functions/` in redscafe, commonpay and sgr-ridescape is legacy Base44 code that is **not deployed** **[user]**. It is excluded from the scan. `base44/entities` is still the schema source.

## Components
| Component | Code |
|---|---|
| Platform admin | CommonTools: `apps/admin/`, `supabase/migrations/*platform*` (`platform.staff`, organizations, plans, billing), `supabase/functions/ops-watch`, marketing site `src/` |
| CommonOrder POS | redscafe: `src/`, `supabase/functions/order-*`, `supabase/migrations` (`commonorder` RLS: `app_company_id()`, `app_is_global()`, `user_profile_guard`) |
| CommonPay | commonpay: `src/`, `supabase/functions/pay-api/*` (verify_jwt on), `pay-hooks/*` (verify_jwt off), `_pay/*.ts` (portalLogin, kioskDevice, kioskLookup, compareFaces, generatePayroll, exportBankFile, smsWebhook, telegramWebhook) |
| CommonFleet | sgr-ridescape: `src/`, `supabase/functions/fleet-*` (`fleet-connectOneDrive` verify_jwt off), branch-scope RLS `can_access_branch` |
| Red's website & online store | redscafeph-web: `worker/index.js` (reviews), `worker/store.js` (menu, orders, maya-webhook, map-link), `worker/rider.js` (`/rider/<48-hex token>`), `src/` |
| Pitaka wallet | wallet: `src/`, `supabase/functions/wallet-sync`, `wallet-scan`, `budgetbakers`, family sharing RLS |
| Side apps | hurado (judge links `/j/<token>`, board `/b/<code>`, RPCs `judge_view`/`judge_rate`/`board_view`), lakas (personal workout tracker), Loyalty (empty repo) |
| Shared auth & session | each repo's `src/api/base44Client.js`, `src/lib/AuthContext*`, `supabase/functions/_shared/*` (loadUser, role helpers), `<schema>.register_self()` auth link triggers |

## Entry points and who can reach them
- **Unauthenticated internet:** online store API (`/api/store/*`), including `maya-webhook`; reviews (`/api/reviews`); rider page (`/api/rider/*`, token only); Hurado judge and board links; the CommonPay `pay-hooks` router (PIN `portalLogin`, kiosk, SMS/Telegram webhooks); `order-kaheroWebhook` and `order-telegramWebhook` (`--no-verify-jwt`); `fleet-connectOneDrive` OAuth callback; tenant self-signup at admin.commontools.app.
- **Any signed-in user of any tenant:** PostgREST on every exposed schema (RLS decides) and all `verify_jwt` functions. Shared auth means a user of one business, or of a side app such as Lakas or Pitaka, holds a valid JWT for every schema.
- **Staff inside a tenant:** cashiers on shared POS tablets, employees on the PIN portal and kiosk, managers/TL/ATL, HR, admins.
- **Platform staff:** `platform.staff` (owner can delete businesses; tech admin cannot delete); global users (`app_is_global()`).

## Assets (all matter equally **[user]**)
- Tenant isolation: each business's data separate from every other business on Common Tools.
- CommonPay payroll and employee PII: salaries, government IDs, bank files, face photos, PINs, performance reviews (reviewer identity is confidential).
- Money flows: POS sales, shift cash and denominations, GCash/Maya online payments, payroll amounts, loans.
- Online-store customer data: names, phones, addresses, GPS.
- Owner's personal finances in Pitaka, plus BudgetBakers tokens.
- Secrets: service-role keys (Worker, Edge Functions), Vault-stored bot tokens and OneDrive/Google refresh tokens, AI and Maya keys.

## Attackers that matter (all of them **[user]**)
1. Anonymous internet users hitting public routes, webhooks, tokens and PIN login.
2. Another business that self-signs up on Common Tools and tries to read or change other tenants' data.
3. Staff inside a business going beyond their role: a cashier changing sales or shift cash, an employee reading others' payroll or PII, a manager changing roles.

## Existing controls (from the code)
- RLS on every app schema, with `(SELECT fn())` helpers; restrictive branch-scope policies in CommonFleet; guard triggers (`user_profile_guard`, `employee_identity_guard`, `users_company_guard`, `performance_review_cycle_gate`, `rental_revert_admin_only`).
- PIN portal opt-in (`employee.portal_access`) and lockout (5 wrong = 5 min wait, 10 = locked).
- Rider tokens stored as SHA-256 and format-checked; Hurado tokens lengthened (migration `20261111193000`).
- Integration secrets in Supabase Vault behind service_role-only RPCs.
- The online store refuses orders without an open POS shift.

## Out of scope / accepted risk (**[user]**)
- `base44/functions/**` (not deployed): excluded from the scan.
- **Hurado and Lakas are low-stakes side apps: treat their findings as low.** This does not cover a Hurado/Lakas issue that reaches the shared auth or another app's schema; that is judged on what it reaches.

## Open questions
- Which exposed schemas and functions are actually live in production, compared with what is in the repos?
- Is the `commonpay.vercel.app` production copy still reachable, and with which backend?
