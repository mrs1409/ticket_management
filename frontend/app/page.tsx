'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const { user, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    switch (user?.role) {
      case 'admin': router.replace('/admin/dashboard'); break;
      case 'agent_l1':
      case 'agent_l2':
      case 'agent_l3': router.replace('/agent/dashboard'); break;
      default: router.replace('/dashboard');
    }
  }, [user, isLoading, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 animate-pulse text-lg">Loading TicketDesk...</div>
    </div>
  );
}
