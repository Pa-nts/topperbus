import { useEffect, useState, useMemo, useRef } from 'react';
import { Stop, Route, StopPredictions, Prediction, VehicleLocation } from '@/types/transit';
import { fetchPredictions, fetchVehicleLocations } from '@/lib/api';
import { Clock, MapPin, X, RefreshCw, Bus, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCurrentBreakPeriod, formatBreakDates } from '@/lib/academicCalendar';

interface StopCardProps {
  stop: Stop;
  route: Route;
  allRoutes: Route[];
  onClose: () => void;
}

interface FlatPrediction {
  prediction: Prediction;
  routeTag: string;
  routeTitle: string;
  routeColor: string;
  directionTitle: string;
}

// Calculate distance between two lat/lon points in meters
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Route operating hours (in 24-hour format, Central Time)
const ROUTE_SCHEDULES: Record<string, { startHour: number; startMin: number; endHour: number; endMin: number }> = {
  'red': { startHour: 7, startMin: 30, endHour: 17, endMin: 30 },   // Campus Circulator: 7:30 AM - 5:30 PM
  'white': { startHour: 7, startMin: 15, endHour: 17, endMin: 24 }, // South Campus: 7:15 AM - 5:24 PM
  'blue': { startHour: 7, startMin: 20, endHour: 17, endMin: 30 },  // Kentucky Street: 7:20 AM - 5:30 PM
};

const isRouteInService = (routeTag: string): boolean => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // No service on weekends
  if (day === 0 || day === 6) return false;
  
  const schedule = ROUTE_SCHEDULES[routeTag];
  if (!schedule) return true; // Default to showing if unknown route
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = schedule.startHour * 60 + schedule.startMin;
  const endMinutes = schedule.endHour * 60 + schedule.endMin;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// Height constants based on content
const HEADER_HEIGHT = 160; // approx header height in pixels
const PREDICTION_ITEM_HEIGHT = 64; // approx height per prediction item (reduced)
const DRAG_HANDLE_HEIGHT = 36; // drag handle height
const MAX_HEIGHT = 75; // percentage
const NO_ARRIVALS_HEIGHT = 100; // height for no arrivals message
const OUT_OF_SERVICE_HEIGHT = 100; // height for out of service warning

// Calculate dynamic minimum height based on number of predictions (show up to 3)
const calculateMinHeight = (predCount: number, hasRouteFilters: boolean, hasOutOfServiceRoutes: boolean): number => {
  const windowHeight = window.innerHeight;
  const itemsToShow = Math.min(predCount, 3);
  const filterHeight = hasRouteFilters ? 40 : 0;
  const baseHeader = HEADER_HEIGHT + filterHeight;
  
  if (predCount === 0) {
    const outOfServiceHeight = hasOutOfServiceRoutes ? OUT_OF_SERVICE_HEIGHT : 0;
    return Math.min(MAX_HEIGHT, ((baseHeader + outOfServiceHeight + NO_ARRIVALS_HEIGHT + DRAG_HANDLE_HEIGHT) / windowHeight) * 100);
  }
  
  const contentHeight = baseHeader + (itemsToShow * PREDICTION_ITEM_HEIGHT) + DRAG_HANDLE_HEIGHT;
  return Math.min(MAX_HEIGHT, (contentHeight / windowHeight) * 100);
};

