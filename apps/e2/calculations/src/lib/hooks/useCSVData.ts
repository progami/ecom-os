// src/lib/hooks/useCSVData.ts

import { useState, useEffect } from 'react';
import { CSVData, Assumptions, ProductMargin } from '@/types/financial';
import { dataLoader } from '@/lib/clientDataLoader';

interface UseCSVDataReturn {
  csvData: CSVData | null;
  defaultAssumptions: Partial<Assumptions> | null;
  productMargins: ProductMargin[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCSVData(): UseCSVDataReturn {
  const [csvData, setCSVData] = useState<CSVData | null>(null);
  const [defaultAssumptions, setDefaultAssumptions] = useState<Partial<Assumptions> | null>(null);
  const [productMargins, setProductMargins] = useState<ProductMargin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load all data in parallel
      const [data, assumptions, margins] = await Promise.all([
        dataLoader.loadAllData(),
        dataLoader.getDefaultAssumptions(),
        dataLoader.getProductMargins()
      ]);
      
      setCSVData(data);
      setDefaultAssumptions(assumptions);
      setProductMargins(margins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CSV data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  const refresh = async () => {
    dataLoader.clearCache();
    await loadData();
  };
  
  return {
    csvData,
    defaultAssumptions,
    productMargins,
    loading,
    error,
    refresh
  };
}

// Hook for using just product margins
export function useProductMargins() {
  const [margins, setMargins] = useState<ProductMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadMargins = async () => {
      try {
        const data = await dataLoader.getProductMargins();
        setMargins(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product margins');
      } finally {
        setLoading(false);
      }
    };
    
    loadMargins();
  }, []);
  
  return { margins, loading, error };
}

// Hook for using default assumptions
export function useDefaultAssumptions() {
  const [assumptions, setAssumptions] = useState<Partial<Assumptions> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadAssumptions = async () => {
      try {
        const data = await dataLoader.getDefaultAssumptions();
        setAssumptions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load default assumptions');
      } finally {
        setLoading(false);
      }
    };
    
    loadAssumptions();
  }, []);
  
  return { assumptions, loading, error };
}