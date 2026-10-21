# GeoTrace

A network traceroute visualizer: resolves a domain, traces the route to it,
geolocates every hop, and plots it on a live Leaflet map with an
educational sidebar.

```
geotrace/
├── backend/              # Option A: Express/Node backend (real traceroute + fallback)
├── backend-supabase/     # Option B: Supabase Edge Functions + Postgres backend
└── frontend/             # React + Vite + react-leaflet UI (works with either backend)
```

You only need **one** backend. Pick Express for a real system traceroute
(when run outside a sandbox, e.g. your own machine/server with raw-socket
permissions), or Supabase for a fully hosted, serverless setup with
persistent trace history.

---

## Option A — Express backend (local/self-hosted)

```bash
cd backend
npm install
npm start          # runs on http://localhost:4000
```

```bash
cd frontend
npm install
npm run dev         # runs on http://localhost:5173, proxies /api to :4000
```

Open http://localhost:5173, enter a domain, click **Trace Route**.

> System `traceroute`/`tracert` requires raw ICMP socket permissions
> (root on Linux/macOS, admin on Windows). If unavailable, the backend
> automatically falls back to a realistic simulated trace seeded from the
> real resolved destination IP, and flags this in the response
> (`traceSource: "simulated"`).

No API key is needed — geolocation uses ip-api.com's free, keyless
endpoint (45 requests/minute limit).

---

## Option B — Supabase backend (serverless, with trace history)

See **`backend-supabase/SUPABASE_SETUP.md`** for the complete step-by-step
guide (CLI install, project link, DB migration, function deploy, env vars).

Quick summary:

```bash
npm install -g supabase
cd backend-supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy dns-lookup --no-verify-jwt
supabase functions deploy traceroute --no-verify-jwt
```

Then in `frontend/.env`:

```
VITE_API_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

```bash
cd frontend
npm install
npm run dev
```

Supabase Edge Functions run in a sandboxed Deno runtime with no raw-socket
access, so this backend always uses the realistic simulated tracer — but it
additionally **persists every trace and hop to Postgres** (`traces` /
`trace_hops` tables), which the Express version doesn't do.

---

## Features

- DNS resolution timing shown as the first dashboard step
- Per-hop IP, latency (ms), and ICMP status (Responded / Timeout / Destination Reached)
- IP geolocation via ip-api.com → hops plotted as markers on a dark Leaflet map, connected by a polyline
- Click any hop for an educational breakdown: ICMP Time-Exceeded mechanics, TCP vs UDP probe handshakes, and IPv4/CIDR class analysis of that hop's address
- Loading and error states while a trace is in flight
# CNL-mini-project
# CNL-mini-project
# CNL-mini-project
