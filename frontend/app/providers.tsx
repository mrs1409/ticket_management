'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const initializeFromStorage = useAuthStore((s) => s.initializeFromStorage);
  const pathname = usePathname();

  useEffect(() => {
    // Don't run on the OAuth callback page — it handles its own token setup
    if (pathname.startsWith('/auth/callback')) return;
    initializeFromStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  return <>{children}</>;
}
