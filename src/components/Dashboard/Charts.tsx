"use client";

import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard, SheetAnalysis, ChartConfig, KpiConfig, DataRecord } from '@/context/DashboardContext';
import { X, Plus, GripHorizontal, Edit2, Download } from 'lucide-react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#1a73e8','#34a853','#fbbc04','#ea4335','#9c27b0','#00bcd4','#ff7043','#607d8b','#43a047','#e91e63','#ff9800','#795548','#3f51b5','#009688','#8bc34a'];

const fmt = (v: number, isPercent = false): string => {
  if (v === null || v === undefined) return '-';
  if (isPercent) return v.toFixed(1) + '%';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return s + (a/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
};

// ── Filter Pills Bar (Power BI style) ───────────────────────────────────────

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
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '0.4rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0, minHeight: 0,
    }}>
      {filterableCols.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', marginRight: '0.5rem' }}>Global Filters:</span>
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
          {hasMasterActive && (
            <button onClick={resetFilters} style={{
              padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem',
              fontWeight: 600, background: '#fce8e6', color: '#d93025', border: 'none', cursor: 'pointer',
            }}>✕ Clear</button>
          )}
        </div>
      )}
      
      {hasCrossActive && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#d93025', textTransform: 'uppercase', marginRight: '0.5rem' }}>Cross Filters:</span>
          {Object.entries(ws.crossFilters).map(([col, vals]) => {
            return vals.map(val => (
              <button key={`cross-${col}-${val}`} onClick={() => removeCrossFilter(col, val)} style={{
                padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.68rem',
                fontWeight: 700, background: '#fce8e6', color: '#d93025',
                border: '1px solid #fad2e1', cursor: 'pointer', transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: 4
              }}>
                {col}: {val} <X size={10} />
              </button>
            ));
          })}
          <button onClick={clearCrossFilters} style={{
            padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.68rem',
            fontWeight: 600, background: 'transparent', color: '#5f6368', border: 'none', cursor: 'pointer',
          }}>Clear All</button>
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
      body: JSON.stringify({
        datasetId: 'mock', tableName: config.sheetName,
        value: config.col, type: 'kpi', filters, fallbackRecords
      })
    }).then(r => r.json()).then(data => {
      setValue(data.result);
    }).catch(console.error);
  }, [config, filters, fallbackRecords]);

  let label = `Sum of ${config.col}`;
  const lcol = config.col.toLowerCase();
  if (lcol.includes('spend')) label = 'Sum YTD Spend';
  if (lcol.includes('saving')) label = 'Sum YTD Saving';

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{
      background: 'var(--surface)', border: '1px solid #e8eaed', borderRadius: 6,
      display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden'
    }}>
      <div className="drag-handle" style={{ padding: '0.25rem', cursor: 'grab', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'center' }}>
        <GripHorizontal size={12} color="#dadce0" />
      </div>
      <div style={{ position: 'absolute', top: 3, right: 3, opacity: h ? 1 : 0, transition: 'opacity 0.1s', zIndex: 10, display: 'flex', gap: 2 }}>
        <button onClick={onEdit} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeKpi(config.id)} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      
      <div onDoubleClick={() => openDrillDown(getFilteredRecords(config.sheetName))} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', cursor: 'pointer' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: (value !== null && value < 0) ? '#d93025' : 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {value !== null ? fmt(value) : '...'}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#5f6368', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
    </div>
  );
};

