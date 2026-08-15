"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as xlsx from 'xlsx';

export type DataRecord = Record<string, any>;

export interface SheetAnalysis {
  name: string;
  records: DataRecord[];
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];
  allCols: string[];
  rowCount: number;
  isEmpty: boolean;
}

export interface ChartConfig {
  id: string;
  sheetName: string;
  categoryCol: string;
  valueCol: string;
  title: string;
  type: 'pie' | 'bar' | 'line';
}

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
}

export interface Workspace {
  id: string;
  fileName: string;
  sheets: SheetAnalysis[];
  chartConfigs: ChartConfig[];
  kpiConfigs: KpiConfig[];
  masterFilters: Record<string, string[]>;
}

interface DashboardContextProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
  
  // Workspace Management
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  handleFileUpload: (file: File, isUpdateForId?: string) => Promise<void>;
  resetDashboard: () => void;
  
  // Active Workspace Operations
  toggleFilter: (col: string, val: string) => void;
  resetFilters: () => void;
  addChart: (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line') => void;
  removeChart: (id: string) => void;
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
  if (lower.includes('id') || lower.includes('code') || lower.includes('index') || lower.includes('#')) return true;
  if (lower.includes('year')) return true;
  if (values.every(v => Number.isInteger(v) && v >= 1900 && v <= 2100)) return true;
  return false;
};

const splitIntoBlocks = (rawArray: any[][]): any[][][] => {
  if (!rawArray || rawArray.length === 0) return [];
  interface Cell { r: number; c: number; }
  const cells: Cell[] = [];
  for (let r = 0; r < rawArray.length; r++) {
    if (!rawArray[r]) continue;
    for (let c = 0; c < rawArray[r].length; c++) {
      const v = rawArray[r][c];
      if (v !== undefined && v !== null && String(v).trim() !== '') cells.push({ r, c });
    }
  }
  if (cells.length === 0) return [];

  const parent = new Map<string, string>();
  const makeId = (c: Cell) => `${c.r},${c.c}`;
  const find = (id: string): string => {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  };
  const union = (id1: string, id2: string) => parent.set(find(id1), find(id2));

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
    return { name, records: [], numericCols: [], categoricalCols: [], dateCols: [], allCols: [], rowCount: 0, isEmpty: true };
  }

  const headers = rawArray[headerRowIdx].map((h, i) => h ? String(h).trim() : `Column_${i}`);
  const records: DataRecord[] = [];
  for (let i = headerRowIdx + 1; i < rawArray.length; i++) {
    const row = rawArray[i];
    if (!row || row.length === 0) continue;
    const nonEmptyCount = row.filter(val => val !== null && val !== undefined && val !== '').length;
    if (nonEmptyCount < Math.max(2, headers.length * 0.3)) continue;
    const record: DataRecord = {};
    headers.forEach((h, colIdx) => record[h] = row[colIdx]);
    records.push(record);
  }

  if (records.length === 0) {
    return { name, records: [], numericCols: [], categoricalCols: [], dateCols: [], allCols: [], rowCount: 0, isEmpty: true };
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

  return { name, records, numericCols, categoricalCols, dateCols, allCols, rowCount: records.length, isEmpty: false };
};

