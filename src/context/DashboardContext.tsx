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
  headerRowIdx: number;
  dataEndRow?: number;
  excludedRows: number[];
  excludedCols: string[];
  columnTypes: Record<string, 'text'|'numeric'|'date'>;
  columnRenames?: Record<string, string>;
  rawPreview: any[][];
  initialCharts?: { title: string, catCol: string, valCol: string, type: 'pie'|'bar'|'line' }[];
  initialKpis?: { col: string, title: string }[];
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
  duplicatePrepSheet: (sheetId: string) => void;
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
  updateChartLayout: (id: string, layout: {x: number, y: number, w: number, h: number}) => void;
  addKpi: (config: Omit<KpiConfig, 'id' | 'x' | 'y' | 'w' | 'h'>) => void;
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
         headerRowIdx: s.defaultHeaderRowIdx,
         excludedRows: [],
         excludedCols: [],
         columnTypes: {},
         columnRenames: {},
         rawPreview: s.rawPreview,
         initialCharts: [],
         initialKpis: []
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

  const duplicatePrepSheet = (sheetId: string) => {
    setStagingWorkspace(prev => {
      if (!prev) return prev;
      const target = prev.configs.find(c => c.id === sheetId);
      if (!target) return prev;
      
      const newSheet = { ...target, id: `${target.originalSheetName} (Copy ${Date.now().toString().slice(-4)})` };
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

      // 0. User Pre-Configured KPIs
      const topKpis: KpiConfig[] = [];
      const seenKpiCols = new Set<string>();
      
      stagingWorkspace.configs.forEach(config => {
        if (config.initialKpis) {
           config.initialKpis.forEach(ik => {
             topKpis.push({
               id: `auto-kpi-${Date.now()}-${topKpis.length}`,
               sheetName: config.tableNameOverride || config.id, // match the renamed table
               col: ik.col,
               x: topKpis.length * 3, y: 0, w: 3, h: 2
             });
             seenKpiCols.add(ik.col);
           });
        }
      });

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
      const colors = ['#F40009', '#111111', '#555555', '#999999', '#D90008'];
      
      // 1. Add user pre-configured charts from Data Prep phase
      stagingWorkspace.configs.forEach(config => {
        if (config.initialCharts) {
           config.initialCharts.forEach(ic => {
             topCharts.push({
               id: `auto-chart-${Date.now()}-${topCharts.length}`,
               categoryCol: ic.catCol,
               title: ic.title || `${ic.valCol} by ${ic.catCol}`, 
               type: ic.type,
               series: [{ id: `series-${Date.now()}`, sheetName: config.tableNameOverride || config.id, valueCol: ic.valCol, color: colors[0] }],
               x: (topCharts.length % 2) * 6, y: 2 + Math.floor(topCharts.length / 2) * 6, w: 6, h: 6
             });
             seenCombos.add(`${ic.catCol}-${ic.valCol}`);
           });
        }
      });
      
      for (const c of allChartCands) {
        if (!seenCombos.has(`${c.cat}-${c.val}`) && topCharts.length < 5) {
          seenCombos.add(`${c.cat}-${c.val}`);
          
          topCharts.push({
            id: `auto-chart-${Date.now()}-${topCharts.length}`,
            categoryCol: c.cat,
            title: `${c.val} by ${c.cat}`, 
            type: c.isDate ? 'line' : 'pie',
            series: [{
              id: `series-${Date.now()}`,
              sheetName: c.sheet,
              valueCol: c.val,
              color: colors[0]
            }],
            x: (topCharts.length % 2) * 6, y: 2 + Math.floor(topCharts.length / 2) * 6, w: 6, h: 6
          });
        }
      }

      setWorkspaces(prev => {
          const newId = `ws-${Date.now()}`;
          const newWs: Workspace = {
            id: newId, fileName: stagedFile.name, sheets: analyzed,
            chartConfigs: topCharts, kpiConfigs: topKpis, masterFilters: {}, crossFilters: {}
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
      switchWorkspace, closeWorkspace, handleFileUpload, resetDashboard,
      updatePrepConfig, duplicatePrepSheet, removePrepSheet,
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
