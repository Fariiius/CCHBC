"use client";

import React, { useMemo } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const Header = () => {
  const { fileName, resetDashboard, sheets, activeSheet, setActiveSheet } = useDashboard();
  const totalRows = sheets.reduce((s, sh) => s + sh.rowCount, 0);

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 2rem',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'var(--primary)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileSpreadsheet size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.2 }}>
              Analytics Dashboard
            </div>
            {fileName && (
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>
                {fileName} · {totalRows.toLocaleString()} rows
              </div>
            )}
          </div>
        </div>

        {/* Sheet Tabs */}
        {sheets.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', height: '100%', alignItems: 'center' }}>
            <div style={{ width: 1, height: 24, background: 'var(--border)', marginRight: '1rem' }} />
            
            <button
              onClick={() => setActiveSheet('Master Summary')}
              style={{
                padding: '0.4rem 1rem', fontSize: '0.8rem',
                fontWeight: activeSheet === 'Master Summary' ? 800 : 600,
                color: activeSheet === 'Master Summary' ? 'white' : 'var(--foreground)',
                background: activeSheet === 'Master Summary' ? 'var(--primary)' : '#e2e8f0',
                border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              ★ Master Summary
            </button>

            {sheets.map(s => (
              <button
                key={s.name}
                onClick={() => setActiveSheet(s.name)}
                style={{
                  padding: '0.4rem 1rem', fontSize: '0.8rem',
                  fontWeight: activeSheet === s.name ? 700 : 500,
                  color: activeSheet === s.name ? 'var(--primary)' : 'var(--foreground-muted)',
                  background: activeSheet === s.name ? 'var(--primary-light)' : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s'
                }}
                onMouseOver={e => { if (activeSheet !== s.name) e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseOut={e => { if (activeSheet !== s.name) e.currentTarget.style.background = 'transparent'; }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {fileName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={resetDashboard}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem',
              background: 'var(--primary)',
              color: 'white',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.8rem',
              transition: 'opacity 0.15s'
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseOut={e => (e.currentTarget.style.opacity = '1')}
          >
            <UploadCloud size={14} />
            New File
          </button>
        </div>
      )}
    </header>
  );
};

export const FiltersBar = () => {
  const { sheets, masterFilters, toggleFilter, resetFilters } = useDashboard();
  
  const allFilterableCols = useMemo(() => {
    const map = new Map<string, Set<string>>();
    sheets.forEach(sheet => {
      [...sheet.categoricalCols, ...sheet.dateCols].forEach(col => {
        const unique = new Set(sheet.records.map(r => String(r[col] ?? '')));
        if (unique.size >= 2 && unique.size <= 30) {
          if (!map.has(col)) map.set(col, new Set());
          unique.forEach(v => {
            if (v && v.trim() !== 'undefined' && v.trim() !== 'null') map.get(col)!.add(v);
          });
        }
      });
    });
    return Array.from(map.entries())
      .filter(([_, set]) => set.size >= 2 && set.size <= 30)
      .map(([col, set]) => ({ col, values: Array.from(set).sort() }));
  }, [sheets]);

  if (allFilterableCols.length === 0) return null;

  const hasActive = Object.values(masterFilters).some(v => v.length > 0);

  return (
    <div style={{
      background: 'var(--surface-2)',
      borderBottom: '1px solid var(--border)',
      padding: '0.6rem 2rem',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      {allFilterableCols.map(({ col, values }, i) => {
        const activeVals = masterFilters[col] || [];
        return (
          <React.Fragment key={col}>
            {i > 0 && <div style={{ width: 1, height: 20, background: 'var(--border)' }} />}
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 2 }}>
              {col}
            </span>
            {values.map(val => (
              <button
                key={val}
                onClick={() => toggleFilter(col, val)}
                style={{
                  padding: '0.2rem 0.65rem',
                  borderRadius: 999,
                  fontSize: '0.75rem',
                  fontWeight: activeVals.includes(val) ? 700 : 500,
                  background: activeVals.includes(val) ? 'var(--primary)' : 'transparent',
                  color: activeVals.includes(val) ? 'white' : 'var(--foreground)',
                  border: `1px solid ${activeVals.includes(val) ? 'var(--primary)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {val}
              </button>
            ))}
          </React.Fragment>
        );
      })}
      {hasActive && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <button
            onClick={resetFilters}
            style={{
              padding: '0.2rem 0.65rem',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              cursor: 'pointer'
            }}
          >
            ✕ Reset
          </button>
        </>
      )}
    </div>
  );
};
