"use client";

import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, SheetAnalysis } from '@/context/DashboardContext';
import { X, Plus } from 'lucide-react';

const COLORS = ['#1a73e8','#34a853','#fbbc04','#ea4335','#9c27b0','#00bcd4','#ff7043','#607d8b','#43a047','#e91e63','#ff9800','#795548','#3f51b5','#009688','#8bc34a'];

const fmt = (v: number, isPercent = false): string => {
  if (isPercent) return v.toFixed(1) + '%';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

// ── Filter Pills Bar (Power BI style) ───────────────────────────────────────

export const FilterBar = () => {
  const { workspaces, activeWorkspaceId, toggleFilter, resetFilters } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);

  const filterableCols = useMemo(() => {
    if (!ws) return [];
    const map = new Map<string, Set<string>>();
    ws.sheets.forEach(sheet => {
      [...sheet.categoricalCols, ...sheet.dateCols].forEach(col => {
        const vals = new Set(sheet.records.map(r => String(r[col] ?? '')).filter(v => v && v !== 'undefined' && v !== 'null' && !v.toLowerCase().includes('total')));
        if (vals.size >= 2 && vals.size <= 20) {
          if (!map.has(col)) map.set(col, new Set());
          vals.forEach(v => map.get(col)!.add(v));
        }
      });
    });
    return Array.from(map.entries())
      .filter(([_, s]) => s.size >= 2 && s.size <= 20)
      .map(([col, s]) => ({ col, values: Array.from(s).sort() }))
      .slice(0, 5);
  }, [ws]);

  if (!ws || filterableCols.length === 0) return null;

  const hasActive = Object.values(ws.masterFilters).some(v => v.length > 0);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center',
      padding: '0.4rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0, minHeight: 0,
    }}>
      {filterableCols.map(({ col, values }) => {
        const active = ws.masterFilters[col] || [];
        return values.map(val => (
          <button key={`${col}-${val}`} onClick={() => toggleFilter(col, val)} style={{
            padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.68rem',
            fontWeight: active.includes(val) ? 700 : 500,
            background: active.includes(val) ? 'var(--primary)' : '#e8eaed',
            color: active.includes(val) ? 'white' : '#3c4043',
            border: 'none', cursor: 'pointer', transition: 'all 0.1s',
          }}>
            {val}
          </button>
        ));
      })}
      {hasActive && (
        <button onClick={resetFilters} style={{
          padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem',
          fontWeight: 600, background: '#fce8e6', color: '#d93025', border: 'none', cursor: 'pointer',
        }}>✕ Clear</button>
      )}
    </div>
  );
};

// ── KPI Card (Power BI style) ───────────────────────────────────────────────

const KPICard = ({ label, value, onRemove, isPercent = false }: { label: string; value: number; onRemove?: () => void; isPercent?: boolean }) => {
  const [h, setH] = useState(false);
  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{
      background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 6,
      padding: '0.65rem 1rem', position: 'relative', flex: 1, minWidth: 0,
      textAlign: 'center',
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: 'absolute', top: 3, right: 3, opacity: h ? 1 : 0, padding: 2,
          borderRadius: 4, transition: 'opacity 0.1s', color: '#94a3b8',
        }}><X size={10} /></button>
      )}
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: value < 0 && !isPercent ? '#d93025' : 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {fmt(value, isPercent)}
      </div>
      <div style={{ fontSize: '0.62rem', color: '#5f6368', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
    </div>
  );
};

// ── Charts ──────────────────────────────────────────────────────────────────

