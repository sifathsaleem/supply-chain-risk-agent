import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

export default function DeleteSupplierModal({ supplierName, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = () => {
    setDeleting(true);
    // Simulate a brief deleting state of 1.5 seconds, then confirm and close
    setTimeout(() => {
      handleClose(() => onConfirm(supplierName));
    }, 1500);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      {/* Backdrop */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 250ms ease'
        }} 
        onClick={deleting ? null : () => handleClose(onCancel)} 
      />

      {/* Modal Content */}
      <div 
        className={`t-modal ${isOpen ? 'is-open' : 'is-closing'}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: '#141313', // Obsidian Deep surface
          border: '1px solid #2d2c2c', // Obsidian Deep outline
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Delete Supplier</h3>
          <button 
            onClick={deleting ? null : () => handleClose(onCancel)} 
            disabled={deleting}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: deleting ? 'not-allowed' : 'pointer', 
              color: '#a3a3a3',
              opacity: deleting ? 0.4 : 1
            }}
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Message */}
        <div style={{ fontSize: 13, color: '#a3a3a3', lineHeight: 1.6, marginBottom: 24 }}>
          <span>
            Are you sure you want to permanently delete <strong style={{ color: '#fff' }}>{supplierName}</strong>? This action cannot be undone.
          </span>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button 
            disabled={deleting} 
            onClick={() => handleClose(onCancel)} 
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontSize: 13,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button 
            disabled={deleting} 
            onClick={handleDelete} 
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              background: '#ef4444',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
