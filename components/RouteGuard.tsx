'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/store';

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUserStore();

  useEffect(() => {
    const publicPaths = ['/login'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.push('/login');
    } else if (user && pathname === '/login') {
      router.push('/dashboard');
    }

    // Apply theme
    if (user?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user, pathname, router]);

  return <>{children}</>;
}
