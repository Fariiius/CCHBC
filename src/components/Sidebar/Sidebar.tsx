"use client";

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './Sidebar.module.css';

export const Sidebar = () => {
  const { 
    schema,
    filters, 
    setFilters, 
    resetFilters,
    uniqueValuesForColumn
  } = useDashboard();

  if (!schema) return null;

  const handleCheckboxChange = (
    col: string, 
    value: string, 
    checked: boolean
  ) => {
    setFilters(prev => {
      const current = prev[col] || [];
      if (checked) {
        return { ...prev, [col]: [...current, value] };
      } else {
        return { ...prev, [col]: current.filter(v => v !== value) };
      }
    });
  };

  return (
    <aside className={styles.sidebar}>
      {schema.categoricalCols.map(col => {
        const uniqueValues = uniqueValuesForColumn(col);
        // Only show filter if there are a reasonable number of unique values (e.g. <= 20)
        // to prevent massive filter lists.
        if (uniqueValues.length > 20 || uniqueValues.length === 0) return null;

        return (
          <div key={col} className={styles.section}>
            <h3 className={styles.sectionTitle}>{col}</h3>
            {uniqueValues.map(val => (
              <label key={val} style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                <input 
                  type="checkbox" 
                  checked={(filters[col] || []).includes(val)}
                  onChange={(e) => handleCheckboxChange(col, val, e.target.checked)}
                />
                {val}
              </label>
            ))}
          </div>
        );
      })}

      <button className={styles.resetButton} onClick={resetFilters}>
        Reset Filters
      </button>
    </aside>
  );
};
