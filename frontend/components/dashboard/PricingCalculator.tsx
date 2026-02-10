'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatUSD1 } from '@/lib/utils';
import { pricingApi } from '@/lib/api';
import { Calculator, Loader2 } from 'lucide-react';

export function PricingCalculator() {
  const [baseFee, setBaseFee] = useState('10');
  const [complexity, setComplexity] = useState(1);
  const [reputationScore, setReputationScore] = useState(75);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    final_price: number;
    k_reputation: number;
    k_complexity: number;
    k_supply_demand: number;
    insurance_premium: number;
  } | null>(null);

  const handleCalculate = async () => {
    setIsLoading(true);
    try {
      const data = await pricingApi.calculate({
        base_fee: parseFloat(baseFee),
        complexity,
        reputation_score: reputationScore,
      });
      setResult(data);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Price Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Fee Input */}
        <div>
          <label className="text-sm font-medium">Base Fee (USD1)</label>
          <Input
            type="number"
            value={baseFee}
            onChange={(e) => setBaseFee(e.target.value)}
            placeholder="Enter base fee"
            min="0"
            step="0.01"
          />
        </div>

        {/* Complexity Selector */}
        <div>
          <label className="text-sm font-medium">Complexity Level</label>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3].map((level) => (
              <Button
                key={level}
                variant={complexity === level ? 'default' : 'outline'}
                size="sm"
                onClick={() => setComplexity(level)}
                className="flex-1"
              >
                L{level}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            L1: Simple (1.0x) | L2: Medium (1.5x) | L3: Complex (2.5x)
          </p>
        </div>

        {/* Reputation Score Slider */}
        <div>
          <label className="text-sm font-medium">Provider Reputation Score: {reputationScore}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={reputationScore}
            onChange={(e) => setReputationScore(parseInt(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Critical (1.5x)</span>
            <span>Risk (1.2x)</span>
            <span>Normal (1.0x)</span>
            <span>Premium (0.8x)</span>
          </div>
        </div>

        {/* Calculate Button */}
        <Button onClick={handleCalculate} className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            'Calculate Price'
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="mt-4 space-y-3 rounded-lg bg-muted p-4">
            <h4 className="font-medium">Price Breakdown</h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Fee</span>
                <span>{formatUSD1(parseFloat(baseFee))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">× K_Reputation</span>
                <Badge variant="outline">{result.k_reputation}x</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">× K_Complexity</span>
                <Badge variant="outline">{result.k_complexity}x</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">× K_Supply/Demand</span>
                <Badge variant="outline">{result.k_supply_demand}x</Badge>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Final Price</span>
                <span className="text-lg font-bold text-primary">
                  {formatUSD1(result.final_price)}
                </span>
              </div>
              {result.insurance_premium > 0 && (
                <div className="flex justify-between text-yellow-600">
                  <span>+ Insurance Premium</span>
                  <span>{formatUSD1(result.insurance_premium)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
