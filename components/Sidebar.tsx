
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
  onEnvironmentUpload?: (file: File) => void;
  onAutoMap?: (id: string, mats: string[]) => void;
  onSwitchVariant?: (variantName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  models, selectedId, onSelect, onAddFile, onRemove, onTextureUpload, onHoverMaterial, hoveredMaterial, onAddFromUrl, onAutoMap, onSwitchVariant, onEnvironmentUpload
}) => {
  const [r2Files, setR2Files] = React.useState<any[]>([]);
  const [isLoadingR2, setIsLoadingR2] = React.useState(false);
  const [r2Error, setR2Error] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'all' | 'categories'>('all');
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);

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

  // Group files by category (folder prefix)
  const categories = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    r2Files.forEach(file => {
      const parts = file.key.split('/');
      const category = parts.length > 1 ? parts[0] : 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(file);
    });
    return groups;
  }, [r2Files]);

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
        {/* HOTSPOT SECTION REMOVED */}

        {/* Environment HDRI Section */}
        <div className="bg-zinc-900 rounded-3xl p-5 border border-white/5 shadow-xl">
          <h3 className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            Environment Lighting
          </h3>
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:bg-white/5 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-6 h-6 text-zinc-500 mb-2 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-300">Upload HDRI / Image</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".hdr,.exr,.jpg,.png,.jpeg" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onEnvironmentUpload) onEnvironmentUpload(file);
              }}
            />
          </label>
        </div>

        {/* Products Catalog Section */}
        <div className="bg-zinc-50 rounded-3xl p-5 border border-black/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
              Products Catalog
            </h3>
            <div className="flex bg-zinc-200/50 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'all' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                All
              </button>
              <button 
                onClick={() => setActiveTab('categories')}
                className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'categories' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                Types
              </button>
            </div>
          </div>
          
          {isLoadingR2 ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : r2Error ? (
            <div className="text-[9px] text-red-500 font-bold text-center py-4">{r2Error}</div>
          ) : r2Files.length === 0 ? (
            <div className="text-[9px] text-zinc-400 font-bold text-center py-4 italic">No assets found</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scroll pr-2">
              {activeTab === 'all' ? (
                r2Files.map((file) => (
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
                ))
              ) : (
                Object.entries(categories).map(([category, files]) => (
                  <div key={category} className="space-y-2">
                    <button 
                      onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                      className="w-full flex items-center justify-between p-3 bg-zinc-100/50 hover:bg-zinc-100 rounded-2xl border border-black/5 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full group-hover:bg-yellow-500 transition-colors"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{category}</span>
                        <span className="text-[8px] font-mono text-zinc-400">({files.length})</span>
                      </div>
                      <svg className={`w-3 h-3 text-zinc-400 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedCategory === category && (
                      <div className="pl-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        {files.map((file) => (
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
                ))
              )}
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
