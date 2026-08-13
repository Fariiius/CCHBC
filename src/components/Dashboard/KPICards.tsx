"use client";

import React, { useMemo } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './KPICards.module.css';

export const KPICards = () => {
  const { filteredData, schema } = useDashboard();

  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0 || !schema) return null;

    const results: Record<string, number> = {};
    schema.numericCols.forEach(col => {
      results[col] = filteredData.reduce((sum, item) => {
        const val = item[col];
        const num = typeof val === 'number' ? val : Number(String(val).replace(/[,$%€£\s]/g, ''));
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
    });

    return results;
  }, [filteredData, schema]);

  if (!metrics || !schema) return null;

  const formatNumber = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1e9) return (val / 1e9).toFixed(2) + 'bn';
    if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className={styles.grid}>
      <div className={`${styles.card} glass-panel animate-fade-in`}>
        <div className={styles.title}>Records</div>
        <div className={styles.value}>{filteredData.length.toLocaleString()}</div>
        <div className={styles.subtitle}>Total rows</div>
      </div>

      {schema.numericCols.map((col, idx) => (
        <div key={col} className={`${styles.card} glass-panel animate-fade-in`} style={{ animationDelay: `${(idx + 1) * 80}ms` }}>
          <div className={styles.title}>Sum of {col}</div>
          <div className={styles.value}>{formatNumber(metrics[col])}</div>
          <div className={styles.subtitle}>Total</div>
        </div>
      ))}
    </div>
  );
};
