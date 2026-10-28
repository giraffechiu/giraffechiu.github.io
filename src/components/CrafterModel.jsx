// CrafterModel.jsx
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';

// 幾何分析函式 (計算尺寸、體積、表面積)
function analyzeGeometry(geometry) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const dimensions = {
    x: Math.round(size.x * 10) / 10,
    y: Math.round(size.y * 10) / 10,
    z: Math.round(size.z * 10) / 10,
  };

  let volume = 0;
  const position = geometry.attributes.position;
  if (position) {
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      p1.fromBufferAttribute(position, i);
      p2.fromBufferAttribute(position, i + 1);
      p3.fromBufferAttribute(position, i + 2);
      volume += p1.dot(p2.clone().cross(p3)) / 6.0;
    }
  }
  const volumeMm3 = Math.abs(volume);
  const volumeCm3 = Math.round((volumeMm3 / 1000) * 10) / 10;

  let surfaceArea = 0;
  if (position) {
    const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      p1.fromBufferAttribute(position, i);
      p2.fromBufferAttribute(position, i + 1);
      p3.fromBufferAttribute(position, i + 2);
      const ab = p2.clone().sub(p1);
      const ac = p3.clone().sub(p1);
      surfaceArea += ab.cross(ac).length() / 2.0;
    }
  }
  const surfaceAreaCm2 = Math.round((surfaceArea / 100) * 10) / 10;
  const triangleCount = position ? position.count / 3 : 0;

  return {
    dimensions,
    volumeCm3: Math.max(volumeCm3, 0.5),
    surfaceAreaCm2: Math.max(surfaceAreaCm2, 1.0),
    triangleCount,
  };
}

