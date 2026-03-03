'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { PlusCircle, Search, Filter, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  subject: string;
  issue_type: string;
  priority: string;
  status: string;
  created_at: string;
  description: string;
  order_id?: string;
}

const priorityColors: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-green-100 text-green-700 border-green-200',
};
const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  escalated: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', priority: '', order_id: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.order_id) params.set('order_id', filters.order_id);

    api.get(`/tickets?${params}`)
      .then((r) => { setTickets(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Tickets</h2>
          <p className="text-gray-500 text-sm mt-1">{total} total tickets</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <Link
            href="/tickets/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> New Ticket
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <Filter className="w-4 h-4 text-gray-400 mt-2.5" />
        <select
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          {['open','in_progress','escalated','resolved','closed'].map(s => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priority</option>
          {['Critical','High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="text"
          placeholder="Order ID..."
          value={filters.order_id}
          onChange={(e) => setFilters(f => ({ ...f, order_id: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { setFilters({ status: '', priority: '', order_id: '' }); setPage(1); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-2"
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-8 animate-pulse h-64" />
      ) : !tickets.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          No tickets found.{' '}
          <Link href="/tickets/new" className="text-blue-600 hover:underline">Create one?</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900">{t.subject || t.issue_type}</p>
                  {t.order_id && (
                    <span className="text-xs text-gray-400">Order: {t.order_id.substring(0,8)}...</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{t.issue_type} · {t.description.substring(0,80)}</p>
                <p className="text-xs text-gray-400 mt-1">{format(new Date(t.created_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${priorityColors[t.priority]}`}>
                  {t.priority}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[t.status]}`}>
                  {t.status.replace('_',' ')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 10 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 10 >= total}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
