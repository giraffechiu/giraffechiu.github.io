// App-order.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { supabase } from './supabaseClient';

const MATERIALS = [
  {
    id: 'pla',
    name: 'PLA 高精度環保線材',
    costPerGram: 2.5,
    description: '表面光潔、極低收縮率，適合原型外殼與機構驗證',
    colors: ['太空灰','極光白','暗夜黑','工業黃','明亮橙'],
  },
  {
    id: 'petg',
    name: 'PETG 高韌性耐溫線材',
    costPerGram: 3.2,
    description: '耐衝擊與韌性、耐溫 75°C，適合日常機構卡扣',
    colors: ['消光黑', '工程灰', '透光橙'],
  },
  {
    id: 'petgcf',
    name: 'PETG-CF 碳纖維增強線材',
    costPerGram: 4.8,
    description: '高模量碳纖維增強、啞光質感、耐溫 80°C，低收縮無翹曲',
    colors: ['消光碳黑'],
  },
  {
    id: 'tpu90a',
    name: 'TPU 90A 高彈性耐磨軟材料',
    costPerGram: 4.8,
    description: '專精軟料列印，兼具橡膠彈性與結構強度',
    colors: ['曜石黑', '橡膠灰', '琥珀橙'],
  },
];

// const PRESET_MODELS = [
//   { name: 'website3Dtest', path: encodeURI('/models/website3Dtest.stl') },
// ];
const PRESET_MODELS = [
  { name: '網站測試用模型', path: '/models/website3Dtest.stl' },
];
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

function calculateQuote(analysis, materialId, infill, layerHeight, quantity) {
  const material = MATERIALS.find(m => m.id === materialId) || MATERIALS[0];
  const density = 1.25;
  const infillRatio = infill / 100;
  const effectiveVolume = analysis.volumeCm3 * (0.25 + 0.75 * infillRatio);
  const estimatedWeightGrams = Math.max(5, Math.round(effectiveVolume * density * 10) / 10);

  const rawCost = estimatedWeightGrams * material.costPerGram;
  const baseHandlingFee = 150;
  const layerFactor = layerHeight <= 0.15 ? 1.3 : 1.0;

  const unitPrice = Math.round(Math.max(200, (rawCost + baseHandlingFee) * layerFactor));

  let discountRate = 0;
  if (quantity >= 50) discountRate = 0.20;
  else if (quantity >= 20) discountRate = 0.15;
  else if (quantity >= 10) discountRate = 0.10;
  else if (quantity >= 5) discountRate = 0.05;

  const subtotal = unitPrice * quantity;
  const discountAmount = Math.round(subtotal * discountRate);
  const totalPrice = subtotal - discountAmount;
  const estimatedLeadDays = Math.max(1, Math.ceil((estimatedWeightGrams * quantity) / 500));

  return {
    estimatedWeightGrams,
    unitPrice,
    subtotal,
    discountRate,
    discountAmount,
    totalPrice,
    estimatedLeadDays,
  };
}

