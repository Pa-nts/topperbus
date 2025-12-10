import { Route, Stop } from '@/types/transit';
import { MapPin, Search } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StopListProps {
  routes: Route[];
  selectedRoute: string | null;
  onStopSelect: (stop: Stop, route: Route) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

const StopList = ({ routes, selectedRoute, onStopSelect, search, onSearchChange }: StopListProps) => {

  const filteredStops = useMemo(() => {
    const displayedRoutes = selectedRoute 
      ? routes.filter(r => r.tag === selectedRoute)
      : routes;

    const stopsMap = new Map<string, { stop: Stop; routes: Route[] }>();
    
    displayedRoutes.forEach(route => {
      route.stops.forEach(stop => {
        // Use lat/lon as key to merge stops at the same location (rounded to ~11m precision)
        const locationKey = `${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
        const existing = stopsMap.get(locationKey);
        if (existing) {
          if (!existing.routes.find(r => r.tag === route.tag)) {
            existing.routes.push(route);
          }
        } else {
          stopsMap.set(locationKey, { stop, routes: [route] });
        }
      });
    });

    return Array.from(stopsMap.values())
      .filter(({ stop }) => 
        stop.title.toLowerCase().includes(search.toLowerCase()) ||
        stop.stopId.includes(search)
      )
      .sort((a, b) => a.stop.title.localeCompare(b.stop.title));
  }, [routes, selectedRoute, search]);

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stops..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary text-foreground rounded-lg border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Stop list */}
      <div className="flex-1 overflow-y-auto">
        {filteredStops.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No stops found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredStops.map(({ stop, routes: stopRoutes }) => (
              <button
                key={`${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`}
                onClick={() => onStopSelect(stop, stopRoutes[0])}
                className="w-full p-4 text-left hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {stop.shortTitle || stop.title}
                    </h4>
                    {stop.stopId && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stop #{stop.stopId}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {stopRoutes.map(route => {
                        const color = route.color === '000000' ? '6B7280' : route.color;
                        return (
                          <span
                            key={route.tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: `#${color}20`,
                              color: `#${color}`,
                            }}
                          >
                            <span 
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: `#${color}` }}
                            />
                            {route.title.replace('Route ', '').split(' ')[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StopList;
