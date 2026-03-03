'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const initializeFromStorage = useAuthStore((s) => s.initializeFromStorage);

  useEffect(() => {
    initializeFromStorage();
  }, [initializeFromStorage]);

  return <>{children}</>;
}
