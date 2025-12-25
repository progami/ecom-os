-- Extend audit entity types for export tracking.

ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'EXPORT';

