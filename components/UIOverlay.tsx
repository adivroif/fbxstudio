
import React from 'react';
import * as THREE from 'three';
import { MaterialSettings } from '../types';
import '../types';

interface UIOverlayProps {
  settings: MaterialSettings;
  setSettings: (s: MaterialSettings) => void;
  onFileUpload: (file: File) => void;
  onTextureUpload: (file: File, type: string, matName?: string) => void;
  detectedMaterials: string[];
  isModelLoaded: boolean;
  isMoveMode: boolean;
  setMoveMode: (val: boolean) => void;
  onCameraAction: (action: string, point?: THREE.Vector3) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  settings, setSettings, isModelLoaded, isMoveMode, setMoveMode, onCameraAction 
}) => {
  
  const activeHotspot = settings.customHotspots.find(h => h.id === settings.activeAnnotationId);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scroll bg-white">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center shadow-xl shadow-yellow-500/20 transform -rotate-3">
          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h1 className="text-[14px] font-black uppercase tracking-[0.3em] text-zinc-800 leading-none">Studio</h1>
          <span className="text-[7px] font-black uppercase tracking-[0.5em] text-yellow-600/60">Professional</span>
        </div>
      </div>

      {/* REMOVED: MATERIAL SETTINGS (PBR Properties) */}
      <div className={`space-y-8 transition-all duration-1000 ${isModelLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
        
        {/* QUICK ACTIONS */}
        <div className="space-y-4">
          <h2 className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.5em] flex items-center gap-2">
            <div className="w-6 h-[1px] bg-zinc-100"></div>
            Tools
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => setSettings({...settings, isPlacementMode: !settings.isPlacementMode})}
              className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between border ${settings.isPlacementMode ? 'bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/30' : 'bg-zinc-50 text-zinc-500 border-black/5 hover:border-yellow-500/30 hover:bg-yellow-500/5'}`}
            >
              <span>Add Hotspot</span>
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${settings.isPlacementMode ? 'bg-black/10' : 'bg-zinc-100'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>

            <button 
              onClick={() => setSettings({...settings, isExploded: !settings.isExploded})}
              className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between border ${settings.isExploded ? 'bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/30' : 'bg-zinc-50 text-zinc-500 border-black/5 hover:border-yellow-500/30 hover:bg-yellow-500/5'}`}
            >
              <span>Explode View</span>
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${settings.isExploded ? 'bg-black/10' : 'bg-zinc-100'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </div>
            </button>

            <button 
              onClick={() => setMoveMode(!isMoveMode)}
              className={`w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between border ${isMoveMode ? 'bg-yellow-500 text-black border-yellow-500 shadow-xl shadow-yellow-500/30' : 'bg-zinc-50 text-zinc-500 border-black/5 hover:border-yellow-500/30 hover:bg-yellow-500/5'}`}
            >
              <span>Move Model</span>
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${isMoveMode ? 'bg-black/10' : 'bg-zinc-100'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* HOTSPOT INFO */}
      {activeHotspot && (
        <div className="mt-auto pt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-yellow-500 rounded-[2.5rem] p-8 text-black shadow-2xl shadow-yellow-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setSettings({ ...settings, activeAnnotationId: null });
                    onCameraAction('reset');
                  }} 
                  className="p-2 bg-black/10 hover:bg-black/20 rounded-2xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50">Technical Specs</span>
                  <h3 className="text-[20px] font-black leading-tight tracking-tight">{activeHotspot.label}</h3>
                </div>
              </div>
              <p className="text-[14px] font-bold leading-relaxed text-right opacity-80" dir="rtl">
                {activeHotspot.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isModelLoaded && (
        <div className="flex-1 flex flex-col items-center justify-center opacity-20">
          <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/5">
            <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-600">Standby Mode</span>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