// ─── Provider ───────────────────────────────────────────────────────────────

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File, isUpdateForId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      let analyzed: SheetAnalysis[] = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const blocks = splitIntoBlocks(rawArray);
        blocks.forEach((block, i) => {
          const name = blocks.length > 1 ? `${sheetName} (T${i + 1})` : sheetName;
          const analysis = analyzeSheet(name, block);
          if (!analysis.isEmpty) analyzed.push(analysis);
        });
      });

      if (analyzed.length === 0) throw new Error('No readable data found in this file.');

      // Smart Ranking for KPIs
      let allKpiCands: { sheet: string, col: string, score: number, val: number }[] = [];
      analyzed.forEach(sheet => {
        sheet.numericCols.forEach(col => {
          const total = sheet.records.reduce((s, r) => s + (parseNumber(r[col]) ?? 0), 0);
          let score = Math.abs(total);
          const lcol = col.toLowerCase();
          if (lcol.includes('spend')) score *= 1e6;
          if (lcol.includes('saving')) score *= 1e6;
          if (lcol.includes('total')) score *= 1e5;
          if (lcol.includes('net')) score *= 1e4;
          if (lcol.includes('%') || lcol.includes('pct') || lcol.includes('percent')) score *= 1e4;
          allKpiCands.push({ sheet: sheet.name, col, score, val: total });
        });
      });
      allKpiCands.sort((a, b) => b.score - a.score);
      
      const seenKpiCols = new Set<string>();
      const topKpis: KpiConfig[] = [];
      for (const k of allKpiCands) {
        if (!seenKpiCols.has(k.col) && topKpis.length < 4) {
          seenKpiCols.add(k.col);
          topKpis.push({ id: `auto-kpi-${Date.now()}-${topKpis.length}`, sheetName: k.sheet, col: k.col });
        }
      }

      // Smart Ranking for Charts
      let allChartCands: { sheet: string, cat: string, val: string, score: number, isDate: boolean }[] = [];
      analyzed.forEach(sheet => {
        const topNumCols = [...sheet.numericCols].sort((a, b) => {
          const sA = (a.toLowerCase().includes('spend') || a.toLowerCase().includes('saving')) ? 1 : 0;
          const sB = (b.toLowerCase().includes('spend') || b.toLowerCase().includes('saving')) ? 1 : 0;
          return sB - sA;
        }).slice(0, 3);

        const usefulCatCols = [...sheet.categoricalCols, ...sheet.dateCols].filter(col => {
          const unique = new Set(sheet.records.map(r => String(r[col] ?? ''))).size;
          return unique >= 2 && unique <= 30;
        });

        topNumCols.forEach(val => {
          usefulCatCols.forEach(cat => {
            let score = 0;
            const lval = val.toLowerCase();
            const lcat = cat.toLowerCase();
            if (lval.includes('spend') || lval.includes('saving')) score += 1000;
            if (lcat.includes('month') || lcat.includes('category') || lcat.includes('commodity')) score += 500;
            const isDate = sheet.dateCols.includes(cat) || lcat.includes('month') || lcat.includes('date');
            allChartCands.push({ sheet: sheet.name, cat, val, score, isDate });
          });
        });
      });
      allChartCands.sort((a, b) => b.score - a.score);

      const seenChartCombos = new Set<string>();
      const topCharts: ChartConfig[] = [];
      for (const c of allChartCands) {
        const combo = `${c.cat}-${c.val}`;
        if (!seenChartCombos.has(combo) && topCharts.length < 5) {
          seenChartCombos.add(combo);
          let type: 'pie' | 'bar' | 'line' = 'pie';
          if (c.isDate) type = 'line';
          else if (topCharts.length >= 2 && topCharts.length <= 3) type = 'bar';
          topCharts.push({
            id: `auto-chart-${Date.now()}-${topCharts.length}`,
            sheetName: c.sheet,
            categoryCol: c.cat,
            valueCol: c.val,
            title: `${c.val} by ${c.cat}`,
            type
          });
        }
      }

      setWorkspaces(prev => {
        if (isUpdateForId) {
          // Update existing workspace but keep layout if possible
          return prev.map(w => {
            if (w.id === isUpdateForId) {
              return {
                ...w,
                fileName: file.name,
                sheets: analyzed,
                // Keep existing configs so user doesn't lose their custom charts on update
                // (Assuming columns haven't drastically changed)
              };
            }
            return w;
          });
        } else {
          // Create new workspace
          const newId = `ws-${Date.now()}`;
          const newWs: Workspace = {
            id: newId,
            fileName: file.name,
            sheets: analyzed,
            chartConfigs: topCharts,
            kpiConfigs: topKpis,
            masterFilters: {}
          };
          setActiveWorkspaceId(newId);
          return [...prev, newWs];
        }
      });

    } catch (err: any) {
      setError(err.message || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const switchWorkspace = (id: string) => setActiveWorkspaceId(id);
  
  const closeWorkspace = (id: string) => {
    setWorkspaces(prev => {
      const next = prev.filter(w => w.id !== id);
      if (activeWorkspaceId === id) {
        setActiveWorkspaceId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const updateActiveWorkspace = (updater: (ws: Workspace) => Workspace) => {
    setWorkspaces(prev => prev.map(w => w.id === activeWorkspaceId ? updater(w) : w));
  };

  const toggleFilter = (col: string, val: string) => {
    updateActiveWorkspace(ws => {
      const colVals = ws.masterFilters[col] || [];
      const newVals = colVals.includes(val) ? colVals.filter(v => v !== val) : [...colVals, val];
      return { ...ws, masterFilters: { ...ws.masterFilters, [col]: newVals } };
    });
  };

  const resetFilters = () => {
    updateActiveWorkspace(ws => ({ ...ws, masterFilters: {} }));
  };

  const resetDashboard = () => {
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setError(null);
  };

  const addChart = (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line') => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: [...ws.chartConfigs, {
        id: `user-chart-${Date.now()}`, sheetName, categoryCol, valueCol, title: `${valueCol} by ${categoryCol}`, type
      }]
    }));
  };

  const removeChart = (id: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: ws.chartConfigs.filter(c => c.id !== id)
    }));
  };

  const addKpi = (sheetName: string, col: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: [...ws.kpiConfigs, { id: `user-kpi-${Date.now()}`, sheetName, col }]
    }));
  };

  const removeKpi = (id: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.filter(k => k.id !== id)
    }));
  };

  const getFilteredRecords = (sheetName: string): DataRecord[] => {
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws) return [];
    const sheet = ws.sheets.find(s => s.name === sheetName);
    if (!sheet) return [];
    return sheet.records.filter(row => {
      return Object.entries(ws.masterFilters).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        if (!(col in row)) return true; 
        return vals.includes(String(row[col] ?? ''));
      });
    });
  };

  return (
    <DashboardContext.Provider value={{
      workspaces, activeWorkspaceId, loading, error,
      switchWorkspace, closeWorkspace, handleFileUpload, resetDashboard,
      toggleFilter, resetFilters, addChart, removeChart, addKpi, removeKpi, getFilteredRecords
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
