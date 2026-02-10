'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { getScoreColor } from '@/lib/utils';

export function ReputationGauge() {
  const { user } = useAppStore();
  const score = user?.human_score || 75;

  // Calculate rotation for gauge
  const rotation = (score / 100) * 180 - 90;

  // Determine tier
  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Premium', color: 'text-green-600', discount: '0.8x' };
    if (score >= 60) return { name: 'Standard', color: 'text-blue-600', discount: '1.0x' };
    if (score >= 40) return { name: 'Risk', color: 'text-yellow-600', discount: '1.2x' };
    return { name: 'Critical', color: 'text-red-600', discount: '1.5x' };
  };

  const tier = getTier(score);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Reputation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gauge visualization */}
        <div className="relative mx-auto h-32 w-64">
          {/* Background arc */}
          <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-64 rounded-full border-[16px] border-gray-200" />
          </div>

          {/* Colored segments */}
          <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 h-64 rounded-full border-[16px] border-transparent"
              style={{
                background: `conic-gradient(from 180deg, 
                  #ef4444 0deg, 
                  #f97316 72deg, 
                  #eab308 108deg, 
                  #22c55e 144deg, 
                  #22c55e 180deg, 
                  transparent 180deg)`,
                WebkitMaskImage: 'radial-gradient(transparent 55%, black 56%)',
                maskImage: 'radial-gradient(transparent 55%, black 56%)',
              }}
            />
          </div>

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 h-24 w-1 origin-bottom bg-primary transition-transform duration-500"
            style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
          >
            <div className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary" />
          </div>

          {/* Center circle */}
          <div className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-full bg-background border-2 border-primary" />

          {/* Score display */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>0</span>
          <span>40</span>
          <span>60</span>
          <span>90</span>
          <span>100</span>
        </div>

        {/* Tier info */}
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Tier</p>
              <p className={`text-lg font-bold ${tier.color}`}>{tier.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Price Modifier</p>
              <p className="text-lg font-bold">{tier.discount}</p>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium">Score Factors</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Human Score (70%)</span>
              <span>{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent Avg (30%)</span>
              <span>75</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Final Score</span>
              <span>{score}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
