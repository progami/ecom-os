import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { systemLogger } from './index';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rename = promisify(fs.rename);
const mkdir = promisify(fs.mkdir);

export interface RotationConfig {
  logDir: string;
  archiveDir: string;
  maxAge: number; // Days to keep logs
  maxSize: number; // Max size in bytes before rotation
  checkInterval: number; // How often to check for rotation (ms)
}

export class LogRotator {
  private config: RotationConfig;
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RotationConfig> = {}) {
    this.config = {
      logDir: config.logDir || './logs',
      archiveDir: config.archiveDir || './logs/archived',
      maxAge: config.maxAge || 14, // 14 days
      maxSize: config.maxSize || 20 * 1024 * 1024, // 20MB
      checkInterval: config.checkInterval || 60 * 60 * 1000, // 1 hour
    };

    // Ensure archive directory exists
    this.ensureArchiveDir();
  }

  async ensureArchiveDir() {
    try {
      await mkdir(this.config.archiveDir, { recursive: true });
    } catch (_error) {
      systemLogger.error('Failed to create archive directory', { error: _error });
    }
  }

  start() {
    // Run initial check
    this.checkAndRotate();

    // Set up periodic checks
    this.rotationTimer = setInterval(() => {
      this.checkAndRotate();
    }, this.config.checkInterval);

    systemLogger.info('Log rotation started', {
      config: this.config,
    });
  }

  stop() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      systemLogger.info('Log rotation stopped');
    }
  }

  async checkAndRotate() {
    try {
      const files = await readdir(this.config.logDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(this.config.logDir, file);
        const stats = await stat(filePath);
        
        // Check if file needs rotation based on size
        if (stats.size > this.config.maxSize) {
          await this.rotateFile(filePath, file);
        }
      }
      
      // Clean up old archived files
      await this.cleanupOldFiles();
    } catch (_error) {
      systemLogger.error('Error during log rotation check', { error: _error });
    }
  }

  async rotateFile(filePath: string, fileName: string) {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const archiveName = `${fileName}.${timestamp}`;
      const archivePath = path.join(this.config.archiveDir, archiveName);
      
      // Move file to archive
      await rename(filePath, archivePath);
      
      systemLogger.info('Log file rotated', {
        original: fileName,
        archived: archiveName,
      });
      
      // Compress archived file (optional)
      // await this.compressFile(archivePath);
    } catch (_error) {
      systemLogger.error('Failed to rotate log file', {
        file: fileName,
        error: _error,
      });
    }
  }

  async cleanupOldFiles() {
    try {
      const files = await readdir(this.config.archiveDir);
      const now = Date.now();
      const maxAgeMs = this.config.maxAge * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        const filePath = path.join(this.config.archiveDir, file);
        const stats = await stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await unlink(filePath);
          systemLogger.info('Old log file deleted', { file });
        }
      }
    } catch (_error) {
      systemLogger.error('Error cleaning up old log files', { error: _error });
    }
  }

  // Get log file statistics
  async getLogStats() {
    try {
      const logFiles = await readdir(this.config.logDir);
      const archiveFiles = await readdir(this.config.archiveDir);
      
      let totalSize = 0;
      let fileCount = 0;
      
      // Calculate size of active logs
      for (const file of logFiles) {
        if (!file.endsWith('.log')) continue;
        const filePath = path.join(this.config.logDir, file);
        const stats = await stat(filePath);
        totalSize += stats.size;
        fileCount++;
      }
      
      // Calculate size of archived logs
      let archiveSize = 0;
      for (const file of archiveFiles) {
        const filePath = path.join(this.config.archiveDir, file);
        const stats = await stat(filePath);
        archiveSize += stats.size;
      }
      
      return {
        activeFiles: fileCount,
        archivedFiles: archiveFiles.length,
        totalActiveSize: totalSize,
        totalArchiveSize: archiveSize,
        totalSize: totalSize + archiveSize,
      };
    } catch (_error) {
      systemLogger.error('Failed to get log statistics', { error: _error });
      return null;
    }
  }
}

// Create singleton instance
export const logRotator = new LogRotator();

// Helper function to manually trigger rotation
export async function rotateLogsManually() {
  await logRotator.checkAndRotate();
}

// Helper function to get current log sizes
export async function getLogSizes(): Promise<Record<string, number>> {
  const logDir = process.env.LOG_DIR || './logs';
  const sizes: Record<string, number> = {};
  
  try {
    const files = await readdir(logDir);
    
    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
      const filePath = path.join(logDir, file);
      const stats = await stat(filePath);
      sizes[file] = stats.size;
    }
    
    return sizes;
  } catch (_error) {
    systemLogger.error('Failed to get log sizes', { error: _error });
    return sizes;
  }
}