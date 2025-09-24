import { describe, expect, it } from 'vitest'
import { monthNameToNumber, quarterLabelToNumber } from '@/lib/workbook/importer'

describe('workbook helpers', () => {
  it('maps month abbreviations to numbers', () => {
    expect(monthNameToNumber('Jan')).toBe(1)
    expect(monthNameToNumber('Dec')).toBe(12)
    expect(monthNameToNumber('Foo')).toBeNull()
  })

  it('maps quarter labels to numbers', () => {
    expect(quarterLabelToNumber('Q1')).toBe(1)
    expect(quarterLabelToNumber('Q4')).toBe(4)
    expect(quarterLabelToNumber('FY')).toBeNull()
  })
})

