/**
 * Review detail component with approve/reject/correct actions
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Edit,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useReviewDetails, useSubmitReview } from '../../hooks/useClaims';
import { useClaimSubscription } from '../../hooks/useSocket';
import { PriorityBadge, ConfidenceIndicator } from '../common/StatusBadge';

/**
 * Calculate overall confidence score from a record of field-level scores
 */
function calculateOverallConfidence(scores: Record<string, number> | undefined): number {
  if (!scores || typeof scores !== 'object') return 0;
  const values = Object.values(scores).filter((v) => typeof v === 'number');
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Get category-specific confidence (patient, provider, services)
 */
function getCategoryConfidence(scores: Record<string, number> | undefined, prefix: string): number {
  if (!scores || typeof scores !== 'object') return 0;
  const entries = Object.entries(scores).filter(([key]) => key.startsWith(prefix));
  if (entries.length === 0) return calculateOverallConfidence(scores); // Fallback to overall
  return entries.reduce((sum, [, v]) => sum + v, 0) / entries.length;
}

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useClaimSubscription(id);

  const { data, isLoading, error } = useReviewDetails(id);
  const submitReview = useSubmitReview();

  const [action, setAction] = useState<'approve' | 'reject' | 'correct' | null>(null);
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const claim = data?.data?.claim;
  const extraction = data?.data?.extraction;
  const validation = data?.data?.validation;

  const handleSubmit = async () => {
    if (!id || !action) return;

    try {
      await submitReview.mutateAsync({
        id,
        params: {
          action,
          reason: reason || undefined,
        },
      });
      navigate('/review');
    } catch (err) {
      console.error('Review submission failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading review details...</p>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600">
          {error?.message || 'Claim not found or not pending review'}
        </p>
        <Link to="/review" className="btn-primary mt-4 inline-flex">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/review"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review: {claim.id}</h1>
            <p className="text-sm text-gray-500">
              Created {format(new Date(claim.createdAt), 'PPp')}
            </p>
          </div>
        </div>
        <PriorityBadge priority={claim.priority} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Extracted data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Extraction summary */}
          {extraction && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Extracted Data</h2>
                <ConfidenceIndicator score={calculateOverallConfidence(extraction.confidenceScores)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patient */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Patient</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Name</dt>
                      <dd className="font-medium">
                        {extraction.patient.firstName} {extraction.patient.lastName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">DOB</dt>
                      <dd>{extraction.patient.dateOfBirth}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Member ID</dt>
                      <dd className="font-mono">{extraction.patient.memberId}</dd>
                    </div>
                  </dl>
                </div>

                {/* Provider */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Provider</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Name</dt>
                      <dd className="font-medium">{extraction.provider.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">NPI</dt>
                      <dd className="font-mono">{extraction.provider.npi}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Service lines */}
              {extraction.serviceLines && extraction.serviceLines.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-3">Service Lines</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">CPT</th>
                          <th className="px-3 py-2 text-left">Units</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraction.serviceLines.map((line) => (
                          <tr key={line.lineNumber} className="border-t">
                            <td className="px-3 py-2">{line.lineNumber}</td>
                            <td className="px-3 py-2">{line.dateOfService}</td>
                            <td className="px-3 py-2 font-mono">{line.procedureCode}</td>
                            <td className="px-3 py-2">{line.units}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${(line.chargeAmount ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-gray-50 font-medium">
                          <td colSpan={4} className="px-3 py-2 text-right">
                            Total Charges
                          </td>
                          <td className="px-3 py-2 text-right">
                            ${(extraction.totals?.totalCharges ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation issues */}
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Validation Issues</h2>

              {validation.errors.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <h3 className="font-medium text-red-700">
                      Errors ({validation.errors.length})
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {validation.errors.map((error, index) => (
                      <li
                        key={index}
                        className="bg-red-50 border border-red-200 rounded p-3"
                      >
                        <p className="font-medium text-red-800">{error.field}</p>
                        <p className="text-sm text-red-700">{error.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-medium text-yellow-700">
                      Warnings ({validation.warnings.length})
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {validation.warnings.map((warning, index) => (
                      <li
                        key={index}
                        className="bg-yellow-50 border border-yellow-200 rounded p-3"
                      >
                        <p className="font-medium text-yellow-800">{warning.field}</p>
                        <p className="text-sm text-yellow-700">{warning.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column - Actions */}
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Review Actions</h2>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setAction('approve');
                  setShowConfirm(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
              >
                <CheckCircle className="h-5 w-5" />
                Approve Claim
              </button>

              <button
                onClick={() => {
                  setAction('reject');
                  setShowConfirm(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors"
              >
                <XCircle className="h-5 w-5" />
                Reject Claim
              </button>

              <button
                onClick={() => {
                  setAction('correct');
                  setShowConfirm(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
              >
                <Edit className="h-5 w-5" />
                Request Correction
              </button>
            </div>
          </div>

          {/* Confirmation dialog */}
          {showConfirm && (
            <div className="card border-2 border-primary-200">
              <h3 className="font-semibold mb-3">
                Confirm{' '}
                {action === 'approve'
                  ? 'Approval'
                  : action === 'reject'
                  ? 'Rejection'
                  : 'Correction Request'}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Add a note about your decision..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setAction(null);
                    setReason('');
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitReview.isPending}
                  className={`flex-1 ${
                    action === 'approve'
                      ? 'btn-success'
                      : action === 'reject'
                      ? 'btn-danger'
                      : 'btn-primary'
                  }`}
                >
                  {submitReview.isPending ? 'Submitting...' : 'Confirm'}
                </button>
              </div>

              {submitReview.isError && (
                <p className="mt-3 text-sm text-red-600">
                  Error: {submitReview.error?.message}
                </p>
              )}
            </div>
          )}

          {/* Quick stats */}
          {extraction && (
            <div className="card">
              <h3 className="font-semibold mb-3">Confidence Scores</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Overall</span>
                  <ConfidenceIndicator
                    score={calculateOverallConfidence(extraction.confidenceScores)}
                    showLabel={false}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Patient</span>
                  <ConfidenceIndicator
                    score={getCategoryConfidence(extraction.confidenceScores, 'patient')}
                    showLabel={false}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Provider</span>
                  <ConfidenceIndicator
                    score={getCategoryConfidence(extraction.confidenceScores, 'provider')}
                    showLabel={false}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Services</span>
                  <ConfidenceIndicator
                    score={getCategoryConfidence(extraction.confidenceScores, 'serviceLines')}
                    showLabel={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
