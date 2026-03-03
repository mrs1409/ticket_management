'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { RefreshCw, Users, Ticket, TrendingUp, CheckCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface AdminSummary {
  total: string; open: string; in_progress: string; escalated: string; resolved: string; closed: string;
}
interface AgentPerf {
  id: string; name: string; role: string; resolved_total: string; open_count: string; resolved_today: string;
}
interface EscalationRate { escalated_tickets: string; total_tickets: string; }

const COLORS = ['#3b82f6','#f59e0b','#f97316','#22c55e','#6b7280'];

export default function AdminDashboard() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [agents, setAgents] = useState<AgentPerf[]>([]);
  const [escalationRate, setEscalationRate] = useState<EscalationRate | null>(null);
  const [analytics, setAnalytics] = useState<{
    daily_created: Array<{ date: string; count: string }>;
    by_priority: Array<{ priority: string; count: string }>;
    by_status: Array<{ status: string; count: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/dashboard/admin'),
      api.get('/analytics/tickets'),
    ]).then(([sumRes, analyticsRes]) => {
      setSummary(sumRes.data.totals);
      setAgents(sumRes.data.agent_performance);
      setEscalationRate(sumRes.data.escalation_rate);
      setAnalytics(analyticsRes.data);
    }).catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const escalPct = escalationRate
    ? ((parseInt(escalationRate.escalated_tickets) / Math.max(parseInt(escalationRate.total_tickets), 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">System-wide ticket overview</p>
        </div>
        <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {loading ? <div className="animate-pulse bg-white rounded-xl h-64" /> : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total', value: summary.total, color: 'text-gray-900', bg: 'bg-gray-100', Icon: Ticket },
                { label: 'Open', value: summary.open, color: 'text-blue-600', bg: 'bg-blue-50', Icon: Ticket },
                { label: 'Escalated', value: summary.escalated, color: 'text-orange-600', bg: 'bg-orange-50', Icon: TrendingUp },
                { label: 'Resolved', value: summary.resolved, color: 'text-green-600', bg: 'bg-green-50', Icon: CheckCircle },
              ].map(({ label, value, color, bg, Icon }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily created bar chart */}
            {analytics?.daily_created && analytics.daily_created.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Tickets Created (Last 30 days)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.daily_created.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Priority distribution */}
            {analytics?.by_priority && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Tickets by Priority</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.by_priority} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={70}>
                      {analytics.by_priority.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Escalation rate */}
          {escalationRate && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
              <h3 className="font-semibold text-gray-900 mb-2">Escalation Rate</h3>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-orange-600">{escalPct}%</div>
                <p className="text-sm text-gray-500">
                  {escalationRate.escalated_tickets} of {escalationRate.total_tickets} tickets were escalated
                </p>
              </div>
            </div>
          )}

          {/* Agent Performance Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Agent Performance</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Agent</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Role</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Open</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Resolved Total</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Resolved Today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agents.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-5 py-3 text-gray-500">{a.role.replace('_',' ')}</td>
                      <td className="px-5 py-3 text-right text-blue-600 font-semibold">{a.open_count}</td>
                      <td className="px-5 py-3 text-right text-green-600 font-semibold">{a.resolved_total}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{a.resolved_today}</td>
                    </tr>
                  ))}
                  {!agents.length && (
                    <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-400">No agents found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
