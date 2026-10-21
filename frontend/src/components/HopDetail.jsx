import React from "react";

function classifyCidr(ip) {
  if (!ip) return null;
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) return null;
  const [a] = octets;

  let cidrClass, defaultMask, notes;
  if (a >= 1 && a <= 126) {
    cidrClass = "Class A";
    defaultMask = "/8 (255.0.0.0)";
    notes = "Huge address space per network — typically large ISPs or legacy allocations.";
  } else if (a >= 128 && a <= 191) {
    cidrClass = "Class B";
    defaultMask = "/16 (255.255.0.0)";
    notes = "Mid-size allocations, common for large organizations and regional networks.";
  } else if (a >= 192 && a <= 223) {
    cidrClass = "Class C";
    defaultMask = "/24 (255.255.255.0)";
    notes = "Small networks — often the block closest to the actual destination host.";
  } else {
    cidrClass = "Special/Reserved";
    defaultMask = "N/A";
    notes = "Multicast, loopback, or reserved range — not a typical routable host block.";
  }

  const isPrivate =
    a === 10 ||
    (a === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (a === 192 && octets[1] === 168);

  return { cidrClass, defaultMask, notes, isPrivate };
}

export default function HopDetail({ hop }) {
  const cidrInfo = classifyCidr(hop.ip);

  return (
    <section className="hop-detail">
      <h2>Hop {hop.ttl} in detail</h2>

      <div className="detail-card">
        <h3>ICMP behavior</h3>
        <p>
          {hop.status === "TIMEOUT" ? (
            <>
              This hop did not reply within the timeout window. Its router may be configured to
              silently drop or deprioritize ICMP traffic, which is common on edge and security
              devices — it does not necessarily indicate packet loss further along the path.
            </>
          ) : hop.status === "DESTINATION_REACHED" ? (
            <>
              This is the final hop. The destination host responded directly (typically an ICMP
              Echo Reply or a port-unreachable message), ending the trace.
            </>
          ) : (
            <>
              Traceroute works by sending packets with a small, incrementing Time-To-Live (TTL).
              When a router receives a packet whose TTL expires, it discards it and returns an{" "}
              <strong>ICMP Time Exceeded</strong> message to the sender. Hop {hop.ttl} is the
              router that hit a TTL of {hop.ttl} and generated that response, revealing itself in
              the path.
            </>
          )}
        </p>
      </div>

      <div className="detail-card">
        <h3>TCP vs UDP handshake</h3>
        <p>
          Classic traceroute implementations send <strong>UDP</strong> probes to high, unlikely
          ports — there's no handshake, so a "connection refused" response confirms the final
          hop. Some tools instead use <strong>TCP SYN</strong> probes (e.g. on port 80/443),
          which start the normal three-way handshake (SYN → SYN-ACK → ACK); a SYN-ACK from a hop
          means that hop accepted the connection attempt rather than just forwarding the packet.
          TCP-based tracing is often used to get through firewalls that block ICMP/UDP but allow
          web traffic.
        </p>
      </div>

      {cidrInfo && (
        <div className="detail-card">
          <h3>IPv4 and CIDR analysis</h3>
          <ul className="cidr-list">
            <li>
              <span className="label">Legacy class</span>
              <span>{cidrInfo.cidrClass}</span>
            </li>
            <li>
              <span className="label">Typical default mask</span>
              <span>{cidrInfo.defaultMask}</span>
            </li>
            <li>
              <span className="label">Address scope</span>
              <span>{cidrInfo.isPrivate ? "Private (RFC 1918)" : "Public / routable"}</span>
            </li>
          </ul>
          <p>{cidrInfo.notes}</p>
          <p>
            Note: modern networks use CIDR (Classless Inter-Domain Routing) rather than these
            legacy classes — actual subnet size is defined by the prefix length (e.g. /24), not
            the leading address bits alone.
          </p>
        </div>
      )}
    </section>
  );
}
