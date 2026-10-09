import React, { useState } from 'react';
import { useFleetStore } from '../../store/useFleetStore';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import {
  ClipboardList,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Calendar,
} from 'lucide-react';

interface TaskOrder {
  id: string;
  orderNumber: string;
  title: string;
  clientName: string;
  siteAddress: string;
  assignedAgentName: string;
  assignedAgentAvatar: string;
  priority: 'urgent' | 'high' | 'normal';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  scheduledTime: string;
  estDurationMinutes: number;
}

const mockTasks: TaskOrder[] = [
  {
    id: 'tsk-001',
    orderNumber: 'WO-2026-904',
    title: 'Cryo-Specimen Secure Transport & Handoff',
    clientName: 'Genentech BioPharma',
    siteAddress: '1700 Owens St, San Francisco, CA',
    assignedAgentName: 'Marcus Vance',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    priority: 'urgent',
    status: 'in_progress',
    scheduledTime: '08:30 - 09:15',
    estDurationMinutes: 45,
  },
  {
    id: 'tsk-002',
    orderNumber: 'WO-2026-905',
    title: 'Mission Bay Primary Data Hub Server Blade Swap',
    clientName: 'Salesforce Corp',
    siteAddress: '415 Mission St, Bay 4, SF',
    assignedAgentName: 'Elena Rostova',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    priority: 'high',
    status: 'completed',
    scheduledTime: '09:30 - 10:30',
    estDurationMinutes: 60,
  },
  {
    id: 'tsk-003',
    orderNumber: 'WO-2026-906',
    title: 'Pier 39 Marine Sensor Calibration & Battery Replacement',
    clientName: 'Pacific Maritime Group',
    siteAddress: 'The Embarcadero, Pier 39, CA',
    assignedAgentName: 'Sofia Chen',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    priority: 'normal',
    status: 'pending',
    scheduledTime: '11:00 - 12:00',
    estDurationMinutes: 60,
  },
  {
    id: 'tsk-004',
    orderNumber: 'WO-2026-907',
    title: 'Presidio Air Quality Station Telemetry Firmware Patch',
    clientName: 'City & County of SF',
    siteAddress: 'Presidio Blvd & Lincoln, CA',
    assignedAgentName: 'Lucas King',
    assignedAgentAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    priority: 'normal',
    status: 'pending',
    scheduledTime: '13:00 - 14:00',
    estDurationMinutes: 60,
  },
];

export const TasksAssignments: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');

  const filteredTasks = mockTasks.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All Dispatch Orders', count: mockTasks.length },
    { id: 'in_progress', label: 'In Progress / En Route', count: mockTasks.filter(t => t.status === 'in_progress').length },
    { id: 'pending', label: 'Pending Assignment', count: mockTasks.filter(t => t.status === 'pending').length },
    { id: 'completed', label: 'Completed Today', count: mockTasks.filter(t => t.status === 'completed').length },
  ];

  const columns: Column<TaskOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order # / Title',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-mono text-[10px] text-brand-teal uppercase">{item.orderNumber}</span>
          <div className="font-bold text-white text-xs mt-0.5">{item.title}</div>
          <div className="text-[10px] text-gray-400">{item.clientName}</div>
        </div>
      ),
    },
    {
      key: 'siteAddress',
      header: 'Target Site Address',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
          <span className="truncate max-w-[200px]">{item.siteAddress}</span>
        </div>
      ),
    },
    {
      key: 'assignedAgentName',
      header: 'Assigned Field Agent',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <img src={item.assignedAgentAvatar} alt={item.assignedAgentName} className="w-6 h-6 rounded-full object-cover border border-ops-border" />
          <span className="text-xs text-gray-200 font-semibold">{item.assignedAgentName}</span>
        </div>
      ),
    },
    {
      key: 'scheduledTime',
      header: 'Time Window',
      sortable: true,
      render: (item) => (
        <div className="text-xs font-mono text-gray-300">
          <div>{item.scheduledTime}</div>
          <div className="text-[10px] text-gray-500">~{item.estDurationMinutes} mins</div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (item) => (
        <Badge
          variant={item.priority === 'urgent' ? 'flagged' : item.priority === 'high' ? 'idle' : 'teal'}
          size="sm"
        >
          {item.priority}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Dispatch Status',
      sortable: true,
      render: (item) => (
        <Badge
          variant={item.status === 'completed' ? 'verified' : item.status === 'in_progress' ? 'moving' : 'slate'}
          size="sm"
        >
          {item.status.replace('_', ' ')}
        </Badge>
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
            Dispatch scheduled stops, work orders, proof requirements, and field technician assignments.
          </p>
        </div>

        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          Create Work Order
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <DataTable
        data={filteredTasks}
        columns={columns}
        keyExtractor={(item) => item.id}
        searchPlaceholder="Search work orders, clients, or agents..."
        searchFilter={(item, query) =>
          item.title.toLowerCase().includes(query) ||
          item.orderNumber.toLowerCase().includes(query) ||
          item.clientName.toLowerCase().includes(query)
        }
      />
    </div>
  );
};
