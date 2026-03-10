
import React from 'react';
import { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

export interface CustomHotspot {
  id: string;
  meshName: string;
  localPosition: THREE.Vector3;
  label: string;
  description: string;
  audioBuffer?: AudioBuffer; // Pre-cached audio for instant playback
}

export interface MaterialSettings {
  opacity: number;
  metalness: number;
  roughness: number;
  emissiveIntensity: number;
  color: string;
  transparent: boolean;
  materialMappings: Record<string, string>;
  normalMappings: Record<string, string>;
  metalMappings: Record<string, string>;
  roughMappings: Record<string, string>;
  alphaMappings: Record<string, string>;
  hoveredMaterial: string | null;
  metalnessUrl?: string | null;
  roughnessUrl?: string | null;
  transparencyUrl?: string | null;
  shadowUrl?: string | null;
  eyesUrl?: string | null;
  isExploded: boolean;
  explodeFactor: number;
  activeAnnotationId: string | null;
  showHotspots: boolean;
  isPlacementMode: boolean;
  customHotspots: CustomHotspot[];
  colorVariants: { name: string; mappings: Record<string, string> }[];
  activeVariant: string | null;
}

export interface SceneModelInstance {
  id: string;
  name: string;
  url: string;
  settings: MaterialSettings;
  detectedMaterials: string[];
  position: [number, number, number];
}

export interface ModelMetadata {
  name: string;
  size: string;
  triangleCount: number;
  materials: string[];
}
