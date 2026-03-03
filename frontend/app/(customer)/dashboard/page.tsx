'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Ticket, CheckCircle, AlertCircle, Clock, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Summary {
  open: string; in_progress: string; escalated: string;
  resolved: string; closed: string; total: string;
}

const statCards = [
  { key: 'open', label: 'Open', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'in_progress', label: 'In Progress', icon: RefreshCw, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { key: 'escalated', label: 'Escalated', icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
];

export default function CustomerDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get('/dashboard/customer')
      .then((r) => setSummary(r.data.summary))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Overview of your support tickets</p>
        </div>
        <Link
          href="/tickets/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition"
        >
          <Ticket className="w-4 h-4" /> New Ticket
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ key, label, icon: Icon, color, bg }) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary?.[key as keyof Summary] || '0'}
              </div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
          <Link href="/tickets" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <TicketList />
      </div>
    </div>
  );
}

function TicketList() {
  const [tickets, setTickets] = useState<Array<{
    id: string; issue_type: string; priority: string;
    status: string; created_at: string; description: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tickets?limit=5')
      .then((r) => setTickets(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const priorityColors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-green-100 text-green-700',
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    escalated: 'bg-orange-100 text-orange-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
  };

  if (loading) return <div className="bg-white rounded-xl p-8 animate-pulse h-40" />;
  if (!tickets.length) return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
      No tickets yet. <Link href="/tickets/new" className="text-blue-600 hover:underline">Create one?</Link>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {tickets.map((t) => (
        <Link
          key={t.id}
          href={`/tickets/${t.id}`}
          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{t.issue_type}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{t.description.substring(0, 80)}...</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[t.priority] || ''}`}>
              {t.priority}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[t.status] || ''}`}>
              {t.status.replace('_', ' ')}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
