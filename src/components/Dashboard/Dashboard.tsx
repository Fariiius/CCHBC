"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import { DashboardView } from '@/components/Dashboard/Charts';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, sheets, resetDashboard } = useDashboard();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: '1.25rem',
        background: 'var(--background)'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--primary-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Loader2 size={32} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.35rem' }}>
            Analyzing your data...
          </h2>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.875rem' }}>
            Detecting sheets, columns, and building your dashboard
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', gap: '1rem',
        background: 'var(--background)', padding: '2rem'
      }}>
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 'var(--radius)',
          padding: '1.5rem 2rem', maxWidth: 480, textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h2 style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>Could not parse file</h2>
          <p style={{ color: '#7f1d1d', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>
          <button
            onClick={resetDashboard}
            style={{
              padding: '0.65rem 1.5rem', borderRadius: 8,
              background: '#dc2626', color: 'white', fontWeight: 600, fontSize: '0.875rem'
            }}
          >
            Try Another File
          </button>
        </div>
      </div>
    );
  }

  if (sheets.length === 0) {
    return <UploadZone />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
      <Header />
      <DashboardView />
    </div>
  );
};
