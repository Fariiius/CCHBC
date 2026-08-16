"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import dynamic from 'next/dynamic';
const DashboardView = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.DashboardView), { ssr: false });
const FilterBar = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.FilterBar), { ssr: false });
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, workspaces, activeWorkspaceId, resetDashboard, stagingWorkspace, stagedFile, handleFileUpload, updateStagedColumnType, confirmStaging, cancelStaging } = useDashboard();
  const [activeTab, setActiveTab] = React.useState('');
  const [headerMapping, setHeaderMapping] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (stagingWorkspace?.analyzed?.length && !activeTab) {
      setActiveTab(stagingWorkspace.analyzed[0].name);
    }
  }, [stagingWorkspace, activeTab]);

  if (loading && workspaces.length === 0) {
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
          <div style={{ fontWeight: 700, color: '#d93025', marginBottom: 4 }}>Could not parse file</div>
          <div style={{ color: '#5f6368', fontSize: '0.8rem', marginBottom: 12 }}>{error}</div>
          <button onClick={resetDashboard} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, background: '#d93025', color: 'white', fontWeight: 600, fontSize: '0.8rem' }}>Try Again</button>
        </div>
      </div>
    );
  }

  if (workspaces.length === 0 && !stagingWorkspace) return <UploadZone />;

  if (stagingWorkspace) {
    const sheet = stagingWorkspace.analyzed.find(s => s.name === activeTab) || stagingWorkspace.analyzed[0];
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
        <Header />
        <div style={{ padding: '2rem', background: 'var(--background)', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', background: 'var(--surface)', borderRadius: 8, padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Data Prep Wizard</h2>
            <p style={{ color: '#5f6368', marginBottom: '1.5rem' }}>Review your data, select the correct header row, and map your columns before importing.</p>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e8eaed', marginBottom: '1rem' }}>
              {stagingWorkspace.analyzed.map(s => (
                <div key={s.name} onClick={() => setActiveTab(s.name)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === s.name ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: activeTab === s.name ? 700 : 500, color: activeTab === s.name ? 'var(--primary)' : '#5f6368' }}>
                  {s.name} ({s.totalRows} rows)
                </div>
              ))}
            </div>

            {sheet && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>1. Select Header Row</h3>
                  <p style={{ color: '#5f6368', fontSize: '0.8rem', marginBottom: '0.5rem' }}>If your Excel file has weird formatting or garbage at the top, click "Set as Header" on the row that contains your actual column names.</p>
                  <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflowX: 'auto', maxHeight: 300 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <tbody>
                        {sheet.rawPreview?.map((row, idx) => (
                          <tr key={idx} style={{ background: sheet.headerRowIdx === idx ? '#e8f0fe' : idx % 2 === 0 ? 'white' : '#f8f9fa', borderBottom: '1px solid #e8eaed' }}>
                            <td style={{ padding: '0.5rem', borderRight: '1px solid #e8eaed', width: 120 }}>
                              {sheet.headerRowIdx === idx ? (
                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Current Header</span>
                              ) : (
                                <button onClick={() => {
                                  const newMapping = { ...headerMapping, [sheet.name]: idx };
                                  setHeaderMapping(newMapping);
                                  handleFileUpload(stagedFile!, newMapping);
                                }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', borderRadius: 4, border: '1px solid #dadce0', background: 'white', color: '#5f6368' }}>Set as Header</button>
                              )}
                            </td>
                            {row.map((cell, cIdx) => <td key={cIdx} style={{ padding: '0.5rem', color: sheet.headerRowIdx === idx ? 'var(--primary)' : '#3c4043', fontWeight: sheet.headerRowIdx === idx ? 700 : 400 }}>{String(cell ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>2. Map Columns</h3>
                  <p style={{ color: '#5f6368', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Ensure each column is treated correctly as a Group (Text) or a Value (Number).</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', background: '#f8f9fa', padding: '1rem', borderRadius: 8, border: '1px solid #e8eaed' }}>
                    {sheet.columns?.map(col => (
                      <div key={col.name} style={{ background: 'white', padding: '0.5rem', borderRadius: 6, border: '1px solid #dadce0', display: 'flex', flexDirection: 'column', gap: '0.25rem', width: 180 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={col.name}>{col.name}</span>
                        <select value={col.type} onChange={e => updateStagedColumnType(sheet.name, col.name, e.target.value)} style={{ padding: '0.25rem', fontSize: '0.75rem', borderRadius: 4, border: '1px solid #e8eaed', outline: 'none' }}>
                          <option value="text">Group (Text)</option>
                          <option value="numeric">Value (Number)</option>
                          <option value="date">Date</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end', borderTop: '1px solid #e8eaed', paddingTop: '1.5rem' }}>
              <button onClick={cancelStaging} style={{ padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, color: '#5f6368', background: '#f1f3f4', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmStaging()} style={{ padding: '0.5rem 1.5rem', borderRadius: 6, fontWeight: 600, color: 'white', background: 'var(--primary)', border: 'none', cursor: 'pointer' }}>Confirm & Build Dashboard</button>
            </div>
          </div>
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
