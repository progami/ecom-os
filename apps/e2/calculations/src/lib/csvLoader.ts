// src/lib/csvLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import logger from '@/utils/logger';

export interface CSVParseOptions {
  columns?: boolean;
  skip_empty_lines?: boolean;
  trim?: boolean;
  cast?: boolean;
  cast_date?: boolean;
  relax_column_count?: boolean;
}

/**
 * Load and parse a CSV file from the data directory
 * @param filename - Name of the CSV file in the data directory
 * @param options - CSV parsing options
 * @returns Parsed CSV data as array of objects
 */
export function loadCSV(filename: string, options: CSVParseOptions = {}): any[] {
  try {
    // Construct path to CSV file (assumes data directory is at ../data relative to src)
    const dataPath = path.join(process.cwd(), '..', 'data', filename);
    
    // Read file contents
    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    
    // Default parse options
    const parseOptions: CSVParseOptions = {
      columns: true, // Use first row as column names
      skip_empty_lines: true,
      trim: true,
      cast: true,
      relax_column_count: true,
      ...options
    };
    
    // Parse CSV
    const records = parse(fileContent, parseOptions);
    
    return records;
  } catch (error) {
    logger.error(`Error loading CSV file ${filename}:`, error);
    throw error;
  }
}

/**
 * Load CSV with custom column mapping
 * @param filename - Name of the CSV file
 * @param columnMap - Map of original column names to new names
 * @returns Parsed and mapped CSV data
 */
export function loadCSVWithMapping(
  filename: string, 
  columnMap: Record<string, string>
): any[] {
  const records = loadCSV(filename);
  
  return records.map(record => {
    const mappedRecord: any = {};
    
    for (const [oldKey, value] of Object.entries(record)) {
      const newKey = columnMap[oldKey] || oldKey;
      mappedRecord[newKey] = value;
    }
    
    return mappedRecord;
  });
}

/**
 * Parse numeric values from CSV strings
 * Handles currency formats like $1,234.56 and percentages like 12.34%
 */
export function parseNumericValue(value: any): number {
  if (typeof value === 'number') return value;
  if (!value || value === '') return 0;
  
  const stringValue = String(value);
  
  // Remove currency symbols, commas, and percentage signs
  const cleanedValue = stringValue
    .replace(/[$,]/g, '')
    .replace(/%$/, '');
  
  const numericValue = parseFloat(cleanedValue);
  
  // If it was a percentage, divide by 100
  if (stringValue.includes('%')) {
    return numericValue / 100;
  }
  
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Transform CSV data with type casting
 * @param records - Raw CSV records
 * @param schema - Schema defining field types
 * @returns Transformed records with proper types
 */
export function transformCSVData(
  records: any[], 
  schema: Record<string, 'number' | 'string' | 'boolean' | 'date'>
): any[] {
  return records.map(record => {
    const transformedRecord: any = {};
    
    for (const [key, value] of Object.entries(record)) {
      const fieldType = schema[key] || 'string';
      
      switch (fieldType) {
        case 'number':
          transformedRecord[key] = parseNumericValue(value);
          break;
        case 'boolean':
          transformedRecord[key] = value === 'true' || value === '1' || value === true;
          break;
        case 'date':
          transformedRecord[key] = value ? new Date(value as string).toISOString() : null;
          break;
        default:
          transformedRecord[key] = value;
      }
    }
    
    return transformedRecord;
  });
}

/**
 * Load CSV data for server-side use (with file system access)
 * This function should only be used in API routes or server components
 */
export async function loadCSVServerSide(filename: string): Promise<any[]> {
  const dataPath = path.join(process.cwd(), '..', 'data', filename);
  
  try {
    const fileContent = await fs.promises.readFile(dataPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      relax_column_count: true
    });
    
    return records;
  } catch (error) {
    logger.error(`Error loading CSV file ${filename}:`, error);
    throw error;
  }
}

/**
 * Validate CSV data structure
 * @param records - CSV records to validate
 * @param requiredColumns - List of required column names
 * @returns Validation result
 */
export function validateCSVStructure(
  records: any[], 
  requiredColumns: string[]
): { isValid: boolean; missingColumns: string[] } {
  if (!records || records.length === 0) {
    return { isValid: false, missingColumns: requiredColumns };
  }
  
  const firstRecord = records[0];
  const recordColumns = Object.keys(firstRecord);
  const missingColumns = requiredColumns.filter(
    col => !recordColumns.includes(col)
  );
  
  return {
    isValid: missingColumns.length === 0,
    missingColumns
  };
}