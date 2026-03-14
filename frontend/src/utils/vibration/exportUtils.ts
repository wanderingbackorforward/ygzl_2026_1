/**
 * 数据导出工具
 * CSV / Excel 导出振动分析结果
 */

import type {
  ChannelInfo,
  SafetyScoreResult,
  Thresholds
} from './types'

/**
 * 导出通道数据为 CSV
 */
export function exportChannelsCSV(
  channels: ChannelInfo[],
  thresholds: Thresholds,
  safetyScore: SafetyScoreResult
): void {
  const headers = [
    '通道', 'PPV (mm/s)', '主频 (Hz)', '预警等级',
    '预警阈值', '报警阈值', '停工阈值'
  ]

  const rows = channels.map(ch => [
    `CH${ch.channelId}`,
    ch.ppv.toFixed(2),
    ch.dominantFreq.toFixed(1),
    ch.alertLevel === 'safe' ? '安全' :
      ch.alertLevel === 'warn' ? '预警' :
      ch.alertLevel === 'alert' ? '报警' : '停工',
    thresholds.warn.toFixed(2),
    thresholds.alert.toFixed(2),
    thresholds.stop.toFixed(2)
  ])

  // 添加汇总行
  rows.push([])
  rows.push(['--- 汇总 ---'])
  rows.push(['安全评分', safetyScore.score.toString()])
  rows.push(['安全等级', safetyScore.level])
  rows.push(['扣分因素', safetyScore.factors.join('; ')])
  rows.push(['总体建议', safetyScore.recommendation])

  // 生成 CSV 内容
  const csvContent = '\uFEFF' + // BOM for UTF-8 Excel
    headers.join(',') + '\n' +
    rows.map(row => row.join(',')).join('\n')

  // 下载文件
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vibration_report_${formatDate(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 格式化日期为文件名
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}${m}${d}_${h}${min}`
}
