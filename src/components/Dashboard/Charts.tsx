"use client";

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, ChartConfig } from '@/context/DashboardContext';
import { X, Plus } from 'lucide-react';
import styles from './Charts.module.css';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#eab308'
];

const PieChart = ({ config, data, onRemove }: { config: ChartConfig, data: any[], onRemove: () => void }) => {
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => {
      const key = String(d[config.categoryCol] ?? 'Unknown');
      const val = typeof d[config.valueCol] === 'number'
        ? d[config.valueCol]
        : Number(String(d[config.valueCol]).replace(/[,$%€£\s]/g, '')) || 0;
      map.set(key, (map.get(key) || 0) + val);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data, config]);

  const option = {
    color: COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        return `<strong>${params.name}</strong><br/>${params.value.toLocaleString()} (${params.percent}%)`;
      }
    },
    series: [{
      type: 'pie',
      radius: ['30%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: 'rgba(15, 23, 42, 0.7)', borderWidth: 2 },
      label: {
        show: true,
        formatter: '{b} {d}%',
        fontSize: 10,
        color: '#94a3b8'
      },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#f8fafc' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
      },
      data: chartData
    }]
  };

  return (
    <div className={`${styles.chartCard} glass-panel animate-fade-in`}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>{config.title}</h3>
        <button className={styles.removeBtn} onClick={onRemove} title="Remove chart">
          <X size={16} />
        </button>
      </div>
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};

const AddChartModal = ({ onClose }: { onClose: () => void }) => {
  const { schema, addChart } = useDashboard();
  const [catCol, setCatCol] = useState('');
  const [valCol, setValCol] = useState('');

  if (!schema) return null;

  const allGroupCols = [...schema.categoricalCols, ...schema.dateCols];

  const handleAdd = () => {
    if (catCol && valCol) {
      addChart(catCol, valCol);
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>Add New Chart</h2>
        <div className={styles.formGroup}>
          <label>Group By (Category)</label>
          <select value={catCol} onChange={e => setCatCol(e.target.value)}>
            <option value="">Select column...</option>
            {allGroupCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>Value (Numeric)</label>
          <select value={valCol} onChange={e => setValCol(e.target.value)}>
            <option value="">Select column...</option>
            {schema.numericCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.addBtn} onClick={handleAdd} disabled={!catCol || !valCol}>Add Chart</button>
        </div>
      </div>
    </div>
  );
};

export const Charts = () => {
  const { filteredData, chartConfigs, removeChart } = useDashboard();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className={styles.chartsGrid}>
        {chartConfigs.map(config => (
          <PieChart
            key={config.id}
            config={config}
            data={filteredData}
            onRemove={() => removeChart(config.id)}
          />
        ))}
        <button className={styles.addChartCard} onClick={() => setShowModal(true)}>
          <Plus size={32} />
          <span>Add Chart</span>
        </button>
      </div>
      {showModal && <AddChartModal onClose={() => setShowModal(false)} />}
    </>
  );
};
