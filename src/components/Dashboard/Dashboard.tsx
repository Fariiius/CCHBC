"use client";

import React, { useState, useMemo } from 'react';
import { useDashboard, SheetPrepConfig } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import dynamic from 'next/dynamic';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2, Trash2, Copy, Eye, EyeOff, LayoutTemplate, Settings2, Trash, RefreshCw, PieChart, ArrowDownToLine } from 'lucide-react';

const DashboardView = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.DashboardView), { ssr: false });
const FilterBar = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.FilterBar), { ssr: false });

export const Dashboard = () => {
  const {
    loading, error, workspaces, activeWorkspaceId, resetDashboard,
    stagingWorkspace, stagedFile, confirmStaging, cancelStaging,
    updatePrepConfig, duplicatePrepSheet, removePrepSheet
  } = useDashboard();

  const [activeTabId, setActiveTabId] = useState<string>('');
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  
  // Selection Engine
  const [selectionMode, setSelectionMode] = useState(false);
  const [localSelectedCells, setLocalSelectedCells] = useState<string[]>([]);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  const activeConfig = stagingWorkspace?.configs.find(c => c.id === activeTabId) || (stagingWorkspace && stagingWorkspace.configs[0]);

  const handleAddRow = () => {
    if (!activeConfig) return;
    const newRowId = 'added_' + Date.now();
    const colCount = (activeConfig.rawPreview[0]?.length || 0) + (activeConfig.addedCols || 0);
    const newRowOrder = [newRowId, ...(activeConfig.rowOrder || [])];
    updatePrepConfig(activeConfig.id, {
      rowOrder: newRowOrder,
      addedRows: { ...activeConfig.addedRows, [newRowId]: Array(colCount).fill('') }
    });
  };

  const handleDuplicateRow = (sourceRowId: string) => {
    if (!activeConfig) return;
    const newOrder = [...(activeConfig.rowOrder || [])];
    const newAddedRows = { ...(activeConfig.addedRows || {}) };
    
    const copiedRowId = 'added_' + Date.now();
    
    let dataToCopy: any[] = [];
    if (sourceRowId.startsWith('orig_')) {
       const origIdx = parseInt(sourceRowId.replace('orig_', ''));
       dataToCopy = [...activeConfig.rawPreview[origIdx]];
    } else {
       dataToCopy = [...(activeConfig.addedRows[sourceRowId] || [])];
    }
    
    const colsCount = (activeConfig.rawPreview[0]?.length || 0) + (activeConfig.addedCols || 0);
    for (let c = 0; c < colsCount; c++) {
       const sourceEditKey = `${sourceRowId}_${c}`;
       if (activeConfig.cellEdits && activeConfig.cellEdits[sourceEditKey] !== undefined) {
           dataToCopy[c] = activeConfig.cellEdits[sourceEditKey];
       }
    }

    newAddedRows[copiedRowId] = dataToCopy;
    
    const srcIdx = newOrder.indexOf(sourceRowId);
    if (srcIdx !== -1) {
       newOrder.splice(srcIdx + 1, 0, copiedRowId);
    } else {
       newOrder.push(copiedRowId);
    }

    updatePrepConfig(activeConfig.id, {
      rowOrder: newOrder,
      addedRows: newAddedRows
    });
  };

  React.useEffect(() => {
    if (stagingWorkspace && stagingWorkspace.configs && stagingWorkspace.configs.length > 0 && (!activeTabId || !stagingWorkspace.configs.find(c => c.id === activeTabId))) {
      setActiveTabId(stagingWorkspace.configs[0].id);
    }
  }, [stagingWorkspace, activeTabId]);

  if (loading && workspaces.length === 0 && !stagingWorkspace) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: 'var(--background)' }}>
        <Loader2 size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Analyzing your data...</div>
          <div style={{ color: '#5f6368', fontSize: '0.8rem' }}>Detecting tables and building charts</div>
        </div>
      </div>
    );
  }

  if (error && workspaces.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--background)' }}>
        <div style={{ background: '#fce8e6', border: '1px solid #f5c6cb', borderRadius: 8, padding: '1.5rem 2rem', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: '#d93025', marginBottom: 4 }}>Error</div>
          <div style={{ color: '#5f6368', fontSize: '0.8rem', marginBottom: 12 }}>{error}</div>
          <button onClick={resetDashboard} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, background: '#d93025', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>Try Again</button>
        </div>
      </div>
    );
  }

  if (workspaces.length === 0 && !stagingWorkspace) return <UploadZone />;

  if (stagingWorkspace) {
    const handleAddRow = () => {
      if (!activeConfig) return;
      const newId = `custom_${Date.now()}`;
      const newRows = { ...activeConfig.addedRows, [newId]: new Array((activeConfig.rawPreview[0]?.length || 0) + (activeConfig.addedCols || 0)).fill('') };
      updatePrepConfig(activeConfig.id, { 
         addedRows: newRows,
         rowOrder: [newId, ...activeConfig.rowOrder] // Add to top for easy access
      });
    };

    // Derive headers for the active config based on its headerRowId
    let headers: { index: number, originalName: string, name: string }[] = [];
    if (activeConfig && activeConfig.headerRowId) {
      let headerRow: any[] = [];
      if (activeConfig.headerRowId.startsWith('orig_')) {
          const origIdx = parseInt(activeConfig.headerRowId.replace('orig_', ''));
          headerRow = activeConfig.rawPreview[origIdx] || [];
      } else {
          headerRow = activeConfig.addedRows[activeConfig.headerRowId] || [];
      }
      const counts: Record<string, number> = {};

      headerRow.forEach((h: any, i: number) => {
        const cellKey = `${activeConfig.headerRowId}_${i}`;
        const editedVal = activeConfig.cellEdits ? activeConfig.cellEdits[cellKey] : undefined;
        let finalH = editedVal !== undefined ? editedVal : h;
        let val = (finalH !== undefined && finalH !== null && String(finalH).trim() !== '') ? String(finalH).trim() : `Column_${i + 1}`;
        let finalName = val;
        if (counts[val]) {
          counts[val]++;
          finalName = `${val}_${counts[val]}`;
        } else {
          counts[val] = 1;
        }
        headers.push({ index: i, originalName: val, name: finalName });
      });

      // Append added columns
      for (let i = 0; i < (activeConfig.addedCols || 0); i++) {
        let val = `Custom Col ${i + 1}`;
        headers.push({ index: headerRow.length + i, originalName: val, name: val });
      }
    }

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
        <Header />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--background)' }}>
          {/* Studio Sidebar */}
          <div style={{ width: 280, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '1.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem' }}>Data Studio</h2>
              <p style={{ fontSize: '0.75rem', color: '#5f6368', lineHeight: 1.4, marginBottom: '1rem' }}>Review detected tables, select metrics, and configure charts before importing.</p>
              
              <button 
                onClick={confirmStaging}
                style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', color: 'white', borderRadius: 6, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(244,0,9,0.2)' }}
              >
                <ArrowDownToLine size={16} /> Import to Dashboard
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                Tables ({stagingWorkspace.configs.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {stagingWorkspace.configs.map(config => (
                  <div
                    key={config.id}
                    onClick={() => setActiveTabId(config.id)}
                    style={{
                      padding: '0.75rem', borderRadius: 8, cursor: 'pointer',
                      background: activeTabId === config.id ? '#e8f0fe' : 'transparent',
                      border: activeTabId === config.id ? '1px solid #d2e3fc' : '1px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: activeTabId === config.id ? 700 : 500, color: activeTabId === config.id ? 'var(--primary)' : 'var(--foreground)' }}>
                      {config.tableNameOverride || config.id}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicatePrepSheet(config.id); }}
                        style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#5f6368', borderRadius: 4 }}
                        title="Extract another table from this sheet"
                      ><Copy size={14} /></button>
                      {stagingWorkspace.configs.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removePrepSheet(config.id); }}
                          style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d93025', borderRadius: 4 }}
                          title="Exclude Table"
                        ><Trash size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: '#f8f9fa' }}>
              <button onClick={cancelStaging} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, fontWeight: 600, color: '#5f6368', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>

          {/* Studio Main Area */}
          {activeConfig && (
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
              <div style={{ width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* Section 0: Table Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '1rem', fontWeight: 700, color: '#5f6368', flexShrink: 0 }}>Table Name:</label>
                  <input
                    type="text"
                    value={activeConfig.tableNameOverride !== undefined ? activeConfig.tableNameOverride : activeConfig.id}
                    onChange={e => updatePrepConfig(activeConfig.id, { tableNameOverride: e.target.value })}
                    style={{ flex: 1, fontSize: '1rem', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', fontWeight: 600, color: 'var(--foreground)' }}
                  />
                </div>

                {/* Section 1: Raw Data Cleansing */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Settings2 size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Data Cleansing & Header Selection</h3>
                  </div>
                  <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                    Select the row that contains your column headers. You can also permanently delete any garbage rows (e.g. totals or empty space) by clicking the trash icon next to them.
                  </p>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: '70vh', background: '#f8f9fa' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, boxShadow: '0 1px 0 var(--border)' }}>
                        <tr>
                          <th style={{ width: 180, padding: '0.75rem', color: '#5f6368', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Row Actions
                            <button onClick={handleAddRow} style={{ padding: '0.2rem 0.4rem', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem' }}>+ Row</button>
                          </th>
                          {activeConfig.rawPreview[0]?.map((_, i) => {
                            const col = headers.find(h => h.index === i);
                            const isHidden = col && activeConfig.excludedCols?.includes(col.name);
                            return (
                              <th key={i} style={{ padding: '0.75rem', color: isHidden ? '#cbd5e1' : '#5f6368', fontWeight: 600, borderLeft: '1px solid var(--border)', background: isHidden ? '#f8f9fa' : 'transparent', opacity: isHidden ? 0.5 : 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                   <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{col ? col.name : `Col ${i + 1}`}</span>
                                   <button 
                                      onClick={() => {
                                         if (!col) return;
                                         const ex = activeConfig.excludedCols || [];
                                         if (ex.includes(col.name)) {
                                            updatePrepConfig(activeConfig.id, { excludedCols: ex.filter(c => c !== col.name) });
                                         } else {
                                            updatePrepConfig(activeConfig.id, { excludedCols: [...ex, col.name] });
                                         }
                                      }}
                                      style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: isHidden ? '#5f6368' : '#d93025', display: 'flex', alignItems: 'center' }}
                                   >
                                      {isHidden ? <RefreshCw size={12} /> : <Trash2 size={12} />}
                                   </button>
                                </div>
                              </th>
                            );
                          })}
                          {Array.from({ length: activeConfig.addedCols || 0 }).map((_, i) => {
                            const cIdx = (activeConfig.rawPreview[0]?.length || 0) + i;
                            const col = headers.find(h => h.index === cIdx);
                            const isHidden = col && activeConfig.excludedCols?.includes(col.name);
                            return (
                              <th key={`added_${i}`} style={{ padding: '0.75rem', color: isHidden ? '#cbd5e1' : 'var(--primary)', fontWeight: 600, borderLeft: '1px solid var(--border)', background: isHidden ? '#f8f9fa' : 'transparent', opacity: isHidden ? 0.5 : 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                   <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{col ? col.name : `Custom Col ${i + 1}`}</span>
                                   <button 
                                      onClick={() => {
                                         if (!col) return;
                                         const ex = activeConfig.excludedCols || [];
                                         if (ex.includes(col.name)) {
                                            updatePrepConfig(activeConfig.id, { excludedCols: ex.filter(c => c !== col.name) });
                                         } else {
                                            updatePrepConfig(activeConfig.id, { excludedCols: [...ex, col.name] });
                                         }
                                      }}
                                      style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: isHidden ? '#5f6368' : '#d93025', display: 'flex', alignItems: 'center' }}
                                   >
                                      {isHidden ? <RefreshCw size={12} /> : <Trash2 size={12} />}
                                   </button>
                                </div>
                              </th>
                            );
                          })}
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <button
                              onClick={() => updatePrepConfig(activeConfig.id, { addedCols: (activeConfig.addedCols || 0) + 1 })}
                              style={{ padding: '0.25rem 0.5rem', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                            >+ Col</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeConfig.rowOrder || []).map((rowId, visualIdx) => {
                          const isOrig = rowId.startsWith('orig_');
                          const origIdx = isOrig ? parseInt(rowId.replace('orig_', '')) : -1;
                          
                          let row = isOrig ? activeConfig.rawPreview[origIdx] : activeConfig.addedRows[rowId];
                          if (!row) row = []; // Safety

                          const isHeader = activeConfig.headerRowId === rowId;
                          const isEndRow = activeConfig.dataEndRowId === rowId;
                          
                          const headerVisIdx = activeConfig.headerRowId ? activeConfig.rowOrder.indexOf(activeConfig.headerRowId) : 0;
                          const endVisIdx = activeConfig.dataEndRowId ? activeConfig.rowOrder.indexOf(activeConfig.dataEndRowId) : activeConfig.rowOrder.length;
                          
                          const isOutsideBounds = (visualIdx < headerVisIdx) || (visualIdx > endVisIdx);
                          const isExcluded = (activeConfig.excludedRowIds || []).includes(rowId) || isOutsideBounds;

                          return (
                            <tr 
                              key={rowId} 
                              style={{
                                background: isHeader ? '#e8f0fe' : (isEndRow ? '#fce8e6' : (isExcluded ? '#f8f9fa' : 'white')),
                                opacity: isExcluded && !isHeader && !isEndRow ? 0.4 : 1,
                                borderBottom: '1px solid var(--border)',
                                transition: 'background 0.2s'
                              }}
                            >
                              <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                  onClick={() => {
                                    const ex = activeConfig.excludedRowIds || [];
                                    if (ex.includes(rowId)) {
                                      updatePrepConfig(activeConfig.id, { excludedRowIds: ex.filter(r => r !== rowId) });
                                    } else {
                                      updatePrepConfig(activeConfig.id, { excludedRowIds: [...ex, rowId] });
                                    }
                                  }}
                                  style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: (activeConfig.excludedRowIds||[]).includes(rowId) ? '#5f6368' : '#d93025' }}
                                >
                                  {(activeConfig.excludedRowIds||[]).includes(rowId) ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                                </button>

                                {isHeader ? (
                                  <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#d2e3fc', borderRadius: 4 }}>HEADER</span>
                                ) : (
                                  <button onClick={() => updatePrepConfig(activeConfig.id, { headerRowId: rowId })} disabled={(activeConfig.excludedRowIds||[]).includes(rowId)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: (activeConfig.excludedRowIds||[]).includes(rowId) ? 'not-allowed' : 'pointer', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>Set Header</button>
                                )}
                                
                                <button 
                                  onClick={() => duplicatePrepSheet(activeConfig.id, rowId)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                                  title="Extract a brand new table starting at this row"
                                >Start Table Here</button>

                                {isEndRow ? (
                                  <span style={{ color: '#d93025', fontWeight: 700, fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#fad2e1', borderRadius: 4 }}>END</span>
                                ) : (
                                  <button onClick={() => updatePrepConfig(activeConfig.id, { dataEndRowId: isEndRow ? undefined : rowId })} disabled={(activeConfig.excludedRowIds||[]).includes(rowId) || visualIdx <= headerVisIdx} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: ((activeConfig.excludedRowIds||[]).includes(rowId) || visualIdx <= headerVisIdx) ? 'not-allowed' : 'pointer', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>Set End</button>
                                )}
                              </td>
                              
                              {/* Render original columns + added columns */}
                              {Array.from({ length: (activeConfig.rawPreview[0]?.length || 0) + (activeConfig.addedCols || 0) }).map((_, cIdx) => {
                                const editKey = `${rowId}_${cIdx}`;
                                const cellVal = row[cIdx];
                                const displayVal = activeConfig.cellEdits && activeConfig.cellEdits[editKey] !== undefined ? activeConfig.cellEdits[editKey] : (cellVal !== undefined && cellVal !== null ? String(cellVal) : '');
                                
                                const col = headers.find(h => h.index === cIdx);
                                const isColHidden = col && activeConfig.excludedCols?.includes(col.name);
                                const isSelected = localSelectedCells.includes(editKey);
                                
                                return (
                                  <td 
                                    key={cIdx} 
                                    onMouseDown={() => {
                                      if (!selectionMode) return;
                                      setIsDraggingSelection(true);
                                      setLocalSelectedCells([editKey]);
                                    }}
                                    onMouseEnter={() => {
                                      if (!selectionMode || !isDraggingSelection) return;
                                      if (!localSelectedCells.includes(editKey)) {
                                        setLocalSelectedCells(prev => [...prev, editKey]);
                                      }
                                    }}
                                    onMouseUp={() => setIsDraggingSelection(false)}
                                    style={{ 
                                      padding: 0, 
                                      borderLeft: '1px solid var(--border)', 
                                      border: isSelected ? '2px solid var(--primary)' : undefined,
                                      maxWidth: 200, 
                                      background: isSelected ? 'rgba(244,0,9,0.1)' : (isColHidden ? '#f8f9fa' : 'transparent'), 
                                      opacity: isColHidden ? 0.4 : 1, 
                                      transition: 'all 0.1s',
                                      userSelect: selectionMode ? 'none' : 'auto'
                                    }}
                                  >
                                    <input
                                      type="text"
                                      value={displayVal}
                                      onChange={e => updatePrepConfig(activeConfig.id, { cellEdits: { ...(activeConfig.cellEdits || {}), [editKey]: e.target.value } })}
                                      style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', outline: 'none', color: (isExcluded || isColHidden) ? '#9aa0a6' : 'inherit', cursor: selectionMode ? 'cell' : ((isExcluded || isColHidden) ? 'not-allowed' : 'text'), pointerEvents: selectionMode ? 'none' : 'auto' }}
                                      disabled={isExcluded || isColHidden || selectionMode}
                                      placeholder={isOrig && cIdx < (activeConfig.rawPreview[0]?.length || 0) ? '' : 'Type...'}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Selection Action Bar */}
                {selectionMode && localSelectedCells.length > 0 && (
                  <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', padding: '1rem', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid var(--border)', display: 'flex', gap: '1rem', zIndex: 100, alignItems: 'center' }}>
                     <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{localSelectedCells.length} cells selected</span>
                     <button
                        onClick={() => {
                           const label = prompt('Enter KPI Name (e.g. Total Revenue):', 'Manual KPI');
                           if (!label) return;
                           
                           const vals = localSelectedCells.map(sc => {
                              try {
                                 const [rId, cIdxStr] = sc.split('_');
                                 const cIdx = parseInt(cIdxStr);
                                 const origIdx = rId.startsWith('orig_') ? parseInt(rId.replace('orig_', '')) : -1;
                                 let row = rId.startsWith('orig_') ? activeConfig.rawPreview[origIdx] : activeConfig.addedRows[rId];
                                 if (!row) row = [];
                                 const cellVal = activeConfig.cellEdits && activeConfig.cellEdits[sc] !== undefined ? activeConfig.cellEdits[sc] : (row[cIdx] !== undefined ? row[cIdx] : 0);
                                 return cellVal;
                              } catch (e) {
                                 return 0;
                              }
                           });
                           
                           // Try to sum if numeric
                           let finalValStr = vals.join(', ');
                           const numVals = vals.map(v => Number(String(v).replace(/[^0-9.-]+/g,"")));
                           if (numVals.every(n => !isNaN(n))) {
                              finalValStr = numVals.reduce((a,b) => a+b, 0).toString();
                           }
                           
                           const newKpis = [...(activeConfig.explicitKpis || []), { id: `ekpi-${Date.now()}`, label, value: finalValStr }];
                           updatePrepConfig(activeConfig.id, { explicitKpis: newKpis });
                           setSelectionMode(false);
                           setLocalSelectedCells([]);
                        }}
                        style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                     >
                        Create KPI from Selection
                     </button>
                     <button onClick={() => { setSelectionMode(false); setLocalSelectedCells([]); }} style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#5f6368', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
                
                {/* Global Dashboard Filters */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)', marginTop: '1.5rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                     <Settings2 size={18} color="var(--primary)" />
                     <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Explicit Global Filters</h3>
                   </div>
                   <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                     Select which columns should be extracted as Global Sidebar Filters for the final dashboard.
                   </p>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {headers.map(col => {
                         const isFilter = activeConfig.explicitFilters?.includes(col.name);
                         return (
                           <button
                             key={col.name}
                             onClick={() => {
                               const filters = activeConfig.explicitFilters || [];
                               if (isFilter) updatePrepConfig(activeConfig.id, { explicitFilters: filters.filter(f => f !== col.name) });
                               else updatePrepConfig(activeConfig.id, { explicitFilters: [...filters, col.name] });
                             }}
                             style={{ padding: '0.5rem 1rem', background: isFilter ? 'var(--primary-light)' : 'white', color: isFilter ? 'var(--primary)' : 'var(--foreground)', border: isFilter ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                           >
                             {col.name}
                           </button>
                         )
                      })}
                   </div>
                </div>

                {/* Section 2: Column Types & Hiding */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <LayoutTemplate size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Column Visibility & Types</h3>
                  </div>
                  <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                    Hide columns you don't need to import to keep your dashboard clean. You can also override the detected column type.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', background: '#f8f9fa', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                    {headers.map(col => {
                      const isHidden = activeConfig.excludedCols.includes(col.name);
                      const currentType = activeConfig.columnTypes[col.name] || 'text'; // Fallback text until backend infers properly if not set, but UI forces a select
                      return (
                        <div key={col.name} style={{
                          background: 'var(--surface)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 200,
                          opacity: isHidden ? 0.5 : 1, transition: 'opacity 0.2s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={(activeConfig.columnRenames && activeConfig.columnRenames[col.name]) ? activeConfig.columnRenames[col.name] : col.name}
                              disabled={isHidden}
                              onChange={e => {
                                const newRenames = { ...(activeConfig.columnRenames || {}) };
                                newRenames[col.name] = e.target.value;
                                updatePrepConfig(activeConfig.id, { columnRenames: newRenames });
                              }}
                              style={{ fontWeight: 600, fontSize: '0.8rem', width: '130px', border: 'none', borderBottom: '1px solid transparent', outline: 'none', background: 'transparent', color: isHidden ? '#9ca3af' : 'var(--foreground)', transition: 'border 0.2s' }}
                              title={col.name}
                              placeholder="Column Name"
                              onFocus={e => e.target.style.borderBottom = '1px solid var(--primary)'}
                              onBlur={e => e.target.style.borderBottom = '1px solid transparent'}
                            />
                            <button
                              onClick={() => {
                                if (isHidden) {
                                  updatePrepConfig(activeConfig.id, { excludedCols: activeConfig.excludedCols.filter(c => c !== col.name) });
                                } else {
                                  updatePrepConfig(activeConfig.id, { excludedCols: [...activeConfig.excludedCols, col.name] });
                                }
                              }}
                              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: '#5f6368' }}
                              title={isHidden ? "Show Column" : "Hide Column"}
                            >
                              {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          <select
                            value={currentType}
                            disabled={isHidden}
                            onChange={e => {
                              updatePrepConfig(activeConfig.id, {
                                columnTypes: { ...activeConfig.columnTypes, [col.name]: e.target.value as any }
                              });
                            }}
                            style={{ padding: '0.35rem', fontSize: '0.75rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none', background: isHidden ? '#f8f9fa' : 'white' }}
                          >
                            <option value="text">Group (Text)</option>
                            <option value="numeric">Value (Number)</option>
                            <option value="date">Date</option>
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Section 3: Pre-configure Charts */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <PieChart size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Pre-configure Charts</h3>
                  </div>
                  <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                    Map your columns to generate a chart automatically when this table is imported. You can add multiple initial charts.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(activeConfig.initialCharts || []).map((chart, cIdx) => (
                      <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1.5 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>Chart Title</label>
                          <input
                            type="text"
                            value={chart.title || ''}
                            placeholder="Auto-generated if empty"
                            onChange={e => {
                              const newCharts = [...(activeConfig.initialCharts || [])];
                              newCharts[cIdx].title = e.target.value;
                              updatePrepConfig(activeConfig.id, { initialCharts: newCharts });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>Chart Type</label>
                          <select
                            value={chart.type}
                            onChange={e => {
                              const newCharts = [...(activeConfig.initialCharts || [])];
                              newCharts[cIdx].type = e.target.value as any;
                              updatePrepConfig(activeConfig.id, { initialCharts: newCharts });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          >
                            <option value="pie">Pie Chart</option>
                            <option value="bar">Bar Chart</option>
                            <option value="line">Line Chart</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>Category (Names/Groups)</label>
                          <select
                            value={chart.catCol}
                            onChange={e => {
                              const newCharts = [...(activeConfig.initialCharts || [])];
                              newCharts[cIdx].catCol = e.target.value;
                              updatePrepConfig(activeConfig.id, { initialCharts: newCharts });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          >
                            <option value="" disabled>Select Column</option>
                            {headers.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>Metric (Values)</label>
                          <select
                            value={chart.valCol}
                            onChange={e => {
                              const newCharts = [...(activeConfig.initialCharts || [])];
                              newCharts[cIdx].valCol = e.target.value;
                              updatePrepConfig(activeConfig.id, { initialCharts: newCharts });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          >
                            <option value="" disabled>Select Column</option>
                            {headers.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
                          <button
                            onClick={() => {
                              const newCharts = (activeConfig.initialCharts || []).filter((_, i) => i !== cIdx);
                              updatePrepConfig(activeConfig.id, { initialCharts: newCharts });
                            }}
                            style={{ padding: '0.5rem', background: '#fce8e6', color: '#d93025', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            title="Remove Chart"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const current = activeConfig.initialCharts || [];
                        updatePrepConfig(activeConfig.id, {
                          initialCharts: [...current, { title: '', type: 'pie', catCol: '', valCol: '' }]
                        });
                      }}
                      style={{ padding: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px dashed var(--primary)', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}
                    >
                      + Add Chart Mapping
                    </button>
                  </div>
                </div>

                {/* Section 4: Pre-configure KPIs */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <LayoutTemplate size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Pre-configure KPIs</h3>
                  </div>
                  <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                    Select a column to generate a top-level KPI metric automatically when this table is imported.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(activeConfig.initialKpis || []).map((kpi, kIdx) => (
                      <div key={kIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8f9fa', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1.5 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>KPI Title</label>
                          <input
                            type="text"
                            value={kpi.title || ''}
                            placeholder="e.g. Total Revenue"
                            onChange={e => {
                              const newKpis = [...(activeConfig.initialKpis || [])];
                              newKpis[kIdx].title = e.target.value;
                              updatePrepConfig(activeConfig.id, { initialKpis: newKpis });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5f6368' }}>Metric (Value)</label>
                          <select
                            value={kpi.col}
                            onChange={e => {
                              const newKpis = [...(activeConfig.initialKpis || [])];
                              newKpis[kIdx].col = e.target.value;
                              updatePrepConfig(activeConfig.id, { initialKpis: newKpis });
                            }}
                            style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border)', outline: 'none' }}
                          >
                            <option value="" disabled>Select Column</option>
                            {headers.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
                          <button
                            onClick={() => {
                              const newKpis = (activeConfig.initialKpis || []).filter((_, i) => i !== kIdx);
                              updatePrepConfig(activeConfig.id, { initialKpis: newKpis });
                            }}
                            style={{ padding: '0.5rem', background: '#fce8e6', color: '#d93025', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                            title="Remove KPI"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const current = activeConfig.initialKpis || [];
                        updatePrepConfig(activeConfig.id, {
                          initialKpis: [...current, { title: '', col: '' }]
                        });
                      }}
                      style={{ padding: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px dashed var(--primary)', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}
                    >
                      + Add KPI Mapping
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
      <Header />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      {activeWorkspaceId ? (
        <>
          <FilterBar />
          <DashboardView />
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368' }}>
          Select or upload a workspace.
        </div>
      )}
    </div>
  );
};
