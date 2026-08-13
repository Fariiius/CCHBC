"use client";

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, SheetAnalysis } from '@/context/DashboardContext';
import { X, Plus, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';

const COLORS = ['#1a73e8','#34a853','#fbbc04','#ea4335','#9c27b0','#00bcd4','#ff7043','#607d8b','#43a047','#e91e63','#ff9800','#795548','#3f51b5','#009688','#8bc34a'];

const fmt = (v: number): string => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

// ── Sidebar ─────────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const { sheets, masterFilters, toggleFilter, resetFilters, activeSheet, addKpi, addChart } = useDashboard();
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [showAddChart, setShowAddChart] = useState(false);

  const filterableCols = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const sheetsToUse = activeSheet === 'Master Summary' ? sheets : sheets.filter(s => s.name === activeSheet);
    sheetsToUse.forEach(sheet => {
      [...sheet.categoricalCols, ...sheet.dateCols].forEach(col => {
        const unique = new Set(sheet.records.map(r => String(r[col] ?? '')).filter(v => v && v !== 'undefined' && v !== 'null'));
        if (unique.size >= 2 && unique.size <= 25) {
          if (!map.has(col)) map.set(col, new Set());
          unique.forEach(v => map.get(col)!.add(v));
        }
      });
    });
    return Array.from(map.entries())
      .filter(([_, s]) => s.size >= 2 && s.size <= 25)
      .map(([col, s]) => ({ col, values: Array.from(s).sort() }))
      .slice(0, 6);
  }, [sheets, activeSheet]);

  const hasActive = Object.values(masterFilters).some(v => v.length > 0);

  // Determine the target sheet for adding KPI/Chart
  const targetSheet = activeSheet === 'Master Summary' ? sheets[0] : sheets.find(s => s.name === activeSheet);

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: 'var(--surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', height: '100%', overflow: 'hidden'
    }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Filters
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {filterableCols.map(({ col, values }) => {
          const active = masterFilters[col] || [];
          return (
            <FilterGroup key={col} label={col} values={values} activeVals={active}
              onToggle={(val) => toggleFilter(col, val)} />
          );
        })}
        {filterableCols.length === 0 && (
          <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--foreground-muted)', textAlign: 'center' }}>
            No filterable columns detected
          </div>
        )}
      </div>

      <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {hasActive && (
          <button onClick={resetFilters} style={{
            width: '100%', padding: '0.35rem', borderRadius: 6, fontSize: '0.7rem',
            fontWeight: 600, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5'
          }}>
            ✕ Reset Filters
          </button>
        )}
        {targetSheet && (
          <>
            <button onClick={() => setShowAddKpi(true)} style={{
              width: '100%', padding: '0.35rem', borderRadius: 6, fontSize: '0.7rem',
              fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}>
              <Plus size={12} /> Add KPI
            </button>
            <button onClick={() => setShowAddChart(true)} style={{
              width: '100%', padding: '0.35rem', borderRadius: 6, fontSize: '0.7rem',
              fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}>
              <Plus size={12} /> Add Chart
            </button>
          </>
        )}
      </div>

      {showAddKpi && targetSheet && <AddKpiModal sheet={targetSheet} onClose={() => setShowAddKpi(false)} />}
      {showAddChart && targetSheet && <AddChartModal sheet={targetSheet} onClose={() => setShowAddChart(false)} />}
    </aside>
  );
};

