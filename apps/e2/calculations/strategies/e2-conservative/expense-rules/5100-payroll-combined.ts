/**
 * Payroll & Payroll Tax Combined (Accounts 5100 & 5110)
 * 
 * Employee Breakdown:
 * 
 * 2025-2026 (3 Total Employees):
 * - Manager (Virginia): $4,000/month
 * - Founder (Kansas): $2,500/month  
 * - Part-time Associate (Kansas): $1,250/month
 * - Total Employees: 2 Full-time + 1 Part-time = 3
 * - Total Payroll: $7,750/month
 * - Payroll Tax (8%): $620/month
 * - Combined Total: $8,370/month
 * 
 * 2027 (4 Total Employees):
 * - Manager (Virginia): $4,000/month
 * - Founder (Kansas): $2,500/month
 * - Part-time Associate (Kansas): $1,250/month
 * - FT Employee (Kansas): $3,000/month
 * - Total Employees: 3 Full-time + 1 Part-time = 4
 * - Total Payroll: $10,750/month
 * - Payroll Tax (8%): $860/month
 * - Combined Total: $11,610/month
 * 
 * 2028 (5 Total Employees):
 * - Manager (Virginia): $4,000/month
 * - Founder (Kansas): $2,500/month
 * - Part-time Associate (Kansas): $1,250/month
 * - FT Employee (Kansas): $3,000/month
 * - PT Employee (Kansas): $1,500/month
 * - Total Employees: 3 Full-time + 2 Part-time = 5
 * - Total Payroll: $12,250/month
 * - Payroll Tax (8%): $980/month
 * - Combined Total: $13,230/month
 * 
 * 2029 (7 Total Employees):
 * - Manager (Virginia): $4,000/month
 * - Founder (Kansas): $2,500/month
 * - Part-time Associate (Kansas): $1,250/month
 * - FT Employee (Kansas): $3,000/month
 * - PT Employee (Kansas): $1,500/month
 * - 2 FT Employees (Kansas): $6,000/month ($3,000 each)
 * - Total Employees: 5 Full-time + 2 Part-time = 7
 * - Total Payroll: $18,250/month
 * - Payroll Tax (8%): $1,460/month
 * - Combined Total: $19,710/month
 * 
 * 2030 (9 Total Employees):
 * - Manager (Virginia): $4,000/month
 * - Founder (Kansas): $2,500/month
 * - Part-time Associate (Kansas): $1,250/month
 * - FT Employee (Kansas): $3,000/month
 * - PT Employee (Kansas): $1,500/month
 * - 2 FT Employees (Kansas): $6,000/month ($3,000 each)
 * - 2 FT Employees (Kansas): $6,000/month ($3,000 each)
 * - Total Employees: 7 Full-time + 2 Part-time = 9
 * - Total Payroll: $24,250/month
 * - Payroll Tax (8%): $1,940/month
 * - Combined Total: $26,190/month
 */

export const PAYROLL_COMBINED_RULE = {
  code: '5100',
  name: 'Payroll & Payroll Tax',
  frequency: 'monthly',
  description: 'Employee salaries and associated payroll taxes',
  
  getExpense(year: number, week: number, quarter: number) {
    // Only on monthly weeks (first week of each month)
    const monthlyWeeks = [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48]
    if (!monthlyWeeks.includes(week)) return null
    
    // Skip weeks before W35 in 2025, and skip W35 itself (handled by bank-statement.ts)
    if (year === 2025 && week <= 35) return null
    
    // Calculate payroll based on year
    let payrollAmount = 0
    let payrollTaxAmount = 0
    
    if (year <= 2026) {
      // Base team (3 employees) - $7,750 tax-inclusive
      const totalTaxInclusive = 7750
      payrollAmount = totalTaxInclusive / 1.08 // Actual salary after removing 8% tax
      payrollTaxAmount = totalTaxInclusive - payrollAmount // The 8% tax portion
    } else if (year === 2027) {
      // Base + 1 FT - $10,750 tax-inclusive
      const totalTaxInclusive = 10750
      payrollAmount = totalTaxInclusive / 1.08
      payrollTaxAmount = totalTaxInclusive - payrollAmount
    } else if (year === 2028) {
      // Previous + 1 PT - $12,250 tax-inclusive
      const totalTaxInclusive = 12250
      payrollAmount = totalTaxInclusive / 1.08
      payrollTaxAmount = totalTaxInclusive - payrollAmount
    } else if (year === 2029) {
      // Previous + 2 FT - $18,250 tax-inclusive
      const totalTaxInclusive = 18250
      payrollAmount = totalTaxInclusive / 1.08
      payrollTaxAmount = totalTaxInclusive - payrollAmount
    } else {
      // 2030+: Previous + 2 FT - $24,250 tax-inclusive
      const totalTaxInclusive = 24250
      payrollAmount = totalTaxInclusive / 1.08
      payrollTaxAmount = totalTaxInclusive - payrollAmount
    }
    
    // Return both payroll and payroll tax expenses
    return [
      {
        code: '5100',
        amount: payrollAmount
      },
      {
        code: '5110',
        amount: payrollTaxAmount
      }
    ]
  }
}