import Dexie, { Table } from 'dexie';

export interface UploadRecord {
  id?: number;
  filename: string;
  uploadedAt: string;
}

export interface ExtractedTable {
  id: string; // e.g. "table-1234"
  uploadId: number;
  name: string;
  originalSheet: string;
}

export interface TableColumn {
  id: string; // e.g. "col-1234"
  tableId: string;
  name: string;
  isFilter: boolean;
}

export interface TableRecord {
  id?: number;
  tableId: string;
  data: Record<string, any>;
}

export interface PinnedCell {
  id: string;
  uploadId: number;
  name: string;
  value: any;
  sheetName: string;
  cellRef: string; // e.g. "C4"
}

// Chart configs for the dashboard layout
export interface ChartSeriesDB {
  id: string;
  tableId: string;
  valueCol: string;
  calcOp?: '+'|'-'|'*'|'/';
  calcCol?: string;
  color?: string;
}

export interface ChartConfigDB {
  id: string;
  categoryCol: string;
  title: string;
  type: 'pie'|'bar'|'line'|'doughnut';
  isPercentage?: boolean;
  series: ChartSeriesDB[];
  x?: number; y?: number; w?: number; h?: number;
}

export interface KpiConfigDB {
  id: string;
  pinnedCellId?: string; // If it's a pinned cell
  tableId?: string; // If it's an aggregation
  col?: string;
  calcCol?: string;
  calcOp?: '+'|'-'|'*'|'/';
  isPercentage?: boolean;
  x?: number; y?: number; w?: number; h?: number;
  title?: string;
}

export class DashboardDB extends Dexie {
  uploads!: Table<UploadRecord, number>;
  extractedTables!: Table<ExtractedTable, string>;
  columns!: Table<TableColumn, string>;
  records!: Table<TableRecord, number>;
  pinnedCells!: Table<PinnedCell, string>;
  chartConfigs!: Table<ChartConfigDB, string>;
  kpiConfigs!: Table<KpiConfigDB, string>;

  constructor() {
    super('DashboardDB');
    this.version(2).stores({
      uploads: '++id, filename, uploadedAt',
      extractedTables: 'id, uploadId, name, originalSheet',
      columns: 'id, tableId, name, isFilter',
      records: '++id, tableId',
      pinnedCells: 'id, uploadId, name, sheetName, cellRef',
      chartConfigs: 'id',
      kpiConfigs: 'id'
    });
  }
}

export const db = new DashboardDB();