const FilterGroup = ({ label, values, activeVals, onToggle }: {
  label: string; values: string[]; activeVals: string[]; onToggle: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const hasActive = activeVals.length > 0;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 600,
        color: hasActive ? 'var(--primary)' : 'var(--foreground)',
        textAlign: 'left'
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
          {label} {hasActive && `(${activeVals.length})`}
        </span>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ padding: '0 0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150, overflowY: 'auto' }}>
          {values.map(val => (
            <label key={val} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.7rem', color: 'var(--foreground)', cursor: 'pointer',
              padding: '0.2rem 0.25rem', borderRadius: 4,
            }}>
              <input type="checkbox" checked={activeVals.includes(val)} onChange={() => onToggle(val)}
                style={{ accentColor: 'var(--primary)', width: 13, height: 13 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Modals ───────────────────────────────────────────────────────────────────

const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '1.5rem', width: 360, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
      {children}
    </div>
  </div>
);

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.65rem', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--foreground)', fontSize: '0.8rem', outline: 'none'
};

const AddKpiModal = ({ sheet, onClose }: { sheet: SheetAnalysis; onClose: () => void }) => {
  const { addKpi, sheets } = useDashboard();
  const [sheetName, setSheetName] = useState(sheet.name);
  const [col, setCol] = useState('');
  const sel = sheets.find(s => s.name === sheetName) || sheet;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Add KPI Card</div>
      {sheets.length > 1 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 4 }}>Table</label>
          <select value={sheetName} onChange={e => { setSheetName(e.target.value); setCol(''); }} style={selectStyle}>
            {sheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 4 }}>Value to Sum</label>
        <select value={col} onChange={e => setCol(e.target.value)} style={selectStyle}>
          <option value="">Select column...</option>
          {sel.numericCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.55rem', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.8rem' }}>Cancel</button>
        <button disabled={!col} onClick={() => { addKpi(sheetName, col); onClose(); }} style={{ flex: 1, padding: '0.55rem', borderRadius: 6, background: col ? 'var(--primary)' : '#e2e8f0', color: col ? 'white' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: col ? 'pointer' : 'not-allowed' }}>Add</button>
      </div>
    </ModalOverlay>
  );
};

const AddChartModal = ({ sheet, onClose }: { sheet: SheetAnalysis; onClose: () => void }) => {
  const { addChart, sheets } = useDashboard();
  const [sheetName, setSheetName] = useState(sheet.name);
  const [catCol, setCatCol] = useState('');
  const [valCol, setValCol] = useState('');
  const sel = sheets.find(s => s.name === sheetName) || sheet;

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Add Chart</div>
      {sheets.length > 1 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 4 }}>Table</label>
          <select value={sheetName} onChange={e => { setSheetName(e.target.value); setCatCol(''); setValCol(''); }} style={selectStyle}>
            {sheets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 4 }}>Group By</label>
        <select value={catCol} onChange={e => setCatCol(e.target.value)} style={selectStyle}>
          <option value="">Select column...</option>
          {[...sel.categoricalCols, ...sel.dateCols].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)', marginBottom: 4 }}>Value</label>
        <select value={valCol} onChange={e => setValCol(e.target.value)} style={selectStyle}>
          <option value="">Select column...</option>
          {sel.numericCols.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.55rem', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.8rem' }}>Cancel</button>
        <button disabled={!catCol || !valCol} onClick={() => { addChart(sheetName, catCol, valCol); onClose(); }} style={{ flex: 1, padding: '0.55rem', borderRadius: 6, background: catCol && valCol ? 'var(--primary)' : '#e2e8f0', color: catCol && valCol ? 'white' : 'var(--foreground-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: catCol && valCol ? 'pointer' : 'not-allowed' }}>Add</button>
      </div>
    </ModalOverlay>
  );
};

// ── KPI Card ────────────────────────────────────────────────────────────────

const KPICard = ({ label, value, index, onRemove }: { label: string; value: number; index: number; onRemove: () => void }) => {
  const color = COLORS[index % COLORS.length];
  const [hovered, setHovered] = useState(false);

  return (
    <div onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      padding: '0.6rem 0.85rem', borderLeft: `3px solid ${color}`, position: 'relative',
      boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)', transition: 'box-shadow 0.15s',
      minWidth: 0,
    }}>
      <button onClick={onRemove} style={{
        position: 'absolute', top: 4, right: 4, opacity: hovered ? 1 : 0,
        padding: 2, borderRadius: 4, transition: 'opacity 0.1s', color: '#94a3b8'
      }}>
        <X size={10} />
      </button>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: value < 0 ? '#dc2626' : 'var(--foreground)', letterSpacing: '-0.02em' }}>
        {fmt(value)}
      </div>
    </div>
  );
};

// ── Pie Chart ───────────────────────────────────────────────────────────────

