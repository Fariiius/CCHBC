"use client";

import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, SheetAnalysis, ChartConfig, KpiConfig, DataRecord, Workspace, ChartSeries } from '@/context/DashboardContext';
import { X, Plus, GripHorizontal, Edit2, Download, Trash, Trash2, Sparkles } from 'lucide-react';
import { CopilotSidebar } from '@/components/Dashboard/CopilotSidebar';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#F40009', '#111111', '#555555', '#999999', '#D90008', '#B00006', '#E5E7EB', '#374151', '#9CA3AF', '#FCA5A5'];

const fmt = (v: number, isPercent = false): string => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  if (isPercent) return (v * 100).toFixed(1) + '%';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

// ── Filter Pills Bar ────────────────────────────────────────────────────────
export const FilterBar = () => {
  const { workspaces, activeWorkspaceId, toggleFilter, resetFilters, removeCrossFilter, clearCrossFilters } = useDashboard();
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

  if (!ws) return null;

  const hasMasterActive = Object.values(ws.masterFilters).some(v => v.length > 0);
  const hasCrossActive = Object.values(ws.crossFilters || {}).some(v => v.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '0.4rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: 0 }}>
      {filterableCols.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', marginRight: '0.5rem' }}>Global Filters:</span>
          {filterableCols.map(({ col, values }) => {
            const active = ws.masterFilters[col] || [];
            return values.map(val => (
              <button key={`${col}-${val}`} onClick={() => toggleFilter(col, val)} style={{ padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: active.includes(val) ? 700 : 500, background: active.includes(val) ? 'var(--primary)' : '#e8eaed', color: active.includes(val) ? 'white' : '#3c4043', border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}>
                {val}
              </button>
            ));
          })}
          {hasMasterActive && <button onClick={resetFilters} style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: '#fce8e6', color: '#d93025', border: 'none', cursor: 'pointer' }}>✕ Clear</button>}
        </div>
      )}
      {hasCrossActive && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d93025', textTransform: 'uppercase', marginRight: '0.5rem' }}>Cross Filters:</span>
          {Object.entries(ws.crossFilters).map(([col, vals]) => {
            return vals.map(val => (
              <button key={`cross-${col}-${val}`} onClick={() => removeCrossFilter(col, val)} style={{ padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700, background: '#fce8e6', color: '#d93025', border: '1px solid #fad2e1', cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: 4 }}>
                {col}: {val} <X size={10} />
              </button>
            ));
          })}
          <button onClick={clearCrossFilters} style={{ padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: 'transparent', color: '#5f6368', border: 'none', cursor: 'pointer' }}>Clear All</button>
        </div>
      )}
    </div>
  );
};

// ── Components ──────────────────────────────────────────────────────────────
const KPICard = ({ config, fallbackRecords, filters, onEdit }: { config: KpiConfig, fallbackRecords: any[], filters: any[], onEdit: () => void }) => {
  const [value, setValue] = useState<number | null>(null);
  const [h, setH] = useState(false);
  const { removeKpi, openDrillDown, getFilteredRecords } = useDashboard();

  useEffect(() => {
    fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ datasetId: 'mock', tableName: config.sheetName, value: config.col, calcCol: config.calcCol, calcOp: config.calcOp, type: 'kpi', filters, fallbackRecords })
    }).then(r => r.json()).then(data => setValue(data.result)).catch(console.error);
  }, [config, filters, fallbackRecords]);

  let label = config.calcCol && config.calcOp ? `${config.col} ${config.calcOp} ${config.calcCol}` : `Sum of ${config.col}`;

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ background: 'var(--surface)', border: '1px solid #e8eaed', borderRadius: 6, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div className="drag-handle" style={{ padding: '0.25rem', cursor: 'grab', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'center' }}><GripHorizontal size={12} color="#dadce0" /></div>
      <div style={{ position: 'absolute', top: 3, right: 3, opacity: h ? 1 : 0, transition: 'opacity 0.1s', zIndex: 10, display: 'flex', gap: 2 }}>
        <button onClick={onEdit} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeKpi(config.id)} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      <div onDoubleClick={() => openDrillDown(getFilteredRecords(config.sheetName))} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', cursor: 'pointer' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: (value !== null && value < 0) ? '#d93025' : 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value !== null ? fmt(value, config.isPercentage) : '...'}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#5f6368', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
};

