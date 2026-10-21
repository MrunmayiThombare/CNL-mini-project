# GeoTrace — Supabase Backend Setup Guide

This backend replaces the Express server with **Supabase Edge Functions**
(Deno, deployed globally) plus a **Postgres** database that stores every
trace you run. Follow these steps in order.

## 0. Prerequisites

- A free Supabase account: https://supabase.com
- Node.js 18+ installed locally (to run the Supabase CLI via npm)
- The `geotrace/backend-supabase` folder from this project (already contains
  `supabase/migrations` and `supabase/functions`)

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and click **New project**.
2. Choose an organization, name it `geotrace` (or anything you like), set a
   database password (save it somewhere safe), and pick a region close to you.
3. Wait ~2 minutes for provisioning to finish.
4. On the project's **Settings → API** page, note down:
   - **Project URL** (e.g. `https://abcdefghijk.supabase.co`)
   - **Project ref** (the `abcdefghijk` part of the URL)
   - **anon public** key
   - **service_role** key (keep this secret — server-side only)

## 2. Install the Supabase CLI

```bash
npm install -g supabase
```

Verify it installed:

```bash
supabase --version
```

## 3. Log in and link your project

From inside the `backend-supabase` folder:

```bash
cd geotrace/backend-supabase
supabase login
```

This opens a browser window to authorize the CLI. Then link the local
folder to your remote project (replace with your actual project ref from
step 1):

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

You'll be prompted for the database password you set in step 1.

## 4. Apply the database migration

This creates the `traces` and `trace_hops` tables (with Row Level Security
enabled and public read-only policies) from
`supabase/migrations/0001_create_traces.sql`:

```bash
supabase db push
```

Confirm when prompted. You can verify the tables exist under
**Table Editor** in the Supabase dashboard afterward.

## 5. Deploy the Edge Functions

Two functions live under `supabase/functions/`:

- `dns-lookup` — resolves a domain and reports timing
- `traceroute` — runs the full simulated trace, geolocates hops, and
  writes the results to Postgres

Deploy both. We pass `--no-verify-jwt` so the frontend (using only the
public anon key, no user login) can call them directly — this is fine for
a public demo app; see the note on securing this further at the bottom.

```bash
supabase functions deploy dns-lookup --no-verify-jwt
supabase functions deploy traceroute --no-verify-jwt
```

## 6. Set the service role secret for the `traceroute` function

The `traceroute` function needs the **service role key** to write to
Postgres (bypassing RLS, since anonymous clients only have read access).
Supabase automatically injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into every Edge Function's environment for
projects linked via the CLI — no manual secret-setting is required.

If you ever need to set additional secrets manually (e.g. a custom API
key), use:

```bash
supabase secrets set MY_SECRET_NAME=value
```

## 7. (Optional) Run functions locally first

To test before deploying:

```bash
supabase start        # spins up local Postgres + API via Docker
supabase functions serve
```

This serves functions at `http://localhost:54321/functions/v1/<name>`.
Point `VITE_SUPABASE_URL` at `http://localhost:54321` and use the local
anon key printed by `supabase start` to test end-to-end locally.

## 8. Configure the frontend

In `geotrace/frontend/`, copy the example env file:

```bash
cd ../frontend
cp .env.example .env
```

Edit `.env`:

```
VITE_API_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Install and run:

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173), enter a
domain, and click **Trace Route** — it now calls your Supabase Edge
Function instead of the Express server.

## 9. Verify data is being saved

In the Supabase dashboard, go to **Table Editor → traces**. Each trace you
run in the UI should appear as a new row, with its hops in **trace_hops**
(joined by `trace_id`).

You can query recent trace history from the frontend at any time via
`fetchTraceHistory()` in `frontend/src/api.js`, which reads directly from
`traces` using the anon key (read-only, thanks to the RLS policy created
in the migration).

## Notes & limitations

- **No real ICMP traceroute**: Supabase Edge Functions run on Deno Deploy,
  a sandboxed environment with no `child_process` and no raw socket access.
  This backend always returns a realistic **simulated** trace
  (`traceSource: "simulated"`), seeded from the real DNS-resolved
  destination IP so at least the final hop is genuine. If you need a real
  system traceroute, use the Express backend (`backend/`) instead, hosted
  somewhere with raw-socket permissions (e.g. a VPS).
- **Geolocation rate limits**: ip-api.com's free tier allows 45
  requests/minute per IP. The Edge Function batches all hop IPs into a
  single request per trace, so this is rarely an issue for normal use.
- **Security**: `--no-verify-jwt` makes both functions publicly callable
  with just the anon key, which is appropriate for a public demo. If you
  add Supabase Auth later, remove that flag and require a logged-in user
  (`supabase functions deploy traceroute` without the flag enforces JWT
  verification automatically).
