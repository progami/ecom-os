'use client'

export type CategoryId =
  | 'ACCOUNTING'
  | 'LEGAL'
  | 'DESIGN'
  | 'MARKETING'
  | 'IT'
  | 'HR'
  | 'OTHER'

export type Subcategory = { id: string; label: string }

export const SUBCATEGORIES: Record<CategoryId, Subcategory[]> = {
  ACCOUNTING: [
    { id: 'INDIVIDUAL_CPA', label: 'Individual CPA' },
    { id: 'FIRM_CPA', label: 'CPA Firm' },
    { id: 'INDIVIDUAL_BOOKKEEPER', label: 'Individual Bookkeeper' },
    { id: 'BOOKKEEPING_FIRM', label: 'Bookkeeping Firm' },
    { id: 'TAX_PREP', label: 'Tax Prep & Filing' },
    { id: 'BESPOKE_E2E', label: 'E2E Ecommerce Accounting' },
    { id: 'ACCOUNTING_SOFTWARE', label: 'Accounting Software' },
    { id: 'ACCOUNTING_CONNECTOR', label: 'Connectors (A2X, LinkMyBooks)' },
  ],
  LEGAL: [
    { id: 'BUSINESS_ATTORNEY', label: 'Business Attorney' },
    { id: 'CONTRACTS', label: 'Contracts' },
    { id: 'EMPLOYMENT_LAW', label: 'Employment Law' },
    { id: 'IP_TRADEMARK', label: 'IP / Trademark' },
    { id: 'LEGAL_SOFTWARE', label: 'Legal Software' },
  ],
  DESIGN: [
    { id: 'BRANDING', label: 'Branding' },
    { id: 'UI_UX', label: 'UI/UX' },
    { id: 'GRAPHIC', label: 'Graphic Design' },
    { id: 'WEB_DESIGN', label: 'Web Design' },
  ],
  MARKETING: [
    { id: 'SEO', label: 'SEO' },
    { id: 'PAID_ADS', label: 'Paid Ads' },
    { id: 'EMAIL_SMS', label: 'Email/SMS' },
    { id: 'SOCIAL', label: 'Social Media' },
    { id: 'CONTENT', label: 'Content/Copywriting' },
    { id: 'ANALYTICS', label: 'Marketing Analytics' },
  ],
  IT: [
    { id: 'MSP', label: 'Managed IT (MSP)' },
    { id: 'CLOUD_INFRA', label: 'Cloud/Infra' },
    { id: 'SECURITY', label: 'Security' },
    { id: 'HELPDESK', label: 'Helpdesk/Support' },
    { id: 'SOFTWARE', label: 'Software/Tools' },
  ],
  HR: [
    { id: 'RECRUITING', label: 'Recruiting' },
    { id: 'PAYROLL', label: 'Payroll' },
    { id: 'BENEFITS', label: 'Benefits Admin' },
    { id: 'HRIS', label: 'HRIS Software' },
    { id: 'PEO', label: 'PEO' },
  ],
  OTHER: [
    { id: 'OTHER_SERVICE', label: 'Other Service' },
    { id: 'TOOLS', label: 'Tools/Utilities' },
    { id: 'COMMUNITY', label: 'Community/Forums' },
  ],
}

export function getSubcategories(category: string | null | undefined): Subcategory[] {
  const key = (category || 'OTHER') as CategoryId
  return SUBCATEGORIES[key] || []
}
