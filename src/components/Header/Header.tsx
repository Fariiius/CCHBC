"use client";

import React from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const Header = () => {
  const { fileName, resetDashboard, sheets, activeSheet, setActiveSheet } = useDashboard();
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
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSpreadsheet size={16} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--foreground)' }}>
            Dashboard
          </span>
          {fileName && (
            <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)', marginLeft: 4 }}>
              {fileName} · {totalRows.toLocaleString()} rows · {sheets.length} tables
            </span>
          )}
        </div>

        {sheets.length > 0 && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <div style={{ width: 1, height: 20, background: 'var(--border)', marginRight: 8 }} />
            <TabBtn active={activeSheet === 'Master Summary'} onClick={() => setActiveSheet('Master Summary')} label="★ Summary" highlight />
            {sheets.map(s => (
              <TabBtn key={s.name} active={activeSheet === s.name} onClick={() => setActiveSheet(s.name)} label={s.name} />
            ))}
          </div>
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

const TabBtn = ({ active, onClick, label, highlight }: { active: boolean; onClick: () => void; label: string; highlight?: boolean }) => (
  <button onClick={onClick} style={{
    padding: '0.25rem 0.7rem', fontSize: '0.72rem', borderRadius: 6,
    fontWeight: active ? 700 : 500,
    color: active ? (highlight ? 'white' : 'var(--primary)') : 'var(--foreground-muted)',
    background: active ? (highlight ? 'var(--primary)' : 'var(--primary-light)') : 'transparent',
    transition: 'all 0.12s',
  }}>
    {label}
  </button>
);
