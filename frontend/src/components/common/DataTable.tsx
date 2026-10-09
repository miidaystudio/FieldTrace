import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKey?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedKey,
  searchable = true,
  searchPlaceholder = 'Filter records...',
  searchFilter,
  pageSize = 10,
  emptyMessage = 'No records found matching criteria',
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter
  const filteredData = React.useMemo(() => {
    if (!search || !searchFilter) return data;
    return data.filter((item) => searchFilter(item, search.toLowerCase()));
  }, [data, search, searchFilter]);

  // Sort
  const sortedData = React.useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className={twMerge('flex flex-col bg-ops-panel border border-ops-border rounded-xl overflow-hidden', className)}>
      {searchable && (
        <div className="p-3.5 border-b border-ops-border bg-ops-base/40 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-ops-card border border-ops-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-teal transition-colors"
            />
          </div>
          <div className="text-xs text-gray-400 font-mono">
            Showing {Math.min(sortedData.length, (currentPage - 1) * pageSize + 1)} -{' '}
            {Math.min(sortedData.length, currentPage * pageSize)} of {sortedData.length}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-ops-border bg-ops-base/60 text-gray-400 uppercase tracking-wider font-semibold">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={twMerge(
                    'py-3 px-4 select-none',
                    col.sortable && 'cursor-pointer hover:text-brand-teal transition-colors',
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-brand-teal" /> : <ChevronDown className="w-3.5 h-3.5 text-brand-teal" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ops-border/60">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-gray-500 italic">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                const key = keyExtractor(item);
                const isSelected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={twMerge(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-ops-card/80',
                      isSelected && 'bg-brand-teal/10 border-l-2 border-l-brand-teal'
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={twMerge('py-3 px-4 text-gray-200', col.className)}>
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-ops-border bg-ops-base/30 flex items-center justify-between text-xs text-gray-400">
          <div>Page {currentPage} of {totalPages}</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-ops-card border border-ops-border disabled:opacity-40 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-ops-card border border-ops-border disabled:opacity-40 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
