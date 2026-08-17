import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';
import { pool } from '@/lib/db';

const isDateLike = (v: any): boolean => {
  if (v instanceof Date) return true;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true;
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true;
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const prepConfigStr = formData.get('prepConfig') as string;
    let prepConfig: any[] | null = null;
    if (prepConfigStr) {
      try { prepConfig = JSON.parse(prepConfigStr); } catch(e) {}
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });

    // 1. Create dataset record
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from('datasets')
      .insert({ file_name: file.name })
      .select('id')
      .single();

    if (datasetError) {
        console.error("Supabase Error:", datasetError);
    }

    const datasetId = dataset?.id || `mock-dataset-${Date.now()}`;
    const parsedSheets = [];
    
    // Determine which sheets to process based on PrepConfig or fallback to all sheets
    const sheetsToProcess = prepConfig || wb.SheetNames.map(name => ({
      id: name,
      originalSheetName: name,
      tableNameOverride: undefined,
      rowOffset: 0,
      headerRow: undefined,
      dataEndRow: undefined,
      excludedRows: [],
      excludedCols: [],
      columnTypes: {},
      columnRenames: {}
    }));

    for (const config of sheetsToProcess) {
      const sheetName = config.originalSheetName;
      if (!wb.Sheets[sheetName]) continue;
      const ws = wb.Sheets[sheetName];
      const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const offset = config.rowOffset || 0;
      
      let finalRows: any[][] = [];
      let finalRowIds: string[] = [];
      
      // Reconstruct rows based on rowOrder, using rawArray and addedRows
      if (config.rowOrder && Array.isArray(config.rowOrder)) {
          config.rowOrder.forEach((rowId: string) => {
             // Exclude logic
             if (config.excludedRowIds && config.excludedRowIds.includes(rowId)) return;
             
             let row = [];
             if (rowId.startsWith('orig_')) {
                 const origIdx = parseInt(rowId.replace('orig_', '')) + offset;
                 row = rawArray[origIdx] ? [...rawArray[origIdx]] : [];
             } else {
                 row = config.addedRows && config.addedRows[rowId] ? [...config.addedRows[rowId]] : [];
             }
             
             // Apply cell edits
             const colsCount = Math.max(row.length, 50) + (config.addedCols || 0);
             for (let c = 0; c < colsCount; c++) {
                 if (config.cellEdits && config.cellEdits[`${rowId}_${c}`] !== undefined) {
                     row[c] = config.cellEdits[`${rowId}_${c}`];
                 }
             }
             
             finalRows.push(row);
             finalRowIds.push(rowId);
          });
          
          // Append any remaining original rows that weren't in rowOrder
          const previewLength = config.rowOrder.filter((id: string) => id.startsWith('orig_')).length;
          for (let i = previewLength + offset; i < rawArray.length; i++) {
             // We assume these were never excluded because they weren't in the preview
             finalRows.push([...(rawArray[i] || [])]);
             finalRowIds.push(`orig_${i - offset}`);
          }
      } else {
          // Fallback (e.g. if config wasn't provided or is old format)
          finalRows = rawArray.slice(offset);
          finalRowIds = finalRows.map((_, i) => `orig_${i}`);
      }
      
      let headerVisIdx = 0;
      if (config.headerRowId) {
          const idx = finalRowIds.indexOf(config.headerRowId);
          if (idx !== -1) headerVisIdx = idx;
      }
      
      let endVisIdx = finalRows.length - 1;
      if (config.dataEndRowId) {
          const idx = finalRowIds.indexOf(config.dataEndRowId);
          if (idx !== -1) endVisIdx = idx;
      }
      
      const headerRow = finalRows[headerVisIdx] || [];
      const rawHeaders = headerRow.map((h: any, i: number) => h !== undefined && h !== null && String(h).trim() !== '' ? String(h).trim() : `Column_${i+1}`);
      
      const headersMap: { index: number, name: string }[] = [];
      const headerCounts: Record<string, number> = {};
      rawHeaders.forEach((h: string, i: number) => {
          let name = h;
          if (headerCounts[h]) {
              headerCounts[h]++;
              name = `${h}_${headerCounts[h]}`;
          } else {
              headerCounts[h] = 1;
          }
          headersMap.push({ index: i, name });
      });
      
      for (let i = 0; i < (config.addedCols || 0); i++) {
         let name = `Custom Col ${i+1}`;
         headersMap.push({ index: headerRow.length + i, name });
      }

      // Filter excluded cols
      const headers = config.excludedCols ? headersMap.filter(h => !config.excludedCols.includes(h.name)) : headersMap;

      // Apply renames
      headers.forEach(h => {
          if (config.columnRenames && config.columnRenames[h.name]) {
              h.name = config.columnRenames[h.name];
          }
      });

      const records: any[] = [];
      for (let i = headerVisIdx + 1; i <= endVisIdx && i < finalRows.length; i++) {
          const row = finalRows[i];
          if (!row) continue;
          
          const record: any = {};
          let hasData = false;
          
          headers.forEach((h) => {
              const val = row[h.index];
              if (val !== undefined && val !== null && val !== '') hasData = true;
              record[h.name] = val;
          });
          if (hasData) records.push(record);
      }

      if (records.length === 0) continue;

      // Infer column types, override with config if present
      const columns = headers.map(h => {
        // Find original name from headersMap to check config.columnTypes
        const originalHeader = headersMap.find(hm => hm.index === h.index);
        const originalName = originalHeader ? originalHeader.name : h.name;

        if (config.columnTypes && config.columnTypes[originalName]) {
          return { name: h.name, type: config.columnTypes[originalName], isPrimary: false };
        }

        let numCount = 0, dateCount = 0, catCount = 0;
        const sample = records.slice(0, 100).map(r => r[h.name]).filter(v => v !== undefined && v !== null && v !== '');
        if (sample.length === 0) return { name: h.name, type: 'text', isPrimary: false };
        
        sample.forEach(v => {
            if (isDateLike(v)) dateCount++;
            else if (parseNumber(v) !== null) numCount++;
            else catCount++;
        });
        
        let type = 'text';
        if (dateCount / sample.length > 0.5) type = 'date';
        else if (numCount / sample.length > 0.6) type = 'numeric';
        
        return { name: h.name, type, isPrimary: false };
      });
      // Sanitize records based on inferred types to ensure perfect charting and aggregation
      records.forEach(r => {
          columns.forEach(c => {
              const val = r[c.name];
              if (c.type === 'numeric') {
                  const n = parseNumber(val);
                  r[c.name] = n !== null ? n : 0;
              } else if (c.type === 'text') {
                  if (val === undefined || val === null || String(val).trim() === '') {
                      r[c.name] = 'Unknown'; // Fixes 'undefined' categories in charts
                  } else {
                      r[c.name] = String(val).trim();
                  }
              }
          });
      });

      // Generate a dynamic table name
      const safeSheetName = config.id.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const dynamicTableName = `data_${datasetId.replace(/-/g, '_')}_${safeSheetName}`;

      // 3. Register Data Table in Supabase
      let tableId = `mock-table-${Date.now()}`;
      try {
        const { data: dataTable, error: dtError } = await supabaseAdmin
          .from('data_tables')
          .insert({
              dataset_id: datasetId,
              sheet_name: config.tableNameOverride || config.id, // Use overridden name or ID
              table_name: dynamicTableName,
              columns,
              row_count: records.length
          })
          .select('id')
          .single();
          
        if (!dtError && dataTable) {
            tableId = dataTable.id;
        }
      } catch (e) {
          console.error("Skipping table insert", e);
      }

      // 4. Create dynamic table in Postgres and Insert
      try {
          const columnDefs = columns.map(c => {
              let pgType = 'TEXT';
              if (c.type === 'numeric') pgType = 'NUMERIC';
              if (c.type === 'date') pgType = 'TIMESTAMP';
              return `"${c.name}" ${pgType}`;
          }).join(', ');

          const createTableSql = `CREATE TABLE IF NOT EXISTS "${dynamicTableName}" (_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ${columnDefs});`;
          await pool.query(createTableSql);
          
          if (records.length > 0) {
              const cols = columns.map(c => `"${c.name}"`).join(', ');
              
              // Chunked inserts
              const chunkSize = 1000;
              for (let i = 0; i < records.length; i += chunkSize) {
                  const chunk = records.slice(i, i + chunkSize);
                  const values: any[] = [];
                  const placeholders = chunk.map((r, rIdx) => {
                      return '(' + columns.map((c, cIdx) => {
                          let val = r[c.name];
                          if (c.type === 'numeric' && typeof val === 'string') val = parseNumber(val);
                          values.push(val);
                          return `$${rIdx * columns.length + cIdx + 1}`;
                      }).join(', ') + ')';
                  }).join(', ');
                  
                  const insertSql = `INSERT INTO "${dynamicTableName}" (${cols}) VALUES ${placeholders}`;
                  await pool.query(insertSql, values);
              }
          }

          parsedSheets.push({
            id: tableId,
            sheetName: config.tableNameOverride || config.id,
            tableName: dynamicTableName,
            columns,
            records: records,
            totalRows: records.length,
            headerRowIdx: headerVisIdx,
            rawPreview: rawArray.slice(0, 1000)
          });

      } catch (dbError) {
          console.error("DDL/DML Error:", dbError);
          // Fallback: Even if Postgres fails, we push the sheet for in-memory use!
          parsedSheets.push({
            id: tableId,
            sheetName: config.tableNameOverride || config.id,
            tableName: dynamicTableName,
            columns,
            records: records,
            totalRows: records.length,
            headerRowIdx: headerVisIdx,
            rawPreview: rawArray.slice(0, 1000)
          });
      }
    }

    return NextResponse.json({
        datasetId,
        sheets: parsedSheets
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
