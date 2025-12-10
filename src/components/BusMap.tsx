import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, VehicleLocation, Stop } from '@/types/transit';

interface BusMapProps {
  routes: Route[];
  vehicles: VehicleLocation[];
  selectedRoute: string | null;
  selectedStop: Stop | null;
  onStopClick: (stop: Stop, route: Route) => void;
  isVisible?: boolean;
}

// Different dash patterns for overlapping routes
const ROUTE_STYLES: Record<number, { dashArray?: string; weight: number; offset: number }> = {
  0: { weight: 5, offset: 0 },
  1: { dashArray: '10, 6', weight: 4, offset: 3 },
  2: { dashArray: '4, 8', weight: 4, offset: -3 },
  3: { dashArray: '15, 5, 5, 5', weight: 3, offset: 5 },
  4: { weight: 3, offset: -5 },
};

const BusMap = ({ routes, vehicles, selectedRoute, selectedStop, onStopClick, isVisible = true }: BusMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polylinesRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [36.9850, -86.4550],
      zoom: 15,
      zoomControl: false,
    });

    // Dark theme tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapRef.current);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);
    polylinesRef.current = L.layerGroup().addTo(mapRef.current);
    vehicleMarkersRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Filter routes based on selection
  const displayedRoutes = useMemo(() => {
    if (selectedRoute) {
      return routes.filter(r => r.tag === selectedRoute);
    }
    return routes;
  }, [routes, selectedRoute]);

  // Helper function to offset a polyline
  const offsetLatLngs = (latLngs: [number, number][], offsetMeters: number): [number, number][] => {
    if (offsetMeters === 0 || latLngs.length < 2) return latLngs;
    
    const offsetLatLngsResult: [number, number][] = [];
    
    for (let i = 0; i < latLngs.length; i++) {
      const current = latLngs[i];
      let bearing: number;
      
      if (i === 0) {
        // First point: use bearing to next point
        bearing = calculateBearing(current, latLngs[i + 1]);
      } else if (i === latLngs.length - 1) {
        // Last point: use bearing from previous point
        bearing = calculateBearing(latLngs[i - 1], current);
      } else {
        // Middle points: average of incoming and outgoing bearings
        const bearingIn = calculateBearing(latLngs[i - 1], current);
        const bearingOut = calculateBearing(current, latLngs[i + 1]);
        bearing = (bearingIn + bearingOut) / 2;
      }
      
      // Offset perpendicular to the bearing
      const perpBearing = bearing + 90;
      const offsetPoint = offsetPoint2(current, perpBearing, offsetMeters);
      offsetLatLngsResult.push(offsetPoint);
    }
    
    return offsetLatLngsResult;
  };

  const calculateBearing = (from: [number, number], to: [number, number]): number => {
    const lat1 = from[0] * Math.PI / 180;
    const lat2 = to[0] * Math.PI / 180;
    const dLon = (to[1] - from[1]) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    return Math.atan2(y, x) * 180 / Math.PI;
  };

  const offsetPoint2 = (point: [number, number], bearing: number, distanceMeters: number): [number, number] => {
    const R = 6371000; // Earth's radius in meters
    const bearingRad = bearing * Math.PI / 180;
    const lat1 = point[0] * Math.PI / 180;
    const lon1 = point[1] * Math.PI / 180;
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanceMeters / R) +
      Math.cos(lat1) * Math.sin(distanceMeters / R) * Math.cos(bearingRad)
    );
    
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceMeters / R) * Math.cos(lat1),
      Math.cos(distanceMeters / R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
  };

  // Update polylines (routes)
  useEffect(() => {
    if (!polylinesRef.current) return;
    polylinesRef.current.clearLayers();

    displayedRoutes.forEach((route, routeIndex) => {
      const color = `#${route.color === '000000' ? '6B7280' : route.color}`;
      const style = ROUTE_STYLES[routeIndex % Object.keys(ROUTE_STYLES).length];
      
      route.paths.forEach(path => {
        const latLngs = path.map(point => [point.lat, point.lon] as [number, number]);
        
        // Apply offset when showing all routes
        const offsetPath = selectedRoute ? latLngs : offsetLatLngs(latLngs, style.offset);
        
        // Add a white outline for better visibility
        if (!selectedRoute) {
          L.polyline(offsetPath, {
            color: '#1a1f2e',
            weight: style.weight + 3,
            opacity: 0.8,
          }).addTo(polylinesRef.current!);
        }
        
        // Main route line
        const polyline = L.polyline(offsetPath, {
          color,
          weight: style.weight,
          opacity: 0.9,
          dashArray: style.dashArray,
          lineCap: 'round',
          lineJoin: 'round',
        });
        
        // Add tooltip on hover
        polyline.bindTooltip(route.title, {
          sticky: true,
          className: 'route-tooltip',
        });
        
        polyline.addTo(polylinesRef.current!);
      });
    });
  }, [displayedRoutes, selectedRoute]);

  // Helper to create SVG for bus stop sign marker
  const createStopMarkerSvg = (colors: string[], isSelected: boolean): string => {
    const width = isSelected ? 28 : 22;
    const height = isSelected ? 36 : 28;
    const signWidth = width - 4;
    const signHeight = height - 10;
    const signX = 2;
    const signY = 2;
    const poleWidth = 4;
    const poleX = (width - poleWidth) / 2;
    const cornerRadius = 3;
    
    // Bus icon path (simplified)
    const busIconScale = isSelected ? 0.5 : 0.4;
    const busIconX = width / 2;
    const busIconY = signY + signHeight / 2;
    
    if (colors.length === 1) {
      // Single route - solid color sign
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <!-- Pole -->
          <rect x="${poleX}" y="${signY + signHeight - 2}" width="${poleWidth}" height="${height - signHeight}" fill="${isSelected ? '#ffffff' : '#1a1f2e'}" rx="1"/>
          <!-- Sign background/border -->
          <rect x="${signX - 1}" y="${signY - 1}" width="${signWidth + 2}" height="${signHeight + 2}" rx="${cornerRadius + 1}" fill="${isSelected ? '#ffffff' : '#1a1f2e'}"/>
          <!-- Sign -->
          <rect x="${signX}" y="${signY}" width="${signWidth}" height="${signHeight}" rx="${cornerRadius}" fill="#${colors[0]}"/>
          <!-- Bus icon -->
          <g transform="translate(${busIconX}, ${busIconY}) scale(${busIconScale})">
            <path d="M-8 4c0 .88.39 1.67 1 2.22V8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1V6.22c.61-.55 1-1.34 1-2.22V-6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S-5.33 2-4.5 2 -3 2.67-3 3.5-3.67 5-4.5 5zm9 0c-.83 0-1.5-.67-1.5-1.5S3.67 2 4.5 2 6 2.67 6 3.5 5.33 5 4.5 5zm1.5-6H-6V-6h12v5z" fill="white"/>
          </g>
        </svg>
      `;
    }
    
    // Multiple routes - split sign with gradient/segments
    const segmentWidth = signWidth / colors.length;
    let segments = '';
    
    colors.forEach((color, index) => {
      const x = signX + (index * segmentWidth);
      const isFirst = index === 0;
      const isLast = index === colors.length - 1;
      
      if (isFirst) {
        // First segment with left rounded corners
        segments += `<path d="M ${x + cornerRadius} ${signY} H ${x + segmentWidth} V ${signY + signHeight} H ${x + cornerRadius} Q ${x} ${signY + signHeight} ${x} ${signY + signHeight - cornerRadius} V ${signY + cornerRadius} Q ${x} ${signY} ${x + cornerRadius} ${signY}" fill="#${color}"/>`;
      } else if (isLast) {
        // Last segment with right rounded corners
        segments += `<path d="M ${x} ${signY} H ${x + segmentWidth - cornerRadius} Q ${x + segmentWidth} ${signY} ${x + segmentWidth} ${signY + cornerRadius} V ${signY + signHeight - cornerRadius} Q ${x + segmentWidth} ${signY + signHeight} ${x + segmentWidth - cornerRadius} ${signY + signHeight} H ${x} V ${signY}" fill="#${color}"/>`;
      } else {
        // Middle segments - just rectangles
        segments += `<rect x="${x}" y="${signY}" width="${segmentWidth}" height="${signHeight}" fill="#${color}"/>`;
      }
    });
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <!-- Pole -->
        <rect x="${poleX}" y="${signY + signHeight - 2}" width="${poleWidth}" height="${height - signHeight}" fill="${isSelected ? '#ffffff' : '#1a1f2e'}" rx="1"/>
        <!-- Sign background/border -->
        <rect x="${signX - 1}" y="${signY - 1}" width="${signWidth + 2}" height="${signHeight + 2}" rx="${cornerRadius + 1}" fill="${isSelected ? '#ffffff' : '#1a1f2e'}"/>
        <!-- Color segments -->
        ${segments}
        <!-- Bus icon -->
        <g transform="translate(${busIconX}, ${busIconY}) scale(${busIconScale})">
          <path d="M-8 4c0 .88.39 1.67 1 2.22V8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1V6.22c.61-.55 1-1.34 1-2.22V-6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S-5.33 2-4.5 2 -3 2.67-3 3.5-3.67 5-4.5 5zm9 0c-.83 0-1.5-.67-1.5-1.5S3.67 2 4.5 2 6 2.67 6 3.5 5.33 5 4.5 5zm1.5-6H-6V-6h12v5z" fill="white"/>
        </g>
      </svg>
    `;
  };

  // Update stop markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    // Collect stops with ALL their routes - group by location to merge overlapping stops
    const stopsMap = new Map<string, { stop: Stop; routes: Route[]; tags: string[] }>();
    displayedRoutes.forEach(route => {
      route.stops.forEach(stop => {
        // Use lat/lon as key to merge stops at the same location (rounded to ~11m precision)
        const locationKey = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
        const existing = stopsMap.get(locationKey);
        if (existing) {
          if (!existing.routes.find(r => r.tag === route.tag)) {
            existing.routes.push(route);
          }
          if (!existing.tags.includes(stop.tag)) {
            existing.tags.push(stop.tag);
          }
        } else {
          stopsMap.set(locationKey, { stop, routes: [route], tags: [stop.tag] });
        }
      });
    });

    stopsMap.forEach(({ stop, routes: stopRoutes }) => {
      const isSelected = selectedStop?.tag === stop.tag;
      const colors = stopRoutes.map(r => r.color === '000000' ? '6B7280' : r.color);
      const width = isSelected ? 28 : 22;
      const height = isSelected ? 36 : 28;
      
      const icon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="
            width: ${width}px;
            height: ${height}px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            transition: all 0.2s ease;
          ">
            ${createStopMarkerSvg(colors, isSelected)}
          </div>
        `,
        iconSize: [width, height],
        iconAnchor: [width / 2, height],
      });

      const routesList = stopRoutes.map(r => `<span style="color: #${r.color === '000000' ? '6B7280' : r.color};">●</span> ${r.title}`).join('<br/>');

      const marker = L.marker([stop.lat, stop.lon], { icon })
        .bindPopup(`
          <div style="padding: 4px;">
            <strong style="font-size: 14px;">${stop.title}</strong>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
              ${routesList}
            </div>
            <div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">
              Stop ID: ${stop.stopId}
            </div>
          </div>
        `)
        .on('click', () => onStopClick(stop, stopRoutes[0]));

      marker.addTo(markersRef.current!);
    });
  }, [displayedRoutes, selectedStop, onStopClick]);

  // Helper to get the next stop a bus is heading to
  const getNextStopForBus = (vehicle: VehicleLocation, route: Route | undefined): string | null => {
    if (!route) return null;
    
    const direction = route.directions.find(d => d.tag === vehicle.dirTag);
    if (!direction || direction.stops.length === 0) return null;
    
    // Find the closest stop to the bus's current position
    let closestStopIndex = 0;
    let minDistance = Infinity;
    
    direction.stops.forEach((stopTag, index) => {
      const stop = route.stops.find(s => s.tag === stopTag);
      if (stop) {
        const distance = Math.sqrt(
          Math.pow(stop.lat - vehicle.lat, 2) + Math.pow(stop.lon - vehicle.lon, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestStopIndex = index;
        }
      }
    });
    
    // Get the next stop (or current if at the end)
    const nextStopIndex = Math.min(closestStopIndex + 1, direction.stops.length - 1);
    const nextStopTag = direction.stops[nextStopIndex];
    const nextStop = route.stops.find(s => s.tag === nextStopTag);
    
    return nextStop?.title || null;
  };

  // Update vehicle markers
  useEffect(() => {
    if (!vehicleMarkersRef.current) return;
    vehicleMarkersRef.current.clearLayers();

    const displayedRouteTags = new Set(displayedRoutes.map(r => r.tag));
    const filteredVehicles = vehicles.filter(v => displayedRouteTags.has(v.routeTag));

    filteredVehicles.forEach(vehicle => {
      const route = routes.find(r => r.tag === vehicle.routeTag);
      const color = route ? (route.color === '000000' ? '6B7280' : route.color) : '6B7280';
      const nextStop = getNextStopForBus(vehicle, route);
      
      const icon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(${vehicle.heading}deg);
          ">
            <div style="
              width: 28px;
              height: 28px;
              background-color: #${color};
              border: 3px solid #ffffff;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
              </svg>
            </div>
            <div style="
              position: absolute;
              top: -4px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 8px solid #${color};
            "></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const speedMph = Math.round(vehicle.speedKmHr * 0.621371);
      
      L.marker([vehicle.lat, vehicle.lon], { icon })
        .bindPopup(`
          <div style="padding: 4px;">
            <strong>Bus ${vehicle.id}</strong>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">
              ${route?.title || vehicle.routeTag}
            </div>
            ${nextStop ? `<div style="font-size: 11px; color: #22c55e; margin-top: 2px;">
              → ${nextStop}
            </div>` : ''}
            <div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">
              Speed: ${speedMph} mph
            </div>
          </div>
        `)
        .addTo(vehicleMarkersRef.current!);
    });
  }, [vehicles, displayedRoutes, routes]);

  // Center on selected stop
  useEffect(() => {
    if (selectedStop && mapRef.current) {
      mapRef.current.setView([selectedStop.lat, selectedStop.lon], 17, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedStop]);

  // Invalidate map size when visibility changes (fixes tab switching issue)
  useEffect(() => {
    if (isVisible && mapRef.current) {
      // Small delay to ensure container is rendered
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
};

export default BusMap;
