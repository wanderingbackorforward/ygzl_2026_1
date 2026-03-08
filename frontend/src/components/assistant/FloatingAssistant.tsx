import React, { useState } from 'react'
import AssistantPanel from './AssistantPanel'

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-[1100] h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-cyan-500/40 active:scale-95"
        onClick={() => setOpen(true)}
        aria-label="打开悬浮小助手"
      >
        <span className="block text-2xl leading-none">💬</span>
      </button>

      {/* 主面板 */}
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </>
  )
}
