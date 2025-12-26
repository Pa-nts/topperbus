import { useEffect, useRef, useMemo, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { Route, VehicleLocation, Stop } from '@/types/transit';
import { CAMPUS_BUILDINGS, CampusBuilding, CATEGORY_ICONS, BuildingCategory } from '@/lib/campusBuildings';

interface BusMapProps {
  routes: Route[];
  vehicles: VehicleLocation[];
  selectedRoute: string | null;
  selectedStop: Stop | null;
  selectedVehicle: VehicleLocation | null;
  selectedBuilding: CampusBuilding | null;
  onStopClick: (stop: Stop, route: Route) => void;
  onVehicleClick: (vehicle: VehicleLocation, route: Route) => void;
  onBuildingClick: (building: CampusBuilding) => void;
  isVisible?: boolean;
  userLocation: { lat: number; lon: number } | null;
  directionsDestination: CampusBuilding | null;
  onClearDirections?: () => void;
}

export interface BusMapHandle {
  getMap: () => L.Map | null;
}

// Different dash patterns for overlapping routes
const ROUTE_STYLES: Record<number, { dashArray?: string; weight: number; offset: number }> = {
  0: { weight: 5, offset: 0 },
  1: { dashArray: '10, 6', weight: 4, offset: 3 },
  2: { dashArray: '4, 8', weight: 4, offset: -3 },
  3: { dashArray: '15, 5, 5, 5', weight: 3, offset: 5 },
  4: { weight: 3, offset: -5 },
};

const BusMap = forwardRef<BusMapHandle, BusMapProps>(({ 
  routes, 
  vehicles, 
  selectedRoute, 
  selectedStop, 
  selectedVehicle, 
  selectedBuilding, 
  onStopClick, 
  onVehicleClick, 
  onBuildingClick, 
  isVisible = true,
  userLocation,
  directionsDestination,
  onClearDirections,
}, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const polylinesRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkersRef = useRef<L.LayerGroup | null>(null);
  const buildingMarkersRef = useRef<L.LayerGroup | null>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const routingControlRef = useRef<L.Routing.Control | null>(null);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
  }));

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
    buildingMarkersRef.current = L.layerGroup().addTo(mapRef.current);

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
        bearing = calculateBearing(current, latLngs[i + 1]);
      } else if (i === latLngs.length - 1) {
        bearing = calculateBearing(latLngs[i - 1], current);
      } else {
        const bearingIn = calculateBearing(latLngs[i - 1], current);
        const bearingOut = calculateBearing(current, latLngs[i + 1]);
        bearing = (bearingIn + bearingOut) / 2;
      }
      
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
    const R = 6371000;
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
        
        const offsetPath = selectedRoute ? latLngs : offsetLatLngs(latLngs, style.offset);
        
        if (!selectedRoute) {
          L.polyline(offsetPath, {
            color: '#1a1f2e',
            weight: style.weight + 3,
            opacity: 0.8,
          }).addTo(polylinesRef.current!);
        }
        
        const polyline = L.polyline(offsetPath, {
          color,
          weight: style.weight,
          opacity: 0.9,
          dashArray: style.dashArray,
          lineCap: 'round',
          lineJoin: 'round',
        });
        
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
    
    const busIconScale = isSelected ? 0.5 : 0.4;
    const busIconX = width / 2;
    const busIconY = signY + signHeight / 2;
    
    const poleColor = isSelected ? '#22c55e' : '#1a1f2e';
    const borderColor = isSelected ? '#22c55e' : '#1a1f2e';
    
    if (colors.length === 1) {
      return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect x="${poleX}" y="${signY + signHeight - 2}" width="${poleWidth}" height="${height - signHeight}" fill="${poleColor}" rx="1"/>
          <rect x="${signX - 1}" y="${signY - 1}" width="${signWidth + 2}" height="${signHeight + 2}" rx="${cornerRadius + 1}" fill="${borderColor}"/>
          <rect x="${signX}" y="${signY}" width="${signWidth}" height="${signHeight}" rx="${cornerRadius}" fill="#${colors[0]}" ${isSelected ? 'opacity="0.85"' : ''}/>
          <g transform="translate(${busIconX}, ${busIconY}) scale(${busIconScale})">
            <path d="M-8 4c0 .88.39 1.67 1 2.22V8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1V6.22c.61-.55 1-1.34 1-2.22V-6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S-5.33 2-4.5 2 -3 2.67-3 3.5-3.67 5-4.5 5zm9 0c-.83 0-1.5-.67-1.5-1.5S3.67 2 4.5 2 6 2.67 6 3.5 5.33 5 4.5 5zm1.5-6H-6V-6h12v5z" fill="white"/>
          </g>
        </svg>
      `;
    }
    
    const segmentWidth = signWidth / colors.length;
    let segments = '';
    
    colors.forEach((color, index) => {
      const x = signX + (index * segmentWidth);
      const isFirst = index === 0;
      const isLast = index === colors.length - 1;
      
      if (isFirst) {
        segments += `<path d="M ${x + cornerRadius} ${signY} H ${x + segmentWidth} V ${signY + signHeight} H ${x + cornerRadius} Q ${x} ${signY + signHeight} ${x} ${signY + signHeight - cornerRadius} V ${signY + cornerRadius} Q ${x} ${signY} ${x + cornerRadius} ${signY}" fill="#${color}"/>`;
      } else if (isLast) {
        segments += `<path d="M ${x} ${signY} H ${x + segmentWidth - cornerRadius} Q ${x + segmentWidth} ${signY} ${x + segmentWidth} ${signY + cornerRadius} V ${signY + signHeight - cornerRadius} Q ${x + segmentWidth} ${signY + signHeight} ${x + segmentWidth - cornerRadius} ${signY + signHeight} H ${x} V ${signY}" fill="#${color}"/>`;
      } else {
        segments += `<rect x="${x}" y="${signY}" width="${segmentWidth}" height="${signHeight}" fill="#${color}"/>`;
      }
    });
    
    const multiPoleColor = isSelected ? '#22c55e' : '#1a1f2e';
    const multiBorderColor = isSelected ? '#22c55e' : '#1a1f2e';
    
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="${poleX}" y="${signY + signHeight - 2}" width="${poleWidth}" height="${height - signHeight}" fill="${multiPoleColor}" rx="1"/>
        <rect x="${signX - 1}" y="${signY - 1}" width="${signWidth + 2}" height="${signHeight + 2}" rx="${cornerRadius + 1}" fill="${multiBorderColor}"/>
        ${segments}
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

    const stopsMap = new Map<string, { stop: Stop; routes: Route[]; tags: string[] }>();
    displayedRoutes.forEach(route => {
      route.stops.forEach(stop => {
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
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)) ${isSelected ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))' : ''};
            transition: all 0.2s ease;
            ${isSelected ? 'transform: scale(1.1);' : ''}
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
      const isSelected = selectedVehicle?.id === vehicle.id;
      const size = isSelected ? 40 : 32;
      const innerSize = isSelected ? 34 : 28;
      
      const icon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="
            position: relative;
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(${vehicle.heading}deg);
            filter: ${isSelected ? 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))' : ''};
          ">
            <div style="
              width: ${innerSize}px;
              height: ${innerSize}px;
              background-color: #${color};
              border: 3px solid ${isSelected ? '#22c55e' : '#ffffff'};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
              ${isSelected ? 'animation: pulse 2s infinite;' : ''}
            ">
              <svg width="${isSelected ? 20 : 16}" height="${isSelected ? 20 : 16}" viewBox="0 0 24 24" fill="white">
                <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
              </svg>
            </div>
            <div style="
              position: absolute;
              top: ${isSelected ? '-5px' : '-4px'};
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: ${isSelected ? '7' : '6'}px solid transparent;
              border-right: ${isSelected ? '7' : '6'}px solid transparent;
              border-bottom: ${isSelected ? '10' : '8'}px solid #${color};
            "></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([vehicle.lat, vehicle.lon], { icon })
        .on('click', () => {
          if (route) {
            onVehicleClick(vehicle, route);
          }
        });
      
      marker.addTo(vehicleMarkersRef.current!);
    });
  }, [vehicles, displayedRoutes, routes, selectedVehicle, onVehicleClick]);

  // Fit map to selected route bounds
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (selectedRoute) {
      const route = routes.find(r => r.tag === selectedRoute);
      if (route && route.paths.length > 0) {
        const allPoints: [number, number][] = [];
        route.paths.forEach(path => {
          path.forEach(point => {
            allPoints.push([point.lat, point.lon]);
          });
        });
        
        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          mapRef.current.fitBounds(bounds, {
            animate: true,
            duration: 0.5,
            padding: [50, 50],
          });
        }
      }
    } else {
      const allPoints: [number, number][] = [];
      routes.forEach(route => {
        route.paths.forEach(path => {
          path.forEach(point => {
            allPoints.push([point.lat, point.lon]);
          });
        });
      });
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        mapRef.current.fitBounds(bounds, {
          animate: true,
          duration: 0.5,
          padding: [50, 50],
        });
      }
    }
  }, [selectedRoute, routes]);

  // Helper to create building marker SVG with category icons AND abbreviation
  const createBuildingMarkerSvg = (building: CampusBuilding, isSelected: boolean): string => {
    const categories = building.categories;
    const abbr = building.abbreviation;
    const markerWidth = 44;
    const markerHeight = 28;
    const iconSize = 12;
    const bgColor = isSelected ? '#22c55e' : '#1e293b';
    const borderColor = isSelected ? '#4ade80' : '#475569';
    
    const primaryCategory = categories[0];
    const iconData = CATEGORY_ICONS[primaryCategory];
    
    // Pill shape with icon on left, abbreviation on right
    return `
      <svg width="${markerWidth}" height="${markerHeight}" viewBox="0 0 ${markerWidth} ${markerHeight}">
        <rect x="1" y="1" width="${markerWidth - 2}" height="${markerHeight - 2}" rx="${markerHeight / 2 - 1}" fill="${bgColor}" stroke="${borderColor}" stroke-width="2"/>
        <g transform="translate(7, ${(markerHeight - iconSize) / 2}) scale(${iconSize / 16})">
          <path d="${iconData.path}" fill="white"/>
        </g>
        <text x="${markerWidth / 2 + 6}" y="${markerHeight / 2 + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="9" font-weight="600" font-family="system-ui, sans-serif">${abbr}</text>
      </svg>
    `;
  };

  // Update building markers
  useEffect(() => {
    if (!buildingMarkersRef.current) return;
    buildingMarkersRef.current.clearLayers();

    CAMPUS_BUILDINGS.forEach(building => {
      const isSelected = selectedBuilding?.id === building.id;
      const markerWidth = isSelected ? 48 : 44;
      const markerHeight = isSelected ? 32 : 28;

      const icon = L.divIcon({
        className: 'custom-building-marker',
        html: `
          <div style="
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)) ${isSelected ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.6))' : ''};
            transition: all 0.2s ease;
            cursor: pointer;
            ${isSelected ? 'transform: scale(1.1);' : ''}
          ">
            ${createBuildingMarkerSvg(building, isSelected)}
          </div>
        `,
        iconSize: [markerWidth, markerHeight],
        iconAnchor: [markerWidth / 2, markerHeight / 2],
      });

      const marker = L.marker([building.lat, building.lon], { icon })
        .bindTooltip(building.name, {
          permanent: false,
          direction: 'top',
          offset: [0, -14],
          className: 'building-tooltip',
        })
        .on('click', () => onBuildingClick(building));

      marker.addTo(buildingMarkersRef.current!);
    });
  }, [selectedBuilding, onBuildingClick]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing marker
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove();
      userLocationMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            position: relative;
          ">
            <div style="
              position: absolute;
              inset: 0;
              background: rgba(59, 130, 246, 0.3);
              border-radius: 50%;
              animation: userPulse 2s ease-out infinite;
            "></div>
            <div style="
              position: absolute;
              inset: 4px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userLocationMarkerRef.current = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .bindTooltip('You are here', {
          permanent: false,
          direction: 'top',
          offset: [0, -10],
        })
        .addTo(mapRef.current);
    }
  }, [userLocation]);

  // Walking directions
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing routing control
    if (routingControlRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    if (userLocation && directionsDestination) {
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lon),
          L.latLng(directionsDestination.lat, directionsDestination.lon),
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'foot',
        }),
        lineOptions: {
          styles: [
            { color: '#3b82f6', weight: 5, opacity: 0.8 },
            { color: '#1e40af', weight: 2, opacity: 1 },
          ],
          extendToWaypoints: true,
          missingRouteTolerance: 0,
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
      } as any).addTo(mapRef.current);

      // Listen for route found event to display summary
      routingControlRef.current.on('routesfound', (e: any) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const summary = routes[0].summary;
          const distanceKm = (summary.totalDistance / 1000).toFixed(2);
          const distanceMi = (summary.totalDistance / 1609.34).toFixed(2);
          const timeMin = Math.round(summary.totalTime / 60);
          console.log(`Route found: ${distanceMi} mi (${distanceKm} km), ~${timeMin} min walk`);
        }
      });
    }
  }, [userLocation, directionsDestination]);

  // Center on selected building
  useEffect(() => {
    if (selectedBuilding && mapRef.current && !selectedStop && !selectedVehicle && !directionsDestination) {
      mapRef.current.setView([selectedBuilding.lat, selectedBuilding.lon], 17, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedBuilding, selectedStop, selectedVehicle, directionsDestination]);

  // Center on selected stop
  useEffect(() => {
    if (selectedStop && mapRef.current && !selectedVehicle) {
      mapRef.current.setView([selectedStop.lat, selectedStop.lon], 17, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedStop, selectedVehicle]);

  // Follow selected vehicle as it moves
  useEffect(() => {
    if (selectedVehicle && mapRef.current) {
      mapRef.current.setView([selectedVehicle.lat, selectedVehicle.lon], 17, {
        animate: true,
        duration: 0.3,
      });
    }
  }, [selectedVehicle?.lat, selectedVehicle?.lon]);

  // Invalidate map size when visibility changes
  useEffect(() => {
    if (isVisible && mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
});

BusMap.displayName = 'BusMap';

export default BusMap;