const GenericChart = ({ title, data, globalTotal, type, onRemove, size }: {
  title: string; data: { name: string; value: number }[]; globalTotal: number; type: 'pie' | 'bar' | 'line'; onRemove: () => void; size: 'sm' | 'lg';
}) => {
  const [h, setH] = useState(false);
  const chartData = data.map((d, i) => ({ name: d.name, value: Math.abs(d.value), itemStyle: { color: COLORS[i % COLORS.length] } }));
  const denominator = globalTotal > 0 ? globalTotal : 1;

  let option: any = {};

  if (type === 'pie') {
    option = {
      tooltip: {
        trigger: 'item', backgroundColor: 'white', borderColor: '#e8eaed', borderWidth: 1,
        textStyle: { color: '#1a1d23', fontSize: 11 },
        formatter: (p: any) => {
          const pct = ((p.value / denominator) * 100).toFixed(0);
          return `<b>${p.name}</b><br/>${fmt(p.value)} (${pct}%)`;
        }
      },
      series: [{
        type: 'pie',
        radius: size === 'sm' ? ['35%', '65%'] : ['30%', '60%'],
        center: ['50%', '50%'],
        itemStyle: { borderRadius: 2, borderWidth: 1.5, borderColor: '#fff' },
        label: {
          show: true, position: 'outside', fontSize: size === 'sm' ? 9 : 10, color: '#5f6368',
          formatter: (p: any) => {
            const pct = ((p.value / denominator) * 100).toFixed(0);
            return `${p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name} ${pct}%`;
          },
        },
        labelLine: { length: 8, length2: 6, lineStyle: { color: '#dadce0' } },
        data: chartData
      }]
    };
  } else {
    option = {
      tooltip: {
        trigger: 'axis', backgroundColor: 'white', borderColor: '#e8eaed', borderWidth: 1,
        textStyle: { color: '#1a1d23', fontSize: 11 },
        formatter: (p: any) => `<b>${p[0].name}</b><br/>${fmt(p[0].value)}`
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: chartData.map(d => d.name), axisLabel: { fontSize: 9, color: '#5f6368', interval: 0, width: 60, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#dadce0' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, color: '#5f6368', formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f3f4' } } },
      series: [{
        data: chartData.map(d => d.value),
        type,
        smooth: type === 'line',
        itemStyle: { color: 'var(--primary)' },
        areaStyle: type === 'line' ? { color: 'rgba(26, 115, 232, 0.1)' } : undefined,
        barMaxWidth: 40
      }]
    };
  }

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{
      background: 'var(--surface)', border: '1px solid #e8eaed', borderRadius: 6,
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, marginBottom: 2 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {title}
        </div>
        <button onClick={onRemove} style={{ opacity: h ? 1 : 0, padding: 2, borderRadius: 4, transition: 'opacity 0.1s', color: '#94a3b8', flexShrink: 0 }}>
          <X size={10} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};

// ── Add Modals ──────────────────────────────────────────────────────────────

const Overlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', width: 340, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
      {children}
    </div>
  </div>
);

const sel: React.CSSProperties = { width: '100%', padding: '0.5rem', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 6, fontSize: '0.8rem', outline: 'none', color: '#202124' };

const AddKpiModal = ({ onClose }: { onClose: () => void }) => {
  const { workspaces, activeWorkspaceId, addKpi } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];
  
  const [sn, setSn] = useState(sheets[0]?.name || '');
  const [col, setCol] = useState('');
  const s = sheets.find(x => x.name === sn) || sheets[0];
  
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Add KPI Card</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCol(''); }} style={sel}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Value to Sum</label><select value={col} onChange={e => setCol(e.target.value)} style={sel}><option value="">Select column...</option>{s?.numericCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed' }}>Cancel</button>
        <button disabled={!col} onClick={() => { addKpi(sn, col); onClose(); }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: col ? 'var(--primary)' : '#e8eaed', color: col ? 'white' : '#80868b', fontWeight: 600, fontSize: '0.8rem' }}>Add</button>
      </div>
    </Overlay>
  );
};

const AddChartModal = ({ onClose }: { onClose: () => void }) => {
  const { workspaces, activeWorkspaceId, addChart } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];

  const [sn, setSn] = useState(sheets[0]?.name || '');
  const [cat, setCat] = useState('');
  const [val, setVal] = useState('');
  const [type, setType] = useState<'pie'|'bar'|'line'>('pie');
  const s = sheets.find(x => x.name === sn) || sheets[0];

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Add Chart</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCat(''); setVal(''); }} style={sel}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Group By</label><select value={cat} onChange={e => setCat(e.target.value)} style={sel}><option value="">Select...</option>{s && [...s.categoricalCols, ...s.dateCols].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Value</label><select value={val} onChange={e => setVal(e.target.value)} style={sel}><option value="">Select...</option>{s?.numericCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Chart Type</label><select value={type} onChange={e => setType(e.target.value as any)} style={sel}><option value="pie">Pie Chart</option><option value="bar">Bar (Column) Chart</option><option value="line">Line Chart</option></select></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed' }}>Cancel</button>
        <button disabled={!cat || !val} onClick={() => { addChart(sn, cat, val, type); onClose(); }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: cat && val ? 'var(--primary)' : '#e8eaed', color: cat && val ? 'white' : '#80868b', fontWeight: 600, fontSize: '0.8rem' }}>Add</button>
      </div>
    </Overlay>
  );
};

// ── Main Dashboard View (Summary Only) ──────────────────────────────────────

