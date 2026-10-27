// App-guestbook.jsx
import React from 'react';

export default function AppGuestbook({
  messages,
  author,
  setAuthor,
  content,
  setContent,
  handleAddMessage,
  editingId,
  editAuthor,
  setEditAuthor,
  editContent,
  setEditContent,
  handleStartEdit,
  handleSaveEdit,
  setEditingId,
  handleDeleteMessage,
  clientId,
  switchView
}) {
  return (
    <div className="relative z-20 w-full h-full pt-28 pb-12 px-6 md:px-24 overflow-y-auto flex flex-col items-center">
      <div className="max-w-3xl w-full bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded-xl p-6 md:p-8 shadow-2xl mt-4">
        <h3 className="text-2xl md:text-3xl font-bold text-emerald-400 mb-2">訪客留言板</h3>
        <p className="text-customText text-xs md:text-sm mb-6">歡迎留下您對 CRAFTER 600 的寶貴意見與交流！</p>

        <form onSubmit={handleAddMessage} className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-mono text-customText mb-1">您的稱呼 / 暱稱</label>
            <input 
              type="text" 
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="例如：Maker John"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-[#839794] focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-customText mb-1">留言內容</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請輸入您的建議或交流想法......(可編輯刪除)"
              rows="3"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-[#839794] focus:outline-none focus:border-emerald-500 resize-none"
              required
            />
          </div>
          <button 
            type="submit"
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            送出留言
          </button>
        </form>

        <div className="border-t border-neutral-800 pt-6">
          <h4 className="text-sm font-mono text-customText mb-4 tracking-wider uppercase">歷史留言紀錄 ({messages.length})</h4>
          <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-2">
            {messages.map((msg) => {
              const isMyMessage = msg.client_id === clientId;

              return (
                <div key={msg.id} className="bg-neutral-900 border border-neutral-800/80 rounded-lg p-4">
                  {editingId === msg.id ? (
                    /* 編輯模式 */
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-xs text-[#839794] focus:outline-none focus:border-emerald-500"
                        placeholder="修改稱呼"
                      />
                      <textarea 
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows="2"
                        className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-xs text-[#839794] focus:outline-none focus:border-emerald-500 resize-none"
                        placeholder="修改留言內容"
                      />
                      <div className="flex space-x-2 justify-end">
                        <button 
                          onClick={() => handleSaveEdit(msg.id)}
                          className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded transition-colors cursor-pointer"
                        >
                          儲存
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-customText text-xs rounded transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 一般顯示模式 */
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-emerald-400 text-sm">{msg.name}</span>
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-mono text-customText">{msg.date}</span>
                          
                          {isMyMessage && (
                            <>
                              <button 
                                onClick={() => handleStartEdit(msg)}
                                className="text-[11px] text-customText hover:text-emerald-400 transition-colors cursor-pointer"
                              >
                                編輯
                              </button>
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="text-[11px] text-customText hover:text-red-400 transition-colors cursor-pointer"
                              >
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-customText text-xs md:text-sm leading-relaxed">{msg.text}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => switchView('home')}
            className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-customText text-xs md:text-sm font-medium rounded-full transition-colors cursor-pointer"
          >
            ← 返回首頁導覽
          </button>
        </div>
      </div>
    </div>
  );
}