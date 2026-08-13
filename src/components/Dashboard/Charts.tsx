"use client";

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard } from '@/context/DashboardContext';
import styles from './Charts.module.css';

export const Charts = () => {
  const { filteredData, schema } = useDashboard();

  if (!schema || schema.numericCols.length === 0) return null;

  const numCol = schema.numericCols[0];
  const catCol1 = schema.categoricalCols[0];
  const catCol2 = schema.categoricalCols.length > 1 ? schema.categoricalCols[1] : schema.categoricalCols[0];
  const dateCol = schema.dateCols[0];

  const categoryData = useMemo(() => {
    if (!catCol1) return [];
    const map = new Map<string, number>();
    filteredData.forEach(d => {
      const key = String(d[catCol1]);
      map.set(key, (map.get(key) || 0) + (Number(d[numCol]) || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredData, catCol1, numCol]);

  const barData = useMemo(() => {
    if (!catCol2) return { names: [], values: [] };
    const map = new Map<string, number>();
    filteredData.forEach(d => {
      const key = String(d[catCol2]);
      map.set(key, (map.get(key) || 0) + (Number(d[numCol]) || 0));
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return {
      names: sorted.map(d => d[0]),
      values: sorted.map(d => d[1])
    };
  }, [filteredData, catCol2, numCol]);

  const trendData = useMemo(() => {
    if (!dateCol) return { dates: [], values: [] };
    const map = new Map<string, number>();
    filteredData.forEach(d => {
      const key = String(d[dateCol]); // simple grouping by exact date value for now
      map.set(key, (map.get(key) || 0) + (Number(d[numCol]) || 0));
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      dates: sorted.map(d => d[0]),
      values: sorted.map(d => d[1])
    };
  }, [filteredData, dateCol, numCol]);

  const commonOptions = {
    textStyle: { fontFamily: 'var(--font-sans)', color: 'var(--foreground)' },
    tooltip: { trigger: 'item', backgroundColor: 'var(--card)', borderColor: 'var(--border)', textStyle: { color: 'var(--foreground)' } }
  };

  const donutOptions = catCol1 ? {
    ...commonOptions,
    color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
    series: [
      {
        name: numCol,
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: 'var(--card)', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold' }
        },
        labelLine: { show: false },
        data: categoryData
      }
    ]
  } : null;

  const barOptions = catCol2 ? {
    ...commonOptions,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--border)' } } },
    yAxis: { type: 'category', data: barData.names, axisLine: { lineStyle: { color: 'var(--border)' } } },
    series: [
      {
        name: numCol,
        type: 'bar',
        data: barData.values,
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [0, 4, 4, 0]
        }
      }
    ]
  } : null;

  const lineOptions = dateCol ? {
    ...commonOptions,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trendData.dates, axisLine: { lineStyle: { color: 'var(--border)' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'var(--border)' } } },
    series: [
      {
        name: numCol,
        type: 'line',
        data: trendData.values,
        smooth: true,
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.5)' }, { offset: 1, color: 'rgba(59,130,246,0)' }]
          }
        },
        lineStyle: { width: 3, color: '#3b82f6' }
      }
    ]
  } : null;

  return (
    <div className={styles.chartsGrid}>
      {donutOptions && (
        <div className={`${styles.chartCard} glass-panel animate-fade-in delay-100`}>
          <h3 className={styles.chartTitle}>{numCol} by {catCol1}</h3>
          <ReactECharts option={donutOptions} style={{ height: '100%', width: '100%' }} />
        </div>
      )}
      {barOptions && (
        <div className={`${styles.chartCard} glass-panel animate-fade-in delay-200`}>
          <h3 className={styles.chartTitle}>{numCol} by {catCol2}</h3>
          <ReactECharts option={barOptions} style={{ height: '100%', width: '100%' }} />
        </div>
      )}
      {lineOptions && (
        <div className={`${styles.chartCard} ${styles.fullWidth} glass-panel animate-fade-in delay-300`}>
          <h3 className={styles.chartTitle}>{numCol} Trend over {dateCol}</h3>
          <ReactECharts option={lineOptions} style={{ height: '100%', width: '100%' }} />
        </div>
      )}
    </div>
  );
};
