import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const wb = xlsx.read(buffer, { type: 'buffer' });

    const sheetsPreview = wb.SheetNames.map(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      // Auto-detect a sensible default header row
      let defaultHeaderRowIdx = 0;
      let maxStrings = 0;
      for (let i = 0; i < Math.min(rawArray.length, 20); i++) {
        const row = rawArray[i];
        if (!row || !Array.isArray(row)) continue;
        const stringCount = row.filter(val => typeof val === 'string' && val.trim() !== '').length;
        if (stringCount > maxStrings) {
          maxStrings = stringCount;
          defaultHeaderRowIdx = i;
        }
      }

      return {
        originalSheetName: sheetName,
        id: sheetName, // UUID for duplicate tracking on frontend
        rawPreview: rawArray.slice(0, 50),
        defaultHeaderRowIdx
      };
    });

    return NextResponse.json({ sheets: sheetsPreview });
  } catch (error: any) {
    console.error("Preview API Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate preview' }, { status: 500 });
  }
}
