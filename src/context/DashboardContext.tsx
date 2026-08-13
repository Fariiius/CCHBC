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

// Ignore columns that are likely IDs or Years
const isIgnoredNumericCol = (colName: string, values: number[]): boolean => {
  const lower = colName.toLowerCase();
  if (lower.includes('id') || lower.includes('code') || lower.includes('index') || lower.includes('#')) {
    return true;
  }
  if (lower.includes('year')) return true;

  // Check if values look like years (e.g. 1990 - 2100)
  const allYears = values.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100);
  if (allYears) return true;

  return false;
};

const analyzeSheet = (name: string, rawArray: any[][]): SheetAnalysis => {
  if (!rawArray || rawArray.length === 0) {
    return { name, records: [], numericCols: [], categoricalCols: [], dateCols: [], allCols: [], kpis: [], topGroups: [], rowCount: 0, isEmpty: true };
  }

  // 1. Find the header row by looking for the row with the most string values
  let headerRowIdx = 0;
  let maxStrings = 0;

  for (let i = 0; i < Math.min(rawArray.length, 20); i++) {
    const row = rawArray[i];
    if (!row) continue;
    const stringCount = row.filter(val => typeof val === 'string' && val.trim() !== '').length;
    if (stringCount > maxStrings) {
      maxStrings = stringCount;
      headerRowIdx = i;
    }
  }

  if (maxStrings === 0) {
    return { name, records: [], numericCols: [], categoricalCols: [], dateCols: [], allCols: [], kpis: [], topGroups: [], rowCount: 0, isEmpty: true };
  }

  const headers = rawArray[headerRowIdx].map((h, i) => h ? String(h).trim() : `Column_${i}`);
  
  // 2. Build records
  const records: DataRecord[] = [];
  for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
    const row = rawArray[i];
    if (!row || row.length === 0) continue;
    
    // Check if row is mostly empty
    const nonEmptyCount = row.filter(val => val !== null && val !== undefined && val !== '').length;
    if (nonEmptyCount < Math.max(2, headers.length * 0.3)) continue;

    const record: DataRecord = {};
    headers.forEach((h, colIdx) => {
      record[h] = row[colIdx];
    });
    records.push(record);
  }

  if (records.length === 0) {
    return { name, records: [], numericCols: [], categoricalCols: [], dateCols: [], allCols: [], kpis: [], topGroups: [], rowCount: 0, isEmpty: true };
  }

  const allCols = headers;
  const sample = records.slice(0, Math.min(records.length, 300));

  const rawNumericCols: string[] = [];
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
    else if (numCount / total > 0.6) rawNumericCols.push(col);
    else categoricalCols.push(col);
  });

  // Filter numeric columns to remove IDs/Years
  const numericCols = rawNumericCols.filter(col => {
    const vals = sample.map(r => parseNumber(r[col])).filter(n => n !== null) as number[];
    return !isIgnoredNumericCol(col, vals);
  });

  // 3. Build KPIs (Limit to top 4 metrics based on total absolute sum)
  const allKpiCandidates = numericCols.map(col => {
    const total = records.reduce((s, r) => s + (parseNumber(r[col]) ?? 0), 0);
    return { label: col, value: total, col, absSum: Math.abs(total) };
  });

  allKpiCandidates.sort((a, b) => b.absSum - a.absSum);
  const kpis = allKpiCandidates.slice(0, 4).map(k => ({ label: k.label, value: k.value, col: k.col }));

  // 4. Build top groups: Pick the top 2 numeric columns and top categorical columns
  const topGroups: SheetAnalysis['topGroups'] = [];
  const topNumCols = kpis.slice(0, 2).map(k => k.col);
  
  if (topNumCols.length > 0) {
    const usefulCatCols = [...categoricalCols, ...dateCols].filter(col => {
      const unique = new Set(records.map(r => String(r[col] ?? ''))).size;
      return unique >= 2 && unique <= 30; // Not too many slices
    });

    topNumCols.forEach(numCol => {
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
        // Parse as array of arrays to intelligently find the header row
        const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        return analyzeSheet(name, rawArray);
      }).filter(s => !s.isEmpty);

      if (analyzed.length === 0) throw new Error('No readable data found in this file. Please ensure the file has data.');

      // Auto-generate chart configs from top groups
      const autoCharts: ChartConfig[] = [];
      analyzed.forEach(sheet => {
        // Limit to 4 charts per sheet automatically to avoid clutter
        sheet.topGroups.slice(0, 4).forEach((group, i) => {
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
