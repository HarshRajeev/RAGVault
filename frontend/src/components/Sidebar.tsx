'use client';

import { Check, LogOut, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import type { ChatSession } from '@/types/api';
import { cn } from '@/utils/classNames';
import { DocumentManager } from './DocumentManager';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
    isBootstrapping,
    isAsking,
  } = useChat();
  const [editingSessionId, setEditingSessionId] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState('');

  const handleSelect = async (sessionId: string) => {
    await selectSession(sessionId);
    onClose();
  };

  const startRename = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setDraftTitle(session.title);
  };

  const cancelRename = () => {
    setEditingSessionId('');
    setDraftTitle('');
    setRenamingSessionId('');
  };

  const saveRename = async (session: ChatSession) => {
    if (editingSessionId !== session.id || renamingSessionId) {
      return;
    }

    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === session.title) {
      cancelRename();
      return;
    }

    setRenamingSessionId(session.id);
    try {
      await renameSession(session.id, nextTitle);
      cancelRename();
    } catch {
      setRenamingSessionId('');
    }
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, session: ChatSession) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveRename(session);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-[min(88vw,320px)] flex-col border-r border-ink/10 bg-field text-ink transition-transform duration-200 md:static md:z-auto md:w-80 md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink/10 px-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold uppercase tracking-[0.18em] text-moss">
            RAG Vault
          </h1>
          <p className="truncate text-xs text-ink/60">{user?.email}</p>
        </div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded text-ink/60 transition hover:bg-ink/10 hover:text-ink md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <DocumentManager />

      <div className="flex h-12 items-center justify-between border-b border-ink/10 px-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Chats</span>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded bg-white text-spruce shadow-toolbar transition hover:bg-spruce/10 disabled:cursor-not-allowed disabled:text-ink/30"
          disabled={isBootstrapping || isAsking}
          onClick={createSession}
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {sessions.map((session) => (
          <div key={session.id} className="group flex items-center gap-1">
            {editingSessionId === session.id ? (
              <div
                className={cn(
                  'mb-1 flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded border px-2 py-1.5 text-sm transition',
                  activeSessionId === session.id
                    ? 'border-spruce/20 bg-white text-spruce shadow-toolbar'
                    : 'border-ink/10 bg-white/80 text-ink',
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  value={draftTitle}
                  maxLength={120}
                  disabled={renamingSessionId === session.id}
                  autoFocus
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => handleRenameKeyDown(event, session)}
                  onBlur={() => void saveRename(session)}
                  aria-label={`Rename ${session.title}`}
                />
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  'mb-1 flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded px-2 py-2 text-left text-sm transition',
                  activeSessionId === session.id
                    ? 'bg-white text-spruce shadow-toolbar'
                    : 'text-ink/70 hover:bg-white/70 hover:text-ink',
                )}
                disabled={isBootstrapping || isAsking}
                onClick={() => handleSelect(session.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{session.title}</span>
              </button>
            )}
            {editingSessionId === session.id ? (
              <>
                <button
                  type="button"
                  className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded text-spruce transition hover:bg-spruce/10 disabled:cursor-not-allowed disabled:text-ink/30"
                  disabled={renamingSessionId === session.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void saveRename(session)}
                  aria-label={`Save ${session.title}`}
                  title="Save name"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded text-ink/40 transition hover:bg-ink/10 hover:text-ink"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelRename}
                  aria-label={`Cancel renaming ${session.title}`}
                  title="Cancel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded text-ink/40 opacity-100 transition hover:bg-spruce/10 hover:text-spruce md:opacity-0 md:group-hover:opacity-100"
                disabled={isBootstrapping || isAsking}
                onClick={() => startRename(session)}
                aria-label={`Rename ${session.title}`}
                title="Rename chat"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded text-ink/40 opacity-100 transition hover:bg-coral/10 hover:text-coral md:opacity-0 md:group-hover:opacity-100"
              disabled={isBootstrapping || isAsking || editingSessionId === session.id}
              onClick={() => deleteSession(session.id)}
              aria-label={`Delete ${session.title}`}
              title="Delete chat"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink/10 p-3">
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-2 rounded border border-ink/20 bg-white px-3 text-sm font-medium text-ink transition hover:border-coral/30 hover:text-coral"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
