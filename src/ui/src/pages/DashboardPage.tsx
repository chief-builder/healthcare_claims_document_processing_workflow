/**
 * Dashboard page - claims overview
 */

import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  Activity,
} from 'lucide-react';
import { useClaims, useReviewStats, useHealth } from '../hooks/useClaims';
import { ClaimsList } from '../components/claims';
import { useSocketStore } from '../hooks/useSocket';

export function DashboardPage() {
  const { data: claimsData } = useClaims({ limit: 5 });
  const { data: reviewStats } = useReviewStats();
  const { data: healthData } = useHealth();
  const events = useSocketStore((state) => state.events);

  const stats = reviewStats?.data;
  const recentEvents = events.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Healthcare Claims IDP System Overview
          </p>
        </div>
        <Link to="/upload" className="btn-primary">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Claims</p>
              <p className="text-2xl font-bold text-gray-900">
                {claimsData?.pagination?.total || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingReviewCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">System Health</p>
              <p className="text-2xl font-bold text-gray-900 capitalize">
                {(healthData as unknown as { status?: string })?.status || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Urgent Queue</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.byPriority?.urgent || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Claims list */}
        <div className="lg:col-span-2">
          <ClaimsList />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to="/upload"
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-5 w-5 text-primary-500 mr-3" />
                <span>Upload New Document</span>
              </Link>
              <Link
                to="/review"
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Clock className="h-5 w-5 text-yellow-500 mr-3" />
                <span>Review Queue ({stats?.pendingReviewCount || 0})</span>
              </Link>
              <Link
                to="/health"
                className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Activity className="h-5 w-5 text-green-500 mr-3" />
                <span>System Health</span>
              </Link>
            </div>
          </div>

          {/* Recent events */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event, index) => (
                  <div key={index} className="text-sm border-l-2 border-gray-200 pl-3">
                    <p className="font-medium text-gray-900">
                      {event.type === 'status_change'
                        ? `Status: ${event.data.previousStatus} → ${event.data.newStatus}`
                        : event.type === 'error'
                        ? `Error: ${event.data.error}`
                        : event.data.message}
                    </p>
                    <p className="text-gray-500">
                      Claim: {event.claimId}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
