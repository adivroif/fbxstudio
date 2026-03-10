
import React from 'react';
import { SceneModelInstance } from '../types';

interface SidebarProps {
  models: SceneModelInstance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddFile: (file: File) => void;
  onRemove: (id: string) => void;
  // Make matName optional to match handleTextureUpload in App.tsx
  onTextureUpload: (file: File, type: string, matName?: string) => void;
  onHoverMaterial: (matName: string | null) => void;
  hoveredMaterial: string | null;
  onAddFromUrl: (url: string, name: string) => void;
  onAutoMap?: (id: string, mats: string[]) => void;
  onSwitchVariant?: (variantName: string) => void;
  onSpeak?: (text: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  models, selectedId, onSelect, onAddFile, onRemove, onTextureUpload, onHoverMaterial, hoveredMaterial, onAddFromUrl, onAutoMap, onSwitchVariant, onSpeak 
}) => {
  const [r2Files, setR2Files] = React.useState<any[]>([]);
  const [isLoadingR2, setIsLoadingR2] = React.useState(false);
  const [r2Error, setR2Error] = React.useState<string | null>(null);

  const fetchR2Files = async () => {
    setIsLoadingR2(true);
    setR2Error(null);
    try {
      const response = await fetch('/api/r2/files');
      const data = await response.json();
      if (data.files) {
        setR2Files(data.files);
      } else if (data.error) {
        setR2Error(data.error);
      }
    } catch (err) {
      setR2Error('Failed to fetch R2 files');
    } finally {
      setIsLoadingR2(false);
    }
  };

  React.useEffect(() => {
    fetchR2Files();
  }, []);

  const selectedModel = models.find(m => m.id === selectedId);

  const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const files = e.target.files;
    if (!files || !selectedModel) return;
    const fileArray = Array.from(files) as File[];
    
    fileArray.forEach(file => {
      const fileName = file.name.toLowerCase();
      const matchedMat = selectedModel.detectedMaterials.find(mat => {
        const lowMat = mat.toLowerCase();
        return fileName.includes(lowMat) || lowMat.includes(fileName.split('.')[0]);
      });

      if (matchedMat) {
        onTextureUpload(file, type, matchedMat);
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scroll bg-white">
      
      {/* ASSETS HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center border border-black/5">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-[14px] font-black uppercase tracking-[0.3em] text-zinc-800">Asset Library</h2>
        </div>
        <button 
          onClick={fetchR2Files}
          className="p-2 hover:bg-black/5 rounded-lg text-zinc-400 hover:text-yellow-500 transition-all"
        >
          <svg className={`w-4 h-4 ${isLoadingR2 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* 1. MODEL IMPORT */}
      <div className="space-y-4 mb-10">
        {/* R2 Cloudflare Section */}
        <div className="bg-zinc-50 rounded-3xl p-5 border border-black/5">
          <h3 className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
            Cloudflare R2 Storage
          </h3>
          
          {isLoadingR2 ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : r2Error ? (
            <div className="text-[9px] text-red-500 font-bold text-center py-4">{r2Error}</div>
          ) : r2Files.length === 0 ? (
            <div className="text-[9px] text-zinc-400 font-bold text-center py-4 italic">No assets found</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scroll pr-2">
              {r2Files.map((file) => (
                <div 
                  key={file.key}
                  onClick={() => onAddFromUrl(file.url, file.name)}
                  className="flex items-center justify-between p-3 bg-white hover:bg-yellow-500/10 rounded-2xl border border-black/5 cursor-pointer transition-all group shadow-sm"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold truncate text-zinc-700 group-hover:text-yellow-600">{file.name}</span>
                    <span className="text-[8px] font-mono text-zinc-400 uppercase">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-zinc-50 flex items-center justify-center group-hover:bg-yellow-500 transition-all">
                    <svg className="w-3 h-3 text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REMOVED: COLOR VARIANTS SECTION (Moved to bottom center) */}
      {/* REMOVED: BATCH UPLOAD SECTION */}
      {/* REMOVED: ACTIVE OBJECTS (Scene Hierarchy) */}
      
      <div className="mt-auto pt-6 border-t border-black/5">
        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-black/5">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Model</span>
            <span className="text-[10px] font-bold text-zinc-700 truncate max-w-[180px]">
              {selectedModel?.name || 'None'}
            </span>
          </div>
          {selectedId && (
            <button 
              onClick={() => onRemove(selectedId)}
              className="p-2 text-zinc-400 hover:text-red-500 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
