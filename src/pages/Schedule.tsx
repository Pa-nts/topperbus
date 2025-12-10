import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route, VehicleLocation, StopPredictions } from '@/types/transit';
import { fetchRouteConfig, fetchVehicleLocations, fetchPredictions } from '@/lib/api';
import { ArrowLeft, Bus, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusJourneyStop {
  tag: string;
  title: string;
  stopId: string;
  estimatedMinutes: number | null;
  isCurrent: boolean;
}

// Route operating hours (in 24-hour format)
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

const Schedule = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [busPredictions, setBusPredictions] = useState<Map<string, StopPredictions[]>>(new Map());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [routeData, vehicleData] = await Promise.all([
          fetchRouteConfig(),
          fetchVehicleLocations(),
        ]);
        setRoutes(routeData);
        setVehicles(vehicleData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Refresh vehicles periodically
    const interval = setInterval(async () => {
      try {
        const vehicleData = await fetchVehicleLocations();
        setVehicles(vehicleData);
      } catch (error) {
        console.error('Error refreshing vehicles:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Fetch predictions for stops along each bus's route
  useEffect(() => {
    const fetchBusPredictions = async () => {
      const newPredictions = new Map<string, StopPredictions[]>();
      
      for (const vehicle of vehicles) {
        const route = routes.find(r => r.tag === vehicle.routeTag);
        if (!route) continue;
        
        const direction = route.directions.find(d => d.tag === vehicle.dirTag);
        if (!direction || direction.stops.length === 0) continue;
        
        // Fetch predictions for first few stops to get timing info
        try {
          const stopTag = direction.stops[0];
          const preds = await fetchPredictions(stopTag, route.tag);
          newPredictions.set(`${vehicle.id}-${route.tag}`, preds);
        } catch (error) {
          console.error('Error fetching predictions:', error);
        }
      }
      
      setBusPredictions(newPredictions);
    };
    
    if (vehicles.length > 0 && routes.length > 0) {
      fetchBusPredictions();
    }
  }, [vehicles, routes]);

  const getRouteVehicles = (routeTag: string) => {
    return vehicles.filter(v => v.routeTag === routeTag);
  };

  const getBusJourney = (vehicle: VehicleLocation, route: Route): BusJourneyStop[] => {
    const direction = route.directions.find(d => d.tag === vehicle.dirTag);
    if (!direction || direction.stops.length === 0) return [];
    
    // Find the closest stop to the bus's current position (current stop)
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
    
    // Build journey from current stop through remaining stops
    const journeyStops: BusJourneyStop[] = [];
    const totalStops = direction.stops.length;
    
    // Calculate average time per stop (roughly 2-3 minutes between stops)
    const avgMinutesPerStop = 2.5;
    
    for (let i = 0; i < totalStops; i++) {
      const actualIndex = (closestStopIndex + i) % totalStops;
      const stopTag = direction.stops[actualIndex];
      const stop = route.stops.find(s => s.tag === stopTag);
      
      if (stop) {
        let estimatedMinutes: number | null = null;
        
        if (i === 0) {
          // Current stop
          estimatedMinutes = 0;
        } else {
          // Estimate based on position in route
          estimatedMinutes = Math.round(i * avgMinutesPerStop);
        }
        
        journeyStops.push({
          tag: stop.tag,
          title: stop.title,
          stopId: stop.stopId,
          estimatedMinutes,
          isCurrent: i === 0,
        });
      }
    }
    
    return journeyStops;
  };

  const formatClockTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatTimeRange = (minutes: number | null): { clock: string; relative: string } => {
    if (minutes === null) return { clock: '--', relative: '--' };
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

  const displayedRoutes = selectedRoute 
    ? routes.filter(r => r.tag === selectedRoute)
    : routes;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Bus className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-4">
            <Link 
              to="/" 
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Route Schedule</h1>
              <p className="text-xs text-muted-foreground">View routes and stops</p>
            </div>
          </div>

          {/* Route filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setSelectedRoute(null)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                !selectedRoute
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              All Routes
            </button>
            {routes.map(route => {
              const busCount = getRouteVehicles(route.tag).length;
              return (
                <button
                  key={route.tag}
                  onClick={() => setSelectedRoute(route.tag)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2",
                    selectedRoute === route.tag
                      ? "text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                  style={{
                    backgroundColor: selectedRoute === route.tag 
                      ? `#${route.color === '000000' ? '6B7280' : route.color}`
                      : undefined
                  }}
                >
                  {route.title}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs",
                    selectedRoute === route.tag 
                      ? "bg-white/20"
                      : busCount > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {busCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Routes */}
      <div className="p-4 space-y-6">
        {displayedRoutes.map(route => {
          const routeVehicles = getRouteVehicles(route.tag);
          const color = route.color === '000000' ? '6B7280' : route.color;
          
          return (
            <div key={route.tag} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Route header */}
              <div 
                className="p-4 flex items-center justify-between"
                style={{ backgroundColor: `#${color}15` }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `#${color}` }}
                  >
                    <Bus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{route.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {route.stops.length} stops • {route.directions.length} directions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isRouteInService(route.tag) ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-sm">
                      <Clock className="w-4 h-4" />
                      Outside Hours
                    </span>
                  ) : routeVehicles.length > 0 ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {routeVehicles.length} Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      No Service
                    </span>
                  )}
                </div>
              </div>

              {/* Operating Hours */}
              {(() => {
                // Route-specific operating hours
                const scheduleData: Record<string, { 
                  firstBus: string; 
                  lastBus: string; 
                  frequency: { time: string; freq: string }[];
                  startStop: string;
                }> = {
                  'red': { // Campus Circulator
                    firstBus: '7:30 AM',
                    lastBus: '5:30 PM',
                    frequency: [
                      { time: '7:30AM - 10:35AM', freq: '18 min' },
                      { time: '10:35AM - 2:50PM', freq: '20 min' },
                      { time: '2:50PM - 5:21PM', freq: '39 min' },
                    ],
                    startStop: 'Russellville Rd West Lot',
                  },
                  'white': { // South Campus
                    firstBus: '7:15 AM',
                    lastBus: '5:24 PM',
                    frequency: [
                      { time: '7:15AM - 3:00PM', freq: '17 min' },
                      { time: '3:00PM - 5:24PM', freq: '35 min' },
                    ],
                    startStop: 'Campbell Lane Park & Ride',
                  },
                  'blue': { // Kentucky Street
                    firstBus: '7:20 AM',
                    lastBus: '5:30 PM',
                    frequency: [
                      { time: '7:20AM - 3:30PM', freq: '15 min' },
                      { time: '3:30PM - 5:30PM', freq: '30 min' },
                    ],
                    startStop: 'Parking Structure 3',
                  },
                };
                
                const schedule = scheduleData[route.tag] || {
                  firstBus: '7:00 AM',
                  lastBus: '5:30 PM',
                  frequency: [],
                  startStop: 'Main Campus',
                };
                
                return (
                  <div className="border-t border-border p-4 bg-secondary/20">
                    <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Operating Hours
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="rounded-lg bg-card p-3 border border-border">
                        <p className="text-xs text-muted-foreground mb-1">First Bus</p>
                        <p className="font-semibold text-green-400">{schedule.firstBus}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {schedule.startStop}
                        </p>
                      </div>
                      <div className="rounded-lg bg-card p-3 border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Last Bus</p>
                        <p className="font-semibold text-amber-400">{schedule.lastBus}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          End of service
                        </p>
                      </div>
                    </div>
                    
                    {schedule.frequency.length > 0 && (
                      <div className="rounded-lg bg-card p-3 border border-border mb-3">
                        <p className="text-xs text-muted-foreground mb-2">Service Frequency</p>
                        <div className="space-y-1">
                          {schedule.frequency.map((f, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{f.time}</span>
                              <span className="font-medium">{f.freq}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground text-center">
                      Monday - Friday during Fall & Spring semesters • No service during Intersession or Holidays
                    </p>
                  </div>
                );
              })()}

              {/* Active buses - only show if route is in service */}
              {isRouteInService(route.tag) && routeVehicles.length > 0 && (
                <div className="border-b border-border p-4 space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Bus className="w-4 h-4" />
                    Active Buses
                  </h3>
                  {routeVehicles.map(vehicle => {
                    const speedMph = Math.round(vehicle.speedKmHr * 0.621371);
                    const journey = getBusJourney(vehicle, route);
                    const currentStop = journey.find(s => s.isCurrent);
                    
                    return (
                      <div 
                        key={vehicle.id}
                        className="rounded-lg bg-secondary/50 overflow-hidden"
                      >
                        {/* Bus header */}
                        <div className="px-4 py-3 flex items-center justify-between bg-secondary">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: `#${color}` }}
                            >
                              {vehicle.id}
                            </div>
                            <div>
                              <span className="font-semibold">Bus {vehicle.id}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {speedMph} mph
                              </span>
                            </div>
                          </div>
                          {currentStop && (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Currently at</p>
                              <p className="text-sm font-medium text-primary truncate max-w-[150px]">
                                {currentStop.title}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Journey stops */}
                        <div className="relative px-4 py-2 max-h-[300px] overflow-y-auto">
                          <div 
                            className="absolute left-7 top-0 bottom-0 w-0.5"
                            style={{ backgroundColor: `#${color}40` }}
                          />
                          {journey.map((stop, index) => (
                            <Link
                              key={`${vehicle.id}-${stop.tag}-${index}`}
                              to={`/?stop=${stop.stopId}`}
                              className={cn(
                                "flex items-center gap-3 py-2 relative transition-colors hover:bg-secondary/50 rounded",
                                stop.isCurrent && "bg-primary/10"
                              )}
                            >
                              <div 
                                className={cn(
                                  "w-3 h-3 rounded-full border-2 z-10",
                                  stop.isCurrent ? "bg-primary border-primary" : "bg-background"
                                )}
                                style={{ borderColor: stop.isCurrent ? undefined : `#${color}` }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm truncate",
                                  stop.isCurrent && "font-semibold text-primary"
                                )}>
                                  {stop.title}
                                </p>
                              </div>
                              <div className={cn(
                                "text-xs px-2 py-1 rounded-lg whitespace-nowrap text-right",
                                stop.isCurrent 
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {stop.isCurrent ? (
                                  <span>Now</span>
                                ) : (
                                  <>
                                    <div className="font-medium">{formatTimeRange(stop.estimatedMinutes).clock}</div>
                                    <div className="opacity-70">{formatTimeRange(stop.estimatedMinutes).relative}</div>
                                  </>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                        
                        <div className="px-4 py-2 bg-muted/30 border-t border-border">
                          <p className="text-xs text-muted-foreground text-center">
                            Times are estimates with ±2 minute margin
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Directions / Full schedule */}
              {route.directions.filter(d => d.useForUI).map(direction => (
                <div key={direction.tag} className="border-t border-border">
                  <div className="px-4 py-3 bg-secondary/30">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {direction.title}
                    </h3>
                  </div>
                  
                  {/* Stop list */}
                  <div className="relative">
                    <div 
                      className="absolute left-7 top-0 bottom-0 w-0.5"
                      style={{ backgroundColor: `#${color}30` }}
                    />
                    <div className="py-2">
                      {direction.stops.map((stopTag, index) => {
                        const stop = route.stops.find(s => s.tag === stopTag);
                        if (!stop) return null;
                        
                        return (
                          <Link
                            key={`${direction.tag}-${stopTag}-${index}`}
                            to={`/?stop=${stop.stopId}`}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/50 transition-colors relative"
                          >
                            <div 
                              className="w-3 h-3 rounded-full border-2 bg-background z-10"
                              style={{ borderColor: `#${color}` }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{stop.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Stop #{stop.stopId}
                              </p>
                            </div>
                            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Schedule;
