import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import * as THREE from 'three';

export function CrafterModel() {
  const meshRef = useRef();
  const scroll = useScroll(); // 取得滾動進度 (0 ~ 1)
  
  // 載入 STL 檔案
  const geom = useLoader(STLLoader, '/models/crafter_600.stl');

  // 自動計算幾何中心與自動縮放
  useMemo(() => {
    geom.computeVertexNormals();
    geom.center(); // 將模型中心歸零

    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim > 0) {
      const scaleFactor = 6 / maxDim; // 調整模型大小
      geom.scale(scaleFactor, scaleFactor, scaleFactor);
    }
  }, [geom]);

    useFrame(() => {
    const r = scroll.offset; // 0 到 1 之間的滾動值
    if (meshRef.current) {
      // 隨頁面滾動旋轉，調整係數讓模型在第二頁呈現特定角度
      meshRef.current.rotation.z = (r * Math.PI * 2)/6; 
    }
  });

  return (
    <group ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geom}>
        <meshStandardMaterial 
          color="#748279" 
          roughness={0.3} 
          metalness={0.8} 
        />
      </mesh>
    </group>
  );
}