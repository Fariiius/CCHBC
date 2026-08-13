"use client";

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, SheetAnalysis } from '@/context/DashboardContext';
import { X, Plus, TrendingUp, TrendingDown } from 'lucide-react';

const CHART_COLORS = [
  '#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9c27b0',
  '#00bcd4', '#ff7043', '#607d8b', '#43a047', '#e91e63',
  '#ff9800', '#795548', '#3f51b5', '#009688', '#8bc34a'
];

const formatNumber = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

// ─── KPI Cards ───────────────────────────────────────────────────────────────

const KPICard = ({ label, value, index }: { label: string; value: number; index: number }) => {
  const colors = ['#1a73e8', '#34a853', '#9c27b0', '#ea4335', '#ff9800', '#00bcd4'];
  const color = colors[index % colors.length];
  const isNeg = value < 0;

  return (
    <div
      className="animate-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem 1.5rem',
        boxShadow: 'var(--shadow-sm)',
        borderTop: `3px solid ${color}`,
        transition: 'box-shadow 0.2s, transform 0.2s',
        cursor: 'default'
      }}
        onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Sum of {label}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: isNeg ? '#dc2626' : 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {formatNumber(value)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
          {isNeg
            ? <TrendingDown size={14} color="#dc2626" />
            : <TrendingUp size={14} color={color} />
          }
          <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>total</span>
        </div>
      </div>
    </div>
  );
};

// ─── Pie Chart Card ──────────────────────────────────────────────────────────

const PieChartCard = ({
  title, data, onRemove, index
}: {
  title: string;
  data: { name: string; value: number; pct: number }[];
  onRemove: () => void;
  index: number;
}) => {
  const [hovered, setHovered] = useState(false);

  const chartData = data.map((d, i) => ({
    name: d.name,
    value: Math.abs(d.value),
    itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
  }));

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'white',
      borderColor: 'var(--border)',
      borderWidth: 1,
      textStyle: { color: '#1a1d23', fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.12); border-radius:8px;',
      formatter: (p: any) =>
        `<div style="font-weight:600;margin-bottom:2px">${p.name}</div><div style="color:#64748b">${formatNumber(p.value)} (${p.percent}%)</div>`
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 0,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#64748b' },
      formatter: (name: string) => name.length > 18 ? name.slice(0, 18) + '…' : name
    },
    series: [{
      type: 'pie',
      radius: ['40%', '72%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
        label: { show: false }
      },
      data: chartData
    }]
  };

  return (
    <div
      className="animate-in"
      style={{ animationDelay: `${index * 80}ms` }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        height: 340
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{title}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: 2 }}>{data.length} categories</div>
          </div>
          <button
            onClick={onRemove}
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
              padding: '0.2rem',
              borderRadius: 6,
              color: 'var(--foreground-muted)',
              background: 'transparent'
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#dc2626')}
            onMouseOut={e => (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'var(--foreground-muted)')}
          >
            <X size={14} />
          </button>
        </div>
        <ReactECharts option={option} style={{ height: 270 }} />
      </div>
    </div>
  );
};

// ─── Add Chart Modal ─────────────────────────────────────────────────────────

const AddChartModal = ({ sheet, onClose }: { sheet: SheetAnalysis, onClose: () => void }) => {
  const { addChart } = useDashboard();
  const [catCol, setCatCol] = useState('');
  const [valCol, setValCol] = useState('');

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.75rem',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--foreground)', fontSize: '0.875rem', outline: 'none'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '2rem',
        width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '1.5rem' }}>
          Add Chart to {sheet.name}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>Group By</label>
          <select value={catCol} onChange={e => setCatCol(e.target.value)} style={selectStyle}>
            <option value="">Select column...</option>
            {[...sheet.categoricalCols, ...sheet.dateCols].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>Value (Numeric)</label>
          <select value={valCol} onChange={e => setValCol(e.target.value)} style={selectStyle}>
            <option value="">Select column...</option>
            {sheet.numericCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.7rem', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>
            Cancel
          </button>
          <button
            disabled={!catCol || !valCol}
            onClick={() => { addChart(sheet.name, catCol, valCol); onClose(); }}
            style={{
              flex: 1, padding: '0.7rem', borderRadius: 8, background: !catCol || !valCol ? '#e2e8f0' : 'var(--primary)',
              color: !catCol || !valCol ? 'var(--foreground-muted)' : 'white',
              fontWeight: 600, fontSize: '0.875rem', cursor: !catCol || !valCol ? 'not-allowed' : 'pointer'
            }}
          >
            Add Chart
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sheet Section ────────────────────────────────────────────────────────────

const SheetSection = ({ sheet }: { sheet: SheetAnalysis }) => {
  const { chartConfigs, removeChart, getFilteredRecords } = useDashboard();
  const filteredRecords = getFilteredRecords(sheet.name);
  const [showAddModal, setShowAddModal] = useState(false);

  // Recalculate KPIs with filtered data
  const filteredKPIs = useMemo(() => {
    return sheet.kpis.map(kpi => {
      const total = filteredRecords.reduce((s, r) => {
        const v = r[kpi.col];
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, ''));
        return s + (isFinite(n) ? n : 0);
      }, 0);
      return { label: kpi.col, value: total, col: kpi.col };
    });
  }, [filteredRecords, sheet.kpis]);

  // Recalculate chart data with filtered records
  const sheetCharts = chartConfigs.filter(c => c.sheetName === sheet.name);

  const getChartData = (config: { categoryCol: string; valueCol: string }) => {
    const map = new Map<string, number>();
    filteredRecords.forEach(r => {
      const key = String(r[config.categoryCol] ?? 'Other').trim();
      if (!key || key === 'undefined') return;
      const v = r[config.valueCol];
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, ''));
      map.set(key, (map.get(key) || 0) + (isFinite(n) ? n : 0));
    });
    const total = Array.from(map.values()).reduce((a, b) => a + Math.abs(b), 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.abs(value / total) * 100 : 0 }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 15);
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.45rem 1rem',
            background: 'var(--surface)',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            fontWeight: 600, fontSize: '0.8rem',
            color: 'var(--primary)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          <Plus size={14} /> Add Chart
        </button>
      </div>

      {/* KPIs */}
      {filteredKPIs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {filteredKPIs.map((kpi, i) => (
            <KPICard key={kpi.col} label={kpi.label} value={kpi.value} index={i} />
          ))}
        </div>
      )}

      {/* Charts grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '1.25rem'
      }}>
        {sheetCharts.map((config, i) => (
          <PieChartCard
            key={config.id}
            title={config.title}
            data={getChartData(config)}
            onRemove={() => removeChart(config.id)}
            index={i}
          />
        ))}
      </div>

      {showAddModal && <AddChartModal sheet={sheet} onClose={() => setShowAddModal(false)} />}
    </section>
  );
};

// ─── Main Charts / Dashboard View ────────────────────────────────────────────

export const DashboardView = () => {
  const { sheets, activeSheet } = useDashboard();
  
  const currentSheet = sheets.find(s => s.name === activeSheet);

  if (!currentSheet) return null;

  return (
    <main style={{ padding: '1.5rem 2rem', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
      <SheetSection sheet={currentSheet} />
    </main>
  );
};
