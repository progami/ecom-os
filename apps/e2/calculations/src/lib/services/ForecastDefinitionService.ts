import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, addQuarters, addYears, isAfter, isBefore } from 'date-fns';
import CutoffDateService from './CutoffDateService';
import { getCategoryAccountCode } from '@/lib/category-account-mapping';

// Temporary type until ForecastDefinition model is added to schema
type ForecastDefinition = any;

interface ForecastDefinitionInput {
  type: string;
  category: string;
  subcategory?: string;
  sku?: string;
  description: string;
  baseAmount?: number;
  percentage?: number;
  frequency?: string;
  startDate: Date;
  endDate?: Date;
  metadata?: any;
}

interface GeneratedForecast {
  date: Date;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  accountCode: string;
  type: string;
  sourceDefinitionId: string;
}

class ForecastDefinitionService {
  private static instance: ForecastDefinitionService;
  private prisma: PrismaClient;
  private cutoffDateService: CutoffDateService;

  private constructor() {
    this.prisma = new PrismaClient();
    this.cutoffDateService = CutoffDateService.getInstance();
  }

  static getInstance(): ForecastDefinitionService {
    if (!ForecastDefinitionService.instance) {
      ForecastDefinitionService.instance = new ForecastDefinitionService();
    }
    return ForecastDefinitionService.instance;
  }

  /**
   * Create a new forecast definition
   */
  async createDefinition(data: ForecastDefinitionInput): Promise<ForecastDefinition> {
    return await (this.prisma as any).forecastDefinition.create({
      data: {
        ...data,
        isActive: true
      }
    });
  }

  /**
   * Get all active forecast definitions
   */
  async getActiveDefinitions(type?: string): Promise<ForecastDefinition[]> {
    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }

