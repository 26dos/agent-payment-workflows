'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { agentApi } from '@/lib/api';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, Bot } from 'lucide-react';

export default function AgentsPage() {
  const { agents, setAgents, addAgent } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await agentApi.getAll();
        setAgents(data || []);
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAgents();
  }, [setAgents]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;

    setIsCreating(true);
    try {
      const agent = await agentApi.create(newAgentName);
      addAgent(agent);
      setNewAgentName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">Manage your AI agents and their mandates</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Create Agent Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Agent name (e.g., Research_Agent_01)"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
              />
              <Button onClick={handleCreateAgent} disabled={isCreating || !newAgentName.trim()}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              After creating, you can register the agent on-chain and configure its mandate.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agents Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create your first AI agent to start using ClawPay
            </p>
            <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
