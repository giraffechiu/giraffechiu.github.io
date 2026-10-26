// App.jsx
import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls, Scroll, Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import { CrafterModel } from './CrafterModel';
import { supabase } from './supabaseClient'; // 引入 Supabase 客戶端
import AppGuestbook from './App-guestbook'; // 引入剛剛拆分出來的留言板元件

function FadeInText({ text }) {
  return (
    <span 
      style={{ fontFamily: '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif' }} 
      className="text-orange-400 font-bold tracking-wider inline-block"
    >
      {text}
    </span>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [homeKey, setHomeKey] = useState(0); // 用來強制重新掛載首頁以確保捲動條歸零

  const switchView = (viewName) => {
    setCurrentView(viewName);
    if (viewName === 'home') {
      setHomeKey(prev => prev + 1);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // 取得或初始化當前訪客的唯一識別碼（用於判斷是否為自己的留言）
  const [clientId] = useState(() => {
    let id = localStorage.getItem('crafter_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('crafter_client_id', id);
    }
    return id;
  });

  const [messages, setMessages] = useState([]);
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');

  // 正在編輯的留言 ID 與內容狀態
  const [editingId, setEditingId] = useState(null);
  const [editAuthor, setEditAuthor] = useState('');
  const [editContent, setEditContent] = useState('');

  // 從 Supabase 雲端載入留言
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('guestbook_messages')
      .select('*')
      .order('id', { ascending: false }); // 依照時間新到舊排序

    if (error) {
      console.error('載入留言失敗:', error);
    } else {
      setMessages(data || []);
    }
  };

  // 確保初次載入或切換視圖時，強制模擬對焦與點擊以啟動 3D 滾動條
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      window.focus();
      
      const canvasContainer = document.querySelector('canvas');
      if (canvasContainer) {
        canvasContainer.click();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [currentView, homeKey]);

  useEffect(() => {
    fetchMessages();
  }, []);

  // 新增留言（寫入雲端）
  const handleAddMessage = async (e) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;

    const newMessage = {
      id: Date.now(),
      name: author.trim(),
      text: content.trim(),
      date: new Date().toISOString().split('T')[0],
      client_id: clientId
    };

    const { error } = await supabase
      .from('guestbook_messages')
      .insert([newMessage]);

    if (error) {
      alert('送出留言失敗，請稍後再試！');
      console.error(error);
    } else {
      setAuthor('');
      setContent('');
      fetchMessages();
    }
  };

  // 刪除自己的留言（從雲端刪除）
  const handleDeleteMessage = async (id) => {
    if (!window.confirm('確定要刪除這則留言嗎？')) return;

    const { error } = await supabase
      .from('guestbook_messages')
      .delete()
      .eq('id', id);

    if (error) {
      alert('刪除失敗！');
    } else {
      if (editingId === id) setEditingId(null);
      fetchMessages();
    }
  };

  // 開啟編輯自己的留言模式
  const handleStartEdit = (msg) => {
    setEditingId(msg.id);
    setEditAuthor(msg.name);
    setEditContent(msg.text);
  };

  // 儲存編輯（更新雲端資料）
  const handleSaveEdit = async (id) => {
    if (!editAuthor.trim() || !editContent.trim()) return;

    const { error } = await supabase
      .from('guestbook_messages')
      .update({ name: editAuthor.trim(), text: editContent.trim() })
      .eq('id', id);

    if (error) {
      alert('更新失敗！');
    } else {
      setEditingId(null);
      fetchMessages();
    }
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 text-white overflow-x-hidden font-sans">
      
      {/* 1. 頂端全螢幕橫向滿版導覽列 (w-full) */}
      <div className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-6 md:px-12 py-1 bg-neutral-900/5 backdrop-blur-md shadow-2xl">      
        <button 
          onClick={() => switchView('home')}
          className="flex items-center space-x-6 cursor-pointer text-left bg-transparent border-none p-0"
        >
          <img 
            src="/images/3d logo word_500.png" 
            alt="3D Logo" 
            className="w-auto object-contain shrink-0" 
            style={{ height: '50px' }} 
          />
          <h1 className="text-xs md:text-sm tracking-widest uppercase font-mono text-[#839794] hover:text-[#C5B9AC] transition-colors hidden sm:block">
            DELTA 3D PRINTING LAB
          </h1>
        </button>

        <nav className="flex items-center space-x-4 text-xs md:text-sm font-mono pointer-events-auto">
          <button 
            onClick={() => switchView('home')}
            className={`transition-colors cursor-pointer ${currentView === 'home' ? 'text-emerald-400 underline underline-offset-4' : 'text-[#839794] hover:text-[#C5B9AC]'}`}
          >
            首頁導覽
          </button>
          <span className="text-customText">/</span>
          <button 
            onClick={() => switchView('guestbook')}
            className={`transition-colors cursor-pointer ${currentView === 'guestbook' ? 'text-emerald-400 underline underline-offset-4' : 'text-[#839794] hover:text-[#C5B9AC]'}`}
          >
            訪客留言板
          </button>
        </nav>
      </div>

      {/* 2. 背景圖片浮水印 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden px-4">
        <img 
          src="/images/CRAFTER 600.png" 
          alt="CRAFTER 600 Watermark" 
          className="w-full max-w-7xl object-contain opacity-15 select-none"
        />
      </div>

      {currentView === 'guestbook' ? (
        /* ==================== 訪客留言板獨立元件 ==================== */
        <AppGuestbook 
          messages={messages}
          author={author}
          setAuthor={setAuthor}
          content={content}
          setContent={setContent}
          handleAddMessage={handleAddMessage}
          editingId={editingId}
          editAuthor={editAuthor}
          setEditAuthor={setEditAuthor}
          editContent={editContent}
          setEditContent={setEditContent}
          handleStartEdit={handleStartEdit}
          handleSaveEdit={handleSaveEdit}
          setEditingId={setEditingId}
          handleDeleteMessage={handleDeleteMessage}
          clientId={clientId}
          switchView={switchView}
        />
      ) : (
        /* ==================== 首頁 3D 滾動導覽頁面 ==================== */
        <div key={homeKey} className="w-full h-full">
          
          {/* === 區段 2 的固定標示與連接線 === */}
          <div 
            id="cylinder-label"
            className="absolute inset-0 pointer-events-none z-40 hidden md:block"
            style={{ opacity: 0 }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line x1="53%" y1="65%" x2="68%" y2="42%" stroke="#f97316" strokeWidth="0.5" />
            </svg>
            <div className="absolute right-[26%] top-[38%] bg-neutral-900 border border-orange-500/50 px-5 py-2.5 rounded-md shadow-xl pointer-events-auto whitespace-nowrap">
              <div className="text-[10px] text-customText tracking-wider mb-0.5">列印範圍</div>
              <FadeInText text="直徑 600mm × 高度 600mm" />
            </div>
          </div>

          {/* === 區段 4 的固定標示與連接線 === */}
          <div 
            id="sphere-label"
            className="absolute inset-0 pointer-events-none z-40 hidden md:block"
            style={{ opacity: 0 }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line x1="48.5%" y1="80%" x2="40%" y2="57%" stroke="#f97316" strokeWidth="0.5" />
            </svg>
            <div className="absolute left-[35%] top-[55%] bg-neutral-900 border border-orange-500/50 px-5 py-2.5 rounded-md shadow-xl pointer-events-auto whitespace-nowrap">
              <div className="text-[10px] text-customText tracking-wider mb-0.5">噴頭組</div>
              <FadeInText text="零間隙 × 單色 ×三色" />
            </div>
          </div>

          {/* 3. 3D 畫布與滾動控制區 */}
          <Canvas className="w-full h-full z-10" camera={{ position: [0, 0, 10], fov: 45 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 20, 15]} intensity={1.5} />
            <Environment preset="city" />
            
            <ScrollControls pages={4.7} damping={0.3}>
              <CrafterModel />

              <Scroll html className="w-full">
                
                {/* 區段 1：首頁標題區 */}
                <section className="h-[55vh] md:h-[75vh] w-screen flex flex-col justify-end px-9 py-3 md:p-24 pt-32 pointer-events-none">
                  <motion.div 
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    className="max-w-xl pointer-events-auto"
                  >
                    <p className="text-emerald-400 font-mono text-xs md:text-sm mb-2">Industrial Grade Delta 3D Printer</p>
                     <h3 className="text-3xl sm:text-5xl md:text-7xl text-[#839794] font-black tracking-tight mb-4 md:mb-6 [font-family:'Arial_Black',Gadget,sans-serif]">
                      動中之靜<br />
                      <span className="text-[#839794]/60">
                      Precision in Motion.
                      </span>
                     </h3>
                    <p className="text-customText text-xs sm:text-sm md:text-base leading-relaxed">
                      CRAFTER 600是100%由3d砌作設計、製造、組裝，<br />
                      高精度結構的工業FDM 3D列印機，<br />
                      結合高動力驅動與高剛性碳纖維臂，大尺寸列印無極限。
                    </p>
                  </motion.div>
                </section>

                {/* 區段 2：特性介紹區 */}            
                <section className="relative min-h-screen md:h-screen w-screen flex flex-col md:flex-row items-center justify-center md:justify-between px-6 md:px-24 py-16 md:py-0">
                  <div className="w-full flex flex-col md:flex-row md:justify-between md:items-center space-y-6 md:space-y-0 z-20 pointer-events-auto">
                    <div className="w-full md:w-1/2 order-1 md:order-1">
                      <h4 className="text-xl md:text-4xl font-semibold mb-3 md:mb-4 text-emerald-400">大尺寸極致結構</h4>
                      <p className="text-customText text-xs md:text-base leading-relaxed mb-4 md:mb-6">
                      搭載高效能 Klipper 核心與雙區加熱床，<br />
                      超大列印空間，<br />
                      確保長時間運作下的穩定度與表面品質。
                      </p>
                      <div className="flex space-x-12 font-mono text-xs text-customText">
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">BUILD VOLUME</span>
                          Ø600 x H600 mm
                        </div>
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">MOTOR DRIVE</span>
                          high power motor
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-1/5 relative flex flex-col items-center justify-center order-2 md:order-2 mt-4 md:mt-0 md:ml-auto">
                      <div className="w-32 md:w-full flex items-center justify-center">
                        <img 
                          src="/images/雙區加熱大尺寸列印平台.jpg" 
                          alt="Feature Preview" 
                          className="w-full h-auto object-cover opacity-80 hover:scale-110 transition-transform duration-500 border border-neutral-800 rounded-lg shadow-2xl pointer-events-auto"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* 區段 3：零間隙磁關節聯桿介紹區 */}
                <section className="relative min-h-screen md:h-screen w-screen flex flex-col md:flex-row items-center md:justify-between px-6 md:px-24 py-20 md:py-0">
                  <div className="w-full flex flex-col md:flex-row md:justify-between md:items-center space-y-16 md:space-y-0 z-20 pointer-events-auto">
                    <div className="w-full md:w-1/2 order-1 md:order-2 text-left md:text-right">
                      <h4 className="text-xl md:text-4xl font-semibold mb-3 md:mb-4 text-emerald-400">零間隙磁關節聯桿</h4>
                      <p className="text-customText text-xs md:text-base leading-relaxed mb-4">
                        採用高強度碳纖維桿搭配高磁性球頭，<br />
                        完美消除機械背隙，<br />
                        確保每一次高速往復列印都能保持精準度。
                      </p>
                      <div className="flex justify-start md:justify-end space-x-6 font-mono text-xs text-customText">
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">CONNECTION</span>
                          Zero Backlash
                        </div>
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">STABILITY</span>
                          High Rigidity
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-1/3 relative flex items-center space-x-3 order-2 md:order-1">
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <div className="h-40 md:h-64 flex items-center justify-center">
                          <img 
                            src="/images/零間隙磁關節聯桿1.jpg" 
                            alt="Magnetic Joint 1" 
                            className="max-w-full max-h-full object-cover opacity-90 hover:scale-150 transition-transform duration-500 border border-neutral-800 rounded-lg"
                          />
                        </div>
                        <div className="h-40 md:h-64 flex items-center justify-center">
                          <img 
                            src="/images/零間隙磁關節聯桿2.jpg" 
                            alt="Magnetic Joint 2" 
                            className="max-w-full max-h-full object-cover opacity-90 hover:scale-150 transition-transform duration-500 border border-neutral-800 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 區段 4：特性介紹區 (噴頭組) */}
                <section className="relative min-h-screen md:h-screen w-screen flex flex-col md:flex-row items-center justify-center md:justify-between px-6 md:px-24 py-16 md:py-0">
                  <div className="w-full flex flex-col md:flex-row md:justify-between md:items-center space-y-6 md:space-y-0 z-20 pointer-events-auto">
                    <div className="w-full md:w-1/2 order-1 md:order-1">
                      <h4 className="text-xl md:text-4xl font-semibold mb-3 md:mb-4 text-emerald-400">緊湊設計噴頭組</h4>
                      <p className="text-customText text-xs md:text-base leading-relaxed mb-4 md:mb-6">
                        融合輕量化結構與高效散熱、<br />
                        千錘百鍊的噴頭組設計，<br />
                        完美對應高負載連續作業，<br />
                        確保長時間運轉下的出料流暢與穩定度。
                      </p>
                      <div className="flex space-x-12 font-mono text-xs text-customText">
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">單色</span>
                          PLA/PETG/TPU etc.
                        </div>
                        <div className="border-l border-emerald-500 pl-3">
                          <span className="block text-emerald-400">三色</span>
                          直覺簡便的換料系統
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-1/3 relative flex items-center space-x-3 order-2 md:order-2 mt-4 md:mt-0">
                        <div className="grid grid-cols-2 gap-3 w-full">
                          <div className="h-40 md:h-64 flex items-center justify-center relative">
                            <img 
                              src="/images/效應器單色.jpg" 
                              alt="Magnetic Joint 1" 
                              className="max-w-full max-h-full object-cover opacity-90 hover:scale-150 transition-transform duration-500 border border-neutral-800 rounded-lg relative hover:z-30"
                            />
                          </div>
                          <div className="h-40 md:h-64 flex items-center justify-center relative">
                            <img 
                              src="/images/效應器三色.jpg" 
                              alt="Magnetic Joint 2" 
                              className="max-w-full max-h-full object-cover opacity-90 hover:scale-150 transition-transform duration-500 border border-neutral-800 rounded-lg relative hover:z-30"
                            />
                          </div>
                        </div>
                      </div>
                  </div>
                </section>   

                {/* 區段 5：結語、新增照片與訪客留言按鈕 */}
                <section className="min-h-screen md:h-screen w-screen flex flex-col md:flex-row items-center justify-center md:justify-around px-6 md:px-80 py-20 md:py-12 pointer-events-auto gap-8 md:gap-0">
                  
                  <div className="w-1/2 md:w-1/4 relative flex items-center order-1 md:order-1 space-y-6 md:space-y-0">
                    <div className="grid grid-cols-1 gap-3 w-full">
                      <div className="h-40 md:h-80 flex items-center justify-center">
                        <img 
                          src="/images/CRAFTER 600 整機.jpg" 
                          alt="CRAFTER 600 整機" 
                          className="max-w-full max-h-full object-cover opacity-90 hover:scale-150 transition-transform duration-500 rounded-lg border border-neutral-800 shadow-2xl"
                        />                        
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2 md:w-1/4 relative flex items-center order-2 md:order-2 space-y-6 md:space-y-0">
                    <div className="grid grid-cols-1 gap-3 w-full">
                      <div className="h-40 md:h-80 flex items-center justify-center">                        
                        <img 
                          src="/images/CRAFTER logo.png" 
                          alt="CRAFTER logo" 
                          className="max-w-full max-h-full object-cover transition-transform duration-500 rounded-lg shadow-2xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-auto max-w-lg flex flex-col items-center text-center order-3 md:order-3 bg-neutral-950/50 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border border-[0.5px] border-emerald-500 shadow-2xl">
                    <h3 className="text-3xl sm:text-4xl md:text-5xl text-[#C5B9AC] mb-4 font-bold">
                     <span className="font-['Arial',sans-serif]">3d</span>砌作
                    </h3>
                    <p className="text-customText text-sm md:text-base mb-6">設計 x 製造 x 3D列印代工</p>
                    <button 
                      onClick={() => switchView('guestbook')}
                      className="px-8 py-3 bg-emerald-500 text-black text-sm md:text-base font-semibold rounded-full hover:bg-emerald-400 hover:text-[#C5B9AC] shadow-xl transition-all transform hover:scale-105 cursor-pointer pointer-events-auto"
                    >
                      訪客留言區
                    </button>
                  </div>

                </section>

              </Scroll>
            </ScrollControls>
          </Canvas>
        </div>
      )}
    </div>
  );
}