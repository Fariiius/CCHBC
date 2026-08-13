"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import * as xlsx from 'xlsx';

export type DataRecord = Record<string, any>;

export interface DashboardData {
  records: DataRecord[];
  fileName: string;
  lastUpdated: number;
  sheetNames: string[];
  allSheets: Record<string, DataRecord[]>;
}

export interface Schema {
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];
  allCols: string[];
}

export interface ChartConfig {
  id: string;
  categoryCol: string;
  valueCol: string;
  title: string;
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
  chartConfigs: ChartConfig[];
  addChart: (categoryCol: string, valueCol: string) => void;
  removeChart: (id: string) => void;
  activeSheet: string;
  setActiveSheet: (name: string) => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

// Intelligent date detection
const isDateValue = (val: any): boolean => {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number' && val > 25000 && val < 60000) return true; // Excel serial date range
  if (typeof val === 'string') {
    const s = val.trim();
    // yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy, yyyy/mm/dd, etc.
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true;
    // Month names
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s)) return true;
    // Try parsing
    const d = new Date(s);
    if (!isNaN(d.getTime()) && s.length > 4) return true;
  }
  return false;
};

const isNumericValue = (val: any): boolean => {
  if (typeof val === 'number') return true;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[,$%€£\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
    return cleaned !== '' && !isNaN(Number(cleaned));
  }
  return false;
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);
  const [activeSheet, setActiveSheetState] = useState<string>('');

  const detectSchema = (records: DataRecord[]): Schema => {
    if (records.length === 0) return { numericCols: [], categoricalCols: [], dateCols: [], allCols: [] };

    const allCols = Object.keys(records[0]);
    const sample = records.slice(0, Math.min(records.length, 200));

    const numericCols: string[] = [];
    const categoricalCols: string[] = [];
    const dateCols: string[] = [];

    allCols.forEach(col => {
      // Get non-null/empty values
      const values = sample.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      if (values.length === 0) return;

      let dateCount = 0;
      let numCount = 0;

      values.forEach(val => {
        if (isDateValue(val)) dateCount++;
        if (isNumericValue(val)) numCount++;
      });

      const dateRatio = dateCount / values.length;
      const numRatio = numCount / values.length;

      if (dateRatio > 0.6) {
        dateCols.push(col);
      } else if (numRatio > 0.7) {
        numericCols.push(col);
      } else {
        categoricalCols.push(col);
      }
    });

    return { numericCols, categoricalCols, dateCols, allCols };
  };

  const generateDefaultCharts = (s: Schema) => {
    const charts: ChartConfig[] = [];
    let id = 0;

    // Create a pie chart for each categorical column paired with the first numeric column
    if (s.numericCols.length > 0) {
      const numCol = s.numericCols[0];
      s.categoricalCols.forEach(catCol => {
        charts.push({
          id: `auto-${id++}`,
          categoryCol: catCol,
          valueCol: numCol,
          title: `${numCol} by ${catCol}`
        });
      });

      // If there are date columns, also create a chart for those
      s.dateCols.forEach(dateCol => {
        charts.push({
          id: `auto-${id++}`,
          categoryCol: dateCol,
          valueCol: numCol,
          title: `${numCol} by ${dateCol}`
        });
      });

      // If we have multiple numeric columns, create charts pairing cat cols with 2nd numeric
      if (s.numericCols.length > 1 && s.categoricalCols.length > 0) {
        const numCol2 = s.numericCols[1];
        s.categoricalCols.slice(0, 2).forEach(catCol => {
          charts.push({
            id: `auto-${id++}`,
            categoryCol: catCol,
            valueCol: numCol2,
            title: `${numCol2} by ${catCol}`
          });
        });
      }
    }

    return charts;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      const allSheets: Record<string, DataRecord[]> = {};
      workbook.SheetNames.forEach(name => {
        const ws = workbook.Sheets[name];
        allSheets[name] = xlsx.utils.sheet_to_json(ws, { defval: '' }) as DataRecord[];
      });

      const firstSheet = workbook.SheetNames[0];
      const records = allSheets[firstSheet];

      if (!records || records.length === 0) throw new Error("The uploaded file appears to be empty.");

      const newSchema = detectSchema(records);
      const defaultCharts = generateDefaultCharts(newSchema);

      setSchema(newSchema);
      setChartConfigs(defaultCharts);
      setActiveSheetState(firstSheet);
      setData({
        records,
        fileName: file.name,
        lastUpdated: Date.now(),
        sheetNames: workbook.SheetNames,
        allSheets
      });

      const initialFilters: Record<string, string[]> = {};
      newSchema.categoricalCols.forEach(col => {
        initialFilters[col] = [];
      });
      newSchema.dateCols.forEach(col => {
        initialFilters[col] = [];
      });
      setFilters(initialFilters);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const setActiveSheet = (name: string) => {
    if (!data || !data.allSheets[name]) return;
    const records = data.allSheets[name];
    const newSchema = detectSchema(records);
    const defaultCharts = generateDefaultCharts(newSchema);
    setSchema(newSchema);
    setChartConfigs(defaultCharts);
    setActiveSheetState(name);
    setData(prev => prev ? { ...prev, records } : null);

    const initialFilters: Record<string, string[]> = {};
    newSchema.categoricalCols.forEach(col => { initialFilters[col] = []; });
    newSchema.dateCols.forEach(col => { initialFilters[col] = []; });
    setFilters(initialFilters);
  };

  const resetFilters = () => {
    if (!schema) return;
    const initialFilters: Record<string, string[]> = {};
    schema.categoricalCols.forEach(col => { initialFilters[col] = []; });
    schema.dateCols.forEach(col => { initialFilters[col] = []; });
    setFilters(initialFilters);
  };

  const resetDashboard = () => {
    setData(null);
    setSchema(null);
    setFilters({});
    setChartConfigs([]);
  };

  const uniqueValuesForColumn = (col: string): string[] => {
    if (!data) return [];
    return Array.from(new Set(data.records.map(r => String(r[col] ?? '')))).filter(v => v !== '').sort();
  };

  const addChart = (categoryCol: string, valueCol: string) => {
    const newChart: ChartConfig = {
      id: `user-${Date.now()}`,
      categoryCol,
      valueCol,
      title: `${valueCol} by ${categoryCol}`
    };
    setChartConfigs(prev => [...prev, newChart]);
  };

  const removeChart = (id: string) => {
    setChartConfigs(prev => prev.filter(c => c.id !== id));
  };

  const filteredData = useMemo(() => {
    if (!data || !schema) return [];
    return data.records.filter((record) => {
      let match = true;
      [...schema.categoricalCols, ...schema.dateCols].forEach(col => {
        const filterVals = filters[col] || [];
        if (filterVals.length > 0) {
          match = match && filterVals.includes(String(record[col] ?? ''));
        }
      });
      return match;
    });
  }, [data, filters, schema]);

  return (
    <DashboardContext.Provider value={{
      data, schema, filteredData, loading, error, filters, setFilters,
      handleFileUpload, resetFilters, resetDashboard, uniqueValuesForColumn,
      chartConfigs, addChart, removeChart, activeSheet, setActiveSheet
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
