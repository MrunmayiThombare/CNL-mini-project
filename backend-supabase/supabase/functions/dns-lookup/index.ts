import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { resolveDomain } from "../_shared/traceroute.ts";

const DOMAIN_RE =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidTarget(target: string): boolean {
  return DOMAIN_RE.test(target) || IPV4_RE.test(target);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain || typeof domain !== "string" || !isValidTarget(domain)) {
      return jsonResponse({ error: "Invalid domain name" }, 400);
    }

    const start = performance.now();
    const resolvedIp = await resolveDomain(domain);
    const durationMs = Math.round(performance.now() - start);

    return jsonResponse({ domain, resolvedIp, durationMs });
  } catch (err) {
    return jsonResponse({ error: `DNS resolution failed: ${(err as Error).message}` }, 500);
  }
});
