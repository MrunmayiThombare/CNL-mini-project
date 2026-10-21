import express from "express";
import cors from "cors";
import dns from "node:dns/promises";
import { runTraceroute } from "./traceroute.js";
import { geolocateHops } from "./geolocate.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Basic domain validation to prevent command injection into traceroute.
const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidTarget(target) {
  return DOMAIN_RE.test(target) || IPV4_RE.test(target);
}

app.get("/api/dns/:domain", async (req, res) => {
  const { domain } = req.params;
  if (!isValidTarget(domain)) {
    return res.status(400).json({ error: "Invalid domain name" });
  }
  try {
    const start = performance.now();
    const result = await dns.lookup(domain, { all: true });
    const durationMs = Math.round(performance.now() - start);
    res.json({
      domain,
      addresses: result,
      resolvedIp: result[0]?.address,
      durationMs
    });
  } catch (err) {
    res.status(404).json({ error: `DNS resolution failed: ${err.message}` });
  }
});

app.get("/api/traceroute/:domain", async (req, res) => {
  const { domain } = req.params;
  const maxHops = Math.min(parseInt(req.query.maxHops) || 20, 30);

  if (!isValidTarget(domain)) {
    return res.status(400).json({ error: "Invalid domain name" });
  }

  try {
    // Step 1: DNS resolution
    const dnsStart = performance.now();
    const { address: resolvedIp } = await dns.lookup(domain);
    const dnsDurationMs = Math.round(performance.now() - dnsStart);

    // Step 2: Traceroute (real, with simulated fallback)
    const { hops, source } = await runTraceroute(domain, maxHops);

    // Step 3: Geolocate every hop IP
    const geoHops = await geolocateHops(hops);

    res.json({
      domain,
      resolvedIp,
      dns: { resolvedIp, durationMs: dnsDurationMs },
      traceSource: source, // "system" or "simulated"
      hops: geoHops
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Traceroute failed: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`GeoTrace backend listening on http://localhost:${PORT}`);
});
