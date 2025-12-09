import React, { useState, useRef, useEffect } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { generatePixelAsset } from './services/geminiService';
import { Accessory, ToolMode } from './types';
import { DEFAULT_WHALE_IMAGE, DEFAULT_ACCESSORIES, COLOR_PALETTES, CANVAS_SIZE, EXPRESSION_OVERLAYS } from './constants';
import { 
  ArrowPathIcon, 
  TrashIcon, 
  HandRaisedIcon, 
  SparklesIcon,
  CloudArrowUpIcon,
  ArrowsRightLeftIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

// The consistent style base for the Datawhale Town aesthetic
// Updated to ask for solid white background to facilitate auto-transparency
const WHALE_STYLE_PROMPT = "cute chubby blue whale in pixel art style, 64x64 resolution, thick dark outline, soft 2-step shading, shiny highlight on top-right of head, white belly with vertical curved lines, tiny fins, small tail pointing upward, round shape, clean pixel blocks, retro japanese pixel art aesthetic, neutral pose for game sprite, solid white background";

const App: React.FC = () => {
  const [baseImage, setBaseImage] = useState<string>(DEFAULT_WHALE_IMAGE);
  const [facialExpression, setFacialExpression] = useState<string>('Smile');
  const [hueRotation, setHueRotation] = useState<number>(0);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>(ToolMode.MOVE);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const idCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedAccessory = accessories.find(a => a.id === selectedId);

  // Initialize with default values
  useEffect(() => {
    setBaseImage(DEFAULT_WHALE_IMAGE);
    setFacialExpression('Smile');
  }, []);

  const handleAddAccessory = (src: string, name: string) => {
    idCounter.current += 1;
    const newAccessory: Accessory = {
      id: `acc_${idCounter.current}_${Date.now()}`,
      name,
      src,
      x: 150 + (Math.random() * 40),
      y: 150 + (Math.random() * 40),
      scale: 1,
      rotation: 0,
      isFlipped: false,
      zIndex: accessories.length + 1
    };
    setAccessories([...accessories, newAccessory]);
    setSelectedId(newAccessory.id);
    setToolMode(ToolMode.MOVE);
  };

  const handleGenerateAccessory = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const asset = await generatePixelAsset(prompt, 'accessory');
      if (asset) {
        const src = `data:${asset.mimeType};base64,${asset.data}`;
        handleAddAccessory(src, prompt);
        setPrompt('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExpressionSelect = (expression: string) => {
    setFacialExpression(expression);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setBaseImage(ev.target.result);
          setHueRotation(0);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSelected = (updates: Partial<Accessory>) => {
    if (!selectedId) return;
    setAccessories(prev => prev.map(item => 
      item.id === selectedId ? { ...item, ...updates } : item
    ));
  };

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Enable pixelated rendering for the context
      ctx.imageSmoothingEnabled = false;

      // 1. Draw Base Image
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = baseImage;
      await new Promise((resolve, reject) => {
          baseImg.onload = resolve;
          baseImg.onerror = reject;
      });
      
      ctx.save();
      // Apply hue rotation filter
      if (hueRotation !== 0) {
        ctx.filter = `hue-rotate(${hueRotation}deg)`;
      }
      
      // Calculate centered position (60% size as in CSS)
      const targetSize = CANVAS_SIZE * 0.6; // 300px
      const scale = Math.min(targetSize / baseImg.width, targetSize / baseImg.height);
      const drawW = baseImg.width * scale;
      const drawH = baseImg.height * scale;
      const baseX = (CANVAS_SIZE - drawW) / 2;
      const baseY = (CANVAS_SIZE - drawH) / 2;
      
      ctx.drawImage(baseImg, baseX, baseY, drawW, drawH);
      ctx.restore();

      // 1.5. Draw Facial Expression Overlay
      const expressionImg = new Image();
      expressionImg.crossOrigin = "anonymous";
      expressionImg.src = EXPRESSION_OVERLAYS[facialExpression as keyof typeof EXPRESSION_OVERLAYS];
      await new Promise((resolve, reject) => {
          expressionImg.onload = resolve;
          expressionImg.onerror = reject;
      });
      
      ctx.save();
      // Apply same hue rotation to expression
      if (hueRotation !== 0) {
        ctx.filter = `hue-rotate(${hueRotation}deg)`;
      }
      
      // Expression positioned at (411, 173) on 731x508 base image
      const expressionScale = 255 / 731; // Width ratio
      const exprW = drawW * expressionScale;
      const exprH = (expressionImg.height / expressionImg.width) * exprW; // Maintain aspect ratio
      
      // Calculate position: (411, 173) relative to 731x508
      const exprOffsetX = (411 / 731) * drawW;
      const exprOffsetY = (173 / 508) * drawH;
      const exprX = baseX + exprOffsetX;
      const exprY = baseY + exprOffsetY;
      
      ctx.drawImage(expressionImg, exprX, exprY, exprW, exprH);
      ctx.restore();

      // 2. Draw Accessories
      for (const acc of accessories) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = acc.src;
          
          try {
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
          } catch (e) {
            console.warn("Failed to load accessory image for export", acc);
            continue;
          }

          ctx.save();
          
          // Mimic CSS constraints: max-width 96px
          let w = img.width;
          let h = img.height;
          if (w > 96) {
              const ratio = 96 / w;
              w = 96;
              h = h * ratio;
          }

          // Transform origin is center of the image
          const centerX = acc.x + w / 2;
          const centerY = acc.y + h / 2;

          ctx.translate(centerX, centerY);
          ctx.scale(acc.scale, acc.scale);
          ctx.rotate((acc.rotation * Math.PI) / 180);
          if (acc.isFlipped) {
              ctx.scale(-1, 1);
          }
          
          // Draw centered at origin
          ctx.drawImage(img, -w/2, -h/2, w, h);
          ctx.restore();
      }

      // 3. Trigger Download
      const link = document.createElement('a');
      link.download = `pixel-whale-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

    } catch (e) {
      console.error("Export failed:", e);
      alert("Could not export image. See console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      
      {/* Title Header */}
      <header className="mb-6 text-center">
        <h1 className="text-4xl md:text-5xl text-[#5D4037] uppercase tracking-widest drop-shadow-[2px_2px_0_rgba(255,255,255,0.5)] mb-2 font-bold">
          Datawhale Town Character System
        </h1>
        <p className="text-[#8B5E3C] text-lg">2D Pixel Art Style</p>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Character Preview (The "Box") */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="rpg-panel p-6 rounded-sm relative min-h-[400px]">
             <div className="absolute top-0 left-0 bg-[#8B5E3C] text-[#E6D5B8] px-3 py-1 text-xl font-bold rounded-br-lg z-10">
                Preview
             </div>
             
             {/* Toolbar overlaid or near canvas */}
             <div className="flex justify-end gap-2 mb-2">
                 <button 
                   onClick={() => setToolMode(ToolMode.MOVE)}
                   title="Move Items"
                   className={`p-2 border-2 border-[#5D4037] rounded ${toolMode === ToolMode.MOVE ? 'bg-[#FFB74D] text-[#3E2723]' : 'bg-[#D7CCC8] hover:bg-[#BCAAA4]'}`}
                 >
                    <HandRaisedIcon className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={() => setToolMode(ToolMode.DELETE)}
                   title="Delete Items"
                   className={`p-2 border-2 border-[#5D4037] rounded ${toolMode === ToolMode.DELETE ? 'bg-red-400 text-white' : 'bg-[#D7CCC8] hover:bg-[#BCAAA4]'}`}
                 >
                    <TrashIcon className="w-5 h-5" />
                 </button>
                 <div className="w-px bg-[#8B5E3C] mx-1 opacity-50"></div>
                 <button 
                   onClick={handleDownload}
                   title="Export Image"
                   disabled={isExporting}
                   className={`p-2 border-2 border-[#5D4037] rounded bg-[#81C784] text-[#1B5E20] hover:bg-[#66BB6A] disabled:opacity-50 disabled:cursor-not-allowed`}
                 >
                    {isExporting ? (
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowDownTrayIcon className="w-5 h-5" />
                    )}
                 </button>
             </div>

             <div className="relative">
                <EditorCanvas 
                  baseImage={baseImage}
                  facialExpression={facialExpression}
                  hueRotation={hueRotation}
                  accessories={accessories}
                  setAccessories={setAccessories}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  toolMode={toolMode}
                />
             </div>

             <div className="mt-4 text-center text-[#5D4037] text-lg">
                Character Name: Whale
             </div>
          </div>

          {/* Selected Item Fine Tuning */}
          {selectedId && (
              <div className="rpg-panel p-4 rounded-sm">
                  <h3 className="text-[#3E2723] text-xl border-b-2 border-[#8B5E3C] mb-2 pb-1">Adjust Item</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm mb-1">Scale</label>
                          <input 
                            type="range" min="0.5" max="6" step="0.1" 
                            value={selectedAccessory?.scale || 1}
                            onChange={(e) => updateSelected({scale: parseFloat(e.target.value)})}
                            className="w-full accent-[#8B5E3C]"
                          />
                      </div>
                      <div>
                          <label className="block text-sm mb-1">Rotation</label>
                          <input 
                            type="range" min="0" max="360" step="5" 
                            value={selectedAccessory?.rotation || 0}
                            onChange={(e) => updateSelected({rotation: parseInt(e.target.value)})}
                            className="w-full accent-[#8B5E3C]"
                          />
                      </div>
                      <div className="col-span-2">
                          <button 
                            onClick={() => updateSelected({ isFlipped: !selectedAccessory?.isFlipped })}
                            className={`rpg-button w-full py-2 font-bold text-sm flex items-center justify-center gap-2 ${selectedAccessory?.isFlipped ? 'bg-[#8D6E63] text-white' : ''}`}
                          >
                             <ArrowsRightLeftIcon className="w-4 h-4" />
                             Flip Horizontal
                          </button>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Right Column: Customization Options */}
        <div className="lg:col-span-6 space-y-6">
          
          <div className="rpg-panel p-6 rounded-sm">
             <h2 className="text-2xl text-[#3E2723] mb-4 font-bold border-b-4 border-[#8B5E3C] inline-block pb-1">
               Customization Options
             </h2>

             {/* 1. Expression Selector */}
             <div className="mb-6">
                <h3 className="text-[#5D4037] text-lg mb-2 font-bold flex items-center gap-2">
                   Expression Selector
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                   {Object.keys(EXPRESSION_OVERLAYS).map(exp => (
                      <button
                        key={exp}
                        onClick={() => handleExpressionSelect(exp)}
                        className={`rpg-button py-2 px-1 text-sm font-bold rounded hover:bg-[#BCAAA4] ${facialExpression === exp ? 'bg-[#FFB74D]' : ''}`}
                      >
                        {exp}
                      </button>
                   ))}
                </div>
             </div>

             {/* 2. Color Picker */}
             <div className="mb-6">
                <h3 className="text-[#5D4037] text-lg mb-2 font-bold">Color Picker</h3>
                <div className="flex flex-wrap gap-3">
                   {COLOR_PALETTES.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => setHueRotation(p.hue)}
                        className={`w-10 h-10 rounded border-2 border-[#3E2723] shadow-md transition-transform hover:scale-110 ${hueRotation === p.hue ? 'ring-2 ring-white scale-110' : ''}`}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                      />
                   ))}
                   {/* Reset */}
                   <button 
                     onClick={() => setHueRotation(0)}
                     className="px-3 py-1 text-xs border border-[#5D4037] rounded self-center ml-auto hover:bg-[#D7CCC8]"
                   >
                     Reset
                   </button>
                </div>
             </div>

             {/* 3. Accessory Selector */}
             <div className="mb-6">
                <h3 className="text-[#5D4037] text-lg mb-2 font-bold">Accessory Selector</h3>
                <div className="grid grid-cols-4 gap-2 mb-4">
                   {DEFAULT_ACCESSORIES.map(acc => (
                      <button
                        key={acc.id}
                        onClick={() => handleAddAccessory(acc.src, acc.name)}
                        className="rpg-button p-2 aspect-square flex flex-col items-center justify-center gap-1 group overflow-hidden"
                      >
                         <img src={acc.src} className="w-8 h-8 object-contain pixelated" alt={acc.name} />
                         <span className="text-[10px] leading-tight opacity-70 group-hover:opacity-100">{acc.name}</span>
                      </button>
                   ))}
                </div>
                
                {/* Magic Forge (Custom AI Accessory) */}
                <div className="bg-[#C7B299] p-3 rounded border-2 border-[#8B5E3C] border-dashed">
                   <h4 className="text-sm font-bold text-[#5D4037] mb-2 flex items-center gap-1">
                      <SparklesIcon className="w-4 h-4 text-purple-600" />
                      Magic Forge (Create Custom Item)
                   </h4>
                   <div className="flex gap-2">
                      <input 
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. Red Scarf"
                        className="flex-1 bg-[#E6D5B8] border-2 border-[#8B5E3C] px-2 py-1 text-sm text-[#3E2723] placeholder-[#8D6E63] focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateAccessory()}
                      />
                      <button 
                        onClick={handleGenerateAccessory}
                        disabled={isGenerating}
                        className="bg-[#FFB74D] border-2 border-[#E65100] text-[#3E2723] px-3 font-bold text-sm shadow-[0_2px_0_#E65100] active:translate-y-[2px] active:shadow-none disabled:grayscale"
                      >
                         {isGenerating ? "..." : "Craft"}
                      </button>
                   </div>
                </div>
             </div>
             
             {/* Upload Option */}
             <div className="pt-4 border-t-2 border-[#8B5E3C] border-dashed flex justify-center">
                <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="flex items-center gap-2 text-[#5D4037] hover:text-[#3E2723] underline text-sm"
                >
                   <CloudArrowUpIcon className="w-4 h-4" />
                   Upload custom whale image
                </button>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
             </div>

          </div>
        </div>
      </div>
      
      <footer className="mt-12 text-[#8B5E3C] text-sm text-center">
         Datawhale Town Project • Powered by Google Gemini
      </footer>
    </div>
  );
};

export default App;