const GenericChart = ({ config, ws, filters, onEdit }: { config: ChartConfig, ws: Workspace, filters: any[], onEdit: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [h, setH] = useState(false);
  const { removeChart, addCrossFilter, openDrillDown, getFilteredRecords } = useDashboard();

  const seriesArr = useMemo(() => {
    return config.series && config.series.length > 0 ? config.series : [{ id: 's1', sheetName: config.sheetName!, valueCol: config.valueCol!, calcCol: config.calcCol, calcOp: config.calcOp }];
  }, [config]);

  useEffect(() => {
    Promise.all(seriesArr.map((s, idx) => {
      const sheet = ws.sheets.find(x => x.name === s.sheetName);
      return fetch('/api/query', {
        method: 'POST',
        body: JSON.stringify({ datasetId: 'mock', tableName: s.sheetName, groupBy: config.categoryCol, value: s.valueCol, calcCol: s.calcCol, calcOp: s.calcOp, filters, fallbackRecords: sheet?.records || [] })
      }).then(r => r.json()).then(res => ({ idx, s, agg: res.result || [] }));
    })).then(results => {
      const map = new Map<string, any>();
      results.forEach(res => {
        res.agg.forEach((d: any) => {
          if (!map.has(d.category)) map.set(d.category, { name: d.category });
          map.get(d.category)[`value_${res.idx}`] = d.value;
        });
      });
      let finalData = Array.from(map.values()).slice(0, 15);
      setData(finalData);
    }).catch(console.error);
  }, [config, filters, ws, seriesArr]);

  const onEvents = { click: (params: any) => { addCrossFilter(config.categoryCol, params.name); } };

  let option: any = {};
  if (config.type === 'pie' || config.type === 'doughnut') {
    const s0 = seriesArr[0];
    const total = data.reduce((sum, d) => sum + Math.abs(d.value_0 || 0), 0) || 1;
    option = {
      tooltip: { trigger: 'item', backgroundColor: 'white', borderColor: '#e8eaed', borderWidth: 1, formatter: (p: any) => `<b>${p.name}</b><br/>${fmt(p.value, config.isPercentage)} (${((p.value/total)*100).toFixed(0)}%)` },
      series: [{
        name: s0.valueCol, type: 'pie', radius: config.type === 'doughnut' ? ['40%', '65%'] : '65%', center: ['50%', '50%'],
        itemStyle: { borderRadius: 2, borderWidth: 1.5, borderColor: '#fff' },
        label: { show: true, formatter: (p:any) => `${p.name}: ${fmt(p.value, config.isPercentage)}` },
        data: data.map((d, i) => ({ name: d.name, value: Math.abs(d.value_0 || 0), itemStyle: { color: COLORS[i % COLORS.length] } }))
      }]
    };
  } else {
    option = {
      tooltip: { trigger: 'axis', backgroundColor: 'white', borderColor: '#e8eaed', borderWidth: 1, formatter: (params: any[]) => {
         let s = `<b>${params[0].name}</b><br/>`;
         params.forEach(p => s += `${p.marker} ${p.seriesName}: ${fmt(p.value, config.isPercentage)}<br/>`);
         return s;
      }},
      legend: { show: seriesArr.length > 1, bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: '3%', right: '4%', bottom: seriesArr.length > 1 ? '15%' : '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: 9, width: 60, overflow: 'truncate' } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (v: number) => fmt(v, config.isPercentage) } },
      series: seriesArr.map((s, i) => ({
        name: s.calcCol ? `${s.valueCol} ${s.calcOp} ${s.calcCol}` : s.valueCol,
        type: config.type,
        smooth: config.type === 'line',
        itemStyle: { color: s.color || COLORS[i % COLORS.length] },
        areaStyle: config.type === 'line' ? { color: s.color || COLORS[i % COLORS.length], opacity: 0.1 } : undefined,
        data: data.map(d => d[`value_${i}`] || 0)
      }))
    };
  }

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ background: 'var(--surface)', border: '1px solid #e8eaed', borderRadius: 6, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="drag-handle" style={{ padding: '0.4rem', cursor: 'grab', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.title}</div>
        <GripHorizontal size={12} color="#dadce0" />
      </div>
      <div style={{ position: 'absolute', top: 5, right: 5, opacity: h ? 1 : 0, transition: 'opacity 0.1s', zIndex: 10, display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeChart(config.id)} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '0.5rem', cursor: 'pointer' }}>
        <ReactECharts option={option} onEvents={onEvents} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};

// ── Dashboard View ──────────────────────────────────────────────────────────
export const DashboardView = () => {
  const { workspaces, activeWorkspaceId, updateLayouts, drillDownData } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const [showChartModal, setShowChartModal] = useState<boolean | ChartConfig>(false);
  const [showKpiModal, setShowKpiModal] = useState<boolean | KpiConfig>(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  if (!ws) return null;

  const layoutKpis = ws.kpiConfigs.map(k => ({ i: k.id, x: k.x ?? 0, y: k.y ?? 0, w: k.w ?? 3, h: k.h ?? 2 }));
  const layoutCharts = ws.chartConfigs.map(c => ({ i: c.id, x: c.x ?? 0, y: c.y ?? 2, w: c.w ?? 6, h: c.h ?? 6 }));
  const layouts = { lg: [...layoutKpis, ...layoutCharts] };

  const onLayoutChange = (currentLayout: any[]) => {
    updateLayouts(currentLayout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
  };

  const filtersArr: any[] = [];
  Object.entries(ws.masterFilters).forEach(([col, vals]) => { if (vals.length) filtersArr.push({ column: col, values: vals }); });
  Object.entries(ws.crossFilters).forEach(([col, vals]) => { if (vals.length) filtersArr.push({ column: col, values: vals }); });

  const exportToPDF = async () => {
    if (!layoutRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(layoutRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Dashboard_${ws.fileName.replace('.xlsx', '')}.pdf`);
    } catch (e) { console.error('Failed to export PDF', e); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', padding: '0.5rem 1rem', background: '#f1f3f4', borderBottom: '1px solid #e8eaed', gap: '0.5rem', justifyContent: 'flex-end' }}>
           <button onClick={exportToPDF} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: '#5f6368', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Download size={12}/> PDF Export</button>
           <button onClick={() => setShowCopilot(!showCopilot)} style={{ background: 'linear-gradient(135deg, #1a73e8, #9333ea)', border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 'auto' }}><Sparkles size={12}/> AI Copilot</button>
           <button onClick={() => setShowKpiModal(true)} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Plus size={12}/> KPI</button>
           <button onClick={() => setShowChartModal(true)} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Plus size={12}/> Chart</button>
        </div>
        <div ref={layoutRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--background)' }}>
          {/* @ts-ignore */}
          <ResponsiveGridLayout className="layout" layouts={layouts} breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }} cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }} rowHeight={60} onLayoutChange={onLayoutChange} draggableHandle=".drag-handle" margin={[12, 12]}>
            {ws.kpiConfigs.map(k => {
              const sheet = ws.sheets.find(s => s.name === k.sheetName);
              return <div key={k.id}><KPICard config={k} fallbackRecords={sheet?.records || []} filters={filtersArr} onEdit={() => setShowKpiModal(k)} /></div>;
            })}
            {ws.chartConfigs.map(c => <div key={c.id}><GenericChart config={c} ws={ws} filters={filtersArr} onEdit={() => setShowChartModal(c)} /></div>)}
          </ResponsiveGridLayout>
        </div>
      </div>
      {showCopilot && <CopilotSidebar onClose={() => setShowCopilot(false)} />}
      {showKpiModal && <KpiModal initialConfig={typeof showKpiModal === 'object' ? showKpiModal : undefined} onClose={() => setShowKpiModal(false)} />}
      {showChartModal && <ChartModal initialConfig={typeof showChartModal === 'object' ? showChartModal : undefined} onClose={() => setShowChartModal(false)} />}
      {drillDownData && <DrillDownModal />}
    </div>
  );
};

// ── Modals ──────────────────────────────────────────────────────────────────
const Overlay = ({ children, onClose, width = 340 }: { children: React.ReactNode; onClose: () => void; width?: number | string }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', width, maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>{children}</div>
  </div>
);
const selStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 6, fontSize: '0.8rem', outline: 'none', color: '#202124' };

const KpiModal = ({ onClose, initialConfig }: { onClose: () => void, initialConfig?: KpiConfig }) => {
  const { workspaces, activeWorkspaceId, addKpi, updateKpi } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];
  
  const [sn, setSn] = useState(initialConfig?.sheetName || sheets[0]?.name || '');
  const [col, setCol] = useState(initialConfig?.col || '');
  const [calc, setCalc] = useState(initialConfig?.calcCol || '');
  const [op, setOp] = useState<'+'|'-'|'*'|'/'>(initialConfig?.calcOp || '/');
  const [isPerc, setIsPerc] = useState(initialConfig?.isPercentage || false);
  const s = sheets.find(x => x.name === sn) || sheets[0];
  
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Add KPI Card</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCol(''); setCalc(''); }} style={selStyle}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Base Value</label><select value={col} onChange={e => setCol(e.target.value)} style={selStyle}><option value="">Select metric...</option><option value="COUNT(Rows)">COUNT(Rows)</option>{(s?.numericCols || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 60 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Op</label><select value={op} onChange={e => setOp(e.target.value as any)} style={selStyle}><option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option></select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Second Value (Optional)</label><select value={calc} onChange={e => setCalc(e.target.value)} style={selStyle}><option value="">None</option><option value="COUNT(Rows)">COUNT(Rows)</option>{(s?.numericCols || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#3c4043', cursor: 'pointer' }}>
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} /> Format as Percentage (%)
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!col} onClick={() => { 
          if (initialConfig) updateKpi(initialConfig.id, { sheetName: sn, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc });
          else addKpi({ sheetName: sn, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc }); 
          onClose(); 
        }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: col ? 'var(--primary)' : '#e8eaed', color: col ? 'white' : '#80868b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>{initialConfig ? 'Save' : 'Add'}</button>
      </div>
    </Overlay>
  );
};

const ChartModal = ({ onClose, initialConfig }: { onClose: () => void, initialConfig?: ChartConfig }) => {
  const { workspaces, activeWorkspaceId, addChart, updateChart } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];

  const [cat, setCat] = useState(initialConfig?.categoryCol || '');
  const [type, setType] = useState<'pie'|'bar'|'line'|'doughnut'>(initialConfig?.type || 'bar');
  const [isPerc, setIsPerc] = useState(initialConfig?.isPercentage || false);

  const defaultSeries = initialConfig?.series && initialConfig.series.length > 0 
    ? initialConfig.series 
    : [{ id: 's1', sheetName: initialConfig?.sheetName || sheets[0]?.name || '', valueCol: initialConfig?.valueCol || '', calcCol: initialConfig?.calcCol, calcOp: initialConfig?.calcOp }];
    
  const [seriesList, setSeriesList] = useState<ChartSeries[]>(defaultSeries);

  const updateSeries = (idx: number, updates: Partial<ChartSeries>) => {
    const next = [...seriesList];
    next[idx] = { ...next[idx], ...updates };
    setSeriesList(next);
  };
  
  const addSeries = () => {
    setSeriesList([...seriesList, { id: 's'+Date.now(), sheetName: sheets[0]?.name || '', valueCol: '' }]);
  };

  const getAvailableCats = () => {
    const mainSheet = sheets.find(s => s.name === seriesList[0]?.sheetName);
    if (!mainSheet) return [];
    return [...(mainSheet.categoricalCols||[]), ...(mainSheet.dateCols||[])];
  };

  return (
    <Overlay onClose={onClose} width={500}>
      <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.1rem' }}>Edit Chart</div>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Shared X-Axis (Category)</label><select value={cat} onChange={e => setCat(e.target.value)} style={selStyle}><option value="">Select...</option>{getAvailableCats().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Chart Type</label><select value={type} onChange={e => setType(e.target.value as any)} style={selStyle}><option value="pie">Pie Chart</option><option value="doughnut">Doughnut Chart</option><option value="bar">Bar (Column) Chart</option><option value="line">Line Chart</option></select></div>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368' }}>Data Series (Y-Axis)</label>
          {(type === 'bar' || type === 'line') && (
            <button onClick={addSeries} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}><Plus size={12}/> Add Series</button>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '40vh', overflowY: 'auto' }}>
          {seriesList.map((s, idx) => {
            const currentSheet = sheets.find(sh => sh.name === s.sheetName);
            const numCols = currentSheet?.numericCols || [];
            return (
              <div key={s.id} style={{ background: '#f8f9fa', padding: '0.75rem', borderRadius: 8, border: '1px solid #e8eaed', position: 'relative' }}>
                {seriesList.length > 1 && (
                  <button onClick={() => setSeriesList(seriesList.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 8, right: 8, background: 'white', border: '1px solid #e8eaed', borderRadius: 4, cursor: 'pointer', color: '#d93025', padding: 2 }}><Trash2 size={12}/></button>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, paddingRight: seriesList.length > 1 ? 24 : 0 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', color: '#5f6368', display: 'block', marginBottom: 2 }}>Table</label>
                    <select value={s.sheetName} onChange={e => updateSeries(idx, { sheetName: e.target.value, valueCol: '', calcCol: '' })} style={{...selStyle, padding: '0.35rem'}}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.6rem', color: '#5f6368', display: 'block', marginBottom: 2 }}>Metric</label>
                    <select value={s.valueCol} onChange={e => updateSeries(idx, { valueCol: e.target.value })} style={{...selStyle, padding: '0.35rem'}}><option value="">Select metric...</option><option value="COUNT(Rows)">COUNT(Rows)</option>{numCols.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 60 }}><label style={{ fontSize: '0.6rem', color: '#5f6368', display: 'block', marginBottom: 2 }}>Op</label><select value={s.calcOp || '/'} onChange={e => updateSeries(idx, { calcOp: e.target.value as any })} style={{...selStyle, padding: '0.35rem'}}><option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option></select></div>
                  <div style={{ flex: 1 }}><label style={{ fontSize: '0.6rem', color: '#5f6368', display: 'block', marginBottom: 2 }}>Second Metric (Optional)</label><select value={s.calcCol || ''} onChange={e => updateSeries(idx, { calcCol: e.target.value })} style={{...selStyle, padding: '0.35rem'}}><option value="">None</option><option value="COUNT(Rows)">COUNT(Rows)</option>{numCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#3c4043', cursor: 'pointer' }}>
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} /> Format numbers as Percentage (%)
        </label>
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!cat || seriesList.some(s => !s.valueCol)} onClick={() => { 
          const s0 = seriesList[0];
          const title = seriesList.length === 1 
             ? (s0.calcCol ? `${s0.valueCol} ${s0.calcOp} ${s0.calcCol} by ${cat}` : `${s0.valueCol} by ${cat}`)
             : `Comparison by ${cat}`;
             
          if (initialConfig) {
            updateChart(initialConfig.id, { categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList });
          } else {
            addChart({ categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList });
          }
          onClose(); 
        }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: cat && !seriesList.some(s => !s.valueCol) ? 'var(--primary)' : '#e8eaed', color: cat && !seriesList.some(s => !s.valueCol) ? 'white' : '#80868b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>{initialConfig ? 'Save' : 'Add'}</button>
      </div>
    </Overlay>
  );
};

export const DrillDownModal = () => {
  const { drillDownData, closeDrillDown } = useDashboard();
  if (!drillDownData || drillDownData.length === 0) return null;
  const columns = Object.keys(drillDownData[0]).slice(0, 15);
  return (
    <Overlay onClose={closeDrillDown} width="80vw">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Data Drill Down</h3>
        <button onClick={closeDrillDown} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#5f6368" /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
          <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}><tr>{columns.map(c => <th key={c} style={{ padding: '0.5rem', borderBottom: '1px solid #e8eaed' }}>{c}</th>)}</tr></thead>
          <tbody>{drillDownData.slice(0, 100).map((row, i) => (<tr key={i}>{columns.map(c => <td key={c} style={{ padding: '0.5rem', borderBottom: '1px solid #f1f3f4', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[c] ?? '')}</td>)}</tr>))}</tbody>
        </table>
      </div>
    </Overlay>
  );
};
