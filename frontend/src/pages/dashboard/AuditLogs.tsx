import React, { useCallback, useEffect, useState } from 'react';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { FileClock, Loader2 } from 'lucide-react';
import { auditApi, type AuditLogDto } from '../../api/backend';
import { errorMessage } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useFleetStore } from '../../store/useFleetStore';
import { FormError } from '../auth/LoginPage';

const PAGE_SIZE = 50;

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function describeChanges(entry: AuditLogDto): string {
  if (entry.changes) {
    return Object.entries(entry.changes)
      .map(([field, change]) => `${field}: ${show(change.from)} → ${show(change.to)}`)
      .join('; ');
  }
  if (entry.metadata) {
    return Object.entries(entry.metadata)
      .map(([key, value]) => `${key}: ${show(value)}`)
      .join('; ');
  }
  return '';
}

export const AuditLogs: React.FC = () => {
  const me = useAuthStore((state) => state.user);
  const directory = useFleetStore((state) => state.directory);
  const [entries, setEntries] = useState<AuditLogDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await auditApi.list(nextPage, PAGE_SIZE);
      setEntries((prev) => (nextPage === 1 ? data : [...prev, ...data]));
      setTotal(meta.total);
      setPage(nextPage);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const actorName = (entry: AuditLogDto) => {
    if (!entry.actorId) return 'System';
    if (entry.actorId === me?.id) return `${me.name} (you)`;
    return directory.find((agent) => agent.userId === entry.actorId)?.name ?? `User …${entry.actorId.slice(-6)}`;
  };

  const columns: Column<AuditLogDto>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      sortable: true,
      render: (item) => <span className="font-mono text-xs text-gray-400">{new Date(item.at).toLocaleString()}</span>,
    },
    {
      key: 'actorId',
      header: 'Actor',
      render: (item) => (
        <div>
          <div className="font-bold text-white text-xs">{actorName(item)}</div>
          <div className="text-[10px] text-brand-teal font-mono capitalize">{item.actorRole ?? 'system'}</div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action Event',
      sortable: true,
      render: (item) => (
        <div>
          <div className="text-gray-200 text-xs font-semibold font-mono">{item.action}</div>
          <div className="text-[10px] text-gray-400 truncate max-w-[420px]" title={describeChanges(item)}>
            {describeChanges(item) || `${item.entityType} …${item.entityId.slice(-6)}`}
          </div>
        </div>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (item) => (
        <Badge variant="slate" size="sm">
          {item.entityType}
        </Badge>
      ),
    },
    {
      key: 'requestId',
      header: 'Request ID',
      render: (item) => <span className="font-mono text-[10px] text-gray-500">{item.requestId?.slice(0, 8) ?? '—'}</span>,
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
          Every change to users, teams, agents, locations, assignments and settings, recorded by the backend
          (newest first, {total} entries).
        </p>
      </div>

      <FormError message={error} />

      <DataTable
        data={entries}
        columns={columns}
        keyExtractor={(item) => item.id}
        pageSize={25}
        emptyMessage={loading ? 'Loading…' : 'No audit entries yet.'}
        searchPlaceholder="Filter loaded entries by action, entity or change..."
        searchFilter={(item, q) =>
          item.action.toLowerCase().includes(q) ||
          item.entityType.toLowerCase().includes(q) ||
          describeChanges(item).toLowerCase().includes(q)
        }
      />

      {entries.length < total && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load(page + 1)}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Load older entries (${entries.length} of ${total})`}
          </Button>
        </div>
      )}
    </div>
  );
};
