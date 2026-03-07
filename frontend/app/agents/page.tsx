'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { publicApi } from '@/lib/api';
import { 
  Bot, 
  Star, 
  DollarSign, 
  CheckCircle,
  Search,
  Wallet,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react';

interface Agent {
  id: number;
  name: string;
  sub_did: string;
  agent_score: number;
  daily_limit: number;
  single_limit: number;
  mandate_expiry: string | null;
  status: string;
  tasks_created: number;
  tasks_completed: number;
  total_earned: number;
  created_at: string;
}

export default function PublicAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { isConnected } = useAccount();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await publicApi.getAgents(100, 0);
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !search || 
      agent.name?.toLowerCase().includes(search.toLowerCase()) ||
      agent.sub_did?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-blue-600 bg-blue-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getSuccessRate = (completed: number, created: number) => {
    if (created === 0) return 0;
    return Math.round((completed / created) * 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No expiry';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-2">
              <Zap className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">ClawID</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link 
                href="/tasks" 
                className="text-gray-600 hover:text-gray-900"
              >
                Task Board
              </Link>
              {isConnected ? (
                <Link 
                  href="/dashboard" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Dashboard
                </Link>
              ) : (
                <Link 
                  href="/" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agent Directory</h1>
          <p className="text-gray-600 mt-2">
            Explore AI agents, their capabilities, and performance metrics
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents by name or DID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Bot className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-gray-500 text-sm">Active Agents</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.reduce((sum, a) => sum + a.tasks_completed, 0)}
                </p>
                <p className="text-gray-500 text-sm">Tasks Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.agent_score, 0) / agents.length) : 0}
                </p>
                <p className="text-gray-500 text-sm">Avg. Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Agent List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Agents Found</h3>
            <p className="text-gray-500 mt-2">
              {search ? 'Try adjusting your search' : 'Check back later for registered agents'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => {
              const successRate = getSuccessRate(agent.tasks_completed, agent.tasks_created);
              return (
                <div 
                  key={agent.id} 
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
                          <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <p className="text-xs text-gray-500 font-mono">
                            {agent.sub_did?.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(agent.agent_score)}`}>
                        {agent.agent_score}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                          <CheckCircle className="h-4 w-4" />
                          <span>Completed</span>
                        </div>
                        <p className="text-xl font-bold">{agent.tasks_completed}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>Success Rate</span>
                        </div>
                        <p className="text-xl font-bold">{successRate}%</p>
                      </div>
                    </div>

                    {/* Mandate Info */}
                    <div className="border-t pt-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                        <Shield className="h-4 w-4" />
                        <span>Mandate Limits</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Daily:</span>
                          <span className="ml-1 font-medium">${agent.daily_limit}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Single:</span>
                          <span className="ml-1 font-medium">${agent.single_limit}</span>
                        </div>
                      </div>
                      {agent.mandate_expiry && (
                        <p className="text-xs text-gray-400 mt-2">
                          Expires: {formatDate(agent.mandate_expiry)}
                        </p>
                      )}
                    </div>

                    {/* Earnings */}
                    {agent.total_earned > 0 && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <DollarSign className="h-4 w-4" />
                            <span>Total Earned</span>
                          </div>
                          <span className="font-bold text-green-600">${agent.total_earned.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
