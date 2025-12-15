/**
 * System health page
 */

import { useDetailedHealth } from '../hooks/useClaims';
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

export function HealthPage() {
  const { data, isLoading, error, refetch, isFetching } = useDetailedHealth();

  const health = data as unknown as {
    status: string;
    timestamp: string;
    uptime: number;
    memory: { used: number; total: number; percentage: number };
    components: Record<string, { status: string; [key: string]: unknown }>;
  } | undefined;

  if (isLoading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading health status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
        <p className="mt-4 text-red-600">Error loading health status</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        <button onClick={() => refetch()} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor system status and performance
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

      {/* Overall status */}
      <div
        className={clsx(
          'card flex items-center gap-4',
          isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        )}
      >
        {isHealthy ? (
          <CheckCircle className="h-12 w-12 text-green-500" />
        ) : (
          <AlertCircle className="h-12 w-12 text-red-500" />
        )}
        <div>
          <h2 className={clsx('text-xl font-bold', isHealthy ? 'text-green-700' : 'text-red-700')}>
            System {health?.status || 'Unknown'}
          </h2>
          <p className="text-sm text-gray-600">
            Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : 'Unknown'}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <Server className="h-8 w-8 text-primary-500" />
            <div>
              <p className="text-sm text-gray-500">Uptime</p>
              <p className="text-xl font-bold">
                {health?.uptime ? formatUptime(health.uptime) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Cpu className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Memory Used</p>
              <p className="text-xl font-bold">
                {health?.memory?.used || 0} MB
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Memory Total</p>
              <p className="text-xl font-bold">
                {health?.memory?.total || 0} MB
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-500">Memory %</p>
              <p className="text-xl font-bold">
                {health?.memory?.percentage?.toFixed(1) || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Component status */}
      {health?.components && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Component Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(health.components).map(([name, component]) => (
              <div
                key={name}
                className={clsx(
                  'p-4 rounded-lg border',
                  component.status === 'healthy'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <Database
                    className={clsx(
                      'h-6 w-6',
                      component.status === 'healthy' ? 'text-green-500' : 'text-yellow-500'
                    )}
                  />
                  <div>
                    <p className="font-medium capitalize">
                      {name.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-sm text-gray-600 capitalize">{component.status}</p>
                  </div>
                </div>
                {/* Show additional component details */}
                <div className="mt-2 text-xs text-gray-500">
                  {Object.entries(component)
                    .filter(([key]) => key !== 'status')
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">API Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">API Base URL</dt>
            <dd className="font-mono text-sm">/api</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">WebSocket</dt>
            <dd className="font-mono text-sm">/socket.io</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Health Endpoint</dt>
            <dd className="font-mono text-sm">/api/health</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Detailed Health</dt>
            <dd className="font-mono text-sm">/api/health/detailed</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
