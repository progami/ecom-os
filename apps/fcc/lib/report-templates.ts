import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';
import type { 
  ReportTemplate, 
  TemplateCategory,
  ReportType,
  ReportFrequency,
  DeliveryMethodConfig,
  ReportFilters
} from '@/lib/types/scheduled-reports';

export class ReportTemplateManager {
  private static instance: ReportTemplateManager;

  private constructor() {}

  static getInstance(): ReportTemplateManager {
    if (!ReportTemplateManager.instance) {
      ReportTemplateManager.instance = new ReportTemplateManager();
    }
    return ReportTemplateManager.instance;
  }

  /**
   * Initialize system templates
   */
  async initializeSystemTemplates(): Promise<void> {
    const systemTemplates = this.getSystemTemplates();

    for (const template of systemTemplates) {
      try {
        const existing = await prisma.reportTemplate.findFirst({
          where: {
            name: template.name,
            isSystem: true
          }
        });

        if (!existing) {
          await prisma.reportTemplate.create({
            data: {
              name: template.name,
              description: template.description,
              category: template.category,
              reportTypes: JSON.stringify(template.reportTypes),
              defaultFilters: JSON.stringify(template.defaultFilters),
              defaultFrequency: template.defaultFrequency,
              defaultDelivery: template.defaultDelivery ? JSON.stringify(template.defaultDelivery) : null,
              isPublic: true,
              isSystem: true,
              metadata: JSON.stringify(template.metadata || {})
            }
          });

          structuredLogger.info('Created system template', {
            component: 'report-templates',
            templateName: template.name
          });
        }
      } catch (error) {
        structuredLogger.error('Failed to create system template', error, {
          component: 'report-templates',
          templateName: template.name
        });
      }
    }
  }

