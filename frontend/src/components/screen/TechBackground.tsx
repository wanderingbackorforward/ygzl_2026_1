import React from 'react'

/**
 * 全局数字孪生大屏背景层：扫描线 + 暗角（fixed，z-index 0，不挡交互）。
 * 科技网格/光晕已在 body 背景（screen-skin.css）；此处负责动态扫描线。
 */
const TechBackground: React.FC = () => {
  return <div className="dt-bg-overlay" aria-hidden="true" />
}

export default TechBackground
