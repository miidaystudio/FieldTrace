import React from 'react';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { FileClock, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  target: string;
  ipAddress: string;
  status: 'success' | 'flagged' | 'override';
}

const mockAuditEntries: AuditEntry[] = [
  {
    id: 'log-801',
    timestamp: '2026-10-09 14:10:22',
    actor: 'Cmdr. Sarah Jenkins',
    actorRole: 'Ops Manager',
    action: 'Manual Geofence Verification Override Approved',
    target: 'Visit POV-105 (Embarcadero Pier 39)',
    ipAddress: '192.168.1.104 (HQ Internal)',
    status: 'override',
  },
  {
    id: 'log-802',
    timestamp: '2026-10-09 13:48:15',
    actor: 'Automated AI Engine',
    actorRole: 'Kinematic Security',
    action: 'In-Cab Speed Violation Chime Dispatched',
    target: 'Agent Lucas King (FT-112)',
    ipAddress: 'System Daemon',
    status: 'flagged',
  },
  {
    id: 'log-803',
    timestamp: '2026-10-09 12:04:19',
    actor: 'Marcus Vance',
    actorRole: 'Field Agent',
    action: 'Cryptographic Check-In Submitted with Photo Hash',
    target: 'Site Salesforce Tower Bay 4',
    ipAddress: '172.56.21.89 (Cellular)',
    status: 'success',
  },
  {
    id: 'log-804',
    timestamp: '2026-10-09 10:15:00',
    actor: 'Alex Thorne',
    actorRole: 'Field Supervisor',
    action: 'New Polygon Geofence Deployed',
    target: 'SFO Air Cargo Terminal B',
    ipAddress: '192.168.1.112',
    status: 'success',
  },
];

export const AuditLogs: React.FC = () => {
  const columns: Column<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (item) => <span className="font-mono text-xs text-gray-400">{item.timestamp}</span>,
    },
    {
      key: 'actor',
      header: 'Operator / System Actor',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-white text-xs">{item.actor}</div>
          <div className="text-[10px] text-brand-teal font-mono">{item.actorRole}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action Event',
      render: (item) => (
        <div>
          <div className="text-gray-200 text-xs font-semibold">{item.action}</div>
          <div className="text-[10px] text-gray-400 truncate max-w-[280px]">Target: {item.target}</div>
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Source Origin',
      render: (item) => <span className="font-mono text-xs text-gray-400">{item.ipAddress}</span>,
    },
    {
      key: 'status',
      header: 'Audit Status',
      render: (item) => (
        <Badge
          variant={item.status === 'success' ? 'verified' : item.status === 'override' ? 'idle' : 'flagged'}
          size="sm"
        >
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FileClock className="w-6 h-6 text-brand-teal" />
          <span>Immutable System Audit Logs</span>
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Cryptographically recorded security logs, supervisor overrides, and geofence boundary modifications.
        </p>
      </div>

      <DataTable
        data={mockAuditEntries}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search audit log by actor, action, or target..."
        searchFilter={(item, q) =>
          item.actor.toLowerCase().includes(q) ||
          item.action.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q)
        }
      />
    </div>
  );
};
