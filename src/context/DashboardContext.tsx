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

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
}

interface DashboardContextProps {
  sheets: SheetAnalysis[];
  loading: boolean;
  error: string | null;
  fileName: string;
  activeSheet: string | null;
  setActiveSheet: (name: string) => void;
  // Master Filters: Column Name -> Selected Values (applies to ALL tables with this column)
  masterFilters: Record<string, string[]>;
  toggleFilter: (col: string, val: string) => void;
  resetFilters: () => void;
  handleFileUpload: (file: File) => Promise<void>;
  resetDashboard: () => void;
  chartConfigs: ChartConfig[];
  addChart: (sheetName: string, categoryCol: string, valueCol: string) => void;
  removeChart: (id: string) => void;
  kpiConfigs: KpiConfig[];
  addKpi: (sheetName: string, col: string) => void;
  removeKpi: (id: string) => void;
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

const isIgnoredNumericCol = (colName: string, values: number[]): boolean => {
  const lower = colName.toLowerCase();
  if (lower.includes('id') || lower.includes('code') || lower.includes('index') || lower.includes('#')) {
    return true;
  }
  if (lower.includes('year')) return true;

  const allYears = values.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100);
  if (allYears) return true;

  return false;
};

// Advanced Grid Detection: Split scattered tables into blocks
const splitIntoBlocks = (rawArray: any[][]): any[][][] => {
  if (!rawArray || rawArray.length === 0) return [];
  
  interface Cell { r: number; c: number; }
  const cells: Cell[] = [];
  for (let r = 0; r < rawArray.length; r++) {
    if (!rawArray[r]) continue;
    for (let c = 0; c < rawArray[r].length; c++) {
      const v = rawArray[r][c];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        cells.push({ r, c });
      }
    }
  }

  if (cells.length === 0) return [];

  const parent = new Map<string, string>();
  const makeId = (c: Cell) => `${c.r},${c.c}`;
  const find = (id: string): string => {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  };
  const union = (id1: string, id2: string) => {
    parent.set(find(id1), find(id2));
  };

  cells.forEach(c => parent.set(makeId(c), makeId(c)));
  const cellMap = new Set(cells.map(makeId));

  for (const c of cells) {
    const id = makeId(c);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nid = `${c.r + dr},${c.c + dc}`;
        if (cellMap.has(nid)) union(id, nid);
      }
    }
  }

  const groups = new Map<string, Cell[]>();
  cells.forEach(c => {
    const root = find(makeId(c));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(c);
  });

  const blocks: any[][][] = [];
  groups.forEach(group => {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    group.forEach(c => {
      minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r);
      minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c);
    });

    if (maxR - minR >= 1 && maxC - minC >= 1) {
      const block: any[][] = [];
      for (let r = minR; r <= maxR; r++) {
        const row = [];
        for (let c = minC; c <= maxC; c++) {
          row.push(rawArray[r]?.[c]);
        }
        block.push(row);
      }
      blocks.push(block);
    }
  });

  return blocks.length > 0 ? blocks : [rawArray];
};

const analyzeSheet = (name: string, rawArray: any[][]): SheetAnalysis => {
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
  
  const records: DataRecord[] = [];
  for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
    const row = rawArray[i];
    if (!row || row.length === 0) continue;
    
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

  const numericCols = rawNumericCols.filter(col => {
    const vals = sample.map(r => parseNumber(r[col])).filter(n => n !== null) as number[];
    return !isIgnoredNumericCol(col, vals);
  });

  const allKpiCandidates = numericCols.map(col => {
    const total = records.reduce((s, r) => s + (parseNumber(r[col]) ?? 0), 0);
    return { label: col, value: total, col, absSum: Math.abs(total) };
  });

  allKpiCandidates.sort((a, b) => b.absSum - a.absSum);
  const kpis = allKpiCandidates.slice(0, 4).map(k => ({ label: k.label, value: k.value, col: k.col }));

  const topGroups: SheetAnalysis['topGroups'] = [];
  const topNumCols = kpis.slice(0, 2).map(k => k.col);
  
  if (topNumCols.length > 0) {
    const usefulCatCols = [...categoricalCols, ...dateCols].filter(col => {
      const unique = new Set(records.map(r => String(r[col] ?? ''))).size;
      return unique >= 2 && unique <= 30;
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
          .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.abs(value / total) * 100 : 0 }))
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .slice(0, 15);

        if (data.length >= 2) {
          topGroups.push({ col: catCol, valueCol: numCol, data });
        }
      });
    });
  }

  return { name, records, numericCols, categoricalCols, dateCols, allCols, kpis, topGroups, rowCount: records.length, isEmpty: false };
};

