'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RefreshCw, ChevronRight, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface AgentSummary {
  open_assigned: string; critical: string; high: string; medium: string; low: string; resolved_today: string;
}
interface Ticket {
  id: string; issue_type: string; priority: string; status: string; created_at: string; description: string;
}

const priorityColors: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

export default function AgentDashboard() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/agent'),
      api.get('/tickets?limit=20'),
    ]).then(([sumRes, tRes]) => {
      setSummary(sumRes.data.summary);
      setTickets(tRes.data.data || []);
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, [load]);

  const grouped = {
    Critical: tickets.filter(t => t.priority === 'Critical'),
    High: tickets.filter(t => t.priority === 'High'),
    Medium: tickets.filter(t => t.priority === 'Medium'),
    Low: tickets.filter(t => t.priority === 'Low'),
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Your assigned tickets and workload</p>
        </div>
        <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-5">
            <div className="text-2xl font-bold text-gray-900">{summary.open_assigned}</div>
            <div className="text-sm text-gray-500 mt-1">Open Tickets</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
            <div className="text-sm text-gray-500 mt-1">Critical</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
            <div className="text-sm text-gray-500 mt-1">High Priority</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
            <div className="text-sm text-gray-500 mt-1">Medium Priority</div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="text-2xl font-bold text-green-600">{summary.resolved_today}</div>
            <div className="text-sm text-gray-500 mt-1">Resolved Today</div>
          </div>
        </div>
      )}

      {/* Kanban-style priority groups */}
      {loading ? (
        <div className="animate-pulse bg-white rounded-xl h-48" />
      ) : (
        <div className="space-y-6">
          {(['Critical', 'High', 'Medium', 'Low'] as const).map(priority => (
            grouped[priority].length > 0 && (
              <div key={priority}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priorityColors[priority]}`}>{priority}</span>
                  <span className="text-sm text-gray-500">{grouped[priority].length} tickets</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {grouped[priority].map(t => (
                    <Link key={t.id} href={`/agent/tickets/${t.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 border-b last:border-0 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{t.issue_type}</p>
                        <p className="text-xs text-gray-500 truncate">{t.description.substring(0,80)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(t.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        t.status === 'escalated' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{t.status.replace('_',' ')}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  ))}
                </div>
              </div>
            )
          ))}
          {tickets.length === 0 && (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              No open tickets assigned to you
            </div>
          )}
        </div>
      )}
    </div>
  );
}
