"use client";

import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Header } from '@/components/Header/Header';
import dynamic from 'next/dynamic';
import { UploadZone } from '@/components/Upload/UploadZone';
import { Loader2 } from 'lucide-react';

const DashboardView = dynamic(() => import('@/components/Dashboard/Charts').then(mod => mod.DashboardView), { ssr: false });

export const Dashboard = () => {
  const {
    loading, error, workspaces, activeWorkspaceId, resetDashboard,
  } = useDashboard();

  if (loading && workspaces.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: 'var(--background)' }}>
        <Loader2 size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Analyzing your data...</div>
          <div style={{ color: '#5f6368', fontSize: '0.8rem' }}>Extracting tables and metadata</div>
        </div>
      </div>
    );
  }

  if (error && workspaces.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--background)' }}>
        <div style={{ background: '#fce8e6', border: '1px solid #f5c6cb', borderRadius: 8, padding: '1.5rem 2rem', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: '#d93025', marginBottom: 4 }}>Error</div>
          <div style={{ color: '#5f6368', fontSize: '0.8rem', marginBottom: 12 }}>{error}</div>
          <button onClick={resetDashboard} style={{ padding: '0.5rem 1.25rem', borderRadius: 6, background: '#d93025', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
         {activeWorkspaceId ? <DashboardView /> : <UploadZone />}
      </div>
    </div>
  );
};
