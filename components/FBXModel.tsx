
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLoader, useFrame, ThreeEvent, createPortal } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import '../types';
import { MaterialSettings, CustomHotspot } from '../types';

interface FBXModelProps {
  url: string;
  settings: MaterialSettings;
  onMaterialsLoaded?: (materials: string[]) => void;
  onHotspotClick?: (id: string, position: THREE.Vector3) => void;
  onAddHotspot?: (hotspot: CustomHotspot) => void;
  onRemoveHotspot?: (id: string) => void;
  onUpdateHotspot?: (id: string, updates: Partial<CustomHotspot>) => void;
}

const FBXModel: React.FC<FBXModelProps> = ({ 
  url, settings, onMaterialsLoaded, onHotspotClick, onAddHotspot, onRemoveHotspot
}) => {
  const fbx = useLoader(FBXLoader, url);
  const [textureCache, setTextureCache] = useState<{ [url: string]: THREE.Texture }>({});
  const loaderRef = useRef(new THREE.TextureLoader());
  const initialPositions = useRef<Map<THREE.Object3D, THREE.Vector3>>(new Map());
  const explodeDirections = useRef<Map<THREE.Object3D, THREE.Vector3>>(new Map());
  
  const [pulse, setPulse] = useState(0);
  const [internalExplodeFactor, setInternalExplodeFactor] = useState(0);

  // Handle real-time animation for pulsing effects and explosion physics
  useFrame((state) => {
    setPulse(Math.sin(state.clock.elapsedTime * 6) * 0.5 + 0.5);
    const target = settings.isExploded ? 1.0 : 0.0;
    const nextFactor = THREE.MathUtils.lerp(internalExplodeFactor, target, 0.05);
    setInternalExplodeFactor(nextFactor);
    
    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const original = initialPositions.current.get(child);
        const direction = explodeDirections.current.get(child);
        if (original && direction) {
          const magnitude = nextFactor * 25; 
          child.position.set(
            original.x + direction.x * magnitude,
            original.y + direction.y * magnitude,
            original.z + direction.z * magnitude
          );
        }
      }
    });
  });

  // Load and cache textures for PBR material mappings
  useEffect(() => {
    const mapsToLoad: { url: string; isColor: boolean }[] = [];
    const addUrl = (u: any, isColor = false) => { if (u && typeof u === 'string') mapsToLoad.push({ url: u, isColor }); };
    Object.values(settings.materialMappings).forEach(u => addUrl(u, true));
    Object.values(settings.normalMappings).forEach(u => addUrl(u, false));
    Object.values(settings.metalMappings).forEach(u => addUrl(u, false));
    Object.values(settings.roughMappings).forEach(u => addUrl(u, false));
    Object.values(settings.alphaMappings).forEach(u => addUrl(u, false));
    mapsToLoad.forEach(({ url: u, isColor }) => {
      if (!textureCache[u]) {
        loaderRef.current.load(u, (tex) => {
          tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
          setTextureCache(prev => ({ ...prev, [u]: tex }));
        });
      }
    });
  }, [settings, textureCache]);

  // Pre-process model to center, scale, and extract material names
  const processedModel = useMemo(() => {
    fbx.position.set(0, 0, 0); fbx.rotation.set(0, 0, 0); fbx.scale.setScalar(1); fbx.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fbx);
    const center = new THREE.Vector3(); box.getCenter(center);
    const size = new THREE.Vector3(); box.getSize(size);
    fbx.position.x = -center.x; fbx.position.y = -center.y; fbx.position.z = -center.z;
    fbx.updateMatrixWorld(true);
    const targetSize = 35; 
    const scaleFactor = targetSize / Math.max(size.x, size.y, size.z);
    fbx.scale.setScalar(scaleFactor); fbx.updateMatrixWorld(true);

    const materialNames: string[] = [];
    let meshCounter = 0;
    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.name || mesh.name.trim() === "") {
          mesh.name = `Part_${meshCounter++}`;
        }
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) {
          if (!mat.name) mat.name = `Material_${materialNames.length}`;
          if (!materialNames.includes(mat.name)) materialNames.push(mat.name);
        }
        initialPositions.current.set(child, child.position.clone());
        const worldPos = new THREE.Vector3();
        child.getWorldPosition(worldPos);
        explodeDirections.current.set(child, worldPos.normalize());
      }
    });
    if (onMaterialsLoaded) onMaterialsLoaded(materialNames);
    return fbx;
  }, [fbx, url]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!settings.isPlacementMode) return;
    e.stopPropagation();
    const { point, object } = e;
    const mesh = object as THREE.Mesh;
    const localPos = mesh.worldToLocal(point.clone());
    const cleanName = mesh.name.replace(/_/g, ' ');
    const newHotspot: CustomHotspot = {
      id: Math.random().toString(36).substr(2, 9),
      meshName: mesh.name,
      localPosition: localPos,
      label: cleanName,
      description: `סקירה טכנית של ${cleanName}. רכיב זה מהווה חלק בלתי נפרד מהמבנה ההנדסי של המודל.`
    };
    onAddHotspot?.(newHotspot);
  };

  // Synchronize component state with Three.js MeshStandardMaterial instances
  useEffect(() => {
    processedModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const updatedMaterials = materials.map((mat) => {
          if (!mat.userData.pbr || mat.type !== 'MeshStandardMaterial') {
            const originalColor = (mat as any).color ? (mat as any).color.clone() : new THREE.Color(0xffffff);
            mat.userData.pbr = new THREE.MeshStandardMaterial({ name: mat.name, color: originalColor, side: THREE.DoubleSide });
            mat.userData.originalColor = originalColor;
          }
          const pbr = mat.userData.pbr as THREE.MeshStandardMaterial;
          pbr.map = (settings.materialMappings[mat.name] && textureCache[settings.materialMappings[mat.name]]) || null;
          pbr.normalMap = (settings.normalMappings[mat.name] && textureCache[settings.normalMappings[mat.name]]) || null;
          pbr.metalnessMap = (settings.metalMappings[mat.name] && textureCache[settings.metalMappings[mat.name]]) || (settings.metalnessUrl && textureCache[settings.metalnessUrl]) || null;
          pbr.roughnessMap = (settings.roughMappings[mat.name] && textureCache[settings.roughMappings[mat.name]]) || (settings.roughnessUrl && textureCache[settings.roughnessUrl]) || null;
          pbr.alphaMap = (settings.alphaMappings[mat.name] && textureCache[settings.alphaMappings[mat.name]]) || (settings.transparencyUrl && textureCache[settings.transparencyUrl]) || null;
          pbr.metalness = pbr.metalnessMap ? 1.0 : settings.metalness;
          pbr.roughness = pbr.roughnessMap ? 1.0 : settings.roughness;
          pbr.transparent = !!pbr.alphaMap || settings.opacity < 1.0;
          pbr.opacity = settings.opacity;
          const baseColor = settings.color === '#ffffff' ? mat.userData.originalColor : new THREE.Color(settings.color);
          pbr.color.copy(baseColor);
          if (settings.hoveredMaterial === mat.name) {
            pbr.emissive.setHex(0x6366f1); pbr.emissiveIntensity = pulse * 0.4;
          } else {
            pbr.emissive.setHex(0x000000); pbr.emissiveIntensity = 0;
          }
          pbr.needsUpdate = true;
          return pbr;
        });
        mesh.material = Array.isArray(mesh.material) ? updatedMaterials : updatedMaterials[0];
      }
    });
  }, [processedModel, settings, textureCache, pulse]);

  return (
    <group onPointerDown={handlePointerDown}>
      <primitive object={processedModel} />
      {settings.showHotspots && settings.customHotspots.map((h) => {
        const mesh = fbx.getObjectByName(h.meshName) as THREE.Mesh;
        if (!mesh) return null;

        // Use createPortal to attach the Html annotation directly to the mesh.
        // This ensures the annotation follows the mesh as it moves during "explode" modes.
        return createPortal(
          <Html 
            key={h.id} 
            position={h.localPosition} 
            distanceFactor={40} 
            zIndexRange={[100, 0]}
          >
            <div className="relative flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const wp = new THREE.Vector3();
                  mesh.localToWorld(wp.copy(h.localPosition));
                  onHotspotClick?.(h.id, wp); 
                }}
                className={`w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-lg pointer-events-auto transition-all hover:scale-125 ${settings.activeAnnotationId === h.id ? 'ring-4 ring-indigo-300' : ''}`}
              />
            </div>
          </Html>,
          mesh
        );
      })}
    </group>
  );
};

export default FBXModel;