export function CrafterModel({ 
  mode = 'home', // 'home' (首頁滾動導覽) 或 'viewer' (訂單頁面檢視器)
  modelUrl = './models/website3dtest.stl',
  fileObj = null,
  occtEngine = null,
  selectedColorHex = 0x64748b,
  isTransparent = false,
  onAnalysisComplete = null,
  onLoadingStateChange = null
}) {
  const meshRef = useRef();
  const orderMeshGroupRef = useRef();
  const cylinderMatRef = useRef();
  const sphereMatRef = useRef();
  
  let scroll = null;
  try {
    scroll = useScroll();
  } catch (e) {}

  const { scene } = useGLTF('./models/crafter600Draco.glb');

  useEffect(() => {
    if (mode === 'home' && scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#505953',
            roughness: 0.3,
            metalness: 0.5,
          });
        }
      });
    }
  }, [mode, scene]);

  useFrame(() => {
    if (mode !== 'home' || !scroll) return;
    const r = scroll.offset;
    if (meshRef.current) {
      meshRef.current.rotation.y = (r * Math.PI * 2) / 0.9;
    }

    let targetCylOpacity = 0;
    if (r >= 0 && r <= 0.3) {
      if (r < 0.1) targetCylOpacity = ((r - 0) / 0.1) * 0.35;
      else if (r <= 0.2) targetCylOpacity = 0.35;
      else targetCylOpacity = ((0.3 - r) / 0.1) * 0.35;
    }
    const finalCylOpacity = Math.max(0, Math.min(0.35, targetCylOpacity));
    if (cylinderMatRef.current) cylinderMatRef.current.opacity = finalCylOpacity;
    const cylLabelDom = document.getElementById('cylinder-label');
    if (cylLabelDom) cylLabelDom.style.opacity = (finalCylOpacity / 0.35).toString();

    let targetSphOpacity = 0;
    if (r >= 0.3 && r <= 0.85) {
      if (r < 0.4) targetSphOpacity = ((r - 0.3) / 0.1) * 0.35;
      else if (r <= 0.65) targetSphOpacity = 0.35;
      else targetSphOpacity = ((0.85 - r) / 0.1) * 0.35;
    }
    const finalSphOpacity = Math.max(0, Math.min(0.35, targetSphOpacity));
    if (sphereMatRef.current) sphereMatRef.current.opacity = finalSphOpacity;
    const sphLabelDom = document.getElementById('sphere-label');
    if (sphLabelDom) sphLabelDom.style.opacity = (finalSphOpacity / 0.35).toString();
  });

  // 處理 Geometry 載入、軸向校正與材質分配
  const processLoadedGeometry = (geometry) => {
    if (!geometry) return;

    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const analysisRes = analyzeGeometry(geometry);

    geometry.center();
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const heightY = bbox.max.y - bbox.min.y;
    
    // 💡 改用 boundingBox 的對角線長度 (max 距離) 來計算更穩定的 maxDim
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    geometry.translate(0, heightY / 2, 0);

    if (orderMeshGroupRef.current) {
      while (orderMeshGroupRef.current.children.length > 0) {
        const obj = orderMeshGroupRef.current.children[0];
        if (obj.geometry) obj.geometry.dispose();
        orderMeshGroupRef.current.remove(obj);
      }
    }

    const material = new THREE.MeshStandardMaterial({
      color: selectedColorHex,
      roughness: 0.4,
      metalness: 0.1,
      transparent: isTransparent,
      opacity: isTransparent ? 0.5 : 1.0,
      depthWrite: !isTransparent
    });

    const mesh = new THREE.Mesh(geometry, material);
    if (orderMeshGroupRef.current) {
      orderMeshGroupRef.current.add(mesh);
    }

    // 💡 將精準計算出的 maxDim 傳回給父元件作為視距依據
    if (onAnalysisComplete) {
      onAnalysisComplete(analysisRes, heightY, maxDim);
    }
    if (onLoadingStateChange) onLoadingStateChange(false);
  };

  useEffect(() => {
    if (mode !== 'viewer') return;

    if (onLoadingStateChange) onLoadingStateChange(true);

    if (fileObj) {
      const fileName = fileObj.name.toLowerCase();
      
      if (fileName.endsWith('.stl')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const loader = new STLLoader();
            const geometry = loader.parse(e.target.result);
            processLoadedGeometry(geometry);
          } catch (err) {
            alert('解析 STL 檔案失敗。');
            if (onLoadingStateChange) onLoadingStateChange(false);
          }
        };
        reader.readAsArrayBuffer(fileObj);
      } 
      else if (fileName.endsWith('.obj')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const loader = new OBJLoader();
            const objGroup = loader.parse(e.target.result);
            let mergedGeo = null;
            objGroup.traverse((child) => {
              if (child.isMesh && child.geometry) mergedGeo = child.geometry.clone();
            });
            if (mergedGeo) processLoadedGeometry(mergedGeo);
            else alert('OBJ 檔案中未發現有效幾何網格。');
          } catch (err) {
            alert('解析 OBJ 檔案失敗。');
          } finally {
            if (onLoadingStateChange) onLoadingStateChange(false);
          }
        };
        reader.readAsText(fileObj);
      }
      else if (fileName.endsWith('.3mf')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const loader = new ThreeMFLoader();
            const objGroup = loader.parse(e.target.result);
            let mergedGeo = null;
            objGroup.traverse((child) => {
              if (child.isMesh && child.geometry) mergedGeo = child.geometry.clone();
            });
            if (mergedGeo) processLoadedGeometry(mergedGeo);
            else alert('3MF 檔案中未發現有效幾何網格。');
          } catch (err) {
            alert('解析 3MF 檔案失敗。');
          } finally {
            if (onLoadingStateChange) onLoadingStateChange(false);
          }
        };
        reader.readAsArrayBuffer(fileObj);
      }
      else if (fileName.endsWith('.step') || fileName.endsWith('.stp')) {
        if (!occtEngine) {
          alert('STEP 解析引擎仍在初始化中，請稍候再試。');
          if (onLoadingStateChange) onLoadingStateChange(false);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target.result;
            const fileBuffer = new Uint8Array(buffer);
            const result = occtEngine.ReadStepFile(fileBuffer);
            
            if (result && result.meshes && result.meshes.length > 0) {
              const combinedGeo = new THREE.BufferGeometry();
              const positions = [];
              const normals = [];

              result.meshes.forEach((meshData) => {
                const posAttr = meshData.attributes.position;
                const normAttr = meshData.attributes.normal;
                const indexAttr = meshData.index;

                for (let i = 0; i < indexAttr.array.length; i++) {
                  const idx = indexAttr.array[i];
                  positions.push(posAttr.array[idx * 3], posAttr.array[idx * 3 + 1], posAttr.array[idx * 3 + 2]);
                  if (normAttr) {
                    normals.push(normAttr.array[idx * 3], normAttr.array[idx * 3 + 1], normAttr.array[idx * 3 + 2]);
                  }
                }
              });

              combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
              if (normals.length > 0) {
                combinedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
              } else {
                combinedGeo.computeVertexNormals();
              }

              processLoadedGeometry(combinedGeo);
            } else {
              alert('無法從 STEP 檔案中讀取幾何圖形。');
            }
          } catch (err) {
            console.error(err);
            alert('解析 STEP/STP 檔案發生錯誤。');
          } finally {
            if (onLoadingStateChange) onLoadingStateChange(false);
          }
        };
        reader.readAsArrayBuffer(fileObj);
      }
    } else if (modelUrl) {
      const loader = new STLLoader();
      loader.load(
        modelUrl,
        (geometry) => {
          processLoadedGeometry(geometry);
        },
        undefined,
        (err) => {
          console.error('Failed to load sample STL from CrafterModel:', err);
          if (onLoadingStateChange) onLoadingStateChange(false);
        }
      );
    }
  }, [mode, modelUrl, fileObj]);

  useEffect(() => {
    if (mode !== 'viewer' || !orderMeshGroupRef.current) return;

    orderMeshGroupRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color.setHex(selectedColorHex);
        child.material.transparent = isTransparent;
        child.material.opacity = isTransparent ? 0.5 : 1.0;
        child.material.depthWrite = !isTransparent;
        child.material.needsUpdate = true;
      }
    });
  }, [mode, selectedColorHex, isTransparent]);
  
  if (mode === 'viewer') {
    return (
      <group>
        <group position={[0, -0.5, 0]}>
          {[50, 100, 150, 200, 250, 300].map((r) => {
            const points = [];
            const segments = 64;
            for (let i = 0; i <= segments; i++) {
              const theta = (i / segments) * Math.PI * 2;
              points.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            return (
              <lineLoop key={r} geometry={geo}>
                <lineBasicMaterial 
                  color="#3d5a54" 
                  transparent 
                  opacity={r % 100 === 0 ? 0.7 : 0.35} 
                />
              </lineLoop>
            );
          })}
          {Array.from({ length: 12 }).map((_, idx) => {
            const angle = (idx * 30 * Math.PI) / 180;
            const points = [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(Math.cos(angle) * 300, 0, Math.sin(angle) * 300)
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            return (
              <line key={idx} geometry={geo}>
                <lineBasicMaterial color="#3d5a54" transparent opacity={0.4} />
              </line>
            );
          })}
        </group>

        <group ref={orderMeshGroupRef} />
      </group>
    );
  }

  return (
    <group ref={meshRef}>
      <primitive object={scene} scale={[0.004, 0.004, 0.004]} position={[-0.9, -3.1, 0.65]} />

      <mesh position={[0, -1.6, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 2.5, 32, 1, true]} />
        <meshBasicMaterial 
          ref={cylinderMatRef}
          color="#f2713a" 
          transparent 
          opacity={0} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, -2.6, 0]}>
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