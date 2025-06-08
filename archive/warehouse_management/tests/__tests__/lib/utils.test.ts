import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  getWeekRange,
  getNextMonday,
  getBillingPeriod,
  calculatePallets,
  debounce,
  parseCSV,
  downloadFile,
  getErrorMessage,
} from '@/lib/utils'

// Mock DOM APIs for downloadFile
const mockClick = jest.fn()
const mockAppendChild = jest.fn()
const mockRemoveChild = jest.fn()
const mockCreateObjectURL = jest.fn()
const mockRevokeObjectURL = jest.fn()

const mockCreateElement = jest.fn()

Object.defineProperty(global, 'document', {
  value: {
    createElement: mockCreateElement,
    body: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
  },
  writable: true,
})

global.URL = {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
} as any

global.Blob = jest.fn()

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4') // Should override px-2 with px-4
      expect(cn('text-red-500', { 'text-blue-500': true })).toBe('text-blue-500')
    })

    it('should handle conditional classes', () => {
      expect(cn('base', { active: true, inactive: false })).toBe('base active')
      expect(cn('base', null, undefined, false, 'real')).toBe('base real')
    })

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz')
    })
  })

  describe('formatCurrency', () => {
    it('should format numbers as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
      expect(formatCurrency(0)).toBe('$0.00')
      expect(formatCurrency(1000000)).toBe('$1,000,000.00')
      expect(formatCurrency(0.99)).toBe('$0.99')
    })

    it('should handle negative numbers', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
    })
  })

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1234)).toBe('1,234')
      expect(formatNumber(1234567)).toBe('1,234,567')
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(999)).toBe('999')
    })

    it('should handle decimals', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56')
    })
  })

  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date('2024-01-15T00:00:00Z')
      // Allow for timezone differences
      const result = formatDate(date)
      expect(result).toMatch(/Jan 1[45], 2024/)
    })

    it('should format date with custom format', () => {
      const date = new Date('2024-01-15T00:00:00Z')
      const result = formatDate(date, 'yyyy-MM-dd')
      // Allow for timezone differences
      expect(result).toMatch(/2024-01-1[45]/)
    })

    it('should handle string dates', () => {
      const result = formatDate('2024-01-15T00:00:00Z')
      expect(result).toMatch(/Jan 1[45], 2024/)
    })
  })

  describe('getWeekRange', () => {
    it('should return Monday to Sunday for a given date', () => {
      // Wednesday Jan 17, 2024 in UTC
      const date = new Date('2024-01-17T12:00:00Z')
      const { start, end } = getWeekRange(date)

      // Check day of week instead of exact date to avoid timezone issues
      expect(start.getDay()).toBe(1) // Monday
      expect(end.getDay()).toBe(0) // Sunday
      
      // Check they're in the same week
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(6)
    })

    it('should handle dates already on Monday', () => {
      const date = new Date('2024-01-15T12:00:00Z') // Monday
      const { start, end } = getWeekRange(date)

      expect(start.getDay()).toBe(1) // Monday
      expect(end.getDay()).toBe(0) // Sunday
    })

    it('should handle dates on Sunday', () => {
      const date = new Date('2024-01-21T12:00:00Z') // Sunday
      const { start, end } = getWeekRange(date)

      expect(start.getDay()).toBe(1) // Monday
      expect(end.getDay()).toBe(0) // Sunday
    })
  })

  describe('getNextMonday', () => {
    it('should return next Monday for various days', () => {
      // Test different days of the week
      const testCases = [
        { date: new Date('2024-01-15T12:00:00Z'), dayOfWeek: 1 }, // Monday
        { date: new Date('2024-01-16T12:00:00Z'), dayOfWeek: 2 }, // Tuesday
        { date: new Date('2024-01-17T12:00:00Z'), dayOfWeek: 3 }, // Wednesday
        { date: new Date('2024-01-18T12:00:00Z'), dayOfWeek: 4 }, // Thursday
        { date: new Date('2024-01-19T12:00:00Z'), dayOfWeek: 5 }, // Friday
        { date: new Date('2024-01-20T12:00:00Z'), dayOfWeek: 6 }, // Saturday
        { date: new Date('2024-01-21T12:00:00Z'), dayOfWeek: 0 }, // Sunday
      ]

      testCases.forEach(({ date }) => {
        const result = getNextMonday(date)
        // Should always return a Monday
        expect(result.getDay()).toBe(1)
        // Should be in the future
        expect(result.getTime()).toBeGreaterThan(date.getTime())
        // Should be within 7 days
        const diffDays = Math.floor((result.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
        expect(diffDays).toBeGreaterThan(0)
        expect(diffDays).toBeLessThanOrEqual(7)
      })
    })

    it('should use current date if no date provided', () => {
      const result = getNextMonday()
      // Should always return a Monday
      expect(result.getDay()).toBe(1)
      // Should be in the future
      expect(result.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('getBillingPeriod', () => {
    it('should return correct billing period for dates 1-15', () => {
      // Test date in the first half of month
      const date = new Date('2024-01-10T12:00:00Z')
      const { start, end } = getBillingPeriod(date)
      
      expect(start.getDate()).toBe(16)
      expect(end.getDate()).toBe(15)
      
      // Start should be in previous month
      expect(start.getMonth()).toBe((date.getMonth() - 1 + 12) % 12)
      // End should be in current month
      expect(end.getMonth()).toBe(date.getMonth())
    })

    it('should return correct billing period for dates 16-31', () => {
      // Test date in the second half of month
      const date = new Date('2024-01-20T12:00:00Z')
      const { start, end } = getBillingPeriod(date)
      
      expect(start.getDate()).toBe(16)
      expect(end.getDate()).toBe(15)
      
      // Start should be in current month
      expect(start.getMonth()).toBe(date.getMonth())
      // End should be in next month
      expect(end.getMonth()).toBe((date.getMonth() + 1) % 12)
    })

    it('should handle year boundaries', () => {
      // January 10, 2024 - should cross year boundary
      const jan10 = new Date('2024-01-10T12:00:00Z')
      const { start: janStart, end: janEnd } = getBillingPeriod(jan10)
      
      expect(janStart.getDate()).toBe(16)
      expect(janStart.getMonth()).toBe(11) // December
      expect(janStart.getFullYear()).toBe(2023)
      
      expect(janEnd.getDate()).toBe(15)
      expect(janEnd.getMonth()).toBe(0) // January
      expect(janEnd.getFullYear()).toBe(2024)
    })
  })

  describe('calculatePallets', () => {
    it('should calculate pallets correctly', () => {
      expect(calculatePallets(100, 20)).toBe(5) // Exact
      expect(calculatePallets(101, 20)).toBe(6) // Round up
      expect(calculatePallets(19, 20)).toBe(1) // Less than one pallet
      expect(calculatePallets(0, 20)).toBe(0) // Zero cartons
    })

    it('should handle edge cases', () => {
      expect(calculatePallets(100, 0)).toBe(0) // Zero cartons per pallet
      expect(calculatePallets(100, -5)).toBe(0) // Negative cartons per pallet
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should debounce function calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 1000)

      // Call multiple times
      debouncedFn('arg1')
      debouncedFn('arg2')
      debouncedFn('arg3')

      // Should not have been called yet
      expect(mockFn).not.toHaveBeenCalled()

      // Fast forward time
      jest.advanceTimersByTime(1000)

      // Should be called once with last arguments
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('arg3')
    })

    it('should cancel previous timeout on new call', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 1000)

      debouncedFn('first')
      jest.advanceTimersByTime(500)
      
      debouncedFn('second')
      jest.advanceTimersByTime(500)
      
      // Should not be called yet (only 500ms since last call)
      expect(mockFn).not.toHaveBeenCalled()
      
      jest.advanceTimersByTime(500)
      
      // Now should be called with 'second'
      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('second')
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

    it('should handle empty values', () => {
      const csv = 'a,b,c\n1,,3\n,,'
      const result = parseCSV(csv)

      expect(result).toEqual([
        ['a', 'b', 'c'],
        ['1', '', '3'],
        ['', '', ''],
      ])
    })

    it('should trim whitespace', () => {
      const csv = 'name , age , city\n John , 30 , NYC '
      const result = parseCSV(csv)

      expect(result).toEqual([
        ['name', 'age', 'city'],
        ['John', '30', 'NYC'],
      ])
    })
  })

  describe('downloadFile', () => {
    it('should create and click download link', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
      }
      mockCreateElement.mockClear()
      mockCreateElement.mockReturnValue(mockLink)
      mockCreateObjectURL.mockClear()
      mockCreateObjectURL.mockReturnValue('blob:url')

      downloadFile('test content', 'test.txt', 'text/plain')

      expect(Blob).toHaveBeenCalledWith(['test content'], { type: 'text/plain' })
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockCreateElement).toHaveBeenCalledWith('a')
      expect(mockLink.href).toBe('blob:url')
      expect(mockLink.download).toBe('test.txt')
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink)
      expect(mockClick).toHaveBeenCalled()
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:url')
    })

    it('should use default type if not provided', () => {
      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
      }
      mockCreateElement.mockReturnValue(mockLink)

      downloadFile('content', 'file.txt')

      expect(Blob).toHaveBeenCalledWith(['content'], { type: 'text/plain' })
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
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
      expect(getErrorMessage(123)).toBe('An unexpected error occurred')
      expect(getErrorMessage({ some: 'object' })).toBe('An unexpected error occurred')
    })
  })
})