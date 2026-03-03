'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Loader2, Send, Package } from 'lucide-react';

const ISSUE_TYPES = ['Delivery', 'Payment', 'Return', 'Refund', 'Product', 'Account', 'Technical', 'Other'];

export default function NewTicketPage() {
  const [form, setForm] = useState({
    subject: '',
    issue_type: '',
    description: '',
    order_id: '',
  });
  const [orderInfo, setOrderInfo] = useState<{
    id: string; status: string; total_amount: number; items: Array<{name: string; quantity: number}>
  } | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function fetchOrder(id: string) {
    if (!id.trim()) return;
    setLoadingOrder(true);
    setOrderInfo(null);
    try {
      const { data } = await api.get(`/orders/${id.trim()}`);
      setOrderInfo(data.order);
    } catch {
      toast.error('Order not found or does not belong to your account');
    } finally {
      setLoadingOrder(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.issue_type) { toast.error('Please select an issue type'); return; }
    if (form.description.length < 10) { toast.error('Description too short'); return; }

    setSubmitting(true);
    try {
      const { data } = await api.post('/tickets', form);
      toast.success('Ticket created successfully!');
      router.push(`/tickets/${data.ticket.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create ticket';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">New Support Ticket</h2>
        <p className="text-gray-500 text-sm mt-1">Describe your issue and we&apos;ll get back to you shortly</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
            required
            minLength={5}
            maxLength={500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Brief summary of your issue..."
          />
        </div>

        {/* Issue Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type *</label>
          <select
            value={form.issue_type}
            onChange={(e) => setForm(f => ({ ...f, issue_type: e.target.value }))}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Select issue type...</option>
            {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Order ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID (optional)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.order_id}
              onChange={(e) => setForm(f => ({ ...f, order_id: e.target.value }))}
              onBlur={() => form.order_id && fetchOrder(form.order_id)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Paste your order ID..."
            />
            <button
              type="button"
              onClick={() => fetchOrder(form.order_id)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {loadingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4 text-gray-500" />}
            </button>
          </div>

          {orderInfo && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="font-medium text-blue-700">Order found ✓</p>
              <p className="text-blue-600">Status: <span className="font-medium">{orderInfo.status}</span></p>
              <p className="text-blue-600">Total: <span className="font-medium">${orderInfo.total_amount}</span></p>
              <p className="text-blue-600 text-xs mt-1">
                {orderInfo.items.map(i => `${i.name} (×${i.quantity})`).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            required
            rows={5}
            minLength={10}
            maxLength={5000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            placeholder="Please describe your issue in detail..."
          />
          <p className="text-xs text-gray-400 mt-1">{form.description.length}/5000</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-medium">Priority is auto-detected</p>
          <p className="mt-0.5">Based on your description, our system will automatically set the appropriate priority level.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
}
