import fetch from "node-fetch";

const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^127\./,
  /^169\.254\./
];

function isPrivateIp(ip) {
  if (!ip) return true;
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

/**
 * Geolocates a batch of hop IPs using ip-api.com's free batch endpoint
 * (up to 100 IPs per request, no API key required for non-commercial use).
 * Private/reserved IPs are skipped and returned as null-location entries.
 */
export async function geolocateHops(hops) {
  const publicIps = hops
    .filter((h) => h.ip && !isPrivateIp(h.ip))
    .map((h) => h.ip);

  const uniqueIps = [...new Set(publicIps)];
  let geoByIp = {};

  if (uniqueIps.length > 0) {
    try {
      const response = await fetch("http://ip-api.com/batch?fields=status,message,country,regionName,city,lat,lon,isp,org,query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uniqueIps)
      });
      const results = await response.json();
      geoByIp = Object.fromEntries(
        results.map((r) => [
          r.query,
          r.status === "success"
            ? {
                lat: r.lat,
                lon: r.lon,
                city: r.city,
                region: r.regionName,
                country: r.country,
                isp: r.isp,
                org: r.org
              }
            : null
        ])
      );
    } catch (err) {
      console.warn(`Geolocation batch request failed: ${err.message}`);
    }
  }

  return hops.map((hop) => {
    if (!hop.ip) {
      return { ...hop, geo: null, isPrivate: false };
    }
    if (isPrivateIp(hop.ip)) {
      return { ...hop, geo: null, isPrivate: true };
    }
    return { ...hop, geo: geoByIp[hop.ip] || null, isPrivate: false };
  });
}
