"use client";

import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './DataTable.module.css';

export const DataTable = () => {
  const { filteredData, schema } = useDashboard();
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  if (!schema || filteredData.length === 0) return null;

  const startIndex = (page - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + rowsPerPage);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const formatValue = (col: string, val: any) => {
    if (schema.numericCols.includes(col) && typeof val === 'number') {
      if (val > 1000) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
      return val.toString();
    }
    return String(val);
  };

  return (
    <div className={`${styles.container} glass-panel animate-fade-in delay-300`}>
      <h3 className={styles.title}>Detailed Records</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            {schema.allCols.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, i) => (
            <tr key={i}>
              {schema.allCols.map(col => (
                <td key={col}>{formatValue(col, row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '0.5rem 1rem', background: 'var(--secondary)', color: 'var(--foreground)', borderRadius: 'var(--radius)' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.875rem' }}>Page {page} of {totalPages}</span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '0.5rem 1rem', background: 'var(--secondary)', color: 'var(--foreground)', borderRadius: 'var(--radius)' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
