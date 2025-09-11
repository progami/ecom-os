// src/lib/csvUploader.ts

import { parse } from 'csv-parse/sync';

export interface CSVUploadResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
  columnCount?: number;
}

/**
 * Parse CSV file content in the browser
 */
export function parseCSVContent(content: string): CSVUploadResult {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      relax_column_count: true
    });
    
    if (!records || records.length === 0) {
      return {
        success: false,
        error: 'No data found in CSV file'
      };
    }
    
    const columnCount = Object.keys(records[0]).length;
    
    return {
      success: true,
      data: records,
      rowCount: records.length,
      columnCount
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse CSV'
    };
  }
}

/**
 * Read uploaded file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Handle CSV file upload and parsing
 */
export async function handleCSVUpload(file: File): Promise<CSVUploadResult> {
  try {
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return {
        success: false,
        error: 'Please upload a CSV file'
      };
    }
    
    // Read file content
    const content = await readFileAsText(file);
    
    // Parse CSV
    return parseCSVContent(content);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process file'
    };
  }
}

/**
 * Map CSV columns to expected structure
 */
export function mapCSVColumns(
  data: any[],
  columnMapping: Record<string, string>
): any[] {
  return data.map(row => {
    const mappedRow: any = {};
    
    Object.entries(columnMapping).forEach(([sourceCol, targetCol]) => {
      if (row[sourceCol] !== undefined) {
        mappedRow[targetCol] = row[sourceCol];
      }
    });
    
    return mappedRow;
  });
}

/**
 * Validate CSV structure against expected schema
 */
export function validateCSVStructure(
  data: any[],
  requiredColumns: string[]
): { isValid: boolean; missingColumns: string[] } {
  if (!data || data.length === 0) {
    return {
      isValid: false,
      missingColumns: requiredColumns
    };
  }
  
  const firstRow = data[0];
  const presentColumns = Object.keys(firstRow);
  const missingColumns = requiredColumns.filter(
    col => !presentColumns.includes(col)
  );
  
  return {
    isValid: missingColumns.length === 0,
    missingColumns
  };
}