"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDashboard, ChartConfig, KpiConfig, ChartSeries } from '@/context/DashboardContext';
import { ResponsiveGridLayout } from 'react-grid-layout';
import ReactECharts from 'echarts-for-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Edit2, X, Plus, GripHorizontal, Download } from 'lucide-react';

const COLORS = ['#F40009', '#111111', '#555555', '#999999', '#D90008'];

// --- Helpers ---
const fmt = (val: number, isPerc?: boolean) => {
  if (isNaN(val) || val == null) return '-';
  if (isPerc) return (val * 100).toFixed(1) + '%';
  return val >= 1000000 ? (val/1000000).toFixed(1) + 'M' : val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// --- Modals ---
const Overlay = ({ children, onClose, width=400 }: any) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 10, padding: '1.5rem', width, maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}>{children}</div>
  </div>
);

const selStyle = { width: '100%', padding: '0.5rem', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: 6, fontSize: '0.8rem', outline: 'none', color: '#202124' };

const KpiModal = ({ onClose, initial }: { onClose: () => void, initial?: KpiConfig }) => {
  const { workspaces, activeWorkspaceId, addKpi, updateKpi } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];
  
  const [sn, setSn] = useState(initial?.sheetName || sheets[0]?.name || '');
  const [col, setCol] = useState(initial?.col || '');
  const [calc, setCalc] = useState(initial?.calcCol || '');
  const [op, setOp] = useState<'+'|'-'|'*'|'/'>(initial?.calcOp || '/');
  const [isPerc, setIsPerc] = useState(initial?.isPercentage || false);
  const s = sheets.find(x => x.name === sn) || sheets[0];
  
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>{initial ? 'Edit KPI' : 'Add KPI'}</div>
      {sheets.length > 1 && <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Table</label><select value={sn} onChange={e => { setSn(e.target.value); setCol(''); setCalc(''); }} style={selStyle}>{sheets.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}</select></div>}
      <div style={{ marginBottom: 8 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Metric</label><select value={col} onChange={e => setCol(e.target.value)} style={selStyle}><option value="">Select metric...</option><option value="COUNT(Rows)">COUNT(Rows)</option>{(s?.numericCols || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 60 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Op</label><select value={op} onChange={e => setOp(e.target.value as any)} style={selStyle}><option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option></select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Second Metric (Optional)</label><select value={calc} onChange={e => setCalc(e.target.value)} style={selStyle}><option value="">None</option><option value="COUNT(Rows)">COUNT(Rows)</option>{(s?.numericCols || []).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#3c4043', cursor: 'pointer' }}>
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} /> Format as Percentage
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!col} onClick={() => {
          if (initial) updateKpi(initial.id, { sheetName: sn, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc });
          else addKpi({ sheetName: sn, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc, w: 3, h: 2, title: col });
          onClose();
        }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: col ? 'var(--primary)' : '#e8eaed', color: col ? 'white' : '#80868b', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Save</button>
      </div>
    </Overlay>
  );
};

const ChartModal = ({ onClose, initial }: { onClose: () => void, initial?: ChartConfig }) => {
  const { workspaces, activeWorkspaceId, addChart, updateChart } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const sheets = ws?.sheets || [];

  const [cat, setCat] = useState(initial?.categoryCol || '');
  const [type, setType] = useState(initial?.type || 'bar');
  const [isPerc, setIsPerc] = useState(initial?.isPercentage || false);
  const [seriesList, setSeriesList] = useState<ChartSeries[]>(initial?.series || [{ id: 's1', sheetName: sheets[0]?.name || '', valueCol: '' }]);

  const updateSeries = (idx: number, updates: Partial<ChartSeries>) => {
    const next = [...seriesList];
    next[idx] = { ...next[idx], ...updates };
    setSeriesList(next);
  };

  const getAvailableCats = () => {
    const mainSheet = sheets.find(s => s.name === seriesList[0]?.sheetName);
    if (!mainSheet) return [];
    return [...(mainSheet.categoricalCols||[]), ...(mainSheet.dateCols||[])];
  };

  return (
    <Overlay onClose={onClose} width={500}>
      <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1.1rem' }}>{initial ? 'Edit Chart' : 'Add Chart'}</div>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Shared X-Axis (Category)</label><select value={cat} onChange={e => setCat(e.target.value)} style={selStyle}><option value="">Select...</option>{getAvailableCats().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 3 }}>Chart Type</label><select value={type} onChange={e => setType(e.target.value as any)} style={selStyle}><option value="pie">Pie Chart</option><option value="doughnut">Doughnut Chart</option><option value="bar">Bar Chart</option><option value="line">Line Chart</option></select></div>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368' }}>Data Series (Y-Axis)</label>
          {(type === 'bar' || type === 'line') && (
            <button onClick={() => setSeriesList([...seriesList, { id: 's'+Date.now(), sheetName: sheets[0]?.name || '', valueCol: '' }])} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}><Plus size={12}/> Add Series</button>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '40vh', overflowY: 'auto' }}>
          {seriesList.map((s, idx) => {
            const currentSheet = sheets.find(sh => sh.name === s.sheetName);
            const numCols = currentSheet?.numericCols || [];
            return (
              <div key={s.id} style={{ background: '#f8f9fa', padding: '0.75rem', borderRadius: 8, border: '1px solid #e8eaed', position: 'relative' }}>
                {seriesList.length > 1 && <button onClick={() => setSeriesList(seriesList.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 8, right: 8, background: 'white', border: '1px solid #e8eaed', borderRadius: 4, cursor: 'pointer', color: '#d93025', padding: 2 }}><X size={12}/></button>}
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
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} /> Format numbers as Percentage
        </label>
      </div>
      
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: '#f1f3f4', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Cancel</button>
        <button disabled={!cat || seriesList.some(s => !s.valueCol)} onClick={() => { 
          const title = `${seriesList[0].valueCol} by ${cat}`;
          if (initial) updateChart(initial.id, { categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList });
          else addChart({ categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList, w: 6, h: 6 });
          onClose(); 
        }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, background: cat && !seriesList.some(s => !s.valueCol) ? 'var(--primary)' : '#e8eaed', color: cat && !seriesList.some(s => !s.valueCol) ? 'white' : '#80868b', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Save</button>
      </div>
    </Overlay>
  );
};

// --- View ---
export const DashboardView = () => {
  const { workspaces, activeWorkspaceId, updateLayouts } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const [showChartModal, setShowChartModal] = useState<boolean | ChartConfig>(false);
  const [showKpiModal, setShowKpiModal] = useState<boolean | KpiConfig>(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  if (!ws) return null;

  const layoutKpis = ws.kpiConfigs.map(k => ({ i: k.id, x: k.x ?? 0, y: k.y ?? 0, w: k.w ?? 3, h: k.h ?? 2 }));
  const layoutCharts = ws.chartConfigs.map(c => ({ i: c.id, x: c.x ?? 0, y: c.y ?? 2, w: c.w ?? 6, h: c.h ?? 6 }));
  const layouts = { lg: [...layoutKpis, ...layoutCharts] };

  const exportToPDF = async () => {
    if (!layoutRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(layoutRef.current, { scale: 2, useCORS: true });
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
    pdf.save('dashboard.pdf');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--background)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', padding: '0.75rem 1.5rem', background: 'white', borderBottom: '1px solid var(--border)', gap: '0.75rem', alignItems: 'center', zIndex: 10, position: 'relative' }}>
         <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, marginRight: 'auto' }}>{ws.fileName}</h2>
         <button onClick={exportToPDF} style={{ background: 'white', border: '1px solid #dadce0', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#5f6368', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Download size={14}/> PDF Export</button>
         <button onClick={() => setShowKpiModal(true)} style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Plus size={14}/> Add KPI</button>
         <button onClick={() => setShowChartModal(true)} style={{ background: 'var(--primary)', border: 'none', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Plus size={14}/> Add Chart</button>
      </div>

      {/* Empty State */}
      {ws.kpiConfigs.length === 0 && ws.chartConfigs.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
           <h2 style={{ color: '#202124', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 800 }}>Start Building Your Dashboard</h2>
           <p style={{ color: '#5f6368', maxWidth: 400, textAlign: 'center', marginBottom: '2rem', lineHeight: 1.5 }}>
              Your data is ready! Click the buttons below to create your first KPI card or Data Chart.
           </p>
           <div style={{ display: 'flex', gap: '1rem' }}>
             <button onClick={() => setShowKpiModal(true)} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(244,0,9,0.2)' }}><Plus size={18} /> Add KPI</button>
             <button onClick={() => setShowChartModal(true)} style={{ padding: '0.75rem 1.5rem', background: 'white', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: 8, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={18} /> Add Chart</button>
           </div>
        </div>
      )}

      {/* Grid */}
      <div ref={layoutRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', position: 'relative', zIndex: 1 }}>
        {/* @ts-ignore */}
        <ResponsiveGridLayout className="layout" layouts={layouts} breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }} cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }} rowHeight={60} onLayoutChange={(l) => updateLayouts(l.map(x=>({i:x.i, x:x.x, y:x.y, w:x.w, h:x.h})))} draggableHandle=".drag-handle" margin={[16, 16]}>
          {ws.kpiConfigs.map(k => {
            const sheet = ws.sheets.find(s => s.name === k.sheetName);
            return <div key={k.id}><KPICard config={k} fallbackRecords={sheet?.records || []} onEdit={() => setShowKpiModal(k)} /></div>;
          })}
          {ws.chartConfigs.map(c => {
            const sheet = ws.sheets.find(s => s.name === c.series[0]?.sheetName);
            return <div key={c.id}><ChartCard config={c} fallbackRecords={sheet?.records || []} onEdit={() => setShowChartModal(c)} /></div>;
          })}
        </ResponsiveGridLayout>
      </div>

      {showKpiModal && <KpiModal initial={typeof showKpiModal === 'object' ? showKpiModal : undefined} onClose={() => setShowKpiModal(false)} />}
      {showChartModal && <ChartModal initial={typeof showChartModal === 'object' ? showChartModal : undefined} onClose={() => setShowChartModal(false)} />}
    </div>
  );
};

// --- Cards ---
const KPICard = ({ config, fallbackRecords, onEdit }: any) => {
  const [val, setVal] = useState<number | null>(null);
  const [h, setH] = useState(false);
  const { removeKpi } = useDashboard();

  useEffect(() => {
    fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ tableName: config.sheetName, value: config.col, calcCol: config.calcCol, calcOp: config.calcOp, type: 'kpi', fallbackRecords })
    }).then(r => r.json()).then(d => setVal(d.result)).catch(() => setVal(0));
  }, [config, fallbackRecords]);

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="drag-handle" style={{ padding: '0.75rem 1rem', cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{config.title || config.col}</div>
        <GripHorizontal size={14} color="#dadce0" />
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, opacity: h ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10, display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ padding: 4, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeKpi(config.id)} style={{ padding: 4, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 1rem 1rem' }}>
        {val === null ? <div style={{ width: 40, height: 40, background: '#f1f3f4', borderRadius: 4, animation: 'pulse 1.5s infinite' }} /> : (
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#202124', lineHeight: 1 }}>{fmt(val, config.isPercentage)}</div>
        )}
      </div>
    </div>
  );
};

const ChartCard = ({ config, fallbackRecords, onEdit }: any) => {
  const [data, setData] = useState<any[]>([]);
  const [h, setH] = useState(false);
  const { removeChart } = useDashboard();

  useEffect(() => {
    const s0 = config.series[0];
    if (!s0) return;
    
    fetch('/api/query', {
      method: 'POST',
      body: JSON.stringify({ tableName: s0.sheetName, groupBy: config.categoryCol, value: s0.valueCol, calcCol: s0.calcCol, calcOp: s0.calcOp, type: 'chart', fallbackRecords })
    }).then(r => r.json()).then(d => {
      const formatted = (d.result || []).map((row: any) => ({ name: row.category, value_0: row.value }));
      setData(formatted);
    });
  }, [config, fallbackRecords]);

  let option: any = { tooltip: {}, legend: {} };
  
  if (config.type === 'pie' || config.type === 'doughnut') {
    option = {
      tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.marker} ${fmt(p.value, config.isPercentage)} (${p.percent}%)` },
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      series: [{ type: 'pie', radius: config.type === 'doughnut' ? ['40%', '70%'] : '70%', center: ['50%', '45%'], data: data.map(d => ({ name: d.name, value: d.value_0 })) }]
    };
  } else {
    option = {
      tooltip: { trigger: 'axis', formatter: (params: any[]) => `${params[0].name}<br/>` + params.map((p: any) => `${p.marker} ${fmt(p.value, config.isPercentage)}`).join('<br/>') },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: 9 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (v: number) => fmt(v, config.isPercentage) } },
      series: [{ type: config.type, itemStyle: { color: COLORS[0] }, data: data.map(d => d.value_0) }]
    };
  }

  return (
    <div onMouseOver={() => setH(true)} onMouseOut={() => setH(false)} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div className="drag-handle" style={{ padding: '0.75rem 1rem', cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.title}</div>
        <GripHorizontal size={14} color="#dadce0" />
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, opacity: h ? 1 : 0, transition: 'opacity 0.2s', zIndex: 10, display: 'flex', gap: 4 }}>
        <button onClick={onEdit} style={{ padding: 4, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><Edit2 size={12} /></button>
        <button onClick={() => removeChart(config.id)} style={{ padding: 4, borderRadius: 4, color: '#94a3b8', background: 'white', border: '1px solid #e8eaed', cursor: 'pointer' }}><X size={12} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '0.5rem' }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};
