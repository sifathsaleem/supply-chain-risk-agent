import React, { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../utils';

// ── colours (exact mockup values) ──────────────────────────────────────────
const C = {
  bg:        '#0a0a0a',
  nav:       'rgba(10,10,10,0.92)',
  scLow:     '#121212',
  sc:        '#171717',
  scHigh:    '#1f1f1f',
  scHighest: '#262626',
  outline:   'rgba(255,255,255,0.15)',
  outlineV:  'rgba(255,255,255,0.10)',
  muted:     '#a3a3a3',
  white:     '#ffffff',
  primary:   '#ffffff',
  error:     '#ef4444',
};

const riskChip = (level) => {
  const l = level?.toUpperCase();
  const base = { fontSize:8, fontWeight:700, letterSpacing:'0.05em', padding:'2px 6px', borderRadius:3, display:'inline-block' };
  if (l==='HIGH'||l==='CRITICAL')  return <span style={{...base, background:'rgba(239,68,68,.10)',  color:'#ef4444', border:'1px solid rgba(239,68,68,.25)' }}>{l}</span>;
  if (l==='MEDIUM')                return <span style={{...base, background:'rgba(251,191,36,.10)', color:'#f59e0b', border:'1px solid rgba(251,191,36,.25)'}}>{l}</span>;
  if (l==='SECURITY')              return <span style={{...base, background:'rgba(239,68,68,.10)',  color:'#ef4444', border:'1px solid rgba(239,68,68,.25)' }}>SECURITY</span>;
  return <span style={{...base, background:'rgba(255,255,255,.06)', color:C.muted, border:'1px solid rgba(255,255,255,.12)'}}>{l||'LOW'}</span>;
};

export default function TabNav({ activeTab, onTabChange, alerts=[], refreshInterval, onIntervalChange }) {
  const [open, setOpen] = useState(null); // 'bell'|'gear'|'avatar'|null
  const [closingMenu, setClosingMenu] = useState(null); // 'bell'|'gear'|'avatar'|null
  const [unread, setUnread] = useState(0);
  const prevLen = useRef(0);

  const barRef = useRef(null);
  const pillRef = useRef(null);

  useEffect(() => {
    if (alerts.length > prevLen.current) setUnread(p => p + alerts.length - prevLen.current);
    prevLen.current = alerts.length;
  }, [alerts.length]);

  // sliding tab effect
  useEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;

    const tabs = [...bar.querySelectorAll('.t-tab')];
    const activeTabButton = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    if (!activeTabButton) return;

    // Measure and set position
    pill.style.transform = `translateX(${activeTabButton.offsetLeft}px)`;
    pill.style.width = `${activeTabButton.offsetWidth}px`;

    // Snap to initial position on resize
    const handleResize = () => {
      const active = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      if (active) {
        const prev = pill.style.transition;
        pill.style.transition = 'none';
        pill.style.transform = `translateX(${active.offsetLeft}px)`;
        pill.style.width = `${active.offsetWidth}px`;
        void pill.offsetWidth;
        pill.style.transition = prev;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  const toggle = (k) => {
    if (open === k) {
      // Transition out
      setClosingMenu(k);
      setOpen(null);
      setTimeout(() => {
        setClosingMenu(null);
      }, 150); // Match --dropdown-close-dur (150ms)
    } else {
      // Transition in
      setOpen(k);
      setClosingMenu(null);
      if (k === 'bell') setUnread(0);
    }
  };

  const recent = [...alerts].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,5);
  const curSec = refreshInterval / 1000;

  // shared popover box styles
  const popover = {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: C.scHigh,
    border: `1px solid ${C.outlineV}`,
    borderRadius: 8,
    zIndex: 300,
    overflow: 'hidden',
    boxShadow: 'none',
  };

  // icon button
  const iconBtn = (k) => ({
    padding: '6px 8px',
    borderRadius: 8,
    cursor: 'pointer',
    background: open===k ? C.sc : 'transparent',
    color: open===k ? C.white : C.muted,
    border: 'none',
    display: 'flex', alignItems: 'center',
    transition: 'all .15s',
  });

  return (
    <>
      {(open || closingMenu) && <div style={{position:'fixed',inset:0,zIndex:200}} onClick={()=>toggle(open)} />}

      <nav style={{
        position:'fixed', top:0, left:0, right:0, height:56,
        background: C.nav,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.outlineV}`,
        zIndex: 210,
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '0 24px',
      }}>

        {/* Left: logo + brand */}
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:24,height:24,background:'#fff200',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <span className="material-symbols-outlined" style={{fontSize:14,color:'#000',fontVariationSettings:"'FILL' 1"}}>hub</span>
          </div>
          <span style={{fontSize:15,fontWeight:700,letterSpacing:'-.01em',color:'#fff',whiteSpace:'nowrap'}}>Supply Chain Risk Intelligence</span>
        </div>

        {/* Center: segmented switcher */}
        <div ref={barRef} className="t-tabs">
          <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
          {[['suppliers','My Suppliers'],['risk','Risk Intelligence']].map(([k,label])=>{
            const active = activeTab===k;
            return (
              <button 
                key={k} 
                className="t-tab"
                role="tab"
                aria-selected={active}
                onClick={()=>onTabChange(k)} 
                style={{
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right: bell, gear, avatar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>

          {/* ── Bell ── */}
          <div style={{position:'relative'}}>
            <button style={iconBtn('bell')} onClick={()=>toggle('bell')}>
              <span className="material-symbols-outlined" style={{fontSize:18}}>notifications</span>
              {unread>0 && <span style={{
                position:'absolute',top:6,right:6,
                width:8,height:8,background:'#ef4444',
                borderRadius:'50%',border:`1.5px solid ${C.bg}`,
              }}/>}
            </button>

            {(open==='bell' || closingMenu==='bell') && (
              <div 
                className={`t-dropdown ${open==='bell' ? 'is-open' : 'is-closing'}`}
                data-origin="top-right"
                style={{...popover, width:320}}
              >
                <div style={{padding:'10px 16px',borderBottom:`1px solid ${C.outlineV}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'#fff'}}>Recent Alerts</span>
                  {alerts.length>0&&<span style={{fontSize:9,fontWeight:700,color:'#ef4444',background:'rgba(239,68,68,.10)',border:'1px solid rgba(239,68,68,.2)',padding:'2px 6px',borderRadius:3}}>{alerts.length} ACTIVE</span>}
                </div>
                {recent.length===0
                  ? <p style={{padding:'20px 16px',fontSize:11,color:C.muted,textAlign:'center',fontStyle:'italic'}}>No notifications in the last 24 hours</p>
                  : recent.map((a,i)=>{
                    const badgeLevel = a.alert_message?.toUpperCase().includes('SECURITY') ? 'SECURITY' : a.risk_level;
                    return (
                      <div key={i} style={{padding:'10px 16px',borderBottom:`1px solid ${C.outlineV}`,display:'flex',flexDirection:'column',gap:3}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                          <span style={{fontSize:12,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:170}}>{a.supplier_name}</span>
                          {riskChip(badgeLevel)}
                        </div>
                        <p style={{fontSize:11,color:C.muted,lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical'}}>{a.alert_message}</p>
                        <span style={{fontSize:9,color:'rgba(163,163,163,.6)',fontWeight:500}}>{timeAgo(a.timestamp)}</span>
                      </div>
                    );
                  })
                }
                <button onClick={()=>{onTabChange('risk');setOpen(null);}} style={{
                  width:'100%',padding:'10px',fontSize:10,fontWeight:700,
                  textTransform:'uppercase',letterSpacing:'0.08em',
                  color:'#fff',background:'none',border:'none',
                  borderTop:`1px solid ${C.outlineV}`,cursor:'pointer',
                }}>View all alerts →</button>
              </div>
            )}
          </div>

          {/* ── Gear ── */}
          <div style={{position:'relative'}}>
            <button style={iconBtn('gear')} onClick={()=>toggle('gear')}>
              <span className="material-symbols-outlined" style={{fontSize:18}}>settings</span>
            </button>

            {(open==='gear' || closingMenu==='gear') && (
              <div 
                className={`t-dropdown ${open==='gear' ? 'is-open' : 'is-closing'}`}
                data-origin="top-right"
                style={{...popover, width:240, padding:16, display:'flex', flexDirection:'column', gap:12}}
              >
                <div>
                  <p style={{fontSize:12,fontWeight:600,color:'#fff'}}>Auto-refresh interval</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>Risk Intelligence polling frequency</p>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',background:C.scLow,borderRadius:6,border:`1px solid ${C.outlineV}`,overflow:'hidden'}}>
                  {[15,30,60].map(s=>{
                    const active = curSec===s;
                    return (
                      <button key={s} onClick={()=>{onIntervalChange(s*1000);setOpen(null);}} style={{
                        padding:'6px 0',fontSize:11,fontWeight:700,
                        background: active ? C.primary : 'transparent',
                        color: active ? '#000' : C.muted,
                        border:'none',cursor:'pointer',transition:'all .15s',
                      }}>{s}s</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Avatar ── */}
          <div style={{position:'relative',marginLeft:4}}>
            <button onClick={()=>toggle('avatar')} style={{
              width:32,height:32,borderRadius:'50%',
              overflow:'hidden',border:`1px solid ${C.outlineV}`,
              background:C.scHighest,cursor:'pointer',flexShrink:0,
              padding:0,
            }}>
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYtbbr_m56ucytck_sSgA40raF46K7_afyyMUL16IqpXrvQFyO0YI0JDj2H9rQzZXg7hC3W8kdoPrUz2JhxTcPq9XwSA9Vn1zNOTrGKxSpIk_4rRkFxvSMCvWqIPP1rPEqvWi_RjkRkvbUV-oxX2w0YNvs46eIoQXkmlzjfN9ZbJ8gGnVqgsAcfvx3cDKAkKwwzTIeHv2XBdAs19uJIT65nvSTTfcKjOB-akPC7rmARhncLAyJhHgNt9J1xdXooS5EcCbCfufP8Mg"
                alt="Sarah Jenkins" style={{width:'100%',height:'100%',objectFit:'cover',filter:'grayscale(1) brightness(1.1)'}} />
            </button>

            {(open==='avatar' || closingMenu==='avatar') && (
              <div 
                className={`t-dropdown ${open==='avatar' ? 'is-open' : 'is-closing'}`}
                data-origin="top-right"
                style={{...popover, width:200}}
              >
                <div style={{padding:'10px 16px'}}>
                  <p style={{fontSize:13,fontWeight:600,color:'#fff'}}>Sarah Jenkins</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>sarah.j@riskintel.io</p>
                </div>
                <div style={{height:1,background:C.outlineV}} />
                <button onClick={()=>alert('Signing out…')} style={{
                  width:'100%',padding:'10px 16px',border:'none',background:'none',
                  cursor:'pointer',display:'flex',alignItems:'center',gap:10,
                  fontSize:13,color:'#ef4444',textAlign:'left',
                }}>
                  <span className="material-symbols-outlined" style={{fontSize:16,color:'#ef4444'}}>logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
