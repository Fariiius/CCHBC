"use client";

import React, { useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const Header = () => {
  const { workspaces, activeWorkspaceId, switchWorkspace, closeWorkspace, handleFileUpload } = useDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateInputRef = useRef<HTMLInputElement>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const totalRows = activeWorkspace ? activeWorkspace.sheets.reduce((s, sh) => s + sh.totalRows, 0) : 0;

  const onNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      e.target.value = '';
    }
  };

  // Update feature temporarily disabled pending Data Prep integration

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: '0 0 0 1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', overflowX: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginRight: '1.5rem', flexShrink: 0 }}>
          <FileSpreadsheet size={16} color="var(--primary)" />
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--foreground)' }}>
            Workspaces
          </span>
        </div>

        {/* Workspace Tabs */}
        {workspaces.map(ws => (
          <div key={ws.id}
            onClick={() => switchWorkspace(ws.id)}
            style={{
              height: '100%', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              borderRight: '1px solid var(--border)', cursor: 'pointer',
              background: activeWorkspaceId === ws.id ? 'var(--background)' : 'transparent',
              borderBottom: activeWorkspaceId === ws.id ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: activeWorkspaceId === ws.id ? 700 : 500, color: activeWorkspaceId === ws.id ? 'var(--primary)' : 'var(--foreground-muted)' }}>
              {ws.fileName}
            </span>
            <button onClick={(e) => { e.stopPropagation(); closeWorkspace(ws.id); }} style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4 }}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '1rem', flexShrink: 0 }}>
        {activeWorkspace && (
          <div style={{ fontSize: '0.65rem', color: '#5f6368', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{totalRows.toLocaleString()} rows</span>
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0.35rem 0.75rem', background: '#f1f3f4',
            color: 'var(--foreground)', borderRadius: 6, fontWeight: 600, fontSize: '0.7rem',
            border: '1px solid #dadce0'
          }}
        >
          <UploadCloud size={12} /> New File
        </button>
      </div>

      <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={onNewFile} style={{ display: 'none' }} />
    </header>
  );
};
