import React, { useState, useCallback, useEffect } from "react";
import MapView from "./components/MapView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { fetchTraceroute, fetchTraceHistory } from "./api.js";
import "./App.css";

// Fallback start point: Kothrud, Pune
const DEFAULT_ORIGIN = { lat: 18.5074, lon: 73.8077, label: "Kothrud, Pune" };

export default function App() {
  const [domain, setDomain] = useState("");
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedHop, setSelectedHop] = useState(null);
  const [history, setHistory] = useState([]);
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);

  // Use the browser's current location; stay on Kothrud if denied/unavailable.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setOrigin({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Your location"
        }),
      () => {},
      { timeout: 8000 }
    );
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const rows = await fetchTraceHistory(8);
      setHistory(rows);
    } catch {
      // history is a nice-to-have; silently skip if unavailable
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runTrace = useCallback(
    async (e, overrideDomain) => {
      if (e?.preventDefault) e.preventDefault();
      const target = (overrideDomain ?? domain).trim();
      if (!target) return;

      setDomain(target);
      setLoading(true);
      setError(null);
      setTraceData(null);
      setSelectedHop(null);

      try {
        const data = await fetchTraceroute(target);
        setTraceData(data);
        loadHistory();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [domain, loadHistory]
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>GeoTrace</h1>
        </div>
        <form onSubmit={runTrace} className="trace-form">
          <input
            type="text"
            placeholder="Enter a domain, e.g. wikipedia.org"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !domain.trim()}>
            {loading ? "Tracing…" : "Trace route"}
          </button>
        </form>
      </header>

      <div className="app-body">
        <Sidebar
          domain={domain}
          traceData={traceData}
          loading={loading}
          error={error}
          selectedHop={selectedHop}
          onSelectHop={setSelectedHop}
          history={history}
          onRerun={(d) => runTrace(null, d)}
        />
        <MapView
          traceData={traceData}
          selectedHop={selectedHop}
          onSelectHop={setSelectedHop}
          origin={origin}
        />
      </div>
    </div>
  );
}
