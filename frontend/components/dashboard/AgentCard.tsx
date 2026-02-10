'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDID, formatUSD1, getStatusColor, getScoreColor } from '@/lib/utils';
import { Bot, Settings, Shield } from 'lucide-react';

interface AgentCardProps {
  agent: {
    id: number;
    name: string;
    sub_did: string | null;
    agent_score: number;
    daily_limit: number | null;
    single_limit: number | null;
    mandate_expiry: string | null;
    status: string;
  };
}

export function AgentCard({ agent }: AgentCardProps) {
  const isMandateActive = agent.mandate_expiry
    ? new Date(agent.mandate_expiry) > new Date()
    : false;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatDID(agent.sub_did || '')}</p>
          </div>
        </div>
        <Badge className={getStatusColor(agent.status)}>{agent.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Agent Score</span>
          <span className={`text-lg font-bold ${getScoreColor(agent.agent_score)}`}>
            {agent.agent_score}
          </span>
        </div>

        {/* Mandate Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Mandate</span>
          <div className="flex items-center gap-2">
            <Shield className={`h-4 w-4 ${isMandateActive ? 'text-green-500' : 'text-gray-400'}`} />
            <span className={isMandateActive ? 'text-green-600' : 'text-gray-500'}>
              {isMandateActive ? 'Active' : 'Not Set'}
            </span>
          </div>
        </div>

        {/* Limits */}
        {agent.daily_limit && (
          <div className="rounded-lg bg-muted p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Daily Limit</span>
                <p className="font-medium">{formatUSD1(agent.daily_limit)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Single Limit</span>
                <p className="font-medium">{formatUSD1(agent.single_limit || 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/dashboard/agents/${agent.id}`}>
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
