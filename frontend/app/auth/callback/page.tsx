'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { setAccessToken } from '@/lib/api';
import { Suspense } from 'react';

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loadUser } = useAuthStore();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    // Store tokens
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    document.cookie = 'has_session=1; path=/; SameSite=Lax';

    // Load user profile then redirect based on role
    loadUser().then(() => {
      const user = useAuthStore.getState().user;
      if (!user) { router.replace('/login'); return; }
      if (user.role === 'admin') router.replace('/admin/dashboard');
      else if (user.role.startsWith('agent')) router.replace('/agent/dashboard');
      else router.replace('/dashboard');
    }).catch(() => router.replace('/login?error=oauth_failed'));
  }, [searchParams, router, loadUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OAuthCallbackInner />
    </Suspense>
  );
}
