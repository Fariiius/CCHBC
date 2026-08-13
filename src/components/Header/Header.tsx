"use client";

import React from 'react';
import { UploadCloud } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './Header.module.css';

export const Header = () => {
  const { data, resetDashboard, activeSheet, setActiveSheet } = useDashboard();

  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <h1>Analytics Dashboard</h1>
        {data && <span className={styles.fileName}>{data.fileName}</span>}
      </div>

      <div className={styles.actions}>
        {data && data.sheetNames.length > 1 && (
          <div className={styles.sheetTabs}>
            {data.sheetNames.map(name => (
              <button
                key={name}
                className={`${styles.sheetTab} ${activeSheet === name ? styles.active : ''}`}
                onClick={() => setActiveSheet(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        {data && (
          <button onClick={resetDashboard} className={styles.uploadButton}>
            <UploadCloud size={14} />
            New File
          </button>
        )}
      </div>
    </header>
  );
};

export const FiltersBar = () => {
  const { schema, filters, setFilters, resetFilters, uniqueValuesForColumn } = useDashboard();

  if (!schema) return null;

  const filterableCols = [...schema.categoricalCols, ...schema.dateCols].filter(col => {
    const vals = uniqueValuesForColumn(col);
    return vals.length > 0 && vals.length <= 25;
  });

  if (filterableCols.length === 0) return null;

  const toggleFilter = (col: string, val: string) => {
    setFilters(prev => {
      const current = prev[col] || [];
      if (current.includes(val)) {
        return { ...prev, [col]: current.filter(v => v !== val) };
      } else {
        return { ...prev, [col]: [...current, val] };
      }
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v.length > 0);

  return (
    <div className={styles.filtersBar}>
      {filterableCols.map((col, i) => {
        const values = uniqueValuesForColumn(col);
        return (
          <React.Fragment key={col}>
            {i > 0 && <div className={styles.divider} />}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>{col}</span>
              {values.map(val => (
                <button
                  key={val}
                  className={`${styles.filterPill} ${(filters[col] || []).includes(val) ? styles.active : ''}`}
                  onClick={() => toggleFilter(col, val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </React.Fragment>
        );
      })}
      {hasActiveFilters && (
        <>
          <div className={styles.divider} />
          <button className={styles.resetPill} onClick={resetFilters}>
            Reset
          </button>
        </>
      )}
    </div>
  );
};