const PieChart = ({ title, data, onRemove }: {
  title: string; data: { name: string; value: number }[]; onRemove: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const chartData = data.map((d, i) => ({ name: d.name, value: Math.abs(d.value), itemStyle: { color: COLORS[i % COLORS.length] } }));

  const option = {
    tooltip: {
      trigger: 'item', backgroundColor: 'white', borderColor: '#e2e8f0', borderWidth: 1,
      textStyle: { color: '#1a1d23', fontSize: 11 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1);border-radius:6px;',
      formatter: (p: any) => `<b>${p.name}</b><br/>${fmt(p.value)} (${p.percent}%)`
    },
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'center', icon: 'circle', itemWidth: 6, itemHeight: 6, textStyle: { fontSize: 10, color: '#64748b' }, formatter: (n: string) => n.length > 14 ? n.slice(0, 14) + '…' : n },
    series: [{ type: 'pie', radius: ['38%', '70%'], center: ['35%', '50%'], itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: '#fff' }, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.1)' }, label: { show: false } }, data: chartData }]
  };

  return (
    <div onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)} style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
      padding: '0.75rem', boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transition: 'box-shadow 0.15s', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>{title}</div>
        <button onClick={onRemove} style={{ opacity: hovered ? 1 : 0, padding: 2, borderRadius: 4, transition: 'opacity 0.1s', color: '#94a3b8' }}>
          <X size={10} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};

// ── Dashboard Content ───────────────────────────────────────────────────────

const SheetContent = ({ sheet }: { sheet: SheetAnalysis }) => {
  const { kpiConfigs, removeKpi, chartConfigs, removeChart, getFilteredRecords } = useDashboard();
  const filtered = getFilteredRecords(sheet.name);

  const sheetKpis = kpiConfigs.filter(k => k.sheetName === sheet.name);
  const kpiValues = useMemo(() => sheetKpis.map(k => {
    const total = filtered.reduce((s, r) => {
      const v = r[k.col]; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, '')); return s + (isFinite(n) ? n : 0);
    }, 0);
    return { id: k.id, label: k.col, value: total };
  }), [filtered, sheetKpis]);

  const sheetCharts = chartConfigs.filter(c => c.sheetName === sheet.name);

  const getChartData = (config: { categoryCol: string; valueCol: string }) => {
    const map = new Map<string, number>();
    filtered.forEach(r => {
      const key = String(r[config.categoryCol] ?? '').trim();
      if (!key || key === 'undefined') return;
      const v = r[config.valueCol]; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, ''));
      map.set(key, (map.get(key) || 0) + (isFinite(n) ? n : 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
  };

  const chartCount = sheetCharts.length;
  // Calculate grid based on count: 1=1x1, 2=2x1, 3=3x1, 4=2x2, 5-6=3x2, etc.
  const cols = chartCount <= 1 ? 1 : chartCount <= 2 ? 2 : chartCount <= 3 ? 3 : chartCount <= 4 ? 2 : 3;

  return (
    <>
      {/* KPI Row */}
      {kpiValues.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpiValues.length, 6)}, 1fr)`,
          gap: '0.5rem', flexShrink: 0, marginBottom: '0.5rem',
        }}>
          {kpiValues.map((k, i) => (
            <KPICard key={k.id} label={k.label} value={k.value} index={i} onRemove={() => removeKpi(k.id)} />
          ))}
        </div>
      )}

      {/* Charts Grid */}
      {chartCount > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '0.5rem', flex: 1, minHeight: 0,
        }}>
          {sheetCharts.map(c => (
            <PieChart key={c.id} title={c.title} data={getChartData(c)} onRemove={() => removeChart(c.id)} />
          ))}
        </div>
      )}
    </>
  );
};

// ── Main Dashboard View ─────────────────────────────────────────────────────

export const DashboardView = () => {
  const { sheets, activeSheet } = useDashboard();

  if (activeSheet === 'Master Summary') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem', overflow: 'hidden', minHeight: 0 }}>
        {sheets.map((sheet, si) => (
          <div key={sheet.name} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginBottom: si < sheets.length - 1 ? '0.5rem' : 0 }}>
            {sheets.length > 1 && (
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {sheet.name}
              </div>
            )}
            <SheetContent sheet={sheet} />
          </div>
        ))}
      </div>
    );
  }

  const current = sheets.find(s => s.name === activeSheet);
  if (!current) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem', overflow: 'hidden', minHeight: 0 }}>
      <SheetContent sheet={current} />
    </div>
  );
};
