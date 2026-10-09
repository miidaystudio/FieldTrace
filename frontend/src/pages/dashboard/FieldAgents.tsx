import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { Agent } from '../../api/types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Drawer } from '../../components/common/Drawer';
import { Tabs } from '../../components/common/Tabs';
import {
  Users,
  Search,
  Phone,
  Radio,
  Battery,
  Signal,
  Gauge,
  MapPin,
  Shield,
  Plus,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FieldAgents: React.FC = () => {
  const navigate = useNavigate();
  const agents = useFleetStore((state) => state.agents);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);

  const [activeTab, setActiveTab] = useState('all');
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<Agent | null>(null);

  const filteredAgents = agents.filter((a) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'moving') return a.status === 'moving';
    if (activeTab === 'idle') return a.status === 'idle' || a.status === 'stopped';
    if (activeTab === 'flagged') return a.status === 'flagged';
    return true;
  });

  const counts = {
    all: agents.length,
    moving: agents.filter((a) => a.status === 'moving').length,
    idle: agents.filter((a) => a.status === 'idle' || a.status === 'stopped').length,
    flagged: agents.filter((a) => a.status === 'flagged').length,
  };

  const tabs = [
    { id: 'all', label: 'All Field Personnel', count: counts.all },
    { id: 'moving', label: 'In Transit / Moving', count: counts.moving },
    { id: 'idle', label: 'Stationary / Idle', count: counts.idle },
    { id: 'flagged', label: 'Flagged Anomalies', count: counts.flagged },
  ];

  const columns: Column<Agent>[] = [
    {
      key: 'name',
      header: 'Agent / Callsign',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <img
            src={item.avatar}
            alt={item.name}
            className="w-8 h-8 rounded-full object-cover border border-ops-border"
          />
          <div>
            <div className="font-bold text-white text-xs">{item.name}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {item.callsign} • {item.phone}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Specialization / Role',
      sortable: true,
      render: (item) => (
        <div>
          <div className="text-white text-xs font-semibold">{item.role}</div>
          <div className="text-[10px] text-gray-400 capitalize">Type: {item.type}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Real-time Status',
      sortable: true,
      render: (item) => <Badge variant={item.status as any}>{item.status}</Badge>,
    },
    {
      key: 'speedKmH',
      header: 'Speed / Velocity',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-xs text-brand-teal font-bold">
          {item.speedKmH} km/h
        </span>
      ),
    },
    {
      key: 'batteryLevel',
      header: 'Battery / Signal',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-amber-400">
            <Battery className="w-3.5 h-3.5" /> {item.batteryLevel}%
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Signal className="w-3.5 h-3.5" /> {item.signalStrength} dBm
          </span>
        </div>
      ),
    },
    {
      key: 'destinationName',
      header: 'Current Assigned Destination',
      render: (item) => (
        <div className="truncate max-w-[220px] text-xs text-gray-300">
          {item.destinationName || 'Patrol / Standby'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAgentDetail(item);
            }}
          >
            Profile
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAgent(item.id);
              navigate('/dashboard/live');
            }}
          >
            Track
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-teal" />
            <span>Field Personnel & Agents Directory</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time roster of field technicians, rapid couriers, auditors, and vehicle assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            Register Field Agent
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <DataTable
        data={filteredAgents}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedAgentDetail(item)}
        searchPlaceholder="Search agent by name, callsign, or destination..."
        searchFilter={(item, query) =>
          item.name.toLowerCase().includes(query) ||
          item.callsign.toLowerCase().includes(query) ||
          item.role.toLowerCase().includes(query)
        }
        pageSize={10}
      />

      {/* Agent Detail Profile Drawer */}
      <Drawer
        isOpen={!!selectedAgentDetail}
        onClose={() => setSelectedAgentDetail(null)}
        title={selectedAgentDetail?.name || 'Agent Profile'}
        subtitle={`Callsign: ${selectedAgentDetail?.callsign} • Assigned Fleet: Sector 01`}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              onClick={() => window.open(`tel:${selectedAgentDetail?.phone}`)}
            >
              Radio Call
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={() => {
                if (selectedAgentDetail) setSelectedAgent(selectedAgentDetail.id);
                setSelectedAgentDetail(null);
                navigate('/dashboard/live');
              }}
            >
              Open Live Radar Focus
            </Button>
          </>
        }
      >
        {selectedAgentDetail && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center gap-4 p-4 bg-ops-card rounded-xl border border-ops-border">
              <img
                src={selectedAgentDetail.avatar}
                alt={selectedAgentDetail.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-brand-teal"
              />
              <div className="space-y-1">
                <div className="text-base font-bold text-white">{selectedAgentDetail.name}</div>
                <div className="text-gray-400 font-mono">{selectedAgentDetail.phone}</div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={selectedAgentDetail.status as any} size="sm">
                    {selectedAgentDetail.status}
                  </Badge>
                  <span className="text-gray-400 font-mono">Role: {selectedAgentDetail.role}</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">Today's Completed Visits</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">8 Sites</div>
              </div>
              <div className="p-3 bg-ops-card border border-ops-border rounded-xl">
                <div className="text-gray-400 text-[10px]">Compliance Rating</div>
                <div className="text-xl font-bold text-brand-teal mt-0.5">99.2%</div>
              </div>
            </div>

            {/* Device Telemetry Specs */}
            <div className="p-4 bg-ops-base border border-ops-border rounded-xl space-y-2 font-mono text-[11px] text-gray-300">
              <div className="font-bold text-white uppercase text-xs border-b border-ops-border pb-1">
                Device Hardware & Sensor Attestation
              </div>
              <div className="flex justify-between">
                <span>GPS Accuracy:</span>
                <span className="text-emerald-400 font-bold">±{selectedAgentDetail.telemetry.accuracyMeters}m</span>
              </div>
              <div className="flex justify-between">
                <span>Vehicle Telemetry Odometer:</span>
                <span className="text-white">{selectedAgentDetail.telemetry.odometerKm} km</span>
              </div>
              <div className="flex justify-between">
                <span>Coordinates:</span>
                <span className="text-brand-teal">{selectedAgentDetail.currentLat}, {selectedAgentDetail.currentLng}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
