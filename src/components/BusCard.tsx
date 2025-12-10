import { useEffect, useState, useRef, useMemo } from 'react';
import { VehicleLocation, Route, Stop } from '@/types/transit';
import { X, Navigation, Gauge, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusCardProps {
  vehicle: VehicleLocation;
  route: Route;
  allRoutes: Route[];
  onClose: () => void;
}

// Calculate distance between two lat/lon points in meters
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Height constants
const HEADER_HEIGHT = 150;
const INFO_ITEM_HEIGHT = 60;
const DRAG_HANDLE_HEIGHT = 48;
const MAX_HEIGHT = 60;
const CONTENT_PADDING = 32; // padding from the content area

const calculateMinHeight = (infoCount: number): number => {
  const windowHeight = window.innerHeight;
  const contentHeight = HEADER_HEIGHT + (Math.min(infoCount, 3) * INFO_ITEM_HEIGHT) + DRAG_HANDLE_HEIGHT + CONTENT_PADDING;
  return Math.min(MAX_HEIGHT, (contentHeight / windowHeight) * 100);
};

const BusCard = ({ vehicle, route, allRoutes, onClose }: BusCardProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Trigger opening animation
  useEffect(() => {
    const timer = setTimeout(() => setIsOpening(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const color = route.color === '000000' ? '6B7280' : route.color;
  const speedMph = Math.round(vehicle.speedKmHr * 0.621371);

  // Get nearest stop
  const nearestStop = useMemo(() => {
    let nearest: Stop | null = null;
    let minDistance = Infinity;
    
    for (const stop of route.stops) {
      const distance = getDistance(vehicle.lat, vehicle.lon, stop.lat, stop.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = stop;
      }
    }
    
    return nearest && minDistance < 500 ? nearest : null;
  }, [vehicle, route]);

  // Get next stop from direction
  const nextStop = useMemo(() => {
    const direction = route.directions.find(d => d.tag === vehicle.dirTag);
    if (!direction || direction.stops.length === 0) return null;
    
    let closestStopIndex = 0;
    let minDistance = Infinity;
    
    direction.stops.forEach((stopTag, index) => {
      const stop = route.stops.find(s => s.tag === stopTag);
      if (stop) {
        const distance = getDistance(vehicle.lat, vehicle.lon, stop.lat, stop.lon);
        if (distance < minDistance) {
          minDistance = distance;
          closestStopIndex = index;
        }
      }
    });
    
    const nextStopIndex = Math.min(closestStopIndex + 1, direction.stops.length - 1);
    const nextStopTag = direction.stops[nextStopIndex];
    return route.stops.find(s => s.tag === nextStopTag) || null;
  }, [vehicle, route]);

  // Info items to display
  const infoItems = [
    { label: 'Speed', value: `${speedMph} mph`, icon: Gauge },
    ...(nearestStop ? [{ label: 'At Stop', value: nearestStop.title, icon: Navigation }] : []),
    ...(nextStop && !nearestStop ? [{ label: 'Next Stop', value: nextStop.title, icon: Navigation }] : []),
  ];

  const minHeight = calculateMinHeight(infoItems.length);

  useEffect(() => {
    if (!isDragging && panelHeight === null) {
      setPanelHeight(minHeight);
    }
  }, [infoItems.length, isDragging, minHeight, panelHeight]);

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = panelHeight || minHeight;
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartY.current;
      const windowHeight = window.innerHeight;
      const deltaPercent = (deltaY / windowHeight) * 100;
      
      const newHeight = Math.min(MAX_HEIGHT, Math.max(minHeight, dragStartHeight.current + deltaPercent));
      setPanelHeight(newHeight);
    };

    const handleDragEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      
      const midPoint = (minHeight + MAX_HEIGHT) / 2;
      if ((panelHeight || minHeight) > midPoint) {
        setPanelHeight(MAX_HEIGHT);
      } else {
        setPanelHeight(minHeight);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, panelHeight, minHeight]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  return (
    <>
      {/* Backdrop - transparent click target, no visual overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-[999]",
          isClosing && "pointer-events-none"
        )}
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className={cn(
          "fixed top-0 left-0 right-0 bg-card border-b border-border rounded-b-2xl shadow-2xl z-[1000] flex flex-col",
          isClosing ? "-translate-y-full" : isOpening ? "-translate-y-full" : "translate-y-0"
        )}
        style={{ 
          height: `${panelHeight || minHeight}vh`,
          transition: isDragging ? 'none' : 'height 0.2s ease-out, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `#${color}` }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Bus #{vehicle.id}
                </h3>
                <span 
                  className="text-sm px-2 py-0.5 rounded-md"
                  style={{ 
                    backgroundColor: `#${color}30`,
                    color: `#${color}`
                  }}
                >
                  {route.title}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              <span>Heading: {Math.round(vehicle.heading)}°</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Updated {vehicle.secsSinceReport}s ago</span>
            </div>
          </div>
        </div>

        {/* Info content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {infoItems.map((item, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `#${color}30` }}
                  >
                    <item.icon className="w-4 h-4" style={{ color: `#${color}` }} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-medium text-sm">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Drag handle */}
        <div 
          className="flex-shrink-0 py-3 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </>
  );
};

export default BusCard;
