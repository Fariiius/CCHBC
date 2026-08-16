"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
// backend parsing used instead of xlsx client side

export type DataRecord = Record<string, any>;

export interface SheetAnalysis {
  id: string;
  name: string;
  tableName: string;
  categoricalCols: string[];
  numericCols: string[];
  dateCols: string[];
  records: any[];
  totalRows: number;
  headerRowIdx?: number;
  rawPreview?: any[][];
  columns?: { name: string, type: string }[];
  isEmpty: boolean;
}

export interface ChartConfig {
  id: string;
  sheetName: string;
  categoryCol: string;
  valueCol: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  title: string;
  type: 'pie' | 'bar' | 'line';
  categoriesToCompare?: string[];
  x?: number; y?: number; w?: number; h?: number;
}

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  x?: number; y?: number; w?: number; h?: number;
}

export interface Workspace {
  id: string;
  fileName: string;
  sheets: SheetAnalysis[];
  chartConfigs: ChartConfig[];
  kpiConfigs: KpiConfig[];
  masterFilters: Record<string, string[]>;
  crossFilters: Record<string, string[]>;
}

interface DashboardContextProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
  stagedFile: File | null;
  stagingWorkspace: {
    datasetId?: string;
    analyzed: SheetAnalysis[];
  } | null;
  
  // Workspace Management
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  handleFileUpload: (file: File, headerMapping?: Record<string, number>) => Promise<void>;
  updateStagedColumnType: (sheetName: string, colName: string, newType: string) => void;
  resetDashboard: () => void;
  confirmStaging: (relationships?: any) => void;
  cancelStaging: () => void;

  // Active Workspace Operations
  toggleFilter: (col: string, val: string) => void;
  resetFilters: () => void;
  addCrossFilter: (col: string, val: string) => void;
  removeCrossFilter: (col: string, val: string) => void;
  clearCrossFilters: () => void;
  addChart: (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line', categoriesToCompare?: string[], calcCol?: string, calcOp?: '+'|'-'|'*'|'/') => void;
  removeChart: (id: string) => void;
  updateChartLayout: (id: string, layout: {x: number, y: number, w: number, h: number}) => void;
  addKpi: (sheetName: string, col: string, calcCol?: string, calcOp?: '+'|'-'|'*'|'/') => void;
  removeKpi: (id: string) => void;
  updateKpiLayout: (id: string, layout: {x: number, y: number, w: number, h: number}) => void;
  getFilteredRecords: (sheetName: string) => DataRecord[];
  
  // Phase 3
  drillDownData: DataRecord[] | null;
  openDrillDown: (data: DataRecord[]) => void;
  closeDrillDown: () => void;
  updateChart: (id: string, config: Partial<ChartConfig>) => void;
  updateKpi: (id: string, config: Partial<KpiConfig>) => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

// ─── Intelligence Engine moved to backend API ─────────────────────────────────

// ─── Provider ───────────────────────────────────────────────────────────────

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const [stagingWorkspace, setStagingWorkspace] = useState<{datasetId?: string; analyzed: SheetAnalysis[]} | null>(null);
  const [drillDownData, setDrillDownData] = useState<DataRecord[] | null>(null);

  // Load from LocalStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('cchbc_workspaces');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWorkspaces(parsed);
          setActiveWorkspaceId(parsed[parsed.length - 1].id);
        }
      }
    } catch (e) { console.error('Failed to load workspaces from local storage', e); }
  }, []);

  // Save to LocalStorage whenever workspaces change
  React.useEffect(() => {
    if (workspaces.length > 0) {
      localStorage.setItem('cchbc_workspaces', JSON.stringify(workspaces));
    } else {
      localStorage.removeItem('cchbc_workspaces');
    }
  }, [workspaces]);

  const handleFileUpload = async (file: File, headerMapping?: Record<string, number>) => {
    setLoading(true);
    setError(null);
    if (!headerMapping) setStagedFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (headerMapping) {
        formData.append('headerMapping', JSON.stringify(headerMapping));
      }
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Transform backend response into our client format for staging
      const analyzed: SheetAnalysis[] = data.sheets.map((s: any) => {
        const numericCols = s.columns.filter((c:any) => c.type === 'numeric').map((c:any) => c.name);
        const dateCols = s.columns.filter((c:any) => c.type === 'date').map((c:any) => c.name);
        const categoricalCols = s.columns.filter((c:any) => c.type === 'text').map((c:any) => c.name);

        return {
          id: s.id,
          name: s.sheetName,
          tableName: s.tableName,
          categoricalCols,
          numericCols,
          dateCols,
          records: s.records,
          totalRows: s.totalRows,
          headerRowIdx: s.headerRowIdx,
          rawPreview: s.rawPreview,
          columns: s.columns,
          isEmpty: s.totalRows === 0
        };
      });

      setStagingWorkspace({ datasetId: data.datasetId, analyzed });

    } catch (err: any) {
      setError(err.message || 'Failed to process file.');
    } finally {
      setLoading(false);
    }
  };

  const updateStagedColumnType = (sheetName: string, colName: string, newType: string) => {
    if (!stagingWorkspace) return;
    setStagingWorkspace(prev => {
      if (!prev) return prev;
      const analyzed = prev.analyzed.map(s => {
        if (s.name !== sheetName || !s.columns) return s;
        const columns = s.columns.map(c => c.name === colName ? { ...c, type: newType } : c);
        const categoricalCols = columns.filter(c => c.type === 'text').map(c => c.name);
        const numericCols = columns.filter(c => c.type === 'numeric').map(c => c.name);
        const dateCols = columns.filter(c => c.type === 'date').map(c => c.name);
        return { ...s, columns, categoricalCols, numericCols, dateCols };
      });
      return { ...prev, analyzed };
    });
  };

  const confirmStaging = (relationships?: any) => {
    if (!stagingWorkspace) return;
    
    // Process top KPIs and Charts based on staging data
    const analyzed = stagingWorkspace.analyzed;
    
    // Smart Ranking for KPIs
    let allKpiCands: { sheet: string, col: string, score: number, val: number }[] = [];
    analyzed.forEach((sheet: SheetAnalysis) => {
      sheet.numericCols.forEach(col => {
        const total = sheet.records.reduce((s, r) => s + (Number(r[col]) || 0), 0);
        let score = Math.abs(total);
        const lcol = col.toLowerCase();
        if (lcol.includes('spend')) score *= 1e6;
        if (lcol.includes('saving')) score *= 1e6;
        if (lcol.includes('total')) score *= 1e5;
        if (lcol.includes('net')) score *= 1e4;
        allKpiCands.push({ sheet: sheet.name, col, score, val: total });
      });
    });
    allKpiCands.sort((a, b) => b.score - a.score);
    
    const seenKpiCols = new Set<string>();
    const topKpis: KpiConfig[] = [];
    for (const k of allKpiCands) {
      if (!seenKpiCols.has(k.col) && topKpis.length < 4) {
        seenKpiCols.add(k.col);
        topKpis.push({ 
          id: `auto-kpi-${Date.now()}-${topKpis.length}`, 
          sheetName: k.sheet, 
          col: k.col,
          x: topKpis.length * 3, y: 0, w: 3, h: 2
        });
      }
    }

    // Smart Ranking for Charts
    let allChartCands: { sheet: string, cat: string, val: string, score: number, isDate: boolean }[] = [];
    analyzed.forEach((sheet: SheetAnalysis) => {
      const topNumCols = [...sheet.numericCols].slice(0, 3);
      const usefulCatCols = [...sheet.categoricalCols, ...sheet.dateCols];

      topNumCols.forEach(val => {
        usefulCatCols.forEach(cat => {
          let score = 0;
          if (val.toLowerCase().includes('spend')) score += 1000;
          if (cat.toLowerCase().includes('month')) score += 500;
          const isDate = sheet.dateCols.includes(cat) || cat.toLowerCase().includes('month') || cat.toLowerCase().includes('date');
          allChartCands.push({ sheet: sheet.name, cat, val, score, isDate });
        });
      });
    });
    allChartCands.sort((a, b) => b.score - a.score);

    const topCharts: ChartConfig[] = [];
    const seenCombos = new Set<string>();
    for (const c of allChartCands) {
      if (!seenCombos.has(`${c.cat}-${c.val}`) && topCharts.length < 5) {
        seenCombos.add(`${c.cat}-${c.val}`);
        topCharts.push({
          id: `auto-chart-${Date.now()}-${topCharts.length}`,
          sheetName: c.sheet, categoryCol: c.cat, valueCol: c.val,
          title: `${c.val} by ${c.cat}`, type: c.isDate ? 'line' : 'pie',
          x: (topCharts.length % 2) * 6, y: 2 + Math.floor(topCharts.length / 2) * 6, w: 6, h: 6
        });
      }
    }

    setWorkspaces(prev => {
        const newId = `ws-${Date.now()}`;
        const newWs: Workspace = {
          id: newId, fileName: stagedFile?.name || 'Uploaded File', sheets: analyzed,
          chartConfigs: topCharts, kpiConfigs: topKpis, masterFilters: {}, crossFilters: {}
        };
        setActiveWorkspaceId(newId);
        return [...prev, newWs];
    });

    setStagingWorkspace(null);
    setStagedFile(null);
  };

  const cancelStaging = () => {
    setStagingWorkspace(null);
    setStagedFile(null);
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
    updateActiveWorkspace(ws => ({ ...ws, masterFilters: {}, crossFilters: {} }));
  };

  const addCrossFilter = (col: string, val: string) => {
    updateActiveWorkspace(ws => {
      const colVals = ws.crossFilters[col] || [];
      if (!colVals.includes(val)) {
        return { ...ws, crossFilters: { ...ws.crossFilters, [col]: [...colVals, val] } };
      }
      return ws;
    });
  };

  const removeCrossFilter = (col: string, val: string) => {
    updateActiveWorkspace(ws => {
      const colVals = ws.crossFilters[col] || [];
      const newVals = colVals.filter(v => v !== val);
      const newCrossFilters = { ...ws.crossFilters, [col]: newVals };
      if (newVals.length === 0) delete newCrossFilters[col];
      return { ...ws, crossFilters: newCrossFilters };
    });
  };

  const clearCrossFilters = () => {
    updateActiveWorkspace(ws => ({ ...ws, crossFilters: {} }));
  };

  const resetDashboard = () => {
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setError(null);
  };

  const addChart = (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line', categoriesToCompare?: string[], calcCol?: string, calcOp?: '+'|'-'|'*'|'/') => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: [...ws.chartConfigs, {
        id: `user-chart-${Date.now()}`, sheetName, categoryCol, valueCol, calcCol, calcOp, title: calcCol ? `${valueCol} ${calcOp} ${calcCol} by ${categoryCol}` : `${valueCol} by ${categoryCol}`, type, categoriesToCompare,
        x: 0, y: 100, w: 6, h: 6
      }]
    }));
  };

  const removeChart = (id: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: ws.chartConfigs.filter(c => c.id !== id)
    }));
  };

  const updateChartLayout = (id: string, layout: {x: number, y: number, w: number, h: number}) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: ws.chartConfigs.map(c => c.id === id ? { ...c, ...layout } : c)
    }));
  };

  const addKpi = (sheetName: string, col: string, calcCol?: string, calcOp?: '+'|'-'|'*'|'/') => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: [...ws.kpiConfigs, { id: `user-kpi-${Date.now()}`, sheetName, col, calcCol, calcOp, x: 0, y: 100, w: 3, h: 2 }]
    }));
  };

  const removeKpi = (id: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.filter(k => k.id !== id)
    }));
  };

  const updateKpiLayout = (id: string, layout: {x: number, y: number, w: number, h: number}) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.map(k => k.id === id ? { ...k, ...layout } : k)
    }));
  };

  const updateChart = (id: string, config: Partial<ChartConfig>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: ws.chartConfigs.map(c => c.id === id ? { ...c, ...config } : c)
    }));
  };

  const updateKpi = (id: string, config: Partial<KpiConfig>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.map(k => k.id === id ? { ...k, ...config } : k)
    }));
  };

  const openDrillDown = (data: DataRecord[]) => setDrillDownData(data);
  const closeDrillDown = () => setDrillDownData(null);

  const getFilteredRecords = (sheetName: string): DataRecord[] => {
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws) return [];
    const sheet = ws.sheets.find(s => s.name === sheetName);
    if (!sheet) return [];
    return sheet.records.filter(row => {
      // Apply master filters
      const passMaster = Object.entries(ws.masterFilters).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        if (!(col in row)) return true; 
        return vals.includes(String(row[col] ?? ''));
      });
      if (!passMaster) return false;

      // Apply cross filters
      return Object.entries(ws.crossFilters).every(([col, vals]) => {
        if (!vals || vals.length === 0) return true;
        if (!(col in row)) return true;
        return vals.includes(String(row[col] ?? ''));
      });
    });
  };

  return (
    <DashboardContext.Provider value={{
      workspaces, activeWorkspaceId, loading, error, stagedFile, stagingWorkspace,
      switchWorkspace, closeWorkspace, handleFileUpload, updateStagedColumnType, resetDashboard,
      confirmStaging, cancelStaging,
      toggleFilter, resetFilters, 
      addCrossFilter, removeCrossFilter, clearCrossFilters,
      addChart, removeChart, updateChartLayout, updateChart,
      addKpi, removeKpi, updateKpiLayout, updateKpi,
      getFilteredRecords,
      drillDownData, openDrillDown, closeDrillDown
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
