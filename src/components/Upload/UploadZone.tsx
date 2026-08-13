"use client";

import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Zap } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export const UploadZone = () => {
  const { handleFileUpload } = useDashboard();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem',
      background: 'var(--background)',
      gap: '2rem'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          background: 'var(--primary-light)',
          borderRadius: 16,
          marginBottom: '1.25rem'
        }}>
          <FileSpreadsheet size={32} color="var(--primary)" />
        </div>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--foreground)',
          marginBottom: '0.75rem',
          letterSpacing: '-0.025em'
        }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', lineHeight: 1.6 }}>
          Upload any Excel file. The AI engine will automatically analyze every sheet, detect what matters, and build your executive summary dashboard.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          width: '100%',
          maxWidth: 560,
          padding: '3rem 2rem',
          border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          background: dragActive ? 'var(--primary-light)' : 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: dragActive ? 'var(--primary)' : 'var(--primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}>
          <UploadCloud size={26} color={dragActive ? 'white' : 'var(--primary)'} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
            {dragActive ? 'Drop it here!' : 'Drop your Excel file here'}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)' }}>
            or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>click to browse</span> — .xlsx, .xls, .csv supported
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleChange} />
      </div>

      {/* Features */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        maxWidth: 560,
        width: '100%'
      }}>
        {[
          { icon: '🔍', title: 'Auto-Detect', desc: 'Reads every sheet & table automatically' },
          { icon: '🧠', title: 'AI Analysis', desc: 'Finds key metrics & groupings for you' },
          { icon: '📊', title: 'Instant Charts', desc: 'Professional visuals in seconds' }
        ].map(f => (
          <div key={f.title} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--foreground)', marginBottom: '0.25rem' }}>{f.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
