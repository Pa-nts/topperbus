import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Route, VehicleLocation, Stop } from '@/types/transit';
import { fetchRouteConfig, fetchVehicleLocations } from '@/lib/api';
import BusMap from '@/components/BusMap';
import BusCard from '@/components/BusCard';
import RouteSelector from '@/components/RouteSelector';
import StopCard from '@/components/StopCard';
import StopList from '@/components/StopList';
import QRScanner from '@/components/QRScanner';
import RouteLegend from '@/components/RouteLegend';
import BuildingCard from '@/components/BuildingCard';
import { CampusBuilding } from '@/lib/campusBuildings';
import { Bus, ScanLine, List, Map as MapIcon, RefreshCw, Calendar, AlertTriangle, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getCurrentBreakPeriod, formatBreakDates } from '@/lib/academicCalendar';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedStopRoute, setSelectedStopRoute] = useState<Route | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLocation | null>(null);
  const [selectedVehicleRoute, setSelectedVehicleRoute] = useState<Route | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [stopSearch, setStopSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState<CampusBuilding | null>(null);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      try {
        const routeData = await fetchRouteConfig();
        setRoutes(routeData);
        
        const vehicleData = await fetchVehicleLocations();
        setVehicles(vehicleData);
        
        // Check for stop param in URL
        const stopParam = searchParams.get('stop');
        if (stopParam && routeData.length > 0) {
          selectStopById(stopParam, routeData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load bus data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Refresh vehicle locations periodically and update selected vehicle position
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const vehicleData = await fetchVehicleLocations();
        setVehicles(vehicleData);
        
        // Update selected vehicle with new position
        if (selectedVehicle) {
          const updatedVehicle = vehicleData.find(v => v.id === selectedVehicle.id);
          if (updatedVehicle) {
            setSelectedVehicle(updatedVehicle);
          }
        }
      } catch (error) {
        console.error('Error refreshing vehicles:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedVehicle?.id]);

  const selectStopById = (stopId: string, routeData: Route[] = routes) => {
    for (const route of routeData) {
      const stop = route.stops.find(s => s.stopId === stopId || s.tag === stopId);
      if (stop) {
        openStop(stop, route);
        return;
      }
    }
    toast.error('Stop not found');
  };

  const openStop = useCallback((stop: Stop, route: Route, shouldSwitchToMap: boolean = false) => {
    setSelectedStop(stop);
    setSelectedStopRoute(route);
    setSearchParams({ stop: stop.stopId });
    if (shouldSwitchToMap) {
      setView('map');
    }
  }, [setSearchParams]);

  const handleStopClick = useCallback((stop: Stop, route: Route) => {
    // Capture current view state immediately
    const shouldSwitchToMap = view === 'list';
    
    // Switch to map immediately if needed
    if (shouldSwitchToMap) {
      setView('map');
    }
    
    openStop(stop, route, false);
  }, [view, openStop]);

  const handleCloseStop = useCallback(() => {
    setSelectedStop(null);
    setSelectedStopRoute(null);
    setSearchParams({});
  }, [setSearchParams]);

  const handleVehicleClick = useCallback((vehicle: VehicleLocation, route: Route) => {
    setSelectedVehicle(vehicle);
    setSelectedVehicleRoute(route);
    // Close stop card if open
    setSelectedStop(null);
    setSelectedStopRoute(null);
  }, []);

  const handleCloseVehicle = useCallback(() => {
    setSelectedVehicle(null);
    setSelectedVehicleRoute(null);
  }, []);

  const handleBuildingClick = useCallback((building: CampusBuilding) => {
    setSelectedBuilding(building);
    // Close other cards
    setSelectedStop(null);
    setSelectedStopRoute(null);
    setSelectedVehicle(null);
    setSelectedVehicleRoute(null);
  }, []);

  const handleCloseBuilding = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const handleQRScan = (stopId: string) => {
    setShowScanner(false);
    selectStopById(stopId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [routeData, vehicleData] = await Promise.all([
        fetchRouteConfig(),
        fetchVehicleLocations(),
      ]);
      setRoutes(routeData);
      setVehicles(vehicleData);
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsLocating(false);
        toast.success('Location found');
      },
      (error) => {
        setIsLocating(false);
        toast.error('Unable to get your location');
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleGetDirections = useCallback((building: CampusBuilding) => {
    if (!userLocation) {
      toast.error('Please enable location first');
      return;
    }
    setDirectionsDestination(building);
    setSelectedBuilding(building);
    setView('map');
    toast.success(`Getting directions to ${building.name}`);
  }, [userLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Bus className="w-12 h-12 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading WKU Transit...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">WKU Transit</h1>
                <p className="text-xs text-muted-foreground">
                  Live tracking
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link
                to="/feedback"
                className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                title="Feedback"
              >
                <MessageSquare className="w-5 h-5" />
              </Link>
              <Link
                to="/schedule"
                className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                title="Schedule"
              >
                <Calendar className="w-5 h-5" />
              </Link>
              <button
                onClick={handleRefresh}
                className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ScanLine className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <RouteSelector
            routes={routes}
            vehicles={vehicles}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
          />
          
          {/* Dynamic route warning for routes with no active buses */}
          {(() => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const currentTime = hours * 60 + minutes;
            
            // Check for school break first
            const breakPeriod = getCurrentBreakPeriod();
            
            // Service hours: Mon-Fri, roughly 7:15 AM - 5:30 PM
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const serviceStart = 7 * 60 + 15; // 7:15 AM
            const serviceEnd = 17 * 60 + 30; // 5:30 PM
            const isOutsideHours = currentTime < serviceStart || currentTime > serviceEnd;
            
            const inactiveRoutes = routes.filter(r => 
              !vehicles.some(v => v.routeTag === r.tag)
            );
            
            // School break takes priority
            if (breakPeriod) {
              return (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90">
                    <span className="font-medium">Note:</span> Buses are out of service for {breakPeriod.name} ({formatBreakDates(breakPeriod)}). WKU Transit operates Mon-Fri during Fall & Spring semesters only.
                  </p>
                </div>
              );
            }
            
            // Weekend message
            if (isWeekend) {
              return (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90">
                    <span className="font-medium">Note:</span> Buses are out of service. WKU Transit operates Monday - Friday only.
                  </p>
                </div>
              );
            }
            
            // Outside hours message
            if (isOutsideHours && inactiveRoutes.length === routes.length) {
              return (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200/90">
                    <span className="font-medium">Note:</span> Buses are out of service for the day. Service hours are Mon-Fri, 7:15 AM - 5:30 PM.
                  </p>
                </div>
              );
            }
            
            if (inactiveRoutes.length === 0) return null;
            
            // Check if Kentucky Street route is among the inactive routes
            const kentuckyRoute = inactiveRoutes.find(r => r.tag === 'blue' || r.title.toLowerCase().includes('kentucky'));
            const otherInactiveRoutes = inactiveRoutes.filter(r => r.tag !== 'blue' && !r.title.toLowerCase().includes('kentucky'));
            
            return (
              <div className="mt-3 space-y-2">
                {kentuckyRoute && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/90">
                      <span className="font-medium">Note:</span> {kentuckyRoute.title} tracking is unavailable due to faulty GPS devices on buses. Contact the Transportation office at{' '}
                      <a href="mailto:transportation@wku.edu" className="underline hover:text-amber-100">transportation@wku.edu</a> to voice your concern.
                    </p>
                  </div>
                )}
                {otherInactiveRoutes.length > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-200/90">
                      <span className="font-medium">Note:</span>{' '}
                      {otherInactiveRoutes.length === 1 
                        ? `${otherInactiveRoutes[0].title} data is currently not being updated by the transit system.`
                        : `${otherInactiveRoutes.map(r => r.title.replace('Route ', '')).join(', ')} routes data is currently not being updated.`
                      } Live tracking may be unavailable.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </header>

      {/* View toggle for mobile */}
      <div className="md:hidden flex-shrink-0 px-4 py-2 border-b border-border bg-card/50">
        <div className="flex rounded-lg bg-secondary p-1">
          <button
            onClick={() => setView('map')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              view === 'map'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MapIcon className="w-4 h-4" />
            Map
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              view === 'list'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4" />
            Stops
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map view */}
        <div className={cn(
          "flex-1 relative",
          view === 'list' && "hidden md:block"
        )}>
          <BusMap
            routes={routes}
            vehicles={vehicles}
            selectedRoute={selectedRoute}
            selectedStop={selectedStop}
            selectedVehicle={selectedVehicle}
            selectedBuilding={selectedBuilding}
            onStopClick={handleStopClick}
            onVehicleClick={handleVehicleClick}
            onBuildingClick={handleBuildingClick}
            isVisible={view === 'map'}
            userLocation={userLocation}
            directionsDestination={directionsDestination}
            onClearDirections={() => setDirectionsDestination(null)}
          />
          {!selectedRoute && (
            <RouteLegend routes={routes} vehicles={vehicles} />
          )}
        </div>

        {/* Stop list sidebar */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-l border-border bg-card",
          view === 'map' && "hidden md:block"
        )}>
          <StopList
            routes={routes}
            selectedRoute={selectedRoute}
            onStopSelect={handleStopClick}
            search={stopSearch}
            onSearchChange={setStopSearch}
          />
        </div>
      </div>

      {/* Selected stop card */}
      {selectedStop && selectedStopRoute && (
        <StopCard
          stop={selectedStop}
          route={selectedStopRoute}
          allRoutes={routes}
          onClose={handleCloseStop}
        />
      )}

      {/* Selected bus card */}
      {selectedVehicle && selectedVehicleRoute && (
        <BusCard
          vehicle={selectedVehicle}
          route={selectedVehicleRoute}
          allRoutes={routes}
          onClose={handleCloseVehicle}
        />
      )}

      {/* Selected building card */}
      {selectedBuilding && (
        <BuildingCard
          building={selectedBuilding}
          onClose={handleCloseBuilding}
        />
      )}

      {/* QR Scanner */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
          routes={routes}
        />
      )}
    </main>
  );
};

export default Index;