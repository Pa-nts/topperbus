import { useEffect, useState, useMemo } from 'react';
import { Stop, Route, StopPredictions, Prediction, VehicleLocation } from '@/types/transit';
import { fetchPredictions, fetchVehicleLocations } from '@/lib/api';
import { Clock, MapPin, X, RefreshCw, Bus, Navigation, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StopCardProps {
  stop: Stop;
  route: Route;
  allRoutes: Route[];
  onClose: () => void;
  isClosing?: boolean;
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

const StopCard = ({ stop, route, allRoutes, onClose, isClosing = false }: StopCardProps) => {
  const [predictions, setPredictions] = useState<StopPredictions[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string | null>(null);
  const [routesAtStop, setRoutesAtStop] = useState<Route[]>([]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Find all routes that have a stop at this location (using coordinate matching)
      const stopLocationKey = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
      const routesWithStop = allRoutes.filter(r => 
        r.stops.some(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}` === stopLocationKey)
      );
      setRoutesAtStop(routesWithStop);
      
      const allPreds: StopPredictions[] = [];
      for (const r of routesWithStop) {
        // Find the stop tag for this route at this location
        const routeStop = r.stops.find(s => `${s.lat.toFixed(4)},${s.lon.toFixed(4)}` === stopLocationKey);
        if (routeStop) {
          const preds = await fetchPredictions(routeStop.tag, r.tag);
          allPreds.push(...preds);
        }
      }
      
      // Fetch vehicle locations
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

  // Flatten and sort all predictions by time
  const sortedPredictions = useMemo(() => {
    const flat: FlatPrediction[] = [];
    
    predictions.forEach(pred => {
      // Filter by selected route if set
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

  // Find the nearest stop to a bus's current location
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
    
    // Only return if within 500 meters of a stop
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
      {/* Backdrop - no blur to keep map visible */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/40 z-[999]",
          isClosing ? "animate-fade-out" : "animate-fade-in"
        )}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className={cn(
          "fixed top-0 left-0 right-0 bg-card border-b border-border rounded-b-2xl shadow-2xl z-[1000] max-h-[70vh] flex flex-col",
          isClosing ? "animate-slide-up-out" : "animate-slide-down"
        )}
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
              onClick={onClose}
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
          
          {/* Route filter */}
          {routesAtStop.length > 1 && (
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
              {routesAtStop.map(r => {
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
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No upcoming arrivals</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedPredictions.slice(0, 8).map((item, i) => {
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `#${item.routeColor}` }}
                        >
                          <Bus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              Bus #{item.prediction.vehicle}
                            </span>
                            <span 
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ 
                                backgroundColor: `#${item.routeColor}30`,
                                color: `#${item.routeColor}`
                              }}
                            >
                              {item.routeTitle}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            {nearestStop ? `At: ${nearestStop}` : `Heading to: ${item.directionTitle}`}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "text-right",
                        getTimeColor(item.prediction.minutes)
                      )}>
                        {item.prediction.minutes === 0 ? (
                          <div className="text-lg font-bold">NOW</div>
                        ) : (
                          <>
                            <div className="text-sm font-bold">
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
        
        {/* Pull indicator */}
        <div className="flex-shrink-0 py-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
    </>
  );
};

export default StopCard;