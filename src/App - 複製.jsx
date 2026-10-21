import React from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls, Scroll, Environment, OrbitControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import { CrafterModel } from './CrafterModel';

export default function App() {
  return (
    <div className="relative w-full h-screen bg-neutral-950 text-white overflow-x-hidden font-sans">
      
      {/* 1. 左上角小標題 (固定不隨滾動消失) */}
      <div className="absolute top-6 left-8 z-50 flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <h1 className="text-xs tracking-widest uppercase font-mono text-neutral-400">
          DELTA 3D PRINTING LAB
        </h1>
      </div>

      {/* 2. 背景大字浮水印 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        <h2 className="text-[14vw] font-black tracking-tighter text-neutral-900 select-none opacity-50">
          CRAFTER 600
        </h2>
      </div>

      {/* 3. 3D 畫布與滾動控制區 */}
      <Canvas className="w-full h-full z-10" camera={{ position: [0, 0, 10], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 15]} intensity={1.5} />
        <Environment preset="city" />
        
        {/* ScrollControls 頁數設為 3 頁長度，營造流暢的滾動鏡頭感 */}
        <ScrollControls pages={3} damping={0.3}>
          
          {/* 3D 模型本體 */}
          <CrafterModel />

          {/* HTML 內容層（與 3D 滾動同步） */}
          <Scroll html className="w-full">
            
            {/* 區段 1：首頁標題區 */}
            <section className="h-[60vh] w-screen flex flex-col justify-end p-12 md:p-24 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="max-w-xl pointer-events-auto"
              >
                <p className="text-emerald-400 font-mono text-sm mb-2">Industrial Grade Delta 3D Printer</p>
                <h3 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
                  Precision in Motion.
                </h3>
                <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
                  CRAFTER 600專為大型工業列印與高精度結構設計， 結合 48V 動力驅動與高剛性碳纖維臂，重新定義巨型列印極限。
                </p>
              </motion.div>
            </section>

            {/* 區段 2：特性介紹區 (效應器與規格) */}
            <section className="relative h-screen w-screen flex items-center justify-between px-12 md:px-24">
              {/* 裝飾連接線與圓圈 (從效應器到圖片) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block">
                {/* 圓圈標示效應器位置 */}
                <motion.circle
                  cx="50%" 
                  cy="75%" 
                  r="30"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="3"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.3 }}
                />
                {/* 從圓圈連出的淺灰色線條 */}
                <motion.line 
                  x1="51.8%" y1="75%" 
                  x2="65%" y2="40%" 
                  stroke="rgba(255,255,255,0.4)" 
                  strokeWidth="3"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.3 }}
                />
              </svg>

              <div className="w-1/2 pointer-events-auto z-20">
                <h4 className="text-2xl md:text-4xl font-semibold mb-4">大尺寸極致結構</h4>
                <p className="text-neutral-400 text-sm md:text-base leading-relaxed mb-6">
                  搭載鑄鋁加熱床與高效能 Klipper 核心，確保長時間運作下的穩定度與極高表面品質。
                </p>
                <div className="grid grid-cols-2 gap-4 font-mono text-xs text-neutral-300">
                  <div className="border-l border-emerald-500 pl-3">
                    <span className="block text-neutral-500">BUILD VOLUME</span>
                    Ø600 x H600 mm
                  </div>
                  <div className="border-l border-emerald-500 pl-3">
                    <span className="block text-neutral-500">MOTOR DRIVE</span>
                    48V / TMC DRIVER
                  </div>
                </div>
              </div>
              <div className="w-1/3 h-96 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 pointer-events-auto shadow-2xl z-20">
                <img 
                  src="/images/噴頭及效應器單色.jpg" 
                  alt="Feature Preview" 
                  className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
                />
              </div>
            </section>

            {/* 區段 3：結語與規格亮點 */}
            <section className="h-screen w-screen flex flex-col items-center justify-center text-center p-12 pointer-events-none">
              <div className="max-w-2xl pointer-events-auto">
                <h3 className="text-3xl md:text-5xl font-bold mb-6">準備好體驗旗艦級 Delta 效能了嗎？</h3>
                <p className="text-neutral-400 mb-8">探索訂製化 3D 列印解決方案與設備租賃服務。</p>
                <button className="px-8 py-3 bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors">
                  聯絡我們
                </button>
              </div>
            </section>

          </Scroll>
        </ScrollControls>
      </Canvas>
    </div>
  );
}