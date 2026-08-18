"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDashboard, StagingSheet } from '@/context/DashboardContext';
import { X, Table as TableIcon, MapPin, Check, ChevronRight } from 'lucide-react';

interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export const StudioView = () => {
  const { stagingFile, stagingSheets, clearStaging, saveExtractedTable, savePinnedCell } = useDashboard();
  const [activeTab, setActiveTab] = useState(0);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Table Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [filters, setFilters] = useState<Set<number>>(new Set());
  const [tableName, setTableName] = useState('');

  const gridRef = useRef<HTMLDivElement>(null);

  if (!stagingFile || stagingSheets.length === 0) return null;

  const activeSheet = stagingSheets[activeTab];

  // --- MOUSE EVENTS ---
  const handleMouseDown = (r: number, c: number) => {
    if (isExtracting) return; // Disable selection while extracting
    setIsDragging(true);
    setSelection({ startRow: r, startCol: c, endRow: r, endCol: c });
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (isDragging && selection) {
      setSelection({ ...selection, endRow: r, endCol: c });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
  };

  // Ensure dragging stops if mouse leaves the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const getMinMax = () => {
    if (!selection) return null;
    return {
      minR: Math.min(selection.startRow, selection.endRow),
      maxR: Math.max(selection.startRow, selection.endRow),
      minC: Math.min(selection.startCol, selection.endCol),
      maxC: Math.max(selection.startCol, selection.endCol),
    };
  };

  const bounds = getMinMax();
  const isSingleCell = bounds && bounds.minR === bounds.maxR && bounds.minC === bounds.maxC;

  // --- ACTIONS ---
  const startExtraction = () => {
    setIsExtracting(true);
    setHeaderRowIdx(bounds?.minR || 0); // Default to the first row of selection
    setTableName(`${activeSheet.name} - Table`);
    setFilters(new Set());
  };

  const cancelExtraction = () => {
    setIsExtracting(false);
    setSelection(null);
  };

  const confirmExtraction = async () => {
    if (!bounds) return;
    const { minR, maxR, minC, maxC } = bounds;

    const rawHeaders = activeSheet.data[headerRowIdx];
    const headers = [];
    const colMap: number[] = [];

    for (let c = minC; c <= maxC; c++) {
      headers.push({
        name: String(rawHeaders[c] || `Col_${c}`),
        isFilter: filters.has(c)
      });
      colMap.push(c);
    }

    const dataRows = [];
    for (let r = headerRowIdx + 1; r <= maxR; r++) {
      const row = activeSheet.data[r] || [];
      const extractedRow = colMap.map(c => row[c] ?? null);
      // Skip completely empty rows
      if (extractedRow.some(v => v !== null && String(v).trim() !== '')) {
        dataRows.push(extractedRow);
      }
    }

    await saveExtractedTable(tableName, activeSheet.name, headers, dataRows);
    setIsExtracting(false);
    setSelection(null);
    alert('Table Extracted Successfully!');
  };

  const handlePinCell = async () => {
    if (!bounds) return;
    const val = activeSheet.data[bounds.minR][bounds.minC];
    const name = prompt("Name this KPI:");
    if (name) {
      const cellRef = `R${bounds.minR}C${bounds.minC}`;
      await savePinnedCell(name, activeSheet.name, cellRef, val);
      setSelection(null);
      alert('Cell Pinned as KPI!');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--background)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <div style={{ background: '#111111', color: 'white', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#F40009', padding: '0.4rem', borderRadius: 8 }}><TableIcon size={20} color="white" /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Data Studio</h2>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{stagingFile.name}</div>
          </div>
        </div>
        <button onClick={clearStaging} style={{ background: 'transparent', border: '1px solid #333', color: 'white', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <X size={16} /> Close Studio
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid var(--border)' }}>
        {stagingSheets.map((s, idx) => (
          <div key={idx} onClick={() => { setActiveTab(idx); setSelection(null); setIsExtracting(false); }}
            style={{
              padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: activeTab === idx ? 700 : 500,
              color: activeTab === idx ? '#F40009' : '#5f6368',
              borderBottom: activeTab === idx ? '2px solid #F40009' : '2px solid transparent'
            }}
          >
            {s.name}
          </div>
        ))}
      </div>

      {/* WORKSPACE AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* GRID */}
        <div ref={gridRef} style={{ flex: 1, overflow: 'auto', padding: '2rem', background: '#f8f9fa' }}>
          <div style={{ background: 'white', display: 'inline-block', border: '1px solid #dadce0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', userSelect: 'none' }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {activeSheet.data.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td style={{ background: '#f1f3f4', color: '#5f6368', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRight: '1px solid #dadce0', borderBottom: '1px solid #dadce0', textAlign: 'center', fontWeight: 600 }}>{rIdx + 1}</td>
                    {Array.from({ length: Math.max(row.length, 10) }).map((_, cIdx) => {
                      const val = row[cIdx];
                      const inBounds = bounds && rIdx >= bounds.minR && rIdx <= bounds.maxR && cIdx >= bounds.minC && cIdx <= bounds.maxC;
                      
                      let bg = 'white';
                      let color = '#202124';
                      let border = '1px solid #e8eaed';

                      if (inBounds) {
                        bg = 'rgba(244,0,9,0.1)';
                        border = '1px solid rgba(244,0,9,0.3)';
                        if (isExtracting && rIdx === headerRowIdx) {
                          bg = '#F40009';
                          color = 'white';
                        }
                      } else if (isExtracting) {
                        bg = '#fafafa';
                        color = '#bdc1c6';
                      }

                      return (
                        <td key={cIdx} 
                          onMouseDown={() => handleMouseDown(rIdx, cIdx)}
                          onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                          style={{
                            minWidth: 100, height: 28, padding: '0 0.5rem', fontSize: '0.8rem',
                            border, background: bg, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            cursor: isExtracting && inBounds ? 'pointer' : 'cell'
                          }}
                          onClick={() => {
                            if (isExtracting && inBounds) {
                              if (rIdx === headerRowIdx) {
                                // Toggle Filter
                                const newFilters = new Set(filters);
                                if (newFilters.has(cIdx)) newFilters.delete(cIdx); else newFilters.add(cIdx);
                                setFilters(newFilters);
                              } else {
                                // Set new Header Row
                                setHeaderRowIdx(rIdx);
                                setFilters(new Set());
                              }
                            }
                          }}
                        >
                          {isExtracting && rIdx === headerRowIdx && inBounds && (
                            <span style={{ marginRight: 4, opacity: filters.has(cIdx) ? 1 : 0.3, cursor: 'pointer' }}>⚡</span>
                          )}
                          {val !== null && val !== undefined ? String(val) : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* EXTRACTION PANEL (Right Side) */}
        {isExtracting && bounds && (
          <div style={{ width: 350, background: 'white', borderLeft: '1px solid var(--border)', padding: '1.5rem', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.05)', zIndex: 10 }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 800 }}>Table Extractor</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Table Name</label>
              <input value={tableName} onChange={e => setTableName(e.target.value)} style={{ width: '100%', padding: '0.6rem', border: '1px solid #dadce0', borderRadius: 6, fontSize: '0.9rem' }} />
            </div>

            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', border: '1px solid #e8eaed' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.85rem' }}>1. Set Header Row</div>
              <p style={{ fontSize: '0.75rem', color: '#5f6368', margin: '0 0 8px 0', lineHeight: 1.4 }}>Click any row inside your selection to mark it as the header. It is currently highlighted <span style={{color:'#F40009', fontWeight:700}}>Red</span>.</p>
              
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.85rem', marginTop: '1rem' }}>2. Setup Slicers</div>
              <p style={{ fontSize: '0.75rem', color: '#5f6368', margin: 0, lineHeight: 1.4 }}>Click the ⚡ icon on header cells to toggle them as dashboard filters.</p>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
              <button onClick={cancelExtraction} style={{ flex: 1, padding: '0.75rem', background: '#f1f3f4', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmExtraction} style={{ flex: 1, padding: '0.75rem', background: '#F40009', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Check size={16} /> Save Table
              </button>
            </div>
          </div>
        )}

        {/* FLOATING ACTION BUTTON (When selected but not extracting) */}
        {!isExtracting && selection && bounds && (
          <div style={{
            position: 'absolute',
            bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
            background: '#111111', color: 'white', padding: '0.5rem', borderRadius: 12,
            display: 'flex', gap: '0.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 10
          }}>
            <button onClick={startExtraction} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', background: '#F40009', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              <TableIcon size={16} /> Extract Table
            </button>
            {isSingleCell && (
              <button onClick={handlePinCell} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', background: '#333', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                <MapPin size={16} /> Pin Cell as KPI
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