// ─── Provider ───────────────────────────────────────────────────────────────

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [sheets, setSheets] = useState<SheetAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [masterFilters, setMasterFilters] = useState<Record<string, string[]>>({});
  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>([]);
  const [kpiConfigs, setKpiConfigs] = useState<KpiConfig[]>([]);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      let analyzed: SheetAnalysis[] = [];

      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Advanced Grid Detection
        const blocks = splitIntoBlocks(rawArray);
        
        blocks.forEach((block, i) => {
          const name = blocks.length > 1 ? `${sheetName} (Table ${i + 1})` : sheetName;
          const analysis = analyzeSheet(name, block);
          if (!analysis.isEmpty) analyzed.push(analysis);
        });
      });

      if (analyzed.length === 0) throw new Error('No readable data found in this file.');

      const autoCharts: ChartConfig[] = [];
      const autoKpis: KpiConfig[] = [];
      analyzed.forEach(sheet => {
        sheet.topGroups.slice(0, 4).forEach((group, i) => {
          autoCharts.push({
            id: `auto-${sheet.name}-${i}`,
            sheetName: sheet.name,
            categoryCol: group.col,
            valueCol: group.valueCol,
            title: `${group.valueCol} by ${group.col}`
          });
        });
        sheet.kpis.forEach((kpi, i) => {
          autoKpis.push({
            id: `auto-kpi-${sheet.name}-${i}`,
            sheetName: sheet.name,
            col: kpi.col
          });
        });
      });

      setSheets(analyzed);
      setChartConfigs(autoCharts);
      setKpiConfigs(autoKpis);
      setFileName(file.name);
      setActiveSheet('Master Summary');
      setMasterFilters({});

    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (col: string, val: string) => {
    setMasterFilters(prev => {
      const colVals = prev[col] || [];
      const newVals = colVals.includes(val) ? colVals.filter(v => v !== val) : [...colVals, val];
      return { ...prev, [col]: newVals };
    });
  };

  const resetFilters = () => {
    setMasterFilters({});
  };

  const resetDashboard = () => {
    setSheets([]);
    setChartConfigs([]);
    setKpiConfigs([]);
    setFileName('');
    setActiveSheet(null);
    setMasterFilters({});
    setError(null);
  };

  const addChart = (sheetName: string, categoryCol: string, valueCol: string) => {
    setChartConfigs(prev => [...prev, {
      id: `user-chart-${Date.now()}`, sheetName, categoryCol, valueCol, title: `${valueCol} by ${categoryCol}`
    }]);
  };

  const removeChart = (id: string) => {
    setChartConfigs(prev => prev.filter(c => c.id !== id));
  };

  const addKpi = (sheetName: string, col: string) => {
    setKpiConfigs(prev => [...prev, {
      id: `user-kpi-${Date.now()}`, sheetName, col
    }]);
  };

  const removeKpi = (id: string) => {
    setKpiConfigs(prev => prev.filter(k => k.id !== id));
  };

  const getFilteredRecords = (sheetName: string): DataRecord[] => {
    const sheet = sheets.find(s => s.name === sheetName);
    if (!sheet) return [];

    return sheet.records.filter(row => {
      return Object.entries(masterFilters).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        // If the table doesn't have this column, don't filter it out, just ignore the filter for this table
        if (!(col in row)) return true; 
        return vals.includes(String(row[col] ?? ''));
      });
    });
  };

  return (
    <DashboardContext.Provider value={{
      sheets, loading, error, fileName, activeSheet, setActiveSheet, masterFilters,
      toggleFilter, resetFilters, handleFileUpload, resetDashboard,
      chartConfigs, addChart, removeChart,
      kpiConfigs, addKpi, removeKpi,
      getFilteredRecords
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
