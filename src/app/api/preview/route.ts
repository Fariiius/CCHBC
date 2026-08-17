import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const wb = xlsx.read(buffer, { type: 'buffer' });

    const sheetsPreview: any[] = [];
    
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const tables: { start: number, end: number }[] = [];
      let currentTableStart = -1;
      let emptyRowCount = 0;

      for (let i = 0; i < rawArray.length; i++) {
        const row = rawArray[i];
        const isEmpty = !row || !Array.isArray(row) || row.every(val => val === undefined || val === null || String(val).trim() === '');
        
        if (!isEmpty) {
           if (currentTableStart === -1) {
              currentTableStart = i; 
           }
           emptyRowCount = 0; 
        } else {
           if (currentTableStart !== -1) {
              emptyRowCount++;
              if (emptyRowCount >= 3) {
                 tables.push({ start: currentTableStart, end: i - emptyRowCount });
                 currentTableStart = -1;
              }
           }
        }
      }
      
      if (currentTableStart !== -1) {
         tables.push({ start: currentTableStart, end: rawArray.length - 1 });
      }

      if (tables.length === 0) return;

      tables.forEach((t, idx) => {
         const previewSlice = rawArray.slice(t.start, Math.min(t.end + 1, t.start + 100));
         
         let defaultHeaderRowIdx = 0;
         let maxStrings = 0;
         for (let i = 0; i < Math.min(previewSlice.length, 20); i++) {
           const row = previewSlice[i];
           if (!row || !Array.isArray(row)) continue;
           const stringCount = row.filter(val => typeof val === 'string' && val.trim() !== '').length;
           if (stringCount > maxStrings) {
             maxStrings = stringCount;
             defaultHeaderRowIdx = i;
           }
         }

         const tableName = tables.length > 1 ? `${sheetName} - Table ${idx + 1}` : sheetName;

         sheetsPreview.push({
           originalSheetName: sheetName,
           id: tableName, 
           tableNameOverride: tableName,
           rawPreview: previewSlice,
           defaultHeaderRowIdx,
           rowOffset: t.start
         });
      });
    });

    return NextResponse.json({ sheets: sheetsPreview });
  } catch (error: any) {
    console.error("Preview API Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate preview' }, { status: 500 });
  }
}
