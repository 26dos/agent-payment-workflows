'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDID, formatUSD1, formatDate, getStatusColor, getComplexityLabel } from '@/lib/utils';
import { ArrowRight, Clock, DollarSign } from 'lucide-react';

interface TaskCardProps {
  task: {
    id: number;
    requester_did: string;
    provider_did: string;
    base_amount: number;
    final_amount: number;
    complexity: number;
    status: string;
    created_at: string;
    expiry_time: string;
  };
  isRequester?: boolean;
}

export function TaskCard({ task, isRequester = true }: TaskCardProps) {
  const isExpired = new Date(task.expiry_time) < new Date();
  const showActions = task.status === 'created' || task.status === 'accepted';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Task #{task.id}</CardTitle>
          <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
        </div>
        <Badge variant="outline">{getComplexityLabel(task.complexity)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DIDs */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {isRequester ? 'Provider:' : 'Requester:'}
          </span>
          <span className="font-mono">
            {formatDID(isRequester ? task.provider_did : task.requester_did)}
          </span>
        </div>

        {/* Amounts */}
        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Base Fee</p>
              <p className="font-medium">{formatUSD1(task.base_amount)}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Final Amount</p>
            <p className="font-bold text-primary">{formatUSD1(task.final_amount)}</p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Created: {formatDate(task.created_at)}</span>
          </div>
          {isExpired && task.status === 'created' && (
            <Badge variant="destructive">Expired</Badge>
          )}
        </div>

        {/* Actions */}
        <Button asChild variant="outline" className="w-full">
          <Link href={`/dashboard/tasks/${task.id}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
