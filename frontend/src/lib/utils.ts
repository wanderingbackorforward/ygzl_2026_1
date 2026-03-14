/**
 * 工具函数
 */

/**
 * 合并 CSS 类名（简化版 clsx + tailwind-merge）
 * 过滤 falsy 值，合并字符串
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}
