import React from "react";
import HopDetail from "./HopDetail.jsx";

function StatusBadge({ status }) {
  const map = {
    RESPONDED: { label: "Responded", cls: "badge-ok" },
    DESTINATION_REACHED: { label: "Reached", cls: "badge-final" },
    TIMEOUT: { label: "Timeout", cls: "badge-warn" }
  };
  const info = map[status] || { label: status, cls: "" };
  return <span className={`badge ${info.cls}`}>{info.label}</span>;
}

function HistoryPanel({ history, onRerun, disabled }) {
  if (!history || history.length === 0) return null;
  return (
    <section className="history-block">
      <h2>Recent traces</h2>
      <ul className="history-list">
        {history.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="history-item"
              onClick={() => onRerun(row.domain)}
              disabled={disabled}
            >
              <span className="history-domain">{row.domain}</span>
              <span className="history-meta">
                {row.hop_count} hops, {row.trace_source}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Sidebar({
  domain,
  traceData,
  loading,
  error,
  selectedHop,
  onSelectHop,
  history,
  onRerun
}) {
  return (
    <aside className="sidebar">
      {loading && (
        <div className="status-block loading">
          <div className="spinner" />
          <p>Resolving DNS and tracing the route to {domain}…</p>
        </div>
      )}

      {error && (
        <div className="status-block error">
          <p className="error-title">Trace failed</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && !traceData && (
        <>
          <div className="status-block empty">
            <p className="empty-title">No trace running</p>
            <p>Enter a domain above and choose Trace route to map the path packets take to get there.</p>
          </div>
          <HistoryPanel history={history} onRerun={onRerun} disabled={loading} />
        </>
      )}

      {traceData && (
        <>
          <section className="dns-block">
            <h2>DNS resolution</h2>
            <div className="dns-row">
              <span className="label">Domain</span>
              <span className="value">{traceData.domain}</span>
            </div>
            <div className="dns-row">
              <span className="label">Resolved IP</span>
              <span className="value">{traceData.resolvedIp}</span>
            </div>
            <div className="dns-row">
              <span className="label">Resolution time</span>
              <span className="value">{traceData.dns.durationMs} ms</span>
            </div>
            {traceData.traceSource === "simulated" && (
              <div className="notice">
                Raw ICMP traceroute isn't available in this environment, so this path is a
                realistic simulated approximation.
              </div>
            )}
          </section>

          <section className="hops-block">
            <h2>Route hops ({traceData.hops.length})</h2>
            <ul className="hop-list">
              {traceData.hops.map((hop) => (
                <li
                  key={hop.ttl}
                  className={`hop-item ${selectedHop?.ttl === hop.ttl ? "active" : ""}`}
                  onClick={() => onSelectHop(hop)}
                >
                  <div className="hop-item-top">
                    <span className="ttl">#{hop.ttl}</span>
                    <span className="ip">{hop.ip || "* * *"}</span>
                    <StatusBadge status={hop.status} />
                  </div>
                  <div className="hop-item-bottom">
                    <span>{hop.latencyMs != null ? `${hop.latencyMs} ms` : "—"}</span>
                    <span>
                      {hop.geo
                        ? `${hop.geo.city ? hop.geo.city + ", " : ""}${hop.geo.country || ""}`
                        : hop.isPrivate
                        ? "private network"
                        : "unresolved"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {selectedHop && <HopDetail hop={selectedHop} />}

          <HistoryPanel history={history} onRerun={onRerun} disabled={loading} />
        </>
      )}
    </aside>
  );
}
