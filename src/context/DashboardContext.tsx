"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface SheetAnalysis {
  name: string;
  headers: string[];
  records: any[];
  numericCols: string[];
  categoricalCols: string[];
  dateCols: string[];
  totalRows: number;
}

export interface ChartSeries {
  id: string;
  valueCol: string;
  calcOp?: '+'|'-'|'*'|'/';
  calcCol?: string;
  color?: string;
}

export interface ChartConfig {
  id: string;
  sheetName: string;
  categoryCol: string;
  title: string;
  type: 'pie'|'bar'|'line'|'doughnut';
  isPercentage?: boolean;
  series: ChartSeries[];
  x?: number; y?: number; w?: number; h?: number;
}

export interface KpiConfig {
  id: string;
  sheetName: string;
  col: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  isPercentage?: boolean;
  x?: number; y?: number; w?: number; h?: number;
  title?: string;
}

export interface Workspace {
  id: string;
  fileName: string;
  sheets: SheetAnalysis[];
  chartConfigs: ChartConfig[];
  kpiConfigs: KpiConfig[];
}

interface DashboardContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
  
  handleFileUpload: (file: File) => Promise<void>;
  resetDashboard: () => void;
  switchWorkspace: (id: string) => void;
  closeWorkspace: (id: string) => void;
  
  addChart: (chart: Omit<ChartConfig, 'id'>) => void;
  updateChart: (id: string, updates: Partial<ChartConfig>) => void;
  removeChart: (id: string) => void;
  
  addKpi: (kpi: Omit<KpiConfig, 'id'>) => void;
  updateKpi: (id: string, updates: Partial<KpiConfig>) => void;
  removeKpi: (id: string) => void;
  
  updateLayouts: (layouts: any[]) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // We rely entirely on the preview route which perfectly parses sheets
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload');
      
      const newId = `ws-${Date.now()}`;
      const newWs: Workspace = {
        id: newId,
        fileName: file.name,
        sheets: data.sheets,
        chartConfigs: [],
        kpiConfigs: []
      };
      
      setWorkspaces(prev => [...prev, newWs]);
      setActiveWorkspaceId(newId);
    } catch (err: any) {
      setError(err.message || 'Error parsing file.');
    } finally {
      setLoading(false);
    }
  };

  const resetDashboard = () => {
    setError(null);
  };

  const updateActiveWorkspace = (updater: (ws: Workspace) => Workspace) => {
    setWorkspaces(prev => prev.map(w => w.id === activeWorkspaceId ? updater(w) : w));
  };

  const addChart = (c: Omit<ChartConfig, 'id'>) => updateActiveWorkspace(w => ({ ...w, chartConfigs: [...w.chartConfigs, { ...c, id: 'c-'+Date.now() }] }));
  const updateChart = (id: string, updates: Partial<ChartConfig>) => updateActiveWorkspace(w => ({ ...w, chartConfigs: w.chartConfigs.map(c => c.id === id ? { ...c, ...updates } : c) }));
  const removeChart = (id: string) => updateActiveWorkspace(w => ({ ...w, chartConfigs: w.chartConfigs.filter(c => c.id !== id) }));

  const addKpi = (k: Omit<KpiConfig, 'id'>) => updateActiveWorkspace(w => ({ ...w, kpiConfigs: [...w.kpiConfigs, { ...k, id: 'k-'+Date.now() }] }));
  const updateKpi = (id: string, updates: Partial<KpiConfig>) => updateActiveWorkspace(w => ({ ...w, kpiConfigs: w.kpiConfigs.map(c => c.id === id ? { ...c, ...updates } : c) }));
  const removeKpi = (id: string) => updateActiveWorkspace(w => ({ ...w, kpiConfigs: w.kpiConfigs.filter(c => c.id !== id) }));

  const updateLayouts = (layouts: any[]) => {
    updateActiveWorkspace(w => {
      const nc = w.chartConfigs.map(c => { const l = layouts.find(x => x.i === c.id); return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c; });
      const nk = w.kpiConfigs.map(k => { const l = layouts.find(x => x.i === k.id); return l ? { ...k, x: l.x, y: l.y, w: l.w, h: l.h } : k; });
      return { ...w, chartConfigs: nc, kpiConfigs: nk };
    });
  };

  return (
    <DashboardContext.Provider value={{
      workspaces, activeWorkspaceId, loading, error,
      handleFileUpload, resetDashboard, switchWorkspace: setActiveWorkspaceId,
      closeWorkspace: (id) => {
        setWorkspaces(p => p.filter(w => w.id !== id));
        if (activeWorkspaceId === id) setActiveWorkspaceId(null);
      },
      addChart, updateChart, removeChart,
      addKpi, updateKpi, removeKpi, updateLayouts
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
