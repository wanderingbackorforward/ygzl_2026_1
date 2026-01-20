import { describe, it, expect } from 'vitest'
import { classifyVelocity, formatKeyDateField, toNumberOrNull } from '../lib/insar'

describe('insar utils', () => {
  it('formats D_YYYYMMDD fields', () => {
    expect(formatKeyDateField('D_20170122')).toBe('2017-01-22')
    expect(formatKeyDateField('d_19991231')).toBe('1999-12-31')
    expect(formatKeyDateField('velocity')).toBe('velocity')
  })

  it('parses numbers safely', () => {
    expect(toNumberOrNull(1.25)).toBe(1.25)
    expect(toNumberOrNull('  -3.5 ')).toBe(-3.5)
    expect(toNumberOrNull('')).toBeNull()
    expect(toNumberOrNull('abc')).toBeNull()
    expect(toNumberOrNull(NaN)).toBeNull()
  })

  it('classifies velocity with thresholds', () => {
    const thresholds = { strong: 10, mild: 2 }
    expect(classifyVelocity(null, thresholds).label).toBe('未知')
    expect(classifyVelocity(-12, thresholds).label.startsWith('显著沉降')).toBe(true)
    expect(classifyVelocity(-5, thresholds).label.startsWith('轻微沉降')).toBe(true)
    expect(classifyVelocity(0.5, thresholds).label.startsWith('稳定')).toBe(true)
    expect(classifyVelocity(5, thresholds).label.startsWith('轻微抬升')).toBe(true)
    expect(classifyVelocity(12, thresholds).label.startsWith('显著抬升')).toBe(true)
  })
})

