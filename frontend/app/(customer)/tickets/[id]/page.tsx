'use client';

import { useEffect, useState, useCallback, use } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Send, Loader2, Package, CreditCard, Lock } from 'lucide-react';

interface Ticket {
  id: string; issue_type: string; priority: string; status: string;
  description: string; order_id?: string; escalation_level: number;
  created_at: string; updated_at: string; customer_name?: string; agent_name?: string;
}
interface Message {
  id: string; message: string; is_internal: boolean; created_at: string;
  sender_name: string; sender_role: string; user_id: string;
}

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

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [orderInfo, setOrderInfo] = useState<Record<string, unknown> | null>(null);
  const [payments, setPayments] = useState<unknown[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    Promise.all([
      api.get(`/tickets/${id}`),
      api.get(`/tickets/${id}/messages`),
    ]).then(([tRes, mRes]) => {
      setTicket(tRes.data.ticket);
      setMessages(mRes.data.data || []);

      // Load order if present
      if (tRes.data.ticket.order_id) {
        api.get(`/orders/${tRes.data.ticket.order_id}`)
          .then(r => {
            setOrderInfo(r.data.order);
            return api.get(`/orders/${tRes.data.ticket.order_id}/payments`);
          })
          .then(r => setPayments(r.data.payments || []))
          .catch(() => {});
      }
    }).catch(() => toast.error('Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const i = setInterval(loadData, 30000);
    return () => clearInterval(i);
  }, [loadData]);

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/messages`, { message: newMsg.trim() });
      setNewMsg('');
      loadData();
      toast.success('Message sent');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="p-8 animate-pulse">Loading ticket...</div>;
  if (!ticket) return <div className="p-8 text-gray-500">Ticket not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{ticket.issue_type}</h2>
            <p className="text-xs text-gray-400 mt-1">#{ticket.id?.substring(0,8)} · Created {format(new Date(ticket.created_at), 'MMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${priorityColors[ticket.priority]}`}>
              {ticket.priority}
            </span>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[ticket.status]}`}>
              {ticket.status.replace('_',' ')}
            </span>
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
              Level {ticket.escalation_level}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-4 bg-gray-50 p-3 rounded-lg">{ticket.description}</p>
        {ticket.agent_name && (
          <p className="text-xs text-gray-500 mt-3">Assigned to: <span className="font-medium">{ticket.agent_name}</span></p>
        )}
      </div>

      {/* Order Info */}
      {orderInfo && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Linked Order</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Status:</span> <span className="font-medium">{String(orderInfo.status)}</span></div>
            <div><span className="text-gray-500">Total:</span> <span className="font-medium">${String(orderInfo.total_amount)}</span></div>
          </div>
          {payments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-600">Payment Status</p>
              </div>
              {(payments as Array<Record<string, unknown>>).map((p, i) => (
                <p key={i} className="text-xs text-gray-500">
                  {String(p.payment_method)} — ${String(p.amount)} — <span className="font-medium">{String(p.status)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Conversation</h3>
        </div>

        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No messages yet</p>
          ) : messages.map((m) => (
            <div key={m.id} className={`px-6 py-4 ${m.user_id === user?.id ? 'bg-blue-50' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700">{m.sender_name}</span>
                <span className="text-xs text-gray-400">{m.sender_role}</span>
                {m.is_internal && (
                  <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Internal
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{format(new Date(m.created_at), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-sm text-gray-700">{m.message}</p>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {ticket.status !== 'resolved' && ticket.status !== 'closed' && ticket.status !== 'deleted' && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex gap-3">
              <textarea
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                rows={2}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Type your message..."
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMsg.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
