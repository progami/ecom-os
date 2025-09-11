import { prisma } from '@/lib/prisma';
import { getQueue, QUEUE_NAMES, PRIORITY_LEVELS } from '@/lib/queue/queue-config';
import { structuredLogger } from '@/lib/logger';
import { addMonths, addDays, addWeeks, startOfDay, setHours, setMinutes, format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { 
  ScheduledReportConfig, 
  ScheduledReportJob,
  ReportFrequency,
  DeliveryMethodConfig,
  ReportFilters
} from '@/lib/types/scheduled-reports';

export class ScheduledReportManager {
  private static instance: ScheduledReportManager;

  private constructor() {}

  static getInstance(): ScheduledReportManager {
    if (!ScheduledReportManager.instance) {
      ScheduledReportManager.instance = new ScheduledReportManager();
    }
    return ScheduledReportManager.instance;
  }

  /**
   * Create a new scheduled report
   */
  async createScheduledReport(
    userId: string,
    config: ScheduledReportConfig
  ): Promise<{ id: string; nextRunAt: Date }> {
    try {
      const nextRunAt = this.calculateNextRunTime(config);

      const scheduledReport = await prisma.scheduledReport.create({
        data: {
          userId,
          name: config.name,
          description: config.description,
          reportTypes: JSON.stringify(config.reportTypes),
          frequency: config.frequency,
          timezone: config.timezone,
          scheduleTime: config.scheduleTime,
          dayOfWeek: config.dayOfWeek,
          dayOfMonth: config.dayOfMonth,
          quarterMonths: config.quarterMonths ? JSON.stringify(config.quarterMonths) : null,
          filters: JSON.stringify(config.filters),
          deliveryMethods: JSON.stringify(config.deliveryMethods),
          deliveryConfig: JSON.stringify(
            config.deliveryMethods.reduce((acc, dm) => {
              acc[dm.method] = dm.config;
              return acc;
            }, {} as Record<string, any>)
          ),
          templateId: config.templateId,
          isActive: config.isActive,
          nextRunAt
        }
      });

      // Schedule the first job if report is active
      if (config.isActive) {
        await this.scheduleNextRun(scheduledReport.id, nextRunAt);
      }

      structuredLogger.info('Created scheduled report', {
        component: 'scheduled-reports',
        reportId: scheduledReport.id,
        userId,
        nextRunAt
      });

      return { id: scheduledReport.id, nextRunAt };
    } catch (error) {
      structuredLogger.error('Failed to create scheduled report', error, {
        component: 'scheduled-reports',
        userId,
        config
      });
      throw error;
    }
  }

  /**
   * Update an existing scheduled report
   */
  async updateScheduledReport(
    reportId: string,
    userId: string,
    updates: Partial<ScheduledReportConfig>
  ): Promise<void> {
    try {
      const existing = await prisma.scheduledReport.findFirst({
        where: { id: reportId, userId }
      });

      if (!existing) {
        throw new Error('Scheduled report not found');
      }

      // Merge with existing config
      const updatedConfig: ScheduledReportConfig = {
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        reportTypes: updates.reportTypes ?? JSON.parse(existing.reportTypes),
        frequency: updates.frequency ?? existing.frequency as ReportFrequency,
        timezone: updates.timezone ?? existing.timezone,
        scheduleTime: updates.scheduleTime ?? existing.scheduleTime,
        dayOfWeek: updates.dayOfWeek ?? existing.dayOfWeek ?? undefined,
        dayOfMonth: updates.dayOfMonth ?? existing.dayOfMonth ?? undefined,
        quarterMonths: updates.quarterMonths ?? (existing.quarterMonths ? JSON.parse(existing.quarterMonths) : undefined),
        filters: updates.filters ?? JSON.parse(existing.filters),
        deliveryMethods: updates.deliveryMethods ?? JSON.parse(existing.deliveryMethods),
        templateId: updates.templateId ?? existing.templateId ?? undefined,
        isActive: updates.isActive ?? existing.isActive
      };

      const nextRunAt = updatedConfig.isActive ? this.calculateNextRunTime(updatedConfig) : null;

      await prisma.scheduledReport.update({
        where: { id: reportId },
        data: {
          name: updatedConfig.name,
          description: updatedConfig.description,
          reportTypes: JSON.stringify(updatedConfig.reportTypes),
          frequency: updatedConfig.frequency,
          timezone: updatedConfig.timezone,
          scheduleTime: updatedConfig.scheduleTime,
          dayOfWeek: updatedConfig.dayOfWeek,
          dayOfMonth: updatedConfig.dayOfMonth,
          quarterMonths: updatedConfig.quarterMonths ? JSON.stringify(updatedConfig.quarterMonths) : null,
          filters: JSON.stringify(updatedConfig.filters),
          deliveryMethods: JSON.stringify(updatedConfig.deliveryMethods),
          deliveryConfig: JSON.stringify(
            updatedConfig.deliveryMethods.reduce((acc, dm) => {
              acc[dm.method] = dm.config;
              return acc;
            }, {} as Record<string, any>)
          ),
          templateId: updatedConfig.templateId,
          isActive: updatedConfig.isActive,
          nextRunAt,
          consecutiveFailures: 0 // Reset failure count on update
        }
      });

      // Cancel existing jobs and reschedule if active
      await this.cancelScheduledJobs(reportId);
      if (updatedConfig.isActive && nextRunAt) {
        await this.scheduleNextRun(reportId, nextRunAt);
      }

      structuredLogger.info('Updated scheduled report', {
        component: 'scheduled-reports',
        reportId,
        userId,
        isActive: updatedConfig.isActive,
        nextRunAt
      });
    } catch (error) {
      structuredLogger.error('Failed to update scheduled report', error, {
        component: 'scheduled-reports',
        reportId,
        userId
      });
      throw error;
    }
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(reportId: string, userId: string): Promise<void> {
    try {
      const report = await prisma.scheduledReport.findFirst({
        where: { id: reportId, userId }
      });

      if (!report) {
        throw new Error('Scheduled report not found');
      }

      // Cancel any scheduled jobs
      await this.cancelScheduledJobs(reportId);

      // Delete the report (cascade will handle executions)
      await prisma.scheduledReport.delete({
        where: { id: reportId }
      });

      structuredLogger.info('Deleted scheduled report', {
        component: 'scheduled-reports',
        reportId,
        userId
      });
    } catch (error) {
      structuredLogger.error('Failed to delete scheduled report', error, {
        component: 'scheduled-reports',
        reportId,
        userId
      });
      throw error;
    }
  }

  /**
   * Execute a scheduled report manually
   */
  async executeManually(reportId: string, userId: string): Promise<string> {
    try {
      const report = await prisma.scheduledReport.findFirst({
        where: { id: reportId, userId },
        include: { template: true }
      });

      if (!report) {
        throw new Error('Scheduled report not found');
      }

      // Create execution record
      const execution = await prisma.scheduledReportExecution.create({
        data: {
          scheduledReportId: reportId,
          status: 'pending',
          metadata: JSON.stringify({ manualRun: true })
        }
      });

      // Parse configuration
      const config: ScheduledReportConfig = {
        id: report.id,
        name: report.name,
        description: report.description ?? undefined,
        reportTypes: JSON.parse(report.reportTypes),
        frequency: report.frequency as ReportFrequency,
        timezone: report.timezone,
        scheduleTime: report.scheduleTime,
        dayOfWeek: report.dayOfWeek ?? undefined,
        dayOfMonth: report.dayOfMonth ?? undefined,
        quarterMonths: report.quarterMonths ? JSON.parse(report.quarterMonths) : undefined,
        filters: JSON.parse(report.filters),
        deliveryMethods: JSON.parse(report.deliveryMethods),
        templateId: report.templateId ?? undefined,
        isActive: report.isActive
      };

      // Queue the job
      const queue = getQueue<ScheduledReportJob>(QUEUE_NAMES.REPORT_GENERATION);
      const job = await queue.add(
        'scheduled-report',
        {
          scheduledReportId: reportId,
          userId,
          executionId: execution.id,
          reportConfig: config,
          isManualRun: true
        },
        {
          priority: PRIORITY_LEVELS.HIGH,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          }
        }
      );

      // Update execution with job ID
      await prisma.scheduledReportExecution.update({
        where: { id: execution.id },
        data: { jobId: job.id }
      });

      structuredLogger.info('Manually executed scheduled report', {
        component: 'scheduled-reports',
        reportId,
        executionId: execution.id,
        jobId: job.id
      });

      return execution.id;
    } catch (error) {
      structuredLogger.error('Failed to manually execute scheduled report', error, {
        component: 'scheduled-reports',
        reportId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get scheduled reports for a user
   */
  async getUserScheduledReports(
    userId: string,
    options?: {
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { userId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const reports = await prisma.scheduledReport.findMany({
      where,
      include: {
        template: true,
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset
    });

    return reports.map(report => ({
      id: report.id,
      name: report.name,
      description: report.description,
      reportTypes: JSON.parse(report.reportTypes),
      frequency: report.frequency,
      timezone: report.timezone,
      scheduleTime: report.scheduleTime,
      dayOfWeek: report.dayOfWeek,
      dayOfMonth: report.dayOfMonth,
      quarterMonths: report.quarterMonths ? JSON.parse(report.quarterMonths) : null,
      filters: JSON.parse(report.filters),
      deliveryMethods: JSON.parse(report.deliveryMethods),
      templateId: report.templateId,
      templateName: report.template?.name,
      isActive: report.isActive,
      lastRunAt: report.lastRunAt,
      nextRunAt: report.nextRunAt,
      consecutiveFailures: report.consecutiveFailures,
      recentExecutions: report.executions.map(exec => ({
        id: exec.id,
        status: exec.status,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        duration: exec.duration,
        errorMessage: exec.errorMessage
      })),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));
  }

  /**
   * Get execution history for a scheduled report
   */
  async getExecutionHistory(
    reportId: string,
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    }
  ) {
    // Verify ownership
    const report = await prisma.scheduledReport.findFirst({
      where: { id: reportId, userId }
    });

    if (!report) {
      throw new Error('Scheduled report not found');
    }

    const where: any = { scheduledReportId: reportId };
    if (options?.status) {
      where.status = options.status;
    }

    const executions = await prisma.scheduledReportExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0
    });

    return executions.map(exec => ({
      id: exec.id,
      status: exec.status,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      duration: exec.duration,
      reportFiles: JSON.parse(exec.reportFiles),
      deliveryStatus: JSON.parse(exec.deliveryStatus),
      errorMessage: exec.errorMessage,
      errorDetails: exec.errorDetails ? JSON.parse(exec.errorDetails) : null,
      retryCount: exec.retryCount,
      metadata: JSON.parse(exec.metadata),
      createdAt: exec.createdAt
    }));
  }

  /**
   * Calculate the next run time for a scheduled report
   */
  private calculateNextRunTime(config: ScheduledReportConfig): Date {
    const now = new Date();
    const [hours, minutes] = config.scheduleTime.split(':').map(Number);
    
    // Convert to timezone
    const nowInTz = toZonedTime(now, config.timezone);
    let nextRun = startOfDay(nowInTz);
    nextRun = setHours(nextRun, hours);
    nextRun = setMinutes(nextRun, minutes);

    switch (config.frequency) {
      case 'daily':
        if (nextRun <= nowInTz) {
          nextRun = addDays(nextRun, 1);
        }
        break;

      case 'weekly':
        const targetDayOfWeek = config.dayOfWeek ?? 1; // Default Monday
        let daysUntilTarget = (targetDayOfWeek - nextRun.getDay() + 7) % 7;
        if (daysUntilTarget === 0 && nextRun <= nowInTz) {
          daysUntilTarget = 7;
        }
        nextRun = addDays(nextRun, daysUntilTarget);
        break;

      case 'monthly':
        const targetDayOfMonth = config.dayOfMonth ?? 1;
        nextRun.setDate(targetDayOfMonth);
        if (nextRun <= nowInTz) {
          nextRun = addMonths(nextRun, 1);
          nextRun.setDate(targetDayOfMonth);
        }
        break;

      case 'quarterly':
        const quarterMonths = config.quarterMonths ?? [1, 4, 7, 10];
        const currentMonth = nowInTz.getMonth() + 1;
        let targetMonth = quarterMonths.find(m => m > currentMonth) ?? quarterMonths[0];
        let targetYear = nowInTz.getFullYear();
        
        if (targetMonth <= currentMonth) {
          targetYear++;
        }
        
        nextRun = new Date(targetYear, targetMonth - 1, config.dayOfMonth ?? 1);
        nextRun = setHours(nextRun, hours);
        nextRun = setMinutes(nextRun, minutes);
        
        if (nextRun <= nowInTz) {
          // Move to next quarter
          const nextQuarterIndex = (quarterMonths.indexOf(targetMonth) + 1) % quarterMonths.length;
          targetMonth = quarterMonths[nextQuarterIndex];
          if (nextQuarterIndex === 0) targetYear++;
          nextRun = new Date(targetYear, targetMonth - 1, config.dayOfMonth ?? 1);
          nextRun = setHours(nextRun, hours);
          nextRun = setMinutes(nextRun, minutes);
        }
        break;
    }

    // Convert back to UTC
    return fromZonedTime(nextRun, config.timezone);
  }

  /**
   * Schedule the next run of a report
   */
  private async scheduleNextRun(reportId: string, runAt: Date): Promise<void> {
    const delay = runAt.getTime() - Date.now();
    
    if (delay < 0) {
      structuredLogger.warn('Scheduled run time is in the past, running immediately', {
        component: 'scheduled-reports',
        reportId,
        runAt
      });
    }

    const queue = getQueue<{ reportId: string }>(QUEUE_NAMES.REPORT_GENERATION);
    await queue.add(
      `scheduled-run-${reportId}`,
      { reportId },
      {
        delay: Math.max(0, delay),
        priority: PRIORITY_LEVELS.NORMAL,
        attempts: 1, // Will be retried by the processor
        jobId: `scheduled-${reportId}-${runAt.getTime()}`
      }
    );

    structuredLogger.info('Scheduled next report run', {
      component: 'scheduled-reports',
      reportId,
      runAt,
      delay
    });
  }

  /**
   * Cancel scheduled jobs for a report
   */
  private async cancelScheduledJobs(reportId: string): Promise<void> {
    try {
      const queue = getQueue(QUEUE_NAMES.REPORT_GENERATION);
      const jobs = await queue.getJobs(['delayed', 'waiting']);
      
      for (const job of jobs) {
        if (job.name === `scheduled-run-${reportId}` || 
            job.id?.startsWith(`scheduled-${reportId}-`)) {
          await job.remove();
          structuredLogger.info('Cancelled scheduled job', {
            component: 'scheduled-reports',
            reportId,
            jobId: job.id
          });
        }
      }
    } catch (error) {
      structuredLogger.error('Failed to cancel scheduled jobs', error, {
        component: 'scheduled-reports',
        reportId
      });
    }
  }

  /**
   * Handle report execution completion
   */
  async handleExecutionComplete(
    reportId: string,
    executionId: string,
    success: boolean,
    nextRunAt?: Date
  ): Promise<void> {
    try {
      await prisma.scheduledReport.update({
        where: { id: reportId },
        data: {
          lastRunAt: new Date(),
          nextRunAt: nextRunAt ?? null,
          consecutiveFailures: success ? 0 : { increment: 1 }
        }
      });

      // Schedule next run if provided
      if (nextRunAt) {
        await this.scheduleNextRun(reportId, nextRunAt);
      }

      structuredLogger.info('Updated scheduled report after execution', {
        component: 'scheduled-reports',
        reportId,
        executionId,
        success,
        nextRunAt
      });
    } catch (error) {
      structuredLogger.error('Failed to handle execution completion', error, {
        component: 'scheduled-reports',
        reportId,
        executionId
      });
    }
  }

  /**
   * Get reports due for execution
   */
  async getReportsDueForExecution(): Promise<string[]> {
    const reports = await prisma.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: new Date()
        }
      },
      select: { id: true }
    });

    return reports.map(r => r.id);
  }
}