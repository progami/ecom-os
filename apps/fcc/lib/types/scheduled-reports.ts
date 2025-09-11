export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type DeliveryMethod = 'email' | 'webhook' | 'cloud_storage' | 'download_link';
export type ReportType = 'profit-loss' | 'balance-sheet' | 'cash-flow' | 'tax-summary' | 'aged-receivables' | 'aged-payables' | 'bank-summary';
export type ReportFormat = 'pdf' | 'excel' | 'csv';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type TemplateCategory = 'finance' | 'tax' | 'compliance' | 'custom';

export interface ScheduledReportConfig {
  id?: string;
  name: string;
  description?: string;
  reportTypes: ReportType[];
  frequency: ReportFrequency;
  timezone: string;
  scheduleTime: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  quarterMonths?: number[]; // [1,4,7,10] for quarterly
  filters: ReportFilters;
  deliveryMethods: DeliveryMethodConfig[];
  templateId?: string;
  isActive: boolean;
}

export interface DeliveryMethodConfig {
  method: DeliveryMethod;
  config: EmailDeliveryConfig | WebhookDeliveryConfig | CloudStorageConfig | DownloadLinkConfig;
}

export interface EmailDeliveryConfig {
  recipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
  subject?: string;
  message?: string;
  attachFormats: ReportFormat[];
}

export interface WebhookDeliveryConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
  includeReportData?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface CloudStorageConfig {
  provider: 'google_drive' | 'dropbox' | 's3';
  folderId?: string;
  folderPath?: string;
  fileName?: string;
  format: ReportFormat;
  credentials?: Record<string, any>;
}

export interface DownloadLinkConfig {
  expirationDays: number;
  requireAuth: boolean;
  notifyEmail?: string;
  format: ReportFormat;
}

export interface ReportFilters {
  dateRange?: {
    type: 'custom' | 'last_month' | 'last_quarter' | 'last_year' | 'ytd';
    startDate?: string;
    endDate?: string;
  };
  accounts?: string[];
  departments?: string[];
  tags?: string[];
  customFilters?: Record<string, any>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  reportTypes: ReportType[];
  defaultFilters: ReportFilters;
  defaultFrequency?: ReportFrequency;
  defaultDelivery?: DeliveryMethodConfig[];
  isPublic: boolean;
  isSystem: boolean;
  createdBy?: string;
  version: number;
  metadata?: Record<string, any>;
}

export interface ScheduledReportExecution {
  id: string;
  scheduledReportId: string;
  status: ExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  reportFiles: string[];
  deliveryStatus: Record<string, DeliveryStatus>;
  errorMessage?: string;
  errorDetails?: any;
  retryCount: number;
  jobId?: string;
}

export interface ScheduledReportJob {
  scheduledReportId: string;
  userId: string;
  executionId: string;
  reportConfig: ScheduledReportConfig;
  isManualRun?: boolean;
}

export interface ReportGenerationResult {
  success: boolean;
  files: GeneratedReportFile[];
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface GeneratedReportFile {
  reportType: ReportType;
  format: ReportFormat;
  filePath: string;
  fileSize: number;
  generatedAt: Date;
}

export interface DeliveryResult {
  method: DeliveryMethod;
  success: boolean;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}