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
    name: 'PLA 高強度基礎線材',
    costPerGram: 2.5,
    description: '適合原型外殼與機構驗證、耐溫 55°C，',
    colors: ['純白','太空灰','暗夜黑','工業黃','明亮橙'],
  },
  {
    id: 'petg',
    name: 'PETG 高韌性耐溫線材',
    costPerGram: 3.2,
    description: '耐衝擊與韌性、耐溫 70°C，適合日常機構卡扣',
    colors: ['消光黑', '工程灰', '透光橙'],
  },
  {
    id: 'petgcf',
    name: 'PETG-CF 碳纖維增強線材',
    costPerGram: 4.8,
    description: '高模量碳纖維增強、耐溫 80°C，輕量化首選',
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

const PRESET_MODELS = [
  { name: '網站測試用模型.stl', path: './models/website3dtest.stl' },
];

// 計算報價公式
function calculateQuote(analysis, materialId, infill, layerHeight, quantity) {
  const material = MATERIALS.find(m => m.id === materialId) || MATERIALS[0];
  const density = 1.25;
  const infillRatio = infill / 100;

  // const saRatio = analysis.surfaceAreaCm2 / Math.max(0.01, analysis.volumeCm3);  
  // const calculatedShellFactor = saRatio * 0.15;
  // const shellFactor = Math.max(0.05, Math.min(0.85, calculatedShellFactor));

  // 💡 修正複雜度計算：綜合考量「表面積體積比」與「面數密度」，並設定合理上限
  const saRatio = analysis.surfaceAreaCm2 / Math.max(0.01, analysis.volumeCm3);
  
  // 針對扁平或小體積物件進行權重平滑，避免表面積比過大導致誤判
  let calculatedShellFactor = (saRatio * 0.10) * Math.min(1.0, analysis.volumeCm3 / 50);
  
  // 如果面數很少（代表幾何很平滑簡單），直接給予較低的基礎複雜度
  if (analysis.triangleCount < 2000) {
    calculatedShellFactor = Math.min(calculatedShellFactor, 0.25);
  }

  // shellFactor 被限制在 0.10 到 0.75 之間（即複雜度 10% 到 75%）
  const shellFactor = Math.max(0.10, Math.min(0.75, calculatedShellFactor));

  const effectiveVolume = analysis.volumeCm3 * (shellFactor + (1 - shellFactor) * infillRatio);
  const estimatedWeightGrams = Math.max(5, Math.round(effectiveVolume * density * 10) / 10);

  // 建立「複雜度價格係數」1.5
  // 例如：當複雜度(shellFactor)為 0% 時係數為 1.0（不加價），當複雜度為100%且係數為1.5時，單價可增加為2.5倍  
  const complexityMultiplier = 1.0 + (shellFactor * 1.5); // 調高最後這個數值來使得複雜度對價格的影響更強烈

  // 3. 💡 將係數乘入 rawCost 中
  const rawCost = estimatedWeightGrams * material.costPerGram * complexityMultiplier;


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
  const debugShellFactor = Math.round(shellFactor * 100) / 100;

  return {
    estimatedWeightGrams,
    unitPrice,
    subtotal,
    discountRate,
    discountAmount,
    totalPrice,
    estimatedLeadDays,
    debugShellFactor,
  };
}

export default function AppOrder({ switchView }) {
  const [activeTab, setActiveTab] = useState('create');
  const fileInputRef = useRef(null);
  const controlsRef = useRef(null);
  const occtRef = useRef(null);

  const [currentFileName, setCurrentFileName] = useState('網站測試用模型.stl');
  const [currentModelUrl, setCurrentModelUrl] = useState('./models/website3dtest.stl');
  const [uploadedFileObj, setUploadedFileObj] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransparent, setIsTransparent] = useState(false);

  const [selectedMaterialId, setSelectedMaterialId] = useState('pla');
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [selectedColor, setSelectedColor] = useState('純白');
  const [quantity, setQuantity] = useState(1);

  const [orderItems, setOrderItems] = useState([]);
  const [manualAccumulatedAmount, setManualAccumulatedAmount] = useState(0);
  const [manualAccumulatedCount, setManualAccumulatedCount] = useState(0);

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

  const selectedMaterial = MATERIALS.find((m) => m.id === selectedMaterialId) || MATERIALS[0];
  const liveQuote = analysis ? calculateQuote(analysis, selectedMaterialId, infill, layerHeight, quantity) : null;
  const singleItemQuote = analysis ? calculateQuote(analysis, selectedMaterialId, infill, layerHeight, 1) : null;

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
    const names = fname.split(/[,;]/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return '無附加檔案';

    const formatSingle = (fName) => {
      const parts = fName.split('/');
      const realName = parts[parts.length - 1];
      const nameParts = realName.split('.');
      const ext = nameParts.length > 1 ? '.' + nameParts.pop().toLowerCase() : '';
      const name = nameParts.join('.');
      return name.length <= 3 ? name[0] + '***' + ext : name.substring(0, 2) + '***' + name.slice(-2) + ext;
    };

    if (names.length > 1) {
      return `${formatSingle(names[0])} etc.`;
    }
    return formatSingle(names[0]);
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

  const handleAnalysisComplete = (analysisRes, heightY, maxDim = 100) => {
    setAnalysis(analysisRes);
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      
      const fov = camera.fov || 45;
      const fovRad = (fov * Math.PI) / 180;
      
      let scaleFactor = 1.6;
      if (maxDim > 200) {
        scaleFactor = 0.7;
      } else if (maxDim < 50) {
        scaleFactor = 2.2;
      }

      let optimalDistance = ((maxDim / 2) / Math.sin(fovRad / 2)) * scaleFactor;
      optimalDistance = Math.max(25, Math.min(optimalDistance, 1200));

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

  const handleFileSelected = (file) => {
    const lowerName = file.name.replace(/\.([a-zA-Z0-9]+)$/, (_, ext) => `.${ext.toLowerCase()}`);
    setCurrentFileName(lowerName);
    setUploadedFileObj(file);
    setQuantity(1);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // 💡 移除檔名重複檢查，允許持續累積相同檔名的數量與價格
  const handleAddCurrentItemToOrder = () => {
    const currentPrice = liveQuote ? liveQuote.totalPrice : 200;
    const currentQty = quantity;
    const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
    
    const newItem = {
      id: Date.now(),
      fileName: currentFileName,
      fileObj: uploadedFileObj,
      materialName: currentMat?.name || selectedMaterialId,
      color: selectedColor,
      layerHeight,
      infill,
      quantity: currentQty,
      totalPrice: currentPrice,
    };

    setOrderItems(prev => [...prev, newItem]);
    setManualAccumulatedAmount(prev => prev + currentPrice);
    setManualAccumulatedCount(prev => prev + currentQty);
    
    alert(`已成功將 ${currentFileName} 加入此筆訂單！`);
  };

  const totalAccumulatedAmount = orderItems.length > 0 
    ? manualAccumulatedAmount 
    : (liveQuote ? liveQuote.totalPrice : 200);

  const totalAccumulatedCount = orderItems.length > 0 
    ? manualAccumulatedCount 
    : quantity;

  const handleFinalSubmitOrder = async () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      alert('請填寫完整的聯絡人資訊（姓名、電話）！');
      return;
    }

    let finalItems = [...orderItems];
    if (finalItems.length === 0 && liveQuote) {
      const currentMat = MATERIALS.find((m) => m.id === selectedMaterialId);
      finalItems.push({
        id: Date.now(),
        fileName: currentFileName,
        fileObj: uploadedFileObj,
        materialName: currentMat?.name || selectedMaterialId,
        color: selectedColor,
        layerHeight,
        infill,
        quantity,
        totalPrice: liveQuote.totalPrice,
      });
    }

    if (finalItems.length === 0) {
      alert('請至少評估並加入一個 3D 模型檔案！');
      return;
    }

    setSubmittingOrder(true);

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `${year}${month}${day}`;

      const { data: existingOrders, error: queryError } = await supabase
        .from('orders')
        .select('order_no')
        .ilike('order_no', `${datePrefix}%`);

      if (queryError) throw queryError;

      let maxSeq = 0;
      if (existingOrders && existingOrders.length > 0) {
        existingOrders.forEach(ord => {
          const suffix = parseInt(ord.order_no.replace(datePrefix, ''), 10);
          if (!isNaN(suffix) && suffix > maxSeq) {
            maxSeq = suffix;
          }
        });
      }

      const nextSeq = String(maxSeq + 1).padStart(2, '0');
      const orderNo = `${datePrefix}${nextSeq}`;

      const uploadedFileNames = [];
      for (let i = 0; i < finalItems.length; i++) {
        const item = finalItems[i];
        if (!uploadedFileNames.includes(item.fileName)) {
          uploadedFileNames.push(item.fileName);
        }

        if (item.fileObj) {
          const fileExt = item.fileObj.name.split('.').pop() || 'stl';
          const fileIndexStr = String(i + 1).padStart(2, '0');
          const storagePath = `${orderNo}${fileIndexStr}.${fileExt}`;
          
          const { error: storageError } = await supabase.storage
            .from('order-3D-files')
            .upload(storagePath, item.fileObj, { upsert: true });

          if (storageError) {
            console.error(`檔案 ${item.fileName} 上傳失敗:`, storageError);
          }
        }
      }

      // 💡 明細內容中包含層高與填充資訊
      const detailedPurposeSummary = finalItems.map((item, idx) => 
        `[${idx + 1}] 檔名: ${item.fileName} | 材質: ${item.materialName} | 顏色: ${item.color} | 層高: ${item.layerHeight}mm | 填充: ${item.infill}% | 數量: ${item.quantity}件 | 金額: NT$ ${item.totalPrice.toLocaleString()}`
      ).join('\n');

      const primaryMaterial = finalItems[0].materialName + ' (' + finalItems[0].color + ')';
      const uniqueFileNames = Array.from(new Set(uploadedFileNames)).join(', ');

      const grandTotalAmount = finalItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
      const grandTotalCount = finalItems.reduce((acc, curr) => acc + curr.quantity, 0);

      const fullPurposeText = `${contactForm.purpose.trim() ? contactForm.purpose.trim() + '\n' : ''}--- 報價明細 ---:\n${detailedPurposeSummary}\n-------------------\n總件數: ${grandTotalCount} 件 | 總金額: NT$ ${grandTotalAmount.toLocaleString()}`;

      const payload = {
        order_no: orderNo,
        name: contactForm.name.trim(),
        phone: contactForm.phone.trim(),
        material_type: primaryMaterial,
        layer_height: String(finalItems[0].layerHeight),
        purpose: fullPurposeText,
        file_name: uniqueFileNames,
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

  return (
    <div className="relative z-20 w-full h-full pt-24 pb-16 px-4 md:px-12 overflow-y-auto flex flex-col items-center">
      <div className="max-w-6xl w-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 sm:p-10 md:p-12 shadow-2xl mt-4 space-y-8 font-sans">
        
        <div className="border-b pb-0 border-neutral-800 text-center md:text-left">
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
            <button onClick={() => setActiveTab('create')} className={`pb-1 cursor-pointer border-b-2 ${activeTab === 'create' ? 'border-emerald-400 text-emerald-400 font-bold' : 'border-transparent text-[#839794]'}`}>3D預覽即時估價下單</button>
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
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setUploadedFileObj(null);
                      setOrderItems([]);
                      setManualAccumulatedAmount(0);
                      setManualAccumulatedCount(0);
                      setQuantity(1);
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-greygrey/50 border border-[#2d423e] rounded-2xl p-4 md:p-8 shadow-2xl">
                
                <div className="lg:col-span-7 flex flex-col gap-4">
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-[#2d423e]">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 text-ms bg-[#1b2b28] text-amber-400 font-semibold border border-amber-400/40 rounded flex items-center gap-1.5 cursor-pointer"
                    >
                      載入3D模型
                    </button>
                    <input ref={fileInputRef} type="file" accept=".stl,.obj,.3mf,.step,.stp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])} />
                    <span className="text-xs font-mono text-customText">註:送出訂單才會上傳檔案</span>
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
                    <div className="flex flex-col gap-3">
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

                      {liveQuote && (
                        <div className="w-full bg-[#1b2b28]/80 border border-[#2d423e] rounded-lg p-3.5 flex justify-center items-center gap-3">
                          <span className="text-sm font-bold text-logocolor font-mono">模型複雜度：</span>
                          <span className="font-mono font-bold text-cyan-400 text-sm">
                            {Math.round(liveQuote.debugShellFactor * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-[#101b19]/90 p-5 rounded-xl border border-[#2d423e]">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-emerald-400 uppercase mb-1.5">[ 1. 選擇列印材質 ]</label>
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-emerald-500/40 scrollbar-track-neutral-900">
                        {MATERIALS.map((mat) => (
                          <button key={mat.id} onClick={() => { setSelectedMaterialId(mat.id); setSelectedColor(mat.colors[0]); }} className={`text-left p-2.5 rounded-lg border ${selectedMaterialId === mat.id ? 'bg-amber-900/10 border-amber-400 text-logocolor' : 'bg-[#162421] border-[#2d423e] text-logocolor'}`}>
                            <div className="flex justify-between items-center mb-0.5">
                              <h3 className={`${mat.textColor || 'text-customText'} font-bold text-xs`}>
                                {mat.name}
                              </h3>
                              {/* <span className="text-[11px] font-mono text-customText">NT$ {mat.costPerGram}/g</span> */}
                            </div>
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
                      <label className="block text-xs font-mono text-emerald-400 uppercase mb-1.5">[ 3. 訂購數量與加入訂單 ]</label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-customText font-bold">-</button>
                          <div className="w-16 h-8 flex items-center justify-center bg-amber-900/10 border border-amber-400 text-center text-customText font-mono text-xs rounded select-none">
                            {quantity}
                          </div>
                          <button onClick={() => setQuantity(quantity + 1)} className="w-7 h-7 rounded bg-[#1b2b28] border border-[#2d423e] text-customText font-bold">+</button>
                        </div>

                        <button 
                          onClick={handleAddCurrentItemToOrder}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black py-2 px-4 rounded shadow-lg transition-transform transform hover:scale-105 cursor-pointer"
                        >
                          加入訂單 +
                        </button>
                      </div>
                    </div>
                    
                    {(() => {
                      const displayWeight = quote?.estimatedWeightGrams || 20; 
                      const singleWeight = singleItemQuote ? singleItemQuote.estimatedWeightGrams : displayWeight;
                      const singleUnitPrice = singleItemQuote ? singleItemQuote.totalPrice : 200;
                      
                      const rawTotalPrice = quote?.totalPrice || 200;
                      const displayTotalPrice = Math.max(200, rawTotalPrice); 
                      const displayLeadDays = quote?.estimatedLeadDays || 3;
                      
                      return (
                        <div className="pt-0 space-y-3">
                          <div className="space-y-1 text-xs text-customText">
                            <div className="flex justify-between">
                              <span className="text-customText">預估單件重量 / 單價:</span>
                              <span className="font-mono text-customText">{singleWeight}g · NT$ {singleUnitPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-customText">預估製作天數:</span>
                              <span className="font-mono text-customText">約 {displayLeadDays} 個工作天</span>
                            </div>
                            {orderItems.length > 0 && (
                              // <div className="text-[11px] text-amber-400 pt-1">
                              //   已加入累積品項：{orderItems.length} 個模型 (共 {totalAccumulatedCount} 件)
                              // </div>
                              <div className="text-[11px] text-amber-400 pt-1">
                                已加入累積品項：{orderItems.length > 0 ? new Set(orderItems.map(item => item.fileName)).size : 1} 個模型 (共 {totalAccumulatedCount} 件)
                              </div>
                            )}
                          </div>

                          <div className="bg-amber-900/10 border border-amber-400/30 rounded-xl p-3 flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] font-mono text-customText uppercase">
                                此模型預估金額 (含稅)
                              </span>
                              <span className="text-xl font-black text-amber-400 font-mono">
                                NT$ {displayTotalPrice.toLocaleString()}
                              </span>
                            </div>
                            <span className="text-xs text-customText font-mono">{quantity} 件</span>
                          </div>                          
                        </div>
                      );
                    })()}

                    <label className="block text-xs font-mono text-emerald-400 uppercase">[ 4. 填寫聯絡資料並送出訂單 ]</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="您的稱呼 *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-customText" />
                      <input type="text" placeholder="聯絡電話 / Line *" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="bg-[#182624] border border-[#2d423e] rounded p-2 text-xs text-customText" />
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <div className="bg-[#1b2b28] border border-emerald-500/90 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <span className="block text-[10px] font-mono text-customText uppercase">累積總金額及件數 (含稅)</span>
                          <span className="text-lg font-black text-highlight font-mono">
                            NT$ {totalAccumulatedAmount.toLocaleString()}
                          </span>
                        </div>
                        {/* <span className="text-xs font-mono text-customText">
                          (共 {totalAccumulatedCount} 件 / {orderItems.length > 0 ? orderItems.length : 1} 個模型)
                        </span> */}
                        <span className="text-xs font-mono text-customText">
                          共 {totalAccumulatedCount} 件 / {orderItems.length > 0 ? new Set(orderItems.map(item => item.fileName)).size : 1} 個模型
                        </span>
                      </div>

                      <button onClick={handleFinalSubmitOrder} disabled={submittingOrder} 
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-customText text-[15px] font-black py-2.5 px-2 rounded cursor-pointer">
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
                    {searchResult.map((order, idx) => {
                      const uniqueFileNamesList = order.file_name 
                        ? Array.from(new Set(order.file_name.split(/[,;]/).map(n => n.trim()).filter(Boolean))).join(', ') 
                        : '無';

                      return (
                        <div key={idx} className="bg-[#101b19] border border-[#2d423e] rounded-xl p-5 space-y-3 font-mono text-xs">
                          <div className="flex justify-between items-center border-b border-[#2d423e] pb-2">
                            <span className="text-amber-400 font-bold text-sm">訂單編號：{order.order_no}</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-customText">
                            <div>客戶名稱：<span className="text-customText">{order.name}</span></div>
                            <div>聯絡電話：<span className="text-customText">{order.phone}</span></div>
                            <div className="md:col-span-2">模型檔案：<span className="text-highlight font-bold">{uniqueFileNamesList}</span></div>
                          </div>
                          
                          {order.purpose && (
                            <div className="text-customText pt-2 border-t border-[#2d423e]/50 space-y-2">
                              <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">📋 訂單明細內容：</div>
                              <div className="bg-[#162421]/60 border border-[#2d423e] rounded-lg p-3 space-y-1.5 text-xs">
                                <div className="whitespace-pre-wrap leading-relaxed text-customText font-sans">
                                  {order.purpose}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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