import React, { useRef, useState, useEffect } from 'react';
import { Accessory, ToolMode } from '../types';
import { CANVAS_SIZE, EXPRESSION_OVERLAYS } from '../constants';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface EditorCanvasProps {
  baseImage: string;
  facialExpression: string;
  hueRotation: number;
  accessories: Accessory[];
  setAccessories: React.Dispatch<React.SetStateAction<Accessory[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  toolMode: ToolMode;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  baseImage,
  facialExpression,
  hueRotation,
  accessories,
  setAccessories,
  selectedId,
  setSelectedId,
  toolMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Mouse screen coordinates
  const [itemStart, setItemStart] = useState({ x: 0, y: 0 }); // Item logical coordinates

  // Use ResizeObserver to keep the internal 500x500 canvas scaled correctly to the responsive container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateScale = () => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth;
            // Prevent division by zero or negative scales
            const newScale = Math.max(0.1, width / CANVAS_SIZE);
            setScaleFactor(newScale);
        }
    };

    const resizeObserver = new ResizeObserver(() => {
        updateScale();
    });
    
    resizeObserver.observe(containerRef.current);
    updateScale(); // Initial check

    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Stop mousedown propagation
    setSelectedId(id);

    if (toolMode === ToolMode.DELETE) {
      setAccessories(prev => prev.filter(item => item.id !== id));
      return;
    }

    const item = accessories.find(a => a.id === id);
    if (!item) return;

    if (toolMode === ToolMode.MOVE) {
      setIsDragging(true);
      // Capture the starting screen position and the starting item logical position
      setDragStart({ x: e.clientX, y: e.clientY });
      setItemStart({ x: item.x, y: item.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || toolMode !== ToolMode.MOVE) return;

    // Calculate how much the mouse moved in screen pixels
    const dxScreen = e.clientX - dragStart.x;
    const dyScreen = e.clientY - dragStart.y;

    // Convert that screen delta to "Canvas Logical Pixels" (500x500 space)
    const dxCanvas = dxScreen / scaleFactor;
    const dyCanvas = dyScreen / scaleFactor;

    setAccessories(prev => prev.map(item => 
      item.id === selectedId ? { 
          ...item, 
          x: itemStart.x + dxCanvas, 
          y: itemStart.y + dyCanvas 
      } : item
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleImageError = (id: string) => {
      setFailedImages(prev => {
          const newSet = new Set(prev);
          newSet.add(id);
          return newSet;
      });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;

      setAccessories(prev => prev.map(item => {
        if (item.id !== selectedId) return item;
        
        // 10 pixels in 500px space is a good nudge
        const shift = e.shiftKey ? 10 : 1; 
        switch (e.key) {
          case 'ArrowUp': return { ...item, y: item.y - shift };
          case 'ArrowDown': return { ...item, y: item.y + shift };
          case 'ArrowLeft': return { ...item, x: item.x - shift };
          case 'ArrowRight': return { ...item, x: item.x + shift };
        }
        return item;
      }));
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
         setAccessories(prev => prev.filter(a => a.id !== selectedId));
         setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, setAccessories, setSelectedId]);


  return (
    <div 
      ref={containerRef}
      className="relative bg-[#D4C09E] border-[6px] border-[#8B5E3C] rounded-lg shadow-inner overflow-hidden cursor-crosshair select-none"
      style={{ 
          width: '100%', 
          aspectRatio: '1/1', 
          maxWidth: CANVAS_SIZE,
          maxHeight: '60vh',
          // Background grid remains on the container
          backgroundImage: 'linear-gradient(#C7B299 1px, transparent 1px), linear-gradient(90deg, #C7B299 1px, transparent 1px)',
          backgroundSize: '20px 20px'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => setSelectedId(null)}
    >
      {/* 
        This internal container represents the Fixed Logical Canvas (500x500).
        It is scaled via CSS transform to fit the outer responsive container.
        This ensures x/y coordinates are always consistent for export.
      */}
      <div
        style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
        }}
      >
          {/* Base Image - 731x508 scaled to 60% of 500px canvas */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="relative" style={{ 
                width: `${CANVAS_SIZE * 0.6}px`,
                height: `${CANVAS_SIZE * 0.6}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
             }}>
               {/* Container for maintaining aspect ratio */}
               <div className="relative" style={{
                 width: '100%',
                 aspectRatio: '731 / 508'
               }}>
                 <img 
                    src={baseImage} 
                    alt="Base Whale" 
                    className="absolute inset-0 w-full h-full drop-shadow-xl"
                    style={{ 
                        filter: `hue-rotate(${hueRotation}deg)`,
                        imageRendering: 'pixelated',
                        objectFit: 'contain'
                    }}
                 />
                 {/* Facial Expression Overlay - positioned at (411, 173) on 731x508 base */}
                 <img 
                    src={EXPRESSION_OVERLAYS[facialExpression as keyof typeof EXPRESSION_OVERLAYS]}
                    alt="Facial Expression" 
                    className="absolute"
                    style={{ 
                        left: `${(411 / 731) * 100}%`,
                        top: `${(173 / 508) * 100}%`,
                        width: `${(255 / 731) * 100}%`,
                        height: 'auto',
                        filter: `hue-rotate(${hueRotation}deg)`,
                        imageRendering: 'pixelated'
                    }}
                 />
               </div>
             </div>
          </div>

          {/* Accessories */}
          {accessories.map((item) => (
            <div
              key={item.id}
              className={`absolute`}
              style={{
                left: item.x,
                top: item.y,
                // Scale is applied here for the accessory size
                transform: `scale(${item.scale}) rotate(${item.rotation}deg) scaleX(${item.isFlipped ? -1 : 1})`,
                zIndex: item.zIndex,
                cursor: toolMode === ToolMode.DELETE ? 'not-allowed' : 'grab'
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {selectedId === item.id && (
                <div className="absolute -inset-1 border-2 border-dashed border-[#8B5E3C] pointer-events-none animate-pulse" />
              )}
              
              {failedImages.has(item.id) ? (
                  <div className="w-8 h-8 bg-red-200 border border-red-500 flex items-center justify-center text-red-500 rounded">
                      <ExclamationCircleIcon className="w-5 h-5" />
                  </div>
              ) : (
                  <img 
                    src={item.src} 
                    alt={item.name}
                    className="pointer-events-none drop-shadow-md select-none block"
                    style={{ 
                        maxWidth: '96px',
                        imageRendering: 'pixelated'
                    }}
                    draggable={false}
                    onError={() => handleImageError(item.id)}
                    crossOrigin="anonymous" 
                  />
              )}
            </div>
          ))}
      </div>
    </div>
  );
};
