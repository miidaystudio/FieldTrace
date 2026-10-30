import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, ClipboardList } from 'lucide-react';
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
    <div className={twMerge('flex flex-col bg-[#161920] border border-white/[0.05] rounded-3xl p-6 text-white shadow-xl', className)}>
      {searchable && (
        <div className="pb-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-[#1D212B] border border-white/[0.08] text-white placeholder-[#64748B] text-xs rounded-full pl-9 pr-4 py-2 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>
          <div className="text-xs font-mono text-[#8E96A4]">
            Showing {sortedData.length === 0 ? 0 : Math.min(sortedData.length, (currentPage - 1) * pageSize + 1)} -{' '}
            {Math.min(sortedData.length, currentPage * pageSize)} of {sortedData.length}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={twMerge(
                    'py-3.5 px-4 select-none text-[11px] font-mono uppercase tracking-wider text-[#64748B]',
                    col.sortable && 'cursor-pointer hover:text-white transition-colors',
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-white" /> : <ChevronDown className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-center text-[#8E96A4] text-sm font-medium">
                    <ClipboardList className="text-[#3A4150] w-10 h-10 mb-3" />
                    <span>{emptyMessage}</span>
                  </div>
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
                      'transition-colors hover:bg-white/[0.02]',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-white/[0.06] border-l-2 border-l-white'
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={twMerge('py-4 px-4 text-white', col.className)}>
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
        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#8E96A4]">
          <div className="font-mono text-[11px]">Page {currentPage} of {totalPages}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-full bg-[#1D212B] border border-white/[0.08] text-white flex items-center justify-center hover:bg-white/[0.1] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-full bg-[#1D212B] border border-white/[0.08] text-white flex items-center justify-center hover:bg-white/[0.1] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
