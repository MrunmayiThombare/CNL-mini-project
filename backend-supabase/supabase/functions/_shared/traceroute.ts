// Supabase Edge Functions run on Deno Deploy, a sandboxed V8 isolate with
// no child_process and no raw ICMP socket access. A real system traceroute
// is therefore never possible here — this module always produces a
// realistic simulated trace, seeded from the real resolved destination IP
// (via Deno.resolveDns) so the final hop is genuine.

export interface Hop {
  ttl: number;
  ip: string | null;
  latencyMs: number | null;
  status: "RESPONDED" | "TIMEOUT" | "DESTINATION_REACHED";
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function resolveDomain(domain: string): Promise<string> {
  try {
    const records = await Deno.resolveDns(domain, "A");
    if (records.length > 0) return records[0];
  } catch (_err) {
    // fall through to fallback IP below
  }
  return "93.184.216.34"; // example.com fallback if DNS resolution fails
}

export function simulateTraceroute(destIp: string, maxHops = 20): Hop[] {
  const hopCount = Math.min(6 + Math.floor(Math.random() * 8), maxHops); // 6-13 hops
  const hops: Hop[] = [];

  // Indian ISP / transit prefixes so the simulated path starts in India
  // (Pune area) instead of the US. Index 0 is the home router (private).
  const transitPools = [
    "192.168.1.1",
    "49.44.",
    "182.79.",
    "115.110.",
    "14.140.",
    "180.87.",
    "121.240."
  ];

  let cumulativeLatency = 2 + Math.random() * 3;

  for (let i = 1; i <= hopCount; i++) {
    const isLast = i === hopCount;
    cumulativeLatency += 3 + Math.random() * 18 + i * 1.2;

    if (!isLast && Math.random() < 0.08) {
      hops.push({ ttl: i, ip: null, latencyMs: null, status: "TIMEOUT" });
      continue;
    }

    let ip: string;
    if (isLast) {
      ip = destIp;
    } else if (i === 1) {
      ip = "192.168.1.1";
    } else {
      const pool = transitPools[Math.min(i - 1, transitPools.length - 1)];
      ip =
        pool.split(".").length === 4 && pool.split(".").every((p) => p !== "")
          ? pool
          : `${pool}${randInt(0, 255)}.${randInt(1, 254)}`;
    }

    hops.push({
      ttl: i,
      ip,
      latencyMs: Math.round(cumulativeLatency * 10) / 10,
      status: isLast ? "DESTINATION_REACHED" : "RESPONDED"
    });
  }

  return hops;
}
