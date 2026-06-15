import type { EChartsOption } from 'echarts'

/**
 * 大屏 / 触控档 ECharts 预设
 *
 * 壁挂屏没有 hover —— 把 tooltip 改成「点按触发」（mousemove|click，桌面 hover 仍可用，
 * 平板上退化为 tap），放大 tooltip 字号，并约束在容器内。
 *
 * 仅做安全合并：不覆盖页面已有的 tooltip 配置，只补 triggerOn / confine / textStyle.fontSize。
 */
export function applyWallPreset(option: EChartsOption): EChartsOption {
  const o: EChartsOption = { ...option }
  const tt: any = { ...(o.tooltip || {}) }
  // 平板无 hover → 同时允许点击触发；桌面两者皆可
  if (!tt.triggerOn) tt.triggerOn = 'mousemove|click'
  if (tt.confine === undefined) tt.confine = true
  tt.textStyle = { fontSize: 14, ...((tt.textStyle as any) || {}) }
  o.tooltip = tt
  return o
}

export default applyWallPreset
