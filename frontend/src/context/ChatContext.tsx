'use client';

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '@/hooks/apiClient';
import type {
  AskResponse,
  ChatMessage,
  ChatSession,
  DocumentIngestResponse,
  DocumentSummary,
} from '@/types/api';
import { useAuth } from './AuthContext';

interface ChatContextValue {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  activeSessionId: string;
  messages: ChatMessage[];
  documents: DocumentSummary[];
  isBootstrapping: boolean;
  isAsking: boolean;
  isUploading: boolean;
  uploadProgress: number;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  selectSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<ChatSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  uploadDocument: (file: File) => Promise<DocumentIngestResponse>;
  deleteDocument: (documentName: string) => Promise<void>;
  askQuestion: (question: string) => Promise<AskResponse | null>;
  rateMessage: (messageId: string, userFeedback: boolean) => Promise<void>;
  refreshDocuments: () => Promise<DocumentSummary[]>;
  refreshSessions: () => Promise<ChatSession[]>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  const resetWorkspace = useCallback(() => {
    setSessions([]);
    setActiveSessionId('');
    setMessages([]);
    setDocuments([]);
    setError('');
  }, []);

  const refreshDocuments = useCallback(async (): Promise<DocumentSummary[]> => {
    if (!isAuthenticated) {
      setDocuments([]);
      return [];
    }

    const nextDocuments = await api.listDocuments();
    setDocuments(nextDocuments);
    return nextDocuments;
  }, [isAuthenticated]);

  const refreshSessions = useCallback(async (): Promise<ChatSession[]> => {
    if (!isAuthenticated) {
      setSessions([]);
      setActiveSessionId('');
      return [];
    }

    const nextSessions = await api.listChats();
    setSessions(nextSessions);
    return nextSessions;
  }, [isAuthenticated]);

  const loadMessages = useCallback(
    async (sessionId: string): Promise<ChatMessage[]> => {
      if (!isAuthenticated || !sessionId) {
        setMessages([]);
        return [];
      }

      const nextMessages = await api.listMessages(sessionId);
      setMessages(nextMessages);
      return nextMessages;
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      resetWorkspace();
      return;
    }

    let isMounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      setError('');
      try {
        const [nextSessions, nextDocuments] = await Promise.all([
          api.listChats(),
          api.listDocuments(),
        ]);
        if (!isMounted) {
          return;
        }

        setSessions(nextSessions);
        setDocuments(nextDocuments);

        const nextActiveId = nextSessions[0]?.id ?? '';
        setActiveSessionId(nextActiveId);
        if (nextActiveId) {
          const nextMessages = await api.listMessages(nextActiveId);
          if (isMounted) {
            setMessages(nextMessages);
          }
        } else {
          setMessages([]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Could not load workspace.');
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, resetWorkspace]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);
      setError('');
      try {
        await loadMessages(sessionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load messages.');
      }
    },
    [loadMessages],
  );

  const createSession = useCallback(async (): Promise<ChatSession> => {
    setError('');
    try {
      const created = await api.createChat('New chat');
      setSessions((current) => [created, ...current]);
      setActiveSessionId(created.id);
      setMessages([]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create chat.');
      throw err;
    }
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setError('');
      try {
        await api.deleteChat(sessionId);
        const nextSessions = sessions.filter((session) => session.id !== sessionId);
        setSessions(nextSessions);
        const nextActiveId =
          sessionId === activeSessionId ? nextSessions[0]?.id ?? '' : activeSessionId;
        setActiveSessionId(nextActiveId);
        await loadMessages(nextActiveId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete chat.');
      }
    },
    [activeSessionId, loadMessages, sessions],
  );

  const uploadDocument = useCallback(
    async (file: File): Promise<DocumentIngestResponse> => {
      setIsUploading(true);
      setUploadProgress(0);
      setError('');
      try {
        const result = await api.uploadDocument(file, (event) => {
          if (event.total) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        await refreshDocuments();
      setUploadProgress(100);
      return result;
    } catch (err) {
      throw err;
    } finally {
      setIsUploading(false);
    }
    },
    [refreshDocuments],
  );

  const deleteDocument = useCallback(
    async (documentName: string) => {
      setError('');
      try {
        await api.deleteDocument(documentName);
        await refreshDocuments();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete document.');
      }
    },
    [refreshDocuments],
  );

  const askQuestion = useCallback(
    async (question: string): Promise<AskResponse | null> => {
      const trimmed = question.trim();
      if (!trimmed || isAsking) {
        return null;
      }

      let sessionId = activeSessionId;
      setIsAsking(true);
      setError('');

      const optimisticUserMessage: ChatMessage = {
        id: `pending-user-${Date.now()}`,
        session_id: sessionId || 'pending',
        role: 'user',
        content: trimmed,
        citations: [],
        user_feedback: null,
        created_at: new Date().toISOString(),
        isPending: true,
      };
      setMessages((current) => [...current, optimisticUserMessage]);

      try {
        if (!sessionId) {
          const created = await createSession();
          sessionId = created.id;
        }

        const response = await api.askQuestion(sessionId, trimmed);
        setActiveSessionId(sessionId);
        setMessages((current) => [
          ...current.filter((message) => message.id !== optimisticUserMessage.id),
          response.user_message,
          response.assistant_message,
        ]);
        await refreshSessions();
        return response;
      } catch (err) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticUserMessage.id),
        );
        setError(err instanceof Error ? err.message : 'Could not send message.');
        throw err;
      } finally {
        setIsAsking(false);
      }
    },
    [activeSessionId, createSession, isAsking, refreshSessions],
  );

  const rateMessage = useCallback(async (messageId: string, userFeedback: boolean) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, user_feedback: userFeedback } : message,
      ),
    );

    try {
      await api.sendFeedback(messageId, userFeedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save feedback.');
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, user_feedback: null } : message,
        ),
      );
    }
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      sessions,
      activeSession,
      activeSessionId,
      messages,
      documents,
      isBootstrapping,
      isAsking,
      isUploading,
      uploadProgress,
      error,
      setError,
      selectSession,
      createSession,
      deleteSession,
      uploadDocument,
      deleteDocument,
      askQuestion,
      rateMessage,
      refreshDocuments,
      refreshSessions,
    }),
    [
      activeSession,
      activeSessionId,
      askQuestion,
      createSession,
      deleteDocument,
      deleteSession,
      documents,
      error,
      isAsking,
      isBootstrapping,
      isUploading,
      messages,
      rateMessage,
      refreshDocuments,
      refreshSessions,
      selectSession,
      sessions,
      uploadDocument,
      uploadProgress,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) {
    throw new Error('useChat must be used inside ChatProvider.');
  }
  return value;
}
