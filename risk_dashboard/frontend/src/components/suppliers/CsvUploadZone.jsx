import React, { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

export default function CsvUploadZone({ onFileParsed }) {
  const { showToast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const parseFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('csvFail', 'Please upload a valid CSV file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if (lines.length < 2) { showToast('csvFail', 'The uploaded CSV file is empty.'); return; }
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/^["']|["']$/g,''));
      const required = ['supplier_name','country','category'];
      const missing = required.filter(r=>!headers.includes(r));
      if (missing.length>0) { showToast('csvFail', `Invalid Columns. Missing: ${missing.join(', ')}`); return; }
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v=>v.trim().replace(/^["']|["']$/g,''));
        const row = {};
        headers.forEach((h,i) => row[h] = vals[i]||'');
        row.error = null;
        return row;
      });
      onFileParsed(rows);
    };
    reader.readAsText(file);
  };

  const handleDownload = (e) => {
    e.preventDefault(); e.stopPropagation();
    const csv = "supplier_name,country,category\nAcme Electronics,Thailand,Electronics\n";
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'supplier_template.csv';
    a.click();
  };

  return (
    <section>
      <div
        onClick={() => fileInputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); parseFile(e.dataTransfer.files[0]); }}
        style={{
          background: dragOver ? '#1f1f1f' : '#171717',
          border: `1.5px dashed ${dragOver ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 12,
          padding: '40px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', cursor: 'pointer',
          transition: 'all .2s',
        }}
      >
        <input ref={fileInputRef} type="file" accept=".csv" style={{display:'none'}} onChange={e=>parseFile(e.target.files[0])} />

        {/* Upload icon */}
        <div style={{
          width:48, height:48, background:'rgba(255,255,255,.05)', borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16,
          color: 'rgba(163,163,163,1)',
        }}>
          <span className="material-symbols-outlined" style={{fontSize:28}}>cloud_upload</span>
        </div>

        <h2 style={{fontSize:15,fontWeight:600,color:'#fff',marginBottom:4}}>Drag and drop a CSV, or click to browse</h2>
        <p style={{fontSize:12,color:'#a3a3a3',marginBottom:24}}>Bulk upload supplier data to begin real-time risk monitoring</p>

        <button
          onClick={handleDownload}
          style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'8px 16px',
            background:'rgba(255,255,255,.05)',
            border:'1px solid rgba(255,255,255,.10)',
            borderRadius:8,
            fontSize:15, fontWeight:600, color:'#fff',
            cursor:'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{fontSize:16}}>download</span>
          Download Template
        </button>
      </div>
    </section>
  );
}
