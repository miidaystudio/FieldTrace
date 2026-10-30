import React, { useEffect, useState } from 'react';
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
import { Modal } from '../../components/common/Modal';
import { agentsApi, teamsApi, type TeamDto, type VehicleType } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { VEHICLE_LABELS, fmt, timeAgo } from '../../api/adapters';
import { DarkFormError, darkInputClass, darkSelectClass } from '../../components/common/FormInputs';
import { useAuthStore } from '../../store/useAuthStore';

export const FieldAgents: React.FC = () => {
  const navigate = useNavigate();
  const agents = useFleetStore((state) => state.agents);
  const setSelectedAgent = useFleetStore((state) => state.setSelectedAgent);
  const assignmentsToday = useFleetStore((state) => state.assignmentsToday);
  const loadAll = useFleetStore((state) => state.loadAll);
  const timeZone = useAuthStore((state) => state.organization?.timezone ?? 'UTC');
  const role = useAuthStore((state) => state.user?.role);

  // ---- Register agent (POST /agents)
  const emptyForm = {
    name: '',
    email: '',
    temporaryPassword: '',
    teamId: '',
    employeeCode: '',
    phone: '',
    vehicle: 'motorcycle' as VehicleType,
    plate: '',
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (createOpen) teamsApi.listAll().then(setTeams).catch(() => setTeams([]));
  }, [createOpen]);

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      await agentsApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        temporaryPassword: form.temporaryPassword,
        teamId: form.teamId || null,
        employeeCode: form.employeeCode.trim() || null,
        phone: form.phone.trim() || null,
        vehicle: { type: form.vehicle, plate: form.plate.trim() || null },
      });
      setCreateOpen(false);
      setForm(emptyForm);
      await loadAll(timeZone);
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const todayFor = (agentId: string) => assignmentsToday.filter((a) => a.agentId === agentId);

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
              {item.callsign} • {item.phone ?? item.email ?? '—'}
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
          <div className="text-[10px] text-gray-400 capitalize">Shift: {item.shiftStatus.replace('_', ' ')}</div>
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
      header: 'Battery / Last Fix',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-amber-400">
            <Battery className="w-3.5 h-3.5" /> {fmt(item.batteryLevel, '%')}
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Signal className="w-3.5 h-3.5" /> {timeAgo(item.lastHeartbeat)}
          </span>
        </div>
      ),
    },
    {
      key: 'destinationName',
      header: 'Current Assigned Destination',
      render: (item) => (
        <div className="truncate max-w-[220px] text-xs text-gray-300">
          {item.destinationName || 'No open assignment'}
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
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-white hover:bg-slate-200 text-black font-semibold rounded-full px-5 py-2 text-xs flex items-center gap-2 transition-colors shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>Register Field Agent</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

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
        subtitle={`Employee code: ${selectedAgentDetail?.callsign} • ${selectedAgentDetail?.role ?? ''}`}
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              disabled={!selectedAgentDetail?.phone}
              onClick={() => selectedAgentDetail?.phone && window.open(`tel:${selectedAgentDetail.phone}`)}
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
            <div className="flex items-center gap-4 p-4 bg-[#1D212B] rounded-2xl border border-white/[0.05]">
              <img
                src={selectedAgentDetail.avatar}
                alt={selectedAgentDetail.name}
                className="w-16 h-16 rounded-xl object-cover border border-white/20"
              />
              <div className="space-y-1">
                <div className="text-base font-bold text-white">{selectedAgentDetail.name}</div>
                <div className="text-[#8E96A4] font-mono">
                  {selectedAgentDetail.phone ?? '—'} · {selectedAgentDetail.email ?? '—'}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={selectedAgentDetail.status as any} size="sm">
                    {selectedAgentDetail.status}
                  </Badge>
                  <span className="text-[#8E96A4] font-mono">Role: {selectedAgentDetail.role}</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div className="p-3 bg-[#1D212B] border border-white/[0.05] rounded-2xl">
                <div className="text-[#8E96A4] text-[10px]">Today's Assignments Completed</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">
                  {todayFor(selectedAgentDetail.id).filter((a) => a.status === 'completed').length} /{' '}
                  {todayFor(selectedAgentDetail.id).length}
                </div>
              </div>
              <div className="p-3 bg-[#1D212B] border border-white/[0.05] rounded-2xl">
                <div className="text-[#8E96A4] text-[10px]">Connectivity</div>
                <div className="text-xl font-bold text-white mt-0.5 capitalize">
                  {selectedAgentDetail.connectivity}
                </div>
              </div>
            </div>

            {/* Device Telemetry Specs */}
            <div className="p-4 bg-[#12151C] border border-white/[0.05] rounded-2xl space-y-2 font-mono text-[11px] text-[#8E96A4]">
              <div className="font-bold text-white uppercase text-xs border-b border-white/[0.06] pb-1">
                Latest Device Telemetry
              </div>
              <div className="flex justify-between">
                <span>GPS Accuracy:</span>
                <span className="text-emerald-400 font-bold">±{fmt(selectedAgentDetail.telemetry.accuracyMeters, 'm')}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Fix:</span>
                <span className="text-white">{timeAgo(selectedAgentDetail.lastHeartbeat)}</span>
              </div>
              <div className="flex justify-between">
                <span>Coordinates:</span>
                <span className="text-white">{selectedAgentDetail.hasPosition
                    ? `${selectedAgentDetail.currentLat.toFixed(5)}, ${selectedAgentDetail.currentLng.toFixed(5)}`
                    : 'no fix yet'}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>
      {/* Register Field Agent (POST /agents) */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register Field Agent"
        subtitle="Creates the agent's login. They must change the temporary password at first sign-in."
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={
                creating ||
                !form.name ||
                !form.email ||
                form.temporaryPassword.length < 10 ||
                (role === 'manager' && !form.teamId)
              }
              onClick={() => void handleCreate()}
            >
              {creating ? 'Creating…' : 'Create Agent'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <DarkFormError message={createError} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Full name</label>
              <input className={darkInputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Email (login)</label>
              <input type="email" className={darkInputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Temporary password (min. 10)</label>
              <input className={darkInputClass} value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">
                Team {role === 'manager' ? '(required)' : '(optional)'}
              </label>
              <select className={darkSelectClass} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">— none —</option>
                {teams
                  .filter((t) => !t.isArchived)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Employee code</label>
              <input className={darkInputClass} value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Phone</label>
              <input className={darkInputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Vehicle</label>
              <select className={darkSelectClass} value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value as VehicleType })}>
                {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((v) => (
                  <option key={v} value={v}>
                    {VEHICLE_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#8E96A4] font-semibold mb-1">Plate</label>
              <input className={darkInputClass} value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
