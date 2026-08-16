import { NextResponse } from 'next/server';
import _ from 'lodash';
// import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { datasetId, tableName, groupBy, value, calcCol, calcOp, type, filters, fallbackRecords } = body;

        // --- Fallback In-Memory Aggregation (If DB isn't connected) ---
        // We use this if the frontend passes fallbackRecords because it knows Supabase is disconnected
        if (fallbackRecords && fallbackRecords.length > 0) {
            let filtered = fallbackRecords;
            
            // 1. Apply Filters
            if (filters && filters.length > 0) {
                filtered = filtered.filter((row: any) => {
                    return filters.every((f: any) => {
                        const rowVal = String(row[f.column] ?? '');
                        return f.values.includes(rowVal);
                    });
                });
            }

            // 2. Aggregate
            
            if (type === 'kpi') {
                let total = _.sumBy(filtered, (r: any) => Number(r[value]) || 0);
                if (calcCol && calcOp) {
                    const valB = _.sumBy(filtered, (r: any) => Number(r[calcCol]) || 0);
                    if (calcOp === '+') total = total + valB;
                    else if (calcOp === '-') total = total - valB;
                    else if (calcOp === '*') total = total * valB;
                    else if (calcOp === '/') total = valB !== 0 ? total / valB : 0;
                }
                return NextResponse.json({ result: total });
            } 
            
            if (groupBy) {
                const grouped = _.groupBy(filtered, groupBy);
                const result = Object.entries(grouped).map(([category, records]) => {
                    let sum = _.sumBy(records as any[], (r: any) => Number(r[value]) || 0);
                    if (calcCol && calcOp) {
                        const valB = _.sumBy(records as any[], (r: any) => Number(r[calcCol]) || 0);
                        if (calcOp === '+') sum = sum + valB;
                        else if (calcOp === '-') sum = sum - valB;
                        else if (calcOp === '*') sum = sum * valB;
                        else if (calcOp === '/') sum = valB !== 0 ? sum / valB : 0;
                    }
                    return { category, value: sum };
                }).sort((a, b) => b.value - a.value);
                return NextResponse.json({ result });
            }

            return NextResponse.json({ result: filtered.slice(0, 500) }); // raw records for table
        }

        // --- Live Supabase SQL Aggregation (Production) ---
        // Note: For dynamic table names, Supabase JS client doesn't support aggregate GROUP BY easily.
        // We would use the postgres pool directly here to construct safe SQL:
        // SELECT "groupBy", SUM("value") FROM "tableName" WHERE ...
        
        return NextResponse.json({ error: 'Database mode requires live PG pool setup which is skipped in fallback.' }, { status: 501 });

    } catch (err: any) {
        console.error("Query Error:", err);
        return NextResponse.json({ error: err.message || 'Failed to query data.' }, { status: 500 });
    }
}
