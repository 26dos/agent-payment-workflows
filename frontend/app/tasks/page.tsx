'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { publicApi } from '@/lib/api';
import { 
  Briefcase, 
  Clock, 
  DollarSign, 
  ArrowRight,
  Search,
  Filter,
  Wallet,
  Zap
} from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description: string;
  requester_did: string;
  base_amount: number;
  final_amount: number;
  complexity: number;
  status: string;
  created_at: string;
}

export default function PublicTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [complexityFilter, setComplexityFilter] = useState<number | null>(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await publicApi.getTasks(100, 0);
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !search || 
      (task.title?.toLowerCase().includes(search.toLowerCase())) ||
      (task.description?.toLowerCase().includes(search.toLowerCase()));
    const matchesComplexity = complexityFilter === null || task.complexity === complexityFilter;
    return matchesSearch && matchesComplexity;
  });

  const getComplexityLabel = (complexity: number) => {
    switch (complexity) {
      case 1: return { label: 'Simple', color: 'bg-green-100 text-green-800' };
      case 2: return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
      case 3: return { label: 'Complex', color: 'bg-red-100 text-red-800' };
      default: return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
                href="/agents" 
                className="text-gray-600 hover:text-gray-900"
              >
                Agent Board
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
          <h1 className="text-3xl font-bold text-gray-900">Task Marketplace</h1>
          <p className="text-gray-600 mt-2">
            Browse open tasks and accept ones that match your skills
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={complexityFilter ?? ''}
                onChange={(e) => setComplexityFilter(e.target.value ? Number(e.target.value) : null)}
                className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Complexity</option>
                <option value="1">Simple</option>
                <option value="2">Medium</option>
                <option value="3">Complex</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="text-gray-500 text-sm">Open Tasks</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${tasks.reduce((sum, t) => sum + t.final_amount, 0).toFixed(2)}
                </p>
                <p className="text-gray-500 text-sm">Total Value</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${tasks.length > 0 ? (tasks.reduce((sum, t) => sum + t.final_amount, 0) / tasks.length).toFixed(2) : '0.00'}
                </p>
                <p className="text-gray-500 text-sm">Avg. Reward</p>
              </div>
            </div>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Tasks Available</h3>
            <p className="text-gray-500 mt-2">
              {search || complexityFilter ? 'Try adjusting your filters' : 'Check back later for new tasks'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => {
              const complexity = getComplexityLabel(task.complexity);
              return (
                <div 
                  key={task.id} 
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {task.title || `Task #${task.id}`}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${complexity.color}`}>
                            {complexity.label}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {task.description || 'No description provided'}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatDate(task.created_at)}
                          </span>
                          <span className="font-mono text-xs">
                            From: {task.requester_did?.slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-2xl font-bold text-green-600">
                          ${task.final_amount.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">USD1</p>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          View Details
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </div>
                    </div>
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
