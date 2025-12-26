import { useState, useEffect, useRef } from 'react';
import { CampusBuilding } from '@/lib/campusBuildings';
import { X, Building2, MapPin, GraduationCap, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BuildingCardProps {
  building: CampusBuilding;
  onClose: () => void;
}

const BuildingCard = ({ building, onClose }: BuildingCardProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const [panelHeight, setPanelHeight] = useState(55);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTranslateY, setDragTranslateY] = useState(0);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const minHeight = 55;
  const maxHeight = 80;

  useEffect(() => {
    const timer = setTimeout(() => setIsOpening(false), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = panelHeight;
    setDragTranslateY(0);
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartY.current;
      
      if (deltaY < 0) {
        setDragTranslateY(deltaY);
        return;
      }
      
      setDragTranslateY(0);
      
      const windowHeight = window.innerHeight;
      const deltaPercent = (deltaY / windowHeight) * 100;
      
      const newHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeight.current + deltaPercent));
      setPanelHeight(newHeight);
    };

    const handleDragEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      
      if (dragTranslateY < -50) {
        handleClose();
        return;
      }
      
      setDragTranslateY(0);
      
      const midPoint = (minHeight + maxHeight) / 2;
      if (panelHeight > midPoint) {
        setPanelHeight(maxHeight);
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
  }, [isDragging, panelHeight, dragTranslateY]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  return (
    <>
      <div 
        ref={panelRef}
        className={cn(
          "fixed top-0 left-0 right-0 bg-card border-b border-border rounded-b-2xl shadow-2xl z-[1000] flex flex-col",
          isClosing ? "-translate-y-full" : isOpening ? "-translate-y-full" : ""
        )}
        style={{ 
          height: `${panelHeight}vh`,
          transform: isClosing ? undefined : isOpening ? undefined : `translateY(${dragTranslateY}px)`,
          transition: isDragging ? 'none' : 'height 0.2s ease-out, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold">
                    {building.abbreviation}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mt-1">
                  {building.name}
                </h3>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Building Image Placeholder */}
          <div className="w-full h-40 rounded-xl bg-secondary mb-4 flex items-center justify-center overflow-hidden">
            <div className="text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Building Image</p>
            </div>
          </div>
          
          {/* Department */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-medium text-sm">{building.department}</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium text-sm">{building.lat.toFixed(5)}, {building.lon.toFixed(5)}</p>
            </div>
          </div>

          {/* History/Description */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <History className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">About</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{building.description}</p>
            </div>
          </div>
        </div>
        
        {/* Drag handle */}
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

export default BuildingCard;
