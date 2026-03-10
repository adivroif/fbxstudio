
import React, { useState, Suspense, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import './types';
import FBXModel from './components/FBXModel';
import UIOverlay from './components/UIOverlay';
import Sidebar from './components/Sidebar';
import CameraControls from './components/CameraControls';
import { MaterialSettings, SceneModelInstance, CustomHotspot } from './types';
import { speakText } from './services/ttsService';

const CameraHandler: React.FC<{ targetView: { pos: THREE.Vector3, lookAt: THREE.Vector3 } | null, controlsRef: any }> = ({ targetView, controlsRef }) => {
  const { camera } = useThree();
  useFrame(() => {
    if (targetView && controlsRef.current) {
      camera.position.lerp(targetView.pos, 0.05);
      controlsRef.current.target.lerp(targetView.lookAt, 0.05);
      controlsRef.current.update();
    }
  });
  return null;
};

const App: React.FC = () => {
  const [models, setModels] = useState<SceneModelInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [targetView, setTargetView] = useState<{ pos: THREE.Vector3, lookAt: THREE.Vector3 } | null>(null);
  const controlsRef = useRef<any>(null);
  
  const createDefaultSettings = (): MaterialSettings => ({
    opacity: 1.0, metalness: 0.5, roughness: 0.5, emissiveIntensity: 0.0,
    color: '#ffffff', transparent: false, materialMappings: {},
    normalMappings: {}, metalMappings: {}, roughMappings: {}, alphaMappings: {},
    hoveredMaterial: null, isExploded: false, explodeFactor: 0,
    activeAnnotationId: null, showHotspots: true, isPlacementMode: false, customHotspots: [],
    colorVariants: [], activeVariant: null
  });

  const handleAddFile = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        const id = Math.random().toString(36).substr(2, 9);
        // Replace existing models with the new one
        setModels([{
          id, name: file.name.replace('.fbx', ''), url: data.url,
          settings: createDefaultSettings(), detectedMaterials: [], position: [0, 0, 0]
        }]);
        setSelectedId(id);
        setTargetView(null);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddFromUrl = (url: string, name: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Replace existing models with the new one
    setModels([{
      id, name: name.replace('.fbx', ''), url,
      settings: createDefaultSettings(), detectedMaterials: [], position: [0, 0, 0]
    }]);
    setSelectedId(id);
    setTargetView(null);
  };

  const updateModelData = (id: string, updates: Partial<SceneModelInstance>) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const autoMapR2Textures = useCallback(async (modelId: string, materials: string[]) => {
    try {
      const response = await fetch('/api/r2/textures');
      const data = await response.json();
      if (!data.textures) return;

      setModels(prev => prev.map(model => {
        if (model.id !== modelId) return model;
        
        const newSettings = { 
          ...model.settings,
          materialMappings: { ...model.settings.materialMappings },
          normalMappings: { ...model.settings.normalMappings },
          metalMappings: { ...model.settings.metalMappings },
          roughMappings: { ...model.settings.roughMappings },
          alphaMappings: { ...model.settings.alphaMappings },
          colorVariants: [...model.settings.colorVariants],
        };
        
        let changed = false;
        const variantsMap: Record<string, Record<string, string>> = {};

        materials.forEach(mat => {
          const lowMat = mat.toLowerCase();
          const matBase = lowMat.replace(/(_mat|_material|_mesh|_geo)$/, '');
          
          data.textures.forEach((tex: any) => {
            const lowTex = tex.name.toLowerCase();
            const texNameNoExt = tex.name.split('.')[0].toLowerCase();
            
            if (lowTex.includes(matBase) || matBase.includes(texNameNoExt)) {
              const isBaseColor = lowTex.includes('diffuse') || lowTex.includes('base') || lowTex.includes('color') || lowTex.includes('albedo');
              
              // Detect Variant Name
              // If it's a base color, check if there's a variant name
              // Example: "Connector Red baseColor.jpeg" -> matBase="connector", channel="basecolor", variant="red"
              if (isBaseColor) {
                let variantName = 'Default';
                const parts = texNameNoExt.split(/[\s_-]+/);
                const matParts = matBase.split(/[\s_-]+/);
                
                // Filter out material parts and channel keywords
                const variantParts = parts.filter(p => 
                  !matParts.includes(p) && 
                  !['diffuse', 'base', 'color', 'albedo', 'basecolor'].includes(p) &&
                  p !== matBase
                );
                
                if (variantParts.length > 0) {
                  variantName = variantParts.join(' ').toUpperCase();
                }

                if (!variantsMap[variantName]) variantsMap[variantName] = {};
                variantsMap[variantName][mat] = tex.url;
                
                // If it's the first or default, also set it as the primary mapping
                if (variantName === 'Default' || Object.keys(variantsMap).length === 1) {
                  newSettings.materialMappings[mat] = tex.url;
                  changed = true;
                }
              }

              // Standard mapping for other channels
              if (lowTex.includes('normal')) {
                newSettings.normalMappings[mat] = tex.url;
                changed = true;
              } else if (lowTex.includes('metal')) {
                newSettings.metalMappings[mat] = tex.url;
                changed = true;
              } else if (lowTex.includes('rough')) {
                newSettings.roughMappings[mat] = tex.url;
                changed = true;
              } else if (lowTex.includes('alpha') || lowTex.includes('opacity') || lowTex.includes('trans')) {
                newSettings.alphaMappings[mat] = tex.url;
                changed = true;
              }
            }
          });
        });

        // Convert variantsMap to array
        const colorVariants = Object.entries(variantsMap).map(([name, mappings]) => ({ name, mappings }));
        if (colorVariants.length > 0) {
          newSettings.colorVariants = colorVariants;
          changed = true;
        }

        return changed ? { ...model, settings: newSettings, detectedMaterials: materials } : { ...model, detectedMaterials: materials };
      }));
    } catch (error) {
      console.error('Auto-mapping failed:', error);
    }
  }, []);

  const handleSwitchVariant = (variantName: string) => {
    if (!selectedId) return;
    const model = models.find(m => m.id === selectedId);
    if (!model) return;
    
    const variant = model.settings.colorVariants.find(v => v.name === variantName);
    if (variant) {
      updateModelData(selectedId, {
        settings: {
          ...model.settings,
          activeVariant: variantName,
          materialMappings: { ...model.settings.materialMappings, ...variant.mappings }
        }
      });
    }
  };

  const handleCameraAction = (action: string, point?: THREE.Vector3) => {
    if (action === 'focus' && point) {
      // Increased offset (45, 25, 45) to "zoom out" slightly during focus
      setTargetView({ pos: point.clone().add(new THREE.Vector3(45, 25, 45)), lookAt: point.clone() });
      return;
    }
    if (action === 'reset') {
      setTargetView({ pos: new THREE.Vector3(40, 30, 70), lookAt: new THREE.Vector3(0, 0, 0) });
      return;
    }
    setTargetView(null); 
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    if (action === 'zoomIn') controls.object.position.multiplyScalar(0.8);
    if (action === 'zoomOut') controls.object.position.divideScalar(0.8);
    controls.update();
  };

  const handleAddHotspot = (hs: CustomHotspot) => {
    if (!selectedId) return;
    const model = models.find(m => m.id === selectedId);
    if (!model) return;
    const updatedHotspots = [...model.settings.customHotspots, hs];
    updateModelData(selectedId, { settings: { ...model.settings, customHotspots: updatedHotspots, isPlacementMode: false } });
  };

  const handleUpdateHotspot = (hsId: string, updates: Partial<CustomHotspot>) => {
    if (!selectedId) return;
    const model = models.find(m => m.id === selectedId);
    if (!model) return;
    
    const updatedHotspots = model.settings.customHotspots.map(h => 
      h.id === hsId ? { ...h, ...updates } : h
    );
    
    updateModelData(selectedId, { 
      settings: { ...model.settings, customHotspots: updatedHotspots } 
    });
  };

  const handleRemoveHotspot = (id: string) => {
    if (!selectedId) return;
    const model = models.find(m => m.id === selectedId);
    if (model) {
      updateModelData(selectedId, {
        settings: {
          ...model.settings,
          customHotspots: model.settings.customHotspots.filter(h => h.id !== id),
          activeAnnotationId: model.settings.activeAnnotationId === id ? null : model.settings.activeAnnotationId
        }
      });
    }
  };

  const handleRemoveModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleTextureUpload = useCallback(async (file: File, type: string, matName?: string) => {
    if (!selectedId) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        const url = data.url;
        const model = models.find(m => m.id === selectedId);
        if (!model) return;
        const newSettings = { ...model.settings };
        if (matName) {
          if (type === 'base') newSettings.materialMappings = { ...newSettings.materialMappings, [matName]: url };
          if (type === 'normal') newSettings.normalMappings = { ...newSettings.normalMappings, [matName]: url };
          if (type === 'metal') newSettings.metalMappings = { ...newSettings.metalMappings, [matName]: url };
          if (type === 'rough') newSettings.roughMappings = { ...newSettings.roughMappings, [matName]: url };
          if (type === 'alpha') newSettings.alphaMappings = { ...newSettings.alphaMappings, [matName]: url };
        }
        updateModelData(selectedId, { settings: newSettings });
      }
    } catch (error) {
      console.error('Texture upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  }, [selectedId, models]);

  const selectedModel = models.find(m => m.id === selectedId);

  const getColorFromName = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('red')) return '#ef4444';
    if (n.includes('blue')) return '#3b82f6';
    if (n.includes('green')) return '#22c55e';
    if (n.includes('yellow')) return '#eab308';
    if (n.includes('black')) return '#18181b';
    if (n.includes('white')) return '#ffffff';
    if (n.includes('orange')) return '#f97316';
    if (n.includes('purple')) return '#a855f7';
    if (n.includes('pink')) return '#ec4899';
    if (n.includes('gray') || n.includes('grey')) return '#71717a';
    return '#facc15'; // Default yellow
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex bg-white text-zinc-900 font-sans transition-colors duration-500">
      {/* LEFT SIDEBAR - CONTROLS */}
      <div className="w-[280px] h-full z-20 border-r border-black/5 bg-white flex flex-col shadow-xl">
        <UIOverlay 
          settings={selectedModel?.settings || createDefaultSettings()} 
          setSettings={(ns) => { if (selectedId) updateModelData(selectedId, { settings: ns }); }} 
          onFileUpload={handleAddFile} 
          onTextureUpload={handleTextureUpload} 
          onCameraAction={handleCameraAction} 
          detectedMaterials={selectedModel?.detectedMaterials || []} 
          isModelLoaded={!!selectedId} 
          isMoveMode={isMoveMode} 
          setMoveMode={setIsMoveMode} 
        />
      </div>

      {/* CENTER - VIEWPORT */}
      <div className="flex-1 relative bg-white">
        <CameraControls onAction={handleCameraAction} />
        
        {/* COLOR VARIANTS - BOTTOM CENTER */}
        {selectedModel && selectedModel.settings.colorVariants.length > 1 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-white/80 backdrop-blur-2xl px-8 py-5 rounded-[3rem] border border-black/5 shadow-2xl animate-in slide-in-from-bottom-10 duration-1000">
            <div className="flex flex-col mr-4">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400 leading-none mb-1">Select Variant</span>
              <span className="text-[12px] font-black text-zinc-800 uppercase tracking-tight">{selectedModel.settings.activeVariant || 'Default'}</span>
            </div>
            <div className="h-8 w-[1px] bg-black/5 mr-2"></div>
            <div className="flex items-center gap-3">
              {selectedModel.settings.colorVariants.map((variant) => (
                <button
                  key={variant.name}
                  onClick={() => handleSwitchVariant(variant.name)}
                  className={`group relative w-10 h-10 rounded-full transition-all duration-500 ${
                    selectedModel.settings.activeVariant === variant.name 
                    ? 'scale-125 shadow-xl ring-4 ring-yellow-500/20' 
                    : 'hover:scale-110'
                  }`}
                  title={variant.name}
                >
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-white shadow-inner"
                    style={{ backgroundColor: getColorFromName(variant.name) }}
                  ></div>
                  {selectedModel.settings.activeVariant === variant.name && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerDown={() => { if (isMoveMode) setIsMoveMode(false); setTargetView(null); }}>
          <PerspectiveCamera makeDefault position={[40, 30, 70]} fov={35} />
          <CameraHandler targetView={targetView} controlsRef={controlsRef} />
          <Suspense fallback={<Html center><div className="text-yellow-500 font-black uppercase tracking-[0.5em] animate-pulse text-[10px]">Initializing...</div></Html>}>
            {isUploading && (
              <Html center>
                <div className="bg-white/90 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-2xl border border-black/5 flex items-center gap-4">
                  <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-yellow-500 font-black text-[11px] tracking-widest uppercase">Processing Asset...</span>
                </div>
              </Html>
            )}
            <ambientLight intensity={1.2} />
            <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} intensity={2} castShadow />
            <directionalLight position={[-10, 20, 10]} intensity={1} />
            <Environment preset="city" />
            {models.map((model) => (
              <group key={model.id} position={model.position} onPointerDown={(e) => { if (model.settings.isPlacementMode) return; e.stopPropagation(); if (selectedId !== model.id) setSelectedId(model.id); }}>
                <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.1}>
                  <FBXModel 
                    url={model.url} 
                    settings={model.settings} 
                    onMaterialsLoaded={(mats) => {
                      if (model.detectedMaterials.length === 0) {
                        autoMapR2Textures(model.id, mats);
                      }
                    }} 
                    onHotspotClick={(hsId, pos) => {
                      updateModelData(model.id, { settings: { ...model.settings, activeAnnotationId: hsId } });
                      if (hsId) {
                        handleCameraAction('focus', pos);
                        const hs = model.settings.customHotspots.find(h => h.id === hsId);
                        if (hs && hs.description) {
                           speakText(hs.description);
                        }
                      } else {
                        handleCameraAction('reset');
                      }
                    }}
                    onAddHotspot={handleAddHotspot}
                    onRemoveHotspot={handleRemoveHotspot}
                    onUpdateHotspot={handleUpdateHotspot}
                  />
                </Float>
              </group>
            ))}
          </Suspense>
          <OrbitControls ref={controlsRef} makeDefault enableDamping minDistance={5} maxDistance={500} enabled={!isMoveMode} />
        </Canvas>
      </div>

      {/* RIGHT SIDEBAR - ASSETS */}
      <div className="w-[340px] h-full z-20 border-l border-black/5 bg-white flex flex-col shadow-xl">
        <Sidebar 
          models={models} 
          selectedId={selectedId} 
          onSelect={setSelectedId} 
          onAddFile={handleAddFile} 
          onAddFromUrl={handleAddFromUrl}
          onAutoMap={autoMapR2Textures}
          onSwitchVariant={handleSwitchVariant}
          onRemove={handleRemoveModel} 
          onTextureUpload={handleTextureUpload} 
          onHoverMaterial={(mat) => { if (selectedId) { const curr = models.find(m => m.id === selectedId); if (curr) updateModelData(selectedId, { settings: { ...curr.settings, hoveredMaterial: mat } }); } }} 
          hoveredMaterial={selectedModel?.settings.hoveredMaterial || null} 
        />
      </div>
    </div>
  );
};

export default App;
