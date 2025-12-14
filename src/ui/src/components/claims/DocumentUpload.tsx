/**
 * Document upload component with drag and drop
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useUploadDocument } from '../../hooks/useClaims';
import type { Priority } from '../../types';

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/tiff',
  'application/pdf',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useUploadDocument();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload PNG, JPEG, TIFF, or PDF files.';
    }
    if (file.size > MAX_SIZE) {
      return 'File too large. Maximum size is 10MB.';
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setFile(null);
    } else {
      setError(null);
      setFile(file);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) return;

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        priority,
      });

      if (result.data?.claimId) {
        navigate(`/claims/${result.data.claimId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h1>

        {/* Upload area */}
        <div
          className={clsx(
            'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400',
            file ? 'bg-gray-50' : ''
          )}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-center gap-4">
              <File className="h-12 w-12 text-primary-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 rounded-full hover:bg-gray-200"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your document here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary"
              >
                Select File
              </button>
              <p className="mt-4 text-xs text-gray-400">
                Supported formats: PNG, JPEG, TIFF, PDF (max 10MB)
              </p>
            </>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success from mutation */}
        {uploadMutation.isSuccess && (
          <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">Document uploaded successfully!</span>
          </div>
        )}

        {/* Options */}
        {file && !uploadMutation.isSuccess && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Processing Priority
              </label>
              <div className="flex gap-3">
                {(['normal', 'high', 'urgent'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={clsx(
                      'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                      priority === p
                        ? p === 'urgent'
                          ? 'bg-red-100 border-red-300 text-red-700'
                          : p === 'high'
                          ? 'bg-orange-100 border-orange-300 text-orange-700'
                          : 'bg-primary-100 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={uploadMutation.isPending}
                className="btn-primary"
              >
                {uploadMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Upload & Process'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
