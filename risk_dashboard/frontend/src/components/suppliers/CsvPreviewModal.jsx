import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { COUNTRIES, isValidCountry, getCanonicalCountry } from '../../utils/countries';
import { XCircle, Check, X, Pencil, Trash2 } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:        '#121212',
  bgHigh:    '#1a1a1a',
  bgHighest: '#2a2a2a',
  surface:   '#121212',
  outline:   '#2a2a2a',
  outlineV:  '#3f3f3f',
  onSurface: '#efefef',
  onMuted:   '#a1a1aa',
  error:     '#ef4444',
  amber:     '#b45309',   // duplicate tone
  amberBg:   'rgba(180,83,9,0.10)',
  amberBdr:  'rgba(180,83,9,0.25)',
};

const NAME_MAX     = 60;
const CATEGORY_MAX = 40;

// ── Validation logic ──────────────────────────────────────────────────────────
// Returns { status: 'valid'|'error'|'duplicate', error: string|null }
function validateRow(row, allRows, selfIdx, existingSuppliers) {
  const name     = (row.supplier_name || '').trim();
  const country  = (row.country || '').trim();
  const category = (row.category || '').trim();

  // Field validation (order: name → country → category)
  if (!name || name.includes('\n') || name.length > NAME_MAX) {
    return { status: 'error', error: 'Invalid Name' };
  }
  if (!isValidCountry(country)) {
    return { status: 'error', error: 'Invalid Country' };
  }
  if (!category || category.includes('\n') || category.length > CATEGORY_MAX) {
    return { status: 'error', error: 'Invalid Category' };
  }

  // Duplicate check — case-insensitive against existing suppliers in DB
  const nameLc     = name.toLowerCase();
  const countryLc  = country.toLowerCase();
  const categoryLc = category.toLowerCase();

  const inExisting = existingSuppliers.some(s =>
    (s.supplier_name || '').toLowerCase() === nameLc &&
    (s.country || '').toLowerCase()       === countryLc &&
    (s.category || '').toLowerCase()      === categoryLc
  );
  if (inExisting) return { status: 'duplicate', error: 'Duplicate' };

  // Duplicate within the CSV rows themselves (ignore self)
  const inRows = allRows.some((r, i) =>
    i !== selfIdx &&
    (r.supplier_name || '').toLowerCase() === nameLc &&
    (r.country || '').toLowerCase()       === countryLc &&
    (r.category || '').toLowerCase()      === categoryLc
  );
  if (inRows) return { status: 'duplicate', error: 'Duplicate' };

  return { status: 'valid', error: null };
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, error }) {
  if (status === 'valid') {
    return (
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'2px 8px', borderRadius:4,
        background:'rgba(34,197,94,.10)', border:'1px solid rgba(34,197,94,.20)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize:13, color:'#22c55e', fontVariationSettings:"'FILL' 1" }}>check_circle</span>
        <span style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', color:'#22c55e', textTransform:'uppercase' }}>Valid</span>
      </div>
    );
  }
  if (status === 'duplicate') {
    return (
      <div style={{
        display:'inline-flex', alignItems:'center', gap:5,
        padding:'2px 8px', borderRadius:4,
        background:T.amberBg, border:`1px solid ${T.amberBdr}`,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize:13, color:T.amber, fontVariationSettings:"'FILL' 1" }}>content_copy</span>
        <span style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', color:T.amber, textTransform:'uppercase' }}>Duplicate</span>
      </div>
    );
  }
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 8px', borderRadius:4,
      background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.20)',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize:13, color:T.error, fontVariationSettings:"'FILL' 1" }}>error</span>
      <span style={{ fontSize:10, fontWeight:600, letterSpacing:'0.06em', color:T.error, textTransform:'uppercase' }}>{error}</span>
    </div>
  );
}

