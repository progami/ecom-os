import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  getWeekRange,
  getNextMonday,
  getBillingPeriod,
  calculatePallets,
  parseCSV,
  getErrorMessage,
} from '@/lib/utils'

describe('Utility Functions - Simple Tests', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
      expect(cn('text-red-500', { 'text-blue-500': true })).toBe('text-blue-500')
    })
  })

  describe('formatCurrency', () => {
    it('should format numbers as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(0)).toBe('$0.00')
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
    })
  })

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1234)).toBe('1,234')
      expect(formatNumber(1234567)).toBe('1,234,567')
    })
  })

  describe('calculatePallets', () => {
    it('should calculate pallets correctly', () => {
      expect(calculatePallets(100, 20)).toBe(5)
      expect(calculatePallets(101, 20)).toBe(6)
      expect(calculatePallets(19, 20)).toBe(1)
      expect(calculatePallets(0, 20)).toBe(0)
      expect(calculatePallets(100, 0)).toBe(0)
    })
  })

  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const csv = 'name,age,city\nJohn,30,NYC\nJane,25,LA'
      const result = parseCSV(csv)
      
      expect(result).toEqual([
        ['name', 'age', 'city'],
        ['John', '30', 'NYC'],
        ['Jane', '25', 'LA'],
      ])
    })

    it('should handle quoted values', () => {
      const csv = 'name,description\n"John Doe","A person, with comma"\n"Jane","Normal"'
      const result = parseCSV(csv)
      
      expect(result).toEqual([
        ['name', 'description'],
        ['John Doe', 'A person, with comma'],
        ['Jane', 'Normal'],
      ])
    })
  })

  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error message')
      expect(getErrorMessage(error)).toBe('Test error message')
    })

    it('should return string errors as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error')
    })

    it('should handle unknown error types', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred')
      expect(getErrorMessage(123)).toBe('An unexpected error occurred')
    })
  })
})