  /**
   * Get all available templates for a user
   */
  async getAvailableTemplates(
    userId: string,
    options?: {
      category?: TemplateCategory;
      isPublic?: boolean;
    }
  ) {
    const where: any = {
      OR: [
        { isPublic: true },
        { createdBy: userId }
      ]
    };

    if (options?.category) {
      where.category = options.category;
    }

    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category as TemplateCategory,
      reportTypes: JSON.parse(template.reportTypes) as ReportType[],
      defaultFilters: JSON.parse(template.defaultFilters),
      defaultFrequency: template.defaultFrequency as ReportFrequency | null,
      defaultDelivery: template.defaultDelivery ? JSON.parse(template.defaultDelivery) : null,
      isPublic: template.isPublic,
      isSystem: template.isSystem,
      createdBy: template.createdBy,
      version: template.version,
      metadata: JSON.parse(template.metadata),
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }));
  }

  /**
   * Create a custom template
   */
  async createTemplate(
    userId: string,
    template: Omit<ReportTemplate, 'id' | 'createdBy' | 'version' | 'metadata'>
  ): Promise<string> {
    try {
      const created = await prisma.reportTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          reportTypes: JSON.stringify(template.reportTypes),
          defaultFilters: JSON.stringify(template.defaultFilters),
          defaultFrequency: template.defaultFrequency,
          defaultDelivery: template.defaultDelivery ? JSON.stringify(template.defaultDelivery) : null,
          isPublic: template.isPublic,
          isSystem: false,
          createdBy: userId,
          metadata: JSON.stringify({})
        }
      });

      structuredLogger.info('Created custom template', {
        component: 'report-templates',
        templateId: created.id,
        userId
      });

      return created.id;
    } catch (error) {
      structuredLogger.error('Failed to create template', error, {
        component: 'report-templates',
        userId,
        template
      });
      throw error;
    }
  }

  /**
   * Update template usage statistics
   */
  async recordTemplateUsage(templateId: string): Promise<void> {
    try {
      await prisma.reportTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      });
    } catch (error) {
      structuredLogger.error('Failed to update template usage', error, {
        component: 'report-templates',
        templateId
      });
    }
  }

  /**
   * Get system templates
   */
  private getSystemTemplates(): Omit<ReportTemplate, 'id'>[] {
    return [
      {
        name: 'Monthly Financial Summary',
        description: 'Comprehensive monthly financial reports including P&L, Balance Sheet, and Cash Flow',
        category: 'finance',
        reportTypes: ['profit-loss', 'balance-sheet', 'cash-flow'],
        defaultFilters: {
          dateRange: { type: 'last_month' }
        },
        defaultFrequency: 'monthly',
        defaultDelivery: [
          {
            method: 'email',
            config: {
              recipients: [],
              subject: 'Monthly Financial Summary - {month} {year}',
              attachFormats: ['pdf', 'excel']
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'calendar',
          color: 'blue'
        }
      },
      {
        name: 'Weekly Cash Position',
        description: 'Weekly cash flow and bank reconciliation summary',
        category: 'finance',
        reportTypes: ['cash-flow', 'bank-summary'],
        defaultFilters: {
          dateRange: { type: 'custom' }
        },
        defaultFrequency: 'weekly',
        defaultDelivery: [
          {
            method: 'email',
            config: {
              recipients: [],
              subject: 'Weekly Cash Position Report',
              attachFormats: ['pdf']
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'dollar-sign',
          color: 'green'
        }
      },
      {
        name: 'Quarterly VAT Return',
        description: 'Quarterly VAT liability report for HMRC submission',
        category: 'tax',
        reportTypes: ['tax-summary'],
        defaultFilters: {
          dateRange: { type: 'last_quarter' }
        },
        defaultFrequency: 'quarterly',
        defaultDelivery: [
          {
            method: 'email',
            config: {
              recipients: [],
              subject: 'Quarterly VAT Return - Q{quarter} {year}',
              attachFormats: ['pdf', 'csv']
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'file-tax',
          color: 'purple'
        }
      },
      {
        name: 'Aged Receivables & Payables',
        description: 'Monthly aged debtors and creditors analysis',
        category: 'finance',
        reportTypes: ['aged-receivables', 'aged-payables'],
        defaultFilters: {
          dateRange: { type: 'custom' }
        },
        defaultFrequency: 'monthly',
        defaultDelivery: [
          {
            method: 'email',
            config: {
              recipients: [],
              subject: 'Aged Analysis Report - {month} {year}',
              attachFormats: ['excel']
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'clock',
          color: 'orange'
        }
      },
      {
        name: 'Year-End Financial Package',
        description: 'Complete financial statements for year-end reporting',
        category: 'compliance',
        reportTypes: ['profit-loss', 'balance-sheet', 'cash-flow', 'tax-summary'],
        defaultFilters: {
          dateRange: { type: 'last_year' }
        },
        defaultFrequency: null,
        defaultDelivery: [
          {
            method: 'cloud_storage',
            config: {
              provider: 'google_drive',
              folderPath: '/Year-End Reports/{year}',
              format: 'pdf'
            }
          },
          {
            method: 'email',
            config: {
              recipients: [],
              subject: 'Year-End Financial Package {year}',
              attachFormats: ['pdf']
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'archive',
          color: 'red'
        }
      },
      {
        name: 'Daily Bank Reconciliation',
        description: 'Daily bank account reconciliation status',
        category: 'finance',
        reportTypes: ['bank-summary'],
        defaultFilters: {
          dateRange: { type: 'custom' }
        },
        defaultFrequency: 'daily',
        defaultDelivery: [
          {
            method: 'webhook',
            config: {
              url: '',
              method: 'POST',
              includeReportData: true
            }
          }
        ],
        isPublic: true,
        isSystem: true,
        createdBy: null,
        version: 1,
        metadata: {
          icon: 'bank',
          color: 'teal'
        }
      }
    ];
  }

  /**
   * Clone a template
   */
  async cloneTemplate(
    templateId: string,
    userId: string,
    newName: string
  ): Promise<string> {
    try {
      const original = await prisma.reportTemplate.findUnique({
        where: { id: templateId }
      });

      if (!original) {
        throw new Error('Template not found');
      }

      const cloned = await prisma.reportTemplate.create({
        data: {
          name: newName,
          description: original.description ? `${original.description} (Copy)` : null,
          category: original.category,
          reportTypes: original.reportTypes,
          defaultFilters: original.defaultFilters,
          defaultFrequency: original.defaultFrequency,
          defaultDelivery: original.defaultDelivery,
          isPublic: false,
          isSystem: false,
          createdBy: userId,
          parentTemplateId: original.id,
          metadata: original.metadata
        }
      });

      structuredLogger.info('Cloned template', {
        component: 'report-templates',
        originalId: templateId,
        clonedId: cloned.id,
        userId
      });

      return cloned.id;
    } catch (error) {
      structuredLogger.error('Failed to clone template', error, {
        component: 'report-templates',
        templateId,
        userId
      });
      throw error;
    }
  }

  /**
   * Export template configuration
   */
  async exportTemplate(templateId: string): Promise<any> {
    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return {
      name: template.name,
      description: template.description,
      category: template.category,
      reportTypes: JSON.parse(template.reportTypes),
      defaultFilters: JSON.parse(template.defaultFilters),
      defaultFrequency: template.defaultFrequency,
      defaultDelivery: template.defaultDelivery ? JSON.parse(template.defaultDelivery) : null,
      version: template.version,
      metadata: JSON.parse(template.metadata)
    };
  }

  /**
   * Import template configuration
   */
  async importTemplate(
    userId: string,
    templateData: any,
    options?: { makePublic?: boolean }
  ): Promise<string> {
    try {
      const created = await prisma.reportTemplate.create({
        data: {
          name: `${templateData.name} (Imported)`,
          description: templateData.description,
          category: templateData.category,
          reportTypes: JSON.stringify(templateData.reportTypes),
          defaultFilters: JSON.stringify(templateData.defaultFilters),
          defaultFrequency: templateData.defaultFrequency,
          defaultDelivery: templateData.defaultDelivery ? JSON.stringify(templateData.defaultDelivery) : null,
          isPublic: options?.makePublic ?? false,
          isSystem: false,
          createdBy: userId,
          metadata: JSON.stringify(templateData.metadata || {})
        }
      });

      structuredLogger.info('Imported template', {
        component: 'report-templates',
        templateId: created.id,
        userId
      });

      return created.id;
    } catch (error) {
      structuredLogger.error('Failed to import template', error, {
        component: 'report-templates',
        userId,
        templateData
      });
      throw error;
    }
  }
}