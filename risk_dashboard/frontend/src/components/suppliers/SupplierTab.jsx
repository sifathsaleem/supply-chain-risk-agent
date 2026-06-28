import React from 'react';
import CsvUploadZone from './CsvUploadZone';
import SupplierTable from './SupplierTable';

export default function SupplierTab({ suppliersState, riskScoresState }) {
  const { suppliers, loading: suppliersLoading, uploadBulk, deleteSupplier, triggerScan, refresh } = suppliersState;
  const { refetch: refetchRiskScores } = riskScoresState;

  const handleUploadSuccess = async (validRows) => {
    await uploadBulk(validRows);
    await refetchRiskScores();
  };

  const handleScan = async () => {
    await triggerScan();
    // After triggering a scan, refetch data
    setTimeout(async () => {
      await refresh();
      await refetchRiskScores();
    }, 2000);
  };

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      <CsvUploadZone onUploadSuccess={handleUploadSuccess} />
      <SupplierTable
        suppliers={suppliers}
        riskScores={riskScoresState.data}
        loading={suppliersLoading}
        onDelete={deleteSupplier}
        onScan={handleScan}
      />
    </div>
  );
}
