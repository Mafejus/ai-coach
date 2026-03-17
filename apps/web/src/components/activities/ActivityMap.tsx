'use client';

import { useEffect, useRef } from 'react';

interface GPSPoint {
  lat: number;
  lon: number;
  altitude?: number;
}

interface ActivityMapProps {
  polyline: GPSPoint[];
}

export default function ActivityMap({ polyline }: ActivityMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || polyline.length === 0) return;

    // Remove existing map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    // Clear stale Leaflet container ID (React StrictMode fires effects twice in dev)
    const container = mapRef.current as Element & { _leaflet_id?: number };
    delete container._leaflet_id;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;

      // Double-check after async gap (StrictMode second run may already be here)
      const el = mapRef.current as Element & { _leaflet_id?: number };
      delete el._leaflet_id;

      // Fix default icon
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const coords = polyline.map(p => [p.lat, p.lon] as [number, number]);

      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false });
      if (cancelled) { map.remove(); return; }
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      // Draw route
      const polylineLayer = L.polyline(coords, { color: '#3b82f6', weight: 3, opacity: 0.9 });
      polylineLayer.addTo(map);

      // Start / finish markers
      L.circleMarker(coords[0]!, { radius: 8, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 })
        .bindTooltip('Start', { permanent: false })
        .addTo(map);
      L.circleMarker(coords[coords.length - 1]!, { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 })
        .bindTooltip('Cíl', { permanent: false })
        .addTo(map);

      map.fitBounds(polylineLayer.getBounds(), { padding: [20, 20] });
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [polyline]);

  return <div ref={mapRef} className="w-full h-full bg-zinc-800" />;
}