const StopCard = ({ stop, route, allRoutes, onClose }: StopCardProps) => {
  const [predictions, setPredictions] = useState<StopPredictions[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string | null>(null);
  const [routesAtStop, setRoutesAtStop] = useState<Route[]>([]);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const [dragTranslateY, setDragTranslateY] = useState(0);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Trigger opening animation
  useEffect(() => {
    const timer = setTimeout(() => setIsOpening(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const stopLocationKey = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
      const routesWithStop = allRoutes.filter(r => 
        r.stops.some(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}` === stopLocationKey)
      );
      setRoutesAtStop(routesWithStop);
      
      const allPreds: StopPredictions[] = [];
      for (const r of routesWithStop) {
        const routeStop = r.stops.find(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}` === stopLocationKey);
        if (routeStop) {
          const preds = await fetchPredictions(routeStop.tag, r.tag);
          allPreds.push(...preds);
        }
      }
      
      const vehicleData = await fetchVehicleLocations();
      setVehicles(vehicleData);
      
      setPredictions(allPreds);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [stop.tag]);

  // Check which routes at this stop are currently in service
  const routesInService = useMemo(() => {
    return routesAtStop.filter(r => isRouteInService(r.tag));
  }, [routesAtStop]);

  const routesOutOfService = useMemo(() => {
    return routesAtStop.filter(r => !isRouteInService(r.tag));
  }, [routesAtStop]);

  // Flatten and sort all predictions by time (only from routes in service)
  const sortedPredictions = useMemo(() => {
    const flat: FlatPrediction[] = [];
    
    predictions.forEach(pred => {
      // Skip predictions from routes not in service
      if (!isRouteInService(pred.routeTag)) return;
      
      if (selectedRouteFilter && pred.routeTag !== selectedRouteFilter) return;
      
      const predRoute = allRoutes.find(r => r.tag === pred.routeTag);
      const color = predRoute?.color === '000000' ? '6B7280' : predRoute?.color || '6B7280';
      
      pred.directions.forEach(dir => {
        dir.predictions.forEach(p => {
          flat.push({
            prediction: p,
            routeTag: pred.routeTag,
            routeTitle: pred.routeTitle,
            routeColor: color,
            directionTitle: dir.title,
          });
        });
      });
    });
    
    return flat.sort((a, b) => a.prediction.minutes - b.prediction.minutes);
  }, [predictions, allRoutes, selectedRouteFilter]);

  // Calculate minimum height based on predictions and whether filters are shown
  const hasRouteFilters = routesInService.length > 1;
  const hasOutOfServiceRoutes = routesOutOfService.length > 0;
  const minHeight = calculateMinHeight(sortedPredictions.length, hasRouteFilters, hasOutOfServiceRoutes);

  // Update panel height when predictions change
  useEffect(() => {
    if (!isDragging) {
      setPanelHeight(minHeight);
    }
  }, [sortedPredictions.length, hasRouteFilters, isDragging, minHeight]);

  // Drag handlers - tracks Y position for swipe-to-dismiss with smooth animation
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = panelHeight || minHeight;
    setDragTranslateY(0);
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartY.current;
      
      // If dragging up (negative deltaY), translate the panel up
      if (deltaY < 0) {
        setDragTranslateY(deltaY);
        return;
      }
      
      // Reset translate if dragging down
      setDragTranslateY(0);
      
      const windowHeight = window.innerHeight;
      const deltaPercent = (deltaY / windowHeight) * 100;
      
      const newHeight = Math.min(MAX_HEIGHT, Math.max(minHeight, dragStartHeight.current + deltaPercent));
      setPanelHeight(newHeight);
    };

    const handleDragEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      
      // If swiped up significantly, close the panel
      if (dragTranslateY < -50) {
        handleClose();
        return;
      }
      
      // Reset translate
      setDragTranslateY(0);
      
      // Snap to nearest point
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
  }, [isDragging, panelHeight, minHeight, dragTranslateY]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const getNearestStopForBus = (vehicleId: string, routeTag: string): string | null => {
    const vehicle = vehicles.find(v => v.id === vehicleId && v.routeTag === routeTag);
    if (!vehicle) return null;
    
    const busRoute = allRoutes.find(r => r.tag === routeTag);
    if (!busRoute || busRoute.stops.length === 0) return null;
    
    let nearestStop: Stop | null = null;
    let minDistance = Infinity;
    
    for (const routeStop of busRoute.stops) {
      const distance = getDistance(vehicle.lat, vehicle.lon, routeStop.lat, routeStop.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = routeStop;
      }
    }
    
    if (nearestStop && minDistance < 500) {
      return nearestStop.title;
    }
    
    return null;
  };

  const formatClockTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getArrivalTimeRange = (minutes: number): { clock: string; relative: string } => {
    if (minutes === 0) return { clock: 'Now', relative: 'Now' };
    
    const now = new Date();
    const minTime = Math.max(0, minutes - 2);
    const maxTime = minutes + 2;
    
    const earlyTime = new Date(now.getTime() + minTime * 60000);
    const lateTime = new Date(now.getTime() + maxTime * 60000);
    
    return {
      clock: `${formatClockTime(earlyTime)} - ${formatClockTime(lateTime)}`,
      relative: `${minTime}-${maxTime} min`
    };
  };

  const getTimeColor = (minutes: number) => {
    if (minutes <= 1) return 'text-transit-now';
    if (minutes <= 5) return 'text-transit-soon';
    return 'text-foreground';
  };

  const getTimeBg = (minutes: number, isFirst: boolean) => {
    if (isFirst) return 'bg-green-500/20 ring-2 ring-green-500';
    if (minutes <= 1) return 'bg-transit-now/20';
    if (minutes <= 5) return 'bg-transit-soon/20';
    return 'bg-secondary';
  };

  return (
    <>
      
      {/* Panel */}
      <div 
        ref={panelRef}
        className={cn(
          "fixed top-0 left-0 right-0 bg-card border-b border-border rounded-b-2xl shadow-2xl z-[1000] flex flex-col",
          isClosing ? "-translate-y-full" : isOpening ? "-translate-y-full" : ""
        )}
        style={{ 
          height: `${panelHeight || minHeight}vh`,
          transform: isClosing ? undefined : isOpening ? undefined : `translateY(${dragTranslateY}px)`,
          transition: isDragging ? 'none' : 'height 0.2s ease-out, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex -space-x-1">
                  {routesAtStop.length > 0 ? (
                    routesAtStop.map(r => (
                      <span
                        key={r.tag}
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-card"
                        style={{ backgroundColor: `#${r.color === '000000' ? '6B7280' : r.color}` }}
                      />
                    ))
                  ) : (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `#${route.color === '000000' ? '6B7280' : route.color}` }}
                    />
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Stop {stop.stopId}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground truncate">
                {stop.shortTitle || stop.title}
              </h3>
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
              <MapPin className="w-3 h-3" />
              <span>{stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}</span>
            </div>
            <button
              onClick={fetchAllData}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </button>
          </div>
          
          {/* Route filter - only show routes in service */}
          {routesInService.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                onClick={() => setSelectedRouteFilter(null)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  selectedRouteFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                All Routes
              </button>
              {routesInService.map(r => {
                const color = r.color === '000000' ? '6B7280' : r.color;
                const isSelected = selectedRouteFilter === r.tag;
                return (
                  <button
                    key={r.tag}
                    onClick={() => setSelectedRouteFilter(r.tag)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
                      isSelected
                        ? "ring-2 ring-offset-1 ring-offset-card"
                        : "hover:opacity-80"
                    )}
                    style={{ 
                      backgroundColor: isSelected ? `#${color}` : `#${color}30`,
                      color: isSelected ? 'white' : `#${color}`,
                      ...(isSelected && { '--tw-ring-color': `#${color}` } as React.CSSProperties)
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? 'white' : `#${color}` }} />
                    {r.title.replace('Route ', '').split(' ')[0]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Predictions */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && predictions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading arrivals...</span>
              </div>
            </div>
          ) : sortedPredictions.length === 0 ? (
            <div className="py-4">
              {/* Show routes that are out of service - at top */}
              {routesOutOfService.length > 0 && (() => {
                const breakPeriod = getCurrentBreakPeriod();
                return (
                  <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left">
                    <p className="text-xs text-amber-200/90 mb-1.5 font-medium">
                      {breakPeriod 
                        ? `Service suspended for ${breakPeriod.name} (${formatBreakDates(breakPeriod)})`
                        : 'Routes not currently in service:'
                      }
                    </p>
                    {!breakPeriod && routesOutOfService.map(r => {
                      const schedule = ROUTE_SCHEDULES[r.tag];
                      const color = r.color === '000000' ? '6B7280' : r.color;
                      return (
                        <div key={r.tag} className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: `#${color}` }} 
                          />
                          <span>{r.title}</span>
                          {schedule && (
                            <span className="text-amber-400/80">
                              ({schedule.startHour > 12 ? schedule.startHour - 12 : schedule.startHour}:{schedule.startMin.toString().padStart(2, '0')} {schedule.startHour >= 12 ? 'PM' : 'AM'} - {schedule.endHour > 12 ? schedule.endHour - 12 : schedule.endHour}:{schedule.endMin.toString().padStart(2, '0')} PM)
                            </span>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {breakPeriod 
                        ? 'WKU Transit operates Mon-Fri during Fall & Spring semesters only.'
                        : 'Service runs Mon-Fri during Fall & Spring semesters'
                      }
                    </p>
                  </div>
                );
              })()}
              
              <div className="text-center">
                <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-sm text-muted-foreground">No upcoming arrivals</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPredictions.map((item, i) => {
                const nearestStop = getNearestStopForBus(item.prediction.vehicle, item.routeTag);
                const isFirst = i === 0;
                
                return (
                  <div
                    key={`${item.routeTag}-${item.prediction.vehicle}-${i}`}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      getTimeBg(item.prediction.minutes, isFirst)
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div 
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `#${item.routeColor}` }}
                        >
                          <Bus className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm whitespace-nowrap">
                              Bus #{item.prediction.vehicle}
                            </span>
                            <span 
                              className="text-xs px-1.5 py-0.5 rounded truncate max-w-[80px]"
                              style={{ 
                                backgroundColor: `#${item.routeColor}30`,
                                color: `#${item.routeColor}`
                              }}
                            >
                              {item.routeTitle.replace('Route ', '')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                            <Navigation className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {nearestStop ? `At: ${nearestStop}` : `To: ${item.directionTitle}`}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "text-right flex-shrink-0 whitespace-nowrap",
                        getTimeColor(item.prediction.minutes)
                      )}>
                        {item.prediction.minutes === 0 ? (
                          <div className="text-lg font-bold">NOW</div>
                        ) : (
                          <>
                            <div className="text-xs font-bold">
                              {getArrivalTimeRange(item.prediction.minutes).clock}
                            </div>
                            <div className="text-xs opacity-70">
                              {getArrivalTimeRange(item.prediction.minutes).relative}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Drag handle - always visible for resizing */}
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

export default StopCard;
