// App-order.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import occtimportjs from 'occt-import-js';
import { CrafterModel } from './CrafterModel';
import { supabase } from './supabaseClient';

const MATERIALS = [
  {
    id: 'pla',
    name: 'PLA 高精度環保線材',
    costPerGram: 2.5,
    description: '表面光潔、極低收縮率，適合原型外殼與機構驗證',
    colors: ['太空灰','極光白','暗夜黑','工業黃','明亮橙'],
    // textColor: 'text-highlight', // 也可直接在這裡指定 Tailwind 類別
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


// 💡 統一採用驗證成功的 ./相對路徑
const PRESET_MODELS = [
  { name: '網站測試用模型', path: './models/website3dtest.stl' },
];

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
  const [activeTab, setActiveTab] = useState('create');
  const fileInputRef = useRef(null);
  const controlsRef = useRef(null);
  const occtRef = useRef(null);

  const [currentFileName, setCurrentFileName] = useState('website3d.stl');
  const [currentModelUrl, setCurrentModelUrl] = useState('./models/website3dtest.stl');
  const [uploadedFileObj, setUploadedFileObj] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransparent, setIsTransparent] = useState(false);
  const [copied, setCopied] = useState(false);

  const [selectedMaterialId, setSelectedMaterialId] = useState('pla');
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [selectedColor, setSelectedColor] = useState('太空灰');
  const [quantity, setQuantity] = useState(1);

  const [contactForm, setContactForm] = useState({ name: '', phone: '', purpose: '' });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrderNo, setCreatedOrderNo] = useState('');

  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [historyOrders, setHistoryOrders] = useState([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 初始化 OCCT STEP 解析引擎
  useEffect(() => {
    occtimportjs({
      locateFile: (path) => {
        if (path.endsWith('.wasm')) {
          return '/' + path;
        }
        return path;
      }
    }).then((occt) => {
      occtRef.current = occt;
    }).catch((err) => {
      console.error('OCCT WASM 初始化失敗:', err);
    });
  }, []);

  const getColorHex = (colorName) => {
    switch (colorName) {
      case '極光白': case '象牙白': case '乳白': case '純白': return 0xe2e8f0;
      case '太空灰': case '工程灰': case '橡膠灰': case '工業深灰': return 0x64748b;
      case '明亮橙': case '透光橙': case '琥珀橙': return 0xf97316;
      case '透明藍': return 0x38bdf8;
      case '工業黃': return 0xeab308;
      case '消光碳黑': case '曜石黑': case '消光黑': case '純黑': default: return 0x1e293b;
    }
  };

  const maskName = (name) => (!name ? '***' : name.length <= 2 ? name[0] + '*' : name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]);
  const maskFileName = (fname) => {
    if (!fname) return '無附加檔案';
    const parts = fname.split('/');
    const realName = parts[parts.length - 1];
    const nameParts = realName.split('.');
    const ext = nameParts.length > 1 ? '.' + nameParts.pop().toLowerCase() : '';
    const name = nameParts.join('.');
    return name.length <= 3 ? name[0] + '***' + ext : name.substring(0, 2) + '***' + name.slice(-2) + ext;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case '排單列印中': return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-mono rounded-full">排單列印中</span>;
      case '後處理中': return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-mono rounded-full">後處理中</span>;
      case '已寄出': case '已完成': return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono rounded-full">已寄出</span>;
      default: return <span className="px-2.5 py-1 bg-neutral-800 text-customText border border-neutral-700 text-xs font-mono rounded-full">評估中</span>;
    }
  };

  const fetchHistoryOrders = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase.from('orders').select('order_no, name, phone, material_type, file_name, status, created_at').order('id', { ascending: false }).limit(5);
    const { count, error: countError } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    if (!error && !countError) {
      setHistoryOrders(data || []);
      setTotalOrderCount(count || 0);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchHistoryOrders();
  }, [activeTab]);

  useEffect(() => {
    if (!analysis) return;
    const newQuote = calculateQuote(analysis, selectedMaterialId, infill, layerHeight, quantity);
    setQuote(newQuote);
  }, [analysis, selectedMaterialId, infill, layerHeight, quantity]);

  // 💡 接收從 CrafterModel 回傳的幾何分析資料、高度與包圍半徑，自動運算出完美的相機距離
  const handleAnalysisComplete = (analysisRes, heightY, maxDim = 100) => {
    setAnalysis(analysisRes);
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      
      const fov = camera.fov || 45;
      const fovRad = (fov * Math.PI) / 180;
      
      // 💡 針對不同大小的模型採用動態係數：
      // 小模型給予較大倍率以拉近，大模型給予壓縮倍率避免推太遠
      let scaleFactor = 1.6;
      if (maxDim > 200) {
        scaleFactor = 0.7; // 大模型壓縮距離，避免相機退太遠
      } else if (maxDim < 50) {
        scaleFactor = 2.2;  // 小模型拉大倍率，確保近距離清晰
      }

      let optimalDistance = ((maxDim / 2) / Math.sin(fovRad / 2)) * scaleFactor;
      optimalDistance = Math.max(25, Math.min(optimalDistance, 1200)); // 設安全區間（最小 25，最大 1200）

      const targetY = heightY / 2;
      controls.target.set(0, targetY, 0);

      camera.position.set(
        optimalDistance * 0.7, 
        targetY + optimalDistance * 0.5, 
        optimalDistance * 0.8
      );

      controls.update();
    }
  };

  // const handleSelectPresetModel = (preset) => {
  //   setUploadedFileObj(null);
  //   setCurrentFileName(preset.name);
  //   setCurrentModelUrl(preset.path);
  // };

  // const handleFileSelected = (file) => {
  //   setCurrentFileName(file.name);
  //   setUploadedFileObj(file);
  // };
  const handleSelectPresetModel = (preset) => {
    setUploadedFileObj(null);
    // 將預設模型的副檔名轉為小寫
    const lowerName = preset.name.replace(/\.([a-zA-Z0-9]+)$/, (_, ext) => `.${ext.toLowerCase()}`);
    setCurrentFileName(lowerName);
    setCurrentModelUrl(preset.path);
  };

  const handleFileSelected = (file) => {
    // 將使用者上傳的檔案名稱副檔名轉為小寫
    const lowerName = file.name.replace(/\.([a-zA-Z0-9]+)$/, (_, ext) => `.${ext.toLowerCase()}`);
    setCurrentFileName(lowerName);
    setUploadedFileObj(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const copyQuoteSummary = () => {
    if (!quote || !analysis) return;
    const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
    const text = `【3d砌作 · 線上即時報價單】
檔案名稱: ${currentFileName}
模型尺寸: ${analysis.dimensions.x} × ${analysis.dimensions.y} × ${analysis.dimensions.z} mm
幾何實體積: ${analysis.volumeCm3} cm³
預估重量: ${quote.estimatedWeightGrams} g / 件

選擇材質: ${currentMat?.name} (${selectedColor})
層高精度: ${layerHeight} mm
填充密度: ${infill}%
訂製數量: ${quantity} 件
----------------------------------------
單件單價: NT$ ${quote.unitPrice.toLocaleString()}
預估總價: NT$ ${quote.totalPrice.toLocaleString()}
預估工期: 約 ${quote.estimatedLeadDays} 個工作天
----------------------------------------
官方 LINE 專人諮詢 ID: giraffechiu`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFinalSubmitOrder = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      alert('請填寫完整的聯絡人資訊（姓名、電話）！');
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
        
        const { error: storageError } = await supabase.storage
          .from('order-3D-files')
          .upload(storagePath, uploadedFileObj, { upsert: true });

        if (storageError) {
          console.error('檔案上傳至 Supabase Storage 失敗:', storageError);
        }
      }

      const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
      const materialDesc = `${currentMat?.name || selectedMaterialId} (${selectedColor})`;

      const payload = {
        order_no: orderNo,
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        material_type: materialDesc,
        layer_height: String(layerHeight),
        purpose: contactForm.purpose.trim() || `數量: ${quantity}件, 填充: ${infill}%`,
        file_name: currentFileName,
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
    const { data } = await supabase.from('orders').select('*').or(`order_no.eq.${queryNo},phone.eq.${queryNo}`).order('id', { ascending: false });
    setSearchLoading(false);
    setSearchResult(data || []);
  };

  const selectedMaterial = MATERIALS.find((m) => m.id === selectedMaterialId) || MATERIALS[0];

  return (
    <div className="relative z-20 w-full h-full pt-24 pb-16 px-4 md:px-12 overflow-y-auto flex flex-col items-center">
      <div className="max-w-6xl w-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 sm:p-10 md:p-12 shadow-2xl mt-4 space-y-8 font-sans">
        
        <div className="border-b pb-0 border-neutral-800  text-center md:text-left">
          <span className="text-emerald-400 font-mono text-xs tracking-widest uppercase block mb-1">
            ONLINE 3D MODEL PREVIEW &amp; INSTANT QUOTE
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#839794] tracking-tight">
            零接觸報價系統
          </h2>
          <p className="text-customText text-xs md:text-sm mb-6">上傳3D檔案、即時報價、送出訂單、查詢進度</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-neutral-800 pb-3 gap-4">
          <div className="flex gap-6 font-mono text-xs md:text-sm">
            <button onClick={() => setActiveTab('create')} className={`pb-1 cursor-pointer border-b-2 ${activeTab === 'create' ? 'border-emerald-400 text-emerald-400 font-bold' : 'border-transparent text-[#839794]'}`}>3D預覽與線上估價下單</button>
            <button onClick={() => setActiveTab('search')} className={`pb-1 cursor-pointer border-b-2 ${activeTab === 'search' ? 'border-emerald-400 text-emerald-400 font-bold' : 'border-transparent text-[#839794]'}`}>訂單處理進度查詢</button>
            <button onClick={() => setActiveTab('history')} className={`pb-1 cursor-pointer border-b-2 ${activeTab === 'history' ? 'border-emerald-400 text-emerald-400 font-bold' : 'border-transparent text-[#839794]'}`}>即時排單看板</button>
          </div>
          <div className="font-mono text-xs">
            <span className="px-3 py-1.5 bg-emerald-500/10 text-[#839794] border border-emerald-500/30 rounded-lg">
              累積總訂單數(含露天)：<strong className="text-highlight text-sm">{4623 + totalOrderCount}</strong> 筆
            </span>
          </div>
        </div>

        {activeTab === 'create' && (
          <>
            {submitted ? (
              <div className="bg-neutral-900/80 border border-emerald-500/50 rounded-xl p-8 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-highlight">線上訂單與3D模型檔案已成功送出！</h3>
                <p className="text-emerald-400 font-mono text-sm">
                  您的專屬訂單編號：<span className="font-bold underline">{createdOrderNo}</span>
                </p>
                <p className="text-customText text-sm leading-relaxed max-w-md mx-auto">
                  我們已收到您的訂單。<br />
                  可利用訂單編號或手機號碼至「訂單處理進度查詢」查看最新狀態。
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setUploadedFileObj(null);
                      setContactForm({ name: '', phone: '', purpose: '' });
                    }}
                    className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-customText text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    再評估一個模型
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('search');
                      setSearchKey(createdOrderNo);
                      setSubmitted(false);
                      executeSearch(createdOrderNo);
                    }}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-customText text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    前往進度查詢 →
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#75817f]/50 border border-[#2d423e] rounded-2xl p-4 md:p-8 shadow-2xl">
                
                <div className="lg:col-span-7 flex flex-col gap-4">
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2d423e]">
                    {/* <div className="flex items-center gap-2">
                      <span className="text-xs text-customText font-mono">快速樣品:</span>
                      {PRESET_MODELS.map((preset) => (
                        <button
                          key={preset.path}
                          onClick={() => handleSelectPresetModel(preset)}
                          className={`px-2.5 py-1 text-xs rounded border ${currentFileName === preset.name ? 'bg-amber-400 text-customText font-bold' : 'bg-[#1b2b28] text-customText border-[#2d423e]'}`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div> */}

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 text-xs bg-[#1b2b28] text-amber-400 font-semibold border border-amber-400/40 rounded flex items-center gap-1.5 cursor-pointer"
                    >
                      3D模型檔案上傳
                    </button>
                    <input ref={fileInputRef} type="file" accept=".stl,.obj,.3mf,.step,.stp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])} />
                  </div>

                  <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="relative w-full h-[380px] md:h-[440px] rounded-xl overflow-hidden border border-[#2d423e]">
                    <Canvas 
                      camera={{ position: [0, 200, 300], fov: 45, near: 0.1, far: 5000 }} 
                      className="w-full h-full cursor-grab active:cursor-grabbing"
                    >
                      <color attach="background" args={['#839794']} />
                      <ambientLight intensity={0.8} />
                      <directionalLight position={[80, 120, 90]} intensity={1} />
                      <directionalLight position={[-80, -60, -70]} intensity={0.5} />
                      <Environment preset="city" />

                      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />

                      <CrafterModel 
                        mode="viewer"
                        modelUrl={currentModelUrl}
                        fileObj={uploadedFileObj}
                        occtEngine={occtRef.current}
                        selectedColorHex={getColorHex(selectedColor)}
                        isTransparent={isTransparent}
                        onAnalysisComplete={handleAnalysisComplete}
                        onLoadingStateChange={setIsLoading}
                      />
                    </Canvas>

                    {isLoading && (
                      <div className="absolute inset-0 bg-[#0e1715]/85 flex flex-col items-center justify-center gap-3 z-20">
                        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-mono text-amber-300">解析 3D 幾何中...</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3 z-10">
                      <span className="px-2.5 py-1 bg-black/60 border border-[#2d423e] rounded text-[11px] font-mono text-customText">
                        {currentFileName}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 z-10">
                      <button 
                        onClick={() => setIsTransparent(!isTransparent)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isTransparent ? 'bg-sky-900 text-customText' : 'bg-[#1b2b28]/80 text-customText hover:bg-emerald-500'
                        }`}
                      >
                        {isTransparent ? '透明模式' : '模型檢視切換'}
                      </button>
                    </div>
                  </div>

                  {analysis && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-customText uppercase">尺寸 (X×Y×Z)</span>
                        <span className="text-sm font-bold text-customText font-mono">{analysis.dimensions.x}×{analysis.dimensions.y}×{analysis.dimensions.z} mm</span>
                      </div>
                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-customText uppercase">實體積 (Volume)</span>
                        <span className="text-sm font-bold text-customText font-mono">{analysis.volumeCm3.toLocaleString()} cm³</span>
                      </div>
                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-customText uppercase">表面積 (Surface)</span>
                        <span className="text-sm font-bold text-customText font-mono">{analysis.surfaceAreaCm2.toLocaleString()} cm²</span>
                      </div>
                      <div className="bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3">
                        <span className="block text-[11px] font-mono text-customText uppercase">面數 (Triangles)</span>
                        <span className="text-sm font-bold text-customText font-mono">{analysis.triangleCount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-[#101b19]/90 p-5 rounded-xl border border-[#2d423e]">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-emerald-400 uppercase mb-1.5">[ 1. 選擇列印材質 ]</label>
                      {/* <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1"> */}
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-500/40 scrollbar-track-neutral-900">
                        {MATERIALS.map((mat) => (
                          <button key={mat.id} onClick={() => { setSelectedMaterialId(mat.id); setSelectedColor(mat.colors[0]); }} className={`text-left p-2.5 rounded-lg border ${selectedMaterialId === mat.id ? 'bg-amber-900/10 border-amber-400 text-logocolor' : 'bg-[#162421] border-[#2d423e] text-logocolor'}`}>
                            <div className="flex justify-between items-center mb-0.5">
                            {/* <span className="font-bold text-xs">{mat.name}</span> */}
                            {/* 💡 將你的自訂顏色類別套用在這裡 */}
                            <h3 className={`${mat.textColor || 'text-customText'} font-bold text-xs`}>
                              {mat.name}
                            </h3>
                            <span className="text-[11px] font-mono text-customText">NT$ {mat.costPerGram}/g</span></div>
                            
                            <p className="text-[11px] text-logocolor/50">{mat.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-emerald-400 uppercase mb-1.5">[ 2. 顏色外觀 ]</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedMaterial.colors.map((color) => (
                          <button key={color} onClick={() => setSelectedColor(color)} className={`px-3 py-1 text-xs rounded border ${selectedColor === color ? 'bg-amber-900/10 text-customText border-amber-400 font-bold' : 'bg-[#162421] text-customText border-[#2d423e]'}`}>
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-customText uppercase mb-1">層高 (Layer)</label>
                        <select value={layerHeight} onChange={(e) => setLayerHeight(parseFloat(e.target.value))} className="w-full bg-[#182624] border border-[#2d423e] text-customText text-xs rounded p-2">
                          <option value={0.1}>0.10 mm (超細緻)</option>
                          <option value={0.2}>0.20 mm (標準平衡)</option>
                          <option value={0.3}>0.30 mm (快速打樣)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-customText uppercase mb-1">填充 (Infill)</label>
                        <select value={infill} onChange={(e) => setInfill(parseInt(e.target.value, 10))} className="w-full bg-[#182624] border border-[#2d423e] text-customText text-xs rounded p-2">
                          <option value={15}>15% (輕量)</option>
                          <option value={20}>20% (標準推薦)</option>
                          <option value={30}>30% (結構強化)</option>
                          <option value={50}>50% (高強度)</option>
                          <option value={100}>100% (實心)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-emerald-400 uppercase mb-1.5">[ 3. 訂購數量與報價 ]</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-customText font-bold">-</button>
                        {/* <input type="number" min="1" max="1000" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))} 
                        className="w-16 bg-amber-900/10 border border-amber-400 text-center text-customText font-mono text-xs rounded p-1.5" /> */}
                        {/* 改用 div 顯示數量，完全沒有箭頭問題 */}
                        <div className="w-16 h-8 flex items-center justify-center bg-amber-900/10 border border-amber-400 text-center text-customText font-mono text-xs rounded select-none">
                          {quantity}
                        </div>
                        <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-customText font-bold">+</button>
                      </div>
                    </div>
                    
                    {(() => {
                      const displayWeight = quote?.estimatedWeightGrams || 20; 
                      const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
                      const costPerGram = currentMat?.costPerGram || 2.5;
                      
                      const rawTotalPrice = quote?.totalPrice || Math.round(displayWeight * quantity * costPerGram);
                      const displayTotalPrice = Math.max(200, rawTotalPrice); 
                      const displayLeadDays = quote?.estimatedLeadDays || 3;

                      return (
                        <div className="pt-0 space-y-3">
                          <div className="space-y-1 text-xs text-customText">
                            <div className="flex justify-between">
                              <span className="text-customText">
                                {quote ? '預估單件重量 / 總價:' : '預估單件重量 / 總價 (預設20g):'}
                              </span>
                              <span className="font-mono text-customText">{displayWeight}g · NT$ {displayTotalPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-customText">預估製作天數:</span>
                              <span className="font-mono text-customText">約 {displayLeadDays} 個工作天</span>
                            </div>
                          </div>

                          <div className="bg-amber-900/10 border border-amber-400/30 rounded-xl p-3 flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-mono text-customText uppercase">
                                總計預估金額 {rawTotalPrice < 200 ? '(含最低基本費)' : '(含稅)'}
                              </span>
                              <span className="text-xl font-black text-amber-400 font-mono">
                                NT$ {displayTotalPrice.toLocaleString()}
                              </span>
                            </div>
                            <span className="text-xs text-customText font-mono">({quantity} 件)</span>
                          </div>                          
                        </div>
                      );
                    })()}

                    <label className="block text-xs font-mono text-emerald-400 uppercase">[ 4. 填寫聯絡資料並送出訂單 ]</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="您的稱呼 *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-customText" />
                      <input type="text" placeholder="聯絡電話 / Line *" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-customText" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={copyQuoteSummary} className="w-full bg-[#1b2b28] text-customText text-[11px] font-semibold py-2 px-2 rounded border border-[#2d423e]">
                        {copied ? '✓ 已複製規格' : '複製報價規格'}
                      </button>
                      <button onClick={handleFinalSubmitOrder} disabled={submittingOrder} 
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-customText text-[11px] font-black py-2 px-2 rounded">
                      {/* className="px-8 py-3 bg-emerald-500 text-black text-sm md:text-base font-semibold rounded-full hover:bg-emerald-400 hover:text-[#C5B9AC] shadow-xl transition-all transform hover:scale-105 cursor-pointer pointer-events-auto"> */}
                        {submittingOrder ? '上傳中...' : '確認送出訂單 →'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6 bg-[#101b19]/50 border border-[#2d423e] rounded-2xl p-6 md:p-8">
            <div className="border-b border-[#2d423e] pb-4">
              <h3 className="text-lg font-bold text-highlight">進度查詢</h3>
              {/* <p className="text-xs text-logocolor/50 mt-1">請輸入您的訂單編號或手機號碼以查詢最新進度。</p> */}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); executeSearch(searchKey.trim()); }} className="flex gap-3">
              <input 
                type="text" 
                placeholder="請輸入訂單編號 (例如 2026102801) 或手機號碼" 
                value={searchKey} 
                onChange={(e) => setSearchKey(e.target.value)} 
                className="flex-1 bg-[#162421] border border-[#2d423e] rounded-lg px-4 py-3 text-sm text-logocolor/50 font-mono focus:outline-none focus:border-amber-400" 
                required 
              />
              <button 
                type="submit" 
                disabled={searchLoading} 
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-customText text-xs font-mono rounded-lg transition-colors cursor-pointer"
              >
                {searchLoading ? '查詢中...' : '查詢狀態'}
              </button>
            </form>

            {searched && (
              <div className="mt-6 space-y-4">
                {searchResult && searchResult.length > 0 ? (
                  <div className="space-y-4">
                    {searchResult.map((order, idx) => (
                      <div key={idx} className="bg-[#101b19] border border-[#2d423e] rounded-xl p-5 space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-[#2d423e] pb-2">
                          <span className="text-amber-400 font-bold text-sm">訂單編號：{order.order_no}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-customText">
                          <div>客戶名稱：<span className="text-customText">{order.name}</span></div>
                          <div>聯絡電話：<span className="text-customText">{order.phone}</span></div>
                          <div>選擇材質：<span className="text-customText">{order.material_type}</span></div>
                          <div>模型檔案：<span className="text-customText">{maskFileName(order.file_name)}</span></div>
                        </div>
                        {order.purpose && (
                          <div className="text-customText pt-1 border-t border-[#2d423e]/50">
                            備註需求：{order.purpose}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-[#101b19] border border-[#2d423e] rounded-xl text-customText font-mono text-xs">
                    查無此訂單編號或手機號碼，請確認輸入是否正確。
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-emerald-400 bg-neutral-900/50">
                    <th className="py-3 px-4">訂單編號</th>
                    <th className="py-3 px-4">客戶名稱</th>
                    <th className="py-3 px-4">模型檔案</th>
                    <th className="py-3 px-4">當前進度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-customText">
                  {historyOrders.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-highlight">{item.order_no}</td>
                      <td className="py-3 px-4">{maskName(item.name)}</td>
                      <td className="py-3 px-4">{maskFileName(item.file_name)}</td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}