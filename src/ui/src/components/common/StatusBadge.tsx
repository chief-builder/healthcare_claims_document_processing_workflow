/**
 * Status and Priority badge components
 */

import { clsx } from 'clsx';
import type { ClaimStatus, Priority } from '../../types';

// Status colors and labels
const statusConfig: Record<ClaimStatus, { color: string; label: string }> = {
  received: { color: 'bg-gray-100 text-gray-700', label: 'Received' },
  parsing: { color: 'bg-blue-100 text-blue-700', label: 'Parsing' },
  extracting: { color: 'bg-blue-100 text-blue-700', label: 'Extracting' },
  validating: { color: 'bg-yellow-100 text-yellow-700', label: 'Validating' },
  correcting: { color: 'bg-orange-100 text-orange-700', label: 'Correcting' },
  pending_review: { color: 'bg-purple-100 text-purple-700', label: 'Pending Review' },
  adjudicating: { color: 'bg-indigo-100 text-indigo-700', label: 'Adjudicating' },
  completed: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-700', label: 'Failed' },
};

interface StatusBadgeProps {
  status: ClaimStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: status };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      {config.label}
    </span>
  );
}

// Priority colors
const priorityConfig: Record<Priority, { color: string; label: string }> = {
  normal: { color: 'bg-gray-100 text-gray-600', label: 'Normal' },
  high: { color: 'bg-orange-100 text-orange-600', label: 'High' },
  urgent: { color: 'bg-red-100 text-red-600', label: 'Urgent' },
};

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || { color: 'bg-gray-100 text-gray-600', label: priority };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      {config.label}
    </span>
  );
}

// Confidence indicator
interface ConfidenceIndicatorProps {
  score: number;
  showLabel?: boolean;
}

export function ConfidenceIndicator({ score, showLabel = true }: ConfidenceIndicatorProps) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 90
      ? 'text-green-600 bg-green-100'
      : percentage >= 70
      ? 'text-yellow-600 bg-yellow-100'
      : 'text-red-600 bg-red-100';

  return (
    <div className="flex items-center">
      <span className={clsx('px-2 py-0.5 rounded text-sm font-medium', color)}>
        {percentage}%
      </span>
      {showLabel && (
        <span className="ml-2 text-sm text-gray-500">confidence</span>
      )}
    </div>
  );
}
