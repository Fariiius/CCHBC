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

export interface SheetPrepConfig {
  id: string;
  originalSheetName: string;
  tableNameOverride?: string;
  rowOffset: number;
  rowOrder: string[];
  addedRows: Record<string, any[]>;
  cellEdits: Record<string, string>;
  headerRowId?: string;
  dataEndRowId?: string;
  excludedRowIds: string[];
  excludedCols: string[];
  columnTypes: Record<string, 'text'|'numeric'|'date'>;
  columnRenames?: Record<string, string>;
  addedCols?: number;
  rawPreview: any[][];
  selectedCells: string[]; // Set of explicitly selected cells like "rowId_colIdx"
  explicitFilters: string[]; // List of column names to act as dashboard sidebar filters
  explicitKpis: { id: string, label: string, value: string }[];
  initialKpis?: { col: string, title: string }[];
  initialCharts?: { catCol: string, valCol: string, type: 'pie'|'bar'|'line', title?: string }[];
}

export interface ChartSeries {
  id: string;
  sheetName: string;
  valueCol: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  color?: string;
}

export interface ChartConfig {
  id: string;
  sheetName?: string; // Legacy
  categoryCol: string;
  valueCol?: string; // Legacy
  calcCol?: string; // Legacy
  calcOp?: '+'|'-'|'*'|'/'; // Legacy
  
  series?: ChartSeries[]; // New multi-series array
  
