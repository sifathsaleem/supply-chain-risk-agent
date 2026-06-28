import React, { useState } from 'react';
import { RefreshCw, Loader2, Trash2, Box } from 'lucide-react';
import { timeAgo, getRiskBadgeClass } from '../../utils';
import { useToast } from '../../context/ToastContext';

export default function SupplierTable({ suppliers, riskScores, loading, onDelete, onScan }) {
  const { showToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [pendingDeleteName, setPendingDeleteName] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleScanClick = async () => {
    setScanning(true);
    try {
      await onScan();
      showToast('Scan initiated successfully!', 'success');
    } catch (err) {
      showToast('Scan failed: ' + err.message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const openDeleteModal = (name) => {
    setPendingDeleteName(name);
  };

  const closeDeleteModal = () => {
    setPendingDeleteName(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteName) return;
    setDeleting(true);
    try {
      await onDelete(pendingDeleteName);
      showToast(`Supplier ${pendingDeleteName} removed successfully`, 'info');
      closeDeleteModal();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Merge risk scores
  const mergedSuppliers = suppliers.map(s => {
    const scoreObj = riskScores.find(rs => rs.supplier_name === s.supplier_name);
    return {
      ...s,
      risk_level: scoreObj ? scoreObj.risk_level : 'PENDING'
    };
  });

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">📋 Monitored Suppliers</h2>
          {suppliers.length > 0 && (
            <span className="bg-accent-blue/15 text-[#a5b4fc] border border-accent-blue/30 rounded-full px-3 py-0.5 text-xs font-semibold">
              {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleScanClick}
          disabled={scanning || suppliers.length === 0}
          className="btn btn-success flex items-center gap-2 border border-[#22c55e]/30 bg-[#22c55e]/15 text-risk-low px-4 py-2 rounded-lg text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
        >
          {scanning ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Scan Now
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-bg-primary text-text-secondary uppercase text-[10px] tracking-wider border-b border-[var(--border-card)]">
            <tr>
              <th className="p-3">Supplier Name</th>
              <th className="p-3">Country</th>
              <th className="p-3">Category</th>
              <th className="p-3">Added</th>
              <th className="p-3">Risk Level</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton loading rows
              [1, 2, 3].map(i => (
                <tr key={i} className="border-b border-[rgba(255,255,255,0.03)]">
                  <td className="p-4"><div className="skeleton h-5 w-32"></div></td>
                  <td className="p-4"><div className="skeleton h-5 w-24"></div></td>
                  <td className="p-4"><div className="skeleton h-5 w-24"></div></td>
                  <td className="p-4"><div className="skeleton h-5 w-20"></div></td>
                  <td className="p-4"><div className="skeleton h-5 w-16"></div></td>
                  <td className="p-4 text-right"><div className="skeleton h-5 w-8 ml-auto"></div></td>
                </tr>
              ))
            ) : mergedSuppliers.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-12 text-center text-text-secondary">
                  <div className="flex flex-col items-center gap-3">
                    <Box className="size-8 text-text-muted" />
                    <p className="text-sm font-medium">No suppliers yet.</p>
                    <p className="text-xs text-text-muted">Upload a CSV template to populate the dashboard.</p>
                  </div>
                </td>
              </tr>
            ) : (
              mergedSuppliers.map((s, idx) => (
                <tr key={idx} className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="p-3 font-semibold text-text-primary">{s.supplier_name}</td>
                  <td className="p-3 text-text-secondary">{s.country}</td>
                  <td className="p-3 text-text-secondary">{s.category}</td>
                  <td className="p-3 text-text-muted">{timeAgo(s.added_date)}</td>
                  <td className="p-3">
                    <span className={getRiskBadgeClass(s.risk_level)}>
                      {s.risk_level}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openDeleteModal(s.supplier_name)}
                      className="btn-danger inline-flex items-center justify-center p-2 rounded-lg cursor-pointer text-risk-high hover:bg-risk-high-glow/40 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Custom Confirmation Modal */}
      {pendingDeleteName && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <div className="card w-full max-w-[360px] p-6 bg-bg-primary border border-[rgba(255,255,255,0.14)] shadow-2xl animate-scale-in">
            <div className="text-xl mb-3">🗑️</div>
            <h3 className="text-sm font-semibold mb-2">Remove Supplier?</h3>
            <p className="text-xs text-text-muted leading-relaxed mb-6">
              This will permanently remove <span className="font-semibold text-text-primary">{pendingDeleteName}</span> from your supplier list. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="btn btn-ghost px-4 py-2 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="btn btn-primary bg-risk-high hover:bg-[#dc2626] px-4 py-2 rounded-lg text-xs"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
