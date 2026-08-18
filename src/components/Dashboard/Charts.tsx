"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { ChartConfigDB, KpiConfigDB, ChartSeriesDB } from '@/lib/db';
import { ResponsiveGridLayout } from 'react-grid-layout';
import ReactECharts from 'echarts-for-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Edit2, X, Plus, GripHorizontal, Download, Filter } from 'lucide-react';
import _ from 'lodash';

const COLORS = ['#E3001B', '#EAA700', '#111111', '#cccccc'];

// --- Helpers ---
const fmt = (val: number, isPerc?: boolean) => {
  if (isNaN(val) || val == null) return '-';
  if (isPerc) return val.toFixed(0) + '%';
  return val >= 1000000000 ? (val/1000000000).toFixed(2) + 'bn' : val >= 1000000 ? (val/1000000).toFixed(2) + 'M' : val >= 1000 ? (val/1000).toFixed(2) + 'k' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- Modals ---
const Overlay = ({ children, onClose, width=400 }: any) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width, maxWidth: '95vw', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>{children}</div>
  </div>
);

const selStyle = { width: '100%', padding: '0.6rem', background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: 6, fontSize: '0.85rem', outline: 'none', color: '#202124' };

const KpiModal = ({ onClose, initial }: { onClose: () => void, initial?: KpiConfigDB }) => {
  const { tables, columns, addKpi, updateKpi, pinnedCells } = useDashboard();
  
  const [mode, setMode] = useState<'pinned'|'aggregate'>(initial?.pinnedCellId ? 'pinned' : 'aggregate');
  const [pinnedId, setPinnedId] = useState(initial?.pinnedCellId || '');
  
  const [tid, setTid] = useState(initial?.tableId || tables[0]?.id || '');
  const [col, setCol] = useState(initial?.col || '');
  const [calc, setCalc] = useState(initial?.calcCol || '');
  const [op, setOp] = useState<'+'|'-'|'*'|'/'>(initial?.calcOp || '/');
  const [isPerc, setIsPerc] = useState(initial?.isPercentage || false);
  const [title, setTitle] = useState(initial?.title || '');
  
  const tableCols = columns.filter(c => c.tableId === tid);

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontWeight: 800, marginBottom: '1.5rem', fontSize: '1.25rem' }}>{initial ? 'Edit KPI' : 'Add KPI'}</div>
      
      {!initial && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#f1f3f4', padding: 4, borderRadius: 8 }}>
          <button onClick={() => setMode('pinned')} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', background: mode === 'pinned' ? 'white' : 'transparent', fontWeight: 600, cursor: 'pointer', boxShadow: mode === 'pinned' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Pinned Cell</button>
          <button onClick={() => setMode('aggregate')} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: 'none', background: mode === 'aggregate' ? 'white' : 'transparent', fontWeight: 600, cursor: 'pointer', boxShadow: mode === 'aggregate' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Table Aggregate</button>
        </div>
      )}

      {mode === 'pinned' ? (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Select Pinned Cell</label>
          <select value={pinnedId} onChange={e => setPinnedId(e.target.value)} style={selStyle}>
            <option value="">Select...</option>
            {pinnedCells.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sheetName})</option>)}
          </select>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Table</label><select value={tid} onChange={e => { setTid(e.target.value); setCol(''); setCalc(''); }} style={selStyle}>{tables.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Metric</label><select value={col} onChange={e => setCol(e.target.value)} style={selStyle}><option value="">Select metric...</option><option value="COUNT(Rows)">COUNT(Rows)</option>{tableCols.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 70 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Op</label><select value={op} onChange={e => setOp(e.target.value as any)} style={selStyle}><option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option></select></div>
            <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Second Metric (Optional)</label><select value={calc} onChange={e => setCalc(e.target.value)} style={selStyle}><option value="">None</option><option value="COUNT(Rows)">COUNT(Rows)</option>{tableCols.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Custom Title (Optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={selStyle} placeholder={col || "KPI Title"} />
          </div>
        </>
      )}

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#3c4043', cursor: 'pointer', fontWeight: 500 }}>
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} style={{ width: 16, height: 16 }} /> Format as Percentage
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: 8, background: '#f1f3f4', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#5f6368' }}>Cancel</button>
        <button disabled={mode === 'pinned' ? !pinnedId : !col} onClick={() => {
          if (initial) updateKpi(initial.id, { pinnedCellId: pinnedId || undefined, tableId: tid || undefined, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc, title });
          else addKpi({ pinnedCellId: pinnedId || undefined, tableId: tid || undefined, col, calcCol: calc || undefined, calcOp: calc ? op : undefined, isPercentage: isPerc, w: 3, h: 2, title });
          onClose();
        }} style={{ flex: 1, padding: '0.75rem', borderRadius: 8, background: '#F40009', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (mode === 'pinned' ? !pinnedId : !col) ? 0.5 : 1 }}>Save KPI</button>
      </div>
    </Overlay>
  );
};

