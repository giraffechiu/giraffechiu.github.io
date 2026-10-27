// App-order.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AppOrder({ switchView }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'search' | 'history'

  // 表單資料狀態
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    materialType: 'hard_pla',
    purpose: '',
    layerHeight: '0.2',
    fileName: ''
  });

  const [selectedFile, setSelectedFile] = useState(null); // 暫存檔案物件
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrderNo, setCreatedOrderNo] = useState('');

  // 查詢訂單進度狀態
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 歷史排單紀錄狀態與總訂單數
  const [historyOrders, setHistoryOrders] = useState([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 隱私遮蔽函式
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

  // 載入公開歷史排單列表與總訂單數
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

  // 處理選擇檔案
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFormData({ ...formData, fileName: file.name });
    }
  };

  // 處理從 Supabase Storage 下載 3D 檔案的函式
  const handleDownloadFile = async (orderNo, originalFileName) => {
    try {
      if (!orderNo) {
        alert('此訂單沒有對應的檔案');
        return;
      }

      const fileExt = originalFileName ? originalFileName.split('.').pop() : 'stl';
      const filePath = `${orderNo}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('order-3D-files')
        .download(filePath);

      if (error) throw error;

      const blobUrl = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filePath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('下載檔案失敗：' + err.message);
      console.error(err);
    }
  };

  // 送出訂單至 Supabase (將 Storage 檔名直接設為訂單編號)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

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

      let uploadedFilePath = '無檔案';
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || 'stl';
        const storagePath = `${orderNo}.${fileExt}`;
        
        const { data: storageData, error: storageError } = await supabase.storage
          .from('order-3D-files')
          .upload(storagePath, selectedFile, { upsert: true });

        if (storageError) {
          console.error('檔案上傳至 Supabase Storage 失敗:', storageError);
          throw new Error('3D 模型檔案上傳失敗，請重試。');
        }

        uploadedFilePath = storagePath;
      }

      const payload = {
        order_no: orderNo,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        material_type: formData.materialType,
        layer_height: formData.layerHeight,
        purpose: formData.purpose.trim(),
        file_name: formData.fileName || '無檔案',
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
      setLoading(false);
    }
  };

  // 查詢特定訂單的共用執行函式
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

  // 表單查詢事件
  const handleSearchOrder = (e) => {
    e.preventDefault();
    executeSearch(searchKey.trim());
  };

  // 點擊「前往進度查詢」時自動代入並查詢
  const handleGoToSearchWithOrder = () => {
    setSearchKey(createdOrderNo);
    setActiveTab('search');
    executeSearch(createdOrderNo);
  };

  return (
    <div className="relative z-20 w-full h-full pt-24 pb-16 px-4 md:px-12 overflow-y-auto flex flex-col items-center">
      
      <div className="max-w-4xl w-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 sm:p-10 md:p-12 shadow-2xl mt-4 space-y-8">
        
        <div className="border-b border-neutral-800 pb-6 text-center md:text-left">
          <span className="text-emerald-400 font-mono text-xs tracking-widest uppercase block mb-1">
            ONLINE QUOTE & ORDER SYSTEM
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#839794] tracking-tight">
            線上傳檔估價與訂單服務
          </h2>
          <p className="text-customText text-sm md:text-base mt-3 leading-relaxed">
            提供即時 3D 模型傳檔估價、訂單進度查詢與公開即時排單看板。
          </p>
        </div>

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
              線上上傳估價
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
                  我們已收到您的模型檔案與規格需求，將會儘快透過 Email 或 Line 與您聯繫確認報價與細節。可利用訂單編號至「訂單處理進度查詢」查看最新狀態。
                </p>
                <div className="pt-4 flex justify-center gap-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setSelectedFile(null);
                      setFormData({
                        name: '',
                        phone: '',
                        email: '',
                        materialType: 'hard_pla',
                        purpose: '',
                        layerHeight: '0.2',
                        fileName: ''
                      });
                    }}
                    className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    再填一張
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
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                      01. 上傳 3D 模型檔案 (STL / STEP)
                    </h3>
                  </div>

                  <div className="border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-neutral-900/40 transition-colors relative">
                    <input 
                      type="file" 
                      accept=".stl,.step,.stp,.obj"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <div className="space-y-2 pointer-events-none">
                      <span className="text-[#839794] font-mono text-xs block">
                        {formData.fileName ? `已選擇檔案：${formData.fileName}` : '點擊或拖曳檔案至此上傳 (最長邊 60cm 以內)'}
                      </span>
                      <p className="text-customText text-xs">支援 STL, STEP, OBJ 格式</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                      02. 選擇材質與列印規格
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-[#839794] block">材質需求 *</label>
                      <select 
                        value={formData.materialType}
                        onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText focus:outline-none focus:border-emerald-500"
                      >
                        <option value="hard_pla">硬質：外觀件-PLA (多色可選)</option>
                        <option value="hard_petg">硬質：結構件-PETG (具備耐溫抗衝擊)</option>
                        <option value="soft_flex">軟質：FLEX (&gt;90A)(最硬)</option>
                        <option value="soft_tpu90">軟質：TPU 90A</option>
                        <option value="soft_tpe80">軟質：TPE 80A</option>
                        <option value="soft_tpe65">軟質：TPE 65A (最軟)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono text-[#839794] block">指定層高 (精度)</label>
                      <select 
                        value={formData.layerHeight}
                        onChange={(e) => setFormData({ ...formData, layerHeight: e.target.value })}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText focus:outline-none focus:border-emerald-500"
                      >
                        <option value="0.05">0.05 mm (極緻細緻，耗時最長)</option>
                        <option value="0.1">0.10 mm (高精細)</option>
                        <option value="0.2">0.20 mm (標準推薦，平衡美觀與效率)</option>
                        <option value="0.3">0.30 mm (快速原型)</option>
                        <option value="0.4">0.40 ~ 0.6mm (粗厚層高，適用大件)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                      03. 用途說明與特殊備註
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-[#839794] block">例如：功能機構件、模型擺飾、卡榫組合等</label>
                    <textarea 
                      rows="3"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      placeholder="請簡單描述此列印件的用途、承受受力狀況或指定顏色需求..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500 resize-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
                      04. 聯絡人資訊
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input 
                      type="text"
                      placeholder="您的稱呼 *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <input 
                      type="text"
                      placeholder="聯絡電話 / Line ID *"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <input 
                      type="email"
                      placeholder="電子郵件 (Email) *"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
                  <button 
                    type="button"
                    onClick={() => switchView('home')}
                    className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                  >
                    ← 返回首頁
                  </button>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-mono font-bold rounded-lg transition-colors shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? '正在上傳模型並傳送估價單...' : '確認送出估價單 →'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6">
            <form onSubmit={handleSearchOrder} className="flex gap-3">
              <input 
                type="text"
                placeholder="請輸入您的訂單編號 (例如 2026102701) 或 聯絡電話"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-customText placeholder:opacity-45 focus:outline-none focus:border-emerald-500"
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-[#839794] block">訂購人：</span>
                          <span className="text-customText">{maskName(order.name)}</span>
                        </div>
                        <div>
                          <span className="text-[#839794] block">材料規格：</span>
                          <span className="text-customText">{order.material_type} ({order.layer_height}mm)</span>
                        </div>
                        <div>
                          <span className="text-[#839794] block">模型的檔名：</span>
                          <span className="text-customText font-mono">{maskFileName(order.file_name)}</span>
                        </div>
                      </div>

                      {order.purpose && (
                        <div className="text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                          <span className="text-[#839794] block mb-1">用途描述：</span>
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

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-[#839794] font-mono mb-2">
              <span>近期 5 筆估價與排單動態</span>
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