
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLoader, useFrame, ThreeEvent, createPortal } from '@react-three/fiber';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import '../types';
import { MaterialSettings } from '../types';

interface FBXModelProps {
  url: string;
  settings: MaterialSettings;
  onMaterialsLoaded?: (materials: string[]) => void;
}

const FBXModel: React.FC<FBXModelProps> = ({ 
  url, settings, onMaterialsLoaded
}) => {
  const fbx = useLoader(FBXLoader, url);
  const [textureCache, setTextureCache] = useState<{ [url: string]: THREE.Texture }>({});
  const loaderRef = useRef(new THREE.TextureLoader());
  const initialPositions = useRef<Map<THREE.Object3D, THREE.Vector3>>(new Map());
  const explodeDirections = useRef<Map<THREE.Object3D, THREE.Vector3>>(new Map());
  
  const [internalExplodeFactor, setInternalExplodeFactor] = useState(0);

  // Handle real-time animation for explosion physics
  useFrame((state) => {
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

  // Synchronize component state with Three.js MeshStandardMaterial instances
  useEffect(() => {
    fbx.traverse((child) => {
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
            pbr.emissive.setHex(0x6366f1); pbr.emissiveIntensity = 0.5;
          } else {
            pbr.emissive.setHex(0x000000); pbr.emissiveIntensity = 0;
          }
          
          pbr.needsUpdate = true;
          return pbr;
        });
        mesh.material = Array.isArray(mesh.material) ? updatedMaterials : updatedMaterials[0];
      }
    });
  }, [fbx, settings, textureCache]);

  // Pre-process model to center, scale, and extract material names
  const processedModel = useMemo(() => {
    // Reset transformations
    fbx.position.set(0, 0, 0); 
    fbx.rotation.set(0, 0, 0); 
    fbx.scale.setScalar(1); 
    fbx.updateMatrixWorld(true);

    // 1. Calculate and apply scale first
    const initialBox = new THREE.Box3();
    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        initialBox.expandByObject(child);
      }
    });

    if (initialBox.isEmpty()) {
      // Fallback if no meshes found (unlikely for FBX)
      initialBox.setFromObject(fbx);
    }

    const initialSize = new THREE.Vector3(); 
    initialBox.getSize(initialSize);
    
    const targetSize = 35; 
    const scaleFactor = targetSize / Math.max(initialSize.x, initialSize.y, initialSize.z);
    fbx.scale.setScalar(scaleFactor); 
    fbx.updateMatrixWorld(true);

    // 2. Calculate center of the SCALED meshes (for internal use if needed, but we let Center component handle the visual centering)
    const scaledBox = new THREE.Box3();
    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        scaledBox.expandByObject(child);
      }
    });

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

  return (
    <group>
      <primitive object={processedModel} />
    </group>
  );
};

export default FBXModel;
