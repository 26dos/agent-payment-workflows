import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatDID(did: string, chars = 6): string {
  if (!did) return 'Not Set';
  return `${did.slice(0, chars + 2)}...${did.slice(-chars)}`;
}

export function formatUSD1(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    created: 'bg-blue-100 text-blue-800',
    accepted: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
    resolved: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function getComplexityLabel(complexity: number): string {
  const labels: Record<number, string> = {
    1: 'L1 - Simple',
    2: 'L2 - Medium',
    3: 'L3 - Complex',
  };
  return labels[complexity] || 'Unknown';
}