  title: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  isPercentage?: boolean;
  x: number; y: number; w: number; h: number;
}

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  isPercentage?: boolean;
  x: number; y: number; w: number; h: number;
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
  stagingWorkspace: { configs: SheetPrepConfig[] } | null;
  
  // Workspace Management
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  handleFileUpload: (file: File) => Promise<void>;
  updatePrepConfig: (sheetId: string, updates: Partial<SheetPrepConfig>) => void;
  duplicatePrepSheet: (sheetId: string, startRowId?: string) => void;
  removePrepSheet: (sheetId: string) => void;
  resetDashboard: () => void;
  confirmStaging: () => void;
  cancelStaging: () => void;

  // Active Workspace Operations
  toggleFilter: (col: string, val: string) => void;
  resetFilters: () => void;
  addCrossFilter: (col: string, val: string) => void;
  removeCrossFilter: (col: string, val: string) => void;
  clearCrossFilters: () => void;
  addChart: (config: Omit<ChartConfig, 'id' | 'x' | 'y' | 'w' | 'h'>) => void;
  removeChart: (id: string) => void;
  addKpi: (config: Omit<KpiConfig, 'id' | 'x' | 'y' | 'w' | 'h'>) => void;
  removeKpi: (id: string) => void;
  updateLayouts: (layouts: {i: string, x: number, y: number, w: number, h: number}[]) => void;
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

  const [stagingWorkspace, setStagingWorkspace] = useState<{configs: SheetPrepConfig[]} | null>(null);
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

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    setStagedFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to generate preview');

      const configs: SheetPrepConfig[] = data.sheets.map((s: any) => ({
         id: s.id,
         originalSheetName: s.originalSheetName,
         tableNameOverride: s.tableNameOverride,
         rowOffset: s.rowOffset,
         rowOrder: (s.rawPreview || []).map((_: any, idx: number) => `orig_${idx}`),
         addedRows: {},
         cellEdits: {},
         headerRowId: `orig_${s.defaultHeaderRowIdx || 0}`,
         dataEndRowId: undefined,
         excludedRowIds: [],
         excludedCols: [],
         columnTypes: {},
         columnRenames: {},
         addedCols: 0,
         rawPreview: s.rawPreview,
         selectedCells: [],
         explicitFilters: []
      }));
      setStagingWorkspace({ configs });
    } catch (err: any) {
      setError(err.message || 'Failed to read file.');
      setStagedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const updatePrepConfig = (sheetId: string, updates: Partial<SheetPrepConfig>) => {
    setStagingWorkspace(prev => {
      if (!prev) return prev;
      return {
        configs: prev.configs.map(c => c.id === sheetId ? { ...c, ...updates } : c)
      };
    });
  };

  const duplicatePrepSheet = (sheetId: string, startRowId?: string) => {
    setStagingWorkspace(prev => {
      if (!prev) return prev;
      const target = prev.configs.find(c => c.id === sheetId);
      if (!target) return prev;
      
      const newSheet: SheetPrepConfig = {
        id: `${target.originalSheetName} (Table ${prev.configs.length + 1})`,
        originalSheetName: target.originalSheetName,
        tableNameOverride: `Table ${prev.configs.length + 1}`,
        rawPreview: target.rawPreview,
        rowOffset: target.rowOffset,
        rowOrder: target.rowOrder,
        headerRowId: startRowId !== undefined ? startRowId : (target.dataEndRowId ? target.dataEndRowId : target.headerRowId),
        excludedRowIds: [],
        excludedCols: [],
        columnTypes: {},
        initialCharts: [],
        initialKpis: [],
        cellEdits: {},
        addedCols: 0,
        addedRows: {},
        selectedCells: [],
        explicitFilters: [],
        explicitKpis: []
      };
      
      const targetIdx = prev.configs.findIndex(c => c.id === sheetId);
      const newConfigs = [...prev.configs];
      newConfigs.splice(targetIdx + 1, 0, newSheet);
      
      return { configs: newConfigs };
    });
  };

  const removePrepSheet = (sheetId: string) => {
    setStagingWorkspace(prev => {
      if (!prev) return prev;
      return { configs: prev.configs.filter(c => c.id !== sheetId) };
    });
  };

  const confirmStaging = async () => {
    if (!stagingWorkspace || !stagedFile) return;
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', stagedFile);
      formData.append('prepConfig', JSON.stringify(stagingWorkspace.configs));
      
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

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
          isEmpty: s.totalRows === 0
        };
      });

      // The dashboard starts completely empty, waiting for the user to explicitly build it.
      const topCharts: ChartConfig[] = [];
      const topKpis: KpiConfig[] = [];
      const masterFilters: Record<string, string[]> = {};
      const colors = ['#F40009', '#111111', '#555555', '#999999', '#D90008'];

      stagingWorkspace.configs.forEach(config => {
        // Explicit Charts
        if (config.initialCharts) {
           config.initialCharts.forEach((ic, idx) => {
             topCharts.push({
               id: `manual-chart-${Date.now()}-${idx}`,
               categoryCol: ic.catCol,
               title: ic.title || `${ic.valCol} by ${ic.catCol}`, 
               type: ic.type,
               series: [{ id: `s-${Date.now()}`, sheetName: config.tableNameOverride || config.id, valueCol: ic.valCol, color: colors[idx % colors.length] }],
               x: (topCharts.length % 2) * 6, y: 2 + Math.floor(topCharts.length / 2) * 6, w: 6, h: 6
             });
           });
        }
        
        // Explicit KPIs
        if (config.explicitKpis) {
           config.explicitKpis.forEach((ek, idx) => {
             // Since this is a Raw KPI (literal text/number), we pass it as a special config.
             // We can use a special sheetName or flag to tell KPICard to render raw value.
             topKpis.push({
               id: ek.id,
               sheetName: 'RAW_MANUAL_KPI',
               col: ek.label,
               calcCol: ek.value, // We hijack calcCol to pass the raw value string
               x: topKpis.length * 3, y: 0, w: 3, h: 2
             });
           });
        }
        
        // Explicit Filters
        if (config.explicitFilters) {
           config.explicitFilters.forEach(f => {
              masterFilters[f] = [];
           });
        }
      });

      setWorkspaces(prev => {
          const newId = `ws-${Date.now()}`;
          const newWs: Workspace = {
            id: newId, fileName: stagedFile.name, sheets: analyzed,
            chartConfigs: topCharts, kpiConfigs: topKpis, masterFilters: masterFilters, crossFilters: {}
          };
          setActiveWorkspaceId(newId);
          return [...prev, newWs];
      });

      setStagingWorkspace(null);
      setStagedFile(null);
      
    } catch (err: any) {
      setError(err.message || 'Failed to process file.');
    } finally {
      setLoading(false);
    }
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

  const addChart = (config: Omit<ChartConfig, 'id' | 'x' | 'y' | 'w' | 'h'>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: [...ws.chartConfigs, {
        ...config,
        id: `user-chart-${Date.now()}`, 
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

  const addKpi = (config: Omit<KpiConfig, 'id' | 'x' | 'y' | 'w' | 'h'>) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: [...ws.kpiConfigs, { ...config, id: `user-kpi-${Date.now()}`, x: 0, y: 100, w: 3, h: 2 }]
    }));
  };

  const removeKpi = (id: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.filter(k => k.id !== id)
    }));
  };

  const updateLayouts = (layouts: {i: string, x: number, y: number, w: number, h: number}[]) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: ws.kpiConfigs.map(c => {
        const l = layouts.find(x => x.i === c.id);
        return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c;
      }),
      chartConfigs: ws.chartConfigs.map(c => {
        const l = layouts.find(x => x.i === c.id);
        return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c;
      })
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
      switchWorkspace, closeWorkspace, handleFileUpload, resetDashboard,
      updatePrepConfig, duplicatePrepSheet, removePrepSheet,
      confirmStaging, cancelStaging,
      toggleFilter, resetFilters, 
      addCrossFilter,
      removeCrossFilter,
      clearCrossFilters,
      addChart,
      removeChart,
      addKpi,
      removeKpi,
      updateLayouts,
      getFilteredRecords,
      drillDownData,
      openDrillDown,
      closeDrillDown,
      updateChart,
      updateKpi
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
