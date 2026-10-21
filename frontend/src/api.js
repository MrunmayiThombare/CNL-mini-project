import { supabase } from "./supabaseClient.js";

const API_MODE = import.meta.env.VITE_API_MODE || "express";
const BASE_URL = "/api";

async function fetchTraceExpress(domain, maxHops) {
  const res = await fetch(`${BASE_URL}/traceroute/${encodeURIComponent(domain)}?maxHops=${maxHops}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

async function fetchTraceSupabase(domain, maxHops) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
    );
  }
  const { data, error } = await supabase.functions.invoke("traceroute", {
    body: { domain, maxHops }
  });
  if (error) {
    // supabase-js wraps non-2xx responses in a FunctionsHttpError; try to
    // surface the JSON error message the Edge Function returned.
    let message = error.message;
    try {
      const ctx = await error.context.json();
      if (ctx?.error) message = ctx.error;
    } catch {
      /* ignore parse failure, fall back to default message */
    }
    throw new Error(message);
  }
  return data;
}

export async function fetchTraceroute(domain, maxHops = 20) {
  return API_MODE === "supabase"
    ? fetchTraceSupabase(domain, maxHops)
    : fetchTraceExpress(domain, maxHops);
}

export async function fetchTraceHistory(limit = 20) {
  if (API_MODE !== "supabase" || !supabase) return [];
  const { data, error } = await supabase
    .from("traces")
    .select("id, domain, resolved_ip, hop_count, trace_source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
