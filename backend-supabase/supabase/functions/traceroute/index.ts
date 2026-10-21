import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveDomain, simulateTraceroute } from "../_shared/traceroute.ts";
import { geolocateHops } from "../_shared/geolocate.ts";

const DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidTarget(target: string): boolean {
  return DOMAIN_RE.test(target) || IPV4_RE.test(target);
}

// Service role client: bypasses RLS so the function can persist trace
// history. Never exposed to the browser — this only runs server-side.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { domain, maxHops: rawMaxHops } = await req.json();
    const maxHops = Math.min(parseInt(String(rawMaxHops)) || 20, 30);

    if (!domain || typeof domain !== "string" || !isValidTarget(domain)) {
      return jsonResponse({ error: "Invalid domain name" }, 400);
    }

    // Step 1: DNS resolution
    const dnsStart = performance.now();
    const resolvedIp = await resolveDomain(domain);
    const dnsDurationMs = Math.round(performance.now() - dnsStart);

    // Step 2: Simulated traceroute (Deno Deploy has no raw ICMP access)
    const rawHops = simulateTraceroute(resolvedIp, maxHops);

    // Step 3: Geolocate every hop IP
    const geoHops = await geolocateHops(rawHops);

    // Step 4: Persist this run to Postgres (service role bypasses RLS)
    const { data: traceRow, error: traceErr } = await supabaseAdmin
      .from("traces")
      .insert({
        domain,
        resolved_ip: resolvedIp,
        dns_duration_ms: dnsDurationMs,
        trace_source: "simulated",
        hop_count: geoHops.length
      })
      .select()
      .single();

    if (traceErr) {
      console.warn(`Failed to persist trace: ${traceErr.message}`);
    } else if (traceRow) {
      const hopRows = geoHops.map((hop) => ({
        trace_id: traceRow.id,
        ttl: hop.ttl,
        ip: hop.ip,
        latency_ms: hop.latencyMs,
        status: hop.status,
        is_private: hop.isPrivate,
        lat: hop.geo?.lat ?? null,
        lon: hop.geo?.lon ?? null,
        city: hop.geo?.city ?? null,
        region: hop.geo?.region ?? null,
        country: hop.geo?.country ?? null,
        isp: hop.geo?.isp ?? null,
        org: hop.geo?.org ?? null
      }));
      const { error: hopsErr } = await supabaseAdmin.from("trace_hops").insert(hopRows);
      if (hopsErr) console.warn(`Failed to persist hops: ${hopsErr.message}`);
    }

    return jsonResponse({
      domain,
      resolvedIp,
      dns: { resolvedIp, durationMs: dnsDurationMs },
      traceSource: "simulated",
      traceId: traceRow?.id ?? null,
      hops: geoHops
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: `Traceroute failed: ${(err as Error).message}` }, 500);
  }
});
