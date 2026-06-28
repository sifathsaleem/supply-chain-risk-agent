import React, { useState, useRef } from 'react';
import { Upload, Download, AlertCircle } from 'lucide-react';
import CsvPreviewModal from './CsvPreviewModal';
import { useToast } from '../../context/ToastContext';

export default function CsvUploadZone({ onUploadSuccess }) {
  const { showToast } = useToast();
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) parseFile(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const parseFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a valid CSV file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 1) {
        showToast('The CSV file is empty.', 'error');
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      const required = ['supplier_name', 'country', 'category'];
      const missing = required.filter(r => !headers.includes(r));

      if (missing.length > 0) {
        showToast(`CSV missing required columns: ${missing.join(', ')}`, 'error');
        return;
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple comma split (could be enhanced, but matches user spec)
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const rowData = {};
        headers.forEach((h, idx) => {
          rowData[h] = values[idx] || '';
        });

        // Validate
        const missingFields = required.filter(field => !rowData[field]);
        if (missingFields.length > 0) {
          rowData.error = `Missing required field(s): ${missingFields.join(', ')}`;
        } else {
          rowData.error = null;
        }

        rows.push(rowData);
      }

      setParsedRows(rows);
      setShowModal(true);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = (e) => {
    e.preventDefault();
    const csvContent = "supplier_name,country,category\nAcme Electronics,Thailand,Electronics\nBeta Textiles,Bangladesh,Apparel\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "supplier_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span>📤</span> Upload Suppliers
      </h2>

      <div
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-150 ${
          dragOver
            ? 'border-white bg-[rgba(255,255,255,0.02)]'
            : 'border-[rgba(255,255,255,0.15)] hover:border-[rgba(255,255,255,0.3)]'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv"
          className="hidden"
        />
        <Upload className="mx-auto size-8 text-text-secondary mb-3" />
        <p className="text-sm font-medium">
          Drop your supplier CSV here or <span className="text-accent-blue hover:underline">click to browse</span>
        </p>
        <p className="text-xs text-text-muted mt-2">
          Columns required: supplier_name, country, category
        </p>
      </div>

      <div className="mt-4">
        <a
          href="#"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
        >
          <Download className="size-3" /> Download CSV Template
        </a>
      </div>

      {showModal && (
        <CsvPreviewModal
          rows={parsedRows}
          onClose={() => setShowModal(false)}
          onConfirm={onUploadSuccess}
        />
      )}
    </div>
  );
}
