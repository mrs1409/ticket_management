'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

interface AnalyticsData {
  daily: { date: string; count: number }[];
  by_priority: { priority: string; count: number }[];
  by_status: { status: string; count: number }[];
  by_issue_type: { issue_type: string; count: number }[];
  avg_resolution_hours: number;
  escalation_rate: number;
  by_escalation_level?: { level: string; count: number }[];
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/tickets?days=${days}`)
      .then((r: { data: AnalyticsData }) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load analytics data.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tickets"
          value={data.daily.reduce((s, d) => s + d.count, 0).toString()}
          sub={`Last ${days} days`}
        />
        <StatCard
          label="Avg Resolution"
          value={data.avg_resolution_hours != null ? `${data.avg_resolution_hours.toFixed(1)}h` : 'N/A'}
          sub="Hours to resolve"
        />
        <StatCard
          label="Escalation Rate"
          value={`${(data.escalation_rate * 100).toFixed(1)}%`}
          sub="Of all tickets"
          highlight={data.escalation_rate > 0.2}
        />
        <StatCard
          label="Open/In Progress"
          value={(
            (data.by_status.find(s => s.status === 'open')?.count ?? 0) +
            (data.by_status.find(s => s.status === 'in_progress')?.count ?? 0)
          ).toString()}
          sub="Active tickets"
        />
      </div>

      {/* Daily tickets bar chart */}
      <div className="bg-white rounded-lg shadow-sm border p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Tickets per Day</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.daily} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} name="Tickets" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By priority pie */}
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">By Priority</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.by_priority} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={80} label={(entry: { priority?: string; percent?: number }) => `${entry.priority ?? ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {data.by_priority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By status pie */}
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">By Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={(entry: { status?: string; percent?: number }) => `${entry.status ?? ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {data.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By issue type */}
      <div className="bg-white rounded-lg shadow-sm border p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">By Issue Type</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.by_issue_type} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="issue_type" tick={{ fontSize: 11 }} width={100} />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" radius={[0, 3, 3, 0]} name="Tickets" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Escalation by level if present */}
      {data.by_escalation_level && data.by_escalation_level.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Escalations by Level</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.by_escalation_level}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Escalations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, highlight = false }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${highlight ? 'border-red-300' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