export const DashboardView = () => {
  const { workspaces, activeWorkspaceId, removeKpi, removeChart, getFilteredRecords } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);

  if (!ws) return null;

  // Collect all KPIs across all sheets
  let totalSpend = 0;
  let totalSaving = 0;

  const allKpis = useMemo(() => {
    return ws.sheets.flatMap(sheet => {
      const filtered = getFilteredRecords(sheet.name);
      return ws.kpiConfigs.filter(k => k.sheetName === sheet.name).map(k => {
        const total = filtered.reduce((s, r) => {
          const v = r[k.col]; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, '')); return s + (isFinite(n) ? n : 0);
        }, 0);

        let label = `Sum of ${k.col}`;
        const lcol = k.col.toLowerCase();
        
        if (lcol.includes('spend')) {
          label = 'Sum YTD Spend';
          totalSpend += total;
        } else if (lcol.includes('saving')) {
          label = 'Sum YTD Saving';
          totalSaving += total;
        }

        return { id: k.id, label, value: total };
      });
    });
  }, [ws, getFilteredRecords]);

  const savingVsSpendingPct = (totalSpend !== 0 && totalSaving !== 0) ? Math.abs((totalSaving / totalSpend) * 100) : null;

  // Collect all charts across all sheets
  const allCharts = useMemo(() => {
    return ws.sheets.flatMap(sheet => {
      const filtered = getFilteredRecords(sheet.name);
      const unfiltered = sheet.records; 

      return ws.chartConfigs.filter(c => c.sheetName === sheet.name).map(c => {
        let globalTotal = 0;
        unfiltered.forEach(r => {
          const key = String(r[c.categoryCol] ?? '').trim();
          if (!key || key === 'undefined' || key.toLowerCase().includes('total')) return;
          const v = r[c.valueCol]; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, ''));
          if (isFinite(n)) globalTotal += Math.abs(n);
        });

        const map = new Map<string, number>();
        filtered.forEach(r => {
          const key = String(r[c.categoryCol] ?? '').trim();
          if (!key || key === 'undefined' || key.toLowerCase().includes('total')) return;
          const v = r[c.valueCol]; const n = typeof v === 'number' ? v : Number(String(v).replace(/[,$%€£\s]/g, ''));
          map.set(key, (map.get(key) || 0) + (isFinite(n) ? n : 0));
        });

        const data = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
        return { id: c.id, title: c.title, type: c.type, data, globalTotal };
      });
    });
  }, [ws, getFilteredRecords]);

  const smallCharts = allCharts.slice(0, 2);
  const largeCharts = allCharts.slice(2, 5);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, padding: '0.6rem 1rem', gap: '0.5rem' }}>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'stretch' }}>
        {allKpis.slice(0, 3).map(k => (
          <KPICard key={k.id} label={k.label} value={k.value} onRemove={() => removeKpi(k.id)} />
        ))}
        {savingVsSpendingPct !== null && (
          <KPICard label="Saving vs Spending %" value={savingVsSpendingPct} isPercent={true} />
        )}
        {(allKpis.length + (savingVsSpendingPct !== null ? 1 : 0)) < 4 && (
          <button onClick={() => setShowKpiModal(true)} style={{
            background: '#f1f3f4', border: '1px dashed #dadce0', borderRadius: 6,
            padding: '0.5rem 0.75rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--primary)',
            display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
          }}>
            <Plus size={11} /> KPI
          </button>
        )}
      </div>

      {/* Chart Row 1: Small charts */}
      {smallCharts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minHeight: 0 }}>
          {smallCharts.map(c => (
            <div key={c.id} style={{ flex: 1, minHeight: 0 }}>
              <GenericChart title={c.title} data={c.data} globalTotal={c.globalTotal} type={c.type} onRemove={() => removeChart(c.id)} size="sm" />
            </div>
          ))}
        </div>
      )}

      {/* Chart Row 2: Large charts */}
      {largeCharts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1.2, minHeight: 0 }}>
          {largeCharts.map(c => (
            <div key={c.id} style={{ flex: 1, minHeight: 0 }}>
              <GenericChart title={c.title} data={c.data} globalTotal={c.globalTotal} type={c.type} onRemove={() => removeChart(c.id)} size="lg" />
            </div>
          ))}
        </div>
      )}

      {/* Add chart button if few charts */}
      {allCharts.length < 5 && (
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowChartModal(true)} style={{
            background: '#f1f3f4', border: '1px dashed #dadce0', borderRadius: 6,
            padding: '0.3rem 0.7rem', fontSize: '0.65rem', fontWeight: 600, color: 'var(--primary)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Plus size={11} /> Add Chart
          </button>
        </div>
      )}

      {showKpiModal && <AddKpiModal onClose={() => setShowKpiModal(false)} />}
      {showChartModal && <AddChartModal onClose={() => setShowChartModal(false)} />}
    </div>
  );
};
