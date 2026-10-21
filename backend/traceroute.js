import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import dns from "node:dns/promises";

const execAsync = promisify(exec);

/**
 * Runs a real system traceroute and parses its output.
 * Falls back to a realistic simulated trace if the system binary
 * is unavailable or the process lacks the required (usually raw-socket)
 * permissions — common in sandboxed/containerized environments.
 */
export async function runTraceroute(domain, maxHops = 20) {
  const platform = os.platform();
  try {
    if (platform === "win32") {
      const { stdout } = await execAsync(`tracert -d -h ${maxHops} -w 800 ${domain}`, {
        timeout: 30000
      });
      const hops = parseWindowsTracert(stdout);
      if (hops.length > 0) return { hops, source: "system" };
    } else {
      const { stdout } = await execAsync(`traceroute -n -q 1 -w 1 -m ${maxHops} ${domain}`, {
        timeout: 30000
      });
      const hops = parseUnixTraceroute(stdout);
      if (hops.length > 0) return { hops, source: "system" };
    }
  } catch (err) {
    // exec throws if the binary is missing, permission is denied
    // (raw ICMP sockets usually require root/CAP_NET_RAW), or it times out.
    console.warn(`System traceroute unavailable (${err.message}). Falling back to simulation.`);
  }

  const hops = await simulateTraceroute(domain, maxHops);
  return { hops, source: "simulated" };
}

function parseUnixTraceroute(stdout) {
  const hops = [];
  const lines = stdout.split("\n").slice(1); // skip header line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hopMatch = trimmed.match(/^(\d+)\s+(.*)$/);
    if (!hopMatch) continue;
    const ttl = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2];

    if (rest.includes("*")) {
      hops.push({ ttl, ip: null, latencyMs: null, status: "TIMEOUT" });
      continue;
    }

    const ipMatch = rest.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    const latMatch = rest.match(/([\d.]+)\s*ms/);

    if (ipMatch) {
      hops.push({
        ttl,
        ip: ipMatch[1],
        latencyMs: latMatch ? parseFloat(latMatch[1]) : null,
        status: "RESPONDED"
      });
    } else {
      hops.push({ ttl, ip: null, latencyMs: null, status: "TIMEOUT" });
    }
  }
  return hops;
}

function parseWindowsTracert(stdout) {
  const hops = [];
  const lines = stdout.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const hopMatch = trimmed.match(/^(\d+)\s+(.*)$/);
    if (!hopMatch) continue;
    const ttl = parseInt(hopMatch[1], 10);
    const rest = hopMatch[2];

    if (rest.includes("*") && !/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(rest)) {
      hops.push({ ttl, ip: null, latencyMs: null, status: "TIMEOUT" });
      continue;
    }

    const ipMatch = rest.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    const latMatches = [...rest.matchAll(/(\d+)\s*ms/g)];
    if (ipMatch) {
      const avgLat = latMatches.length
        ? latMatches.reduce((s, m) => s + parseInt(m[1], 10), 0) / latMatches.length
        : null;
      hops.push({ ttl, ip: ipMatch[1], latencyMs: avgLat, status: "RESPONDED" });
    }
  }
  return hops;
}

/**
 * Realistic simulated traceroute: resolves the real destination IP,
 * then synthesizes a plausible hop-count and latency curve through
 * generic backbone/transit IP ranges before landing on the real
 * destination as the final hop. Used only when raw ICMP is blocked.
 */
async function simulateTraceroute(domain, maxHops) {
  let destIp;
  try {
    destIp = (await dns.lookup(domain)).address;
  } catch {
    destIp = "93.184.216.34"; // example.com fallback
  }

  const hopCount = Math.min(6 + Math.floor(Math.random() * 8), maxHops); // 6-13 hops
  const hops = [];

  // Common public backbone/transit IP blocks used to synthesize a believable path.
  const transitPools = [
    "192.168.1.1",
    "10.0.0.1",
    "96.120.", // Comcast-style regional
    "68.86.",
    "4.68.",   // Level3/CenturyLink backbone-style
    "62.115.", // Telia backbone-style
    "80.91.",  // NTT backbone-style
    "195.219." // European IX-style
  ];

  let cumulativeLatency = 2 + Math.random() * 3;

  for (let i = 1; i <= hopCount; i++) {
    const isLast = i === hopCount;
    cumulativeLatency += 3 + Math.random() * 18 + i * 1.2;

    // Small chance of an intermediate timeout, like a router that drops ICMP.
    if (!isLast && Math.random() < 0.08) {
      hops.push({ ttl: i, ip: null, latencyMs: null, status: "TIMEOUT" });
      continue;
    }

    let ip;
    if (isLast) {
      ip = destIp;
    } else if (i === 1) {
      ip = "192.168.1.1";
    } else {
      const pool = transitPools[Math.min(i - 1, transitPools.length - 1)];
      ip = pool.includes(".") && pool.split(".").length === 4
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
