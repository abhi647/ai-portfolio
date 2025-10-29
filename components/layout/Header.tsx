'use client';

import { Moon, Sun, User, LogOut } from 'lucide-react';
import { useUserStore, useUIStore } from '@/store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, setTheme, logout } = useUserStore();
  const { sidebarCollapsed } = useUIStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleTheme = () => {
    if (!user) return;
    const newTheme = user.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    // Apply theme to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 border-b bg-background transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">
            {user?.role === 'admin' ? 'Admin Dashboard' : 'Portfolio View'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {user?.theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* User Info */}
          {user && (
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium capitalize">
                {user.role}
              </span>
            </div>
          )}

          {/* Logout */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
