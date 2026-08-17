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

  const handleDragStart = (e: React.DragEvent, rowId: string) => {
    setDraggedRowId(rowId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragOver = (e: React.DragEvent, targetRowId: string) => {
    e.preventDefault();
    if (!draggedRowId || draggedRowId === targetRowId || !activeConfig) return;
    
    const newOrder = [...(activeConfig.rowOrder || [])];
    const fromIdx = newOrder.indexOf(draggedRowId);
    const toIdx = newOrder.indexOf(targetRowId);
    
    if (fromIdx !== -1 && toIdx !== -1) {
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedRowId);
      updatePrepConfig(activeConfig.id, { rowOrder: newOrder });
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedRowId(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
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
        let val = (h !== undefined && h !== null && String(h).trim() !== '') ? String(h).trim() : `Column_${i + 1}`;
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
            <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <LayoutTemplate size={18} color="var(--primary)" />
                <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Data Prep Studio</h2>
              </div>
              <p style={{ color: '#5f6368', fontSize: '0.75rem', lineHeight: 1.4 }}>Configure sheets, cleanse rows, and map columns before importing.</p>
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
              <button onClick={() => confirmStaging()} disabled={loading} style={{ width: '100%', padding: '0.75rem', borderRadius: 6, fontWeight: 700, color: 'white', background: 'var(--primary)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(26, 115, 232, 0.2)' }}>
                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Import to Dashboard'}
              </button>
              <button onClick={cancelStaging} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: 6, fontWeight: 600, color: '#5f6368', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
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
                          {activeConfig.rawPreview[0]?.map((_, i) => (
                            <th key={i} style={{ padding: '0.75rem', color: '#5f6368', fontWeight: 600, borderLeft: '1px solid var(--border)' }}>Col {i + 1}</th>
                          ))}
                          {Array.from({ length: activeConfig.addedCols || 0 }).map((_, i) => (
                            <th key={`added_${i}`} style={{ padding: '0.75rem', color: 'var(--primary)', fontWeight: 600, borderLeft: '1px solid var(--border)' }}>Custom Col {i + 1}</th>
                          ))}
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
                              draggable
                              onDragStart={(e) => handleDragStart(e, rowId)}
                              onDragOver={(e) => handleDragOver(e, rowId)}
                              onDragEnd={handleDragEnd}
                              style={{
                                background: isHeader ? '#e8f0fe' : (isEndRow ? '#fce8e6' : (isExcluded ? '#f8f9fa' : 'white')),
                                opacity: isExcluded && !isHeader && !isEndRow ? 0.4 : 1,
                                borderBottom: '1px solid var(--border)',
                                transition: 'background 0.2s',
                                cursor: 'grab'
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
                                return (
                                  <td key={cIdx} style={{ padding: 0, borderLeft: '1px solid var(--border)', maxWidth: 200 }}>
                                    <input
                                      type="text"
                                      value={displayVal}
                                      onChange={e => updatePrepConfig(activeConfig.id, { cellEdits: { ...(activeConfig.cellEdits || {}), [editKey]: e.target.value } })}
                                      style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', outline: 'none', color: isExcluded ? '#9aa0a6' : 'inherit', cursor: isExcluded ? 'not-allowed' : 'text' }}
                                      disabled={isExcluded}
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
