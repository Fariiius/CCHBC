"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { KPICards } from './KPICards';
import { Charts } from './Charts';
import { DataTable } from './DataTable';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

export const Dashboard = () => {
  const { loading, error, data } = useDashboard();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', background: 'var(--background)' }}>
        <Loader2 className="iconSpin" size={48} color="var(--primary)" />
        <h2>Parsing File...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem', background: 'var(--background)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Error: {error}</h2>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)' }}
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
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <KPICards />
          <Charts />
          <DataTable />
        </main>
      </div>
    </div>
  );
};
