"use client";

import React, { useState, useMemo } from 'react';
import { useDashboard, SheetPrepConfig } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import dynamic from 'next/dynamic';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2, Trash2, Copy, Eye, EyeOff, LayoutTemplate, Settings2, Trash, RefreshCw } from 'lucide-react';

const DashboardView = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.DashboardView), { ssr: false });
const FilterBar = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.FilterBar), { ssr: false });

export const Dashboard = () => {
  const { 
    loading, error, workspaces, activeWorkspaceId, resetDashboard, 
    stagingWorkspace, stagedFile, confirmStaging, cancelStaging,
    updatePrepConfig, duplicatePrepSheet, removePrepSheet
  } = useDashboard();
  
  const [activeTabId, setActiveTabId] = useState<string>('');

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
    const activeConfig = stagingWorkspace.configs.find(c => c.id === activeTabId) || stagingWorkspace.configs[0];
    
    // Derive headers for the active config based on its headerRowIdx
    let headers: { index: number, originalName: string, name: string }[] = [];
    if (activeConfig && activeConfig.rawPreview[activeConfig.headerRowIdx]) {
      const headerRow = activeConfig.rawPreview[activeConfig.headerRowIdx];
      const counts: Record<string, number> = {};
      
      headerRow.forEach((h: any, i: number) => {
        let val = (h !== undefined && h !== null && String(h).trim() !== '') ? String(h).trim() : `Column_${i+1}`;
        let finalName = val;
        if (counts[val]) {
          counts[val]++;
          finalName = `${val}_${counts[val]}`;
        } else {
          counts[val] = 1;
        }
        headers.push({ index: i, originalName: val, name: finalName });
      });
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
                      {config.id}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); duplicatePrepSheet(config.id); }}
                        style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#5f6368', borderRadius: 4 }}
                        title="Duplicate Table"
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
              <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Section 1: Raw Data Cleansing */}
                <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Settings2 size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Data Cleansing & Header Selection</h3>
                  </div>
                  <p style={{ color: '#5f6368', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: 800, lineHeight: 1.5 }}>
                    Select the row that contains your column headers. You can also permanently delete any garbage rows (e.g. totals or empty space) by clicking the trash icon next to them. 
                  </p>
                  
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 400, background: '#f8f9fa' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, boxShadow: '0 1px 0 var(--border)' }}>
                        <tr>
                          <th style={{ width: 140, padding: '0.75rem', color: '#5f6368', fontWeight: 600 }}>Row Actions</th>
                          {activeConfig.rawPreview[0]?.map((_, i) => (
                            <th key={i} style={{ padding: '0.75rem', color: '#5f6368', fontWeight: 600, borderLeft: '1px solid var(--border)' }}>Col {i+1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeConfig.rawPreview.map((row, idx) => {
                          const isHeader = activeConfig.headerRowIdx === idx;
                          const isExcluded = activeConfig.excludedRows.includes(idx);
                          return (
                            <tr key={idx} style={{ 
                              background: isHeader ? '#e8f0fe' : (isExcluded ? '#f8f9fa' : 'white'), 
                              opacity: isExcluded ? 0.4 : 1,
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.2s'
                            }}>
                              <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button 
                                  onClick={() => {
                                    if (isExcluded) {
                                      updatePrepConfig(activeConfig.id, { excludedRows: activeConfig.excludedRows.filter(r => r !== idx) });
                                    } else {
                                      updatePrepConfig(activeConfig.id, { excludedRows: [...activeConfig.excludedRows, idx] });
                                    }
                                  }}
                                  style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: isExcluded ? '#5f6368' : '#d93025' }}
                                  title={isExcluded ? "Restore Row" : "Exclude Row"}
                                >
                                  {isExcluded ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                                </button>
                                
                                {isHeader ? (
                                  <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#d2e3fc', borderRadius: 4 }}>HEADER</span>
                                ) : (
                                  <button onClick={() => updatePrepConfig(activeConfig.id, { headerRowIdx: idx })} disabled={isExcluded} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', cursor: isExcluded ? 'not-allowed' : 'pointer', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>Set Header</button>
                                )}
                              </td>
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} style={{ padding: '0.5rem 0.75rem', borderLeft: '1px solid var(--border)', color: isHeader ? 'var(--primary)' : 'var(--foreground)', fontWeight: isHeader ? 600 : 400 }}>
                                  {String(cell ?? '')}
                                </td>
                              ))}
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
                            <span style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isHidden ? '#9ca3af' : 'var(--foreground)' }} title={col.name}>{col.name}</span>
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
