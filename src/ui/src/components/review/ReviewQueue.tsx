/**
 * Review queue component
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useReviewQueue, useReviewStats } from '../../hooks/useClaims';
import { PriorityBadge, ConfidenceIndicator } from '../common/StatusBadge';

export function ReviewQueue() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useReviewQueue({
    page,
    limit: 10,
    sortOrder: 'desc',
  });
  const { data: statsData } = useReviewStats();

  const items = data?.data || [];
  const pagination = data?.pagination;
  const stats = statsData?.data;

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600">Error loading review queue: {error.message}</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Claims pending human review
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-primary-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pendingReviewCount}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Urgent</p>
                <p className="text-2xl font-bold">{stats.byPriority?.urgent || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Avg Wait Time</p>
                <p className="text-2xl font-bold">
                  {Math.round((stats.averageWaitTimeMs || 0) / 60000)}m
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm text-gray-500">Avg Confidence</p>
                <p className="text-2xl font-bold">
                  {Math.round((stats.averageConfidence || 0) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading review queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto" />
            <p className="mt-4 text-gray-500">No claims pending review</p>
            <p className="text-sm text-gray-400 mt-2">
              All caught up! Check back later.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Claim ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waiting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issues
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.claimId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{item.claimId}</span>
                    {item.documentType && (
                      <p className="text-xs text-gray-500">{item.documentType}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.patientName || '-'}
                    {item.totalCharges && (
                      <p className="text-xs">${item.totalCharges.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PriorityBadge priority={item.priority} size="sm" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(item.createdAt))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {item.validationErrors > 0 && (
                        <span className="badge-danger">
                          {item.validationErrors} errors
                        </span>
                      )}
                      {item.validationWarnings > 0 && (
                        <span className="badge-warning">
                          {item.validationWarnings} warnings
                        </span>
                      )}
                      {item.validationErrors === 0 && item.validationWarnings === 0 && (
                        <span className="text-gray-400 text-sm">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.confidenceScore !== undefined ? (
                      <ConfidenceIndicator score={item.confidenceScore} showLabel={false} />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/review/${item.claimId}`}
                      className="btn-primary text-sm py-1 px-3"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <p className="text-sm text-gray-700">
              Page {page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
