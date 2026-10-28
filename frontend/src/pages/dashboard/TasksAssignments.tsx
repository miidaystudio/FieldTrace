import React, { useCallback, useEffect, useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import { Modal } from '../../components/common/Modal';
import { ClipboardList, Plus, MapPin, Calendar, Loader2, Route } from 'lucide-react';
import { RoutePlannerModal } from './RoutePlannerModal';
import {
  assignmentsApi,
  type AssignmentDto,
  type AssignmentPriority,
  type AssignmentStatus,
} from '../../api/backend';
import { errorMessage } from '../../api/client';
import { avatarFor } from '../../api/adapters';
import { FormError, inputClass } from '../auth/LoginPage';

const STATUS_VARIANT: Record<AssignmentStatus, 'verified' | 'moving' | 'slate' | 'flagged' | 'idle'> = {
  completed: 'verified',
  in_progress: 'moving',
  pending: 'slate',
  overdue: 'idle',
  cancelled: 'flagged',
};

const windowLabel = (a: AssignmentDto) =>
  a.window
    ? `${new Date(a.window.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(
        a.window.end,
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Any time';

export const TasksAssignments: React.FC = () => {
  const today = useFleetStore((state) => state.today);
  const agents = useFleetStore((state) => state.agents);
  const locations = useFleetStore((state) => state.locations);
  const reloadAssignments = useFleetStore((state) => state.reloadAssignments);

  const [date, setDate] = useState(today);
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      setAssignments(await assignmentsApi.listForDate(date));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- route planner
  const [plannerOpen, setPlannerOpen] = useState(false);

  // ---- create
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    agentId: '',
    locationId: '',
    title: '',
    priority: 'normal' as AssignmentPriority,
    start: '',
    end: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setCreateError(null);
    setBusy(true);
    try {
      const timeWindow =
        form.start && form.end
          ? { start: new Date(`${date}T${form.start}`).toISOString(), end: new Date(`${date}T${form.end}`).toISOString() }
          : null;
      await assignmentsApi.create({
        agentId: form.agentId,
        locationId: form.locationId,
        scheduledDate: date,
        priority: form.priority,
        title: form.title.trim() || null,
        window: timeWindow,
      });
      setCreateOpen(false);
      setForm({ ...form, title: '', start: '', end: '' });
      await load();
      if (date === today) await reloadAssignments();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (assignment: AssignmentDto, status: 'in_progress' | 'completed' | 'cancelled') => {
    let reason: string | undefined;
    if (status === 'cancelled') {
      reason = window.prompt('Reason for cancelling this assignment?') ?? undefined;
      if (!reason) return;
    }
    try {
      await assignmentsApi.setStatus(assignment.id, status, reason);
      await load();
      if (date === today) await reloadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const filtered = assignments.filter((a) => activeTab === 'all' || a.status === activeTab);
  const count = (status: AssignmentStatus) => assignments.filter((a) => a.status === status).length;
  const tabs = [
    { id: 'all', label: 'All Assignments', count: assignments.length },
    { id: 'in_progress', label: 'In Progress', count: count('in_progress') },
    { id: 'pending', label: 'Pending', count: count('pending') },
    { id: 'completed', label: 'Completed', count: count('completed') },
    { id: 'cancelled', label: 'Cancelled', count: count('cancelled') },
  ];

  const columns: Column<AssignmentDto>[] = [
    {
      key: 'title',
      header: 'Assignment',
      render: (item) => (
        <div>
          <span className="font-mono text-[10px] text-brand-teal uppercase">#{item.id.slice(-6)}</span>
          <div className="font-bold text-white text-xs mt-0.5">{item.title ?? 'Site visit'}</div>
          <div className="text-[10px] text-gray-400">{item.location?.name ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Site Address',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
          <span className="truncate max-w-[200px]">{item.location?.address ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'agent',
      header: 'Assigned Field Agent',
      render: (item) => (
        <div className="flex items-center gap-2">
          <img src={avatarFor(item.agent?.name ?? '?')} alt="" className="w-6 h-6 rounded-full border border-ops-border" />
          <span className="text-xs text-gray-200 font-semibold">{item.agent?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Time Window',
      render: (item) => <div className="text-xs font-mono text-gray-300">{windowLabel(item)}</div>,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (item) => (
        <Badge variant={item.priority === 'urgent' ? 'flagged' : item.priority === 'high' ? 'idle' : 'teal'} size="sm">
          {item.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <Badge variant={STATUS_VARIANT[item.status]} size="sm">
          {item.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {(item.status === 'pending' || item.status === 'overdue') && (
            <Button variant="secondary" size="sm" onClick={() => void changeStatus(item, 'in_progress')}>
              Start
            </Button>
          )}
          {item.status !== 'completed' && item.status !== 'cancelled' && (
            <>
              <Button variant="primary" size="sm" onClick={() => void changeStatus(item, 'completed')}>
                Complete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void changeStatus(item, 'cancelled')}>
                Cancel
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-brand-teal" />
            <span>Tasks & Field Work Orders</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Site visits assigned to field agents. Agents progress their own assignments from the driver app.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-ops-panel border border-ops-border rounded-xl px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-brand-teal" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-mono"
            />
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Route className="w-4 h-4" />} onClick={() => setPlannerOpen(true)}>
            Optimize Route
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            Create Assignment
          </Button>
        </div>
      </div>

      <FormError message={error} />
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 p-6">
          <Loader2 className="w-4 h-4 animate-spin text-brand-teal" /> Loading assignments…
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(item) => item.id}
          emptyMessage="No assignments for this day."
          searchPlaceholder="Search by title, site or agent..."
          searchFilter={(item, query) =>
            (item.title ?? '').toLowerCase().includes(query) ||
            (item.location?.name ?? '').toLowerCase().includes(query) ||
            (item.agent?.name ?? '').toLowerCase().includes(query)
          }
        />
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Assignment"
        subtitle={`Scheduled for ${date}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !form.agentId || !form.locationId}
              onClick={() => void handleCreate()}
            >
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <FormError message={createError} />
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Field agent</label>
            <select className={inputClass} value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
              <option value="">Select an agent…</option>
              {[...agents]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.callsign})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Client location</label>
            <select className={inputClass} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Select a location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Title</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Weekly stock audit" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Priority</label>
              <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as AssignmentPriority })}>
                {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Window from</label>
              <input type="time" className={inputClass} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div>
              <label className="block text-gray-300 font-semibold mb-1">Window to</label>
              <input type="time" className={inputClass} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      <RoutePlannerModal
        isOpen={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        date={date}
        assignments={assignments}
        onSaved={() => void load()}
      />
    </div>
  );
};