const ChartModal = ({ onClose, initial }: { onClose: () => void, initial?: ChartConfigDB }) => {
  const { tables, columns, addChart, updateChart } = useDashboard();

  const [cat, setCat] = useState(initial?.categoryCol || '');
  const [type, setType] = useState(initial?.type || 'bar');
  const [isPerc, setIsPerc] = useState(initial?.isPercentage || false);
  const [seriesList, setSeriesList] = useState<ChartSeriesDB[]>(initial?.series || [{ id: 's1', tableId: tables[0]?.id || '', valueCol: '' }]);

  const updateSeries = (idx: number, updates: Partial<ChartSeriesDB>) => {
    const next = [...seriesList];
    next[idx] = { ...next[idx], ...updates };
    setSeriesList(next);
  };

  const getAvailableCats = () => {
    const mainTable = seriesList[0]?.tableId;
    if (!mainTable) return [];
    return columns.filter(c => c.tableId === mainTable).map(c => c.name);
  };

  return (
    <Overlay onClose={onClose} width={550}>
      <div style={{ fontWeight: 800, marginBottom: '1.5rem', fontSize: '1.25rem' }}>{initial ? 'Edit Chart' : 'Add Chart'}</div>
      
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Shared X-Axis (Category)</label><select value={cat} onChange={e => setCat(e.target.value)} style={selStyle}><option value="">Select...</option>{getAvailableCats().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368', display: 'block', marginBottom: 6 }}>Chart Type</label><select value={type} onChange={e => setType(e.target.value as any)} style={selStyle}><option value="pie">Pie Chart</option><option value="doughnut">Doughnut Chart</option><option value="bar">Bar Chart</option><option value="line">Line Chart</option></select></div>
      </div>
      
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#5f6368' }}>Data Series (Y-Axis)</label>
          {(type === 'bar' || type === 'line') && (
            <button onClick={() => setSeriesList([...seriesList, { id: 's'+Date.now(), tableId: tables[0]?.id || '', valueCol: '' }])} style={{ background: '#fce8e6', border: 'none', color: '#F40009', fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14}/> Add Series</button>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '40vh', overflowY: 'auto' }}>
          {seriesList.map((s, idx) => {
            const tableCols = columns.filter(c => c.tableId === s.tableId).map(c => c.name);
            return (
              <div key={s.id} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: 8, border: '1px solid #e8eaed', position: 'relative' }}>
                {seriesList.length > 1 && <button onClick={() => setSeriesList(seriesList.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: 12, right: 12, background: 'white', border: '1px solid #e8eaed', borderRadius: 4, cursor: 'pointer', color: '#d93025', padding: 4 }}><X size={14}/></button>}
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, paddingRight: seriesList.length > 1 ? 28 : 0 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', display: 'block', marginBottom: 4 }}>Table</label>
                    <select value={s.tableId} onChange={e => updateSeries(idx, { tableId: e.target.value, valueCol: '', calcCol: '' })} style={{...selStyle, padding: '0.5rem'}}>{tables.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', display: 'block', marginBottom: 4 }}>Metric</label>
                    <select value={s.valueCol} onChange={e => updateSeries(idx, { valueCol: e.target.value })} style={{...selStyle, padding: '0.5rem'}}><option value="">Select metric...</option><option value="COUNT(Rows)">COUNT(Rows)</option>{tableCols.map(c => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 60 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', display: 'block', marginBottom: 4 }}>Op</label><select value={s.calcOp || '/'} onChange={e => updateSeries(idx, { calcOp: e.target.value as any })} style={{...selStyle, padding: '0.5rem'}}><option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option></select></div>
                  <div style={{ flex: 1 }}><label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5f6368', display: 'block', marginBottom: 4 }}>Second Metric (Optional)</label><select value={s.calcCol || ''} onChange={e => updateSeries(idx, { calcCol: e.target.value })} style={{...selStyle, padding: '0.5rem'}}><option value="">None</option><option value="COUNT(Rows)">COUNT(Rows)</option>{tableCols.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#3c4043', cursor: 'pointer', fontWeight: 500 }}>
          <input type="checkbox" checked={isPerc} onChange={e => setIsPerc(e.target.checked)} style={{ width: 16, height: 16 }} /> Format numbers as Percentage
        </label>
      </div>
      
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: 8, background: '#f1f3f4', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#5f6368' }}>Cancel</button>
        <button disabled={!cat || seriesList.some(s => !s.valueCol)} onClick={() => { 
          const title = `${seriesList[0].valueCol} by ${cat}`;
          if (initial) updateChart(initial.id, { categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList });
          else addChart({ categoryCol: cat, title, type, isPercentage: isPerc, series: seriesList, w: 6, h: 6 });
          onClose(); 
        }} style={{ flex: 1, padding: '0.75rem', borderRadius: 8, background: '#F40009', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!cat || seriesList.some(s => !s.valueCol)) ? 0.5 : 1 }}>Save Chart</button>
      </div>
    </Overlay>
  );
};

// --- View ---
export const DashboardView = () => {
  const { chartConfigs, kpiConfigs, updateLayouts, columns, records } = useDashboard();
  const [showChartModal, setShowChartModal] = useState<boolean | ChartConfigDB>(false);
  const [showKpiModal, setShowKpiModal] = useState<boolean | KpiConfigDB>(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({}); // { "colName": "val" }
  const layoutRef = useRef<HTMLDivElement>(null);

  const layoutKpis = kpiConfigs.map(k => ({ i: k.id, x: k.x ?? 0, y: k.y ?? 0, w: k.w ?? 6, h: k.h ?? 2, minW: 3, minH: 2 }));
  const layoutCharts = chartConfigs.map(c => ({ i: c.id, x: c.x ?? 0, y: c.y ?? 2, w: c.w ?? 12, h: c.h ?? 5, minW: 4, minH: 4 }));
  const layouts = { lg: [...layoutKpis, ...layoutCharts] };

  const filterCols = columns.filter(c => c.isFilter);
  // Get unique values for each filter across all records matching that column
  const filterOptions = _.memoize(() => {
    const opts: Record<string, string[]> = {};
    filterCols.forEach(fc => {
      const vals = new Set<string>();
      records.forEach(r => {
        if (r.data[fc.name] !== undefined) vals.add(String(r.data[fc.name]));
      });
      opts[fc.name] = Array.from(vals).sort();
    });
    return opts;
  })();

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#111111' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .react-grid-item.react-grid-placeholder { background: rgba(255,255,255,0.05) !important; border-radius: 16px; }
      `}</style>
      {/* Header & Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#E3001B', padding: '1.5rem', borderBottom: '1px solid #C20017', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 600, color: 'white', fontStyle: 'italic', letterSpacing: '-0.5px' }}>Coca-Cola HBC</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 400, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>Bottling & distribution intelligence</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setShowKpiModal(true)} style={{ background: 'white', border: 'none', borderRadius: 24, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#E3001B', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>+ KPI</button>
            <button onClick={() => setShowChartModal(true)} style={{ background: 'white', border: 'none', borderRadius: 24, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#E3001B', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>+ Chart</button>
            <button onClick={exportToPDF} style={{ background: '#111', border: 'none', borderRadius: 24, padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Export</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {filterCols.map(fc => {
            const isActive = !!activeFilters[fc.name];
            return (
              <div key={fc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: isActive ? '#111' : 'rgba(255,255,255,0.15)', border: 'none', padding: '0.4rem 1rem', borderRadius: 24, transition: 'all 0.2s' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'white' }}>{isActive ? `${fc.name}:` : `+ ${fc.name}`}</span>
                <select value={activeFilters[fc.name] || ''} onChange={e => setActiveFilters(p => ({ ...p, [fc.name]: e.target.value }))} style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', fontWeight: 600, color: 'white', outline: 'none', cursor: 'pointer', maxWidth: 120 }}>
                  <option value="" style={{ color: 'black' }}>All</option>
                  {filterOptions[fc.name]?.map(v => <option key={v} value={v} style={{ color: 'black' }}>{v}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div ref={layoutRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', position: 'relative', zIndex: 1 }}>
        <ResponsiveGridLayout className="layout" layouts={layouts} breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }} cols={{ lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 }} rowHeight={60} onLayoutChange={(l) => updateLayouts(l.map(x=>({i:x.i, x:x.x, y:x.y, w:x.w, h:x.h})))} draggableHandle=".drag-handle" margin={[24, 24]} compactType={null} preventCollision={false}>
          {kpiConfigs.map(k => (
            <div key={k.id}><KPICard config={k} activeFilters={activeFilters} onEdit={() => setShowKpiModal(k)} /></div>
          ))}
          {chartConfigs.map(c => (
            <div key={c.id}><ChartCard config={c} activeFilters={activeFilters} onEdit={() => setShowChartModal(c)} /></div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {showKpiModal && <KpiModal initial={typeof showKpiModal === 'object' ? showKpiModal : undefined} onClose={() => setShowKpiModal(false)} />}
      {showChartModal && <ChartModal initial={typeof showChartModal === 'object' ? showChartModal : undefined} onClose={() => setShowChartModal(false)} />}
    </div>
  );
};

// --- Cards (Aggregation Logic applied locally on records) ---
const KPICard = ({ config, activeFilters, onEdit }: any) => {
  const { records, pinnedCells } = useDashboard();
  let val: number | string | null = null;

  if (config.pinnedCellId) {
    const pc = pinnedCells.find(p => p.id === config.pinnedCellId);
    val = pc ? pc.value : null;
  } else {
    // Filter records by table and active filters
    const tableRecs = records.filter(r => r.tableId === config.tableId);
    const filtered = tableRecs.filter(r => {
      return Object.entries(activeFilters).every(([k, v]) => {
        if (!v) return true;
        return String(r.data[k]) === v;
      });
    });

    const getSum = (col: string) => col === 'COUNT(Rows)' ? filtered.length : _.sumBy(filtered, r => Number(r.data[col]) || 0);

    if (config.col) {
      let total = getSum(config.col);
      if (config.calcCol && config.calcOp) {
        const valB = getSum(config.calcCol);
        if (config.calcOp === '+') total += valB;
        if (config.calcOp === '-') total -= valB;
        if (config.calcOp === '*') total *= valB;
        if (config.calcOp === '/') total = valB ? total / valB : 0;
      }
      val = total;
    }
  }

  const isPinned = !!config.pinnedCellId;
  return (
    <div style={{ background: '#222222', border: isPinned ? '1px solid #E3001B' : '1px solid #333', borderRadius: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.25rem', height: '100%', position: 'relative', animation: 'fadeIn 0.6s ease-out' }}>
      <div className="drag-handle" style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 1 }}></div>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <button onClick={onEdit} style={{ padding: 4, borderRadius: 4, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}><Edit2 size={12} /></button>
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: isPinned ? '#E3001B' : '#A0A0A0', marginBottom: '0.5rem', zIndex: 2 }}>
        {config.title || config.col || 'KPI'}
      </div>
      <div style={{ fontSize: '2.5rem', fontWeight: 500, color: isPinned ? '#E3001B' : '#FFFFFF', lineHeight: 1, zIndex: 2, letterSpacing: '-1px' }}>
        {typeof val === 'number' ? fmt(val, config.isPercentage) : (val || '-')}
      </div>
    </div>
  );
};

const ChartCard = ({ config, activeFilters, onEdit }: any) => {
  const { records } = useDashboard();
  
  const s0 = config.series[0];
  const tableRecs = records.filter(r => r.tableId === s0?.tableId);
  const filtered = tableRecs.filter(r => {
    return Object.entries(activeFilters).every(([k, v]) => {
      if (!v) return true;
      return String(r.data[k]) === v;
    });
  });

  const grouped = _.groupBy(filtered, r => r.data[config.categoryCol] || 'Unknown');
  const data = Object.entries(grouped).map(([category, recs]) => {
    const getSum = (col: string) => col === 'COUNT(Rows)' ? recs.length : _.sumBy(recs, r => Number(r.data[col]) || 0);
    let total = s0 ? getSum(s0.valueCol) : 0;
    if (s0?.calcCol && s0?.calcOp) {
      const valB = getSum(s0.calcCol);
      if (s0.calcOp === '+') total += valB;
      if (s0.calcOp === '-') total -= valB;
      if (s0.calcOp === '*') total *= valB;
      if (s0.calcOp === '/') total = valB ? total / valB : 0;
    }
    return { name: category, value_0: total };
  }).sort((a, b) => b.value_0 - a.value_0).slice(0, 50); // top 50

  let option: any = { tooltip: {}, legend: {} };
  
  if (config.type === 'pie' || config.type === 'doughnut') {
    option = {
      tooltip: { trigger: 'item', backgroundColor: '#333', textStyle: { color: '#fff' }, borderWidth: 0, formatter: (p: any) => `<b>${p.name}</b><br/>${p.marker} ${fmt(p.value, config.isPercentage)}` },
      legend: { type: 'scroll', orient: 'vertical', right: 10, top: 'middle', textStyle: { fontSize: 11, color: '#A0A0A0' }, icon: 'circle' },
      series: [{ 
        type: 'pie', 
        radius: config.type === 'doughnut' ? ['50%', '75%'] : '75%', 
        center: ['35%', '50%'], 
        data: data.map((d, i) => ({ name: d.name, value: d.value_0, itemStyle: { color: COLORS[i % COLORS.length] } })),
        label: { show: false },
        labelLine: { show: false }
      }]
    };
  } else {
    option = {
      tooltip: { trigger: 'axis', backgroundColor: '#333', textStyle: { color: '#fff' }, borderWidth: 0, formatter: (params: any[]) => `${params[0].name}<br/>` + params.map((p: any) => `${p.marker} ${fmt(p.value, config.isPercentage)}`).join('<br/>') },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { fontSize: 10, color: '#888' }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { show: false }, splitLine: { show: false } },
      series: [{ 
        type: config.type, 
        barWidth: '60%', 
        itemStyle: { 
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#EAA700' }, { offset: 1, color: '#E3001B' }] },
          borderRadius: [4, 4, 0, 0] 
        },
        data: data.map((d, i) => ({ value: d.value_0, itemStyle: { color: i === 2 ? '#333333' : undefined } })) 
      }]
    };
  }

  return (
    <div style={{ background: '#222222', border: '1px solid #333', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', animation: 'fadeIn 0.6s ease-out' }}>
      <div className="drag-handle" style={{ position: 'absolute', inset: 0, cursor: 'grab', zIndex: 1 }}></div>
      <div style={{ textAlign: 'left', padding: '1rem 1.25rem 0 1.25rem', zIndex: 2 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#A0A0A0' }}>{config.title}</div>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <button onClick={onEdit} style={{ padding: 4, borderRadius: 4, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}><Edit2 size={12} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, zIndex: 2, pointerEvents: 'none', padding: '0.5rem' }}>
        <ReactECharts option={option} style={{ height: '100%', width: '100%', pointerEvents: 'auto' }} />
      </div>
    </div>
  );
};
