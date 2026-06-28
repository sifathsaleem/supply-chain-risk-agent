import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';

export default function CsvPreviewModal({ rows, onClose, onConfirm }) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const errorRowsCount = rows.filter(r => r.error).length;
  const validRowsCount = rows.length - errorRowsCount;
  const validRows = rows.filter(r => !r.error);

  const handleConfirm = async () => {
    if (validRows.length === 0) {
      showToast('No valid rows to upload.', 'error');
      return;
    }
    setUploading(true);
    try {
      await onConfirm(validRows);
      showToast(`Successfully uploaded ${validRows.length} suppliers!`, 'success');
      onClose();
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
      <div className="card w-full max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col bg-bg-primary">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-card)]">
          <h3 className="text-base font-semibold">
            {rows.length} suppliers found &mdash; {validRowsCount} valid, {errorRowsCount} with errors
          </h3>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollable">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-bg-primary border-b border-[var(--border-card)] text-text-secondary uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Country</th>
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-[rgba(255,255,255,0.03)] ${
                    row.error ? 'bg-[rgba(239,68,68,0.05)]' : 'even:bg-[rgba(255,255,255,0.01)]'
                  }`}
                >
                  <td className="p-3 font-medium truncate max-w-[150px]">{row.supplier_name || <span className="text-text-muted italic">empty</span>}</td>
                  <td className="p-3 text-text-secondary truncate max-w-[120px]">{row.country || <span className="text-text-muted italic">empty</span>}</td>
                  <td className="p-3 text-text-secondary truncate max-w-[120px]">{row.category || <span className="text-text-muted italic">empty</span>}</td>
                  <td className="p-3 font-medium">
                    {row.error ? (
                      <span className="text-risk-high">{row.error}</span>
                    ) : (
                      <span className="text-risk-low">&nbsp;✓ Valid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-card)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn btn-ghost"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-primary"
            disabled={uploading || validRowsCount === 0}
          >
            {uploading ? 'Uploading...' : `Upload ${validRowsCount} Suppliers`}
          </button>
        </div>
      </div>
    </div>
  );
}
