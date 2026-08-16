"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
// backend parsing used instead of xlsx client side

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
  divideByCol?: string;
  title: string;
  type: 'pie' | 'bar' | 'line';
  categoriesToCompare?: string[];
  x?: number; y?: number; w?: number; h?: number;
}

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
  divideByCol?: string;
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
  
  // Workspace Management
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  handleFileUpload: (file: File, isUpdateForId?: string) => Promise<void>;
  resetDashboard: () => void;
  stagingWorkspace: any | null;
  confirmStaging: (relationships?: any) => void;
  cancelStaging: () => void;

  // Active Workspace Operations
  toggleFilter: (col: string, val: string) => void;
  resetFilters: () => void;
  addCrossFilter: (col: string, val: string) => void;
  removeCrossFilter: (col: string, val: string) => void;
  clearCrossFilters: () => void;
  addChart: (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line', categoriesToCompare?: string[], divideByCol?: string) => void;
  removeChart: (id: string) => void;
  updateChartLayout: (id: string, layout: {x: number, y: number, w: number, h: number}) => void;
  addKpi: (sheetName: string, col: string, divideByCol?: string) => void;
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

  const [stagingWorkspace, setStagingWorkspace] = useState<any | null>(null);
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

  const handleFileUpload = async (file: File, isUpdateForId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
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
        const allCols = s.columns.map((c:any) => c.name);

        return {
          name: s.sheetName,
          records: s.records, // Note: This is now a preview (100 rows) due to the API logic, full fetch happens on demand later
          numericCols, categoricalCols, dateCols, allCols,
          rowCount: s.totalRows,
          isEmpty: s.totalRows === 0
        };
      });

      // Instead of instantly adding it, we stage it for the relationship UI
      setStagingWorkspace({
        file,
        fileName: file.name,
        isUpdateForId,
        datasetId: data.datasetId,
        analyzed
      });

    } catch (err: any) {
      setError(err.message || 'Failed to process file.');
    } finally {
      setLoading(false);
    }
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
      if (stagingWorkspace.isUpdateForId) {
        return prev.map(w => w.id === stagingWorkspace.isUpdateForId ? {
          ...w, fileName: stagingWorkspace.fileName, sheets: analyzed
        } : w);
      } else {
        const newId = `ws-${Date.now()}`;
        const newWs: Workspace = {
          id: newId, fileName: stagingWorkspace.fileName, sheets: analyzed,
          chartConfigs: topCharts, kpiConfigs: topKpis, masterFilters: {}, crossFilters: {}
        };
        setActiveWorkspaceId(newId);
        return [...prev, newWs];
      }
    });

    setStagingWorkspace(null);
  };

  const cancelStaging = () => {
    setStagingWorkspace(null);
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

  const addChart = (sheetName: string, categoryCol: string, valueCol: string, type: 'pie'|'bar'|'line', categoriesToCompare?: string[], divideByCol?: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      chartConfigs: [...ws.chartConfigs, {
        id: `user-chart-${Date.now()}`, sheetName, categoryCol, valueCol, divideByCol, title: divideByCol ? `${valueCol} / ${divideByCol} by ${categoryCol}` : `${valueCol} by ${categoryCol}`, type, categoriesToCompare,
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

  const addKpi = (sheetName: string, col: string, divideByCol?: string) => {
    updateActiveWorkspace(ws => ({
      ...ws,
      kpiConfigs: [...ws.kpiConfigs, { id: `user-kpi-${Date.now()}`, sheetName, col, divideByCol, x: 0, y: 100, w: 3, h: 2 }]
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
      workspaces, activeWorkspaceId, loading, error,
      switchWorkspace, closeWorkspace, handleFileUpload, resetDashboard,
      stagingWorkspace, confirmStaging, cancelStaging,
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
