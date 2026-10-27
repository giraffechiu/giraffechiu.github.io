// App-about.jsx
import React from 'react';

export default function AppAbout({ switchView }) {
  return (
    <div className="relative z-20 w-full h-full pt-24 pb-16 px-4 md:px-12 overflow-y-auto flex flex-col items-center">
      
      {/* 主要內容卡片外圍 */}
      <div className="max-w-4xl w-full bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 sm:p-10 md:p-12 shadow-2xl mt-4 space-y-12">
        
        {/* Header 標題區 */}
        <div className="border-b border-neutral-800 pb-6 text-center md:text-left">
          <span className="text-emerald-400 font-mono text-xs tracking-widest uppercase block mb-1">
            ABOUT 3D CRAFTING
          </span>          
          <h2 className="text-3xl md:text-4xl font-bold text-[#839794] tracking-tight">3d砌作
          </h2>
          <p className="text-customText text-sm md:text-base mt-3 leading-relaxed">
            我們是以 <span className="text-[#eaa486] font-medium">FDM 3D 列印</span> 為基礎的設計及製造工作室。
          </p>
        </div>

        {/* 理念與列印須知卡片 */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <h3 className="text-lg font-mono text-emerald-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            品質與製造理念
          </h3>
          <p className="text-customText text-xs md:text-sm leading-relaxed space-y-2">
            我們的列印技術以及機器設備均維持在嚴格的水準之上，使得最終成品的細緻度更上一層樓。<br /><br />
            然而，FDM 層疊積層原理仍可能使成品產生些許微小痕跡（例如拆除支撐結構後的殘留點）。我們會在後處理階段儘量以手工作業去蕪存菁，若仍有物理特性上無法避免之處，還請先行知悉與理解。
          </p>
        </div>

        {/* 1. 服務項目 OUR SERVICES */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
              OUR SERVICES 服務項目
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
              <div className="text-emerald-400 font-mono text-xs mb-2">01. DESIGN</div>
              <h4 className="text-[#839794] font-bold text-base mb-2">設計小物與客製化</h4>
              <p className="text-customText text-xs leading-relaxed">
                原創設計小物定價販售，並提供專屬客製化微調服務。
              </p>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
              <div className="text-emerald-400 font-mono text-xs mb-2">02. MODELING</div>
              <h4 className="text-[#839794] font-bold text-base mb-2">3D 設計與逆向工程</h4>
              <p className="text-customText text-xs leading-relaxed">
                提供 3D 設計代工、機構設計及實物逆向工程 3D 建模。
              </p>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
              <div className="text-emerald-400 font-mono text-xs mb-2">03. PRINTING</div>
              <h4 className="text-[#839794] font-bold text-base mb-2">3D 列印代工 / 打樣</h4>
              <p className="text-customText text-xs leading-relaxed">
                硬質與軟質材料大尺寸列印打樣。<br />
                <span className="text-[#eaa486] font-mono">硬質 $200 起 / 軟質 $300 起</span>
              </p>
            </div>
          </div>
        </div>

        {/* 2. 材料選擇 MATERIAL SPECIFICATIONS */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
              MATERIAL SPECIFICATIONS 材料選擇
            </h3>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-6 md:p-8">
            <p className="text-xs text-neutral-400 mb-6">（無指定顏色時預設以白色報價，指定特殊色依現況加價）</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 硬質材料 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 text-[11px] font-mono rounded">
                    HARD
                  </span>
                  <h4 className="text-[#839794] font-semibold text-sm">硬質材料</h4>
                </div>
                <ul className="text-xs text-customText space-y-2 pl-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><strong className="text-[#eaa486]">高強度 PLA：</strong> 韌性接近 ABS，提供多款顏色選擇。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><strong className="text-[#eaa486]">耐高溫 PETG：</strong> 具備優秀耐溫與抗衝擊強度。</span>
                  </li>
                </ul>
              </div>

              {/* 軟質材料 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-[#3998d0] border border-blue-500/40 text-[11px] font-mono rounded">
                    SOFT
                  </span>
                  <h4 className="text-[#839794] font-semibold text-sm">軟質材料</h4>
                </div>
                <ul className="text-xs text-customText space-y-2 pl-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[#eaa486] font-bold">•</span>
                    <span><strong className="text-[#eaa486]">FLEX (&gt;90A) / TPU 90A / TPE 80A / TPE 65A</strong></span>
                  </li>
                  <li className="flex items-start gap-2 text-neutral-400">
                    <span>專精軟料列印技術，提供彈性與彈性體配件客製。</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 代工交易流程 ORDER WORKFLOW */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
              ORDER WORKFLOW 代工交易流程
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 01</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">提供檔案</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                傳送 STL 等 3D 檔，告知硬質/軟質，<br />
                指定層高 (0.05~0.6mm)、<br />
                與尺寸(一次成型 最長邊60cm內)。
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 02</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">評估與報價</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                依切片軟體計算時間與難易度估價，<br />
                (單筆基本消費 硬質$200 / 軟質$300)。
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 03</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">確認下單</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                依報價單內說明步驟完成下單，<br />
                (推薦使用超商取貨付款服務)。
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 04</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">開始列印</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                排單進行高精度 3D 列印與後處理修整。
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 05</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">成品確認</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                拍攝成品相片或影片供雙方核對確認。
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg">
              <span className="text-emerald-400 font-bold">STEP 06</span>
              <h5 className="text-[#839794] font-sans font-bold my-1">包裝寄送</h5>
              <p className="text-customText font-sans text-[11px] leading-relaxed">
                包裝防護後快速寄出至指定地址或超商。
              </p>
            </div>
          </div>
        </div>

        {/* 4. 聯絡與社群 CONTACT & SOCIAL MEDIA */}
        <div className="space-y-4 border-t border-neutral-800 pt-8">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-sm font-mono text-emerald-400 uppercase tracking-widest font-semibold">
              CONTACT & SOCIAL MEDIA 聯絡我們
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 聯絡管道 */}
            <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-xl space-y-3">
              <div className="text-xs font-mono text-emerald-400">詢價 / 業務合作</div>
              <div className="text-xs text-customText space-y-1">
                <div><strong className="text-[#839794]">Line ID：</strong> giraffechiu</div>
                <div><strong className="text-[#839794]">Email：</strong> 3dcrafting.life@gmail.com</div>
              </div>
            </div>

            {/* FB 專頁 */}
            <div className="bg-neutral-900/80 border border-neutral-800 p-5 rounded-xl space-y-3">
              <div className="text-xs font-mono text-emerald-400">Facebook 粉絲專頁</div>
              <div className="flex flex-col space-y-3 text-xs">
                
                <a 
                  href="https://www.facebook.com/gogo.3d.crafting" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-customText hover:text-emerald-400 transition-colors group"
                >
                  <svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="underline underline-offset-4">3d砌作 官方 FB 專頁</span>
                </a>

                <a 
                  href="https://www.facebook.com/tpe3dprinting?ref=aymt_homepage_panel" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-customText hover:text-emerald-400 transition-colors group"
                >
                  <svg className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="underline underline-offset-4">軟材料 3D 列印 FB 專頁</span>
                </a>

              </div>
            </div>
          </div>
        </div>

        {/* 返回首頁按鈕 */}
        <div className="text-center pt-4">
          <button 
            onClick={() => switchView('home')}
            className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 text-[#839794] text-xs md:text-sm font-medium rounded-full transition-colors cursor-pointer"
          >
            ← 返回首頁導覽
          </button>
        </div>

      </div>
    </div>
  );
}