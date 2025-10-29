'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';

export default function Home() {
  const router = useRouter();
  const { user } = useUserStore();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-lg text-muted-foreground">
        Loading...
      </div>
    </div>
  );
}
