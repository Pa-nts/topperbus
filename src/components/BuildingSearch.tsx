import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, MapPin, Navigation } from 'lucide-react';
import { CAMPUS_BUILDINGS, CampusBuilding, CATEGORY_ICONS } from '@/lib/campusBuildings';
import { cn } from '@/lib/utils';

interface BuildingSearchProps {
  onBuildingSelect: (building: CampusBuilding) => void;
  onGetDirections?: (building: CampusBuilding) => void;
  selectedBuilding: CampusBuilding | null;
  hasUserLocation?: boolean;
}

const BuildingSearch = ({ onBuildingSelect, onGetDirections, selectedBuilding, hasUserLocation }: BuildingSearchProps) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredBuildings = useMemo(() => {
    if (!search.trim()) return [];
    const searchLower = search.toLowerCase();
    return CAMPUS_BUILDINGS.filter(
      b =>
        b.name.toLowerCase().includes(searchLower) ||
        b.abbreviation.toLowerCase().includes(searchLower) ||
        b.department.toLowerCase().includes(searchLower) ||
        b.categories.some(c => c.toLowerCase().includes(searchLower))
    ).slice(0, 8);
  }, [search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (building: CampusBuilding) => {
    onBuildingSelect(building);
    setSearch('');
    setIsOpen(false);
  };

  const handleDirections = (e: React.MouseEvent, building: CampusBuilding) => {
    e.stopPropagation();
    if (onGetDirections) {
      onGetDirections(building);
      setSearch('');
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search buildings..."
          className="w-full pl-9 pr-8 py-2.5 bg-secondary/80 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && filteredBuildings.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
          {filteredBuildings.map((building) => {
            const primaryCategory = building.categories[0];
            const iconData = CATEGORY_ICONS[primaryCategory];
            
            return (
              <div
                key={building.id}
                onClick={() => handleSelect(building)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors",
                  selectedBuilding?.id === building.id && "bg-primary/10"
                )}
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" className="text-foreground">
                    <path d={iconData.path} fill="currentColor" />
                  </svg>
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{building.name}</span>
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {building.abbreviation}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{building.department}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(building);
                    }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Show on map"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                  {hasUserLocation && onGetDirections && (
                    <button
                      onClick={(e) => handleDirections(e, building)}
                      className="p-1.5 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                      title="Get directions"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results */}
      {isOpen && search.trim() && filteredBuildings.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">No buildings found</p>
        </div>
      )}
    </div>
  );
};

export default BuildingSearch;
