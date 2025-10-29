'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { RouteGuard } from '@/components/RouteGuard';
import { useUIStore } from '@/store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <RouteGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div
          className={`flex flex-1 flex-col transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}
        >
          <Header />
          <main className="flex-1 overflow-auto mt-16 p-6">
            {children}
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