    return await (this.prisma as any).forecastDefinition.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { category: 'asc' },
        { startDate: 'asc' }
      ]
    });
  }

  /**
   * Deactivate a forecast definition
   */
  async deactivateDefinition(id: string): Promise<void> {
    await (this.prisma as any).forecastDefinition.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * Generate forecast entries based on active definitions
   * @param fromDate Start date for forecast generation (defaults to cutoff + 1)
   * @param toDate End date for forecast generation
   */
  async generateForecasts(fromDate?: Date, toDate?: Date): Promise<GeneratedForecast[]> {
    // Get the forecast start date if not provided
    if (!fromDate) {
      fromDate = await this.cutoffDateService.getForecastStartDate();
    }

    // Default to end of 2030 if not provided
    if (!toDate) {
      toDate = new Date('2030-12-31');
    }

    const definitions = await this.getActiveDefinitions();
    const forecasts: GeneratedForecast[] = [];

    for (const definition of definitions) {
      // Skip if definition starts after our generation period
      if (definition.startDate > toDate) continue;

      // Skip if definition ended before our generation period
      if (definition.endDate && definition.endDate < fromDate) continue;

      // Generate forecasts based on definition type
      const generatedForecasts = await this.generateForecastsForDefinition(
        definition,
        fromDate,
        toDate
      );

      forecasts.push(...generatedForecasts);
    }

    return forecasts;
  }

  /**
   * Generate forecasts for a specific definition
   */
  private async generateForecastsForDefinition(
    definition: ForecastDefinition,
    fromDate: Date,
    toDate: Date
  ): Promise<GeneratedForecast[]> {
    const forecasts: GeneratedForecast[] = [];
    
    // Determine the actual start date (later of definition start or fromDate)
    const startDate = definition.startDate > fromDate ? definition.startDate : fromDate;
    
    // Determine the actual end date (earlier of definition end or toDate)
    const endDate = definition.endDate && definition.endDate < toDate ? definition.endDate : toDate;

    // Get account code for the category
    const accountCode = getCategoryAccountCode(definition.category, definition.type);

    switch (definition.type) {
      case 'recurring_expense':
        forecasts.push(...this.generateRecurringExpenses(definition, startDate, endDate, accountCode));
        break;
      
      case 'revenue_projection':
        // Revenue projections are now handled by RevenueService
        // Skip generation here to avoid duplication
        break;
      
      case 'amazon_fees':
        // Amazon fees will be calculated based on revenue, handled separately
        // TEMPORARILY DISABLED since revenue is disabled
        break;
    }

    return forecasts;
  }

  /**
   * Generate recurring expense forecasts
   */
  private generateRecurringExpenses(
    definition: ForecastDefinition,
    startDate: Date,
    endDate: Date,
    accountCode: string
  ): GeneratedForecast[] {
    const forecasts: GeneratedForecast[] = [];

    // Handle percentage-based expenses (like payroll taxes)
    if (definition.percentage && !definition.baseAmount) {
      // Skip percentage-based expenses for now - they need to be calculated based on other expenses
      return forecasts;
    }

    // Get the day of month from metadata if available
    const metadata = definition.metadata as any;
    const dayOfMonth = metadata?.dayOfMonth;
    
    // Calculate the first occurrence date
    let currentDate = new Date(definition.startDate);
    
    // If we have a specific day of month and the definition start is before our forecast start
    if (dayOfMonth && definition.startDate < startDate && definition.frequency === 'monthly') {
      // Find the first occurrence after startDate
      currentDate = new Date(startDate);
      currentDate.setDate(dayOfMonth);
      
      // If this puts us before startDate, move to next month
      if (currentDate < startDate) {
        currentDate = addMonths(currentDate, 1);
      }
      
      // Handle end of month dates (e.g., 31st on a 30-day month)
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      if (dayOfMonth > lastDayOfMonth) {
        currentDate.setDate(lastDayOfMonth);
      }
    } else if (definition.frequency === 'annual' || definition.frequency === 'yearly') {
      // For annual expenses, use the exact date from startDate
      currentDate = new Date(definition.startDate);
      // Find first occurrence after startDate
      while (currentDate < startDate) {
        currentDate = addYears(currentDate, 1);
      }
    } else {
      // For other frequencies or when no dayOfMonth specified
      // Start from the later of definition start or forecast start
      currentDate = definition.startDate > startDate ? new Date(definition.startDate) : new Date(startDate);
    }

    // Check if expense has already ended before generating
    if (definition.endDate && currentDate > definition.endDate) {
      return forecasts;
    }

    while (currentDate <= endDate) {
      // Skip if before our actual start date
      if (currentDate >= startDate) {
        // Check if within the definition's date range
        if (!definition.endDate || currentDate <= definition.endDate) {
          forecasts.push({
            date: new Date(currentDate),
            category: definition.category,
            subcategory: definition.subcategory || undefined,
            description: definition.description,
            amount: -(definition.baseAmount || 0), // Expenses are negative
            accountCode,
            type: 'recurring_expense',
            sourceDefinitionId: definition.id
          });
        }
      }

      // Move to next occurrence based on frequency
      switch (definition.frequency) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          if (dayOfMonth) {
            // Move to same day next month
            currentDate = addMonths(currentDate, 1);
            currentDate.setDate(dayOfMonth);
            
            // Handle end of month dates
            const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            if (dayOfMonth > lastDay) {
              currentDate.setDate(lastDay);
            }
          } else {
            currentDate = addMonths(currentDate, 1);
          }
          break;
        case 'quarterly':
          currentDate = addQuarters(currentDate, 1);
          break;
        case 'yearly':
        case 'annual':
          currentDate = addYears(currentDate, 1);
          break;
        default:
          // If no frequency, it's a one-time expense
          currentDate = addYears(endDate, 1); // Exit loop
      }
      
      // Check if we've passed the definition's end date
      if (definition.endDate && currentDate > definition.endDate) {
        break;
      }
    }

    return forecasts;
  }


  /**
   * Clear all forecast definitions (useful for reloading from static files)
   */
  async clearAllDefinitions(): Promise<void> {
    await (this.prisma as any).forecastDefinition.deleteMany({});
  }

  /**
   * Get forecast definitions by type and category
   */
  async getDefinitionsByTypeAndCategory(type: string, category: string): Promise<ForecastDefinition[]> {
    return await (this.prisma as any).forecastDefinition.findMany({
      where: {
        type,
        category,
        isActive: true
      }
    });
  }

  /**
   * Update a forecast definition
   */
  async updateDefinition(id: string, data: Partial<ForecastDefinitionInput>): Promise<ForecastDefinition> {
    return await (this.prisma as any).forecastDefinition.update({
      where: { id },
      data
    });
  }

  /**
   * Load forecast definitions from a batch input (useful for data migration)
   */
  async loadDefinitionsBatch(definitions: ForecastDefinitionInput[]): Promise<void> {
    // Use createMany for better performance
    await (this.prisma as any).forecastDefinition.createMany({
      data: definitions.map(def => ({
        ...def,
        isActive: true
      }))
    });
  }
}

export default ForecastDefinitionService;
export type { ForecastDefinitionInput, GeneratedForecast };