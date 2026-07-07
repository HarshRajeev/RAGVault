'use client';

import { AlertCircle, CheckCircle2, FileUp, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

import { useChat } from '@/context/ChatContext';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export function DocumentManager() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { documents, isUploading, uploadProgress, uploadDocument, deleteDocument } = useChat();
  const [validationError, setValidationError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const uploadStatusText =
    uploadProgress >= 100
      ? 'Processing document'
      : uploadProgress > 0
        ? `Uploading ${uploadProgress}%`
        : 'Preparing upload';
  const progressWidth = `${Math.min(Math.max(uploadProgress || 8, 8), 100)}%`;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setValidationError('');
    setUploadError('');
    setSuccessMessage('');

    if (!file) {
      return;
    }

    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setValidationError('Choose a PDF, DOCX, or TXT file.');
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setValidationError('The file must be 50MB or smaller.');
      return;
    }

    try {
      const result = await uploadDocument(file);
      setSuccessMessage(
        `Uploaded ${result.document_name}: ${result.child_chunks} chunks from ${result.pages_processed} page${result.pages_processed === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload document.');
    }
  };

  return (
    <section className="border-b border-ink/10 p-3">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".pdf,.docx,.txt"
        disabled={isUploading}
        onChange={handleFile}
      />
      <button
        type="button"
        className="flex h-10 w-full items-center justify-center gap-2 rounded bg-spruce px-3 text-sm font-semibold text-white transition hover:bg-spruce/90 disabled:cursor-not-allowed disabled:bg-ink/30"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <Upload className="h-4 w-4 animate-pulse" aria-hidden="true" />
            Uploading {uploadProgress || 0}%
          </>
        ) : (
          <>
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Upload document
          </>
        )}
      </button>

      {validationError && (
        <p className="mt-2 rounded border border-coral/25 bg-coral/10 px-2 py-1.5 text-xs text-coral">
          {validationError}
        </p>
      )}

      {isUploading && (
        <div className="mt-2 rounded border border-spruce/20 bg-white px-2 py-2">
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-spruce">
            <span>{uploadStatusText}</span>
            <span>{uploadProgress >= 100 ? 'Finalizing' : `${uploadProgress || 0}%`}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded bg-field">
            <div
              className="h-full rounded bg-spruce transition-all duration-300"
              style={{ width: progressWidth }}
            />
          </div>
          {uploadProgress >= 100 && (
            <p className="mt-2 text-xs leading-5 text-ink/60">
              Extracting text, creating chunks, and saving embeddings.
            </p>
          )}
        </div>
      )}

      {successMessage && !isUploading && (
        <p className="mt-2 flex items-start gap-2 rounded border border-spruce/20 bg-spruce/10 px-2 py-1.5 text-xs text-spruce">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </p>
      )}

      {uploadError && !isUploading && (
        <p className="mt-2 flex items-start gap-2 rounded border border-coral/25 bg-coral/10 px-2 py-1.5 text-xs text-coral">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{uploadError}</span>
        </p>
      )}

      <div className="mt-3 space-y-1">
        {documents.map((document) => (
          <div
            key={document.document_name}
            className="flex min-h-10 items-center gap-2 rounded border border-ink/10 bg-white px-2 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{document.document_name}</p>
              <p className="text-xs text-ink/50">
                {document.pages} pages, {document.chunks} chunks
              </p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded text-ink/50 transition hover:bg-coral/10 hover:text-coral"
              disabled={isUploading}
              onClick={() => deleteDocument(document.document_name)}
              title="Delete document"
              aria-label={`Delete ${document.document_name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
