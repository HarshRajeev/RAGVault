import { FileText } from 'lucide-react';

import type { Citation } from '@/types/api';

export function CitationPills({ citations = [] }: { citations?: Citation[] }) {
  if (!citations.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {citations.map((citation, index) => (
        <span
          key={`${citation.chunk_id ?? citation.document_name}-${citation.source ?? index}`}
          className="inline-flex max-w-full items-center gap-1 rounded border border-spruce/20 bg-spruce/10 px-2 py-1 text-xs font-medium text-spruce"
          title={citation.document_name}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {citation.document_name}, page {citation.page_number}
          </span>
        </span>
      ))}
    </div>
  );
}
