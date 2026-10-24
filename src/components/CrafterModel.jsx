// CrafterModel.jsx
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export function CrafterModel() {
  const meshRef = useRef();
  const cylinderMatRef = useRef();
  const sphereMatRef = useRef();
  const scroll = useScroll(); // 取得滾動進度 (0 ~ 1)
  
  // 使用 drei 的 useGLTF 載入 GLB 檔案
  const { scene } = useGLTF('./models/crafter600Draco.glb');

  // 強制替換 GLB 模型內所有子元件的材質顏色與屬性
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#505953',     // #505953  #60685b
            roughness: 0.3,       // 粗糙度
            metalness: 0.5,       // 金屬感
          });
        }
      });
    }
  }, [scene]);

  useFrame(() => {
    const r = scroll.offset;
    if (meshRef.current) {
      meshRef.current.rotation.y = (r * Math.PI * 2) / 0.9;
    }

    // 1. 圓柱體與區段 2 標示淡入淡出計算
    let targetCylOpacity = 0;
    if (r >= 0 && r <= 0.3) {
      if (r < 0.1) {
        targetCylOpacity = ((r - 0) / 0.1) * 0.35;
      } else if (r <= 0.2) {
        targetCylOpacity = 0.35;
      } else {
        targetCylOpacity = ((0.3 - r) / 0.1) * 0.35;
      }
    }
    const finalCylOpacity = Math.max(0, Math.min(0.35, targetCylOpacity));
    
    if (cylinderMatRef.current) {
      cylinderMatRef.current.opacity = finalCylOpacity;
    }

    const cylLabelDom = document.getElementById('cylinder-label');
    if (cylLabelDom) {
      cylLabelDom.style.opacity = (finalCylOpacity / 0.35).toString();
    }

    // 2. 球體與區段 4 標示淡入淡出計算
    let targetSphOpacity = 0;
    if (r >= 0.3 && r <= 0.85) {
      if (r < 0.4) {
        targetSphOpacity = ((r - 0.3) / 0.1) * 0.35;
      } else if (r <= 0.65) {
        targetSphOpacity = 0.35;
      } else {
        targetSphOpacity = ((0.85 - r) / 0.1) * 0.35;
      }
    }
    const finalSphOpacity = Math.max(0, Math.min(0.35, targetSphOpacity));

    if (sphereMatRef.current) {
      sphereMatRef.current.opacity = finalSphOpacity;
    }

    const sphLabelDom = document.getElementById('sphere-label');
    if (sphLabelDom) {
      sphLabelDom.style.opacity = (finalSphOpacity / 0.35).toString();
    }
  });

  return (
    <group ref={meshRef}>
      {/* 渲染 GLB 場景，並透過 useEffect 套用自定義材質 */}
      <primitive object={scene} scale={[0.004, 0.004, 0.004]} position={[-0.9, -3, 0.65]} />

      {/* 對準要以圓柱體為旋轉中心來移動機器 */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 2.5, 32, 1, true]} />
        <meshBasicMaterial 
          ref={cylinderMatRef}
          color="#f2713a" 
          // #eaa486 #f2713a #7dc0da  #3998d0
          transparent 
          opacity={0} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, -2.5, 0]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshBasicMaterial 
          ref={sphereMatRef}
          color="#f2713a" 
          transparent 
          opacity={0} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}