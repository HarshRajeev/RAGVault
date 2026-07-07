import { ThumbsDown, ThumbsUp } from 'lucide-react';

import type { ChatMessage } from '@/types/api';
import { cn } from '@/utils/classNames';

interface FeedbackControlsProps {
  message: ChatMessage;
  onRate: (messageId: string, userFeedback: boolean) => void;
}

export function FeedbackControls({ message, onRate }: FeedbackControlsProps) {
  if (message.role !== 'assistant' || message.isPending) {
    return null;
  }

  return (
    <div className="ml-2 flex h-8 shrink-0 items-center gap-1" aria-label="Rate answer">
      <button
        type="button"
        className={cn(
          'grid h-8 w-8 place-items-center rounded border border-transparent text-ink/50 transition hover:border-spruce/20 hover:bg-spruce/10 hover:text-spruce',
          message.user_feedback === true && 'border-spruce/25 bg-spruce/10 text-spruce',
        )}
        onClick={() => onRate(message.id, true)}
        title="Good answer"
        aria-label="Good answer"
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cn(
          'grid h-8 w-8 place-items-center rounded border border-transparent text-ink/50 transition hover:border-coral/20 hover:bg-coral/10 hover:text-coral',
          message.user_feedback === false && 'border-coral/25 bg-coral/10 text-coral',
        )}
        onClick={() => onRate(message.id, false)}
        title="Poor answer"
        aria-label="Poor answer"
      >
        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
