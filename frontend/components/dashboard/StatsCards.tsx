'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { formatUSD1 } from '@/lib/utils';
import { TrendingUp, CheckCircle, Clock, AlertCircle, Bot, BarChart3 } from 'lucide-react';

export function StatsCards() {
  const { dashboardStats } = useAppStore();

  const stats = [
    {
      title: 'Total Tasks',
      value: dashboardStats?.total_tasks || 0,
      icon: BarChart3,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Completed',
      value: dashboardStats?.completed_tasks || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Active',
      value: dashboardStats?.active_tasks || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Disputed',
      value: dashboardStats?.disputed_tasks || 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    {
      title: 'Total Volume',
      value: formatUSD1(dashboardStats?.total_volume || 0),
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
    {
      title: 'Active Agents',
      value: dashboardStats?.total_agents || 0,
      icon: Bot,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
