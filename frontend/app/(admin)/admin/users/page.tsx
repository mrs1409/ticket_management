'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { RefreshCw, UserCheck, UserX, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string; name: string; email: string; role: string;
  is_active: boolean; created_at: string;
}

const ROLES = ['customer', 'agent_l1', 'agent_l2', 'agent_l3', 'admin'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/users?page=${page}&limit=20`)
      .then((r) => {
        setUsers(r.data.data || []);
        setTotal(r.data.pagination?.total || 0);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, newRole: string) {
    setActing(userId);
    try {
      await api.patch(`/admin/users/${userId}`, { role: newRole });
      toast.success('Role updated');
      load();
    } catch { toast.error('Failed to update role'); }
    finally { setActing(null); }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    setActing(userId);
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !isActive });
      toast.success(isActive ? 'User deactivated' : 'User activated');
      load();
    } catch { toast.error('Failed to update user'); }
    finally { setActing(null); }
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    agent_l1: 'bg-blue-100 text-blue-700',
    agent_l2: 'bg-indigo-100 text-indigo-700',
    agent_l3: 'bg-violet-100 text-violet-700',
    customer: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-1">{total} total users</p>
        </div>
        <button onClick={load} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 animate-pulse h-48" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">User</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Joined</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      disabled={acting === u.id}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleColors[u.role]}`}
                    >
                      {ROLES.map(r => <option key={r} value={r} className="bg-white text-gray-900">{r}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {format(new Date(u.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleActive(u.id, u.is_active)}
                      disabled={acting === u.id}
                      className={`p-1.5 rounded-lg transition ${u.is_active ? 'hover:bg-red-50 text-gray-400 hover:text-red-600' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                      title={u.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50">Prev</button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page*20>=total} className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
