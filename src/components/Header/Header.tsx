"use client";

import React, { useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const Header = () => {
  const { handleFileUpload, clearAllData } = useDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <header style={{
      background: '#111',
      color: 'white',
      borderBottom: '1px solid #333',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: '0 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <FileSpreadsheet size={18} color="#F40009" />
        <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.5px' }}>
          Coca-Cola HBC Analytics
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to clear all extracted tables, KPIs, and charts? This cannot be undone.")) {
              clearAllData();
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.35rem 0.75rem', background: 'transparent',
            color: '#ef4444', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem',
            border: '1px solid #ef4444', cursor: 'pointer'
          }}
        >
          <Trash2 size={12} /> Clear Database
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.35rem 0.75rem', background: '#F40009',
            color: 'white', borderRadius: 6, fontWeight: 700, fontSize: '0.75rem',
            border: 'none', cursor: 'pointer'
          }}
        >
          <UploadCloud size={14} /> Import File
        </button>
      </div>

      <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={onNewFile} style={{ display: 'none' }} />
    </header>
  );
};
