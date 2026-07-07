'use client';

import { Loader2, Menu, Send } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { useChat } from '@/context/ChatContext';
import type { ChatMessage } from '@/types/api';
import { cn } from '@/utils/classNames';
import { CitationPills } from './CitationPills';
import { FeedbackControls } from './FeedbackControls';

export function ChatWindow({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const {
    activeSession,
    messages,
    isAsking,
    isBootstrapping,
    error,
    setError,
    askQuestion,
    rateMessage,
  } = useChat();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isAsking]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || isAsking) {
      return;
    }

    setDraft('');
    try {
      await askQuestion(question);
    } catch {
      setDraft(question);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#fbfcf8] text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink/10 bg-white px-3 shadow-toolbar md:px-5">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded text-ink/60 transition hover:bg-ink/10 hover:text-ink md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{activeSession?.title || 'New chat'}</h2>
          <p className="truncate text-xs text-ink/60">
            {messages.length ? `${messages.length} messages` : 'Ready'}
          </p>
        </div>
      </header>

      {error && (
        <div className="border-b border-coral/20 bg-coral/10 px-4 py-2 text-sm text-coral">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              className="h-7 rounded px-2 text-xs font-semibold hover:bg-coral/10"
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <section className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {isBootstrapping ? (
            <div className="flex min-h-[45vh] items-center justify-center text-sm text-ink/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-spruce" aria-hidden="true" />
              Loading
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[45vh] items-center justify-center">
              <div className="max-w-md text-center">
                <h3 className="text-xl font-semibold text-ink">Ask from your documents</h3>
                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Upload source files in the sidebar, then ask a focused question here.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} onRate={rateMessage} />
            ))
          )}
          {isAsking && (
            <div className="flex items-center gap-2 self-start rounded border border-ink/10 bg-white px-3 py-2 text-sm text-ink/60 shadow-toolbar">
              <Loader2 className="h-4 w-4 animate-spin text-spruce" aria-hidden="true" />
              Retrieving
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </section>

      <form className="shrink-0 border-t border-ink/10 bg-white px-3 py-3 md:px-6" onSubmit={handleSubmit}>
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <textarea
            className="max-h-40 min-h-11 flex-1 resize-none rounded border border-ink/20 bg-field px-3 py-3 text-sm leading-5 outline-none transition focus:border-spruce disabled:cursor-not-allowed disabled:text-ink/40"
            rows={1}
            value={draft}
            disabled={isAsking || isBootstrapping}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            disabled={!draft.trim() || isAsking || isBootstrapping}
            className="grid h-11 w-11 shrink-0 place-items-center rounded bg-spruce text-white transition hover:bg-spruce/90 disabled:cursor-not-allowed disabled:bg-ink/30"
            aria-label="Send"
            title="Send"
          >
            {isAsking ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </main>
  );
}

function MessageBubble({
  message,
  onRate,
}: {
  message: ChatMessage;
  onRate: (messageId: string, userFeedback: boolean) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <article className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[min(780px,92%)] items-start', isUser ? 'justify-end' : 'justify-start')}>
        <div
          className={cn(
            'rounded px-4 py-3 text-sm leading-6 shadow-toolbar',
            isUser ? 'bg-spruce text-white' : 'border border-ink/10 bg-white text-ink',
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {!isUser && <CitationPills citations={message.citations} />}
        </div>
        {!isUser && <FeedbackControls message={message} onRate={onRate} />}
      </div>
    </article>
  );
}
