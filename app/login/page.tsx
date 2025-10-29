'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TrendingUp, User, Users } from 'lucide-react';
import type { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState('');

  const handleLogin = () => {
    if (!selectedRole || !username.trim()) return;

    const user = {
      id: Date.now().toString(),
      role: selectedRole,
      theme: 'light' as const,
      localToken: `local-${Date.now()}`,
    };

    setUser(user);

    // Apply initial theme
    document.documentElement.classList.remove('dark');

    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <TrendingUp className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">AI Portfolio Recommendation</CardTitle>
          <CardDescription>
            Local authentication - Choose your role to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium mb-2 block">
              Username
            </label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedRole('admin')}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:bg-accent ${
                  selectedRole === 'admin'
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                <User className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Admin</div>
                  <div className="text-xs text-muted-foreground">
                    Full access
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('stakeholder')}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:bg-accent ${
                  selectedRole === 'stakeholder'
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}
              >
                <Users className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Stakeholder</div>
                  <div className="text-xs text-muted-foreground">
                    Read-only
                  </div>
                </div>
              </button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={!selectedRole || !username.trim()}
            className="w-full"
          >
            Continue
          </Button>

          <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Local Mode</p>
            <p>
              This is a client-only application. Your data is stored locally and
              never sent to any server.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
