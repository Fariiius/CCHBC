"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import { DashboardView, FilterBar } from '@/components/Dashboard/Charts';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, workspaces, activeWorkspaceId, resetDashboard, stagingWorkspace, confirmStaging, cancelStaging } = useDashboard();

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
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
        <Header />
        <div style={{ padding: '2rem', background: 'var(--background)', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', background: 'var(--surface)', borderRadius: 8, padding: '2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Review Import: {stagingWorkspace.fileName}</h2>
            <p style={{ color: '#5f6368', marginBottom: '2rem' }}>We've analyzed your file. Review the detected tables and columns before finalizing the import.</p>
            
            {stagingWorkspace.analyzed.map((sheet: any) => (
              <div key={sheet.name} style={{ marginBottom: '1.5rem', border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '0.75rem 1rem', fontWeight: 700, borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{sheet.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#5f6368', fontWeight: 500 }}>{sheet.rowCount} rows</span>
                </div>
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {sheet.allCols.map((col: string) => {
                      let type = 'text';
                      if (sheet.numericCols.includes(col)) type = 'numeric';
                      if (sheet.dateCols.includes(col)) type = 'date';
                      return (
                        <div key={col} style={{ background: '#f1f3f4', padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 600 }}>{col}</span>
                          <span style={{ color: '#80868b', fontSize: '0.65rem', textTransform: 'uppercase' }}>{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button onClick={cancelStaging} style={{ padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, color: '#5f6368', background: '#f1f3f4', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => confirmStaging()} style={{ padding: '0.5rem 1.5rem', borderRadius: 6, fontWeight: 600, color: 'white', background: 'var(--primary)', border: 'none', cursor: 'pointer' }}>Confirm & Import</button>
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
