'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectStore, useUserStore } from '@/store';
import { TrendingUp, TrendingDown, Activity, DollarSign, Upload, Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentProject } = useProjectStore();
  const { user } = useUserStore();
  const isAdmin = user?.role === 'admin';

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Welcome to AI Portfolio</CardTitle>
            <CardDescription>
              Get started by creating a new project or importing data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <>
                <Button className="w-full" asChild>
                  <Link href="/onboarding">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Project
                  </Link>
                </Button>
                <Button variant="outline" className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Project Bundle
                </Button>
              </>
            ) : (
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-semibold mb-2">Read-Only Access</p>
                <p className="text-muted-foreground">
                  You need an Admin account to create projects. Please contact your
                  administrator or switch to an Admin account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your portfolio performance and signals
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAGR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-8.3%</div>
            <p className="text-xs text-muted-foreground">
              Within acceptable range
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sortino Ratio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.85</div>
            <p className="text-xs text-muted-foreground">
              Strong risk-adjusted returns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Signals
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              12 BUY • 8 HOLD • 3 SELL
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
            <CardDescription>Portfolio performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Chart will appear here after data ingestion
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sector Exposure</CardTitle>
            <CardDescription>Portfolio allocation by sector</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Chart will appear here after data ingestion
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and operations</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/backtest">Run Backtest</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/simulate">Create Scenario</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/reports">Generate Report</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
