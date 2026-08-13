"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import { DashboardView, Sidebar } from '@/components/Dashboard/Charts';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, sheets, resetDashboard } = useDashboard();

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: '1rem',
        background: 'var(--background)'
      }}>
        <Loader2 size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: 4 }}>
            Analyzing your data...
          </div>
          <div style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem' }}>
            Detecting tables, columns, and building charts
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'var(--background)', padding: '2rem'
      }}>
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', padding: '1.5rem 2rem', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>⚠️</div>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.35rem' }}>Could not parse file</div>
          <div style={{ color: '#7f1d1d', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>
          <button onClick={resetDashboard} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, background: '#dc2626', color: 'white', fontWeight: 600, fontSize: '0.8rem' }}>Try Another File</button>
        </div>
      </div>
    );
  }

  if (sheets.length === 0) return <UploadZone />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <Sidebar />
        <DashboardView />
      </div>
    </div>
  );
};
