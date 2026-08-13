"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import * as xlsx from 'xlsx';

export type DataRecord = Record<string, any>;

export interface SheetAnalysis {
  name: string;
  records: DataRecord[];
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];
  allCols: string[];
  kpis: { label: string; value: number; col: string }[];
  topGroups: { col: string; valueCol: string; data: { name: string; value: number; pct: number }[] }[];
  rowCount: number;
  isEmpty: boolean;
}

export interface ChartConfig {
  id: string;
  sheetName: string;
  categoryCol: string;
  valueCol: string;
  title: string;
}

interface DashboardContextProps {
  sheets: SheetAnalysis[];
  loading: boolean;
  error: string | null;
  fileName: string;
  globalFilters: Record<string, Record<string, string[]>>;
  toggleFilter: (sheet: string, col: string, val: string) => void;
  resetFilters: () => void;
  handleFileUpload: (file: File) => Promise<void>;
  resetDashboard: () => void;
  chartConfigs: ChartConfig[];
  addChart: (sheetName: string, categoryCol: string, valueCol: string) => void;
  removeChart: (id: string) => void;
  getFilteredRecords: (sheetName: string) => DataRecord[];
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

// ─── Intelligence Engine ────────────────────────────────────────────────────

const isDateLike = (v: any): boolean => {
  if (v instanceof Date) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true;
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) && s.length < 20) return true;
  }
  return false;
};

const parseNumber = (v: any): number | null => {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s$€£¥%]/g, '').replace(/\(([^)]+)\)/, '-$1').trim();
    if (cleaned === '' || cleaned === '-') return null;
    const n = Number(cleaned);
    return isFinite(n) ? n : null;
  }
  return null;
};

const isRowMeaningful = (row: DataRecord): boolean => {
  const vals = Object.values(row);
  const nonEmpty = vals.filter(v => v !== null && v !== undefined && v !== '');
  return nonEmpty.length >= Math.max(2, vals.length * 0.3);
};

const analyzeSheet = (name: string, rawRecords: DataRecord[]): SheetAnalysis => {
  // Filter out mostly-empty rows
  const records = rawRecords.filter(isRowMeaningful);

  if (records.length === 0) {
    return {
      name, records: [], numericCols: [], categoricalCols: [], dateCols: [],
      allCols: [], kpis: [], topGroups: [], rowCount: 0, isEmpty: true
    };
  }

  const allCols = Object.keys(records[0]);
  const sample = records.slice(0, Math.min(records.length, 300));

  const numericCols: string[] = [];
  const categoricalCols: string[] = [];
  const dateCols: string[] = [];

  allCols.forEach(col => {
    const vals = sample.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) return;

    let numCount = 0, dateCount = 0, catCount = 0;
    vals.forEach(v => {
      if (isDateLike(v)) dateCount++;
      else if (parseNumber(v) !== null) numCount++;
      else catCount++;
    });

    const total = vals.length;
    if (dateCount / total > 0.5) dateCols.push(col);
    else if (numCount / total > 0.6) numericCols.push(col);
    else categoricalCols.push(col);
  });

  // Build KPIs from numeric columns
  const kpis = numericCols.map(col => {
    const total = records.reduce((s, r) => {
      const n = parseNumber(r[col]);
      return s + (n ?? 0);
    }, 0);
    return { label: col, value: total, col };
  });

  // Build top groups: for each categorical col × first numeric col
  const topGroups: SheetAnalysis['topGroups'] = [];
  const numCol = numericCols[0];
  if (numCol) {
    const usefulCatCols = [...categoricalCols, ...dateCols].filter(col => {
      const unique = new Set(records.map(r => String(r[col] ?? ''))).size;
      return unique >= 2 && unique <= 30;
    });

    usefulCatCols.forEach(catCol => {
      const map = new Map<string, number>();
      records.forEach(r => {
        const key = String(r[catCol] ?? 'Other').trim();
        if (!key || key === 'undefined' || key === 'null') return;
        const n = parseNumber(r[numCol]);
        map.set(key, (map.get(key) || 0) + (n ?? 0));
      });

      const total = Array.from(map.values()).reduce((a, b) => a + Math.abs(b), 0);
      const data = Array.from(map.entries())
        .map(([name, value]) => ({
          name,
          value,
          pct: total > 0 ? Math.abs(value / total) * 100 : 0
        }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 15);

      if (data.length >= 2) {
        topGroups.push({ col: catCol, valueCol: numCol, data });
      }
    });
  }

  return {
    name, records, numericCols, categoricalCols, dateCols, allCols,
    kpis, topGroups, rowCount: records.length, isEmpty: false
  };
};

// ─── Provider ───────────────────────────────────────────────────────────────

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sheets, setSheets] = useState<SheetAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [globalFilters, setGlobalFilters] = useState<Record<string, Record<string, string[]>>>({});
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      const analyzed: SheetAnalysis[] = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        const raw = xlsx.utils.sheet_to_json(ws, { defval: '' }) as DataRecord[];
        return analyzeSheet(name, raw);
      }).filter(s => !s.isEmpty);

      if (analyzed.length === 0) throw new Error('No readable data found in this file. Please ensure the file has header rows and data.');

      // Auto-generate chart configs from top groups
      const autoCharts: ChartConfig[] = [];
      analyzed.forEach(sheet => {
        sheet.topGroups.forEach((group, i) => {
          autoCharts.push({
            id: `auto-${sheet.name}-${i}`,
            sheetName: sheet.name,
            categoryCol: group.col,
            valueCol: group.valueCol,
            title: `${group.valueCol} by ${group.col}`
          });
        });
      });

      setSheets(analyzed);
      setChartConfigs(autoCharts);
      setFileName(file.name);

      // Init filters
      const initFilters: Record<string, Record<string, string[]>> = {};
      analyzed.forEach(sheet => {
        initFilters[sheet.name] = {};
      });
      setGlobalFilters(initFilters);

    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (sheet: string, col: string, val: string) => {
    setGlobalFilters(prev => {
      const sheetFilters = prev[sheet] || {};
      const colVals = sheetFilters[col] || [];
      const newVals = colVals.includes(val) ? colVals.filter(v => v !== val) : [...colVals, val];
      return { ...prev, [sheet]: { ...sheetFilters, [col]: newVals } };
    });
  };

  const resetFilters = () => {
    const initFilters: Record<string, Record<string, string[]>> = {};
    sheets.forEach(s => { initFilters[s.name] = {}; });
    setGlobalFilters(initFilters);
  };

  const resetDashboard = () => {
    setSheets([]);
    setChartConfigs([]);
    setFileName('');
    setGlobalFilters({});
    setError(null);
  };

  const addChart = (sheetName: string, categoryCol: string, valueCol: string) => {
    setChartConfigs(prev => [...prev, {
      id: `user-${Date.now()}`,
      sheetName,
      categoryCol,
      valueCol,
      title: `${valueCol} by ${categoryCol}`
    }]);
  };

  const removeChart = (id: string) => {
    setChartConfigs(prev => prev.filter(c => c.id !== id));
  };

  const getFilteredRecords = (sheetName: string): DataRecord[] => {
    const sheet = sheets.find(s => s.name === sheetName);
    if (!sheet) return [];
    const filters = globalFilters[sheetName] || {};

    return sheet.records.filter(row => {
      return Object.entries(filters).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        return vals.includes(String(row[col] ?? ''));
      });
    });
  };

  return (
    <DashboardContext.Provider value={{
      sheets, loading, error, fileName, globalFilters,
      toggleFilter, resetFilters, handleFileUpload, resetDashboard,
      chartConfigs, addChart, removeChart, getFilteredRecords
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};
