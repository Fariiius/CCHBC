"use client";

import React from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const Header = () => {
  const { fileName, resetDashboard, sheets } = useDashboard();
  const totalRows = sheets.reduce((s, sh) => s + sh.rowCount, 0);

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <FileSpreadsheet size={16} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)' }}>
          Summary Dashboard
        </span>
        {fileName && (
          <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)', marginLeft: 4 }}>
            {fileName} · {totalRows.toLocaleString()} rows · {sheets.length} table{sheets.length !== 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      {fileName && (
        <button
          onClick={resetDashboard}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0.3rem 0.75rem', background: 'var(--primary)',
            color: 'white', borderRadius: 6, fontWeight: 600, fontSize: '0.7rem',
          }}
        >
          <UploadCloud size={12} /> New File
        </button>
      )}
    </header>
  );
};
