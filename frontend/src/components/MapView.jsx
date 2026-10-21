import React from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons under bundlers like Vite.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const hopIcon = (isSelected, isDestination) =>
  L.divIcon({
    className: "hop-marker",
    html: `<div class="hop-dot ${isSelected ? "selected" : ""} ${isDestination ? "destination" : ""}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
}

export default function MapView({ traceData, selectedHop, onSelectHop, origin }) {
  const geoHops = (traceData?.hops || []).filter((h) => h.geo);
  const hopPoints = geoHops.map((h) => [h.geo.lat, h.geo.lon]);
  // Start the route at the user's location (Pune) before the first hop.
  const points = origin && hopPoints.length > 0 ? [[origin.lat, origin.lon], ...hopPoints] : hopPoints;

  return (
    <div className="map-container">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.length > 1 && (
          <Polyline
            positions={points}
            pathOptions={{ color: "#38bdf8", weight: 2.5, opacity: 0.8, dashArray: "6 6" }}
          />
        )}

        {origin && points.length > 0 && (
          <Marker position={[origin.lat, origin.lon]} icon={hopIcon(false, false)}>
            <Popup>
              <strong>Start</strong>
              <br />
              {origin.label}
            </Popup>
          </Marker>
        )}

        {geoHops.map((hop, idx) => {
          const isLast = idx === geoHops.length - 1;
          const isSelected = selectedHop?.ttl === hop.ttl;
          return (
            <Marker
              key={`${hop.ttl}-${hop.ip}`}
              position={[hop.geo.lat, hop.geo.lon]}
              icon={hopIcon(isSelected, isLast)}
              eventHandlers={{ click: () => onSelectHop(hop) }}
            >
              <Popup>
                <strong>Hop {hop.ttl}</strong>
                <br />
                {hop.ip}
                <br />
                {hop.geo.city ? `${hop.geo.city}, ` : ""}
                {hop.geo.country}
                <br />
                {hop.latencyMs != null ? `${hop.latencyMs} ms` : "no response"}
              </Popup>
            </Marker>
          );
        })}

        {points.length > 0 && <FitBounds points={points} />}
      </MapContainer>

      {!traceData && (
        <div className="map-placeholder">
          <p>Enter a domain to trace its route across the network.</p>
        </div>
      )}
    </div>
  );
}
