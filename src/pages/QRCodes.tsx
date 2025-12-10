import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Route, Stop } from '@/types/transit';
import { fetchRouteConfig } from '@/lib/api';
import { ArrowLeft, Download, Printer, Search, Bus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const QRCodes = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const routeData = await fetchRouteConfig();
        setRoutes(routeData);
      } catch (error) {
        console.error('Error loading routes:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getBaseUrl = () => {
    return 'https://topperbus.lovable.app';
  };

  const stopsWithRoutes = useMemo(() => {
    const stopMap = new Map<string, { stop: Stop; routes: Route[] }>();
    
    routes.forEach(route => {
      route.stops.forEach(stop => {
        const existing = stopMap.get(stop.stopId);
        if (existing) {
          if (!existing.routes.some(r => r.tag === route.tag)) {
            existing.routes.push(route);
          }
        } else {
          stopMap.set(stop.stopId, { stop, routes: [route] });
        }
      });
    });
    
    return Array.from(stopMap.values());
  }, [routes]);

  const filteredStops = stopsWithRoutes.filter(({ stop, routes: stopRoutes }) => {
    const matchesSearch = search === '' || 
      stop.title.toLowerCase().includes(search.toLowerCase()) ||
      stop.stopId.toLowerCase().includes(search.toLowerCase());
    const matchesRoute = !selectedRoute || stopRoutes.some(r => r.tag === selectedRoute);
    return matchesSearch && matchesRoute;
  });

  const handlePrint = () => {
    window.print();
  };

  const downloadQR = (stop: Stop, route: Route) => {
    const svg = document.getElementById(`qr-${stop.stopId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 300, 300);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stop.title, 200, 400);
        ctx.font = '14px sans-serif';
        ctx.fillText(`Stop ID: ${stop.stopId}`, 200, 430);
        ctx.fillText(route.title, 200, 455);
      }
      
      const link = document.createElement('a');
      link.download = `stop-${stop.stopId}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Bus className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading stops...</p>
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
              <h1 className="text-lg font-semibold">QR Code Generator</h1>
              <p className="text-xs text-muted-foreground">Print codes for bus stops</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print All
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search stops..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedRoute || ''}
              onChange={(e) => setSelectedRoute(e.target.value || null)}
              className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm"
            >
              <option value="">All Routes</option>
              {routes.map(route => (
                <option key={route.tag} value={route.tag}>
                  {route.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* QR Codes Grid */}
      <div ref={printRef} className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-2">
        {filteredStops.map(({ stop, routes: stopRoutes }) => (
          <div 
            key={stop.stopId}
            className="bg-card rounded-xl p-4 border border-border print:break-inside-avoid"
          >
            <div className="flex flex-col items-center">
              <div className="bg-white p-3 rounded-lg mb-3">
                <QRCodeSVG
                  id={`qr-${stop.stopId}`}
                  value={`${getBaseUrl()}/?stop=${stop.stopId}`}
                  size={150}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <h3 className="font-medium text-center text-sm mb-1 line-clamp-2">
                {stop.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-1">
                Stop ID: {stop.stopId}
              </p>
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {stopRoutes.map(route => (
                  <div 
                    key={route.tag}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: `#${route.color}20`,
                      color: `#${route.color === '000000' ? '6B7280' : route.color}`
                    }}
                  >
                    {route.title}
                  </div>
                ))}
              </div>
              <div className="text-center mb-3 px-3">
                <p className="text-lg font-bold text-foreground mb-2">
                  {stop.title}
                </p>
                <div className="border-t border-border pt-2 mt-2">
                  <p className="text-base font-medium text-foreground mb-1">
                    Scan QR code or visit:
                  </p>
                  <p className="text-lg font-bold text-primary">
                    topperbus.lovable.app
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Stops" and search for "{stop.title}"
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => downloadQR(stop, stopRoutes[0])}
                className="print:hidden"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredStops.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mb-4 opacity-50" />
          <p>No stops found</p>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          header { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default QRCodes;
