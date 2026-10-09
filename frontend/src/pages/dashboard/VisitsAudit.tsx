import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { ProofOfVisit, VisitStatus } from '../../api/types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Tabs } from '../../components/common/Tabs';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  FileCheck,
  ShieldAlert,
  Download,
  Filter,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const VisitsAudit: React.FC = () => {
  const visits = useFleetStore((state) => state.visits);
  const updateVisitStatus = useFleetStore((state) => state.updateVisitStatus);

  const [selectedVisit, setSelectedVisit] = useState<ProofOfVisit | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [reviewNote, setReviewNote] = useState('');

  // Filtered visits
  const filteredVisits = visits.filter((v) => {
    if (activeTab === 'all') return true;
    return v.status === activeTab;
  });

  const counts = {
    all: visits.length,
    verified: visits.filter((v) => v.status === 'verified').length,
    pending: visits.filter((v) => v.status === 'pending').length,
    flagged: visits.filter((v) => v.status === 'flagged').length,
    deviated: visits.filter((v) => v.status === 'deviated').length,
  };

  const tabs = [
    { id: 'all', label: 'All Proofs of Visit', count: counts.all },
    { id: 'verified', label: 'Verified', count: counts.verified },
    { id: 'pending', label: 'Pending Review', count: counts.pending },
    { id: 'flagged', label: 'Flagged / Fraud Risk', count: counts.flagged },
    { id: 'deviated', label: 'Off-Boundary Deviated', count: counts.deviated },
  ];

  const handleApprove = () => {
    if (selectedVisit) {
      updateVisitStatus(selectedVisit.id, 'verified', reviewNote || 'Approved via Human Audit Review');
      setSelectedVisit(null);
      setReviewNote('');
    }
  };

  const handleReject = () => {
    if (selectedVisit) {
      updateVisitStatus(selectedVisit.id, 'flagged', reviewNote || 'Rejected by Ops Dispatcher');
      setSelectedVisit(null);
      setReviewNote('');
    }
  };

  const columns: Column<ProofOfVisit>[] = [
    {
      key: 'agentName',
      header: 'Field Agent',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <img src={item.agentAvatar} alt={item.agentName} className="w-7 h-7 rounded-full object-cover border border-ops-border" />
          <div>
            <div className="font-bold text-white text-xs">{item.agentName}</div>
            <div className="text-[10px] text-gray-400 font-mono">ID: {item.agentId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'siteName',
      header: 'Client / Monitored Site',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-semibold text-white text-xs">{item.siteName}</div>
          <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{item.clientName}</div>
        </div>
      ),
    },
    {
      key: 'checkInTime',
      header: 'Check-in / Duration',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-mono text-xs text-gray-200">
            {new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            Dwell: {item.durationMinutes} mins
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Verification Status',
      sortable: true,
      render: (item) => <Badge variant={item.status as any}>{item.status}</Badge>,
    },
    {
      key: 'verificationMethod',
      header: 'Method',
      sortable: true,
      render: (item) => (
        <span className="text-[11px] font-mono text-gray-300 capitalize bg-ops-card px-2 py-0.5 rounded border border-ops-border">
          {item.verificationMethod.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'confidenceScore',
      header: 'Confidence',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-ops-base h-2 rounded-full overflow-hidden border border-ops-border">
            <div
              className={`h-full rounded-full ${
                item.confidenceScore > 85
                  ? 'bg-emerald-400'
                  : item.confidenceScore > 60
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${item.confidenceScore}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-white">{item.confidenceScore}%</span>
        </div>
      ),
    },
    {
      key: 'gpsAccuracyMeters',
      header: 'GPS Accuracy',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-mono text-gray-300">
          ±{item.gpsAccuracyMeters}m
          {item.deviationDistanceMeters > 50 && (
            <span className="text-rose-400 text-[10px] ml-1.5 font-bold">
              (+{item.deviationDistanceMeters}m dev)
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Evidence Dossier',
      render: (item) => (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FileCheck className="w-3.5 h-3.5 text-brand-teal" />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedVisit(item);
          }}
        >
          Inspect Proof
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-emerald-400" />
            <span>Proof-of-Visit Audit Ledger</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Zero-trust tamper-proof check-in verification, geofence radius matching, and cryptographic evidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
            Export Audit CSV / PDF
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Main Data Table */}
      <DataTable
        data={filteredVisits}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedVisit(item)}
        searchPlaceholder="Search by agent name, client, or site..."
        searchFilter={(item, query) =>
          item.agentName.toLowerCase().includes(query) ||
          item.siteName.toLowerCase().includes(query) ||
          item.clientName.toLowerCase().includes(query)
        }
        pageSize={8}
      />

      {/* Verification Evidence Dossier Modal */}
      <Modal
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        title="Proof of Visit Verification Dossier"
        subtitle={`Audit ID: ${selectedVisit?.id} • Site: ${selectedVisit?.siteName}`}
        size="xl"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSelectedVisit(null)}>
              Close
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<X className="w-4 h-4" />}
              onClick={handleReject}
            >
              Flag & Reject Check-in
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
              onClick={handleApprove}
            >
              Approve Verification
            </Button>
          </>
        }
      >
        {selectedVisit && (
          <div className="space-y-6 text-xs">
            {/* Anomaly warning banner inside modal if flagged */}
            {selectedVisit.anomalyReason && (
              <div className="p-4 bg-rose-950/60 border border-rose-500/60 rounded-xl text-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-300 text-sm">Geospatial Discrepancy Flagged</div>
                  <p className="text-xs mt-0.5">{selectedVisit.anomalyReason}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Photo Proof & Watermark */}
              <div className="space-y-3">
                <h4 className="font-bold text-white uppercase tracking-wider font-mono text-xs flex items-center gap-2">
                  <Camera className="w-4 h-4 text-brand-teal" />
                  <span>Site Photographic Evidence</span>
                </h4>
                {selectedVisit.photoEvidenceUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-ops-border group">
                    <img
                      src={selectedVisit.photoEvidenceUrl}
                      alt="Visit Photo Proof"
                      className="w-full h-64 object-cover"
                    />
                    {/* Watermark Overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-black/85 backdrop-blur-md p-2.5 font-mono text-[10px] text-gray-300 border-t border-ops-border/80">
                      <div className="text-brand-teal font-bold flex justify-between">
                        <span>TIMESTAMP: {selectedVisit.checkInTime}</span>
                        <span>CONFIDENCE: {selectedVisit.confidenceScore}%</span>
                      </div>
                      <div className="text-gray-400 flex justify-between mt-0.5">
                        <span>GPS: {selectedVisit.coordinates[0]}, {selectedVisit.coordinates[1]}</span>
                        <span>ACCURACY: ±{selectedVisit.gpsAccuracyMeters}m</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 rounded-xl border border-dashed border-ops-border flex items-center justify-center text-gray-500 italic">
                    No photo evidence attached
                  </div>
                )}
              </div>

              {/* Right Column: Cryptographic Geospatial Match */}
              <div className="space-y-4">
                <h4 className="font-bold text-white uppercase tracking-wider font-mono text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Geospatial Verification Attestation</span>
                </h4>

                <div className="p-3.5 bg-ops-card rounded-xl border border-ops-border space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between border-b border-ops-border pb-1.5">
                    <span className="text-gray-400">Field Agent:</span>
                    <span className="text-white font-bold">{selectedVisit.agentName}</span>
                  </div>
                  <div className="flex justify-between border-b border-ops-border pb-1.5">
                    <span className="text-gray-400">Target Geofence Site:</span>
                    <span className="text-white">{selectedVisit.siteName}</span>
                  </div>
                  <div className="flex justify-between border-b border-ops-border pb-1.5">
                    <span className="text-gray-400">Check-in Timestamp:</span>
                    <span className="text-white">{new Date(selectedVisit.checkInTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-ops-border pb-1.5">
                    <span className="text-gray-400">Dwell Duration:</span>
                    <span className="text-brand-teal font-bold">{selectedVisit.durationMinutes} Minutes</span>
                  </div>
                  <div className="flex justify-between border-b border-ops-border pb-1.5">
                    <span className="text-gray-400">Radius Deviation:</span>
                    <span className={selectedVisit.deviationDistanceMeters > 30 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {selectedVisit.deviationDistanceMeters} meters
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Verification Engine:</span>
                    <span className="text-gray-300">{selectedVisit.verifiedBy || 'Automated AI Engine'}</span>
                  </div>
                </div>

                {/* Agent Field Notes */}
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Agent Field Notes</label>
                  <p className="p-3 bg-ops-base rounded-xl border border-ops-border text-gray-300 italic text-[11px]">
                    "{selectedVisit.notes || 'No notes submitted by field agent.'}"
                  </p>
                </div>

                {/* Dispatcher Review Note Input */}
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Audit Review Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter audit sign-off remarks..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full bg-ops-base border border-ops-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-teal"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