// ── Searchable country dropdown ───────────────────────────────────────────────
function CountrySelect({ value, onChange }) {
  const [query,    setQuery]    = useState(value || '');
  const [open,     setOpen]     = useState(false);
  const [focused,  setFocused]  = useState(false);
  const wrapRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const [renderDropdown, setRenderDropdown] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRenderDropdown(true);
      setClosing(false);
    } else if (renderDropdown) {
      setClosing(true);
      const t = setTimeout(() => {
        setRenderDropdown(false);
        setClosing(false);
      }, 150); // Match --dropdown-close-dur (150ms)
      return () => clearTimeout(t);
    }
  }, [open, renderDropdown]);

  // Keep query in sync when value prop changes
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { 
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        const portalMenu = document.getElementById('country-portal-menu');
        if (portalMenu && portalMenu.contains(e.target)) return;
        setOpen(false); 
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateCoords = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open, updateCoords, query]);

  const normalizeStr = (str) => (str || '').toLowerCase().replace(/\s+/g, '');
  const filtered = query.trim()
    ? COUNTRIES.filter(c => normalizeStr(c).includes(normalizeStr(query))).slice(0, 8)
    : COUNTRIES.slice(0, 8);

  const handleSelect = (country) => {
    setQuery(country);
    onChange(country);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%' }}>
      <input
        type="text"
        value={query}
        placeholder="Search country…"
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        style={{
          width:'100%', padding:'4px 8px', fontSize:13,
          background: T.bgHighest, color: T.onSurface,
          border:`1px solid ${focused ? T.outlineV : T.outline}`,
          borderRadius:4, outline:'none', fontFamily:'Inter, sans-serif',
          boxSizing:'border-box',
        }}
      />
      {renderDropdown && filtered.length > 0 && createPortal(
        <div 
          id="country-portal-menu"
          className={`t-dropdown ${closing ? 'is-closing' : 'is-open'}`}
          data-origin="top-center"
          style={{
            position:'absolute', 
            top: coords.top + 2, 
            left: coords.left, 
            width: coords.width,
            minWidth: '180px',
            background:'#161616', 
            border:'1px solid rgba(255, 255, 255, 0.08)',
            borderRadius:8, 
            zIndex:9999, 
            overflow:'hidden',
            boxShadow:'0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            maxHeight:200, 
            overflowY:'auto',
            padding: '4px 0'
          }}
        >
          {filtered.map(c => {
            const isSelected = c === value;
            return (
              <div
                key={c}
                onMouseDown={() => handleSelect(c)}
                style={{
                  padding:'12px 16px', fontSize:13, color: isSelected ? '#fff' : T.onSurface,
                  cursor:'pointer', transition:'background .1s, color .1s',
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background='rgba(255, 255, 255, .04)')}
                onMouseLeave={e => !isSelected && (e.currentTarget.style.background='transparent')}
              >{c}</div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Category autocomplete ─────────────────────────────────────────────────────
function CategoryInput({ value, onChange, existingCategories }) {
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);

  const [renderDropdown, setRenderDropdown] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRenderDropdown(true);
      setClosing(false);
    } else if (renderDropdown) {
      setClosing(true);
      const t = setTimeout(() => {
        setRenderDropdown(false);
        setClosing(false);
      }, 150); // Match --dropdown-close-dur (150ms)
      return () => clearTimeout(t);
    }
  }, [open, renderDropdown]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = value.trim()
    ? existingCategories.filter(c => c.toLowerCase().startsWith(value.trim().toLowerCase()) && c.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6)
    : [];

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%' }}>
      <input
        type="text"
        value={value}
        maxLength={CATEGORY_MAX}
        placeholder="Category…"
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        onChange={e => { onChange(e.target.value.replace(/\n/g, '')); setOpen(true); }}
        style={{
          width:'100%', padding:'4px 8px', fontSize:13,
          background: T.bgHighest, color: T.onSurface,
          border:`1px solid ${focused ? T.outlineV : T.outline}`,
          borderRadius:4, outline:'none', fontFamily:'Inter, sans-serif',
          boxSizing:'border-box',
        }}
      />
      {renderDropdown && suggestions.length > 0 && (
        <div 
          className={`t-dropdown ${closing ? 'is-closing' : 'is-open'}`}
          data-origin="top-center"
          style={{
            position:'absolute', top:'calc(100% + 2px)', left:0, right:0,
            minWidth: '180px',
            background:'#161616', 
            border:'1px solid rgba(255, 255, 255, 0.08)',
            borderRadius:8, zIndex:500, overflow:'hidden',
            boxShadow:'0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            padding: '4px 0'
          }}
        >
          {suggestions.map(s => {
            const isSelected = s === value;
            return (
              <div
                key={s}
                onMouseDown={() => { onChange(s); setOpen(false); }}
                style={{
                  padding:'12px 16px', fontSize:13, color: isSelected ? '#fff' : T.onSurface,
                  cursor:'pointer', transition:'background .1s, color .1s',
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onMouseEnter={e => !isSelected && (e.currentTarget.style.background='rgba(255, 255, 255, .04)')}
                onMouseLeave={e => !isSelected && (e.currentTarget.style.background='transparent')}
              >{s}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CsvPreviewModal({ rows, onClose, onConfirm, existingSuppliers = [] }) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = (callback) => {
    setIsOpen(false);
    setTimeout(() => {
      callback();
    }, 150); // Match --modal-close-dur (150ms)
  };

  // Derive unique existing categories for autocomplete
  const existingCategories = [...new Set(existingSuppliers.map(s => s.category).filter(Boolean))].sort();

  // Run full validation on every row
  const validate = useCallback((rowList) =>
    rowList.map((row, idx) => {
      const { status, error } = validateRow(row, rowList, idx, existingSuppliers);
      return { ...row, _status: status, _error: error };
    }), [existingSuppliers]);

  const [previewRows, setPreviewRows] = useState(() => validate(rows));
  const [editingIdx,  setEditingIdx]  = useState(null);
  const [uploading,   setUploading]   = useState(false);

  // Edit buffers
  const [editName,     setEditName]     = useState('');
  const [editCountry,  setEditCountry]  = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Re-validate the edit row live on every keystroke
  const editRowLive = useCallback((name, country, category) => {
    if (editingIdx === null) return;
    const draft = { supplier_name: name, country, category };
    const { status, error } = validateRow(draft, previewRows, editingIdx, existingSuppliers);
    setPreviewRows(prev => {
      const updated = [...prev];
      updated[editingIdx] = { ...updated[editingIdx], supplier_name: name, country, category, _status: status, _error: error };
      return updated;
    });
  }, [editingIdx, previewRows, existingSuppliers]);

  const handleNameChange = (v) => { const s = v.replace(/\n/g,'').slice(0, NAME_MAX); setEditName(s); editRowLive(s, editCountry, editCategory); };
  const handleCountryChange = (v) => { setEditCountry(v); editRowLive(editName, v, editCategory); };
  const handleCategoryChange = (v) => { setEditCategory(v); editRowLive(editName, editCountry, v); };

  const handleStartEdit = (idx, row) => {
    setEditingIdx(idx);
    setEditName(row.supplier_name || '');
    setEditCountry(row.country || '');
    setEditCategory(row.category || '');
  };

  const handleSaveEdit = () => {
    if (editingIdx === null) return;
    const draft = { supplier_name: editName.trim(), country: getCanonicalCountry(editCountry.trim()) || editCountry.trim(), category: editCategory.trim() };
    const updated = [...previewRows];
    updated[editingIdx] = { ...updated[editingIdx], ...draft };
    // Re-validate all (save may resolve a duplicate)
    const revalidated = validate(updated);
    setPreviewRows(revalidated);
    setEditingIdx(null);
  };

  const handleCancelEdit = () => {
    // Revert changes for that row
    setPreviewRows(prev => {
      const reverted = [...prev];
      reverted[editingIdx] = { ...reverted[editingIdx], supplier_name: editName, country: editCountry, category: editCategory };
      return validate(reverted);
    });
    setEditingIdx(null);
  };

  const handleRemoveRow = (idx) => {
    const updated = previewRows.filter((_, i) => i !== idx);
    setPreviewRows(validate(updated));
  };

  const handleRemoveAllErrors = () => {
    const totalToRemove = errorCount + duplicateCount;
    if (totalToRemove === 0) return;

    if (validCount === 0) {
      const confirmAll = window.confirm(`Remove all ${totalToRemove} rows with errors?`);
      if (!confirmAll) return;
    }

    const updated = previewRows.filter(r => r._status === 'valid');
    setPreviewRows(updated);
  };

  const handleConfirm = () => {
    const validRows = previewRows.filter(r => r._status === 'valid');
    if (validRows.length === 0) return;

    setUploading(true);
    onConfirm(validRows);
    setUploading(false);
  };

  // Counts
  const validCount     = previewRows.filter(r => r._status === 'valid').length;
  const errorCount     = previewRows.filter(r => r._status === 'error').length;
  const duplicateCount = previewRows.filter(r => r._status === 'duplicate').length;

  // Shared input style
  const nameInput = {
    width:'100%', padding:'4px 8px', fontSize:13,
    background: T.bgHighest, color: T.onSurface,
    border:`1px solid ${T.outline}`, borderRadius:4,
    outline:'none', fontFamily:'Inter, sans-serif', boxSizing:'border-box',
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:60,
      background:'rgba(0,0,0,0.80)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      opacity: isOpen ? 1 : 0,
      transition: 'opacity 250ms ease'
    }}>
      <div 
        className={`t-modal ${isOpen ? 'is-open' : 'is-closing'}`}
        style={{
          width:'100%', maxWidth:880,
          background: T.bg,
          border:`1px solid ${T.outline}`,
          borderRadius:12,
          display:'flex', flexDirection:'column',
          boxShadow:'0 24px 64px rgba(0,0,0,0.7)',
          overflow:'hidden',
        }}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ padding:'20px 20px 16px', background:T.bgHigh, borderBottom:`1px solid ${T.outline}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h2 style={{ fontSize:15, fontWeight:600, letterSpacing:'-0.01em', color:T.onSurface, marginBottom:6 }}>
                CSV Import Preview
              </h2>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:12, color:T.onMuted }}>
                <span>
                  {previewRows.length} supplier{previewRows.length!==1?'s':''} found — {validCount} valid
                  {errorCount > 0 ? `, ${errorCount} with error${errorCount!==1?'s':''}` : ''}
                  {duplicateCount > 0 ? `, ${duplicateCount} duplicate${duplicateCount!==1?'s':''}` : ''}
                </span>

                {(errorCount > 0 || duplicateCount > 0) && (
                  <>
                    <Dot />
                    <button
                      onClick={handleRemoveAllErrors}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: T.error,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 0,
                        outline: 'none'
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      <XCircle className="w-3.5 h-3.5" style={{ color: T.error }} />
                      Remove all errors
                    </button>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => handleClose(onClose)}
              style={{ background:'none', border:'none', cursor:'pointer', color:T.onMuted, padding:2, borderRadius:4, display:'flex', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.color=T.onSurface}
              onMouseLeave={e => e.currentTarget.style.color=T.onMuted}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div style={{ flexGrow:1, overflowY:'auto', maxHeight:480, background:T.surface }}>
          <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, textAlign:'left' }}>
            <thead style={{ position:'sticky', top:0, zIndex:10, background:T.bgHighest }}>
              <tr>
                {['Supplier Name','Country','Category','Status'].map(col => (
                  <th key={col} style={{
                    padding:'12px 16px', fontSize:11, fontWeight:600,
                    letterSpacing:'0.06em', textTransform:'uppercase',
                    color:T.onMuted, borderBottom:`1px solid ${T.outline}`, whiteSpace:'nowrap',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => {
                const isEditing  = editingIdx === idx;
                const { _status: status, _error: errMsg } = row;
                const rowBg      = status === 'error' ? 'rgba(239,68,68,.04)' : status === 'duplicate' ? 'rgba(180,83,9,.04)' : 'transparent';
                const rowBgHov   = status === 'error' ? 'rgba(239,68,68,.08)' : status === 'duplicate' ? 'rgba(180,83,9,.08)' : 'rgba(255,255,255,.03)';

                return (
                  <tr
                    key={idx}
                    style={{ background: rowBg, transition:'background .15s' }}
                    onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background=rowBgHov; }}
                    onMouseLeave={e => { e.currentTarget.style.background=rowBg; }}
                  >
                    {/* Supplier Name */}
                    <td style={{ padding:'14px 16px', fontSize:13, color:T.onSurface, borderBottom:`1px solid ${T.outline}` }}>
                      {isEditing ? (
                        <input
                          value={editName}
                          maxLength={NAME_MAX}
                          onChange={e => handleNameChange(e.target.value)}
                          style={nameInput}
                          autoFocus
                          onFocus={e => e.target.style.borderColor=T.outlineV}
                          onBlur={e => e.target.style.borderColor=T.outline}
                        />
                      ) : (
                        row.supplier_name || <em style={{ color:T.onMuted, opacity:.5 }}>empty</em>
                      )}
                    </td>

                    {/* Country */}
                    <td style={{ padding:'14px 16px', fontSize:13, color: status==='error'&&errMsg==='Invalid Country' ? T.error : T.onMuted, borderBottom:`1px solid ${T.outline}` }}>
                      {isEditing ? (
                        <CountrySelect value={editCountry} onChange={handleCountryChange} />
                      ) : (
                        row.country || <em style={{ color:T.onMuted, opacity:.5 }}>empty</em>
                      )}
                    </td>

                    {/* Category */}
                    <td style={{ padding:'14px 16px', fontSize:13, color:T.onMuted, borderBottom:`1px solid ${T.outline}` }}>
                      {isEditing ? (
                        <CategoryInput value={editCategory} onChange={handleCategoryChange} existingCategories={existingCategories} />
                      ) : (
                        row.category || <em style={{ color:T.onMuted, opacity:.5 }}>empty</em>
                      )}
                    </td>

                    {/* Status + Actions */}
                    <td style={{ padding:'14px 16px', borderBottom:`1px solid ${T.outline}` }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                        <StatusBadge status={status} error={errMsg} />

                        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                          {isEditing ? (
                            <>
                              <button title="Save" onClick={handleSaveEdit} style={{ background:'none', border:'none', cursor:'pointer', color:'#22c55e' }}>
                                <Check className="w-4 h-4" />
                              </button>
                              <button title="Cancel" onClick={handleCancelEdit} style={{ background:'none', border:'none', cursor:'pointer', color:T.onMuted }}>
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button title="Edit" onClick={() => handleStartEdit(idx, row)} style={{ background:'none', border:'none', cursor:'pointer', color:T.onSurface }}>
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button title="Remove" onClick={() => handleRemoveRow(idx)} style={{ background:'none', border:'none', cursor:'pointer', color:T.error }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          padding:'14px 16px', borderTop:`1px solid ${T.outline}`,
          background:T.bgHigh, display:'flex', justifyContent:'flex-end', gap:10, flexShrink:0,
        }}>
          <button
            onClick={() => handleClose(onClose)}
            disabled={uploading}
            style={{ padding:'8px 18px', fontSize:14, fontWeight:600, color:T.onMuted, background:'rgba(255,255,255,.05)', border:`1px solid ${T.outline}`, borderRadius:6, cursor:'pointer', fontFamily:'Inter, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.10)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}
          >Cancel</button>

          <button
            onClick={handleConfirm}
            disabled={uploading || validCount === 0}
            style={{
              padding:'8px 22px', fontSize:14, fontWeight:700,
              color:'#121212',
              background: uploading||validCount===0 ? 'rgba(239,239,239,.4)' : '#efefef',
              border:'none', borderRadius:6,
              cursor: uploading||validCount===0 ? 'not-allowed' : 'pointer',
              fontFamily:'Inter, sans-serif',
              boxShadow:'0 4px 12px rgba(0,0,0,.3)',
              transition:'filter .15s',
            }}
            onMouseEnter={e => { if (!uploading&&validCount>0) e.currentTarget.style.filter='brightness(1.1)'; }}
            onMouseLeave={e => e.currentTarget.style.filter='none'}
          >
            {uploading ? 'Processing…' : `Upload ${validCount} Supplier${validCount!==1?'s':''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function Dot() {
  return <span style={{ width:3, height:3, borderRadius:'50%', background:'#2a2a2a', display:'inline-block' }} />;
}
