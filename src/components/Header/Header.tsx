"use client";

import React from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './Header.module.css';

export const Header = () => {
  const { data, resetDashboard } = useDashboard();

  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <h1>Executive Overview</h1>
        <p>Interactive analytics from uploaded data</p>
      </div>
      
      <div className={styles.actions}>
        {data && (
          <>
            <span className={styles.lastUpdated}>
              <CheckCircle2 size={16} /> Viewing: {data.fileName}
            </span>
            <button 
              onClick={resetDashboard} 
              className={styles.refreshButton}
            >
              <UploadCloud size={16} />
              Upload New File
            </button>
          </>
        )}
      </div>
    </header>
  );
};
