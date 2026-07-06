import React, { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../../utils';
import { useToast } from '../../context/ToastContext';
import DeleteSupplierModal from './DeleteSupplierModal';
import AddSupplierModal from './AddSupplierModal';
import { Loader2, RefreshCw, RotateCw, Trash2, Plus, Search, ChevronDown } from 'lucide-react';

const C = {
  sc:        '#171717',
  scHigh:    '#1f1f1f',
  scHighest: '#262626',
  outline:   'rgba(255,255,255,0.15)',
  outlineV:  'rgba(255,255,255,0.10)',
  muted:     '#a3a3a3',
  white:     '#ffffff',
  black:     '#000000',
  error:     '#ef4444',
};

const thStyle = {
  padding:'10px 16px', fontSize:11, fontWeight:600, letterSpacing:'0.06em',
  color:'#a3a3a3', textTransform:'uppercase', whiteSpace:'nowrap', textAlign:'left',
};
const tdStyle = { padding:'14px 16px', fontSize:13, lineHeight:'18px', borderBottom:'1px solid rgba(255,255,255,0.07)' };

function CustomDropdown({ value, onChange, options, placeholder, minWidth = '180px' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function clickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', clickOutside);
    }
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '7px 12px',
          background: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          outline: 'none',
          cursor: 'pointer',
          minWidth: minWidth,
          textAlign: 'left',
          fontFamily: 'inherit'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        <ChevronDown size={14} style={{ color: '#a3a3a3', flexShrink: 0 }} />
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            minWidth: minWidth,
            width: 'max-content',
            background: '#161616',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            overflowY: 'auto',
            maxHeight: '300px',
            padding: '4px 0'
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '12px 16px',
                  color: isSelected ? '#fff' : '#a3a3a3',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  background: isSelected
                    ? 'rgba(255, 255, 255, 0.08)'
                    : hoveredIdx === idx
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'transparent',
                  transition: 'background 0.1s ease, color 0.1s ease',
                  userSelect: 'none'
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SupplierTable({ 
  suppliers, 
  setSuppliers,
  riskScores, 
  loading, 
  onDelete, 
  onScan, 
  onAddSupplier, 
  pendingScanNames = [], 
  activePerRowScans = [], 
  bulkScanTargets = [],
  addOptimistic, 
  confirmOptimistic, 
  rollbackOptimistic,
  showAdd,
  setShowAdd,
  addSupplierFormPreset,
  setAddSupplierFormPreset
}) {
  const { showToast } = useToast();
  
  // Modals state
  const [pendingDelete, setPendingDelete] = useState(null);
  
  // Soft delete tracking state
  const [hiddenSupplierNames, setHiddenSupplierNames] = useState([]);
  const pendingDeletesRef = useRef({}); // mapping supplierName -> { undone: boolean, committed: boolean }

  // Active filters persisted in localStorage
  const [filters, setFilters] = useState(() => {
    try {
      const stored = localStorage.getItem('dashboard_filters');
      return stored ? JSON.parse(stored) : { search: '', riskLevel: '', country: '', category: '' };
    } catch {
      return { search: '', riskLevel: '', country: '', category: '' };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('dashboard_filters', JSON.stringify(filters));
    } catch (e) {
      console.error(e);
    }
  }, [filters]);

  const [hoveredScanBtnId, setHoveredScanBtnId] = useState(null);

  // Unmount cleanup: commit any pending deletions immediately
  useEffect(() => {
    return () => {
      Object.keys(pendingDeletesRef.current).forEach(name => {
        const pending = pendingDeletesRef.current[name];
        if (pending && !pending.undone && !pending.committed) {
          pending.committed = true;
          onDelete(name).catch(err => console.error("Unmount delete failed:", err));
        }
      });
    };
  }, [onDelete]);

  // Filter lists excluding PENDING_DELETE rows
  const visibleSuppliers = suppliers.filter(s => s.state !== 'PENDING_DELETE');

  // Compute active categories and countries lists dynamically
  const countriesList = [...new Set(visibleSuppliers.map(s => s.country).filter(Boolean))].sort();
  const categoriesList = [...new Set(visibleSuppliers.map(s => s.category).filter(Boolean))].sort();

  // Apply filters to list
  const filteredSuppliers = visibleSuppliers.filter(s => {
    // 1. Search Query (supplier name, country, or category)
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const matchName = s.supplier_name.toLowerCase().includes(q);
      const matchCountry = s.country.toLowerCase().includes(q);
      const matchCategory = s.category.toLowerCase().includes(q);
      if (!matchName && !matchCountry && !matchCategory) return false;
    }
    // 2. Risk Level Filter (based on derived badge value)
    if (filters.riskLevel) {
      const score = riskScores.find(r => r.supplier_name === s.supplier_name);
      const derived = s.state === 'PENDING' ? 'PENDING' : 
                      s.state === 'SAVING' ? 'SAVING' : 
                      (score?.risk_level?.toUpperCase() || 'NOT ASSESSED');
      if (derived !== filters.riskLevel.toUpperCase()) return false;
    }
    // 3. Country Filter
    if (filters.country) {
      if (s.country.toLowerCase() !== filters.country.toLowerCase()) return false;
    }
    // 4. Category Filter
    if (filters.category) {
      if (s.category.toLowerCase() !== filters.category.toLowerCase()) return false;
    }
    return true;
  });

  const isBulkScanning = bulkScanTargets.length > 0;
  const isSavingInProgress = suppliers.some(s => s.state === 'SAVING');
  
  // Scan All Button is enabled when >= 1 supplier exists in the table and no SAVING rows are in flight
  const isScanAllEnabled = visibleSuppliers.length > 0 && !isSavingInProgress && !isBulkScanning;

  const handleScanAll = () => {
    // Lock snapshot of ASSESSED suppliers (those with a real risk level, excluding PENDING, SAVING, or PENDING_DELETE)
    const assessedSuppliers = visibleSuppliers.filter(s => {
      if (s.state === 'PENDING' || s.state === 'SAVING') return false;
      const score = riskScores.find(r => r.supplier_name === s.supplier_name);
      return !!score;
    });

    const targetNames = assessedSuppliers.map(s => s.supplier_name);
    if (targetNames.length === 0) return;
    onScan(targetNames, false); // triggers bulk scan
  };

  const handlePerRowScan = (name) => {
    if (activePerRowScans.includes(name) || isBulkScanning) return;
    onScan([name], true); // triggers per-row scan
  };

  const handleConfirmDelete = (name) => {
    setPendingDelete(null);

    // Get previous state to restore if undone
    const previousSupplier = suppliers.find(s => s.supplier_name === name);
    const previousState = previousSupplier ? previousSupplier.state : 'NOT_ASSESSED';

    // Hide row immediately and set to PENDING_DELETE state
    setSuppliers(prev => prev.map(s => {
      if (s.supplier_name === name) {
        return { ...s, state: 'PENDING_DELETE' };
      }
      return s;
    }));
    setHiddenSupplierNames(prev => [...prev, name]);

    // Track deletion
    pendingDeletesRef.current[name] = { name, undone: false, committed: false };

    showToast('supplierRemoved', name, {
      hasUndo: true,
      onUndo: () => {
        if (pendingDeletesRef.current[name]) {
          pendingDeletesRef.current[name].undone = true;
        }
        // Restore row in local state
        setSuppliers(prev => prev.map(s => {
          if (s.supplier_name === name) {
            return { ...s, state: previousState };
          }
          return s;
        }));
        setHiddenSupplierNames(prev => prev.filter(n => n !== name));
        showToast('supplierRestored', name);
      },
      onDismiss: (wasUndone) => {
        const pending = pendingDeletesRef.current[name];
        if (pending && !pending.undone && !pending.committed) {
          pending.committed = true;
          onDelete(name).catch(e => {
            showToast('Delete Failed', e.message, 'error');
            // Restore row in local state on error
            setSuppliers(prev => prev.map(s => {
              if (s.supplier_name === name) {
                return { ...s, state: previousState };
              }
              return s;
            }));
            setHiddenSupplierNames(prev => prev.filter(n => n !== name));
          });
          delete pendingDeletesRef.current[name];
        }
      }
    });
  };

  const handleAddSupplierConfirm = (supplierData) => {
    setShowAdd(false);
    const localDate = new Date().toLocaleDateString('en-CA');
    const dataWithTime = {
      ...supplierData,
      added_date: localDate
    };
    setAddSupplierFormPreset(supplierData);
    addOptimistic([dataWithTime]);

    // Background upload flow
    (async () => {
      try {
        await onAddSupplier([dataWithTime]);
        confirmOptimistic([dataWithTime]);
        setAddSupplierFormPreset(null);
        showToast('supplierAdded', supplierData.supplier_name);

        // Immediately auto-trigger a scan for this supplier alone
        onScan([supplierData.supplier_name], true);
      } catch (e) {
        rollbackOptimistic([dataWithTime]);
        showToast('failedToAdd', supplierData.supplier_name);
        setShowAdd(true);
      }
    })();
  };

  // Supplier Count Chip: Excludes PENDING_DELETE rows instantly
  const totalCount = visibleSuppliers.length;
  const filteredCount = filteredSuppliers.length;
  const hasActiveFilters = !!(filters.search.trim() || filters.riskLevel || filters.country || filters.category);

  // Custom risk badge renderer
  const riskBadge = (state, riskLevel) => {
    const base = {
      display: 'inline-block',
      padding: '2px 8px 3px',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      borderRadius: 3,
      textTransform: 'uppercase'
    };
    if (state === 'SAVING') {
      return <span style={{ ...base, background: 'rgba(255,255,255,.04)', color: '#737373', border: '1px solid rgba(255,255,255,.08)', fontStyle: 'italic', textTransform: 'none' }}>Saving...</span>;
    }
    if (state === 'PENDING') {
      return <span style={{ ...base, background: 'rgba(255,255,255,.06)', color: '#a3a3a3', border: '1px solid rgba(255,255,255,.12)' }}>PENDING</span>;
    }
    
    const l = riskLevel?.toUpperCase() || 'NOT ASSESSED';
    if (l === 'HIGH' || l === 'CRITICAL') {
      return <span style={{ ...base, background: 'rgba(239,68,68,.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)', boxShadow: '0 0 10px rgba(239,68,68,.12)' }}>{l}</span>;
    }
    if (l === 'MEDIUM') {
      return <span style={{ ...base, background: 'rgba(245,158,11,.10)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)', boxShadow: '0 0 10px rgba(245,158,11,.10)' }}>{l}</span>;
    }
    if (l === 'LOW') {
      return <span style={{ ...base, background: 'rgba(34,197,94,.10)', color: '#4ade80', border: '1px solid rgba(34,197,94,.25)' }}>{l}</span>;
    }
    if (l === 'SECURITY') {
      return <span style={{ ...base, background: 'rgba(239,68,68,.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' }}>SECURITY</span>;
    }
    return <span style={{ ...base, background: 'rgba(255,255,255,.06)', color: '#a3a3a3', border: '1px solid rgba(255,255,255,.12)' }}>NOT ASSESSED</span>;
  };

  return (
    <section>
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <h2 style={{fontSize:15,fontWeight:600,letterSpacing:'-.01em',color:'#fff',whiteSpace:'nowrap'}}>Monitored Suppliers</h2>
          {!loading && (
            <span style={{
              padding:'2px 10px', fontSize:11, fontWeight:600, letterSpacing:'0.05em',
              background:'#262626', color:'#fff', borderRadius:999,
              border:'1px solid rgba(255,255,255,0.10)',
            }}>
              {hasActiveFilters 
                ? `${filteredCount} of ${totalCount} suppliers`
                : `${totalCount} supplier${totalCount !== 1 ? 's' : ''}`
              }
            </span>
          )}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {/* Add Supplier Button */}
          <button onClick={()=>setShowAdd(true)} style={{
            display:'flex',alignItems:'center',gap:6,
            padding:'7px 14px',
            background:'#fff',color:'#000',
            border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',
            transition:'opacity .15s',
          }}>
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>

          {/* Unified Scan All Button */}
          <button 
            onClick={handleScanAll} 
            disabled={!isScanAllEnabled} 
            style={{
              display:'flex',alignItems:'center',gap:6,
              padding:'7px 14px',
              background: isScanAllEnabled ? '#262626' : 'rgba(255,255,255,0.05)',
              color: isScanAllEnabled ? '#fff' : C.muted,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius:8,fontSize:13,fontWeight:600,
              cursor: isScanAllEnabled ? 'pointer' : 'not-allowed',
              transition:'background .15s, color .15s',
              outline: 'none',
            }}
          >
            {isBulkScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isBulkScanning ? 'Scanning…' : 'Scan All'}
          </button>
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',
        background: '#121212',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
      }}>
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, color: '#a3a3a3'
          }} />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{
              width: '100%',
              padding: '7px 10px 7px 34px',
              background: '#0a0a0a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>

        {/* Risk Level Filter */}
        <CustomDropdown
          value={filters.riskLevel}
          onChange={val => setFilters(prev => ({ ...prev, riskLevel: val }))}
          options={[
            { value: "", label: "All Risk Levels" },
            { value: "HIGH", label: "HIGH" },
            { value: "MEDIUM", label: "MEDIUM" },
            { value: "LOW", label: "LOW" },
            { value: "SECURITY", label: "SECURITY" },
            { value: "PENDING", label: "PENDING" },
            { value: "NOT ASSESSED", label: "NOT ASSESSED" }
          ]}
          placeholder="All Risk Levels"
          minWidth="180px"
        />

        {/* Country Filter */}
        <CustomDropdown
          value={filters.country}
          onChange={val => setFilters(prev => ({ ...prev, country: val }))}
          options={[
            { value: "", label: "All Countries" },
            ...countriesList.map(c => ({ value: c, label: c }))
          ]}
          placeholder="All Countries"
          minWidth="180px"
        />

        {/* Category Filter */}
        <CustomDropdown
          value={filters.category}
          onChange={val => setFilters(prev => ({ ...prev, category: val }))}
          options={[
            { value: "", label: "All Categories" },
            ...categoriesList.map(c => ({ value: c, label: c }))
          ]}
          placeholder="All Categories"
          minWidth="180px"
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div style={{background:C.sc,border:`1px solid ${C.outlineV}`,borderRadius:12,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:C.scHigh,borderBottom:`1px solid ${C.outlineV}`}}>
              <th style={thStyle}>Supplier Name</th>
              <th style={thStyle}>Country</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Added</th>
              <th style={thStyle}>Risk Level</th>
              <th style={{...thStyle,textAlign:'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i=>(
                <tr key={i} style={{opacity:.5}}>
                  {[200,100,120,80,90,40].map((w,j)=>(
                    <td key={j} style={{...tdStyle,paddingTop:16,paddingBottom:16}}>
                      <div className="skeleton" style={{height:12,width:w,borderRadius:4}} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredSuppliers.length===0 ? (
              <tr>
                <td colSpan={6}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 24px'}}>
                    <div style={{
                      width:64,height:64,borderRadius:'50%',
                      background:'rgba(255,255,255,.05)',
                      border:`1px solid ${C.outlineV}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      marginBottom:16,
                    }}>
                      <Search className="w-8 h-8 text-neutral-500" />
                    </div>
                    <h3 style={{fontSize:15,fontWeight:600,color:'#fff',marginBottom:6}}>No suppliers found.</h3>
                    <p style={{fontSize:13,color:C.muted,textAlign:'center',maxWidth:300,lineHeight:1.5}}>
                      Try adjusting your search query or filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredSuppliers.map((s,i)=>{
              const scoreObj = riskScores.find(r=>r.supplier_name===s.supplier_name);
              const isRowPending = s.state === 'PENDING';
              const isTrashDisabled = isBulkScanning || s.state === 'SAVING' || s.state === 'PENDING' || s.state === 'PENDING_DELETE';
              const isScanRowDisabled = isBulkScanning || s.state === 'SAVING' || s.state === 'PENDING' || s.state === 'PENDING_DELETE';
              
              return (
                <tr key={i} style={{cursor:'default'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}
                >
                  <td style={{...tdStyle,fontWeight:600,color:'#fff'}}>{s.supplier_name}</td>
                  <td style={{...tdStyle,color:C.muted}}>{s.country}</td>
                  <td style={{...tdStyle,color:C.muted}}>{s.category}</td>
                  <td style={{...tdStyle,color:C.muted}}>{timeAgo(s.added_date)}</td>
                  <td style={tdStyle}>{riskBadge(s.state, scoreObj?.risk_level)}</td>
                  <td style={{...tdStyle,textAlign:'right'}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:8}}>
                      {/* Row-level Scan Trigger */}
                      <div
                        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={() => setHoveredScanBtnId(s.supplier_name)}
                        onMouseLeave={() => setHoveredScanBtnId(null)}
                      >
                        {hoveredScanBtnId === s.supplier_name && (
                          <div style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap',
                            zIndex: 100,
                            background: '#1f1f1f',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            color: '#fff',
                            fontSize: 12,
                            boxShadow: 'none',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {(() => {
                              if (s.state === 'SAVING') return "Waiting for supplier to save...";
                              if (s.state === 'PENDING') return "Scan in progress...";
                              const hasScore = riskScores.some(r => r.supplier_name === s.supplier_name);
                              return hasScore ? "Re-scan this supplier" : "Scan this supplier";
                            })()}
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '5px solid transparent',
                              borderRight: '5px solid transparent',
                              borderTop: '5px solid #1f1f1f',
                            }} />
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%) translateY(1px)',
                              width: 0,
                              height: 0,
                              borderLeft: '6px solid transparent',
                              borderRight: '6px solid transparent',
                              borderTop: '6px solid rgba(255, 255, 255, 0.1)',
                              zIndex: -1
                            }} />
                          </div>
                        )}
                        <button
                          onClick={() => handlePerRowScan(s.supplier_name)}
                          disabled={isScanRowDisabled}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: isScanRowDisabled ? 'not-allowed' : 'pointer',
                            color: isScanRowDisabled ? '#404040' : C.muted,
                            padding: '2px 4px',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none',
                            transition: 'color .15s'
                          }}
                          onMouseEnter={e => { if (!isScanRowDisabled) e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = isScanRowDisabled ? '#404040' : C.muted; }}
                        >
                          <RotateCw className={`w-4.5 h-4.5 ${isRowPending ? 'animate-spin text-white' : ''}`} />
                        </button>
                      </div>

                      {/* Trash Button */}
                      <button
                        onClick={() => setPendingDelete(s.supplier_name)}
                        disabled={isTrashDisabled}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: isTrashDisabled ? 'not-allowed' : 'pointer',
                          color: isTrashDisabled ? '#404040' : C.muted,
                          padding:'2px 4px',
                          borderRadius:4,
                          transition:'color .15s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: 'none'
                        }}
                        onMouseEnter={e=>{ if (!isTrashDisabled) e.currentTarget.style.color='#ef4444'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.color=isTrashDisabled ? '#404040' : C.muted; }}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {pendingDelete && (
        <DeleteSupplierModal 
          supplierName={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* ── Add Supplier Modal ────────────────────────────────────────────── */}
      {showAdd && (
        <AddSupplierModal 
          onCancel={() => setShowAdd(false)}
          onAdd={handleAddSupplierConfirm}
          initialData={addSupplierFormPreset}
          existingSuppliers={suppliers}
        />
      )}
    </section>
  );
}
