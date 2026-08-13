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
      results[col] = filteredData.reduce((sum, item) => sum + (Number(item[col]) || 0), 0);
    });

    return results;
  }, [filteredData, schema]);

  if (!metrics || !schema) return null;

  const formatNumber = (val: number) => {
    if (val > 1000) {
      return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className={styles.grid}>
      <div className={`${styles.card} glass-panel animate-fade-in delay-100`}>
        <div className={styles.title}>Total Records</div>
        <div className={styles.value}>{filteredData.length.toLocaleString()}</div>
        <div className={styles.trend}>Rows in dataset</div>
      </div>

      {schema.numericCols.map((col, idx) => (
        <div key={col} className={`${styles.card} glass-panel animate-fade-in`} style={{ animationDelay: `${(idx + 2) * 100}ms` }}>
          <div className={styles.title}>Total {col}</div>
          <div className={styles.value}>{formatNumber(metrics[col])}</div>
          <div className={styles.trend}>Sum of values</div>
        </div>
      ))}
    </div>
  );
};
