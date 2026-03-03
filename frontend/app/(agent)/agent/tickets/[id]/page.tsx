'use client';

import { useEffect, useState, useCallback, use } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Send, Loader2, Lock, TrendingUp, CheckCircle, UserCheck } from 'lucide-react';

interface Ticket {
  id: string; issue_type: string; priority: string; status: string;
  description: string; order_id?: string; escalation_level: number;
  created_at: string; updated_at: string; customer_name?: string; assigned_to?: string;
  user_id: string;
}
interface Message { id: string; message: string; is_internal: boolean; created_at: string; sender_name: string; sender_role: string; }
interface Agent { id: string; name: string; role: string; }

export default function AgentTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get(`/tickets/${id}`),
      api.get(`/tickets/${id}/messages`),
      api.get('/agents/workload'),
    ]).then(([tRes, mRes, aRes]) => {
      setTicket(tRes.data.ticket);
      setMessages(mRes.data.data || []);
      setAgents(aRes.data.workload || []);
    }).catch(() => toast.error('Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, { message: newMsg.trim(), is_internal: isInternal });
      setNewMsg('');
      load();
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  }

  async function resolveTicket() {
    setActing(true);
    try {
      await api.post(`/tickets/${id}/resolve`);
      toast.success('Ticket resolved!');
      load();
    } catch { toast.error('Failed to resolve'); }
    finally { setActing(false); }
  }

  async function escalateTicket() {
    if (!escalateReason.trim()) { toast.error('Reason required'); return; }
    setActing(true);
    try {
      await api.post(`/tickets/${id}/escalate`, { reason: escalateReason });
      toast.success('Ticket escalated!');
      setShowEscalate(false);
      setEscalateReason('');
      load();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to escalate');
    } finally { setActing(false); }
  }

  async function reassignTicket() {
    if (!reassignTo) return;
    try {
      await api.post(`/tickets/${id}/reassign`, { agent_id: reassignTo });
      toast.success('Ticket reassigned');
      load();
    } catch { toast.error('Failed to reassign'); }
  }

  const priorityColors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700', High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700', Low: 'bg-green-100 text-green-700',
  };

  if (loading) return <div className="p-8 animate-pulse">Loading...</div>;
  if (!ticket) return <div className="p-8 text-gray-500">Ticket not found</div>;

  const canEscalate = ticket.escalation_level < 3 && !['resolved','closed','deleted'].includes(ticket.status);
  const canResolve = !['resolved','closed','deleted'].includes(ticket.status);

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{ticket.issue_type}</h2>
            <p className="text-xs text-gray-400 mt-1">#{ticket.id?.substring(0,8)} · {ticket.customer_name} · Level {ticket.escalation_level}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700">{ticket.status.replace('_',' ')}</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{ticket.description}</p>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-5">
          {canResolve && (
            <button onClick={resolveTicket} disabled={acting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              <CheckCircle className="w-4 h-4" /> Resolve
            </button>
          )}
          {canEscalate && (
            <button onClick={() => setShowEscalate(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
              <TrendingUp className="w-4 h-4" /> Escalate to L{ticket.escalation_level + 1}
            </button>
          )}

          {/* Reassign */}
          <div className="flex items-center gap-2">
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Reassign to...</option>
              {agents.filter(a => a.id !== ticket.assigned_to).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
              ))}
            </select>
            {reassignTo && (
              <button onClick={reassignTicket}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
                <UserCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Escalation reason input */}
        {showEscalate && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-800 mb-2">Escalation Reason</p>
            <textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              rows={2}
              className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-2"
              placeholder="Why are you escalating this ticket?"
            />
            <div className="flex gap-2">
              <button onClick={escalateTicket} disabled={acting}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50">
                {acting ? 'Escalating...' : 'Confirm Escalation'}
              </button>
              <button onClick={() => setShowEscalate(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Conversation (Agent View)</h3>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
          ) : messages.map((m) => (
            <div key={m.id} className={`px-6 py-4 ${m.is_internal ? 'bg-purple-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700">{m.sender_name}</span>
                <span className="text-xs text-gray-400">{m.sender_role}</span>
                {m.is_internal && (
                  <span className="flex items-center gap-1 text-xs text-purple-700 font-medium">
                    <Lock className="w-3 h-3" /> Internal Note
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{format(new Date(m.created_at), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-sm text-gray-700">{m.message}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Lock className="w-3.5 h-3.5 text-purple-600" />
              <span className={isInternal ? 'text-purple-700 font-medium' : 'text-gray-600'}>Internal note</span>
            </label>
          </div>
          <div className="flex gap-3">
            <textarea
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              rows={2}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
                isInternal ? 'border-purple-200 focus:ring-purple-400 bg-purple-50' : 'border-gray-200 focus:ring-blue-500'
              }`}
              placeholder={isInternal ? 'Internal note (not visible to customer)...' : 'Reply to customer...'}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !newMsg.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
