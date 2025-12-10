import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, ScanLine, AlertCircle, ArrowLeft } from 'lucide-react';
import { Route } from '@/types/transit';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (stopId: string) => void;
  onClose: () => void;
  routes: Route[];
}

const QRScanner = ({ onScan, onClose, routes }: QRScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [invalidCode, setInvalidCode] = useState<string | null>(null);

  // Get all valid stop IDs from routes
  const validStopIds = new Set(
    routes.flatMap(route => route.stops.map(stop => stop.stopId))
  );

  const extractStopId = (decodedText: string): string | null => {
    let stopId = decodedText.trim();
    
    // Handle URL formats
    if (decodedText.includes('stop=')) {
      const match = decodedText.match(/stop=([^&]+)/);
      if (match) stopId = match[1];
    } else if (decodedText.includes('/stop/')) {
      const parts = decodedText.split('/stop/');
      if (parts[1]) stopId = parts[1].split(/[?#]/)[0];
    }
    
    return stopId;
  };

  const isValidStop = (stopId: string): boolean => {
    return validStopIds.has(stopId);
  };

  useEffect(() => {
    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode('qr-reader');
        
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            const stopId = extractStopId(decodedText);
            
            if (stopId && isValidStop(stopId)) {
              // Valid stop - proceed
              if (scannerRef.current && isRunningRef.current) {
                isRunningRef.current = false;
                scannerRef.current.stop().catch(() => {});
              }
              onScan(stopId);
            } else {
              // Invalid QR code - stop scanning
              if (scannerRef.current && isRunningRef.current) {
                isRunningRef.current = false;
                scannerRef.current.stop().catch(() => {});
              }
              setInvalidCode(decodedText);
            }
          },
          () => {} // Ignore errors during scanning
        );
        
        isRunningRef.current = true;
        setIsStarting(false);
      } catch (err) {
        console.error('Scanner error:', err);
        setError('Camera access denied. Please allow camera permissions to scan QR codes.');
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && isRunningRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const handleRetry = async () => {
    setInvalidCode(null);
    setIsStarting(true);
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          const stopId = extractStopId(decodedText);
          
          if (stopId && isValidStop(stopId)) {
            if (scannerRef.current && isRunningRef.current) {
              isRunningRef.current = false;
              scannerRef.current.stop().catch(() => {});
            }
            onScan(stopId);
          } else {
            if (scannerRef.current && isRunningRef.current) {
              isRunningRef.current = false;
              scannerRef.current.stop().catch(() => {});
            }
            setInvalidCode(decodedText);
          }
        },
        () => {}
      );
      
      isRunningRef.current = true;
      setIsStarting(false);
    } catch (err) {
      setError('Failed to restart scanner');
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[1001] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Camera className="w-5 h-5 text-primary" />
          <span className="font-medium">Scan Stop QR Code</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {error ? (
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Camera Access Required</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={onClose} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        ) : invalidCode ? (
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Invalid QR Code</h3>
            <p className="text-muted-foreground mb-6">
              This QR code is not a valid WKU Transit stop code. Please scan a QR code from an official bus stop.
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleRetry} variant="default" className="w-full">
                <ScanLine className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={onClose} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-card border border-border">
              <div id="qr-reader" className="w-full h-full" />
              
              {/* Scan overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-8 border-2 border-primary/50 rounded-xl">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                
                {/* Animated scan line */}
                <div className="absolute inset-x-8 top-8 bottom-8 overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-[scan_2s_ease-in-out_infinite]" 
                    style={{ animation: 'scan 2s ease-in-out infinite' }}
                  />
                </div>
              </div>
              
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-card">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ScanLine className="w-5 h-5 animate-pulse" />
                    <span>Starting camera...</span>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-muted-foreground text-sm mt-6 text-center max-w-xs">
              Point your camera at a WKU bus stop QR code to view arrival times
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
        #qr-reader video {
          object-fit: cover !important;
          border-radius: 1rem;
        }
        #qr-reader__scan_region {
          display: none;
        }
        #qr-reader__dashboard {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
