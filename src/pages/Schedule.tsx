import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route, VehicleLocation } from '@/types/transit';
import { fetchRouteConfig, fetchVehicleLocations } from '@/lib/api';
import { ArrowLeft, Bus, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Schedule = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

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

  const getRouteVehicles = (routeTag: string) => {
    return vehicles.filter(v => v.routeTag === routeTag);
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
                  {routeVehicles.length > 0 ? (
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

              {/* Directions */}
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

              {/* Active buses */}
              {routeVehicles.length > 0 && (
                <div className="border-t border-border p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Bus className="w-4 h-4" />
                    Active Buses
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {routeVehicles.map(vehicle => (
                      <div 
                        key={vehicle.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm"
                      >
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: `#${color}` }}
                        />
                        Bus {vehicle.id}
                        <span className="text-xs text-muted-foreground">
                          {Math.round(vehicle.speedKmHr)} km/h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Schedule;