const GenericChart = ({ config, fallbackRecords, filters, onEdit }: { config: ChartConfig, fallbackRecords: any[], filters: any[], onEdit: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [h, setH] = useState(false);
  const { removeChart, addCrossFilter, openDrillDown, getFilteredRecords } = useDashboard();

  useEffect(() => {
    fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({
        datasetId: 'mock', tableName: config.sheetName,
        groupBy: config.categoryCol, value: config.valueCol, 
        filters, fallbackRecords
      })
    }).then(r => r.json()).then(res => {
      const agg = res.result || [];
      // Apply "categoriesToCompare" local filter if set
      let finalData = agg;
      if (config.categoriesToCompare && config.categoriesToCompare.length > 0) {
        finalData = agg.filter((d: any) => config.categoriesToCompare!.includes(d.category));
      }
      
      finalData = finalData.slice(0, 12); // Limit for readability
      
      setData(finalData.map((d: any) => ({ name: d.category, value: d.value })));
      setGlobalTotal(finalData.reduce((s: number, r: any) => s + Math.abs(r.value), 0));
    }).catch(console.error);
  }, [config, filters, fallbackRecords]);

  const chartData = data.map((d, i) => ({ name: d.name, value: Math.abs(d.value), itemStyle: { color: COLORS[i % COLORS.length] } }));
  const denominator = globalTotal > 0 ? globalTotal : 1;

  const onEvents = {
    click: (params: any) => {
      addCrossFilter(config.categoryCol, params.name);
    },
    dblclick: (params: any) => {
      const records = getFilteredRecords(config.sheetName);
      const sliceRecords = records.filter(r => String(r[config.categoryCol] ?? '') === params.name);
      openDrillDown(sliceRecords);
    }
  };

  let option: any = {};
  if (config.type === 'pie') {
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
        radius: ['35%', '65%'], center: ['50%', '50%'],
        itemStyle: { borderRadius: 2, borderWidth: 1.5, borderColor: '#fff' },
        label: {
          show: true, position: 'outside', fontSize: 10, color: '#5f6368',
          formatter: (p: any) => `${p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name} ${((p.value / denominator) * 100).toFixed(0)}%`,
        },
        labelLine: { length: 8, length2: 6, lineStyle: { color: '#dadce0' } },
        data: chartData
      }]
    };
  } else {
    option = {
      tooltip: { trigger: 'axis', backgroundColor: 'white', borderColor: '#e8eaed', borderWidth: 1, textStyle: { color: '#1a1d23', fontSize: 11 }, formatter: (p: any) => `<b>${p[0].name}</b><br/>${fmt(p[0].value)}` },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: chartData.map(d => d.name), axisLabel: { fontSize: 9, color: '#5f6368', interval: 0, width: 60, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#dadce0' } } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, color: '#5f6368', formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f3f4' } } },
      series: [{ data: chartData.map(d => d.value), type: config.type, smooth: config.type === 'line', itemStyle: { color: 'var(--primary)' }, areaStyle: config.type === 'line' ? { color: 'rgba(26, 115, 232, 0.1)' } : undefined, barMaxWidth: 40 }]
    };
  }

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{
      background: 'var(--surface)', border: '1px solid #e8eaed', borderRadius: 6,
      display: 'flex', flexDirection: 'column', height: '100%', position: 'relative'
    }}>
      <div className="drag-handle" style={{ padding: '0.4rem', cursor: 'grab', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {config.title}
        </div>
        <GripHorizontal size={12} color="#dadce0" />
      </div>
      <div style={{ position: 'absolute', top: 5, right: 5, opacity: h ? 1 : 0, transition: 'opacity 0.1s', zIndex: 10, display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeChart(config.id)} style={{ padding: 2, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      <div onDoubleClick={() => openDrillDown(getFilteredRecords(config.sheetName))} style={{ flex: 1, minHeight: 0, padding: '0.5rem', cursor: 'pointer' }}>
        <ReactECharts option={option} onEvents={onEvents} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};

// ── Dashboard View ──────────────────────────────────────────────────────────

export const DashboardView = () => {
  const { workspaces, activeWorkspaceId, updateChartLayout, updateKpiLayout, drillDownData } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const [showChartModal, setShowChartModal] = useState<boolean | ChartConfig>(false);
  const [showKpiModal, setShowKpiModal] = useState<boolean | KpiConfig>(false);
  const layoutRef = React.useRef<HTMLDivElement>(null);

  if (!ws) return null;

  const layoutKpis = ws.kpiConfigs.map(k => ({ i: k.id, x: k.x ?? 0, y: k.y ?? 0, w: k.w ?? 3, h: k.h ?? 2 }));
  const layoutCharts = ws.chartConfigs.map(c => ({ i: c.id, x: c.x ?? 0, y: c.y ?? 2, w: c.w ?? 6, h: c.h ?? 6 }));
  const layouts = { lg: [...layoutKpis, ...layoutCharts] };

  const onLayoutChange = (currentLayout: Layout) => {
    currentLayout.forEach(l => {
      if (l.i.includes('kpi')) updateKpiLayout(l.i, { x: l.x, y: l.y, w: l.w, h: l.h });
      else updateChartLayout(l.i, { x: l.x, y: l.y, w: l.w, h: l.h });
    });
  };

  // Combine filters for the API
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
    } catch (e) {
      console.error('Failed to export PDF', e);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ display: 'flex', padding: '0.5rem 1rem', background: '#f1f3f4', borderBottom: '1px solid #e8eaed', gap: '0.5rem', justifyContent: 'flex-end' }}>
         <button onClick={exportToPDF} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: '#5f6368', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Download size={12}/> PDF Export</button>
         <button onClick={() => setShowKpiModal(true)} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 'auto' }}><Plus size={12}/> KPI</button>
         <button onClick={() => setShowChartModal(true)} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Plus size={12}/> Chart</button>
      </div>
      <div ref={layoutRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: 'var(--background)' }}>
        {/* @ts-ignore */}
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle"
          margin={[12, 12]}
        >
          {ws.kpiConfigs.map(k => {
            const sheet = ws.sheets.find(s => s.name === k.sheetName);
            return (
              <div key={k.id}>
                <KPICard config={k} fallbackRecords={sheet?.records || []} filters={filtersArr} onEdit={() => setShowKpiModal(k)} />
              </div>
            );
          })}
          {ws.chartConfigs.map(c => {
            const sheet = ws.sheets.find(s => s.name === c.sheetName);
            return (
              <div key={c.id}>
                <GenericChart config={c} fallbackRecords={sheet?.records || []} filters={filtersArr} onEdit={() => setShowChartModal(c)} />
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>
      {showKpiModal && <KpiModal initialConfig={typeof showKpiModal === 'object' ? showKpiModal : undefined} onClose={() => setShowKpiModal(false)} />}
      {showChartModal && <ChartModal initialConfig={typeof showChartModal === 'object' ? showChartModal : undefined} onClose={() => setShowChartModal(false)} />}
      {drillDownData && <DrillDownModal />}
    </div>
  );
};

// ── Modals ──────────────────────────────────────────────────────────────────

const Overlay = ({ children, onClose, width = 340 }: { children: React.ReactNode; onClose: () => void; width?: number | string }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', width, maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>
      {children}
    </div>
  </div>
);

const selStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 6, fontSize: '0.8rem', outline: 'none', color: '#202124' };

const KpiModal = ({ onClose, initialConfig }: { onClose: () => void, initialConfig?: KpiConfig }) => {
  const { workspaces, activeWorkspaceId, addKpi, updateKpi } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];
  
  const [sn, setSn] = useState(initialConfig?.sheetName || sheets[0]?.name || '');
  const [col, setCol] = useState(initialConfig?.col || '');
  const s = sheets.find(x => x.name === sn) || sheets[0];
  
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Add KPI Card</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCol(''); }} style={selStyle}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Value to Sum</label><select value={col} onChange={e => setCol(e.target.value)} style={selStyle}><option value="">Select column...</option>{s?.numericCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!col} onClick={() => { 
          if (initialConfig) updateKpi(initialConfig.id, { sheetName: sn, col });
          else addKpi(sn, col); 
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

  const [sn, setSn] = useState(initialConfig?.sheetName || sheets[0]?.name || '');
  const [cat, setCat] = useState(initialConfig?.categoryCol || '');
  const [val, setVal] = useState(initialConfig?.valueCol || '');
  const [type, setType] = useState<'pie'|'bar'|'line'>(initialConfig?.type || 'pie');
  const [selectedCats, setSelectedCats] = useState<string[]>(initialConfig?.categoriesToCompare || []);
  const s = sheets.find(x => x.name === sn) || sheets[0];

  const availableCategories = useMemo(() => {
    if (!s || !cat) return [];
    return Array.from(new Set(s.records.map(r => String(r[cat] ?? '')).filter(v => v && v !== 'undefined' && v !== 'null' && !v.toLowerCase().includes('total')))).sort();
  }, [s, cat]);

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Add Chart</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCat(''); setVal(''); }} style={selStyle}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Group By</label><select value={cat} onChange={e => { setCat(e.target.value); setSelectedCats([]); }} style={selStyle}><option value="">Select...</option>{s && [...s.categoricalCols, ...s.dateCols].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Value</label><select value={val} onChange={e => setVal(e.target.value)} style={selStyle}><option value="">Select...</option>{s?.numericCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      {availableCategories.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Categories to Compare (Optional)</label>
          <div style={{ maxHeight: 100, overflowY: 'auto', border: '1px solid #e8eaed', borderRadius: 6, padding: '0.5rem', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {availableCategories.map(c => (
              <label key={c} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedCats.includes(c)} onChange={e => {
                  if (e.target.checked) setSelectedCats([...selectedCats, c]);
                  else setSelectedCats(selectedCats.filter(x => x !== c));
                }} />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Chart Type</label><select value={type} onChange={e => setType(e.target.value as any)} style={selStyle}><option value="pie">Pie Chart</option><option value="bar">Bar (Column) Chart</option><option value="line">Line Chart</option></select></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, fontSize: '0.8rem', border: '1px solid #e8eaed', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!cat || !val} onClick={() => { 
          const title = `${val} by ${cat}`;
          if (initialConfig) {
            updateChart(initialConfig.id, { sheetName: sn, categoryCol: cat, valueCol: val, title, type, categoriesToCompare: selectedCats.length > 0 ? selectedCats : undefined });
          } else {
            addChart(sn, cat, val, type, selectedCats.length > 0 ? selectedCats : undefined);
          }
          onClose(); 
        }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: cat && val ? 'var(--primary)' : '#e8eaed', color: cat && val ? 'white' : '#80868b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', border: 'none' }}>{initialConfig ? 'Save' : 'Add'}</button>
      </div>
    </Overlay>
  );
};

export const DrillDownModal = () => {
  const { drillDownData, closeDrillDown } = useDashboard();
  
  if (!drillDownData || drillDownData.length === 0) {
    return (
      <Overlay onClose={closeDrillDown} width={400}>
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          <h3>No Data</h3>
          <p style={{ color: '#5f6368' }}>There are no raw records matching this selection.</p>
          <button onClick={closeDrillDown} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
        </div>
      </Overlay>
    );
  }

  const columns = Object.keys(drillDownData[0]).slice(0, 15); // limit columns for display

  const exportCSV = () => {
    const csvRows = [];
    const headers = Object.keys(drillDownData[0]);
    csvRows.push(headers.join(','));
    for (const row of drillDownData) {
      csvRows.push(headers.map(h => {
        const val = row[h];
        return (typeof val === 'string' && val.includes(',')) ? `"${val}"` : val;
      }).join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drilldown_data.csv';
    a.click();
  };

  return (
    <Overlay onClose={closeDrillDown} width="80vw">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
        <h3 style={{ margin: 0 }}>Data Drill Down <span style={{ fontSize: '0.8rem', color: '#5f6368', fontWeight: 'normal' }}>({drillDownData.length} records)</span></h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportCSV} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #dadce0', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, color: '#5f6368', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12}/> Export CSV</button>
          <button onClick={closeDrillDown} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} color="#5f6368" /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
          <thead style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              {columns.map(c => <th key={c} style={{ padding: '0.5rem', borderBottom: '1px solid #e8eaed', fontWeight: 600, color: '#3c4043' }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {drillDownData.slice(0, 100).map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f3f4' }}>
                {columns.map(c => <td key={c} style={{ padding: '0.5rem', color: '#5f6368', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {drillDownData.length > 100 && (
          <div style={{ padding: '0.5rem', textAlign: 'center', color: '#5f6368', background: '#f8f9fa', fontSize: '0.75rem' }}>
            Showing top 100 records. Export to CSV to see all.
          </div>
        )}
      </div>
    </Overlay>
  );
};
