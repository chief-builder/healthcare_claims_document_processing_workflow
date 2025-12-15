/**
 * Claim detail view component
 */

import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import {
  useClaim,
  useClaimExtraction,
  useClaimValidation,
  useClaimAdjudication,
} from '../../hooks/useClaims';
import { useClaimSubscription } from '../../hooks/useSocket';
import { StatusBadge, PriorityBadge, ConfidenceIndicator } from '../common/StatusBadge';

export function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  useClaimSubscription(id);

  const { data: claimData, isLoading: claimLoading } = useClaim(id);
  const { data: extractionData } = useClaimExtraction(id);
  const { data: validationData } = useClaimValidation(id);
  const { data: adjudicationData } = useClaimAdjudication(id);

  const claim = claimData?.data;
  const extraction = extractionData?.data;
  const validation = validationData?.data;
  const adjudication = adjudicationData?.data;

  if (claimLoading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading claim...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-600">Claim not found</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          Back to Dashboard
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
            to="/"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{claim.id}</h1>
            <p className="text-sm text-gray-500">
              Created {formatDistanceToNow(new Date(claim.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={claim.status} />
          <PriorityBadge priority={claim.priority} />
        </div>
      </div>

      {/* Main info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Claim Overview */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Claim Overview</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Document ID</dt>
              <dd className="font-medium">{claim.documentId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd><StatusBadge status={claim.status} size="sm" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Priority</dt>
              <dd><PriorityBadge priority={claim.priority} size="sm" /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd>{format(new Date(claim.createdAt), 'PPp')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Updated</dt>
              <dd>{format(new Date(claim.updatedAt), 'PPp')}</dd>
            </div>
          </dl>
        </div>

        {/* Processing History */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Processing History</h2>
          {claim.processingHistory && claim.processingHistory.length > 0 ? (
            <div className="space-y-3">
              {claim.processingHistory.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 text-sm"
                >
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : step.status === 'failed' ? (
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium capitalize">{step.stage}</p>
                    {step.startedAt && (
                      <p className="text-gray-500 text-xs">
                        {format(new Date(step.startedAt), 'PPp')}
                      </p>
                    )}
                    {step.error && (
                      <p className="text-red-600 text-xs mt-1">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No processing history available</p>
          )}
        </div>
      </div>

      {/* Extraction Results */}
      {extraction && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extracted Data</h2>
            <ConfidenceIndicator score={extraction.confidenceScores.overall} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Patient Info */}
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd>{extraction.patient.firstName} {extraction.patient.lastName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">DOB</dt>
                  <dd>{extraction.patient.dateOfBirth}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Member ID</dt>
                  <dd>{extraction.patient.memberId}</dd>
                </div>
              </dl>
            </div>

            {/* Provider Info */}
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Provider Information</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd>{extraction.provider.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">NPI</dt>
                  <dd>{extraction.provider.npi}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Service Lines */}
          {extraction.serviceLines && extraction.serviceLines.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-2">Service Lines</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.serviceLines.map((line) => (
                      <tr key={line.lineNumber} className="border-t">
                        <td className="px-3 py-2">{line.lineNumber}</td>
                        <td className="px-3 py-2">{line.dateOfService}</td>
                        <td className="px-3 py-2 font-mono">{line.procedureCode}</td>
                        <td className="px-3 py-2">{line.description}</td>
                        <td className="px-3 py-2 text-right">
                          ${line.chargeAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                      <td className="px-3 py-2 text-right">
                        ${extraction.totals.totalCharges.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {validation && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Validation Results</h2>
          <div className="flex items-center gap-4 mb-4">
            {validation.isValid ? (
              <span className="badge-success">Valid</span>
            ) : (
              <span className="badge-danger">Invalid</span>
            )}
            <span className="text-sm text-gray-500">
              {validation.errors.length} errors, {validation.warnings.length} warnings
            </span>
          </div>

          {validation.errors.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-red-600 mb-2">Errors</h3>
              <ul className="space-y-2">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-sm bg-red-50 p-2 rounded">
                    <span className="font-medium">{error.field}:</span> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div>
              <h3 className="font-medium text-yellow-600 mb-2">Warnings</h3>
              <ul className="space-y-2">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="text-sm bg-yellow-50 p-2 rounded">
                    <span className="font-medium">{warning.field}:</span> {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Adjudication Results */}
      {adjudication && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Adjudication Decision</h2>
          <div className="flex items-center gap-4 mb-4">
            <span
              className={`badge ${
                adjudication.decision === 'approved'
                  ? 'badge-success'
                  : adjudication.decision === 'denied'
                  ? 'badge-danger'
                  : 'badge-warning'
              }`}
            >
              {adjudication.decision.charAt(0).toUpperCase() + adjudication.decision.slice(1)}
            </span>
          </div>

          <dl className="space-y-3 mb-4">
            <div className="flex justify-between">
              <dt className="text-gray-500">Approved Amount</dt>
              <dd className="font-medium text-green-600">
                ${adjudication.approvedAmount.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Denied Amount</dt>
              <dd className="font-medium text-red-600">
                ${adjudication.deniedAmount.toFixed(2)}
              </dd>
            </div>
          </dl>

          {adjudication.reasoning && (
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-medium mb-2">Reasoning</h3>
              <p className="text-sm text-gray-700">{adjudication.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
