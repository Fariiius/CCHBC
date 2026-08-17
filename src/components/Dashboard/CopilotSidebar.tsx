import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Sparkles, Send, X, Plus, BarChart2, Hash } from 'lucide-react';

export const CopilotSidebar = ({ onClose }: { onClose: () => void }) => {
  const { workspaces, activeWorkspaceId, addChart, addKpi } = useDashboard();
  const ws = workspaces.find(w => w.id === activeWorkspaceId);
  const [messages, setMessages] = useState<{ id: string, role: 'assistant' | 'user', text: string, suggestion?: any }[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ws || messages.length > 0) return;
    
    let totalCols = 0;
    let numCols: string[] = [];
    let catCols: string[] = [];
    
    ws.sheets.forEach(s => {
      totalCols += s.columns?.length || 0;
      if (s.numericCols) numCols.push(...s.numericCols);
      if (s.categoricalCols) catCols.push(...s.categoricalCols);
      if (s.dateCols) catCols.push(...s.dateCols);
    });

    const hasNum = numCols.length > 0;
    const hasCat = catCols.length > 0;

    let greeting = `Hi! I'm your AI Copilot. I've analyzed your data and found **${ws.sheets.length} tables** with **${totalCols} columns**.\n\n`;
    if (hasNum && hasCat) {
      greeting += `I see some great metrics (like *${numCols.slice(0,2).join(', ')}*) and categories (like *${catCols.slice(0,2).join(', ')}*). What would you like to build?`;
    } else {
      greeting += `Tell me what kind of analysis you want to perform!`;
    }

    setMessages([{ id: Date.now().toString(), role: 'assistant', text: greeting }]);
  }, [ws]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !ws) return;
    const userText = input.trim();
    setInput('');
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }]);
    
    setTimeout(() => {
       const lower = userText.toLowerCase();
       
       let allNumCols: { sheet: string, col: string }[] = [];
       let allCatCols: { sheet: string, col: string }[] = [];
       ws.sheets.forEach(s => {
         if (s.numericCols) s.numericCols.forEach(c => allNumCols.push({ sheet: s.name, col: c }));
         if (s.categoricalCols) s.categoricalCols.forEach(c => allCatCols.push({ sheet: s.name, col: c }));
         if (s.dateCols) s.dateCols.forEach(c => allCatCols.push({ sheet: s.name, col: c }));
       });
       
       const matchedNums = allNumCols.filter(n => lower.includes(n.col.toLowerCase()));
       const matchedCats = allCatCols.filter(c => lower.includes(c.col.toLowerCase()));
       
       let aiText = "I'm not exactly sure what you mean. Try saying something like 'Show me Revenue by Region' or 'Total Sales'.";
       let suggestion: any = null;

       if (lower.includes(' by ') || matchedCats.length > 0) {
          const num = matchedNums.length > 0 ? matchedNums[0] : (allNumCols.length > 0 ? allNumCols[0] : null);
          const cat = matchedCats.length > 0 ? matchedCats[0] : (allCatCols.length > 0 ? allCatCols[0] : null);
          
          if (num && cat) {
            aiText = `Got it! I can generate a chart showing **${num.col}** grouped by **${cat.col}**. Would you like me to add it to your dashboard?`;
            suggestion = {
              type: 'chart',
              label: `Generate ${num.col} by ${cat.col} Chart`,
              action: () => addChart({
                title: `${num.col} by ${cat.col}`,
                type: 'bar',
                categoryCol: cat.col,
                series: [{ id: 's1', sheetName: num.sheet, valueCol: num.col }]
              })
            };
          }
       } else if (matchedNums.length > 0 || lower.includes('total') || lower.includes('sum')) {
          const num = matchedNums.length > 0 ? matchedNums[0] : allNumCols[0];
          if (num) {
            aiText = `Sure thing! I can create a KPI widget to track total **${num.col}**. Shall I add it?`;
            suggestion = {
              type: 'kpi',
              label: `Add KPI for ${num.col}`,
              action: () => addKpi({
                sheetName: num.sheet,
                col: num.col,
                isPercentage: lower.includes('percent') || lower.includes('rate') || lower.includes('%')
              })
            };
          }
       }

       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: aiText, suggestion }]);
    }, 600);
  };

  return (
    <div style={{ width: 350, height: '100%', background: 'white', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.05)', zIndex: 100, position: 'relative' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg, #1a73e8, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#3c4043' }}>AI Copilot</span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5f6368' }}><X size={18} /></button>
      </div>

      <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ 
              maxWidth: '85%', 
              padding: '0.75rem 1rem', 
              borderRadius: 12, 
              background: m.role === 'user' ? 'var(--primary)' : '#f1f3f4',
              color: m.role === 'user' ? 'white' : '#3c4043',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              boxShadow: m.role === 'user' ? '0 2px 8px rgba(26,115,232,0.3)' : 'none',
              borderBottomRightRadius: m.role === 'user' ? 2 : 12,
              borderBottomLeftRadius: m.role === 'assistant' ? 2 : 12,
            }}>
              {m.text.split('\n').map((line, i) => <p key={i} style={{ margin: 0, marginBottom: i !== m.text.split('\n').length - 1 ? '0.5rem' : 0 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>') }}></p>)}
            </div>
            
            {m.suggestion && (
              <button 
                onClick={() => {
                  m.suggestion.action();
                  setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: `✨ Done! I've added the **${m.suggestion.label.replace('Generate ', '').replace('Add KPI for ', '')}** to your dashboard.` }]);
                }}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'white',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  borderRadius: 16,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 4px rgba(26,115,232,0.1)'
                }}
              >
                {m.suggestion.type === 'chart' ? <BarChart2 size={14} /> : <Hash size={14} />}
                {m.suggestion.label}
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f3f4', padding: '0.5rem 0.75rem', borderRadius: 24, border: '1px solid #e8eaed' }}>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask me to build a chart..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.85rem', color: '#3c4043' }}
          />
          <button onClick={handleSend} disabled={!input.trim()} style={{ background: input.trim() ? 'var(--primary)' : '#dadce0', color: 'white', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            <Send size={12} style={{ marginLeft: -1 }} />
          </button>
        </div>
      </div>
    </div>
  );
};
