'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { LayoutDashboard, Ticket, LogOut, User, Menu, X } from 'lucide-react';
import { clsx } from 'clsx';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
    else if (!isLoading && user?.role === 'customer') router.replace('/dashboard');
    else if (!isLoading && user?.role === 'admin') router.replace('/admin/dashboard');
  }, [user, isLoading, isAuthenticated, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  async function handleLogout() {
    await logout();
    toast.success('Logged out');
    router.replace('/login');
  }

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Loading...</div>
    </div>
  );

  const roleLabel = user.role === 'agent_l1' ? 'L1 Agent' : user.role === 'agent_l2' ? 'L2 Agent' : 'L3 Agent';

  const navItems = [
    { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/agent/tickets', label: 'My Tickets', icon: Ticket },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-600">TicketDesk</h1>
          <p className="text-xs text-gray-500 mt-0.5">{roleLabel} Portal</p>
        </div>
        <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
              pathname.startsWith(item.href) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            )}>
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <SidebarContent />
      </nav>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <nav className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col md:hidden transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </nav>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-700">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-blue-600 text-base">TicketDesk</span>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

