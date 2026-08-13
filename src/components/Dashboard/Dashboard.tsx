"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header, FiltersBar } from '@/components/Header/Header';
import { KPICards } from './KPICards';
import { Charts } from './Charts';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, data } = useDashboard();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', background: 'var(--background)' }}>
        <Loader2 size={48} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <h2 style={{ fontWeight: 600 }}>Analyzing your data...</h2>
        <p style={{ color: 'var(--secondary-foreground)', fontSize: '0.875rem' }}>Detecting columns, types, and relationships</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', background: 'var(--background)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Error: {error}</h2>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600 }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return <UploadZone />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <FiltersBar />
      <main style={{ flex: 1, padding: '1.5rem 2rem', overflowY: 'auto' }}>
        <KPICards />
        <Charts />
      </main>
    </div>
  );
};
