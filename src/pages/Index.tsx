import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Route, VehicleLocation, Stop } from '@/types/transit';
import { fetchRouteConfig, fetchVehicleLocations } from '@/lib/api';
import BusMap from '@/components/BusMap';
import RouteSelector from '@/components/RouteSelector';
import StopCard from '@/components/StopCard';
import StopList from '@/components/StopList';
import QRScanner from '@/components/QRScanner';
import RouteLegend from '@/components/RouteLegend';
import { Bus, ScanLine, List, Map as MapIcon, RefreshCw, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedStopRoute, setSelectedStopRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Refresh vehicle locations periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const vehicleData = await fetchVehicleLocations();
        setVehicles(vehicleData);
      } catch (error) {
        console.error('Error refreshing vehicles:', error);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const selectStopById = (stopId: string, routeData: Route[] = routes) => {
    for (const route of routeData) {
      const stop = route.stops.find(s => s.stopId === stopId || s.tag === stopId);
      if (stop) {
        setSelectedStop(stop);
        setSelectedStopRoute(route);
        setSearchParams({ stop: stop.stopId });
        return;
      }
    }
    toast.error('Stop not found');
  };

  const handleStopClick = useCallback((stop: Stop, route: Route) => {
    setSelectedStop(stop);
    setSelectedStopRoute(route);
    setSearchParams({ stop: stop.stopId });
  }, [setSearchParams]);

  const handleCloseStop = () => {
    setSelectedStop(null);
    setSelectedStopRoute(null);
    setSearchParams({});
  };

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
            onStopClick={handleStopClick}
            isVisible={view === 'map'}
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

      {/* QR Scanner */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </main>
  );
};

export default Index;
