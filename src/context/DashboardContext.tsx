"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { db, ExtractedTable, TableColumn, TableRecord, PinnedCell, ChartConfigDB, KpiConfigDB } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

export interface StagingSheet {
  name: string;
  data: any[][];
}

interface DashboardContextType {
  stagingFile: File | null;
  stagingSheets: StagingSheet[];
  loading: boolean;
  error: string | null;
  
  // Staging Actions
  handleFileUpload: (file: File) => Promise<void>;
  clearStaging: () => void;

  // DB State (Live from Dexie)
  tables: ExtractedTable[];
  columns: TableColumn[];
  records: TableRecord[];
  pinnedCells: PinnedCell[];
  chartConfigs: ChartConfigDB[];
  kpiConfigs: KpiConfigDB[];

  // DB Actions
  saveExtractedTable: (name: string, sheetName: string, headers: { name: string, isFilter: boolean }[], rows: any[][]) => Promise<void>;
  savePinnedCell: (name: string, sheetName: string, cellRef: string, value: any) => Promise<void>;
  
  addChart: (chart: Omit<ChartConfigDB, 'id'>) => Promise<void>;
  updateChart: (id: string, updates: Partial<ChartConfigDB>) => Promise<void>;
  removeChart: (id: string) => Promise<void>;
  
  addKpi: (kpi: Omit<KpiConfigDB, 'id'>) => Promise<void>;
  updateKpi: (id: string, updates: Partial<KpiConfigDB>) => Promise<void>;
  removeKpi: (id: string) => Promise<void>;
  
  updateLayouts: (layouts: any[]) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [stagingFile, setStagingFile] = useState<File | null>(null);
  const [stagingSheets, setStagingSheets] = useState<StagingSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use Live Query to subscribe to Dexie updates
  const tables = useLiveQuery(() => db.extractedTables.toArray()) || [];
  const columns = useLiveQuery(() => db.columns.toArray()) || [];
  const records = useLiveQuery(() => db.records.toArray()) || [];
  const pinnedCells = useLiveQuery(() => db.pinnedCells.toArray()) || [];
  const chartConfigs = useLiveQuery(() => db.chartConfigs.toArray()) || [];
  const kpiConfigs = useLiveQuery(() => db.kpiConfigs.toArray()) || [];

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload');
      
      setStagingFile(file);
      setStagingSheets(data.sheets);
    } catch (err: any) {
      setError(err.message || 'Error parsing file.');
    } finally {
      setLoading(false);
    }
  };

  const clearStaging = () => {
    setStagingFile(null);
    setStagingSheets([]);
    setError(null);
  };

  const saveExtractedTable = async (name: string, sheetName: string, headers: { name: string, isFilter: boolean }[], rows: any[][]) => {
    try {
      // 1. Record the Upload
      const uploadId = await db.uploads.add({ filename: stagingFile?.name || 'Unknown', uploadedAt: new Date().toISOString() });
      
      // 2. Save Table
      const tableId = `tbl-${Date.now()}`;
      await db.extractedTables.add({ id: tableId, uploadId, name, originalSheet: sheetName });

      // 3. Save Columns
      const colsToInsert = headers.map((h, i) => ({
        id: `col-${Date.now()}-${i}`,
        tableId,
        name: h.name,
        isFilter: h.isFilter
      }));
      await db.columns.bulkAdd(colsToInsert);

      // 4. Save Records (JSON objects)
      const recordsToInsert = rows.map(row => {
        const dataObj: Record<string, any> = {};
        headers.forEach((h, i) => {
          dataObj[h.name] = row[i];
        });
        return { tableId, data: dataObj };
      });
      
      await db.records.bulkAdd(recordsToInsert);
    } catch (err) {
      console.error(err);
      setError("Failed to save table to database.");
    }
  };

  const savePinnedCell = async (name: string, sheetName: string, cellRef: string, value: any) => {
    try {
      const uploadId = await db.uploads.add({ filename: stagingFile?.name || 'Unknown', uploadedAt: new Date().toISOString() });
      const cellId = `cell-${Date.now()}`;
      await db.pinnedCells.add({ id: cellId, uploadId, name, value, sheetName, cellRef });
      
      // Auto-create a KPI config for it
      await addKpi({ pinnedCellId: cellId, title: name, w: 3, h: 2 });
    } catch (err) {
      console.error(err);
    }
  };

  const addChart = async (c: Omit<ChartConfigDB, 'id'>) => { await db.chartConfigs.add({ ...c, id: `c-${Date.now()}` }); };
  const updateChart = async (id: string, updates: Partial<ChartConfigDB>) => { await db.chartConfigs.update(id, updates); };
  const removeChart = async (id: string) => { await db.chartConfigs.delete(id); };

  const addKpi = async (k: Omit<KpiConfigDB, 'id'>) => { await db.kpiConfigs.add({ ...k, id: `k-${Date.now()}` }); };
  const updateKpi = async (id: string, updates: Partial<KpiConfigDB>) => { await db.kpiConfigs.update(id, updates); };
  const removeKpi = async (id: string) => { await db.kpiConfigs.delete(id); };

  const updateLayouts = async (layouts: any[]) => {
    // Update all charts
    const charts = await db.chartConfigs.toArray();
    for (const c of charts) {
      const l = layouts.find(x => x.i === c.id);
      if (l && (c.x !== l.x || c.y !== l.y || c.w !== l.w || c.h !== l.h)) {
        await db.chartConfigs.update(c.id, { x: l.x, y: l.y, w: l.w, h: l.h });
      }
    }
    // Update all KPIs
    const kpis = await db.kpiConfigs.toArray();
    for (const k of kpis) {
      const l = layouts.find(x => x.i === k.id);
      if (l && (k.x !== l.x || k.y !== l.y || k.w !== l.w || k.h !== l.h)) {
        await db.kpiConfigs.update(k.id, { x: l.x, y: l.y, w: l.w, h: l.h });
      }
    }
  };

  const clearAllData = async () => {
    await db.extractedTables.clear();
    await db.columns.clear();
    await db.records.clear();
    await db.pinnedCells.clear();
    await db.chartConfigs.clear();
    await db.kpiConfigs.clear();
    await db.uploads.clear();
    clearStaging();
  };

  return (
    <DashboardContext.Provider value={{
      stagingFile, stagingSheets, loading, error,
      handleFileUpload, clearStaging,
      tables, columns, records, pinnedCells, chartConfigs, kpiConfigs,
      saveExtractedTable, savePinnedCell,
      addChart, updateChart, removeChart,
      addKpi, updateKpi, removeKpi, updateLayouts,
      clearAllData
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