export default function AppOrder({ switchView }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'search' | 'history'

  // Three.js & Quotation Tool State
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);
  const controlsRef = useRef(null);

  const [currentFileName, setCurrentFileName] = useState('website3Dtest.stl');
  const [analysis, setAnalysis] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWireframe, setIsWireframe] = useState(false);
  const [copied, setCopied] = useState(false);

  // User Quotation Options
  const [selectedMaterialId, setSelectedMaterialId] = useState('pla');
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [selectedColor, setSelectedColor] = useState('太空灰');
  const [quantity, setQuantity] = useState(1);

  // Customer Contact Info for Submitting Order to Supabase
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    purpose: ''
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrderNo, setCreatedOrderNo] = useState('');
  const [uploadedFileObj, setUploadedFileObj] = useState(null);

  // Search Order State
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // History Orders & Count State
  const [historyOrders, setHistoryOrders] = useState([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Masking helpers
  const maskName = (name) => {
    if (!name) return '***';
    if (name.length <= 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  const maskPhone = (phone) => {
    if (!phone) return '***';
    if (phone.length <= 6) return phone.substring(0, 2) + '***';
    return phone.substring(0, 3) + '****' + phone.slice(-3);
  };

  const maskFileName = (fname) => {
    if (!fname) return '無附加檔案';
    const parts = fname.split('/');
    const realName = parts[parts.length - 1];
    const nameParts = realName.split('.');
    const ext = nameParts.length > 1 ? '.' + nameParts.pop() : '';
    const name = nameParts.join('.');
    if (name.length <= 3) return name[0] + '***' + ext;
    return name.substring(0, 2) + '***' + name.slice(-2) + ext;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case '排單列印中':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono rounded-full">排單列印中</span>;
      case '後處理中':
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-mono rounded-full">後處理中</span>;
      case '已寄出':
      case '已完成':
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono rounded-full">已寄出</span>;
      default:
        return <span className="px-2.5 py-1 bg-neutral-800 text-neutral-400 border border-neutral-700 text-xs font-mono rounded-full">評估中</span>;
    }
  };

  // Fetch history orders & count
  const fetchHistoryOrders = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('order_no, name, phone, material_type, file_name, status, created_at')
      .order('id', { ascending: false })
      .limit(5);

    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (error || countError) {
      console.error('載入訂單歷史失敗:', error || countError);
    } else {
      setHistoryOrders(data || []);
      setTotalOrderCount(count || 0);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchHistoryOrders();
  }, [activeTab]);

  // Three.js Initialization when tab 'create' is active
  useEffect(() => {
    if (activeTab !== 'create') return;

    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x839794);  //0x505953

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(60, 60, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(80, 120, 90);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight2.position.set(-80, -60, -70);
    scene.add(dirLight2);

    const gridHelper = new THREE.GridHelper(160, 32, 0x3d5a54, 0x1c2b28);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    loadModelFromUrl('/models/website3Dtest.stl');

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      renderer.dispose();
    };
  }, [activeTab]);

  const loadModelFromUrl = (url, displayName) => {
    setIsLoading(true);
    setCurrentFileName(displayName);

    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => {
        handleGeometryLoaded(geometry);
        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load sample STL:', err);
        setIsLoading(false);
      }
    );
  };

  const handleGeometryLoaded = (geometry) => {
    const scene = sceneRef.current;
    if (!scene) return;

    geometry.computeVertexNormals();
    const analysisRes = analyzeGeometry(geometry);
    setAnalysis(analysisRes);

    geometry.center();
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const heightY = bbox.max.y - bbox.min.y;
    geometry.translate(0, heightY / 2, 0);

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
    }

    const material = new THREE.MeshStandardMaterial({
      color: getColorHex(selectedColor),
      metalness: 0.25,
      roughness: 0.45,
      wireframe: isWireframe,
    });

    const mesh = new THREE.Mesh(geometry, material);
    meshRef.current = mesh;
    scene.add(mesh);

    if (controlsRef.current) {
      const maxDim = Math.max(analysisRes.dimensions.x, analysisRes.dimensions.y, analysisRes.dimensions.z);
      const dist = Math.max(50, maxDim * 1.8);
      controlsRef.current.object.position.set(dist * 0.8, dist * 0.7, dist * 0.9);
      controlsRef.current.target.set(0, heightY / 2, 0);
      controlsRef.current.update();
    }
  };

  const getColorHex = (colorName) => {
    switch (colorName) {
      case '極光白':
      case '象牙白':
      case '乳白':
      case '純白':
        return 0xe2e8f0;
      case '太空灰':
      case '工程灰':
      case '橡膠灰':
      case '工業深灰':
        return 0x64748b;
      case '明亮橙':
      case '透光橙':
      case '琥珀橙':
        return 0xf97316;
      case '透明藍':
        return 0x38bdf8;
      case '工業黃':
        return 0xeab308;
      case '消光碳黑':
      case '曜石黑':
      case '消光黑':
      case '純黑':
      default:
        return 0x1e293b;
    }
  };

  useEffect(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material;
      mat.color.setHex(getColorHex(selectedColor));
      mat.wireframe = isWireframe;
      mat.needsUpdate = true;
    }
  }, [selectedColor, isWireframe]);

  useEffect(() => {
    if (!analysis) return;
    const newQuote = calculateQuote(analysis, selectedMaterialId, infill, layerHeight, quantity);
    setQuote(newQuote);
  }, [analysis, selectedMaterialId, infill, layerHeight, quantity]);

  const handleFileUpload = (file) => {
    if (!file.name.toLowerCase().endsWith('.stl')) {
      alert('請上傳 .stl 格式的 3D 模型檔案');
      return;
    }
    setUploadedFileObj(file);
    setIsLoading(true);
    setCurrentFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        handleGeometryLoaded(geometry);
      } catch (err) {
        console.error('Error parsing STL:', err);
        alert('解析 STL 檔案失敗，請確認檔案格式是否正確。');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const copyQuoteSummary = () => {
    if (!quote || !analysis) return;
    const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);

    const text = `【3d砌作 · 線上即時報價單】
檔案名稱: ${currentFileName}
模型尺寸: ${analysis.dimensions.x} × ${analysis.dimensions.y} × ${analysis.dimensions.z} mm
幾何表面積: ${analysis.surfaceAreaCm2} cm²
幾何實體積: ${analysis.volumeCm3} cm³
預估重量: ${quote.estimatedWeightGrams} g / 件

選擇材質: ${currentMat?.name} (${selectedColor})
層高精度: ${layerHeight} mm
填充密度: ${infill}%
訂製數量: ${quantity} 件
----------------------------------------
單件單價: NT$ ${quote.unitPrice.toLocaleString()}
小計總額: NT$ ${quote.subtotal.toLocaleString()}
數量折扣: -NT$ ${quote.discountAmount.toLocaleString()} (${Math.round(quote.discountRate * 100)}% 折扣)
預估總價: NT$ ${quote.totalPrice.toLocaleString()}
預估工期: 約 ${quote.estimatedLeadDays} 個工作天
----------------------------------------
官方 LINE 專人諮詢 ID: giraffechiu
直接加入 LINE: https://line.me/ti/p/~giraffechiu
DELTA 3D PRINTING LAB |  積層造物`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Submit order to Supabase
  const handleFinalSubmitOrder = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim() || !contactForm.email.trim()) {
      alert('請填寫完整的聯絡人資訊（姓名、電話、Email）！');
      return;
    }
    setSubmittingOrder(true);

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;

      const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .ilike('order_no', `${datePrefix}%`);

      if (countError) throw countError;

      const dailySeq = String((count || 0) + 1).padStart(2, '0');
      const orderNo = `${datePrefix}${dailySeq}`;

      let uploadedFilePath = currentFileName;
      if (uploadedFileObj) {
        const fileExt = uploadedFileObj.name.split('.').pop() || 'stl';
        const storagePath = `${orderNo}.${fileExt}`;
        
        const { data: storageData, error: storageError } = await supabase.storage
          .from('order-3D-files')
          .upload(storagePath, uploadedFileObj, { upsert: true });

        if (storageError) {
          console.error('檔案上傳至 Supabase Storage 失敗:', storageError);
        } else {
          uploadedFilePath = storagePath;
        }
      }

      const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
      const materialDesc = `${currentMat?.name || selectedMaterialId} (${selectedColor})`;

      const payload = {
        order_no: orderNo,
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim(),
        material_type: materialDesc,
        layer_height: String(layerHeight),
        purpose: contactForm.purpose.trim() || `數量: ${quantity}件, 填充: ${infill}%`,
        file_name: uploadedFilePath,
        status: '評估中'
      };

      const { error } = await supabase.from('orders').insert([payload]);
      if (error) throw error;

      setCreatedOrderNo(orderNo);
      setSubmitted(true);
      fetchHistoryOrders();
    } catch (err) {
      alert('訂單送出失敗：' + err.message);
      console.error(err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const executeSearch = async (queryNo) => {
    if (!queryNo) return;
    setSearchLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(`order_no.eq.${queryNo},phone.eq.${queryNo}`)
      .order('id', { ascending: false });

    setSearchLoading(false);
    if (error) {
      console.error('查詢失敗:', error);
      setSearchResult([]);
    } else {
      setSearchResult(data || []);
    }
  };

  const handleSearchOrder = (e) => {
    e.preventDefault();
    executeSearch(searchKey.trim());
  };

  const handleGoToSearchWithOrder = () => {
    setSearchKey(createdOrderNo);
    setActiveTab('search');
    executeSearch(createdOrderNo);
  };

  const selectedMaterial = MATERIALS.find((m) => m.id === selectedMaterialId) || MATERIALS[0];

  return (
    <div className="relative z-20 w-full h-full pt-24 pb-16 px-4 md:px-12 overflow-y-auto flex flex-col items-center">
      <div className="max-w-6xl w-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 sm:p-10 md:p-12 shadow-2xl mt-4 space-y-8 font-sans">
        
        {/* Header */}
        <div className="border-b border-neutral-800 pb-6 text-center md:text-left">
          <span className="text-emerald-400 font-mono text-xs tracking-widest uppercase block mb-1">
            ONLINE 3D MODEL PREVIEW &amp; INSTANT QUOTE
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#839794] tracking-tight">
            線上 3D 模型預覽與即時報價
          </h2>
          <p className="text-customText text-sm md:text-base mt-3 leading-relaxed">
            拖曳上傳您的 STL 3D 模型，系統自動計算幾何尺寸與體積，即時取得透明報價並直接送出排單。
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-neutral-800 pb-3 gap-4">
          <div className="flex gap-6 font-mono text-xs md:text-sm">
            <button
              onClick={() => setActiveTab('create')}
              className={`pb-1 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'create'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-[#839794] hover:text-white'
              }`}
            >
              3D預覽與線上估價
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`pb-1 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'search'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-[#839794] hover:text-white'
              }`}
            >
              訂單處理進度查詢
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-1 transition-colors cursor-pointer border-b-2 ${
                activeTab === 'history'
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-[#839794] hover:text-white'
              }`}
            >
              即時排單看板
            </button>
          </div>

          <div className="font-mono text-xs">
            <span className="px-3 py-1.5 bg-emerald-500/10 text-[#839794] border border-emerald-500/30 rounded-lg flex items-center space-x-1.5">
              <span>累積總訂單數：</span>
              <strong className="text-[#eaa486] text-sm">{4623 + totalOrderCount}</strong>
              <span className="text-[#839794]">筆</span>
            </span>
          </div>
        </div>

        {/* TAB 1: CREATE / 3D PREVIEW & QUOTATION */}
        {activeTab === 'create' && (
          <>
            {submitted ? (
              <div className="bg-neutral-900/80 border border-emerald-500/50 rounded-xl p-8 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-white">估價單與 3D 模型檔已成功送出！</h3>
                <p className="text-emerald-400 font-mono text-sm">
                  您的專屬訂單編號：<span className="font-bold underline">{createdOrderNo}</span>
                </p>
                <p className="text-customText text-sm leading-relaxed max-w-md mx-auto">
                  我們已收到您的模型檔案與規格需求。可利用訂單編號或手機號碼至「訂單處理進度查詢」查看最新狀態。
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setUploadedFileObj(null);
                      setContactForm({ name: '', phone: '', email: '', purpose: '' });
                    }}
                    className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    再測一個模型
                  </button>
                  <button
                    onClick={handleGoToSearchWithOrder}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    前往進度查詢 →
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#14201e]/90 backdrop-blur-xl border border-[#2d423e] rounded-2xl p-4 md:p-8 shadow-2xl">
                
                {/* LEFT: 3D Viewport & Geometry Analysis (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2d423e]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">快速樣品:</span>
                      {PRESET_MODELS.map((preset) => (
                        <button
                          key={preset.path}
                          onClick={() => loadModelFromUrl(preset.path, preset.name)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                            currentFileName === preset.name
                              ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                              : 'bg-[#1b2b28] text-slate-300 border-[#2d423e] hover:border-slate-500'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 text-xs bg-[#1b2b28] hover:bg-[#253935] text-amber-400 font-semibold border border-amber-400/40 rounded transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      上傳新 STL 檔
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".stl"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </div>

                  {/* Canvas Container */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="relative w-full h-[380px] md:h-[440px] bg-[#111c1a] rounded-xl overflow-hidden border border-[#2d423e] group shadow-inner"
                  >
                    <div ref={canvasContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

                    {isLoading && (
                      <div className="absolute inset-0 bg-[#0e1715]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-mono text-amber-300">正在解析 3D 幾何頂點與計算體積...</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-[#2d423e] rounded text-[11px] font-mono text-slate-300 truncate max-w-[200px]">
                        {currentFileName}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                      <button
                        onClick={() => setIsWireframe(!isWireframe)}
                        className={`px-2.5 py-1 text-xs rounded border backdrop-blur-md transition-colors ${
                          isWireframe
                            ? 'bg-amber-400 text-black font-bold border-amber-400'
                            : 'bg-black/60 text-slate-300 border-[#2d423e] hover:text-white'
                        }`}
                      >
                        {isWireframe ? '網格模式' : '實體模式'}
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3 z-10 pointer-events-none text-[11px] font-mono text-slate-400 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
                      滑鼠左鍵旋轉 · 滾輪縮放 · 右鍵平移
                    </div>
                  </div>

                  {/* Analysis Cards */}
                  {analysis && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-slate-400 uppercase">尺寸 (X×Y×Z)</span>
                        <span className="text-sm font-bold text-slate-100 font-mono">
                          {analysis.dimensions.x}×{analysis.dimensions.y}×{analysis.dimensions.z}
                        </span>
                        <span className="text-[10px] text-slate-400 block">公釐 (mm)</span>
                      </div>

                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-slate-400 uppercase">實體積 (Volume)</span>
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          {analysis.volumeCm3.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">立方公分 (cm³)</span>
                      </div>

                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-slate-400 uppercase">表面積 (Surface)</span>
                        <span className="text-sm font-bold text-slate-100 font-mono">
                          {analysis.surfaceAreaCm2.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">平方公分 (cm²)</span>
                      </div>

                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-slate-400 uppercase">面數 (Triangles)</span>
                        <span className="text-sm font-bold text-slate-100 font-mono">
                          {analysis.triangleCount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 block">三角網格面</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Parameters & Quote & Submission (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-[#101b19]/90 p-5 rounded-xl border border-[#2d423e]">
                  
                  <div className="space-y-4">
                    {/* 1. Material Selector */}
                    <div>
                      <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                        [ 1. 選擇列印材質 ]
                      </label>
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                        {MATERIALS.map((mat) => (
                          <button
                            key={mat.id}
                            onClick={() => {
                              setSelectedMaterialId(mat.id);
                              setSelectedColor(mat.colors[0]);
                            }}
                            className={`text-left p-2.5 rounded-lg border transition-all ${
                              selectedMaterialId === mat.id
                                ? 'bg-amber-500/10 border-amber-400 text-slate-100 ring-1 ring-amber-400/40'
                                : 'bg-[#162421] border-[#2d423e] text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-bold text-xs">{mat.name}</span>
                              <span className="text-[11px] font-mono text-amber-400">NT$ {mat.costPerGram}/g</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{mat.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Color Selection */}
                    <div>
                      <label className="block text-xs font-mono text-slate-300 uppercase mb-1.5">
                        [ 2. 顏色外觀 ]
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {selectedMaterial.colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color)}
                            className={`px-3 py-1 text-xs rounded border transition-colors ${
                              selectedColor === color
                                ? 'bg-slate-200 text-slate-900 font-bold border-white'
                                : 'bg-[#182624] text-slate-300 border-[#2d423e] hover:border-slate-500'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Layer Height & Infill */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                          層高 (Layer)
                        </label>
                        <select
                          value={layerHeight}
                          onChange={(e) => setLayerHeight(parseFloat(e.target.value))}
                          className="w-full bg-[#182624] border border-[#2d423e] text-slate-200 text-xs rounded p-2 focus:border-amber-400 focus:outline-none"
                        >
                          <option value={0.12}>0.12 mm (超細緻)</option>
                          <option value={0.2}>0.20 mm (標準平衡)</option>
                          <option value={0.28}>0.28 mm (快速打樣)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-slate-300 uppercase mb-1">
                          填充 (Infill)
                        </label>
                        <select
                          value={infill}
                          onChange={(e) => setInfill(parseInt(e.target.value, 10))}
                          className="w-full bg-[#182624] border border-[#2d423e] text-slate-200 text-xs rounded p-2 focus:border-amber-400 focus:outline-none"
                        >
                          <option value={15}>15% (輕量)</option>
                          <option value={20}>20% (標準推薦)</option>
                          <option value={30}>30% (結構強化)</option>
                          <option value={50}>50% (高強度)</option>
                          <option value={100}>100% (實心)</option>
                        </select>
                      </div>
                    </div>

                    {/* 4. Quantity */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-mono text-slate-300 uppercase">
                          訂購數量 (Quantity)
                        </label>
                        {quantity >= 5 && (
                          <span className="text-[11px] font-mono text-amber-400">
                            已套用量產優惠 -{Math.round((quote?.discountRate || 0) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-slate-200 font-bold hover:bg-[#253935] flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-16 bg-[#182624] border border-[#2d423e] text-center text-slate-100 font-mono text-xs rounded p-1.5 focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-slate-200 font-bold hover:bg-[#253935] flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                        <div className="flex gap-1 ml-auto text-[11px] font-mono text-slate-400">
                          <span className="cursor-pointer underline hover:text-white" onClick={() => setQuantity(5)}>5件</span>
                          <span>·</span>
                          <span className="cursor-pointer underline hover:text-white" onClick={() => setQuantity(10)}>10件</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Inputs for Direct Submission */}
                    <div className="space-y-2 pt-2 border-t border-[#2d423e]">
                      <label className="block text-xs font-mono text-emerald-400 uppercase">
                        [ 3. 填寫聯絡資料並送出訂單 ]
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="您的稱呼 *"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          placeholder="聯絡電話 / Line *"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <input
                        type="email"
                        placeholder="電子郵件 (Email) *"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Pricing Summary & Action Buttons */}
                  {quote && (
                    <div className="pt-3 border-t border-[#2d423e] space-y-3">
                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">預估單件重量 / 總價:</span>
                          <span className="font-mono text-slate-200">{quote.estimatedWeightGrams}g · NT$ {quote.totalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">預估製作天數:</span>
                          <span className="font-mono text-slate-200">約 {quote.estimatedLeadDays} 個工作天</span>
                        </div>
                      </div>

                      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <span className="block text-[10px] font-mono text-amber-300 uppercase">總計預估金額 (含稅)</span>
                          <span className="text-xl font-black text-amber-400 font-mono">
                            NT$ {quote.totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">({quantity} 件)</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={copyQuoteSummary}
                          className="w-full bg-[#1b2b28] hover:bg-[#253935] text-slate-200 text-[11px] font-semibold py-2 px-2 rounded border border-[#2d423e] transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copied ? '✓ 已複製規格' : '複製報價規格'}
                        </button>

                        <button
                          onClick={handleFinalSubmitOrder}
                          disabled={submittingOrder}
                          className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black py-2 px-2 rounded transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)] text-center cursor-pointer disabled:opacity-50"
                        >
                          {submittingOrder ? '上傳中...' : '確認送出訂單 →'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </>
        )}

        {/* TAB 2: SEARCH ORDER STATUS */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearchOrder} className="flex gap-3">
              <input 
                type="text"
                placeholder="請輸入您的訂單編號 (例如 2026102701) 或 聯絡電話"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono rounded-lg transition-colors cursor-pointer"
              >
                {searchLoading ? '查詢中...' : '查詢狀態'}
              </button>
            </form>

            {searched && searchResult && (
              <div className="space-y-4 pt-2">
                {searchResult.length === 0 ? (
                  <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-8 text-center text-customText text-sm">
                    未找到對應的訂單資料，請確認訂單編號或電話是否輸入正確。
                  </div>
                ) : (
                  searchResult.map((order) => (
                    <div key={order.id} className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 space-y-4">
                      <div className="flex flex-wrap justify-between items-center border-b border-neutral-800 pb-3 gap-2">
                        <div>
                          <span className="text-emerald-400 font-mono text-xs block">ORDER NO.</span>
                          <span className="text-white font-mono font-bold text-base">{order.order_no}</span>
                        </div>
                        <div>{getStatusBadge(order.status)}</div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-[#839794] block">訂購人：</span>
                          <span className="text-customText">{maskName(order.name)}</span>
                        </div>
                        <div>
                          <span className="text-[#839794] block">材料規格：</span>
                          <span className="text-customText">{order.material_type}</span>
                        </div>
                        <div>
                          <span className="text-[#839794] block">模型檔名：</span>
                          <span className="text-customText">{maskFileName(order.file_name)}</span>
                        </div>
                      </div>

                      {order.purpose && (
                        <div className="text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                          <span className="text-[#839794] block mb-1">規格備註 / 用途：</span>
                          <p className="text-customText leading-relaxed">{order.purpose}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REAL-TIME QUEUE / HISTORY DASHBOARD */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-[#839794] font-mono mb-2">
              <span>即時排單看板與近期動態</span>
              <span>基於隱私考量，個人資料皆已加密處理</span>
            </div>

            {historyLoading ? (
              <div className="text-center py-12 text-customText text-xs font-mono">
                資料載入中...
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="text-center py-12 text-customText text-xs">
                目前尚無排單紀錄。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-emerald-400 bg-neutral-900/50">
                      <th className="py-3 px-4">訂單編號</th>
                      <th className="py-3 px-4">客戶名稱</th>
                      <th className="py-3 px-4">模型檔案</th>
                      <th className="py-3 px-4">材料種類</th>
                      <th className="py-3 px-4">當前進度</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 text-customText">
                    {historyOrders.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-900/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-neutral-300">{item.order_no}</td>
                        <td className="py-3 px-4">{maskName(item.name)}</td>
                        <td className="py-3 px-4 max-w-[150px] truncate">{maskFileName(item.file_name)}</td>
                        <td className="py-3 px-4">{item.material_type}</td>
                        <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}