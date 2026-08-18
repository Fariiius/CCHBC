import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const wb = xlsx.read(buffer, { type: 'buffer' });

    const sheets: any[] = [];
    
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rawArray = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
      
      // We return the raw 2D array. Slice to 2000 rows to prevent massive memory crashes.
      // If a user has a >2000 row Excel file where the headers are somehow at row 2001, they need to clean their excel.
      sheets.push({
        name: sheetName,
        data: rawArray.slice(0, 2000)
      });
    });

    return NextResponse.json({ sheets });
  } catch (error: any) {
    console.error("Preview API Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to parse file' }, { status: 500 });
  }
}
