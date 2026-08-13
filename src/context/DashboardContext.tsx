"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import * as xlsx from 'xlsx';

// Generic data record
export type DataRecord = Record<string, any>;

export interface DashboardData {
  records: DataRecord[];
  fileName: string;
  lastUpdated: number;
}

export interface Schema {
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];
  allCols: string[];
}

interface DashboardContextProps {
  data: DashboardData | null;
  schema: Schema | null;
  filteredData: DataRecord[];
  loading: boolean;
  error: string | null;
  filters: Record<string, string[]>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  handleFileUpload: (file: File) => Promise<void>;
  resetFilters: () => void;
  resetDashboard: () => void;
  uniqueValuesForColumn: (col: string) => string[];
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const detectSchema = (records: DataRecord[]): Schema => {
    if (records.length === 0) return { numericCols: [], categoricalCols: [], dateCols: [], allCols: [] };
    
    const sample = records.slice(0, Math.min(records.length, 100));
    const allCols = Object.keys(records[0]);
    
    const numericCols: string[] = [];
    const categoricalCols: string[] = [];
    const dateCols: string[] = [];

    allCols.forEach(col => {
      // Check column type across the sample
      let isNumeric = true;
      let isDate = false;

      // Basic date regex (yyyy-mm-dd or similar)
      const dateRegex = /^\d{4}-\d{2}-\d{2}/;

      for (const row of sample) {
        const val = row[col];
        if (val !== undefined && val !== null) {
          if (typeof val === 'string' && dateRegex.test(val)) {
            isDate = true;
            isNumeric = false;
            break;
          }
          if (typeof val !== 'number' && isNaN(Number(val))) {
            isNumeric = false;
          }
        }
      }

      if (isDate) {
        dateCols.push(col);
      } else if (isNumeric) {
        numericCols.push(col);
      } else {
        categoricalCols.push(col);
      }
    });

    return { numericCols, categoricalCols, dateCols, allCols };
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const records = xlsx.utils.sheet_to_json(worksheet) as DataRecord[];

      if (records.length === 0) throw new Error("The uploaded file is empty.");

      const newSchema = detectSchema(records);
      
      setSchema(newSchema);
      setData({
        records,
        fileName: file.name,
        lastUpdated: Date.now()
      });
      // Initialize filters based on categorical columns
      const initialFilters: Record<string, string[]> = {};
      newSchema.categoricalCols.forEach(col => {
        initialFilters[col] = [];
      });
      setFilters(initialFilters);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    if (!schema) return;
    const initialFilters: Record<string, string[]> = {};
    schema.categoricalCols.forEach(col => {
      initialFilters[col] = [];
    });
    setFilters(initialFilters);
  };

  const resetDashboard = () => {
    setData(null);
    setSchema(null);
    setFilters({});
  };

  const uniqueValuesForColumn = (col: string): string[] => {
    if (!data) return [];
    return Array.from(new Set(data.records.map(r => String(r[col])))).sort();
  };

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!data || !schema) return [];
    return data.records.filter((record) => {
      let match = true;
      schema.categoricalCols.forEach(col => {
        const filterVals = filters[col] || [];
        if (filterVals.length > 0) {
          match = match && filterVals.includes(String(record[col]));
        }
      });
      return match;
    });
  }, [data, filters, schema]);

  return (
    <DashboardContext.Provider value={{
      data,
      schema,
      filteredData,
      loading,
      error,
      filters,
      setFilters,
      handleFileUpload,
      resetFilters,
      resetDashboard,
      uniqueValuesForColumn
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
